// Memory und Skill-Evolution.
//
// Vier Versuchsbedingungen:
//   none      kein Langzeitgedächtnis
//   episodic  frühere Abläufe (Aktionen und Ergebnisse) werden abgerufen
//   skills    Skills: Strategien mit Voraussetzungen, Belegen und Status
//   full      Skills + verdichtete Lektionen + eine Episode
//
// Grundsatz: Was das LLM behauptet, ist nur ein Vorschlag (candidate). Ob ein Skill etwas
// taugt, entscheidet ausschließlich die Spielwelt über gemessene Läufe (judge()).

import { extractJson } from './llm.mjs';

export const CONDITIONS = {
  none: 'Ohne Memory',
  episodic: 'Episodisch',
  skills: 'Skill-Memory',
  full: 'Skills + Reflexion',
};
const usesEpisodes = (c) => c === 'episodic' || c === 'full';
const usesSkills = (c) => c === 'skills' || c === 'full';
const usesLessons = (c) => c === 'full';

const cut = (text, n) => (text.length > n ? text.slice(0, n - 1) + '…' : text);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function traceLine(e, n = 110) {
  const args = Object.values(e.action?.args ?? {}).join(', ');
  return `${e.action?.tool ?? '?'}(${args}) -> ${e.result.ok ? 'OK' : 'FAILED'}: ${cut(e.result.text.replace(/\s+/g, ' '), n)}`;
}

// Bewertet einen Skill nur anhand gemessener Läufe seiner aktuellen Version.
export function judge(skill) {
  const ev = skill.evidence.filter((e) => e.version === skill.version);
  const declared = ev.filter((e) => e.declared);
  const used = declared.length ? declared : ev; // erklärt der Agent die Nutzung nie, zählen alle Läufe mit dem Skill im Kontext
  if (!used.length) return 'candidate';
  const wins = used.filter((e) => e.success);
  const rate = wins.length / used.length;
  if (used.length >= 2 && rate <= 0.34) return 'rejected';
  if (wins.length >= 2 && rate >= 0.66) {
    const base = skill.baselineSteps;
    if (base == null || avg(wins.map((e) => e.steps)) <= base) return 'validated';
  }
  return 'testing';
}

const STATUS_TEXT = {
  validated: 'VALIDATED by results',
  testing: 'UNDER TEST, not yet proven',
  candidate: 'UNTESTED idea',
};

// Baut den Gedächtnis-Block für den Prompt und meldet, was genau verwendet wurde.
export function buildContext(bank, condition, mission) {
  const used = { episodes: [], skills: [], lessons: [] };
  if (condition === 'none' || !bank) return { text: '', used };
  const parts = [];

  if (usesSkills(condition)) {
    const rank = { validated: 0, testing: 1, candidate: 2 };
    const skills = bank.skills.filter((s) => s.mission === mission && s.status !== 'rejected')
      .sort((a, b) => rank[a.status] - rank[b.status] || b.version - a.version).slice(0, 3);
    for (const s of skills) {
      const ev = s.evidence.filter((e) => e.version === s.version);
      const record = ev.length ? `${ev.filter((e) => e.success).length} of ${ev.length} missions succeeded with it` : 'never tried yet';
      parts.push([
        `SKILL ${s.id} "${s.name}" (v${s.version}) - ${STATUS_TEXT[s.status]}; ${record}.`,
        `Goal: ${s.task}`,
        s.preconditions.length ? `Applies when: ${s.preconditions.join('; ')}` : null,
        'Strategy:',
        ...s.strategy.map((step, i) => `  ${i + 1}. ${step}`),
      ].filter(Boolean).join('\n'));
      used.skills.push(s.id);
    }
    if (skills.length) parts.push('If you decide to follow a skill, call use_skill with its id first (this costs no action).');
  }

  if (usesLessons(condition)) {
    const lessons = bank.lessons.filter((l) => l.mission === mission).slice(-5);
    if (lessons.length) {
      parts.push('LESSONS from earlier missions:\n' + lessons.map((l) => `- ${l.text}`).join('\n'));
      used.lessons.push(...lessons.map((l) => l.id));
    }
  }

  if (usesEpisodes(condition)) {
    const eps = bank.episodes.filter((e) => e.mission === mission);
    const wins = eps.filter((e) => e.success).slice(condition === 'full' ? -1 : -2);
    const fails = condition === 'full' ? [] : eps.filter((e) => !e.success).slice(-1);
    for (const e of [...fails, ...wins]) {
      parts.push([
        `EARLIER ATTEMPT - ${e.success ? `SUCCESS in ${e.steps} actions` : `FAILED after ${e.steps} actions (${e.reason})`}:`,
        ...e.trace.slice(0, 24).map((line, i) => `  ${i + 1}. ${line}`),
      ].join('\n'));
      used.episodes.push(e.id);
    }
  }

  if (!parts.length) return { text: '', used };
  const head = 'MEMORY FROM EARLIER MISSIONS. It can be incomplete, wrong, or describe a different station layout or fault. '
    + 'Always trust what you observe now over memory.';
  return { text: `${head}\n\n${parts.join('\n\n')}`, used };
}

