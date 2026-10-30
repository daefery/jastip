// Full real flow through the UI with four people (separate browser contexts = separate phones),
// against a running server (default test-mode PayPal on :5181; real AI). Checks at every screen:
// no page errors, no horizontal overflow, the screen's primary action is visible and not covered.
// Usage: node test/ui-flow.mjs 390x844   (BASE=http://localhost:5181)
import { chromium } from "/home/feryyp/.agents/skills/adaptive-ux/scripts/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:5181";
const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
const out = new URL(`../shots/flow-${w}/`, import.meta.url).pathname; mkdirSync(out, { recursive: true });
const touch = w < 1024;
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const errs = [], probs = []; let n = 0;
async function person(name) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errs.push(`${name}: ${e}`));
  p.on("console", (m) => { if (m.type() === "error") errs.push(`${name} console: ${m.text()}`); });
  p.name = name; return p;
}
async function shot(p, label) {
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const ov = document.documentElement.scrollWidth - innerWidth;
    const sh = document.querySelector(".sheet:not(.closing)");
    const btn = sh ? sh.querySelector("[data-primary],.btn.dark,.btn.pp,.btn.green") : document.querySelector(".actbar .btn:not([disabled])");
    let covered = null, off = false;
    if (btn && btn.offsetParent) {
      const r0 = btn.getBoundingClientRect();
      if (r0.bottom > innerHeight || r0.top < 0) btn.scrollIntoView({ block: "center" });
      const r = btn.getBoundingClientRect();
      off = r.bottom > innerHeight + 1 || r.top < 0;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      covered = hit && !btn.contains(hit) ? String(hit.className || hit.tagName) : null;
    }
    const s = sh?.getBoundingClientRect();
    return { ov, covered, off, sheetFits: !s || (s.top >= -1 && s.bottom <= innerHeight + 1) };
  });
  if (r.ov > 0) probs.push(`${label}: overflow ${r.ov}px`);
  if (r.covered && !/toast/.test(r.covered)) probs.push(`${label}: action covered by ${r.covered}`);
  if (r.off) probs.push(`${label}: action off screen`);
  if (!r.sheetFits) probs.push(`${label}: sheet taller than screen`);
  await p.screenshot({ path: `${out}${String(n++).padStart(2, "0")}-${label}.png` });
}
const tap = async (p, sel) => {
  const el = p.locator(sel).locator("visible=true").first();
  await el.waitFor({ state: "visible" });
  await el.scrollIntoViewIfNeeded().catch(() => {});
  touch ? await el.tap() : await el.click();
  await p.waitForTimeout(250);
};
const waitText = (p, t) => p.waitForFunction((x) => document.body.innerText.includes(x), t, { timeout: 90000 });

