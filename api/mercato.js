// Offerte e indici PUN/PSV da Supabase (tabella mercato, riga id=1). Variabili: SUPABASE_URL, SUPABASE_ANON_KEY (chiave publishable sb_publishable_… o anon).
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(404).json({});
  const r = await fetch(`${url}/rest/v1/mercato?id=eq.1&select=dati`, { headers: key.startsWith("eyJ") ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key } });
  const rows = r.ok ? await r.json() : [];
  if (!rows.length) return res.status(404).json({});
  res.setHeader("cache-control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json(rows[0].dati);
}
