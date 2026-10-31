// One real receipt photo through the live flow: asks -> PayPal holds (sandbox approval page) -> found
// -> receipt read by the deployed AI -> printed plan. Settles only with SETTLE=1.
//   BASE=https://... SANDBOX_BUYER_EMAIL=... SANDBOX_BUYER_PASSWORD=... node test/real-receipt.mjs <photo> "<ask 1>:<max>" "<ask 2>:<max>" ...
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
const BASE = process.env.BASE || "https://jastip.feryyp-work.workers.dev";
const [photo, ...asks] = process.argv.slice(2);
const d = (k) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);
const client = () => { let c = ""; return async (p, body) => { const r = await fetch(BASE + p, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Cookie: c }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" }); const sc = r.headers.get("set-cookie"); if (sc) c = sc.split(";")[0]; return { status: r.status, ...(await r.json().catch(() => ({}))) }; }; };
const dina = client(); await dina("/api/me", { name: "Dina" });
const { trip } = await dina("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: 100 });
const inv = (await dina(`/api/trips/${trip.id}`)).trip.invite;
const reqs = [];
for (const [i, a] of asks.entries()) {
  const [title, max] = a.split(":"); const f = client(); await f("/api/me", { name: `Friend${i + 1}` });
  const r = (await f(`/api/join/${inv}/requests`, { title, cap: Number(max) })).request;
  await dina(`/api/requests/${r.id}/decide`, { accept: true }); reqs.push({ f, r });
}
await dina(`/api/trips/${trip.id}/day`, { day: "Mon" });
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" }); const page = await (await b.newContext()).newPage();
let first = true;
for (const { f, r } of reqs) {
  const h = await f(`/api/requests/${r.id}/hold`, {});
  if (h.approve.startsWith(BASE)) { await fetch(h.approve, { redirect: "manual" }); continue; } // PayPal test mode: no approval page
  await page.goto(h.approve, { waitUntil: "domcontentloaded" });
  if (first) { await page.waitForSelector("#email", { timeout: 30000 }); await page.fill("#email", process.env.SANDBOX_BUYER_EMAIL);
    const nx = page.locator("#btnNext"); if (await nx.isVisible().catch(() => false)) await nx.click();
    await page.waitForSelector("#password", { state: "visible", timeout: 20000 }); await page.fill("#password", process.env.SANDBOX_BUYER_PASSWORD); await page.click("#btnLogin"); first = false; }
  const btn = page.locator('[data-id="payment-submit-btn"], #payment-submit-btn, button:has-text("Continue"), button:has-text("Agree")').first();
  await btn.waitFor({ timeout: 45000 }); await btn.click(); await page.waitForURL((u) => u.toString().startsWith(BASE), { timeout: 45000 });
}
await b.close();
await dina(`/api/trips/${trip.id}/shop`, {});
for (const { r } of reqs) await dina(`/api/requests/${r.id}/mark`, { what: "found" });
const type = photo.endsWith(".png") ? "png" : photo.endsWith(".webp") ? "webp" : "jpeg";
const t0 = Date.now(); const rx = await dina(`/api/trips/${trip.id}/receipt`, { image: `data:image/${type};base64,` + readFileSync(photo).toString("base64") });
console.log(`trip ${trip.id} · read in ${Math.round((Date.now() - t0) / 1000)} s · ${rx.error || "ok"} · shop: ${rx.shop}`);
for (const l of rx.lines || []) console.log(`  line ${l.n}  ${l.text}  ${l.price}${l.disc ? " (disc)" : ""}`);
for (const p of rx.plan || []) console.log(`  ${p.title} -> ${p.charge ? `CHARGE ${p.charge} (line ${p.line.n})` : `release: ${p.why}`}`);
if (process.env.SETTLE === "1" && rx.plan) { const s = await dina(`/api/trips/${trip.id}/settle`, { receipt: rx.receipt, rev: rx.rev }); console.log("settle:", JSON.stringify(s.results || s)); }
