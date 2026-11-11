// Misst, wie sich Denk-Einstellungen des Servers auf Antwortzeit und Tokenzahl auswirken.
// Aufruf: node tools/think-probe.mjs <modell-id>
const BASE = process.env.LLM_BASE_URL ?? 'http://localhost:1234/v1';
const model = process.argv[2];
const tools = [{ type: 'function', function: { name: 'inspect', description: 'Examine a visible object.', parameters: { type: 'object', properties: { target: { type: 'string' }, why: { type: 'string' } }, required: ['target'] } } }];
const messages = [
  { role: 'system', content: 'You control a robot. Choose exactly one action per turn.' },
  { role: 'user', content: 'OBJECTIVE: Bring the reactor online.\nLOCATION: control\nVISIBLE: terminal [device], calibration_console [device: recalibrate]\nChoose your next action.' },
];
const variants = {
  standard: {},
  'reasoning_effort=none': { reasoning_effort: 'none' },
  'reasoning_effort=low': { reasoning_effort: 'low' },
  'reasoning.effort=none': { reasoning: { effort: 'none' } },
  'enable_thinking=false': { chat_template_kwargs: { enable_thinking: false } },
  'thinking.disabled': { thinking: { type: 'disabled' } },
};
const rows = [];
for (const [name, extra] of Object.entries(variants)) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, tools, temperature: 0, max_tokens: 400, ...extra }) });
    const j = await res.json();
    const m = j.choices?.[0]?.message ?? {};
    rows.push({ variante: name, http: res.status, s: ((performance.now() - t0) / 1000).toFixed(1), tokens: j.usage?.completion_tokens, reasoning_tokens: j.usage?.completion_tokens_details?.reasoning_tokens, denktext: (m.reasoning_content ?? m.reasoning ?? '').length, tool: m.tool_calls?.[0]?.function?.name ?? '-', fehler: (j.error?.message ?? '').slice(0, 60) });
  } catch (e) { rows.push({ variante: name, fehler: String(e.message).slice(0, 60) }); }
}
console.table(rows);
