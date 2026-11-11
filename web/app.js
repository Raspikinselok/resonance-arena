// Oberfläche der Arena: Missionskontrolle, Live-Log, Memory-Ansicht, Vergleichsdiagramm.
// Alle Zustände kommen vom Server (REST + Ereignisstrom). Hier wird nichts simuliert.

import { createScene } from './scene.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const api = async (path, payload) => {
  const res = await fetch(path, payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : undefined);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
};

const COLORS = { none: '#7389a8', episodic: '#9b7bff', skills: '#35e0ff', full: '#3dffa2' };
const PHASE = { baseline: 'B', train: 'T', eval: 'P', single: '·' };
const VARIANT = { standard: 'Standard', relocated: 'Umgeräumt', altered: 'Verändert' };
const REASON = { reactor_online: 'Reaktor online', lockout: 'Reaktor gesperrt (3 Fehlstarts)', out_of_steps: 'Aktionsbudget aufgebraucht', aborted: 'abgebrochen', llm_error: 'Modellfehler' };
const STATUS = { validated: 'bewährt', testing: 'im Test', candidate: 'Vorschlag', rejected: 'verworfen' };

const scene = createScene($('stage'), $('labels'));
scene.say(null);
scene.hooks.onStats = (s) => { $('quality').textContent = `Grafik: ${s.auto ? 'Auto · ' : ''}${s.quality} · ${s.fps} fps`; };
$('quality').onclick = () => scene.cycleQuality();

let meta = { conditions: {}, missions: [] };
let conn = null;
let runs = [];
let busy = false;
let liveBank = 'default';

// ---------- Verbindung und Modellwahl
async function connect(manual) {
  $('conn-status').className = 'hint';
  $('conn-status').textContent = 'Suche Modellserver …';
  conn = await api('/api/connect', manual && $('base-url').value.trim() ? { baseUrl: $('base-url').value.trim() } : {});
  const sel = $('model');
  sel.innerHTML = '';
  if (!conn.ok || !conn.models.length) {
    $('conn-status').className = 'hint err';
    $('conn-status').textContent = `Kein Modellserver erreichbar${conn.error ? ` (${conn.error})` : ''}. LM Studio: Developer → Server starten.`;
    $('model-chip').className = 'chip off';
    $('model-chip').textContent = 'nicht verbunden';
    return;
  }
  $('base-url').value = conn.baseUrl;
  for (const m of conn.models) sel.add(new Option(`${m.loaded ? '● ' : ''}${m.id}${m.quantization ? ` · ${m.quantization}` : ''}`, m.id));
  const wish = [localStorage.getItem('arena-model'), meta.defaultModel, conn.models.find((m) => m.loaded)?.id].find((id) => conn.models.some((m) => m.id === id));
  if (wish) sel.value = wish;
  $('conn-status').textContent = `${conn.provider} · ${conn.models.length} Sprachmodelle gefunden (● = geladen)`;
  showModel(sel.value, false);
}
function showModel(id, confirmed) {
  $('model-chip').className = `chip ${confirmed ? 'on' : ''}`;
  $('model-chip').textContent = confirmed ? `Modell laut Server: ${id}` : `gewählt: ${id}`;
  $('model-chip').title = confirmed ? 'Diese Kennung hat der Modellserver in seiner letzten Antwort gemeldet.' : 'Noch kein Aufruf in dieser Sitzung.';
}

function config() {
  const simulated = $('simulated').checked;
  return {
    simulated, baseUrl: conn?.baseUrl, provider: conn?.provider, model: $('model').value,
    condition: $('condition').value, variant: $('variant').value, seed: Number($('seed').value) || 1,
    bank: $('bank').value.trim() || 'default', learn: $('learn').checked, thinking: $('thinking')?.checked ?? false,
  };
}
async function launch(path, cfg) {
  try { await api(path, cfg); } catch (err) { note(err.message, 'bad'); }
}

// ---------- Live-Log
const log = $('log');
function note(text, cls = 'note') {
  const li = document.createElement('li');
  li.className = cls;
  li.innerHTML = esc(text);
  log.append(li);
  li.scrollIntoView({ block: 'nearest' });
  return li;
}
const dropThinking = () => log.querySelector('.thinking')?.remove();

