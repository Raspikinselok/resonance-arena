// Anbindung an lokale Modellserver mit OpenAI-kompatibler API (LM Studio, Ollama, ...).
// Die Modellkennung wird vom Server abgefragt, nie geraten.

export const PRESETS = [
  { provider: 'LM Studio', baseUrl: 'http://localhost:1234/v1' },
  { provider: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
];

const clean = (url) => String(url).trim().replace(/\/+$/, '');

async function getJson(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Fragt einen Endpunkt ab: erreichbar? Welche Sprachmodelle gibt es?
export async function probe(baseUrl, timeoutMs = 2500) {
  const base = clean(baseUrl);
  const provider = PRESETS.find((p) => p.baseUrl === base)?.provider ?? 'OpenAI-kompatibel';
  try {
    let models;
    try {
      // LM Studio kennt zusätzlich Typ, Ladezustand und Quantisierung
      const native = await getJson(base.replace(/\/v1$/, '') + '/api/v0/models', timeoutMs);
      models = native.data.map((m) => ({
        id: m.id, type: m.type, loaded: m.state === 'loaded', quantization: m.quantization, arch: m.arch,
      }));
    } catch {
      const list = await getJson(base + '/models', timeoutMs);
      models = list.data.map((m) => ({ id: m.id }));
    }
    models = models.filter((m) => m.type !== 'embeddings' && !/embed/i.test(m.id));
    return { ok: true, baseUrl: base, provider, models };
  } catch (err) {
    return { ok: false, baseUrl: base, provider, error: String(err.message ?? err), models: [] };
  }
}

// Probiert die bekannten lokalen Server der Reihe nach durch.
export async function autodetect(extra) {
  const results = [];
  for (const url of [extra, ...PRESETS.map((p) => p.baseUrl)].filter(Boolean)) {
    const r = await probe(url);
    results.push(r);
    if (r.ok && r.models.length) return { ...r, tried: results };
  }
  return { ok: false, models: [], tried: results, error: 'Kein lokaler Modellserver erreichbar.' };
}

// Ein echter Inferenzaufruf. Liefert Antwort plus Messwerte.
// `reasoning: 'none'` schaltet bei Denk-Modellen (z. B. Gemma 4) die Denkphase ab: gemessen ~6x schneller.
export async function chat({ baseUrl, model, messages, tools, maxTokens = 350, temperature = 0, seed, reasoning, signal }) {
  const body = { model, messages, temperature, max_tokens: maxTokens, stream: false };
  if (seed != null) body.seed = seed;
  if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }
  if (reasoning) body.reasoning_effort = reasoning;
  const post = () => fetch(clean(baseUrl) + '/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  let t0 = performance.now();
  let res = await post();
  if (res.status === 400 && body.reasoning_effort) {
    // Server kennt den Parameter nicht: ohne ihn wiederholen
    delete body.reasoning_effort;
    t0 = performance.now();
    res = await post();
  }
  const latencyMs = Math.round(performance.now() - t0);
  if (!res.ok) {
    const err = new Error(`Modellserver antwortet mit HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const usage = json.usage ?? {};
  return {
    message: json.choices?.[0]?.message ?? {},
    finishReason: json.choices?.[0]?.finish_reason,
    modelReported: json.model ?? model,
    latencyMs,
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? null,
    stats: json.stats ?? json.timings ?? null, // serverseitige Messwerte, falls vorhanden
  };
}

// Holt das erste JSON-Objekt aus einem Text (Modelle verpacken es gern in Prosa oder ```json).
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const src = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  for (let start = src.indexOf('{'); start !== -1; start = src.indexOf('{', start + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < src.length; i++) {
      const c = src[i];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try { return JSON.parse(src.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}
