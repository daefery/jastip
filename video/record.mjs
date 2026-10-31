// Records the demo footage: the real app with the real PayPal sandbox approval page, one clip per
// scene (Playwright video, 390x844 phone). Run against a server with real PayPal (default :5180).
//   SANDBOX_BUYER_EMAIL=... SANDBOX_BUYER_PASSWORD=... node video/record.mjs [outDir]
import { chromium } from "../app/node_modules/playwright-core/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:5180";
const OUT = process.argv[2] || "/tmp/vid/clips";
mkdirSync(OUT, { recursive: true });
const VP = { width: 390, height: 844 };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" });
const marks = {}; const t0 = {};

// A person = a browser context with video on. Marks record when each scene starts (seconds into that clip).
async function person(name) {
  // Sharp capture: CDP screencast at device scale 2 (Playwright's recordVideo is 1x only).
  // Each frame is saved with its timestamp; frames are turned into a constant-30fps video afterwards.
  const ctx = await b.newContext({ viewport: VP, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "en-US", extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" } });
  const p = await ctx.newPage(); p.setDefaultTimeout(60000); t0[name] = Date.now(); marks[name] = [];
  const dir = `${OUT}/frames-${name}`; mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(p); const frames = []; p.frames_ = frames; p.dir_ = dir;
  cdp.on("Page.screencastFrame", async (f) => {
    const t = (Date.now() - t0[name]) / 1000; const file = `${dir}/${String(frames.length).padStart(6, "0")}.jpg`;
    writeFileSync(file, Buffer.from(f.data, "base64")); frames.push([file, t]);
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  p.stopRec = async () => { await cdp.send("Page.stopScreencast").catch(() => {}); };
  p.mark = (label) => marks[name].push([label, (Date.now() - t0[name]) / 1000]);
  p.ctx = ctx; p.who = name; return p;
}
const pause = (p, ms = 900) => p.waitForTimeout(ms);
// Visible "finger": a soft circle where we tap, so viewers can follow.
const finger = (p) => p.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div"); d.id = "__f";
    d.style.cssText = "position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(10,108,255,.28);border:2px solid rgba(10,108,255,.6);pointer-events:none;opacity:0;transition:opacity .25s,transform .25s;transform:scale(.6)";
    document.body.appendChild(d);
    window.__tapAt = (x, y) => { d.style.left = x + "px"; d.style.top = y + "px"; d.style.opacity = "1"; d.style.transform = "scale(1)"; setTimeout(() => { d.style.opacity = "0"; d.style.transform = "scale(.6)"; }, 450); };
  });
});
async function tap(p, sel, wait = 700) {
  const el = p.locator(sel).locator("visible=true").first();
  await el.waitFor({ state: "visible" }); await el.scrollIntoViewIfNeeded().catch(() => {});
  const bb = await el.boundingBox();
  if (bb) { await p.evaluate(([x, y]) => window.__tapAt?.(x, y), [bb.x + bb.width / 2, bb.y + bb.height / 2]); await pause(p, 350); }
  await el.tap(); await pause(p, wait);
}
async function type(p, sel, text) { await tap(p, sel, 200); await p.locator(sel).pressSequentially(text, { delay: 35 }); await pause(p, 400); }
const waitText = (p, t) => p.waitForFunction((x) => document.body.innerText.includes(x), t, { timeout: 120000 });
const scrollBy = (p, y) => p.evaluate((y) => scrollBy({ top: y, behavior: "smooth" }), y);

async function paypalApprove(p) {
  // real PayPal sandbox page (English)
  await p.waitForSelector("#email", { timeout: 60000 }); await pause(p, 800);
  await p.locator("#email").pressSequentially(process.env.SANDBOX_BUYER_EMAIL, { delay: 15 });
  const nx = p.locator("#btnNext"); if (await nx.isVisible().catch(() => false)) await nx.click();
  await p.waitForSelector("#password", { state: "visible", timeout: 30000 });
  await p.locator("#password").pressSequentially(process.env.SANDBOX_BUYER_PASSWORD, { delay: 15 });
  await p.click("#btnLogin");
  const btn = p.locator('[data-id="payment-submit-btn"], #payment-submit-btn, button:has-text("Continue"), button:has-text("Agree")').first();
  await btn.waitFor({ timeout: 60000 }); await pause(p, 1800);
  await btn.click(); await p.waitForURL((u) => u.toString().startsWith(BASE), { timeout: 60000 });
}