function onEvent(e) {
  if (e.type === 'lab') {
    busy = e.busy;
    for (const id of ['start', 'protocol']) $(id).disabled = busy;
    $('stop').disabled = !busy;
    if (!busy) { dropThinking(); scene.setThinking(false); scene.say(null); refresh(); }
  }
  if (e.type === 'protocol') {
    $('progress').textContent = e.done ? `Protokoll beendet: ${e.completed} von ${e.total} Läufen.`
      : `Protokoll: Lauf ${e.index} von ${e.total} · ${{ baseline: 'Baseline ohne Memory', train: 'Training', eval: 'Prüfung' }[e.phase]} · ${VARIANT[e.variant]} · Seed ${e.seed}`;
  }
  if (e.type === 'run_start') {
    const r = e.run;
    log.innerHTML = '';
    liveBank = r.bank ?? liveBank;
    $('sim-badge').hidden = !r.simulated;
    $('run-head').innerHTML = `<b>${esc(VARIANT[r.variant])}</b> · Seed ${r.seed} · ${esc(meta.conditions[r.condition])}${r.learn && r.condition !== 'none' ? ' · lernt' : ''} · max. ${r.maxSteps} Aktionen`;
    scene.reset(e.view);
    if (e.memoryText) {
      const li = note('', 'note');
      li.innerHTML = `<details><summary>Memory im Kontext: ${r.memoryUsed.skills.length} Skills, ${r.memoryUsed.lessons.length} Lektionen, ${r.memoryUsed.episodes.length} Episoden</summary><pre class="res">${esc(e.memoryText)}</pre></details>`;
    } else if (r.condition !== 'none') note('Memory-Bank ist noch leer: dieser Lauf startet ohne Vorwissen.');
  }
  if (e.type === 'thinking') {
    dropThinking();
    note(`Schritt ${e.step}: Modell entscheidet …`, 'thinking');
    scene.setThinking(true);
    scene.say('entscheidet …');
  }
  if (e.type === 'reflection_start') { note('Reflexion: Das Modell wertet den Lauf aus …', 'thinking'); scene.setThinking(true); scene.say('wertet aus …'); }
  if (e.type === 'skill_declared') note(`Agent erklärt, Skill ${e.skill} zu folgen${e.known ? '' : ' (unbekannte Kennung!)'}.`);
  if (e.type === 'note') note(e.text, e.level === 'error' ? 'bad' : 'note');
  if (e.type === 'step') {
    dropThinking();
    scene.setThinking(false);
    const cls = e.result.ok ? 'ok' : e.result.error === 'mistake' ? 'mistake' : 'bad';
    const args = Object.values(e.action.args).map(esc).join(', ');
    const li = note('', cls);
    const speed = e.latencyMs ? `${(e.latencyMs / 1000).toFixed(1)} s · ${e.completionTokens ?? '?'} Tokens` : '';
    li.innerHTML = `<div class="act"><span class="n">${e.step}</span>${esc(e.action.tool)}(${args})</div>`
      + (e.why ? `<div class="why">„${esc(e.why)}“</div>` : '')
      + `<div class="res">${e.result.ok ? '' : '✕ '}${esc(e.result.text)}</div>`
      + (e.thought ? `<details><summary>Denkphase des Modells</summary><div class="res">${esc(e.thought)}</div></details>` : '')
      + (e.rawReply ? `<details><summary>Rohantwort</summary><div class="res">${esc(e.rawReply)}</div></details>` : '')
      + (speed ? `<div class="meta">${speed}</div>` : '');
    li.scrollIntoView({ block: 'nearest' });
    if (e.action.tool === 'go' && e.result.ok) scene.moveTo(e.view.room);
    scene.act(e);
    scene.setView(e.view);
    scene.say(e.why ? e.why.slice(0, 90) : null);
  }
  if (e.type === 'run_end') {
    dropThinking();
    scene.setThinking(false);
    scene.setView(e.view);
    const r = e.run;
    if (r.modelReported) showModel(r.modelReported, true);
    const li = note('', `end ${r.success ? 'win' : 'lose'}`);
    li.innerHTML = `<b>${r.success ? 'ERFOLG' : 'GESCHEITERT'}</b> · ${esc(REASON[r.reason] ?? r.reason)} · ${r.steps} Aktionen<br>`
      + `<span class="meta">ungültig ${r.invalid} · Fehlgriffe ${r.mistakes} · Wiederholungen ${r.repeats}${r.llmCalls ? ` · ${r.llmCalls} Modellaufrufe · Ø ${(r.avgLatencyMs / 1000).toFixed(1)} s · ${r.tokensPerSecond ?? '?'} Tok/s` : ''}<br>`
      + `verborgene Ursache: ${esc(r.hidden.faults.join(' + '))}${r.simulated ? ' · SIMULATION, keine Modellleistung' : ''}</span>`;
    scene.say(r.success ? 'Reaktor online.' : 'Mission gescheitert.');
  }
  if (e.type === 'memory_update') {
    dropThinking();
    scene.setThinking(false);
    const l = e.learned ?? {};
    const parts = [];
    if (l.newSkill) parts.push(`neuer Skill-Vorschlag ${l.newSkill}`);
    if (l.revisedSkill) parts.push(`Skill überarbeitet: ${l.revisedSkill}`);
    if (l.lesson) parts.push(`Lektion: „${l.lesson}“`);
    for (const c of l.statusChanges ?? []) parts.push(`Skill ${c.skill}: ${STATUS[c.from]} → ${STATUS[c.to]}`);
    if (e.reflection?.error) parts.push(`Reflexion fehlgeschlagen: ${e.reflection.error}`);
    note(parts.length ? `Memory: ${parts.join(' · ')}` : 'Memory: Episode abgelegt.');
    renderMemory();
  }
}

