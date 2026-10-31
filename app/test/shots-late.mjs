// Later stages (holds approved -> shopping -> swap -> receipt -> settle -> handover), driven by taps.
// Run against a server started with PAYPAL_FAKE=1 (no PayPal login needed); AI receipt read is real.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:5181";
const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
const out = new URL(`../shots/late-${w}/`, import.meta.url).pathname; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" });
const errs = []; let n = 0;
const mk = async () => { const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1000, isMobile: w < 1000, deviceScaleFactor: 2 }); const p = await c.newPage(); p.on("pageerror", (e) => errs.push(String(e))); return p; };
const shot = async (p, name) => { await p.waitForTimeout(800); const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ov > 0) errs.push(`${name} overflow ${ov}`); await p.screenshot({ path: `${out}${String(n++).padStart(2, "0")}-${name}.png` }); };
const tap = (p, sel) => (w < 1000 ? p.tap(sel) : p.click(sel));

const dina = await mk();
await dina.goto(BASE); await dina.fill("#name", "Dina"); await dina.click("text=Continue");
await dina.click("[data-new] >> nth=0"); await dina.fill("#nt-fee", "100"); await dina.click("#nt-save"); await dina.waitForSelector(".passcard");
const invite = await dina.evaluate(() => document.querySelector("#invite").innerHTML.replace(/&amp;/g, "&"));

const friends = [["Ayu", "matcha kitkat big bag otona no amasa", 1500], ["Bima", "Tokyo Banana 8 pack", 1800], ["Citra", "Hada Labo Gokujyun lotion 170ml", 1200]];
const pages = {};
for (const [name, text, cap] of friends) {
  const p = await mk(); pages[name] = p;
  await p.goto(invite); await p.fill("#name", name); await p.click("text=Continue");
  await p.fill("#src", text); await p.click("#find"); await p.waitForSelector("#cap-v", { timeout: 60000 });
  // set the max price exactly via the stepper
  const cur = await p.evaluate(() => Number(document.querySelector("#cap-v").textContent.replace(/[^\d]/g, "")));
  const steps = Math.round((cap - cur) / 100);
  for (let i = 0; i < Math.abs(steps); i++) await p.click(`.stepper [data-d="${steps > 0 ? 1 : -1}"]`);
  await p.click("#send"); await p.waitForSelector(".pill");
}
await dina.reload(); await dina.waitForSelector("[data-decide]");
while (await dina.$('[data-decide][data-a="1"]')) { await dina.click('[data-decide][data-a="1"] >> nth=0'); await dina.waitForTimeout(700); }
await dina.click("[data-day]"); await dina.click(".sheet [data-d] >> nth=1"); await dina.waitForTimeout(900);

for (const name of ["Ayu", "Bima", "Citra"]) {
  const p = pages[name]; await p.reload(); await p.waitForSelector("[data-hold]");
  await p.click("[data-hold]"); await p.click("#go"); await p.waitForSelector("text=Hold approved", { timeout: 15000 });
  if (name === "Ayu") await shot(p, "friend-held");
}
await dina.reload(); await dina.waitForSelector("[data-shop]:not([disabled])"); await shot(dina, "trip-all-held");
await dina.click("[data-shop]"); await dina.waitForSelector(".shop-item"); await shot(dina, "shopping-list");
await tap(dina, ".shop-item >> nth=0 >> .check"); await dina.waitForTimeout(900);
await tap(dina, ".shop-item >> nth=2 >> .check"); await dina.waitForTimeout(900);
await dina.click(".shop-item >> nth=1 >> [data-more]"); await shot(dina, "item-menu");
await dina.click("[data-m=swap]"); await dina.fill("#sw-t", "Tokyo Banana 4 pack"); await dina.fill("#sw-p", "648"); await shot(dina, "swap-form");
await dina.click("#swapf .btn"); await dina.waitForTimeout(1000); await shot(dina, "shopping-swap-asked");

const bima = pages.Bima; await bima.reload(); await bima.waitForSelector("[data-swap]"); await shot(bima, "friend-swap");
await bima.click('[data-swap][data-y="1"]'); await bima.waitForTimeout(900);
await dina.reload(); await dina.waitForSelector("[data-receipt]:not([disabled])"); await shot(dina, "ready-receipt");
await dina.click("[data-receipt]"); await shot(dina, "receipt-sheet");
await dina.click("#rx-sample"); await dina.waitForTimeout(1500); await shot(dina, "receipt-reading");
const t0 = Date.now(); await dina.waitForSelector("#rx-go", { timeout: 120000 }); console.log("receipt read ms", Date.now() - t0); await shot(dina, "receipt-plan");
await dina.evaluate(() => document.querySelector(".sheet .sh-b").scrollTo(0, 9999)); await shot(dina, "receipt-plan-bottom");
await dina.click("#rx-go"); await dina.waitForSelector(".money", { timeout: 30000 }); await shot(dina, "settled");

const ayu = pages.Ayu; await ayu.reload(); await ayu.waitForSelector("[data-got]"); await shot(ayu, "friend-charged");
await ayu.click("[data-got]"); await ayu.waitForTimeout(1000); await shot(ayu, "friend-delivered");
console.log(`late ${w}x${h}: ${n} shots, ${errs.length ? "ERR " + errs.join(" | ") : "no errors"}`);
await b.close();
