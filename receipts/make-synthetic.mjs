// Builds SYNTHETIC receipt images for an early signal on receipt matching.
// These are typed by us, not real shop receipts: they test abbreviations, Japanese text,
// tax lines, discounts and decoys, but not real camera blur, folds or thermal fading.
// Real photos go in receipts/cases/ with the same JSON shape and replace these as evidence.
//
// Run: node receipts/make-synthetic.mjs   (needs google-chrome)

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const dir = new URL("./cases/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const yen = (n) => "¥" + n.toLocaleString("en-US");
const rp = (n) => "Rp" + n.toLocaleString("id-ID");

const cases = [
  {
    name: "s1-donki-tax-incl",
    shop: "ドン・キホーテ 渋谷本店", sub: "TEL 03-5428-4086", date: "2026/11/02 18:42", money: yen,
    lines: [
      ["KITKAT ｵﾄﾅﾉｱﾏｻ 抹茶 大袋", 1, 1188],
      ["東京ﾊﾞﾅﾅ ﾐｴﾀｯﾀ 8個入", 1, 1296],
      ["ﾊﾀﾞﾗﾎﾞ 極潤 ﾋｱﾙﾛﾝ液 170ml", 1, 968],
      ["ﾛｲﾋ ﾂﾎﾞｺ 156枚", 1, 1078],
      ["ﾚｼﾞ袋 L", 1, 5],
    ],
    footer: [["小計", 4535], ["(内消費税等 8%)", 268], ["(内消費税等 10%)", 129], ["合計", 4535], ["お預り", 5000], ["お釣り", 465]],
    requests: [
      { id: "r1", friend: "Ayu", text: "Matcha KitKat, the big bag", cap: 1500 },
      { id: "r2", friend: "Bima", text: "Tokyo Banana, 8 pieces", cap: 1800 },
      { id: "r3", friend: "Citra", text: "Hada Labo Gokujyun lotion 170ml", cap: 1200 },
      { id: "r4", friend: "Dewi", text: "Roihi-tsuboko patches 156", cap: 1300 },
      { id: "r5", friend: "Eka", text: "Pocky strawberry", cap: 400 },
    ],
    expected: { r1: 1188, r2: 1296, r3: 968, r4: 1078, r5: null },
  },
  {
    name: "s2-drugstore-discount",
    shop: "マツモトキヨシ 新宿三丁目店", sub: "免税 TAX FREE", date: "2026/11/03 11:05", money: yen,
    lines: [
      ["ﾋﾞｵﾚUV ｱｸｱﾘｯﾁ ｴｯｾﾝｽ 70g", 1, 1078],
      ["  値引 -10%", 1, -108],
      ["ｷｭﾚﾙ 潤浸保湿 ﾌｪｲｽｸﾘｰﾑ 40g", 1, 2680],
      ["ｻﾛﾝﾊﾟｽ 140枚", 1, 1680],
      ["ｲﾌﾞA錠 60錠", 1, 1650],
    ],
    footer: [["小計", 6980], ["免税額", -635], ["合計", 6345]],
    requests: [
      { id: "r1", friend: "Fajar", text: "Biore UV Aqua Rich sunscreen", cap: 1200 },
      { id: "r2", friend: "Gita", text: "Curel face cream", cap: 3000 },
      { id: "r3", friend: "Hana", text: "Salonpas 140 sheets", cap: 1800 },
      { id: "r4", friend: "Indra", text: "Muhi itch cream", cap: 900 },
    ],
    expected: { r1: 970, r2: 2680, r3: 1680, r4: null },
    note: "r1 expected is the line price after the -10% discount printed under it.",
  },
  {
    name: "s3-daiso-decoys",
    shop: "DAISO 原宿店", sub: "", date: "2026/11/03 15:20", money: yen,
    lines: [
      ["ｼﾘｺﾝ ｽﾄﾚｰﾅｰ", 1, 110],
      ["ﾒｲｸﾌﾞﾗｼ ｾｯﾄ", 1, 220],
      ["ﾒｲｸｽﾎﾟﾝｼﾞ 6P", 1, 110],
      ["ﾌﾞﾗｼｸﾘｰﾅｰ", 1, 330],
      ["ｱｲﾌﾟﾁ ﾍｱｸﾘｯﾌﾟ", 1, 110],
    ],
    footer: [["小計", 880], ["合計", 880]],
    requests: [
      { id: "r1", friend: "Joko", text: "makeup brush set", cap: 300 },
      { id: "r2", friend: "Kiki", text: "makeup sponges", cap: 200 },
      { id: "r3", friend: "Lala", text: "brush cleaner", cap: 400 },
      { id: "r4", friend: "Maya", text: "silicone food container", cap: 300 },
    ],
    expected: { r1: 220, r2: 110, r3: 330, r4: null },
    note: "Decoys: 'brush set' vs 'brush cleaner', and a silicone strainer that is not a container.",
  },
  {
    name: "s4-konbini-tax-excl",
    shop: "セブン-イレブン 浅草雷門店", sub: "", date: "2026/11/04 08:12", money: yen,
    lines: [
      ["ﾛｲｽﾞ 生ﾁｮｺﾚｰﾄ ｵｰﾚ", 1, 800],
      ["白い恋人 12枚", 1, 1100],
      ["ｼﾞｬｶﾞﾘｺ ｻﾗﾀﾞ", 2, 300],
    ],
    footer: [["小計(税抜)", 2200], ["消費税 8%", 176], ["合計", 2376]],
    requests: [
      { id: "r1", friend: "Nina", text: "Royce nama chocolate original", cap: 1000 },
      { id: "r2", friend: "Oki", text: "Shiroi Koibito 12", cap: 1300 },
      { id: "r3", friend: "Putri", text: "Jagarico salad x2", cap: 400 },
    ],
    expected: { r1: 800, r2: 1100, r3: 300 },
    note: "Tax is printed separately (8%); the share adds each request's part of it.",
  },
  {
    name: "s5-indonesia-watsons",
    shop: "WATSONS GRAND INDONESIA", sub: "NPWP 01.234.567.8-091.000", date: "02-11-2026 19:30", money: rp,
    lines: [
      ["SKINTIFIC 5X CERAMIDE MOIST 30G", 1, 139000],
      ["WARDAH UV SHIELD SPF50 40ML", 1, 47500],
      ["SOMETHINC NIACINAMIDE SRM 20ML", 1, 115000],
      ["  DISC MEMBER", 1, -11500],
      ["KANTONG BELANJA", 1, 2000],
    ],
    footer: [["SUBTOTAL", 292000], ["PPN TERMASUK", 28935], ["TOTAL", 292000], ["DEBIT BCA", 292000]],
    requests: [
      { id: "r1", friend: "Rani", text: "Skintific ceramide moisturizer", cap: 150000 },
      { id: "r2", friend: "Sari", text: "Wardah sunscreen SPF 50", cap: 60000 },
      { id: "r3", friend: "Tia", text: "Somethinc niacinamide serum", cap: 120000 },
      { id: "r4", friend: "Umi", text: "Emina bright stuff face wash", cap: 30000 },
    ],
    expected: { r1: 139000, r2: 47500, r3: 103500, r4: null },
  },
];

const css = `body{margin:0;background:#cfc9bd;display:flex;justify-content:center;padding:28px}
.r{width:330px;background:#fbfaf6;padding:18px 16px 26px;font:14px/1.45 "IPAGothic","WenQuanYi Zen Hei Mono",monospace;color:#222;
transform:rotate(-1.4deg);box-shadow:0 3px 12px #0005;filter:blur(.35px) contrast(.92)}
h1{font-size:16px;text-align:center;margin:0 0 2px}.c{text-align:center;font-size:12px}
.row{display:flex;justify-content:space-between;gap:8px}.q{color:#555;font-size:12px;padding-left:10px}
hr{border:0;border-top:1px dashed #777;margin:8px 0}.b{font-weight:bold;font-size:16px}`;

for (const c of cases) {
  const rows = c.lines.map(([t, q, p]) =>
    `<div class="row"><span>${t}</span><span>${c.money(p)}</span></div>${q > 1 ? `<div class="q">${q}個 × ${c.money(p / q)}</div>` : ""}`).join("");
  const foot = c.footer.map(([t, v], i) => `<div class="row${t.match(/合計|TOTAL/) ? " b" : ""}"><span>${t}</span><span>${c.money(v)}</span></div>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><div class="r"><h1>${c.shop}</h1>
<div class="c">${c.sub}</div><div class="c">${c.date}</div><hr>${rows}<hr>${foot}<hr><div class="c">レシート / STRUK</div></div>`;
  const htmlPath = join(dir, `${c.name}.html`);
  writeFileSync(htmlPath, html);
  execFileSync("google-chrome", ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--screenshot=${join(dir, c.name + ".png")}`,
    "--window-size=420,760", `file://${htmlPath}`], { stdio: "ignore" });
  const { lines, footer, shop, sub, date, money, ...rest } = c;
  writeFileSync(join(dir, `${c.name}.json`), JSON.stringify({ ...rest, image: `${c.name}.png`, synthetic: true }, null, 2));
  console.log("wrote", c.name);
}
