// Play the E story at one viewport, by real taps, with checks that matter for adaptive:
// no horizontal overflow, the step's primary action is visible (not covered), sheets fit, no page errors.
// Usage: node walk-adaptive.mjs 390x844 [--dark]
import { chromium } from "/home/feryyp/.agents/skills/adaptive-ux/scripts/node_modules/playwright-core/index.mjs";
import { mkdirSync } from "node:fs";
const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
const out = new URL(`./shots-adaptive/${w}/`, import.meta.url).pathname; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const touch = w < 1024;
const p0 = 0; const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
const errs = [], probs = [];
p.on("pageerror", (e) => errs.push(String(e))); p.setDefaultTimeout(8000);
await p.goto("file://" + new URL("./app.html", import.meta.url).pathname);
await p.addStyleTag({ content: "*,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important}" });
let n = 0;
async function check(name) {
  const r = await p.evaluate(() => {
    const ov = document.documentElement.scrollWidth - innerWidth;
    // the primary action of this screen: an enabled button in .actbar or a sheet's last button
    const sheet = document.querySelector(".sheet");
    const btn = sheet ? [...sheet.querySelectorAll("button.btn")].pop() : document.querySelector(".actbar .btn:not([disabled])");
    let covered = null, offscreen = null;
    if (btn) {
      btn.scrollIntoView({ block: "nearest" });
      const r = btn.getBoundingClientRect();
      offscreen = r.bottom > innerHeight + 1 || r.top < 0;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      covered = hit && !btn.contains(hit) ? (hit.className || hit.tagName) : null;
    }
    const sh = sheet ? sheet.getBoundingClientRect() : null;
    const sheetFits = !sh || (sh.top >= 0 && sh.bottom <= innerHeight + 1);
    const small = [...document.querySelectorAll("button, a")].filter((e) => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width && r.height && (r.width < 24 || r.height < 24); }).length;
    return { ov, covered, offscreen, sheetFits, small, cols: getComputedStyle(document.querySelector(".view")).gridTemplateColumns };
  });
  if (r.ov > 0) probs.push(`${name}: overflow ${r.ov}px`);
  if (r.covered) probs.push(`${name}: primary action covered by ${r.covered}`);
  if (r.offscreen) probs.push(`${name}: primary action off screen`);
  if (!r.sheetFits) probs.push(`${name}: sheet taller than the screen`);
  await p.screenshot({ path: `${out}${String(n++).padStart(2, "0")}-${name}.png` });
  return r;
}
const tap = async (sel) => {
  const el = p.locator(sel).locator("visible=true").first();
  try {
    // fixed elements (pinned action bar, sheets, dock) are already in view; scrolling them times out
    const fixed = await el.evaluate((e) => !!e.closest(".actbar,.sheet,.dock,.hintbar") && ["fixed", "sticky"].includes(getComputedStyle(e.closest(".actbar,.sheet,.dock,.hintbar")).position));
    if (!fixed) await el.scrollIntoViewIfNeeded({ timeout: 2000 });
    touch ? await el.tap({ timeout: 3000 }) : await el.click({ timeout: 3000 });
  }
  catch (e) { errs.push(`${sel}: ${e.message.split("\n")[0]}`); }
  await p.waitForTimeout(120);
};
const as = (x) => tap(`.dock [data-as="${x}"]`);

const first = await check("ayu-approve-start");
await as("ayu"); await check("ayu-approve");
await tap('[data-act="holdSheet"]'); await check("ayu-paypal");
await tap('[data-act="doHold"]'); await check("ayu-held");
await as("dina"); await check("dina-ready");
await tap('[data-act="startShop"]'); await check("dina-shopping");
for (const k of ["ayu", "citra"]) { await tap(`[data-act="more"][data-k="${k}"]`); await tap('[data-act="found"]'); }
await tap('[data-act="more"][data-k="citra2"]'); await check("dina-mark-sheet"); await tap('[data-act="notHere"]');
await tap('[data-act="more"][data-k="bima"]'); await tap('[data-act="askSwap"]'); await check("dina-grouped");
await as("bima"); await check("bima-swap");
await tap('[data-act="swapSheet"]'); await check("bima-swap-sheet");
await tap('[data-act="answerSwap"]');
await as("dina"); await check("dina-ready-pay");
await tap('[data-act="scanSheet"]'); await check("dina-receipt");
await tap('[data-act="charge"]'); await check("dina-paid");
await as("ayu"); await check("ayu-paid");
await as("dina"); await tap('[data-act="flyHome"]'); await tap('[data-act="showQR"]'); await check("dina-qr"); await tap('.sheet [data-act="close"]');
await as("ayu"); await check("ayu-meet"); await tap('[data-act="got"]'); await check("ayu-delivered");
const step = await p.evaluate(() => S.step);
if (step !== 8) probs.push(`story stopped at step ${step + 1}/9`);
console.log(`${w}x${h}: cols[${first.cols}] ${n} shots, errors ${errs.length}, problems ${probs.length}`);
for (const x of [...errs, ...probs]) console.log("  - " + x);
await b.close();
process.exit(errs.length || probs.length ? 1 : 0);
