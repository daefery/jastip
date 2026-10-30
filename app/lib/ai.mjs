// Vision + text AI. Two providers, same OpenAI-style chat format:
//  - Cloudflare Workers AI (default when deployed): env.AI binding, model @cf/google/gemma-4-26b-a4b-it,
//    thinking off and JSON output on (about 10 s per receipt, 19-20/20 on the synthetic set, 30 Oct 2026).
//  - Any OpenAI-compatible endpoint (local dev): AI_BASE_URL + AI_API_KEY + AI_MODEL.
// The model only reads (receipt lines, which line answers which request, what a link is).
// Code does every money step: discounts fold into the item above, shares, caps, captures.
import { env } from "./env.mjs";

const CF_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const model = () => env("AI_MODEL") || CF_MODEL;
const binding = () => globalThis.__JASTIP_AI__; // set by the Worker entry
export const aiReady = () => Boolean(binding() || env("AI_API_KEY"));
export const aiName = () => (binding() && !env("AI_API_KEY") ? CF_MODEL : model());

async function once(messages) {
  const isCf = binding() && !env("AI_API_KEY");
  const m = isCf ? CF_MODEL : model();
  const gemmaOpts = m.startsWith("@cf/") ? { chat_template_kwargs: { enable_thinking: false }, response_format: { type: "json_object" }, max_completion_tokens: 2500 } : {};
  let text;
  if (isCf) {
    const out = await binding().run(m, { messages, temperature: 0, ...gemmaOpts });
    text = out?.choices?.[0]?.message?.content ?? out?.response ?? "";
    if (typeof text !== "string") text = JSON.stringify(text);
  } else {
    const res = await fetch(`${env("AI_BASE_URL") || "http://127.0.0.1:8317/v1"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("AI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: m, temperature: 0, messages, ...gemmaOpts }),
      signal: AbortSignal.timeout(60000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`AI ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
    text = body.choices?.[0]?.message?.content || "";
  }
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return { data: JSON.parse(json), model: m };
}

// One retry: Workers AI returns an occasional 500, and a model can emit one bad JSON.
async function chat(messages) {
  try { return await once(messages); }
  catch (e) { await new Promise((r) => setTimeout(r, 400)); return await once(messages); }
}

const RECEIPT_SYSTEM = `You read one shop receipt for a jastip app: a traveller bought items for friends and paid with one receipt.
Return JSON only:
{"shop":"...","currency":"ISO code","lines":[{"n":1,"text":"exact text","price":1234}],"total":0,
 "matches":[{"request_id":"...","line_n":3,"confidence":0.9}]}
Rules:
- "lines": every line between the shop header and the subtotal, in order, as printed. Prices are in the receipt currency's normal units (yen as whole numbers, dollars with decimals).
- A discount line (値引, 割引, DISC, POTONGAN, -10% ...) is its own line with a negative price. Do not apply discounts yourself.
- Match each request to at most one item line by meaning (brand, product, size), never to a discount line. If the item is not on the receipt, line_n is null.
- A similar but different product is not a match (a strainer is not a container; brush cleaner is not a brush set).
- Do not invent lines. If unreadable, return empty lines and null matches.`;

export async function readReceipt(imageDataUrl, requests) {
  const { data, model: m } = await chat([
    { role: "system", content: RECEIPT_SYSTEM },
    { role: "user", content: [
      { type: "text", text: "Open requests:\n" + JSON.stringify(requests.map((r) => ({ request_id: r.id, item: r.swap_title || r.title, detail: r.detail })), null, 1) },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ] },
  ]);
  return { ...data, model: m };
}

// Code, not the model: negative lines belong to the item line above.
export function foldDiscounts(lines) {
  const out = [];
  for (const l of lines || []) {
    if (l.price < 0 && out.length) { out[out.length - 1].price += l.price; out[out.length - 1].disc = true; }
    else out.push({ ...l });
  }
  return out;
}

const LINK_SYSTEM = `A friend wants something bought abroad. From their message (a link, a product name, or slang), return JSON only:
{"title":"short product name, max 40 chars","detail":"size or variant, max 40 chars","typical":0,"art":"one of: snack, beauty, medicine, drink, fashion, gadget, toy, other"}
"typical" is the usual shelf price in the trip currency's normal units, or 0 if unknown. Do not invent a brand that is not implied.`;

export async function readRequest(text, currency, city) {
  const { data } = await chat([
    { role: "system", content: LINK_SYSTEM },
    { role: "user", content: `Trip: ${city}, currency ${currency}.\nMessage: ${text}` },
  ]);
  return data;
}
