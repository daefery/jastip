// Edits the demo video: title cards + real app footage on a framed background, narration per scene,
// burned-in captions. Inputs: /tmp/vid/clips (record.mjs), /tmp/vid/vo/*.wav (narration), cards.html.
//   node video/build.mjs  ->  /tmp/vid/jastip-demo.mp4
import { chromium } from "../app/node_modules/playwright-core/index.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const V = "/tmp/vid", W = "/tmp/vid/work"; mkdirSync(W, { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const lines = Object.fromEntries(JSON.parse(readFileSync(`${V}/lines.json`, "utf8")));

// Scene list. card = title card; app = [clip, from, to] pieces (seconds in that clip), side text.
const S = [
  { n: "01", card: "c1" },
  { n: "02", card: "c2" },
  { n: "03", card: "c3" },
  { n: "04", step: "1 · Traveller", cap: "Open a trip,<br>share one link", sub: "Dina is flying to Tokyo.", app: [["dina", 0.49999999999999994, 10.08]] },
  { n: "05", step: "2 · Friend", cap: "Paste a link.<br>AI finds it.", sub: "Item, variant and a typical Tokyo price. Ayu sets her max and what to do if it's sold out.", tag: "AI · Gemma 4 on Workers AI", app: [["ayu", 0.97, 17.4]] },
  { n: "06", step: "3 · PayPal hold", cap: "Approve a hold.<br>¥0 charged.", sub: "Max + fee, approved on the real PayPal sandbox by an Indonesian buyer, in yen.", tag: "PayPal Orders v2 · AUTHORIZE", app: [["dina", 31.97, 36.63], ["ayu", 27.27, 46.0]] },
  { n: "07", step: "4 · Shopping", cap: "Found, sold out,<br>or a swap", sub: "Bima okays a smaller pack from his phone. A swap can never go over his max.", app: [["dina", 90.49, 101.39], ["bima", 0.85, 4.88]] },
  { n: "08", step: "5 · One receipt", cap: "AI reads it.<br>Code sets the money.", sub: "Every Japanese line, matched to a friend. Charge = line + fee, never above the hold.", tag: "AI reads · code decides", app: [["dina", 107.03, 118.32]] },
  { n: "09", step: "6 · Exact charge", cap: "Paid ¥1,288.<br>Exactly.", sub: "Partial capture of each hold. The hold for the item not found is voided.", tag: "PayPal Payments v2 · CAPTURE|PayPal · VOID", app: [["dina", 118.32, 129.63], ["ayu", 118.86, 122.07]] },
  { n: "10", step: "7 · Handover", cap: "I got my item", sub: "A delivery record for both sides.", app: [["ayu", 122.07, 126.97]] },
  { n: "11", card: "c11" },
];

// 1. Render frames (cards + side panels) at 1920x1080.
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" });
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const page = async (hash, out) => { await pg.goto(new URL(`cards.html#${hash}`, import.meta.url).href); await pg.reload(); await pg.waitForTimeout(400); await pg.screenshot({ path: out }); };
for (const s of S) {
  if (s.card) await page(s.card, `${W}/${s.n}.png`);
  else await page(`frame?${new URLSearchParams({ step: s.step, cap: s.cap, sub: s.sub, tag: s.tag || "" })}`, `${W}/${s.n}.png`);
}
await b.close();

// Rounded-corner mask for the phone screen (380x822, radius 44).
{
  const pm = await (await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" })).newPage({ viewport: { width: 380, height: 822 } });
  await pm.setContent(`<body style="margin:0;background:#000"><div style="width:380px;height:822px;border-radius:44px;background:#fff"></div></body>`);
  await pm.screenshot({ path: `${W}/mask.png` }); await pm.context().browser().close();
}

// 2. One segment per scene: video length = narration length (+ breath), footage sped/slowed to fit.
const segs = [];
for (const s of S) {
  const vo = `${V}/vo/${s.n}.wav`, out = `${W}/seg-${s.n}.mp4`;
  const raw0 = s.app ? s.app.reduce((t, [, a, z]) => t + (z - a), 0) : 0;
  const d = Math.max(dur(vo) + 0.25, raw0 / 1.45); s.d = d;
  if (s.card) {
    ff(["-loop", "1", "-t", String(d), "-i", `${W}/${s.n}.png`, "-i", vo,
      "-filter_complex", `[0]scale=1920:1080,zoompan=z='min(1.0+0.0004*on,1.04)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,format=yuv420p[v]`,
      "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", String(d), out]);
  } else {
    // concat the footage pieces, then stretch to d
    const parts = s.app.map(([c, a, z], i) => `[${i}:v]trim=start=${a}:end=${z},setpts=PTS-STARTPTS,fps=30,scale=380:822[p${i}]`);
    const raw = s.app.reduce((t, [, a, z]) => t + (z - a), 0);
    const k = d / raw; // >1 slows down, <1 speeds up
    const fc = `${parts.join(";")};${s.app.map((_, i) => `[p${i}]`).join("")}concat=n=${s.app.length}:v=1:a=0,setpts=${k.toFixed(4)}*PTS,format=rgba[ph0];` +
      `[${s.app.length + 2}:v]format=gray,scale=380:822[mk];[ph0][mk]alphamerge[ph];` +
      `[${s.app.length}:v]scale=1920:1080[bg];[bg][ph]overlay=x=1258:y=30:shortest=0,format=yuv420p[v]`;
    ff([...s.app.flatMap(([c]) => ["-i", `${V}/clips/${c}.mp4`]), "-loop", "1", "-i", `${W}/${s.n}.png`, "-i", vo, "-loop", "1", "-i", `${W}/mask.png`,
      "-filter_complex", fc, "-map", "[v]", "-map", `${s.app.length + 1}:a`, "-af", "apad", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", String(d), out]);
    console.log(s.n, `footage ${raw.toFixed(1)}s -> ${d.toFixed(1)}s (x${(1 / k).toFixed(2)} speed)`);
  }
  segs.push(out);
}

// 3. Captions (SRT) from the narration, one cue per sentence, timed by character share.
let t = 0, srt = "", i = 1;
const ts = (x) => { const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s2 = Math.floor(x % 60), ms = Math.round((x % 1) * 1000); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")},${String(ms).padStart(3, "0")}`; };
for (const s of S) {
  const d = s.d, speak = dur(`${V}/vo/${s.n}.wav`) - 0.15 - 0.35;
  const parts = lines[s.n].match(/[^.!?]+[.!?]+/g).map((x) => x.trim());
  const total = parts.reduce((a, p) => a + p.length, 0); let at = t + 0.15;
  for (const p of parts) { const len = speak * p.length / total; srt += `${i++}\n${ts(at)} --> ${ts(at + len)}\n${p}\n\n`; at += len; }
  t += d;
}
writeFileSync(`${W}/captions.srt`, srt);

// 4. Join + burn captions.
writeFileSync(`${W}/list.txt`, segs.map((f) => `file '${f}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", `${W}/list.txt`, "-c", "copy", `${W}/joined.mp4`]);
ff(["-i", `${W}/joined.mp4`, "-vf", `subtitles=${W}/captions.srt:force_style='FontName=DejaVu Sans,FontSize=14,PrimaryColour=&H00202020,BackColour=&H00FFFFFF,BorderStyle=4,Outline=0,Shadow=0,MarginV=8,MarginL=40,MarginR=40,Alignment=2,Bold=0'`,
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-ac", "2", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", `${V}/jastip-demo.mp4`]);
console.log("done", dur(`${V}/jastip-demo.mp4`).toFixed(1), "s");
