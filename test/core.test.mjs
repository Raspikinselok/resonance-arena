// Kern-Tests: Welt, Lösbarkeit, Skill-Bewertung, Antwort-Parser. Brauchen kein Modell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../server/missions/coldstart.mjs';
import { judge, buildContext, learn } from '../server/memory.mjs';
import { parseAction, runEpisode } from '../server/agent.mjs';

const play = (world, plan) => plan.map((a) => m.apply(world, a));

test('gleicher Seed erzeugt dieselbe Welt, anderer Seed variiert', () => {
  assert.deepEqual(m.create({ seed: 42 }), m.create({ seed: 42 }));
  const faults = new Set(Array.from({ length: 30 }, (_, i) => m.create({ seed: i + 1 }).faults[0]));
  assert.equal(faults.size, 3, 'alle drei Fehlerursachen kommen vor');
});

test('jede Variante ist für jeden Seed lösbar und innerhalb des Budgets', () => {
  for (const variant of Object.keys(m.variants)) {
    for (let seed = 1; seed <= 40; seed++) {
      const w = m.create({ variant, seed });
      const plan = m.oracle(w);
      const results = play(w, plan);
      assert.ok(results.every((r) => r.ok), `${variant}/${seed}: ${results.find((r) => !r.ok)?.text}`);
      assert.ok(w.success && w.online, `${variant}/${seed} endet erfolgreich`);
      assert.ok(plan.length <= w.maxSteps / 2, `${variant}/${seed}: Musterlösung ${plan.length} Schritte`);
    }
  }
});

test('die Beobachtung verrät keine verborgenen Zustände', () => {
  const w = m.create({ seed: 3, fault: 'fuse' });
  const obs = JSON.stringify(m.observe(w));
  for (const secret of ['faults', 'rating', 'fuseOk', 'valveOpen', 'sensorOk']) assert.ok(!obs.includes(secret), secret);
  assert.ok(!obs.includes('fuse_10a'), 'Inhalt des Spinds ist vor dem Öffnen unsichtbar');
});

test('unbekannte Variante: der Start scheitert, wenn nur ein Fehler behoben wird', () => {
  const w = m.create({ variant: 'altered', seed: 7 });
  assert.equal(w.faults.length, 2);
  play(w, [{ tool: 'go', args: { room: 'reactor' } }]);
  const r = m.apply(w, { tool: 'operate', args: { device: 'reactor_panel', command: 'start' } });
  assert.equal(r.error, 'mistake');
  assert.equal(w.trips, 1);
});

test('drei Fehlstarts sperren den Reaktor, falsche Sicherung wird zerstört', () => {
  const w = m.create({ seed: 1, fault: 'fuse' });
  play(w, [{ tool: 'go', args: { room: 'storage' } }, { tool: 'inspect', args: { target: 'locker' } }]);
  const wrong = [10, 25, 40].find((a) => a !== w.rating);
  play(w, [{ tool: 'take', args: { item: `fuse_${wrong}a` } }, { tool: 'go', args: { room: 'atrium' } }, { tool: 'go', args: { room: 'reactor' } }]);
  assert.equal(m.apply(w, { tool: 'use', args: { item: `fuse_${wrong}a`, target: 'fuse_box' } }).error, 'mistake');
  assert.deepEqual(w.inventory, []);
  const start = { tool: 'operate', args: { device: 'reactor_panel', command: 'start' } };
  play(w, [start, start, start]);
  assert.ok(w.done && !w.success);
  assert.equal(w.reason, 'lockout');
});

test('ungültige Aktionen ändern die Welt nicht', () => {
  const w = m.create({ seed: 2 });
  const before = JSON.stringify(w);
  for (const a of [{ tool: 'go', args: { room: 'mars' } }, { tool: 'take', args: { item: 'fuse_10a' } }, { tool: 'fly', args: {} }, { tool: 'operate', args: {} }, null]) {
    assert.equal(m.apply(w, a).ok, false);
  }
  assert.equal(JSON.stringify(w), before);
});

test('Skill-Status folgt nur gemessenen Läufen', () => {
  const skill = { version: 1, evidence: [], baselineSteps: null };
  const ev = (success, steps = 10, declared = true) => ({ version: 1, success, steps, declared });
  assert.equal(judge(skill), 'candidate', 'eine Behauptung des Modells allein bestätigt nichts');
  skill.evidence.push(ev(true));
  assert.equal(judge(skill), 'testing');
  skill.evidence.push(ev(true));
  assert.equal(judge(skill), 'validated');
  assert.equal(judge({ ...skill, baselineSteps: 6 }), 'testing', 'langsamer als die Baseline ohne Memory: nicht bewährt');
  assert.equal(judge({ version: 1, evidence: [ev(false), ev(false)] }), 'rejected');
  assert.equal(judge({ version: 2, evidence: [ev(true), ev(true)] }), 'candidate', 'neue Version beginnt ohne Belege');
});

