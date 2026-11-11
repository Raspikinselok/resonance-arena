// Der Agentenlauf: Beobachtung -> Modellentscheidung -> Aktion in der Welt -> Ergebnis.
// Pro Schritt genau ein Inferenzaufruf. Die 3D-Szene animiert nur zwischen diesen Entscheidungen.

import * as coldstart from './missions/coldstart.mjs';
import { extractJson } from './llm.mjs';
import { rng, pick } from './rng.mjs';

export const missions = { coldstart };

const param = (description) => ({ type: 'string', description });
const WHY = param('One short sentence: why this action now.');
const fn = (name, description, props) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties: { ...props, why: WHY }, required: Object.keys(props) } },
});
const TOOLS = [
  fn('go', 'Walk to an adjacent room.', { room: param('Room id listed under EXITS.') }),
  fn('inspect', 'Examine a visible object, read a display, or open a container.', { target: param('Object id listed under VISIBLE.') }),
  fn('take', 'Pick up a visible item.', { item: param('Item id listed under VISIBLE.') }),
  fn('use', 'Use a carried item on a visible object.', { item: param('Item id listed under CARRYING.'), target: param('Object id listed under VISIBLE.') }),
  fn('operate', 'Send a command to a visible device.', { device: param('Device id listed under VISIBLE.'), command: param('One of the commands shown for that device.') }),
];
// Notizzettel: optionales Feld an jedem Werkzeug. Der Agent schreibt ihn selbst, er steht im nächsten Schritt wieder im Prompt.
export const NOTE_LIMIT = 400; // Zeichen, grob 100 Tokens
const NOTE = param('Your private notepad, carried to your next turn. Write your diagnosis so far and the remaining plan in at most 50 words. It replaces the previous note.');
const withNote = (tools) => tools.map((t) => ({ ...t, function: { ...t.function, parameters: { ...t.function.parameters, properties: { ...t.function.parameters.properties, note: NOTE }, required: [...t.function.parameters.required, 'note'] } } }));
const SKILL_TOOL = fn('use_skill', 'Declare that you now follow a skill from memory. Costs no action.', { skill_id: param('Skill id, e.g. S1.') });

const SYSTEM = `You are the control AI of a maintenance robot aboard the abandoned research station Kepler-9.
Reach the objective in as few actions as possible. You only know what you have observed.
Rules:
- Choose exactly one action per turn. Only use ids listed under EXITS, VISIBLE or CARRYING.
- All rooms connect through the atrium.
- Diagnose before you repair. Failed reactor starts and wrong repairs are costly; three failed starts end the mission.
- Never repeat an action that already failed.
- Give one short sentence of reasoning in "why".`;

const JSON_MODE = `
Reply with ONLY one JSON object and nothing else:
{"tool": "go|inspect|take|use|operate", "args": {...}, "why": "short reason"}
Args per tool: go {"room"}, inspect {"target"}, take {"item"}, use {"item","target"}, operate {"device","command"}.`;
const JSON_NOTE = '\nWith the notepad the object MUST have four keys: {"tool": ..., "args": {...}, "why": "...", "note": "what you know now and the steps still to do, max 50 words"}. Rewrite "note" every turn.';

const cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
const fmtAction = (a) => `${a.tool}(${Object.entries(a.args ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')})`;

// Arbeitsgedächtnis innerhalb EINES Versuchs (kein Langzeit-Memory, gilt für alle Bedingungen gleich):
// was der Agent in anderen Räumen schon gesehen hat und welche Aktionen bereits gescheitert sind.
function notes(obs, history, seen) {
  const lines = [];
  const elsewhere = Object.entries(seen).filter(([room]) => room !== obs.room).map(([room, things]) => `${room}: ${things.join(', ') || 'nothing'}`);
  if (elsewhere.length) lines.push(`SEEN IN OTHER ROOMS: ${elsewhere.join(' / ')}`);
  const unvisited = [...new Set(Object.keys(seen).length ? ['atrium', 'reactor', 'control', 'storage', 'lab'] : [])].filter((r) => !seen[r]);
  if (unvisited.length) lines.push(`NOT VISITED YET: ${unvisited.join(', ')}`);
  const failed = new Map();
  for (const h of history) if (!h.result.ok) { const k = fmtAction(h.action); failed.set(k, { n: (failed.get(k)?.n ?? 0) + 1, text: h.result.text }); }
  const list = [...failed].slice(-6).map(([k, v]) => `- ${k}${v.n > 1 ? ` (tried ${v.n}x)` : ''}: ${cut(v.text.replace(/\s+/g, ' '), 90)}`);
  if (list.length) lines.push(`FAILED BEFORE, do not repeat:\n${list.join('\n')}`);
  return lines;
}

