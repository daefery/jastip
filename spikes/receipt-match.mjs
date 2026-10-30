// Spike 2: can a vision model match the lines of one shop receipt to friends' requests?
//
// For each case in receipts/cases/*.json (an image + the open requests + the expected answer),
// the model reads the receipt and returns, per request: the receipt line it matched (or none),
// the price on that line, and the quantity. Code (not the model) then checks the result:
//   - matched line price must appear on the receipt the model transcribed
//   - share for each request = line price + that request's part of the tax, split by amount
// Score = requests where matched/not-matched AND price equal the expected answer.
//
// Run: node spikes/receipt-match.mjs [--model gemini-3-flash] [--only <case-name>]

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
for (const p of [join(root, ".env")]) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const BASE = process.env.AI_BASE_URL || "http://127.0.0.1:8317/v1";
const KEY = process.env.AI_API_KEY || JSON.parse(readFileSync(`${process.env.HOME}/.pi/agent/cliproxyapi.json`, "utf8")).apiKey;
const MODEL = arg("--model", process.env.AI_MODEL || "gemini-3-flash");
const ONLY = arg("--only", null);

const casesDir = join(root, "receipts/cases");
const cases = readdirSync(casesDir).filter((f) => f.endsWith(".json")).filter((f) => !ONLY || f.startsWith(ONLY));

const SYSTEM = `You read shop receipts for a "jastip" app: a traveller buys items for several friends and pays with one receipt.
Return JSON only, no prose, with this shape:
{
  "currency": "ISO code",
  "lines": [{"n": 1, "text": "exact text of the receipt line", "qty": 1, "price": 1234}],
  "tax": {"included": true|false, "amount": 0},
  "total": 0,
  "tax_free": true|false,
  "matches": [{"request_id": "r1", "line_n": 3 | null, "confidence": 0.0-1.0, "why": "short reason"}]
}
Rules:
- "lines" lists every line between the shop header and the subtotal, in order, exactly as printed. A discount line (値引, DISC, POTONGAN, 割引 ...) is its own line with a negative price. Do not apply discounts yourself.
- Match requests to item lines only, never to a discount line.
- Each request matches at most one line, and each line at most one request. If nothing on the receipt is that item, line_n is null.
- Receipts abbreviate names and may be in Japanese or Indonesian. Match by meaning (brand, product, size), not exact words.
- Do not invent lines. If the image is unreadable, return "lines": [] and all line_n null.`;

async function ask(imagePath, requests) {
  const b64 = readFileSync(imagePath).toString("base64");
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(imagePath).toLowerCase()];
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      ...(process.env.AI_NO_THINK ? { chat_template_kwargs: { enable_thinking: false }, response_format: { type: "json_object" }, max_completion_tokens: 2000 } : {}),
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [
          { type: "text", text: "Open requests:\n" + JSON.stringify(requests, null, 1) },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ] },
      ],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  const text = body.choices[0].message.content;
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

// Deterministic part 1: a negative line belongs to the item line directly above it.
function foldDiscounts(read) {
  const items = [];
  for (const l of read.lines) {
    if (l.price < 0 && items.length) {
      const prev = items[items.length - 1];
      prev.price += l.price;
      prev.discounts = [...(prev.discounts || []), l.text];
    } else items.push({ ...l });
  }
  read.rawLines = read.lines;
  read.lines = items;
  return read;
}

// Deterministic part 2: shares. Tax that is printed separately is split by line amount.
function shares(read) {
  const byLine = new Map(read.lines.map((l) => [l.n, l]));
  const matched = read.matches.filter((m) => m.line_n != null && byLine.has(m.line_n));
  const sub = matched.reduce((s, m) => s + byLine.get(m.line_n).price, 0);
  const allSub = read.lines.reduce((s, l) => s + l.price, 0);
  const taxExtra = read.tax && !read.tax.included ? read.tax.amount || 0 : 0;
  const out = {};
  for (const m of read.matches) {
    if (m.line_n == null || !byLine.has(m.line_n)) { out[m.request_id] = null; continue; }
    const p = byLine.get(m.line_n).price;
    out[m.request_id] = Math.round(p + (allSub ? (taxExtra * p) / allSub : 0));
  }
  return { out, sub, allSub, taxExtra };
}

const results = [];
let right = 0, total = 0;
for (const f of cases) {
  const c = JSON.parse(readFileSync(join(casesDir, f), "utf8"));
  const img = join(casesDir, c.image);
  process.stdout.write(`${f.padEnd(28)} `);
  let read, err;
  const t0 = Date.now();
  try { read = foldDiscounts(await ask(img, c.requests)); } catch (e) { err = String(e); }
  const ms = Date.now() - t0;
  if (err) { console.log("ERROR", err); results.push({ case: f, err }); total += c.requests.length; continue; }
  const s = shares(read);
  const rows = c.requests.map((r) => {
    const exp = c.expected[r.id];
    const m = read.matches.find((x) => x.request_id === r.id);
    const line = m?.line_n != null ? read.lines.find((l) => l.n === m.line_n) : null;
    const got = line ? line.price : null;
    const ok = exp === null ? got === null : got === exp;
    return { id: r.id, want: r.text, expected: exp, got, line: line?.text ?? null, share: s.out[r.id] ?? null, ok, why: m?.why };
  });
  const n = rows.filter((x) => x.ok).length;
  right += n; total += rows.length;
  console.log(`${n}/${rows.length}  (${(ms / 1000).toFixed(1)}s)${rows.filter((x) => !x.ok).map((x) => `  MISS ${x.id}: want ${x.expected} got ${x.got} [${x.line}]`).join("")}`);
  results.push({ case: f, model: MODEL, ms, rows, read });
}
console.log(`\nTotal: ${right}/${total} requests correct with ${MODEL}`);
const out = join(root, `spikes/receipt-results-${MODEL.replace(/[^\w.-]/g, "_")}.json`);
writeFileSync(out, JSON.stringify({ model: MODEL, right, total, results }, null, 2));
console.log(`Details: ${out}`);