// ---------- Memory-Ansicht
async function renderMemory() {
  const bank = await api(`/api/memory?bank=${encodeURIComponent(liveBank)}`);
  $('bank-name').textContent = `Bank „${bank.name}“ · ${bank.skills.length} Skills · ${bank.lessons.length} Lektionen · ${bank.episodes.length} Episoden`;
  $('skills').innerHTML = bank.skills.length ? bank.skills.map((s) => {
    const dots = s.evidence.map((ev) => `<i class="dot ${ev.success ? '' : 'fail'} ${ev.version === s.version ? '' : 'old'}" title="v${ev.version} · ${VARIANT[ev.variant]} · Seed ${ev.seed} · ${ev.steps} Aktionen · ${ev.success ? 'Erfolg' : 'gescheitert'}${ev.declared ? ' · vom Agenten erklärt' : ''}"></i>`).join('');
    return `<article class="skill"><header><b>${esc(s.id)} · ${esc(s.name)}</b><span class="badge ${s.status}">${STATUS[s.status]}</span><span class="hint">v${s.version}</span></header>
      <div class="hint">${esc(s.task)}${s.preconditions.length ? `<br>Wenn: ${s.preconditions.map(esc).join('; ')}` : ''}</div>
      <ol>${s.strategy.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <div class="ev">Belege aus der Spielwelt: ${dots || 'noch keine'}${s.baselineSteps != null ? ` · Baseline ohne Memory: Ø ${s.baselineSteps.toFixed(1)} Aktionen` : ''}</div>
      ${s.history.length ? `<details><summary class="hint">${s.history.length} frühere Version(en)</summary>${s.history.map((h) => `<div class="hint">v${h.version} (${STATUS[h.status]}): ${h.strategy.map(esc).join(' → ')}</div>`).join('')}</details>` : ''}</article>`;
  }).join('') : '<p class="empty">Noch keine Skills. Sie entstehen nach Läufen mit „Skill-Memory“ oder „Skills + Reflexion“.</p>';
  $('lessons').innerHTML = bank.lessons.map((l) => `<li>${esc(l.text)} <span class="hint">(aus ${l.fromSuccess ? 'Erfolg' : 'Scheitern'})</span></li>`).join('') || '<li class="empty">keine</li>';
  $('episodes').innerHTML = bank.episodes.map((ep) => `<li>${ep.success ? '✓' : '✕'} ${VARIANT[ep.variant]} · Seed ${ep.seed} · ${ep.steps} Aktionen</li>`).join('') || '<li class="empty">keine</li>';
}