// Reihenfolge: aktueller Zustand zuerst, Verlauf danach, Notizzettel und Aufforderung am Ende.
// Eine cache-freundliche Variante (Verlauf zuerst, nur anhängen) wurde am 11.11.2026 mit Gemma 4 E2B
// gemessen: 0 von 3 Läufen erfolgreich statt 3 von 3 mit dieser Reihenfolge. Deshalb bleibt es so.
function renderTurn(obs, step, maxSteps, history, declared = [], seen = {}, note = null) {
  const vis = obs.visible.map((v) => `${v.id} [${v.kind}${v.commands.length ? ': ' + v.commands.join('|') : ''}]`).join(', ') || 'nothing';
  const past = history.map((h, i) => {
    const recent = i >= history.length - 8;
    return `${i + 1}. ${fmtAction(h.action)} -> ${h.result.ok ? 'OK' : 'FAILED'}: ${cut(h.result.text.replace(/\s+/g, ' '), recent ? 340 : 90)}`;
  });
  return [
    `OBJECTIVE: ${obs.objective}`,
    `STEP ${step} of ${maxSteps}`,
    `LOCATION: ${obs.room} (${obs.roomName}). ${obs.description}`,
    `EXITS: ${obs.exits.join(', ')}`,
    `VISIBLE: ${vis}`,
    `CARRYING: ${obs.inventory.join(', ') || 'nothing'}`,
    ...notes(obs, history, seen),
    declared.length ? `SKILL IN USE: ${declared.join(', ')} (already declared; now act in the world)` : null,
    past.length ? `ACTIONS SO FAR:\n${past.join('\n')}` : 'ACTIONS SO FAR: none',
    note === null ? null : `YOUR NOTEPAD (you wrote this last turn): ${note || '(empty)'}`,
    note === null ? 'Choose your next action.' : 'Choose your next action and rewrite your notepad in "note": what you know now and the steps still to do.',
  ].filter((x) => x !== null).join('\n');
}

// Liest die Entscheidung aus der Modellantwort: Tool-Call oder JSON im Text.
export function parseAction(message) {
  const call = message?.tool_calls?.[0]?.function;
  let tool, args;
  if (call) {
    tool = call.name;
    try { args = typeof call.arguments === 'string' ? JSON.parse(call.arguments || '{}') : call.arguments; } catch { args = null; }
  } else {
    // Gemma 4 setzt Zeichenketten in <|"|>; rutscht ein nativer Aufruf in den Text, steht das dort roh
    const text = (message?.content ?? '').replaceAll('<|"|>', '"');
    const j = extractJson(text);
    // Kleine Modelle schreiben den Aufruf manchmal als Text: go(room=atrium, why: ...) oder go{room:"atrium"}
    const plain = j ? null : text.match(/\b(go|inspect|take|use|operate|use_skill)\s*[({]([^(){}]*)[)}]/i);
    if (j) { tool = j.tool ?? j.action ?? j.name; args = j.args ?? j.arguments ?? j.parameters ?? j; }
    else if (plain) {
      tool = plain[1];
      args = Object.fromEntries(plain[2].split(/,\s*(?=\w+\s*[=:])/).map((kv) => kv.match(/^\s*(\w+)\s*[=:]\s*([^]*)$/)).filter(Boolean)
        .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, '')]));
    }
  }
  if (typeof tool !== 'string' || !args || typeof args !== 'object') return null;
  const { why, note, tool: _t, action: _a, name: _n, args: _x, ...rest } = args;
  const whole = call ? {} : extractJson(message?.content ?? '') ?? {};
  const top = whole.why;
  const memo = typeof note === 'string' ? note : typeof whole.note === 'string' ? whole.note : null;
  return { tool: tool.trim().toLowerCase(), args: rest, why: typeof why === 'string' ? why : typeof top === 'string' ? top : '', note: memo, viaToolCall: Boolean(call) };
}

// Simulationsmodus: zufällige gültige Aktionen, KEIN Sprachmodell. Nur für UI-Tests.
function simulatedPolicy(obs, r) {
  const options = [];
  for (const room of obs.exits) options.push({ tool: 'go', args: { room } });
  for (const v of obs.visible) {
    options.push({ tool: 'inspect', args: { target: v.id } });
    if (v.kind === 'item') options.push({ tool: 'take', args: { item: v.id } });
    for (const command of v.commands) options.push({ tool: 'operate', args: { device: v.id, command } });
    for (const item of obs.inventory) options.push({ tool: 'use', args: { item, target: v.id } });
  }
  return { ...pick(r, options), why: 'SIMULATION: zufällige gültige Aktion, kein Modell.' };
}

