// Screenshots of the real app at phone and desktop, driving the UI by taps.
// Uses the sandbox-free parts only (no PayPal login): welcome, new trip, share, friend ask with AI, accept, shopping day, hold sheet.
import { chromium } from "/home/feryyp/.agents/skills/adaptive-ux/scripts/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:5180";
const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
const dark = process.argv.includes("--dark");
const out = new URL(`../shots/${w}${dark ? "-dark" : ""}/`, import.meta.url).pathname; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const mk = async () => { const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1000, isMobile: w < 1000, deviceScaleFactor: 2, colorScheme: dark ? "dark" : "light" }); const p = await c.newPage(); p.on("pageerror", (e) => errs.push(String(e))); return p; };
const errs = []; let n = 0;
const shot = async (p, name) => { await p.waitForTimeout(700); const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ov > 0) errs.push(`${name} overflow ${ov}`); await p.screenshot({ path: `${out}${String(n++).padStart(2, "0")}-${name}.png` }); };

const dina = await mk();
await dina.goto(BASE); await shot(dina, "welcome");
await dina.fill("#name", "Dina"); await dina.click("text=Continue"); await shot(dina, "trips-empty");
await dina.click("[data-new] >> nth=0"); await shot(dina, "new-trip");
await dina.fill("#nt-fee", "100"); await dina.click("#nt-save"); await dina.waitForSelector(".passcard"); await shot(dina, "trip-open");
const invite = await dina.evaluate(() => document.querySelector("#invite").innerHTML.replace(/&amp;/g, "&"));

const ayu = await mk();
await ayu.goto(invite); await shot(ayu, "friend-landing");
await ayu.fill("#name", "Ayu"); await ayu.click("text=Continue");
await ayu.waitForSelector("#src"); await ayu.fill("#src", "https://www.tiktok.com/@snackjp/video/7431 matcha kitkat big bag"); await shot(ayu, "friend-paste");
await ayu.click("#find"); await ayu.waitForSelector("#cap-v", { timeout: 60000 }); await shot(ayu, "friend-found");
await ayu.click('.stepper [data-d="1"]'); await ayu.click("#send"); await ayu.waitForSelector(".pill"); await shot(ayu, "friend-asked");

const bima = await mk();
await bima.goto(invite); await bima.fill("#name", "Bima"); await bima.click("text=Continue");
await bima.fill("#src", "Tokyo Banana 8 pack"); await bima.click("#find"); await bima.waitForSelector("#send", { timeout: 60000 }); await bima.click("#send"); await bima.waitForSelector(".pill");

await dina.reload(); await dina.waitForSelector("[data-decide]"); await shot(dina, "trip-requests");
for (const x of await dina.$$('[data-decide][data-a="1"]')) { await dina.click('[data-decide][data-a="1"] >> nth=0'); await dina.waitForTimeout(600); }
await shot(dina, "trip-accepted");
await dina.click("[data-day]"); await shot(dina, "shop-day-sheet");
await dina.click(".sheet [data-d] >> nth=1"); await dina.waitForTimeout(900); await shot(dina, "trip-holds");

await ayu.reload(); await ayu.waitForSelector("[data-hold]"); await shot(ayu, "friend-approve");
await ayu.click("[data-hold]"); await shot(ayu, "friend-pp-sheet");
console.log(`${w}x${h}${dark ? " dark" : ""}: ${n} shots, ${errs.length ? "ERR " + errs.join(" | ") : "no errors"}`);
await b.close();