// ---------- Vergleichsdiagramm und Aussage
function renderChart() {
  const list = runs.filter((r) => ($('show-sim').checked || !r.simulated) && r.reason !== 'aborted');
  const H = 132, top = 14, barW = 20, gap = 7;
  let x = 30, lastGroup = null, bars = '';
  for (const r of list) {
    const group = r.protocolId ?? 'single';
    if (lastGroup !== null && group !== lastGroup) { bars += `<line x1="${x + 3}" y1="6" x2="${x + 3}" y2="${H + 22}" stroke="rgba(90,190,255,.25)" stroke-dasharray="3 4"/>`; x += 14; }
    lastGroup = group;
    const h = Math.max(3, (r.steps / 36) * (H - top));
    const color = r.simulated ? '#444e5e' : COLORS[r.condition];
    const tip = `${r.simulated ? 'SIMULATION' : r.model} · ${meta.conditions[r.condition]} · ${VARIANT[r.variant]} · Seed ${r.seed} · ${r.steps} Aktionen · ${r.success ? 'Erfolg' : `gescheitert (${REASON[r.reason] ?? r.reason})`}${r.thinking ? ' · mit Denkphase' : ''}`;
    bars += `<g><title>${esc(tip)}</title>
      <rect x="${x}" y="${H - h}" width="${barW}" height="${h}" fill="${r.success ? color : 'none'}" stroke="${color}" stroke-width="1.5" ${r.success ? '' : 'stroke-dasharray="3 2"'}/>
      <text x="${x + barW / 2}" y="${H - h - 4}" text-anchor="middle" fill="${r.success ? '#d7e6f7' : '#ff3b5c'}" font-size="10">${r.success ? r.steps : '✕'}</text>
      <text x="${x + barW / 2}" y="${H + 12}" text-anchor="middle" fill="#7f95b0" font-size="9">${PHASE[r.phase] ?? '·'}</text>
      <text x="${x + barW / 2}" y="${H + 23}" text-anchor="middle" fill="${r.variant === 'standard' ? '#55708f' : '#ffb347'}" font-size="9">${VARIANT[r.variant][0]}</text></g>`;
    x += barW + gap;
  }
  const axis = [0, 12, 24, 36].map((v) => { const y = H - (v / 36) * (H - top); return `<line x1="26" x2="${x}" y1="${y}" y2="${y}" stroke="rgba(90,190,255,.1)"/><text x="22" y="${y + 3}" text-anchor="end" fill="#55708f" font-size="9">${v}</text>`; }).join('');
  $('chart').innerHTML = list.length
    ? `<svg width="${Math.max(x + 10, 300)}" viewBox="0 0 ${Math.max(x + 10, 300)} ${H + 28}" font-family="Consolas, monospace">${axis}${bars}</svg>`
    : '<p class="empty">Noch keine Läufe. Balkenhöhe = Aktionen bis zum Ziel, gestrichelt = gescheitert. B Baseline · T Training · P Prüfung.</p>';
  $('legend').innerHTML = Object.entries(meta.conditions).map(([id, name]) => `<span><i style="background:${COLORS[id]}"></i>${esc(name)}</span>`).join('') + '<span>B Baseline · T Training · P Prüfung · S/U/V Variante</span>';
  $('chart').scrollLeft = 1e6;
}