try {
  // Scene 4: Dina opens a trip and shares the link
  const dina = await person("dina"); await finger(dina);
  await dina.goto(BASE); await pause(dina, 600); dina.mark("s04");
  await type(dina, "#name", "Dina"); await tap(dina, "#hi button"); await waitText(dina, "Trips"); await pause(dina, 700);
  await tap(dina, 'a[href="#/new"]', 900);
  await tap(dina, "#fee", 200); await dina.fill("#fee", ""); await dina.locator("#fee").pressSequentially("100", { delay: 60 });
  await tap(dina, "#go"); await waitText(dina, "Share your trip"); await pause(dina, 1800);
  const invite = await dina.evaluate(() => document.querySelector(".linkbox span").textContent);
  await tap(dina, ".sheet [data-close]"); dina.mark("s04-end");

  // Scene 5: Ayu pastes a TikTok link, AI finds the item; Bima and Citra ask off-camera
  const ayu = await person("ayu"); await finger(ayu);
  await ayu.goto(invite.replace(/^https?:\/\/[^/]+/, BASE)); await pause(ayu, 900); ayu.mark("s05");
  await type(ayu, "#name", "Ayu"); await tap(ayu, "#hi button"); await ayu.waitForSelector("#src");
  await type(ayu, "#src", "tiktok.com/@snackjp/video/7431 matcha kitkat otona big bag");
  await tap(ayu, "#find", 300); await ayu.waitForSelector("#capv", { timeout: 120000 }); await pause(ayu, 1500);
  const now = await ayu.evaluate(() => Number(document.querySelector("#capv").textContent.replace(/[^\d]/g, "")));
  for (let i = 0, s = Math.round((1500 - now) / 100); i < Math.abs(s); i++) await tap(ayu, `.stepper [data-d="${s > 0 ? 1 : -1}"]`, 150);
  await scrollBy(ayu, 220); await pause(ayu, 900); await tap(ayu, '[data-rule="ask"]', 900);
  await tap(ayu, "#send2"); await waitText(ayu, "Waiting for Dina"); await pause(ayu, 1400); ayu.mark("s05-end");

  const quiet = async (name, text, cap, rule) => {
    const ctx = await b.newContext({ viewport: VP, locale: "en-US" }); const p = await ctx.newPage(); p.setDefaultTimeout(120000);
    await p.goto(invite.replace(/^https?:\/\/[^/]+/, BASE)); await p.fill("#name", name); await p.click("#hi button");
    await p.waitForSelector("#src"); await p.fill("#src", text); await p.click("#find"); await p.waitForSelector("#capv");
    const n = await p.evaluate(() => Number(document.querySelector("#capv").textContent.replace(/[^\d]/g, "")));
    for (let i = 0, s = Math.round((cap - n) / 100); i < Math.abs(s); i++) await p.click(`.stepper [data-d="${s > 0 ? 1 : -1}"]`);
    await p.click(`[data-rule="${rule}"]`); await p.locator("#send2").click(); await p.waitForFunction(() => document.body.innerText.includes("Waiting for"));
    p.ctx = ctx; return p;
  };
  const bima = await quiet("Bima", "Tokyo Banana 8 pack", 1800, "ask");
  const citra = await quiet("Citra", "Hada Labo Gokujyun lotion 170ml", 1200, "similar");
  await citra.goto(invite.replace(/^https?:\/\/[^/]+/, BASE)); await citra.fill("#src", "Roihi-tsuboko patches 156"); await citra.click("#find"); await citra.waitForSelector("#capv"); await citra.locator("#send2").click(); await citra.waitForFunction(() => document.body.innerText.includes("Waiting for"));

  // Scene 6: Dina accepts + picks day; Ayu approves the hold on the real PayPal sandbox page
  await dina.reload(); await waitText(dina, "new ask"); await pause(dina, 600); dina.mark("s06");
  await tap(dina, "[data-acceptall]", 1200); await waitText(dina, "Pick shopping day");
  await tap(dina, "[data-day]", 900); await tap(dina, ".sheet [data-primary]", 1200); dina.mark("s06-end");
  await ayu.reload(); await waitText(ayu, "Approve your hold"); await pause(ayu, 700); ayu.mark("s06");
  await tap(ayu, "[data-hold]", 1600); await tap(ayu, ".sheet [data-primary]", 300);
  await paypalApprove(ayu); await waitText(ayu, "Held"); await pause(ayu, 2200); ayu.mark("s06-end");
  // Bima and Citra approve off-camera (same sandbox buyer)
  for (const p of [bima, citra]) {
    await p.reload(); await p.waitForFunction(() => document.body.innerText.includes("Approve your hold"));
    await p.locator("[data-hold]").locator("visible=true").first().click(); await p.locator(".sheet [data-primary]").click();
    await p.waitForURL((u) => !u.toString().startsWith(BASE), { timeout: 60000 });
    const btn = p.locator('[data-id="payment-submit-btn"], #payment-submit-btn, button:has-text("Continue"), button:has-text("Agree")').first();
    if (await p.locator("#email").isVisible().catch(() => false)) { await p.fill("#email", process.env.SANDBOX_BUYER_EMAIL); const nx = p.locator("#btnNext"); if (await nx.isVisible().catch(() => false)) await nx.click(); await p.waitForSelector("#password", { state: "visible" }); await p.fill("#password", process.env.SANDBOX_BUYER_PASSWORD); await p.click("#btnLogin"); }
    await btn.waitFor({ timeout: 60000 }); await btn.click(); await p.waitForURL((u) => u.toString().startsWith(BASE), { timeout: 60000 });
  }
  await citra.goto(`${BASE}/#/`); await citra.waitForTimeout(800);
  const ct = await citra.evaluate(() => document.querySelector("a.trip").getAttribute("href"));
  await citra.goto(BASE + "/" + ct); await citra.waitForFunction(() => document.body.innerText.includes("Approve your hold"));
  await citra.locator("[data-hold]").locator("visible=true").first().click(); await citra.locator(".sheet [data-primary]").click();
  await citra.waitForURL((u) => !u.toString().startsWith(BASE), { timeout: 60000 });
  { const btn = citra.locator('[data-id="payment-submit-btn"], #payment-submit-btn, button:has-text("Continue"), button:has-text("Agree")').first(); await btn.waitFor({ timeout: 60000 }); await btn.click(); await citra.waitForURL((u) => u.toString().startsWith(BASE), { timeout: 60000 }); }

  // Scene 7: shopping, Found, sold out -> swap; Bima accepts
  await dina.reload(); await waitText(dina, "Go shopping"); await pause(dina, 600); dina.mark("s07");
  await tap(dina, "[data-shop]", 1300); await waitText(dina, "in the basket");
  const row = (t) => dina.locator(".jr", { hasText: t });
  const tapIn = async (r, sel, wait = 800) => { const el = r.locator(sel); const bb = await el.boundingBox(); await dina.evaluate(([x, y]) => window.__tapAt?.(x, y), [bb.x + bb.width / 2, bb.y + bb.height / 2]); await pause(dina, 300); await el.tap(); await pause(dina, wait); };
  await tapIn(row("Ayu"), '[data-w="found"]'); await tapIn(row("Hada Labo"), '[data-w="found"]');
  await tapIn(row("Roihi"), "[data-more]"); await tap(dina, '.sheet [data-w="not_found"]', 900);
  await tapIn(row("Bima"), "[data-more]"); await tap(dina, '.sheet [data-w="swap"]', 600);
  await type(dina, "#swt", "Tokyo Banana 4 pack"); await type(dina, "#swp", "648");
  await tap(dina, "#swf .btn", 1200); await waitText(dina, "Waiting for Bima"); dina.mark("s07-end");
  const bv = await person("bima"); await finger(bv);
  await bv.ctx.addCookies(await bima.ctx.cookies());
  await bv.goto(bima.url()); await bv.reload(); await waitText(bv, "sold out"); await pause(bv, 700); bv.mark("s07");
  await tap(bv, "[data-swap]", 1200); await tap(bv, ".sheet [data-primary]", 300); await waitText(bv, "Swap in the basket"); await pause(bv, 1600); bv.mark("s07-end");

  // Scene 8: receipt photo -> AI reads -> plan
  await dina.reload(); await waitText(dina, "Pay at the till"); await pause(dina, 600); dina.mark("s08");
  await tap(dina, "[data-receipt]", 1000); await tap(dina, "#rx-sample", 300);
  await dina.waitForSelector("#rx-go", { timeout: 180000 }); await pause(dina, 1500);
  await dina.evaluate(() => document.querySelector(".sheet").scrollTo({ top: 260, behavior: "smooth" })); await pause(dina, 2200); dina.mark("s08-end");

  // Scene 9: charge; Ayu sees her exact charge
  dina.mark("s09"); await tap(dina, "#rx-go", 300); await waitText(dina, "paid to you"); await pause(dina, 2400); dina.mark("s09-end");
  await ayu.reload(); await waitText(ayu, "Exactly."); await pause(ayu, 800); ayu.mark("s09"); await pause(ayu, 4200); ayu.mark("s09-end");

  // Scene 10: handover
  ayu.mark("s10"); await tap(ayu, "[data-got]", 1200); await tap(ayu, ".sheet [data-primary]", 300); await waitText(ayu, "Delivered"); await pause(ayu, 2500); ayu.mark("s10-end");
  console.log("trip ok");
  for (const p of [bima, citra]) await p.ctx.close();
  // frames -> constant 30 fps mp4 (each frame held until the next one arrives)
  const { execFileSync } = await import("node:child_process");
  for (const p of [dina, ayu, bv]) {
    await p.stopRec(); const fr = p.frames_; const end = (Date.now() - t0[p.who]) / 1000;
    const list = fr.map(([f, t], i) => `file '${f}'\nduration ${((fr[i + 1]?.[1] ?? end) - t).toFixed(4)}`).join("\n") + `\nfile '${fr[fr.length - 1][0]}'\n`;
    writeFileSync(`${p.dir_}/list.txt`, `file '${fr[0][0]}'\nduration ${fr[0][1].toFixed(4)}\n` + list);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${p.dir_}/list.txt`, "-vf", "fps=60,scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:(ow-iw)/2:0:color=white,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", "medium", `${OUT}/${p.who}.mp4`]);
    await p.ctx.close();
  }
} catch (e) { console.log("STOPPED:", e.message.split("\n")[0]); }
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks, null, 1));
await b.close();
