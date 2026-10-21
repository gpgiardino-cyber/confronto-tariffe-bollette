// Legge bollette e risponde all'assistente con la chiave API del sito.
// Variabili su Vercel: ANTHROPIC_API_KEY (obbligatoria), CLAUDE_MODEL, LIMITE_GIORNALIERO,
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o chiave secret sb_secret_… (per contare le richieste del giorno).
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const LIMITE = Number(process.env.LIMITE_GIORNALIERO || 200);
const MAX_IMG = 8, MAX_BODY = 4_000_000;

async function sottoLimite() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return true;
  const r = await fetch(`${url}/rest/v1/rpc/conta_richiesta`, {
    method: "POST",
    headers: key.startsWith("eyJ") ? { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" } : { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({ limite: LIMITE }),
  });
  if (!r.ok) return true; // se il contatore non risponde non blocchiamo il sito
  return (await r.json()) === true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ code: "sampling_disabled" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ code: "prompt_too_large" });
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return res.status(400).json({ code: "invalid_request" });
  if (!(await sottoLimite())) return res.status(429).json({ code: "rate_limited" });

  const images = (body.images || []).slice(0, MAX_IMG).filter(i => /^image\/(jpeg|png|webp|gif)$/.test(i.media_type));
  const messages = msgs.map((m, i) => {
    const content = [{ type: "text", text: String(m.content || "") }];
    if (i === msgs.length - 1) for (const im of images) content.unshift({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } });
    return { role: m.role === "assistant" ? "assistant" : "user", content };
  });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ code: r.status === 429 ? "rate_limited" : "error", message: j.error?.message });
  const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  res.status(200).json({ text, truncated: j.stop_reason === "max_tokens" });
}
