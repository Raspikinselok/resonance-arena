// Echter Modelltest ohne Browser: verbindet sich mit dem lokalen Modellserver, lässt den Agenten
// Missionen lösen und zeigt jeden Schritt. Die Läufe landen in data/ und erscheinen in der Arena.
//
//   npm run test:live                                  ein Lauf ohne Memory, erstes Modell
//   npm run test:live -- --model gemma-4-e2b-it --condition skills --runs 3 --bank test1
//   Optionen: --model --base-url --condition none|episodic|skills|full --variant --seed --runs --bank --fault --thinking --notepad

import { createStore } from '../server/store.mjs';
import { createLab } from '../server/experiments.mjs';
import { autodetect, probe } from '../server/llm.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => { const [k, ...v] = a.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const conn = args['base-url'] ? await probe(args['base-url']) : await autodetect(process.env.LLM_BASE_URL);
if (!conn.ok) { console.error('Kein Modellserver erreichbar. Läuft LM Studio (Developer > Server starten) oder Ollama?'); process.exit(1); }
const model = args.model ?? process.env.LLM_MODEL ?? (conn.models.find((m) => m.loaded) ?? conn.models[0]).id;
if (!conn.models.some((m) => m.id === model)) { console.error(`Modell "${model}" nicht gefunden. Vorhanden:\n  ${conn.models.map((m) => m.id).join('\n  ')}`); process.exit(1); }
console.log(`Server: ${conn.provider} (${conn.baseUrl})\nModell: ${model}\n`);

const emit = (e) => {
  if (e.type === 'run_start') console.log(`=== Lauf ${e.run.id} | ${e.run.variant} | Seed ${e.run.seed} | Memory: ${e.run.condition}${e.memoryText ? ` (${e.memoryText.length} Zeichen Kontext)` : ''}`);
  if (e.type === 'step') console.log(`${String(e.step).padStart(2)}. ${e.action.tool}(${Object.values(e.action.args).join(', ')})  ${e.result.ok ? 'OK ' : 'FEHLER '} ${e.result.text.replace(/\s+/g, ' ').slice(0, 110)}\n      warum: ${e.why || '-'}  [${e.latencyMs} ms, ${e.completionTokens ?? '?'} Tokens]`);
  if (e.type === 'step' && e.note) console.log(`      Zettel: ${e.note}`);
  if (e.type === 'skill_declared') console.log(`    -> erklärt Skill ${e.skill}`);
  if (e.type === 'note') console.log(`    Hinweis: ${e.text}`);
  if (e.type === 'reflection_start') console.log('    Reflexion läuft ...');
  if (e.type === 'memory_update') console.log(`    Gelernt: ${JSON.stringify(e.learned)}`);
};
const lab = createLab({ store: createStore(), emit });
const results = [];
for (let i = 0; i < Number(args.runs ?? 1); i++) {
  const r = await lab.startRun({
    baseUrl: conn.baseUrl, provider: conn.provider, model, condition: args.condition ?? 'none', bank: args.bank ?? 'live',
    variant: args.variant ?? 'standard', seed: Number(args.seed ?? 1) + i, fault: args.fault === true ? undefined : args.fault, thinking: Boolean(args.thinking), notepad: Boolean(args.notepad),
  });
  results.push(r);
  console.log(`--> ${r.success ? 'ERFOLG' : 'GESCHEITERT'} (${r.reason}) nach ${r.steps} Aktionen | ungültig ${r.invalid}, Fehler ${r.mistakes}, Wiederholungen ${r.repeats} | ${r.llmCalls} Aufrufe, Ø ${r.avgLatencyMs} ms, ${r.tokensPerSecond ?? '?'} Tok/s | Modus ${r.mode} | Prompt Ø ${r.llmCalls ? Math.round(r.promptTokens / r.llmCalls) : '?'} Tokens | Modell laut Server: ${r.modelReported} | Ursache: ${r.hidden.faults.join('+')}\n`);
}
process.exit(results.every((r) => r.reason !== 'llm_error') ? 0 : 1);