// Auswertung nach einer Mission: Das Modell schlägt eine Lektion und ggf. einen Skill vor.
export async function reflect({ llm, run, bank, signal }) {
  const mine = bank.skills.filter((s) => run.memoryUsed.skills.includes(s.id));
  const prompt = [
    `You controlled a robot on the mission "${run.objective}".`,
    `Outcome: ${run.success ? `SUCCESS in ${run.steps} actions` : `FAILED after ${run.steps} actions (${run.reason})`}.`,
    'What you did:',
    ...run.events.filter((e) => e.type === 'step').slice(0, 36).map((e, i) => `${i + 1}. ${traceLine(e, 150)}`),
    mine.length ? `\nSkills you had available: ${mine.map((s) => `${s.id} "${s.name}"`).join(', ')}` : '',
    '',
    'Extract what is worth remembering for FUTURE missions on similar stations, where the fault and the layout may differ.',
    'Reply with ONLY a JSON object:',
    '{"lesson": "one transferable insight, max 30 words",',
    ' "skill": {"name": "short name", "task": "the goal this skill serves", "preconditions": ["observable condition"], "strategy": ["step 1", "step 2"]} or null,',
    ' "revise_skill_id": "id of an available skill this replaces, or null"}',
    'A skill must be a general decision procedure (what to check first, how to decide, what to avoid), at most 7 steps. '
    + 'Do not just replay this exact mission. Use null for "skill" if you learned no reusable procedure.',
  ].join('\n');
  const res = await llm({ messages: [{ role: 'user', content: prompt }], maxTokens: 600, signal });
  const json = extractJson(res.message?.content ?? '') ?? {};
  const strings = (xs, n) => (Array.isArray(xs) ? xs.filter((x) => typeof x === 'string' && x.trim()).map((x) => cut(x.trim(), 200)).slice(0, n) : []);
  const sk = json.skill && typeof json.skill === 'object' ? json.skill : null;
  const strategy = strings(sk?.strategy, 7);
  return {
    call: res,
    raw: cut(res.message?.content ?? '', 1500),
    lesson: typeof json.lesson === 'string' && json.lesson.trim() ? cut(json.lesson.trim(), 240) : null,
    skill: sk && strategy.length ? {
      name: cut(String(sk.name ?? 'Unnamed skill'), 60),
      task: cut(String(sk.task ?? run.objective), 160),
      preconditions: strings(sk.preconditions, 4),
      strategy,
    } : null,
    reviseId: typeof json.revise_skill_id === 'string' ? json.revise_skill_id : null,
  };
}

// Trägt Messwerte eines Laufs als Beleg bei allen Skills ein, die im Kontext standen.
export function addEvidence(bank, run, baselineSteps) {
  const changes = [];
  for (const s of bank.skills) {
    if (!run.memoryUsed.skills.includes(s.id)) continue;
    s.evidence.push({
      runId: run.id, version: s.version, declared: run.skillsDeclared.includes(s.id),
      success: run.success, steps: run.steps, variant: run.variant, seed: run.seed,
    });
    if (baselineSteps != null) s.baselineSteps = baselineSteps;
    const before = s.status;
    s.status = judge(s);
    if (before !== s.status) changes.push({ skill: s.id, from: before, to: s.status });
  }
  return changes;
}

// Lernschritt nach einem Lauf: Episode ablegen, Belege eintragen, Vorschläge einsortieren.
export function learn(bank, run, reflection, baselineSteps) {
  const out = { statusChanges: addEvidence(bank, run, baselineSteps), newSkill: null, revised: null, lesson: null };
  bank.episodes.push({
    id: run.id, mission: run.mission, variant: run.variant, seed: run.seed, at: run.endedAt,
    success: run.success, reason: run.reason, steps: run.steps,
    trace: run.events.filter((e) => e.type === 'step').map((e) => traceLine(e)),
  });
  if (reflection?.lesson) {
    const lesson = { id: `L${bank.lessons.length + 1}`, mission: run.mission, text: reflection.lesson, fromRun: run.id, fromSuccess: run.success };
    bank.lessons.push(lesson);
    out.lesson = lesson;
  }
  const sk = reflection?.skill;
  if (sk) {
    const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
    const old = bank.skills.find((s) => s.id === reflection.reviseId && s.mission === run.mission)
      ?? bank.skills.find((s) => s.mission === run.mission && norm(s.name) === norm(sk.name));
    const same = old && JSON.stringify(old.strategy.map(norm)) === JSON.stringify(sk.strategy.map(norm));
    const proven = old && run.success && run.memoryUsed.skills.includes(old.id);
    if (old && (same || proven)) {
      // Ein Skill, mit dem die Mission gerade gelang, wird nicht umgeschrieben: sonst verlöre er
      // bei jeder Reflexion seine Belege und könnte sich nie bewähren.
      out.keptSkill = old.id;
    } else if (old) {
      // Neue Version: Die alte bleibt samt Belegen in der Historie nachvollziehbar.
      old.history.push({ version: old.version, name: old.name, task: old.task, preconditions: old.preconditions, strategy: old.strategy, status: old.status, replacedAfter: run.id });
      Object.assign(old, sk, { version: old.version + 1, status: 'candidate', updatedFrom: run.id });
      out.revised = old;
    } else {
      const skill = { id: `S${bank.nextSkill++}`, mission: run.mission, ...sk, version: 1, status: 'candidate', createdFrom: run.id, evidence: [], history: [], baselineSteps: baselineSteps ?? null };
      bank.skills.push(skill);
      out.newSkill = skill;
    }
  }
  return out;
}

export const needsReflection = (condition) => usesSkills(condition);
