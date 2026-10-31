// End-to-end against a running server (default http://localhost:5180), real PayPal sandbox + real AI.
// The PayPal approval step is done in a real browser as the sandbox buyer (SANDBOX_BUYER_EMAIL / _PASSWORD),
// so it proves the full redirect flow. Every safeguard S1-S8 from lib/trips.mjs is tried.
import { chromium } from "/home/feryyp/.agents/skills/adaptive-ux/scripts/node_modules/playwright-core/index.mjs";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:5180";
const BUYER = process.env.SANDBOX_BUYER_EMAIL, PASS = process.env.SANDBOX_BUYER_PASSWORD;
const results = [];
const ok = (cond, what, extra = "") => { results.push([!!cond, what, extra]); console.log(`${cond ? "PASS" : "FAIL"}  ${what}${extra ? "  " + extra : ""}`); };

function client() {
  let cookie = "";
  const call = async (path, body, method) => {
    const res = await fetch(BASE + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", Cookie: cookie }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const b = await res.json().catch(() => ({}));
    return { status: res.status, ...b };
  };
  return { call, get cookie() { return cookie; } };
}

const dina = client(), ayu = client(), bima = client(), citra = client();
await dina.call("/api/me", { name: "Dina" });
await ayu.call("/api/me", { name: "Ayu" });
await bima.call("/api/me", { name: "Bima" });
await citra.call("/api/me", { name: "Citra" });

const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const { trip } = await dina.call("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(6), fee: 100 });
ok(trip?.currency === "JPY" && trip.fee === 100, "trip opened in JPY with ¥100 fee");
const view = await dina.call(`/api/trips/${trip.id}`);
const code = view.trip.invite;

// AI understands a pasted request
const ai = await ayu.call("/api/ai/item", { text: "https://www.tiktok.com/@snackjp/video/7431 matcha kitkat otona no amasa big bag", currency: "JPY", city: "Tokyo" });
ok(/kit ?kat/i.test(ai.title || ""), "AI turns a pasted link into an item", JSON.stringify(ai));

const own = await dina.call(`/api/join/${code}/requests`, { title: "x", cap: 1000 });
ok(own.status === 409, "traveller can't ask her own trip");
const a = (await ayu.call(`/api/join/${code}/requests`, { title: "Matcha KitKat, big bag", cap: 1500, art: "snack" })).request;
const b = (await bima.call(`/api/join/${code}/requests`, { title: "Tokyo Banana 8 pack", cap: 1800, art: "snack" })).request;
const c = (await citra.call(`/api/join/${code}/requests`, { title: "Hada Labo Gokujyun lotion 170ml", cap: 1200, art: "beauty" })).request;
const c2 = (await citra.call(`/api/join/${code}/requests`, { title: "Roihi-tsuboko patches 156", cap: 1300, art: "medicine" })).request;
ok(a && b && c && c2, "4 requests from 3 friends");

// S5: no hold before the traveller accepts
const early = await ayu.call(`/api/requests/${a.id}/hold`, {});
ok(early.status === 409, "S5 no hold before the traveller accepts", early.error);
// friend can't see other friends' requests
const ayuView = await ayu.call(`/api/trips/${trip.id}`);
ok(ayuView.requests.length === 1 && !ayuView.trip.invite, "friend sees only her own request, not the invite");

for (const r of [a, b, c, c2]) await dina.call(`/api/requests/${r.id}/decide`, { accept: true });
const hijack = await ayu.call(`/api/requests/${b.id}/decide`, { accept: false });
ok(hijack.status === 403, "a friend can't accept or decline for the traveller");
const noDay = await ayu.call(`/api/requests/${a.id}/hold`, {});
ok(noDay.status === 409, "no hold before a shopping day", noDay.error);
await dina.call(`/api/trips/${trip.id}/day`, { day: "Mon 2 Nov" });

// S6: new-friend limit ($50). Citra's two holds: ¥1,300 (~$8.6) + ¥1,400 (~$9.2) fine. Prove limit with a huge cap.
const big = (await citra.call(`/api/join/${code}/requests`, { title: "Rice cooker", cap: 9000, art: "gadget" })).request;
await dina.call(`/api/requests/${big.id}/decide`, { accept: true });

// Holds through the real PayPal page
const holds = {};
for (const [who, r] of [[ayu, a], [bima, b], [citra, c], [citra, c2]]) {
  const h = await who.call(`/api/requests/${r.id}/hold`, {});
  ok(h.approve?.includes("sandbox.paypal.com"), `PayPal hold created for ${r.title}`);
  holds[r.id] = h.approve;
}
const tooBig = await citra.call(`/api/requests/${big.id}/hold`, {});
ok(tooBig.status === 409 && /new-friend limit/.test(tooBig.error), "S6 new friend can't hold more than $50 in total", tooBig.error);

// S4: once held, a friend can't withdraw (checked after approval below)
if (!BUYER || !PASS) { console.log("\nSet SANDBOX_BUYER_EMAIL and SANDBOX_BUYER_PASSWORD to run the PayPal approval part."); process.exit(1); }
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext();
const page = await ctx.newPage();
let first = true;
for (const [rid, url] of Object.entries(holds)) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (first) {
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.fill("#email", BUYER);
    const next = page.locator("#btnNext"); if (await next.isVisible().catch(() => false)) await next.click();
    await page.waitForSelector("#password", { state: "visible", timeout: 20000 });
    await page.fill("#password", PASS);
    await page.click("#btnLogin");
    first = false;
  }
  const btn = page.locator('[data-id="payment-submit-btn"], #payment-submit-btn, button:has-text("Continue"), button:has-text("Agree")').first();
  await btn.waitFor({ timeout: 45000 });
  await btn.click();
  await page.waitForURL((u) => u.toString().startsWith(BASE), { timeout: 45000 });
  // the app's /paypal/return already authorized; read state
}
await browser.close();
const afterHold = await dina.call(`/api/trips/${trip.id}`);
const st = (id) => afterHold.requests.find((r) => r.id === id)?.status;
ok([a, b, c, c2].every((r) => st(r.id) === "held"), "all 4 holds AUTHORIZED through the PayPal page", [a, b, c, c2].map((r) => st(r.id)).join(","));
const w = await ayu.call(`/api/requests/${a.id}`, undefined, "DELETE");
ok(w.status === 409, "S4 a held request can't be withdrawn", w.error);

// Shopping. S1: only held items are marked; the unheld big one is dropped.
await dina.call(`/api/trips/${trip.id}/shop`, {});
const dropped = (await dina.call(`/api/trips/${trip.id}`)).requests.find((r) => r.id === big.id).status;
ok(dropped === "dropped", "S1 a request without an approved hold is dropped from shopping");
const markBig = await dina.call(`/api/requests/${big.id}/mark`, { what: "found" });
ok(markBig.status === 409, "S1 can't buy for a request with no hold");
await dina.call(`/api/requests/${a.id}/mark`, { what: "found" });
await dina.call(`/api/requests/${c.id}/mark`, { what: "found" });
await dina.call(`/api/requests/${c2.id}/mark`, { what: "not_found" });
const over = await dina.call(`/api/requests/${b.id}/mark`, { what: "swap", swap: { title: "Tokyo Banana 4 pack", price: 1900 } });
ok(over.status === 409, "S8 a swap above the friend's max is refused", over.error);
await dina.call(`/api/requests/${b.id}/mark`, { what: "swap", swap: { title: "Tokyo Banana 4 pack", price: 648 } });
const notYours = await ayu.call(`/api/requests/${b.id}/swap`, { yes: true });
ok(notYours.status === 409, "S8 only Bima can answer Bima's swap");
await bima.call(`/api/requests/${b.id}/swap`, { yes: true });

// Receipt read by AI from the sample photo; S2/S3 enforced by code
const img = "data:image/png;base64," + readFileSync(new URL("../public/sample/receipt-swap.png", import.meta.url)).toString("base64");
const rc = await dina.call(`/api/trips/${trip.id}/receipt`, { image: img });
ok(rc.lines?.length >= 4, `AI read ${rc.lines?.length} receipt lines`, rc.error || "");
const plan = Object.fromEntries((rc.plan || []).map((p) => [p.id, p]));
ok(plan[a.id]?.charge === 1188 + 100, "Ayu: ¥1,188 line + ¥100 fee", JSON.stringify(plan[a.id]));
ok(plan[b.id]?.charge === 648 + 100, "Bima: swap ¥648 + ¥100 fee", JSON.stringify(plan[b.id]));
ok(plan[c.id]?.charge === 968 + 100, "Citra: ¥968 + ¥100", JSON.stringify(plan[c.id]));
ok(plan[c2.id]?.charge === 0, "Citra's patches not found: release");
const friendSettle = await ayu.call(`/api/trips/${trip.id}/settle`, { receipt: rc.receipt, rev: rc.rev });
ok(friendSettle.status === 403, "a friend can't trigger the charges");
const settled = await dina.call(`/api/trips/${trip.id}/settle`, { receipt: rc.receipt, rev: rc.rev });
ok(settled.results?.filter((x) => x.charged).length === 3 && settled.results.filter((x) => x.released).length === 1, "PayPal: 3 CAPTURED exact, 1 VOIDED", JSON.stringify(settled.results));
const again = await dina.call(`/api/trips/${trip.id}/settle`, { receipt: rc.receipt, rev: rc.rev });
ok(again.status === 409 && !again.results, "S7 settling twice charges nobody twice", again.error);

const fin = await ayu.call(`/api/trips/${trip.id}`);
const ar = fin.requests[0];
ok(ar.status === "settled" && ar.charged === 1288 && ar.released === 1600 - 1288, "Ayu sees ¥1,288 charged, ¥312 never taken");
await ayu.call(`/api/requests/${a.id}/delivered`, {});
const me = await ayu.call("/api/me");
ok(me.user.kept === 1, "handover confirmed, Ayu's kept count is 1");

const pass = results.filter((r) => r[0]).length;
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