function renderVerdict() {
  const real = runs.filter((r) => !r.simulated && r.reason !== 'aborted' && r.reason !== 'llm_error');
  const outcome = (r) => (r.success ? `${r.steps} Aktionen ✓` : `gescheitert nach ${r.steps} ✕`);
  const protoId = real.findLast((r) => r.phase === 'eval')?.protocolId;
  if (protoId) {
    const mine = real.filter((r) => r.protocolId === protoId);
    const evals = mine.filter((r) => r.phase === 'eval');
    let better = 0, worse = 0;
    const lines = evals.map((ev) => {
      const base = mine.find((r) => r.phase === 'baseline' && r.variant === ev.variant && r.seed === ev.seed);
      if (!base) return '';
      const score = (r) => (r.success ? r.steps : 99);
      const d = score(ev) - score(base);
      if (d < 0) better++; else if (d > 0) worse++;
      const cls = d < 0 ? 'up' : d > 0 ? 'down' : 'same';
      const word = d < 0 ? 'besser' : d > 0 ? 'schlechter' : 'gleich';
      return `<div><b>${VARIANT[ev.variant]}</b> (Seed ${ev.seed}): ohne Memory ${outcome(base)} → mit ${esc(meta.conditions[ev.condition])} ${outcome(ev)} <span class="${cls}">${word}</span></div>`;
    }).join('');
    const train = mine.filter((r) => r.phase === 'train');
    $('verdict').innerHTML = `<div><b>${esc(evals[0].model)}</b>${evals[0].thinking ? ' (mit Denkphase)' : ''} · letztes Protokoll</div>${lines}
      <div class="hint">Training: ${train.filter((r) => r.success).length} von ${train.length} Läufen erfolgreich. Memory half in ${better}, schadete in ${worse} von ${evals.length} Prüfaufgaben.
      Ein Lauf je Aufgabe ist eine Stichprobe: für eine belastbare Aussage mit weiteren Seeds wiederholen.</div>`;
    return;
  }
  if (!real.length) { $('verdict').innerHTML = '<p class="empty">Die Aussage entsteht aus echten Läufen. Starte eine Mission oder das Protokoll.</p>'; return; }
  const byCond = Object.keys(meta.conditions).map((c) => {
    const rs = real.filter((r) => r.condition === c);
    if (!rs.length) return '';
    const wins = rs.filter((r) => r.success);
    const mean = wins.length ? (wins.reduce((a, r) => a + r.steps, 0) / wins.length).toFixed(1) : '–';
    return `<div><b>${esc(meta.conditions[c])}</b>: ${wins.length} von ${rs.length} erfolgreich, Ø ${mean} Aktionen bei Erfolg</div>`;
  }).join('');
  $('verdict').innerHTML = `${byCond}<div class="hint">Einzelläufe mit unterschiedlichen Aufgaben sind nur grob vergleichbar. Das Protokoll stellt allen Bedingungen dieselben Aufgaben.</div>`;
}

async function refresh() {
  runs = await api('/api/runs');
  renderChart();
  renderVerdict();
  renderMemory();
}

// ---------- Start
async function init() {
  meta = await api('/api/meta');
  for (const [id, name] of Object.entries(meta.conditions)) $('condition').add(new Option(name, id));
  for (const [id, name] of Object.entries(meta.missions[0].variants)) $('variant').add(new Option(name, id));
  $('learn').closest('.row').insertAdjacentHTML('afterend', '<label class="check" title="Denk-Modelle wie Gemma 4 überlegen vor jeder Antwort. Das kostet auf dem Laptop etwa das Sechsfache an Zeit."><input id="thinking" type="checkbox"> Denkphase des Modells an (langsam)</label>');
  $('connect').onclick = () => connect(true);
  $('model').onchange = () => { localStorage.setItem('arena-model', $('model').value); showModel($('model').value, false); };
  $('bank').onchange = () => { liveBank = $('bank').value.trim() || 'default'; renderMemory(); };
  $('start').onclick = () => launch('/api/runs', config());
  $('stop').onclick = () => api('/api/stop', {});
  $('protocol').onclick = () => {
    const c = config();
    if (c.condition === 'none') { c.condition = 'skills'; $('condition').value = 'skills'; }
    const bank = `protokoll-${new Date().toISOString().slice(5, 16).replace(/[:T]/g, '-')}`;
    $('bank').value = liveBank = bank;
    launch('/api/protocol', { ...c, bank });
  };
  $('reset-bank').onclick = async () => { if (confirm(`Memory-Bank „${liveBank}“ wirklich leeren?`)) { await api('/api/memory/reset', { bank: liveBank }); renderMemory(); } };
  $('show-sim').onchange = renderChart;
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.onclick = () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === btn));
      $('tab-log').hidden = btn.dataset.tab !== 'log';
      $('tab-memory').hidden = btn.dataset.tab !== 'memory';
    };
  }
  new EventSource('/api/events').onmessage = (m) => onEvent(JSON.parse(m.data));
  await Promise.all([connect(false), refresh()]);
}
init().catch((err) => note(`Start fehlgeschlagen: ${err.message}`, 'bad'));