try {
  // Dina opens a trip
  const dina = await person("dina");
  await dina.goto(BASE); await shot(dina, "welcome");
  await dina.fill("#name", "Dina"); await tap(dina, "#hi button"); await waitText(dina, "Trips"); await shot(dina, "trips-empty");
  await tap(dina, 'a[href="#/new"]'); await shot(dina, "new-trip");
  await dina.fill("#fee", "100"); await tap(dina, "#go"); await waitText(dina, "Share your trip"); await shot(dina, "share-sheet");
  const invite = await dina.evaluate(() => document.querySelector(".linkbox span").textContent);
  await tap(dina, ".sheet [data-close]"); await dina.waitForTimeout(400); await shot(dina, "trip-empty");

  // Three friends ask
  const asks = [["ayu", "Ayu", "https://www.tiktok.com/@snackjp/video/7431 matcha kitkat otona no amasa big bag", 1500, "ask"], ["bima", "Bima", "Tokyo Banana 8 pack", 1800, "ask"], ["citra", "Citra", "Hada Labo Gokujyun lotion 170ml", 1200, "similar"]];
  const F = {};
  for (const [k, name, text, cap, rule] of asks) {
    const p = F[k] = await person(k);
    await p.goto(invite.replace(/^https?:\/\/[^/]+/, BASE)); if (k === "ayu") await shot(p, "friend-landing");
    await p.fill("#name", name); await tap(p, "#hi button");
    await p.waitForSelector("#src"); await p.fill("#src", text); if (k === "ayu") await shot(p, "friend-paste");
    await tap(p, "#find"); await p.waitForSelector("#capv", { timeout: 90000 });
    const now = await p.evaluate(() => Number(document.querySelector("#capv").textContent.replace(/[^\d]/g, "")));
    const steps = Math.round((cap - now) / 100);
    for (let i = 0; i < Math.abs(steps); i++) await p.click(`.stepper [data-d="${steps > 0 ? 1 : -1}"]`);
    await tap(p, `[data-rule="${rule}"]`);
    if (k === "ayu") await shot(p, "friend-found");
    await tap(p, w >= 1000 ? "#send" : "#send2"); await waitText(p, "Waiting for Dina");
    if (k === "ayu") await shot(p, "friend-asked");
  }
  // Citra asks a second item (will be not found)
  await F.citra.goto(invite.replace(/^https?:\/\/[^/]+/, BASE)); await F.citra.fill("#src", "Roihi-tsuboko patches 156"); await tap(F.citra, "#find"); await F.citra.waitForSelector("#capv", { timeout: 90000 }); await tap(F.citra, w >= 1000 ? "#send" : "#send2"); await waitText(F.citra, "Waiting for Dina");

  // Dina accepts, sets day
  await dina.reload(); await waitText(dina, "new ask"); await shot(dina, "new-asks");
  await tap(dina, "[data-acceptall]"); await waitText(dina, "Pick shopping day"); await shot(dina, "accepted");
  await tap(dina, "[data-day]"); await shot(dina, "day-sheet");
  await tap(dina, ".sheet [data-primary]"); await waitText(dina, "holding"); await shot(dina, "holds-waiting");

  // Friends approve holds (PayPal test mode returns straight to the app)
  for (const k of ["ayu", "bima", "citra"]) {
    const p = F[k]; await p.reload(); await waitText(p, "Approve your hold");
    if (k === "ayu") await shot(p, "friend-approve");
    await tap(p, "[data-hold]"); if (k === "ayu") await shot(p, "paypal-sheet");
    await tap(p, ".sheet [data-primary]"); await waitText(p, "Held");
    if (k === "ayu") await shot(p, "friend-held");
  }
  // Citra's second item
  await F.citra.goto(`${BASE}/#/`); await F.citra.waitForTimeout(600);
  const citraTrip = await F.citra.evaluate(() => document.querySelector("a.trip").getAttribute("href"));
  // the trip page opens on the ask that needs action (the second one still needs a hold)
  await F.citra.goto(BASE + "/" + citraTrip); await waitText(F.citra, "Approve your hold");
  await tap(F.citra, "[data-hold]"); await tap(F.citra, ".sheet [data-primary]"); await waitText(F.citra, "Held");

  // Dina shops
  await dina.reload(); await waitText(dina, "Go shopping"); await shot(dina, "all-held");
  await tap(dina, "[data-shop]"); await waitText(dina, "in the basket"); await shot(dina, "shopping");
  const found = async (title) => { const row = dina.locator(".jr", { hasText: title }); await (touch ? row.locator('[data-w="found"]').tap() : row.locator('[data-w="found"]').click()); await dina.waitForTimeout(600); };
  await found("Ayu"); await found("Hada Labo");
  const more = async (title) => { const row = dina.locator(".jr", { hasText: title }); await (touch ? row.locator("[data-more]").tap() : row.locator("[data-more]").click()); await dina.waitForTimeout(400); };
  await more("Roihi"); await shot(dina, "more-sheet"); await tap(dina, '.sheet [data-w="not_found"]'); await dina.waitForTimeout(600);
  await more("Bima"); await tap(dina, '.sheet [data-w="swap"]'); await dina.fill("#swt", "Tokyo Banana 4 pack"); await dina.fill("#swp", "648"); await shot(dina, "swap-form");
  await tap(dina, "#swf .btn"); await waitText(dina, "Waiting for Bima"); await shot(dina, "waiting-swap");

  // Bima picks the swap
  await F.bima.reload(); await waitText(F.bima, "sold out"); await shot(F.bima, "friend-swap");
  await tap(F.bima, "[data-swap]"); await shot(F.bima, "swap-sheet"); await tap(F.bima, ".sheet [data-primary]"); await waitText(F.bima, "Swap in the basket");

  // Dina scans the receipt (real AI)
  await dina.reload(); await waitText(dina, "Pay at the till"); await shot(dina, "ready-to-pay");
  await tap(dina, "[data-receipt]"); await shot(dina, "receipt-sheet");
  await tap(dina, "#rx-sample"); await dina.waitForSelector("#rx-go", { timeout: 120000 }); await shot(dina, "receipt-plan");
  await tap(dina, "#rx-go"); await waitText(dina, "paid to you"); await shot(dina, "settled");

  // Friends see exact charges; Ayu confirms
  await F.ayu.reload(); await waitText(F.ayu, "Exactly."); await shot(F.ayu, "friend-paid");
  await tap(F.ayu, "[data-got]"); await shot(F.ayu, "got-sheet"); await tap(F.ayu, ".sheet [data-primary]"); await waitText(F.ayu, "Delivered"); await shot(F.ayu, "friend-delivered");
  await F.citra.goto(`${BASE}/#/`); await F.citra.waitForTimeout(800); await shot(F.citra, "friend-home");
  await dina.goto(`${BASE}/#/`); await dina.waitForTimeout(800); await shot(dina, "trips-home");
  const money = await dina.evaluate(() => document.body.innerText);
  if (!/¥3,104/.test(money)) probs.push("Dina's home does not show +¥3,104");
} catch (e) { errs.push(`flow stopped: ${e.message.split("\n")[0]}`); }
console.log(`${w}x${h}: ${n} shots, errors ${errs.length}, problems ${probs.length}`);
for (const x of [...errs, ...probs]) console.log("  - " + x);
await b.close();
process.exit(errs.length || probs.length ? 1 : 0);
