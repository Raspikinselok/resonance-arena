// RESONANCE ARENA - lokaler Server: liefert die Oberfläche aus, steuert Versuche,
// streamt Ereignisse live (SSE). Lauscht nur auf localhost.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { createLab } from './experiments.mjs';
import { autodetect, probe, PRESETS } from './llm.mjs';
import { CONDITIONS } from './memory.mjs';
import { missions } from './agent.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// Minimaler .env-Leser (keine Abhängigkeit nötig)
function loadEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function startServer({ port = 0, dataDir, chatFn } = {}) {
  const store = createStore(dataDir);
  const clients = new Set();
  const emit = (event) => { const line = `data: ${JSON.stringify(event)}\n\n`; for (const res of clients) res.write(line); };
  const lab = createLab({ store, emit, ...(chatFn ? { chatFn } : {}) });

  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const body = async (req) => { let raw = ''; for await (const chunk of req) raw += chunk; return raw ? JSON.parse(raw) : {}; };

  async function serveStatic(res, base, rel) {
    const file = normalize(join(base, rel));
    if (!file.startsWith(base)) return json(res, 403, { error: 'forbidden' });
    try {
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(await readFile(file));
    } catch { json(res, 404, { error: 'not found' }); }
  }

  // Startet einen Versuch im Hintergrund; Fortschritt kommt über den Ereignisstrom.
  const launch = (res, job) => {
    if (lab.state.busy) return json(res, 409, { error: 'Es läuft bereits ein Versuch.' });
    job().catch((err) => emit({ type: 'note', level: 'error', text: String(err.message ?? err) }));
    json(res, 202, { started: true });
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    try {
      if (path === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify({ type: 'lab', busy: lab.state.busy, label: lab.state.label })}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (path === '/api/meta') {
        return json(res, 200, {
          conditions: CONDITIONS, presets: PRESETS, defaultBaseUrl: process.env.LLM_BASE_URL ?? null, defaultModel: process.env.LLM_MODEL ?? null,
          missions: Object.values(missions).map((m) => ({ id: m.id, title: m.title, objective: m.objective, variants: m.variants })),
          busy: lab.state.busy, banks: store.listBanks(),
        });
      }
      if (path === '/api/connect' && req.method === 'POST') {
        const { baseUrl } = await body(req);
        return json(res, 200, baseUrl ? await probe(baseUrl) : await autodetect(process.env.LLM_BASE_URL));
      }
      if (path === '/api/runs' && req.method === 'GET') return json(res, 200, store.listRuns());
      if (path === '/api/runs' && req.method === 'POST') { const cfg = await body(req); return launch(res, () => lab.startRun(cfg)); }
      if (path === '/api/protocol' && req.method === 'POST') { const cfg = await body(req); return launch(res, () => lab.startProtocol(cfg)); }
      if (path === '/api/stop' && req.method === 'POST') return json(res, 200, { stopping: lab.stop() });
      if (path.startsWith('/api/runs/')) {
        const run = store.getRun(path.slice('/api/runs/'.length));
        return run ? json(res, 200, run) : json(res, 404, { error: 'Lauf nicht gefunden.' });
      }
      if (path === '/api/memory' && req.method === 'GET') return json(res, 200, store.loadBank(url.searchParams.get('bank') ?? 'default'));
      if (path === '/api/memory/reset' && req.method === 'POST') { const { bank } = await body(req); store.resetBank(bank ?? 'default'); return json(res, 200, { reset: true }); }
      if (path === '/api/export') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="resonance-arena-export-${Date.now()}.json"` });
        return res.end(JSON.stringify(store.exportAll(), null, 1));
      }
      if (path.startsWith('/api/')) return json(res, 404, { error: 'Unbekannter Endpunkt.' });
      if (path.startsWith('/vendor/three/')) return serveStatic(res, join(ROOT, 'node_modules', 'three'), path.slice('/vendor/three/'.length));
      return serveStatic(res, join(ROOT, 'web'), path === '/' ? 'index.html' : path.slice(1));
    } catch (err) {
      json(res, 500, { error: String(err.message ?? err) });
    }
  });

  return new Promise((ready) => {
    server.listen(port, '127.0.0.1', () => ready({
      server, lab, store, port: server.address().port,
      close: () => { for (const c of clients) c.end(); return new Promise((done) => server.close(done)); },
    }));
  });
}

// Direkt gestartet: Server hochfahren
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnv();
  const { port } = await startServer({ port: Number(process.env.PORT ?? 4173) });
  console.log(`\n  RESONANCE ARENA läuft:  http://localhost:${port}\n  Beenden mit Strg+C.\n`);
}