test('Lernen legt Episode, Lektion und Skill-Versionen nachvollziehbar ab', () => {
  const bank = { name: 't', episodes: [], skills: [], lessons: [], nextSkill: 1 };
  const run = (id, extra = {}) => ({ id, mission: 'coldstart', variant: 'standard', seed: 1, success: true, reason: 'reactor_online', steps: 9, events: [], memoryUsed: { skills: [], episodes: [], lessons: [] }, skillsDeclared: [], ...extra });
  const skill = { name: 'Diagnose first', task: 'restart', preconditions: [], strategy: ['read terminal'] };
  assert.equal(learn(bank, run('r1'), { lesson: 'Read the log.', skill }).newSkill.id, 'S1');
  assert.equal(buildContext(bank, 'none', 'coldstart').text, '');
  const ctx = buildContext(bank, 'skills', 'coldstart');
  assert.deepEqual(ctx.used.skills, ['S1']);
  assert.match(ctx.text, /UNTESTED idea/);
  const used = { memoryUsed: { skills: ['S1'], episodes: [], lessons: [] }, skillsDeclared: ['S1'] };
  const kept = learn(bank, run('r1b', used), { skill: { ...skill, strategy: ['something else'] } });
  assert.equal(kept.keptSkill, 'S1', 'ein Skill, mit dem es gerade gelang, wird nicht umgeschrieben');
  const out = learn(bank, run('r2', { ...used, success: false, reason: 'lockout' }), { skill: { ...skill, strategy: ['read terminal', 'fix all inhibits'] }, reviseId: 'S1' });
  assert.equal(out.revised.version, 2);
  assert.equal(bank.skills[0].history.length, 1);
  assert.equal(bank.skills[0].evidence.length, 2, 'Belege der alten Version bleiben erhalten');
  assert.equal(bank.episodes.length, 3);
  assert.match(buildContext(bank, 'full', 'coldstart').text, /LESSONS/);
});

test('Parser versteht Tool-Calls, JSON im Text und verwirft Unsinn', () => {
  const tc = parseAction({ tool_calls: [{ function: { name: 'go', arguments: '{"room":"control","why":"read logs"}' } }] });
  assert.deepEqual([tc.tool, tc.args, tc.why, tc.viaToolCall], ['go', { room: 'control' }, 'read logs', true]);
  const js = parseAction({ content: 'Sure!\n```json\n{"tool":"operate","args":{"device":"coolant_valve","command":"open"},"why":"flow is zero"}\n```' });
  assert.deepEqual([js.tool, js.args, js.why], ['operate', { device: 'coolant_valve', command: 'open' }, 'flow is zero']);
  assert.deepEqual(parseAction({ content: '{"tool":"take","item":"keycard"}' }).args, { item: 'keycard' });
  const txt = parseAction({ content: 'go(room=atrium,why:Go to the atrium to check for other options.)' });
  assert.deepEqual([txt.tool, txt.args, txt.why], ['go', { room: 'atrium' }, 'Go to the atrium to check for other options.']);
  assert.deepEqual(parseAction({ content: 'operate(device="coolant_valve", command: \'open\')' }).args, { device: 'coolant_valve', command: 'open' });
  const native = parseAction({ content: 'go{room:<|"|>reactor<|"|>,why:<|"|>I need to investigate, then decide.<|"|>}' });
  assert.deepEqual([native.tool, native.args, native.why], ['go', { room: 'reactor' }, 'I need to investigate, then decide.']);
  assert.equal(parseAction({ content: 'I think I should look around.' }), null);
});

test('Simulationsmodus ist gekennzeichnet und ruft kein Modell auf', async () => {
  const llm = () => { throw new Error('darf nicht aufgerufen werden'); };
  const run = await runEpisode({ cfg: { id: 'sim', mission: 'coldstart', variant: 'standard', seed: 4, condition: 'none', simulated: true }, llm });
  assert.equal(run.simulated, true);
  assert.equal(run.mode, 'simulation');
  assert.equal(run.model, null);
  assert.equal(run.llmCalls, 0);
  assert.ok(run.steps > 0 && run.events.at(-1).type === 'run_end');
});
