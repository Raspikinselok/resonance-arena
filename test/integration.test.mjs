// Integrationstest über die echte HTTP-Schnittstelle der Arena, gegen einen Attrappen-Modellserver.
// Prüft den ganzen Weg: verbinden -> Mission -> Beobachtung -> Entscheidung -> Aktion -> Ergebnis
// -> Erinnerung speichern -> neue Mission mit Erinnerung -> Vergleich ohne Erinnerung.
// Die Attrappe ersetzt nur das Sprachmodell; der echte Modelltest ist `npm run test:live`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';

// Kleine regelbasierte "Modell"-Attrappe: liest den Prompt wie ein Modell und antwortet OpenAI-kompatibel.
function decide(system, user) {
  if (user.includes('"lesson"')) {
    return { content: 'Here you go: {"lesson":"Read the diagnostics terminal before touching the reactor.","skill":{"name":"Diagnose then fix","task":"Restart a reactor","preconditions":["reactor offline"],"strategy":["Inspect the terminal","Fix every reported inhibit","Start the reactor"]},"revise_skill_id":null}' };
  }
  const did = (s) => user.includes(s);
  const loc = user.match(/LOCATION: (\w+)/)[1];
  const call = (name, args) => ({ tool: name, args: { ...args, why: 'mock policy' } });
  if (system.includes('SKILL S1') && !did('SKILL IN USE')) return call('use_skill', { skill_id: 'S1' });
  const goTo = (room) => call('go', { room: loc === 'atrium' ? room : 'atrium' });
  if (!did('inspect(target=terminal)')) return loc === 'control' ? call('inspect', { target: 'terminal' }) : goTo('control');
  if (did('E-63') && !did('Recalibration complete')) return call('operate', { device: 'calibration_console', command: 'recalibrate' });
  if (loc !== 'reactor') return goTo('reactor');
  if (did('E-17') && !did('Coolant valve is now OPEN')) return call('operate', { device: 'coolant_valve', command: 'open' });
  return call('operate', { device: 'reactor_panel', command: 'start' });
}

let mock, arena, dataDir, api, mockUrl;

before(async () => {
  mock = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.endsWith('/models')) return res.end(JSON.stringify({ data: [{ id: 'mock-model' }, { id: 'mock-json' }, { id: 'text-embedding-mock' }] }));
    if (req.url.includes('/api/v0/')) { res.statusCode = 404; return res.end('{}'); }
    let raw = ''; for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    const system = body.messages.find((x) => x.role === 'system')?.content ?? '';
    const user = body.messages.findLast((x) => x.role === 'user').content;
    const d = decide(system, user);
    const message = d.content ? { role: 'assistant', content: d.content }
      : body.model === 'mock-json' ? { role: 'assistant', content: JSON.stringify({ tool: d.tool, args: d.args }) }
      : { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: d.tool, arguments: JSON.stringify(d.args) } }] };
    res.end(JSON.stringify({ model: body.model, choices: [{ message, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20 } }));
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  mockUrl = `http://127.0.0.1:${mock.address().port}/v1`;
  dataDir = mkdtempSync(join(tmpdir(), 'arena-test-'));
  arena = await startServer({ port: 0, dataDir });
  api = async (path, payload) => {
    const res = await fetch(`http://127.0.0.1:${arena.port}${path}`, payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : undefined);
    return res.json();
  };
});

after(async () => { await arena.close(); await new Promise((r) => mock.close(r)); rmSync(dataDir, { recursive: true, force: true }); });

