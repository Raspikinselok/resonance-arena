// Versuchsleitung: einzelne Läufe, Lernschritt danach und das Vergleichsprotokoll.
// Es läuft immer nur ein Lauf gleichzeitig (ein lokales Modell, eine GPU).

import { randomUUID } from 'node:crypto';
import { runEpisode, missions } from './agent.mjs';
import { chat } from './llm.mjs';
import { buildContext, reflect, learn, addEvidence, needsReflection, CONDITIONS } from './memory.mjs';

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const newId = (prefix) => `${prefix}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${randomUUID().slice(0, 4)}`;

export function createLab({ store, emit = () => {}, chatFn = chat }) {
  const state = { busy: false, label: null, abort: null };

  // Baseline für die Skill-Bewertung: Mittel der erfolgreichen Läufe ohne Memory (gleiches Modell, gleiche Mission)
  function baselineSteps(model, mission) {
    const runs = store.listRuns().filter((r) => !r.simulated && r.condition === 'none' && r.success && r.model === model && r.mission === mission);
    return avg(runs.map((r) => r.steps));
  }

  async function executeRun(input, signal) {
    const cfg = {
      mission: 'coldstart', variant: 'standard', seed: 1, condition: 'none', bank: 'default', learn: true, simulated: false,
      ...input, id: newId('run'),
    };
    cfg.seed = Number(cfg.seed) || 1;
    if (!missions[cfg.mission]) throw new Error(`Unbekannte Mission: ${cfg.mission}`);
    if (!CONDITIONS[cfg.condition]) throw new Error(`Unbekannte Memory-Bedingung: ${cfg.condition}`);
    if (!cfg.simulated && (!cfg.model || !cfg.baseUrl)) throw new Error('Kein Modell verbunden.');

    const withMemory = cfg.condition !== 'none';
    const bank = withMemory ? store.loadBank(cfg.bank) : null;
    const ctx = buildContext(bank, cfg.condition, cfg.mission);
    // Denkphase standardmäßig aus (schnell); mit cfg.thinking an, dann braucht die Antwort mehr Tokens
    const llm = (req) => chatFn({ baseUrl: cfg.baseUrl, model: cfg.model, seed: cfg.seed, reasoning: cfg.thinking ? undefined : 'none', ...req, maxTokens: (req.maxTokens ?? 350) + (cfg.thinking ? 700 : 0) });

    const run = await runEpisode({ cfg, llm, memoryText: ctx.text, memoryUsed: ctx.used, emit, signal, pace: cfg.pace ?? 350 });
    store.saveRun(run);

    // Lernen nur mit echtem Modell, eingeschaltetem Lernen und abgeschlossenem Lauf
    const finished = !['aborted', 'llm_error'].includes(run.reason);
    if (withMemory && cfg.learn && !cfg.simulated && finished) {
      let reflection = null;
      if (needsReflection(cfg.condition)) {
        emit({ runId: run.id, type: 'reflection_start' });
        try {
          reflection = await reflect({ llm, run, bank, signal });
          run.reflection = { lesson: reflection.lesson, skill: reflection.skill, reviseId: reflection.reviseId, raw: reflection.raw, latencyMs: reflection.call.latencyMs, completionTokens: reflection.call.completionTokens };
        } catch (err) {
          run.reflection = { error: String(err.message ?? err) };
        }
      }
      const fresh = store.loadBank(cfg.bank);
      const changes = learn(fresh, run, reflection, baselineSteps(cfg.model, cfg.mission));
      store.saveBank(fresh);
      run.learned = {
        lesson: changes.lesson?.text ?? null, newSkill: changes.newSkill?.id ?? null,
        revisedSkill: changes.revised ? `${changes.revised.id} v${changes.revised.version}` : null, statusChanges: changes.statusChanges,
      };
      store.saveRun(run);
      emit({ runId: run.id, type: 'memory_update', learned: run.learned, reflection: run.reflection ?? null });
    }
    const { events, ...summary } = run;
    return summary;
  }

  // Sperrt die Arena für die Dauer einer Aufgabe und meldet Start und Ende.
  async function exclusive(label, job) {
    if (state.busy) throw new Error('Es läuft bereits ein Versuch.');
    state.busy = true; state.label = label; state.abort = new AbortController();
    emit({ type: 'lab', busy: true, label });
    try { return await job(state.abort.signal); }
    finally { state.busy = false; state.label = null; state.abort = null; emit({ type: 'lab', busy: false }); }
  }

  // Fairer Vergleich in drei Phasen:
  //   1. Baseline:  jede Prüfaufgabe ohne Memory
  //   2. Training:  Trainingsaufgaben mit Memory, der Agent lernt
  //   3. Prüfung:   dieselben Prüfaufgaben mit eingefrorenem Memory
  // Prüfaufgaben nutzen andere Seeds und auf Wunsch unbekannte Varianten.
  async function protocol(input, signal) {
    const p = {
      condition: 'skills', bank: `proto-${Date.now().toString(36)}`, trainVariant: 'standard',
      trainSeeds: [101, 102, 103], tests: [{ variant: 'standard', seed: 201 }, { variant: 'altered', seed: 301 }],
      ...input, id: newId('proto'),
    };
    if (p.condition === 'none') throw new Error('Das Protokoll braucht eine Memory-Bedingung zum Vergleichen.');
    const base = { model: p.model, baseUrl: p.baseUrl, provider: p.provider, simulated: p.simulated, thinking: p.thinking, mission: p.mission ?? 'coldstart', protocolId: p.id, pace: p.pace };
    const plan = [
      ...p.tests.map((t) => ({ ...base, ...t, condition: 'none', phase: 'baseline', learn: false })),
      ...p.trainSeeds.map((seed) => ({ ...base, variant: p.trainVariant, seed, condition: p.condition, bank: p.bank, phase: 'train', learn: true })),
      ...p.tests.map((t) => ({ ...base, ...t, condition: p.condition, bank: p.bank, phase: 'eval', learn: false })),
    ];
    const results = [];
    for (const [i, cfg] of plan.entries()) {
      if (signal.aborted) break;
      emit({ type: 'protocol', id: p.id, index: i + 1, total: plan.length, phase: cfg.phase, variant: cfg.variant, seed: cfg.seed });
      results.push(await executeRun(cfg, signal));
    }
    // Die Prüfläufe ändern das Memory währenddessen nicht. Ihre Messwerte zählen erst jetzt als Belege.
    if (!p.simulated && !signal.aborted) {
      const bank = store.loadBank(p.bank);
      const changes = results.filter((r) => r.phase === 'eval').flatMap((r) => addEvidence(bank, r, baselineSteps(p.model, base.mission)));
      store.saveBank(bank);
      emit({ type: 'memory_update', learned: { statusChanges: changes } });
    }
    emit({ type: 'protocol', id: p.id, done: true, total: plan.length, completed: results.length });
    return { id: p.id, bank: p.bank, runs: results };
  }

  return {
    state,
    startRun: (cfg) => exclusive('run', (signal) => executeRun(cfg, signal)),
    startProtocol: (cfg) => exclusive('protocol', (signal) => protocol(cfg, signal)),
    stop: () => { state.abort?.abort(); return Boolean(state.abort); },
  };
}
