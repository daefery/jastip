// Renders the title cards (1920x1080 PNG) from video/cards.html.
import { chromium } from "../app/node_modules/playwright-core/index.mjs";
const OUT = process.argv[2] || "/tmp/vid/cards";
import { mkdirSync } from "node:fs"; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const c of ["c1", "c2", "c3", "c11"]) {
  await p.goto(new URL(`cards.html#${c}`, import.meta.url).href); await p.reload(); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${c}.png` });
}
await b.close(); console.log("ok");