// Führt eine Mission aus. `llm` kapselt den echten Aufruf, `emit` meldet Ereignisse live.
export async function runEpisode({ cfg, llm, memoryText = '', memoryUsed = { episodes: [], skills: [], lessons: [] }, emit = () => {}, signal, pace = 0 }) {
  const mission = missions[cfg.mission];
  const world = mission.create({ variant: cfg.variant, seed: cfg.seed, fault: cfg.fault });
  const maxSteps = cfg.maxSteps ?? world.maxSteps;
  const simRng = rng(Number(cfg.seed) + 7919);
  const events = [];
  const history = [];
  const say = (e) => { const ev = { ...e, t: Date.now() }; if (e.type !== 'thinking') events.push(ev); emit({ runId: cfg.id, ...ev }); };

  const run = {
    id: cfg.id, startedAt: new Date().toISOString(), mission: cfg.mission, objective: mission.objective,
    variant: cfg.variant, seed: cfg.seed, condition: cfg.condition, bank: cfg.bank ?? null, learn: Boolean(cfg.learn),
    phase: cfg.phase ?? 'single', protocolId: cfg.protocolId ?? null,
    notepad: Boolean(cfg.notepad), thinking: Boolean(cfg.thinking), simulated: Boolean(cfg.simulated), model: cfg.simulated ? null : cfg.model, modelReported: null,
    baseUrl: cfg.simulated ? null : cfg.baseUrl, provider: cfg.provider ?? null, maxSteps,
    memoryUsed, skillsDeclared: [], mode: cfg.simulated ? 'simulation' : 'tools',
    noteUpdates: 0, steps: 0, invalid: 0, mistakes: 0, repeats: 0, unparsed: 0, llmCalls: 0, llmErrors: 0,
    latencyMs: 0, promptTokens: 0, completionTokens: 0, reasoningTokens: 0, success: false, reason: null,
  };
  say({ type: 'run_start', run: { ...run }, view: mission.spectate(world), memoryText });

  const hasSkills = memoryUsed.skills.length > 0;
  let toolFails = 0;
  let note = ''; // Notizzettel des Agenten, nur aktiv mit cfg.notepad
  const seen = {}; // Raum -> dort gesehene Objekte (Arbeitsgedächtnis dieses Versuchs)
  let declares = 0;

  while (!world.done && run.steps < maxSteps) {
    if (signal?.aborted) { run.reason = 'aborted'; break; }
    const obs = mission.observe(world);
    const stepNo = run.steps + 1;
    seen[obs.room] = obs.visible.map((v) => `${v.id}${v.commands.length ? ` [${v.commands.join('|')}]` : ''}`);
    say({ type: 'thinking', step: stepNo });

    let action, meta = {};
    if (cfg.simulated) {
      action = simulatedPolicy(obs, simRng);
      if (pace) await new Promise((r) => setTimeout(r, pace));
    } else {
      const jsonMode = run.mode === 'json';
      const system = SYSTEM + (jsonMode ? JSON_MODE + (cfg.notepad ? JSON_NOTE : '') + (hasSkills ? '\nOptional: {"tool":"use_skill","args":{"skill_id":"S1"}} to declare a skill.' : '') : '')
        + (memoryText ? `\n\n${memoryText}` : '');
      const base = hasSkills ? [...TOOLS, SKILL_TOOL] : TOOLS;
      const tools = jsonMode ? undefined : cfg.notepad ? withNote(base) : base;
      // Bei Temperatur 0 wiederholt ein kleines Modell denselben Fehlgriff endlos. Etwas Streuung als
      // Grundwert, deutlich mehr, sobald die letzten beiden Aktionen identisch gescheitert sind.
      const [a, b] = history.slice(-2);
      const stuck = a && b && !b.result.ok && JSON.stringify(a.action) === JSON.stringify(b.action);
      const temperature = stuck ? 0.9 : (cfg.temperature ?? 0.3);
      let res;
      try {
        res = await llm({ temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: renderTurn(obs, stepNo, maxSteps, history, run.skillsDeclared, seen, cfg.notepad ? note : null) }], tools, signal });
      } catch (err) {
        if (signal?.aborted) { run.reason = 'aborted'; break; }
        run.llmErrors += 1;
        // Manche Modelle/Server lehnen "tools" ab: einmal auf JSON-Modus umschalten, sonst abbrechen
        if (!jsonMode && run.llmErrors === 1 && err.status) { run.mode = 'json'; say({ type: 'note', text: `Tool-Calls abgelehnt (${cut(String(err.message), 120)}). Wechsle auf JSON-Modus.` }); continue; }
        run.reason = 'llm_error'; run.error = String(err.message ?? err);
        say({ type: 'note', level: 'error', text: `Modellaufruf fehlgeschlagen: ${run.error}` });
        break;
      }
      run.llmCalls += 1;
      run.latencyMs += res.latencyMs;
      run.promptTokens += res.promptTokens ?? 0;
      run.completionTokens += res.completionTokens ?? 0;
      run.reasoningTokens += res.reasoningTokens ?? 0;
      run.modelReported = res.modelReported;
      meta = { latencyMs: res.latencyMs, promptTokens: res.promptTokens, completionTokens: res.completionTokens, stats: res.stats };
      action = parseAction(res.message);
      const thought = cut((res.message?.reasoning_content ?? res.message?.reasoning ?? '').trim(), 600);
      if (thought) meta.thought = thought;
      if (!action) meta.rawReply = cut(res.message?.content ?? '', 300);
      if (cfg.notepad && action?.note?.trim()) { note = cut(action.note.trim().replace(/\s+/g, ' '), NOTE_LIMIT); run.noteUpdates += 1; meta.note = note; }
      // Liefert das Modell wiederholt keinen Tool-Call, ist der JSON-Modus die robustere Schnittstelle
      if (!jsonMode && !action?.viaToolCall && ++toolFails >= 2) { run.mode = 'json'; say({ type: 'note', text: 'Modell liefert keine Tool-Calls. Wechsle auf JSON-Modus.' }); }
    }

    if (action?.tool === 'use_skill') {
      const sid = String(action.args.skill_id ?? '').toUpperCase();
      if (memoryUsed.skills.includes(sid) && !run.skillsDeclared.includes(sid)) run.skillsDeclared.push(sid);
      say({ type: 'skill_declared', step: stepNo, skill: sid, known: memoryUsed.skills.includes(sid), why: action.why, ...meta });
      if (++declares <= 2) continue; // kostet keine Aktion; mehr als zwei Erklärungen zählen als vertane Schritte
    }

    let result;
    if (!action) { result = { ok: false, error: 'unparsed', text: 'No valid action in the reply. Choose exactly one tool.' }; run.unparsed += 1; }
    else {
      result = mission.apply(world, action);
      // Zielt die Aktion auf etwas, das der Agent in einem ANDEREN Raum gesehen hat, sagt ihm das sein Arbeitsgedächtnis.
      // Das verrät nichts Verborgenes: Die Information stammt aus seinen eigenen Beobachtungen.
      if (!result.ok && result.error === 'invalid') {
        const wanted = [action.args.device, action.args.target, action.args.item].filter((x) => typeof x === 'string');
        const where = Object.entries(seen).find(([room, things]) => room !== obs.room && things.some((t) => wanted.includes(t.split(' ')[0])));
        if (where) result = { ...result, text: `${result.text} You saw it in the ${where[0]}: walk there first (via the atrium).` };
      }
    }
    run.steps += 1;
    if (!result.ok) { if (result.error === 'mistake') run.mistakes += 1; else run.invalid += 1; }
    const act = action ? { tool: action.tool, args: action.args } : { tool: 'none', args: {} };
    const key = JSON.stringify(act);
    if (history.some((h) => JSON.stringify(h.action) === key && h.result.text === result.text)) run.repeats += 1;
    history.push({ action: act, result });
    say({ type: 'step', step: run.steps, action: act, why: action?.why ?? '', result, view: mission.spectate(world), ...meta });
  }

  run.success = world.success;
  run.reason = run.reason ?? world.reason ?? (run.steps >= maxSteps ? 'out_of_steps' : 'stopped');
  run.endedAt = new Date().toISOString();
  run.trips = world.trips;
  run.avgLatencyMs = run.llmCalls ? Math.round(run.latencyMs / run.llmCalls) : null;
  run.tokensPerSecond = run.latencyMs && run.completionTokens ? +(run.completionTokens / (run.latencyMs / 1000)).toFixed(1) : null;
  run.hidden = mission.reveal(world);
  const { ...summary } = run;
  say({ type: 'run_end', run: summary, view: mission.spectate(world) });
  run.events = events;
  return run;
}
