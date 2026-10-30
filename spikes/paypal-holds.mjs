// Spike 1: can PayPal sandbox do what PayPal Jastip needs?
//
// For each of three friends: create an order with intent AUTHORIZE (a hold up to the
// friend's price cap), the friend approves it in the browser, we authorize it, then:
//   friend A: item bought, capture the exact receipt share (less than the cap), final
//   friend B: item not found, void the hold
//   friend C: item bought, try a reauthorize (expected to fail inside the 3-day honor
//             period; we record the exact error), then capture
// Every step prints what PayPal returned. Results go to spikes/results-<time>.json.
//
// Run: node spikes/paypal-holds.mjs            (uses JPY, the currency of the demo trip)
//      node spikes/paypal-holds.mjs --currency USD
// Needs PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env (sandbox app credentials).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";

const BASE = "https://api-m.sandbox.paypal.com";

function loadEnv() {
  const path = new URL("../.env", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv();
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET. Copy .env.example to .env and fill in the sandbox app credentials.");
  process.exit(1);
}

const currency = (process.argv.includes("--currency") ? process.argv[process.argv.indexOf("--currency") + 1] : "JPY").toUpperCase();
const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"]);
const fmt = (n) => (ZERO_DECIMAL.has(currency) ? String(Math.round(n)) : n.toFixed(2));

// Friend caps and the receipt shares we will capture (JPY numbers; USD run divides by 100).
const scale = ZERO_DECIMAL.has(currency) ? 1 : 0.01;
const friends = [
  { name: "Ayu",   item: "Matcha KitKat big bag",  cap: 1500 * scale, share: 1188 * scale, plan: "capture" },
  { name: "Bima",  item: "Tokyo Banana 8 pack",    cap: 1800 * scale, share: null,         plan: "void" },
  { name: "Citra", item: "Hada Labo lotion",       cap: 1200 * scale, share: 968 * scale,  plan: "reauth-then-capture" },
];

const log = [];
let token;

async function getToken() {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token failed ${res.status}: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function pp(method, path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": randomUUID(),
      Prefer: "return=representation",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  const entry = { at: new Date().toISOString(), method, path, status: res.status, debug_id: res.headers.get("paypal-debug-id"), request: payload, response: body };
  log.push(entry);
  const short = body.status || body.name || "";
  console.log(`  ${method} ${path} -> ${res.status} ${short}${body.message ? " " + body.message : ""}`);
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  token = await getToken();
  console.log(`Sandbox token OK. Currency: ${currency}\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // 1. Create one AUTHORIZE order per friend.
  for (const f of friends) {
    console.log(`${f.name}: create hold up to ${fmt(f.cap)} ${currency} for "${f.item}"`);
    const r = await pp("POST", "/v2/checkout/orders", {
      intent: "AUTHORIZE",
      purchase_units: [{
        reference_id: `jastip-${f.name.toLowerCase()}`,
        description: `Jastip hold: ${f.item} (max ${fmt(f.cap)} ${currency})`,
        amount: { currency_code: currency, value: fmt(f.cap) },
      }],
      payment_source: { paypal: { experience_context: {
        user_action: "CONTINUE",
        return_url: "https://example.com/approved",
        cancel_url: "https://example.com/cancelled",
      } } },
    });
    if (!r.ok) { f.error = r.body; continue; }
    f.orderId = r.body.id;
    f.approveUrl = (r.body.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  }

  const open = friends.filter((f) => f.orderId);
  if (!open.length) { finish(); return; }
  console.log("\nApprove each hold in a browser, logged in as the sandbox PERSONAL (buyer) account:");
  for (const f of open) console.log(`  ${f.name}: ${f.approveUrl}`);
  await rl.question("\nPress Enter after all approvals are done (the page will redirect to example.com, that is expected)... ");
  rl.close();

  // 2. Authorize each approved order.
  for (const f of open) {
    console.log(`\n${f.name}: authorize order ${f.orderId}`);
    const r = await pp("POST", `/v2/checkout/orders/${f.orderId}/authorize`, {});
    if (!r.ok) { f.error = r.body; continue; }
    f.authId = r.body.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
    f.authStatus = r.body.purchase_units?.[0]?.payments?.authorizations?.[0]?.status;
  }

  // 3. Settle per plan.
  for (const f of open.filter((x) => x.authId)) {
    console.log(`\n${f.name}: plan = ${f.plan}`);
    if (f.plan === "void") {
      const r = await pp("POST", `/v2/payments/authorizations/${f.authId}/void`);
      f.result = r.ok ? "voided" : r.body;
      continue;
    }
    if (f.plan === "reauth-then-capture") {
      const r = await pp("POST", `/v2/payments/authorizations/${f.authId}/reauthorize`, { amount: { currency_code: currency, value: fmt(f.cap) } });
      f.reauth = r.ok ? { newAuthId: r.body.id, status: r.body.status } : { status: r.status, error: r.body.details?.[0]?.issue || r.body.name, message: r.body.message };
      if (r.ok && r.body.id) f.authId = r.body.id;
    }
    const r = await pp("POST", `/v2/payments/authorizations/${f.authId}/capture`, {
      amount: { currency_code: currency, value: fmt(f.share) },
      final_capture: true,
      note_to_payer: `Exact share from the receipt for ${f.item}`,
    });
    f.result = r.ok ? { captureId: r.body.id, status: r.body.status, amount: r.body.amount } : r.body;
    const after = await pp("GET", `/v2/payments/authorizations/${f.authId}`);
    f.authAfter = after.body.status;
  }
  finish();
}

function finish() {
  const file = new URL(`./results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
  writeFileSync(file, JSON.stringify({ currency, friends, log }, null, 2));
  console.log("\nSummary");
  for (const f of friends) {
    const res = typeof f.result === "string" ? f.result : f.result?.status ? `${f.result.status} ${f.result.amount?.value ?? ""}` : f.error ? `ERROR ${f.error.name || ""} ${f.error.details?.[0]?.issue || ""}` : JSON.stringify(f.result);
    console.log(`  ${f.name.padEnd(6)} cap ${fmt(f.cap).padStart(6)}  share ${f.share == null ? "  -   " : fmt(f.share).padStart(6)}  -> ${res}${f.reauth ? `  (reauth: ${f.reauth.status ?? ""} ${f.reauth.error ?? ""})` : ""}${f.authAfter ? `  auth now ${f.authAfter}` : ""}`);
  }
  console.log(`\nFull log: ${file.pathname}`);
}

main().catch((e) => { console.error(e); finish(); process.exit(1); });
