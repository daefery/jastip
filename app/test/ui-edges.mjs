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
ayu.p.once("dialog", (x) => x.accept());
await ayu.p.locator("[data-withdraw]").locator("visible=true").first().click(); await ayu.p.waitForTimeout(1500);
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
let asked = "";
dina.p.once("dialog", (x) => { asked = x.message(); x.dismiss(); });
await dina.p.locator("[data-shop]").first().click(); await dina.p.waitForTimeout(500);
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
d2.p.once("dialog", (x) => x.accept());
await d2.p.locator("[data-finish]").first().click(); await d2.p.waitForTimeout(1500);
const st = (await d2.call(`/api/trips/${t2.id}`)).requests[0].status;
ok(st === "released", "nothing found: Finish releases the hold from the UI", st);

const errs = [dina, citra, ayu, bima, d2, e1].flatMap((x) => x.errs);
ok(!errs.length, "no page errors", errs.join(" | "));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
