// Lokale Ablage: jeder Lauf eine JSON-Datei, jede Memory-Bank eine JSON-Datei.
// Alles liegt unter data/ (nicht im Repo) und lässt sich als Ganzes exportieren.

import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function createStore(dir = process.env.ARENA_DATA ?? resolve('data')) {
  const runsDir = join(dir, 'runs');
  const memDir = join(dir, 'memory');
  mkdirSync(runsDir, { recursive: true });
  mkdirSync(memDir, { recursive: true });
  const safe = (name) => String(name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'default';
  const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
  const write = (file, data) => writeFileSync(file, JSON.stringify(data, null, 1));

  const allRuns = () => readdirSync(runsDir).filter((f) => f.endsWith('.json')).map((f) => read(join(runsDir, f)))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  return {
    dir,
    saveRun: (run) => write(join(runsDir, `${run.id}.json`), run),
    getRun: (id) => (existsSync(join(runsDir, `${safe(id)}.json`)) ? read(join(runsDir, `${safe(id)}.json`)) : null),
    // Übersicht ohne die schweren Ereignisprotokolle
    listRuns: () => allRuns().map(({ events, ...summary }) => summary),
    allRuns,
    loadBank(name) {
      const file = join(memDir, `${safe(name)}.json`);
      if (existsSync(file)) return read(file);
      return { name: safe(name), createdAt: new Date().toISOString(), episodes: [], skills: [], lessons: [], nextSkill: 1 };
    },
    saveBank: (bank) => write(join(memDir, `${safe(bank.name)}.json`), bank),
    resetBank: (name) => rmSync(join(memDir, `${safe(name)}.json`), { force: true }),
    listBanks: () => readdirSync(memDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
    exportAll() {
      return {
        exportedAt: new Date().toISOString(),
        runs: allRuns(),
        memory: readdirSync(memDir).filter((f) => f.endsWith('.json')).map((f) => read(join(memDir, f))),
      };
    },
  };
}
