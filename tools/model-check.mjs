// Prüft lokale Modelle über eine OpenAI-kompatible API (z. B. LM Studio).
// Misst Antwortzeit und Tokens/s und testet, ob das Modell Tool-Calls liefert.
//
// Aufruf:  node tools/model-check.mjs <modell-id> [<modell-id> ...]
// Env:     LLM_BASE_URL (Standard: http://localhost:1234/v1)

const BASE = process.env.LLM_BASE_URL ?? "http://localhost:1234/v1";
const models = process.argv.slice(2);

const TOOLS = [{
  type: "function",
  function: {
    name: "move",
    description: "Move the robot one room in a direction.",
    parameters: {
      type: "object",
      properties: { direction: { type: "string", enum: ["north", "south", "east", "west"] } },
      required: ["direction"],
    },
  },
}];

async function chat(model, messages, extra = {}) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0, max_tokens: 200, ...extra }),
  });
  const seconds = (performance.now() - t0) / 1000;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { json: await res.json(), seconds };
}

async function check(model) {
  const row = { model };
  try {
    // Erster Aufruf lädt das Modell (JIT) und zählt deshalb nicht zur Geschwindigkeit.
    const load = await chat(model, [{ role: "user", content: "Say OK." }], { max_tokens: 5 });
    row.load_s = load.seconds.toFixed(1);

    const gen = await chat(model, [{ role: "user", content: "Describe an abandoned research station in about 120 words." }]);
    const out = gen.json.usage?.completion_tokens ?? 0;
    row.tokens = out;
    row.tok_per_s = (out / gen.seconds).toFixed(1);

    const tool = await chat(model, [
      { role: "system", content: "You control a robot. Use the provided tool to act." },
      { role: "user", content: "The exit is to the north. Go there." },
    ], { tools: TOOLS });
    const call = tool.json.choices?.[0]?.message?.tool_calls?.[0];
    row.tool_call = call ? `${call.function.name}(${call.function.arguments})` : "KEIN Tool-Call";
    row.tool_s = tool.seconds.toFixed(1);
  } catch (err) {
    row.error = String(err.message ?? err).slice(0, 200);
  }
  return row;
}

if (models.length === 0) {
  const list = await (await fetch(`${BASE}/models`)).json();
  console.log("Verfügbare Modelle:\n" + list.data.map((m) => "  " + m.id).join("\n"));
  console.log("\nAufruf: node tools/model-check.mjs <modell-id> [...]");
} else {
  const rows = [];
  for (const m of models) rows.push(await check(m)); // nacheinander, damit sich die Messungen nicht stören
  console.table(rows);
}
