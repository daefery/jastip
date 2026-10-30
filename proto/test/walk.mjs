// Walks the whole flow with real clicks at one viewport, screenshot per step, checks:
//  - no page errors, no horizontal overflow
//  - the step advanced after each click
//  - the money rail numbers at the end (Ayu captured ¥1,288 of ¥1,600, Dewi voided)
// Run: node test/walk.mjs 390x844 | 1440x900 | 768x1024 ...
import { chromium } from "/home/feryyp/.agents/skills/adaptive-ux/scripts/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";

const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
const file = new URL("../jastip-flow.html", import.meta.url).pathname;
const dir = new URL(`../shots/${w}/`, import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const touch = w < 1024;
const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto("file://" + file);
await p.addStyleTag({ content: "*,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important}" });

const step = () => p.evaluate(() => S.step);
const problems = [];
const shot = async (n, name) => {
  await p.waitForTimeout(450);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (ov > 0) problems.push(`${name}: overflow ${ov}px`);
  // is the cue (the control to press) visible on screen and not under the guide bar?
  const cue = await p.evaluate(() => {
    const els = [...document.querySelectorAll(".cue")].filter((e) => e.offsetParent !== null);
    const g = document.querySelector(".guide").getBoundingClientRect();
    return els.map((e) => { const r = e.getBoundingClientRect(); return { cls: e.className, top: r.top | 0, bottom: r.bottom | 0, under: r.bottom > g.top && r.top < g.bottom, below: r.top > innerHeight }; });
  });
  await p.screenshot({ path: `${dir}${String(n).padStart(2, "0")}-${name}.png` });
  return cue;
};

// tap the visible control for the current step; if it is on the other phone, use the guide's switch first
async function press(stepId) {
  const sel = `[data-act="do"][data-step="${stepId}"]`;
  let el = p.locator(sel).locator("visible=true").first();
  if (!(await el.count())) {
    const sw = p.locator(".guide [data-act=role]");
    if (await sw.count()) { await sw.click(); await p.waitForTimeout(150); }
    el = p.locator(sel).locator("visible=true").first();
  }
  await el.scrollIntoViewIfNeeded();
  if (touch) await el.tap(); else await el.click();
}

const ids = await p.evaluate(() => STEPS.map((s) => s.id));
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const cue = await shot(i, id);
  for (const c of cue) if (c.under) problems.push(`${id}: cue under guide bar (${c.cls})`);
  if (i === ids.length - 1) break;
  // one choice along the way: Ayu raises her cap once; Bima keeps the 4 pack
  if (id === "send") { const plus = p.locator('[data-act=cap][data-d="100"]').locator("visible=true").first(); if (await plus.count()) { await plus.click(); await plus.click(); await p.locator('[data-act=cap][data-d="-100"]').locator("visible=true").first().click(); await p.locator('[data-act=cap][data-d="-100"]').locator("visible=true").first().click(); } }
  const before = await step();
  await press(id).catch((e) => problems.push(`${id}: cannot press (${e.message.split("\n")[0]})`));
  await p.waitForTimeout(200);
  if ((await step()) !== before + 1) { problems.push(`${id}: did not advance`); break; }
}
// money sheet on phones
if (w < 700) { await p.click("#money-btn"); await shot(99, "money-sheet"); await p.keyboard.press("Escape"); }

const end = await p.evaluate(() => ({ step: STEPS[S.step].id, ayu: money(friend("ayu")), dewi: money(friend("dewi")), bima: money(friend("bima")), t: totals() }));
const want = [
  [end.step === "done", "ended on done"],
  [end.ayu.captured && end.ayu.share === 1288 && end.ayu.hold === 1600, "Ayu captured ¥1,288 of ¥1,600 hold"],
  [end.bima.captured && end.bima.share === 748, "Bima captured ¥748 (4 pack + fee)"],
  [end.dewi.status === "void" && !end.dewi.captured, "Dewi voided, ¥0"],
];
for (const [ok, what] of want) if (!ok) problems.push("money: " + what + " FAILED " + JSON.stringify(end));
console.log(`${w}x${h}: ${ids.length} steps, errors ${errs.length}, problems ${problems.length}`);
for (const e of [...errs, ...problems]) console.log("  - " + e);
await b.close();
process.exit(errs.length || problems.length ? 1 : 0);
