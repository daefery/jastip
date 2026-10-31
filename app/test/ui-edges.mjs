// Browser checks for the exceptional journeys (council round 1). Needs a test-mode server with DEMO_SWITCH=1:
//   scripts/serve.sh 5181 fake && node test/ui-edges.mjs
import { chromium } from "/home/feryyp/.agents/skills/adaptive-ux/scripts/node_modules/playwright-core/index.mjs";
const BASE = process.env.BASE || "http://localhost:5181";
const res = []; const ok = (c, w, x = "") => { res.push(!!c); console.log(`${c ? "PASS" : "FAIL"}  ${w}${x ? "  " + x : ""}`); };
const d = (k) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);

const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
async function person(name, vp = { width: 390, height: 844 }) {
  const ctx = await b.newContext({ viewport: vp, baseURL: BASE });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (x) => { errs.push(`native ${x.type()} dialog: ${x.message()}`); x.dismiss(); });
  await p.goto("/"); await p.evaluate((n) => fetch("/api/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) }), name);
  await p.reload();
  const call = (path, body, method) => p.evaluate(async ([path, body, method]) => { const r = await fetch(path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; }, [path, body, method]);
  return { p, ctx, call, errs };
}
const approve = async (who, rid) => { const h = await who.call(`/api/requests/${rid}/hold`, {}); await who.p.goto(h.approve); };

// Trip with Citra asking two items; Ayu asks one with a long unbroken name.
const dina = await person("Dina");
const { trip } = await dina.call("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: 100 });
const code = (await dina.call(`/api/trips/${trip.id}`)).trip.invite;
const citra = await person("Citra", { width: 768, height: 1024 });
const c1 = (await citra.call(`/api/join/${code}/requests`, { title: "Hada Labo lotion", cap: 1100 })).request;
const c2 = (await citra.call(`/api/join/${code}/requests`, { title: "Roihi patches", cap: 1300 })).request;
const ayu = await person("Ayu", { width: 320, height: 640 });
const a1 = (await ayu.call(`/api/join/${code}/requests`, { title: "X".repeat(60), cap: 900 })).request;

// 5. tablet: Citra can pick her other item
await citra.p.goto(`/#/trip/${trip.id}`); await citra.p.reload(); await citra.p.waitForSelector(".trk");
for (const w of [699, 700, 768, 1024, 1100]) {
  await citra.p.setViewportSize({ width: w, height: 1000 }); await citra.p.waitForTimeout(200);
  const links = await citra.p.locator(`a[href*="/r/"]`).locator("visible=true").count();
  ok(links >= 1, `${w}px: friend with 2 asks can open the other one`, `${links} visible`);
}
// 9. 320 px with a 60-char unbroken title: no sideways scroll
await ayu.p.goto(`/#/trip/${trip.id}`); await ayu.p.waitForSelector(".trk");
ok(await ayu.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "320px: long unbroken item name does not overflow");

// 13. withdraw offered once accepted, before the hold
await dina.call(`/api/requests/${a1.id}/decide`, { accept: true });
await ayu.p.reload(); await ayu.p.waitForSelector(".trk");
ok(await ayu.p.locator("[data-withdraw]").locator("visible=true").count() > 0, "accepted (no hold yet): friend can still withdraw");

// 13b. withdrawing goes home with no error
const ayuErr0 = ayu.errs.length;
await ayu.p.locator("[data-withdraw]").locator("visible=true").first().click(); await ayu.p.waitForSelector(".sheet [data-yes]");
ok(/Withdraw this ask/.test(await ayu.p.locator(".sheet").innerText()), "withdraw asks in an in-app sheet, not a browser dialog");
await ayu.p.locator(".sheet [data-yes]").click(); await ayu.p.waitForTimeout(1500);
ok(ayu.errs.length === ayuErr0 && (await ayu.p.evaluate(() => location.hash)) === "#/", "withdraw goes home without a page error", ayu.errs.slice(ayuErr0).join(" | "));

// 15. a negative fractional fee is refused, the form keeps the value and marks the field
const nf = await dina.call("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: -0.1 });
ok(nf.status === 400, "fee -0.1 is refused by the server", nf.error);
await dina.p.goto(`/#/new`); await dina.p.waitForSelector("#fee");
await dina.p.fill("#fee", "-5"); await dina.p.click("#go"); await dina.p.waitForTimeout(300);
ok(await dina.p.getAttribute("#fee", "aria-invalid") === "true" && await dina.p.inputValue("#fee") === "-5" && /zero or more/.test(await dina.p.locator("#fee-err").innerText()), "form marks the bad fee and keeps it");

// 12. profile button still works after a live re-render
for (const r of [c1, c2]) await dina.call(`/api/requests/${r.id}/decide`, { accept: true });
await dina.p.goto(`/#/trip/${trip.id}`); await dina.p.waitForSelector(".trk");
await dina.p.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
await dina.p.waitForTimeout(400);
await dina.p.locator("[data-me]").first().click(); await dina.p.waitForTimeout(400);
ok(await dina.p.locator(".sheet").count() === 1, "profile button opens after re-render");
await dina.p.keyboard.press("Escape"); await dina.p.waitForTimeout(400);

// 11. browser Back closes an open sheet
await dina.p.goto(`/#/`); await dina.p.goto(`/#/trip/${trip.id}`); await dina.p.waitForSelector(".trk");
await dina.p.locator("[data-share]").first().click(); await dina.p.waitForSelector(".sheet");
await dina.p.goBack(); await dina.p.waitForTimeout(600);
ok(await dina.p.locator(".sheet").count() === 0 && await dina.p.evaluate(() => !document.getElementById("app").inert), "Back closes the sheet and the page is usable");

// 6. late ask during holds shows Accept for the traveller
await dina.call(`/api/trips/${trip.id}/day`, { day: "Mon" });
const bima = await person("Bima");
const late = (await bima.call(`/api/join/${code}/requests`, { title: "Late KitKat", cap: 500 })).request;
await dina.p.goto(`/#/trip/${trip.id}`); await dina.p.waitForSelector(".trk"); await dina.p.reload(); await dina.p.waitForSelector(".trk");
ok(await dina.p.locator(`[data-accept="${late.id}"]`).locator("visible=true").count() === 1, "late ask in holds phase can be accepted");

// 7. never-held ask is "not included", not "released"
for (const r of [c1, c2]) await approve(citra, r.id);
await dina.p.goto(`/#/trip/${trip.id}`); await dina.p.reload(); await dina.p.waitForSelector("[data-shop]:not([disabled])");
await dina.p.locator("[data-shop]").first().click(); await dina.p.waitForSelector(".sheet [data-yes]");
const asked = await dina.p.locator(".sheet").innerText();
await dina.p.locator(".sheet [data-close]").last().click(); await dina.p.waitForTimeout(500);
ok(/left out/.test(asked) && /Late KitKat/.test(asked) && (await dina.call(`/api/trips/${trip.id}`)).trip.status === "holds", "start shopping warns which asks are left out (cancel keeps holds)", asked.split("\n")[0]);
await dina.call(`/api/trips/${trip.id}/shop`, {});
await bima.p.goto(`/#/trip/${trip.id}`); await bima.p.waitForSelector(".trk");
const bt = await bima.p.locator("main").innerText();
ok(/Not included/.test(bt) && !/released/i.test(bt), "late friend sees 'Not included', no fake release", bt.match(/Not included[^\n]*/)?.[0]);
await bima.p.goto(`/#/`); await bima.p.waitForTimeout(800);
ok(/Not included/.test(await bima.p.locator("main").innerText()), "late friend's home card says 'Not included'");

// 10. receipt: keyboard reaches "Take or choose photo", focus stays in the dialog
await dina.p.goto(`/#/trip/${trip.id}`); await dina.p.waitForSelector(".trk");
await dina.call(`/api/requests/${c1.id}/mark`, { what: "found" }); await dina.call(`/api/requests/${c2.id}/mark`, { what: "not_found" });
await dina.p.reload(); await dina.p.waitForSelector("[data-receipt]:not([disabled])");
await dina.p.locator("[data-receipt]").first().focus(); await dina.p.keyboard.press("Enter"); await dina.p.waitForTimeout(500);
const seen = new Set(); for (let i = 0; i < 6; i++) { seen.add(await dina.p.evaluate(() => (document.activeElement.closest(".sheet") ? "in:" : "out:") + (document.activeElement.id || document.activeElement.textContent.trim().slice(0, 20)))); await dina.p.keyboard.press("Tab"); }
ok([...seen].some((x) => x === "in:rx-take") && [...seen].every((x) => x.startsWith("in:")), "receipt dialog: keyboard reaches the photo button, focus trapped", [...seen].join(" | "));
await dina.p.keyboard.press("Escape"); await dina.p.waitForTimeout(400);

// 11b. slow PayPal answer after leaving the page: no repaint of the old trip
await dina.p.route("**/api/trips/*/settle", async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
await dina.p.goto(`/#/trip/${trip.id}`); await dina.p.reload(); await dina.p.waitForSelector("[data-receipt]:not([disabled])");
await dina.p.locator("[data-receipt]").first().click(); await dina.p.locator("#rx-sample").click();
await dina.p.waitForSelector("#rx-go", { timeout: 90000 });
await dina.p.locator("#rx-go").click(); await dina.p.waitForTimeout(300);
await dina.p.evaluate(() => { location.hash = "#/"; }); await dina.p.waitForTimeout(4500);
const after = await dina.p.evaluate(() => [location.hash, !!document.querySelector(".trk"), document.querySelector("main")?.innerText.slice(0, 40)]);
ok(after[0] === "#/" && !after[1], "slow settle + leaving: home stays home", JSON.stringify(after));
await dina.p.unroute("**/api/trips/*/settle");

// 23. slow /api/me on the way to a trip, then go home: the trip never paints over home
await dina.p.goto(`/#/`); await dina.p.waitForTimeout(500);
let slowOnce = true;
await dina.p.route("**/api/me", async (route) => { if (slowOnce) { slowOnce = false; await new Promise((r) => setTimeout(r, 2500)); } await route.continue(); });
await dina.p.evaluate((id) => { location.hash = `#/trip/${id}`; }, trip.id); await dina.p.waitForTimeout(200);
await dina.p.evaluate(() => { location.hash = "#/"; }); await dina.p.waitForTimeout(5000);
const after2 = await dina.p.evaluate(() => [location.hash, !!document.querySelector(".trk")]);
ok(after2[0] === "#/" && !after2[1], "slow route fetch + leaving: the old trip never paints", JSON.stringify(after2));
await dina.p.unroute("**/api/me");

// 29. join page: slow 404 or slow AI answer after leaving never repaints
await bima.p.goto(`/#/`); await bima.p.waitForTimeout(400);
let slowJoin = true;
await bima.p.route("**/api/join/nope", async (route) => { if (slowJoin) { slowJoin = false; await new Promise((r) => setTimeout(r, 2000)); } await route.continue(); });
await bima.p.evaluate(() => { location.hash = "#/join/nope"; }); await bima.p.waitForTimeout(200);
await bima.p.evaluate(() => { location.hash = "#/"; }); await bima.p.waitForTimeout(3500);
ok(!/doesn't work/.test(await bima.p.locator("main").innerText()), "slow bad-invite answer after leaving: home stays home");
await bima.p.unroute("**/api/join/nope");
{
  const d3 = await person("Dina3");
  const t3 = (await d3.call("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: 100 })).trip;
  const inv3 = (await d3.call(`/api/trips/${t3.id}`)).trip.invite;
  await bima.p.evaluate((c) => { location.hash = `#/join/${c}`; }, inv3); await bima.p.waitForSelector("#src");
  await bima.p.route("**/api/ai/item", async (route) => { await new Promise((r) => setTimeout(r, 2000)); await route.fulfill({ json: { title: "Pocky", detail: "", art: "snack", typical: 200 } }); });
  await bima.p.fill("#src", "pocky"); await bima.p.click("#find"); await bima.p.waitForTimeout(200);
  await bima.p.evaluate(() => { location.hash = "#/"; }); await bima.p.waitForTimeout(3500);
  const txt = await bima.p.locator("main").innerText();
  ok(!/should Dina3 bring/.test(txt) && /Trips/.test(txt), "slow AI answer after leaving: home stays home");
  await bima.p.unroute("**/api/ai/item");
}

// 32. a release PayPal hasn't confirmed shows Retry even while still collecting holds
{
  const { DatabaseSync } = await import("node:sqlite");
  const d4 = await person("Dina4"), f4 = await person("Fia");
  const t4 = (await d4.call("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: 100 })).trip;
  const inv4 = (await d4.call(`/api/trips/${t4.id}`)).trip.invite;
  const r4 = (await f4.call(`/api/join/${inv4}/requests`, { title: "Pocky", cap: 400 })).request;
  await d4.call(`/api/requests/${r4.id}/decide`, { accept: true }); await d4.call(`/api/trips/${t4.id}/day`, { day: "Mon" });
  // the state left by "withdrawn while PayPal approved, release not confirmed" (written straight to the test DB)
  const db = new DatabaseSync(process.env.DB_FILE || "/tmp/jastip-fake-5181.db");
  db.prepare("UPDATE requests SET status='releasing', auth_id='FAKE-AUTH-x', hold=500, plan_op='void', plan_charge=0, plan_why='withdrawn while PayPal was approving' WHERE id=?").run(r4.id);
  db.close();
  await d4.p.goto(`/#/trip/${t4.id}`); await d4.p.reload(); await d4.p.waitForSelector(".trk");
  const txt = await d4.p.locator("main").innerText();
  ok(await d4.p.locator("[data-retry]").locator("visible=true").count() > 0 && /not confirmed/.test(txt), "holds phase: pending release shows Retry", txt.match(/\d PayPal step[^\n]*/)?.[0]);
  await d4.p.locator("[data-retry]").locator("visible=true").first().click(); await d4.p.waitForTimeout(1500);
  const after = (await d4.call(`/api/trips/${t4.id}`));
  ok(after.requests[0].status === "released" && after.trip.status === "holds", "retry releases it; trip still collecting holds");
  // 24. an unconfirmed capture on the friend's home: "charge pending", never "held"
  const db2 = new DatabaseSync(process.env.DB_FILE || "/tmp/jastip-fake-5181.db");
  db2.prepare("UPDATE requests SET status='found', auth_id='FAKE-AUTH-y', hold=500, plan_op='capture', plan_charge=388, plan_why=NULL WHERE id=?").run(r4.id);
  db2.prepare("UPDATE trips SET status='settling' WHERE id=?").run(t4.id);
  db2.close();
  await f4.p.goto(`/#/`); await f4.p.reload(); await f4.p.waitForSelector(".trip");
  const home4 = await f4.p.locator(".trip").first().innerText();
  ok(/charge pending/.test(home4) && !/held/.test(home4), "friend home: unconfirmed capture reads 'charge pending', not 'held'", home4.replace(/\n/g, " | "));
}

// 35. one friend's unconfirmed release never blocks another friend's shopping or checkout
for (const vp of [{ width: 320, height: 640 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  const { DatabaseSync } = await import("node:sqlite");
  const d5 = await person("Dina5", vp), a5 = await person("Aya"), b5 = await person("Ben");
  const t5 = (await d5.call("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: 100 })).trip;
  const inv5 = (await d5.call(`/api/trips/${t5.id}`)).trip.invite;
  const ra = (await a5.call(`/api/join/${inv5}/requests`, { title: "Matcha KitKat", cap: 1500 })).request;
  const rb = (await b5.call(`/api/join/${inv5}/requests`, { title: "Pocky", cap: 500 })).request;
  for (const r of [ra, rb]) await d5.call(`/api/requests/${r.id}/decide`, { accept: true });
  await d5.call(`/api/trips/${t5.id}/day`, { day: "Mon" });
  await approve(a5, ra.id);
  const db = new DatabaseSync(process.env.DB_FILE || "/tmp/jastip-fake-5181.db");
  db.prepare("UPDATE requests SET status='releasing', auth_id='FAKE-AUTH-b', hold=600, plan_op='void', plan_charge=0, plan_why='withdrawn while PayPal was approving' WHERE id=?").run(rb.id);
  db.close();
  await d5.p.goto(`/#/trip/${t5.id}`); await d5.p.reload(); await d5.p.waitForSelector(".trk");
  const vis = (sel) => d5.p.locator(sel).locator("visible=true").count();
  const w = vp.width;
  ok(await vis("[data-shop]:not([disabled])") === 1 && await vis("[data-retry]") === 1, `${w}px holds: Start shopping and Retry both there`);
  await d5.p.locator("[data-shop]").locator("visible=true").first().click(); await d5.p.waitForTimeout(800);
  await d5.call(`/api/requests/${ra.id}/mark`, { what: "found" }); await d5.p.reload(); await d5.p.waitForSelector(".trk");
  ok(await vis("[data-receipt]:not([disabled])") === 1 && await vis("[data-retry]") === 1, `${w}px shopping: receipt checkout and Retry both there`);
}

// S6 in Singapore: a new friend asks SG$1,000; the traveller vouches when accepting; the hold then works
{
  const d6 = await person("Dina6"), g6 = await person("Gita");
  const t6 = (await d6.call("/api/trips", { home_code: "CGK", city_code: "SIN", depart: d(1), ret: d(5), fee: 5 })).trip;
  const inv6 = (await d6.call(`/api/trips/${t6.id}`)).trip.invite;
  await g6.p.goto(`/#/join/${inv6}`); await g6.p.reload(); await g6.p.waitForSelector("#src");
  await g6.p.route("**/api/ai/item", (route) => route.fulfill({ json: { title: "Dyson hair dryer", detail: "", art: "gadget", typical: 800 } }));
  await g6.p.fill("#src", "dyson"); await g6.p.click("#find"); await g6.p.waitForSelector("[data-vouch]");
  ok(await g6.p.locator("[data-vouch]").isVisible(), "friend sees the over-$50 note before asking", await g6.p.locator("[data-vouch]").innerText());
  const r6 = (await g6.call(`/api/join/${inv6}/requests`, { title: "Dyson hair dryer", cap: 1000 })).request;
  await d6.p.goto(`/#/trip/${t6.id}`); await d6.p.reload(); await d6.p.waitForSelector(`[data-accept="${r6.id}"]`);
  await d6.p.locator(`[data-accept="${r6.id}"]`).click(); await d6.p.waitForSelector(".sheet [data-yes]");
  ok(/Do you know Gita/.test(await d6.p.locator(".sheet").innerText()), "accepting a new friend's big ask asks 'Do you know Gita?'");
  await d6.p.locator(".sheet [data-yes]").click(); await d6.p.waitForTimeout(1200);
  await d6.call(`/api/trips/${t6.id}/day`, { day: "Mon" });
  const h6 = await g6.call(`/api/requests/${r6.id}/hold`, {});
  ok(!!h6.approve, "after vouching, the SG$1,005 hold opens in PayPal", h6.error);
  // not vouched -> still blocked
  const k6 = await person("Kiki");
  const rk = (await k6.call(`/api/join/${inv6}/requests`, { title: "Another dryer", cap: 1000 })).request;
  await d6.call(`/api/requests/${rk.id}/decide`, { accept: true });
  const hk = await k6.call(`/api/requests/${rk.id}/hold`, {});
  ok(hk.status === 409 && /confirm they know you/.test(hk.error), "without vouching the big hold is still refused", hk.error);
}

// 3. a stranger cannot open the trip
const zed = await person("Zed");
ok((await zed.call(`/api/trips/${trip.id}`)).status === 404, "stranger gets 404 on the trip");
// 4. switching only to people who share a trip
ok((await zed.call("/api/switch", { id: (await dina.call("/api/me")).user.id })).status === 404, "stranger can't switch into the traveller");

// 1. all items not found -> Finish releases holds
const d2 = await person("Dina2");
const t2 = (await d2.call("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: 100 })).trip;
const code2 = (await d2.call(`/api/trips/${t2.id}`)).trip.invite;
const e1 = await person("Eka");
const er = (await e1.call(`/api/join/${code2}/requests`, { title: "Pocky", cap: 400 })).request;
await d2.call(`/api/requests/${er.id}/decide`, { accept: true }); await d2.call(`/api/trips/${t2.id}/day`, { day: "Mon" });
await approve(e1, er.id); await d2.call(`/api/trips/${t2.id}/shop`, {}); await d2.call(`/api/requests/${er.id}/mark`, { what: "not_found" });
await d2.p.goto(`/#/trip/${t2.id}`); await d2.p.waitForSelector("[data-finish]");
await d2.p.locator("[data-finish]").first().click(); await d2.p.waitForSelector(".sheet [data-yes]");
await d2.p.locator(".sheet [data-yes]").click(); await d2.p.waitForTimeout(1500);
const st = (await d2.call(`/api/trips/${t2.id}`)).requests[0].status;
ok(st === "released", "nothing found: Finish releases the hold from the UI", st);

const errs = [dina, citra, ayu, bima, d2, e1].flatMap((x) => x.errs);
ok(!errs.length, "no page errors", errs.join(" | "));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