async function runAndWait(path, cfg) {
  const started = await api(path, { baseUrl: mockUrl, model: 'mock-model', ...cfg });
  assert.ok(started.started, JSON.stringify(started));
  for (let i = 0; i < 400; i++) {
    if (!(await api('/api/meta')).busy) return (await api('/api/runs'));
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error('Lauf endet nicht');
}

test('Verbinden ermittelt die Modellkennungen und blendet Embedding-Modelle aus', async () => {
  const c = await api('/api/connect', { baseUrl: mockUrl });
  assert.ok(c.ok);
  assert.deepEqual(c.models.map((x) => x.id), ['mock-model', 'mock-json']);
  const down = await api('/api/connect', { baseUrl: 'http://127.0.0.1:9/v1' });
  assert.equal(down.ok, false);
});

test('kompletter Weg mit Skill-Memory: lernen, wiederverwenden, bewähren', async () => {
  // 1. Lauf: kein Wissen vorhanden. Danach schlägt die Reflexion einen Skill vor.
  let runs = await runAndWait('/api/runs', { condition: 'skills', bank: 'it', seed: 5, fault: 'coolant' });
  const first = runs.at(-1);
  assert.ok(first.success, first.reason);
  assert.equal(first.modelReported, 'mock-model');
  assert.ok(first.llmCalls >= first.steps && first.completionTokens > 0);
  assert.deepEqual(first.memoryUsed.skills, []);
  let bank = await api('/api/memory?bank=it');
  assert.equal(bank.skills.length, 1);
  assert.equal(bank.skills[0].status, 'candidate', 'vom Modell behauptet, noch nicht bestätigt');
  assert.equal(bank.episodes.length, 1);

  // 2. Lauf, andere Ursache: Der Skill steht im Kontext und wird erklärt.
  runs = await runAndWait('/api/runs', { condition: 'skills', bank: 'it', seed: 6, fault: 'sensor' });
  const second = runs.at(-1);
  assert.ok(second.success);
  assert.deepEqual(second.memoryUsed.skills, ['S1']);
  assert.deepEqual(second.skillsDeclared, ['S1']);
  bank = await api('/api/memory?bank=it');
  assert.equal(bank.skills[0].status, 'testing', 'ein gemessener Erfolg reicht noch nicht');
  assert.equal(bank.skills[0].version, 1, 'ein erfolgreicher Skill wird nicht umgeschrieben');

  // 3. Lauf: zweiter gemessener Erfolg -> bewährt.
  runs = await runAndWait('/api/runs', { condition: 'skills', bank: 'it', seed: 7, fault: 'coolant' });
  bank = await api('/api/memory?bank=it');
  assert.equal(bank.skills[0].status, 'validated');
  assert.equal(bank.skills[0].evidence.length, 2);
  const full = await api(`/api/runs/${runs.at(-1).id}`);
  assert.ok(full.events.some((e) => e.type === 'step') && full.events.some((e) => e.type === 'skill_declared'));
  assert.deepEqual(full.learned.statusChanges, [{ skill: 'S1', from: 'testing', to: 'validated' }]);
});

test('ohne Memory: nichts wird gelesen oder geschrieben', async () => {
  const before = await api('/api/memory?bank=it');
  const runs = await runAndWait('/api/runs', { condition: 'none', bank: 'it', seed: 5, fault: 'coolant' });
  const run = runs.at(-1);
  assert.ok(run.success);
  assert.deepEqual(run.memoryUsed, { episodes: [], skills: [], lessons: [] });
  assert.deepEqual(await api('/api/memory?bank=it'), before);
});

test('episodisches Memory ruft frühere Abläufe ab', async () => {
  await runAndWait('/api/runs', { condition: 'episodic', bank: 'epi', seed: 5, fault: 'coolant' });
  const runs = await runAndWait('/api/runs', { condition: 'episodic', bank: 'epi', seed: 8, fault: 'sensor' });
  assert.equal(runs.at(-1).memoryUsed.episodes.length, 1);
  const full = await api(`/api/runs/${runs.at(-1).id}`);
  assert.match(full.events[0].memoryText, /EARLIER ATTEMPT - SUCCESS/);
});

test('Modell ohne Tool-Calls: automatischer Wechsel in den JSON-Modus', async () => {
  const runs = await runAndWait('/api/runs', { model: 'mock-json', condition: 'none', seed: 5, fault: 'coolant' });
  assert.equal(runs.at(-1).mode, 'json');
  assert.ok(runs.at(-1).success);
});

test('Protokoll: Baseline, Training, Prüfung mit eingefrorenem Memory', async () => {
  const count = (await api('/api/runs')).length;
  const runs = await runAndWait('/api/protocol', { condition: 'skills', bank: 'proto', trainSeeds: [11, 12], trainVariant: 'standard', tests: [{ variant: 'standard', seed: 21, fault: 'coolant' }] });
  const mine = runs.slice(count);
  assert.deepEqual(mine.map((r) => r.phase), ['baseline', 'train', 'train', 'eval']);
  assert.equal(mine[0].condition, 'none');
  assert.equal(mine[3].learn, false);
  assert.equal(new Set(mine.map((r) => r.protocolId)).size, 1);
  const bank = await api('/api/memory?bank=proto');
  assert.equal(bank.episodes.length, 2, 'nur die Trainingsläufe landen im Memory');
  assert.ok(bank.skills[0].evidence.some((e) => e.runId === mine[3].id), 'Prüflauf zählt nachträglich als Beleg');
});

test('Simulationsläufe sind gekennzeichnet und lernen nicht', async () => {
  const runs = await runAndWait('/api/runs', { simulated: true, pace: 0, condition: 'skills', bank: 'sim', seed: 3 });
  assert.equal(runs.at(-1).simulated, true);
  assert.equal(runs.at(-1).model, null);
  assert.equal((await api('/api/memory?bank=sim')).episodes.length, 0);
});

test('fehlende Dateien liefern 404 und beenden den Server nicht (Browser fragt z. B. /favicon.ico ab)', async () => {
  for (const path of ['/favicon.ico', '/gibt-es-nicht.js', '/vendor/three/nichts.js']) {
    const res = await fetch(`http://127.0.0.1:${arena.port}${path}`);
    assert.equal(res.status, 404, path);
  }
  const page = await fetch(`http://127.0.0.1:${arena.port}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /RESONANCE ARENA/);
});
