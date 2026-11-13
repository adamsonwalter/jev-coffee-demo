// POST /api/order  { transcript }  ->  typed order fields from Jev (SystemOne).
// The key lives only in Netlify env var TYPESAFE_API_KEY; the browser never sees it.

const URL_ = process.env.JEV_URL || "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.JEV_MODEL || "jev-latest";

const yn = (yes, no) => ({ type: "choice", criteria: { yes, no } });

const QUESTIONS = {
  drink: {
    type: "choice",
    criteria: {
      Latte: "Customer ordered a latte",
      Cappuccino: "Customer ordered a cappuccino",
      "Flat White": "Customer ordered a flat white",
      Espresso: "Customer ordered an espresso or short black",
      Americano: "Customer ordered an americano",
      Mocha: "Customer ordered a mocha",
      "Long Black": "Customer ordered a long black",
      None: "No drink named yet",
    },
  },
  size: {
    type: "choice",
    criteria: {
      Small: "Small size",
      Medium: "Medium or regular size",
      Large: "Large or big size",
      Unspecified: "No size mentioned",
    },
  },
  milk: {
    type: "choice",
    criteria: {
      Oat: "Oat milk",
      Almond: "Almond milk",
      Soy: "Soy milk",
      Skim: "Skim or low fat milk",
      "Full cream": "Full cream or regular dairy milk",
      None: "No milk, or a black coffee",
      Unspecified: "Milk not mentioned",
    },
  },
  extra_shot: yn("Customer asks for an extra, double or additional shot", "No extra shot requested"),
  croissant: yn("Customer asks for a croissant", "No croissant requested"),
  muffin: yn("Customer asks for a muffin", "No muffin requested"),
  syrup: yn("Customer asks for a syrup such as vanilla or caramel", "No syrup requested"),
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return json({ error: "no_key" }, 503);

  let transcript = "";
  try {
    ({ transcript } = await req.json());
  } catch {}
  transcript = String(transcript || "").trim().slice(0, 600);
  if (!transcript) return json({ error: "empty" }, 400);

  const t0 = Date.now();
  let r;
  try {
    r = await fetch(URL_, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        state: { transcript, context: "Customer speaking a coffee order at a cafe counter." },
        questions: QUESTIONS,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    return json({ error: "upstream_unreachable" }, 502);
  }
  if (!r.ok) return json({ error: "upstream", status: r.status }, 502);

  const data = await r.json();
  const a = data.answers || {};
  const pick = (k) => (a[k] ? { value: a[k].choice, confidence: a[k].confidence ?? null } : null);
  const flag = (k) => (a[k] && a[k].choice === "yes" ? { confidence: a[k].confidence ?? null } : null);

  return json({
    engine: "jev",
    model: data.model,
    ms: Date.now() - t0,
    drink: pick("drink"),
    size: pick("size"),
    milk: pick("milk"),
    extras: {
      extra_shot: flag("extra_shot"),
      croissant: flag("croissant"),
      muffin: flag("muffin"),
      syrup: flag("syrup"),
    },
  });
};

export const config = { path: "/api/order" };
