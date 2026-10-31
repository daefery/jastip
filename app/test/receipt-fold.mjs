// How receipt lines become chargeable lines (code, not AI). Lines as Gemma 4 read a real drugstore
// receipt photo on 31 Oct 2026 (coupon under each item, quantity notes as 0-price lines).
import { foldDiscounts } from "../lib/ai.mjs";
const res = []; const ok = (c, w, x = "") => { res.push(!!c); console.log(`${c ? "PASS" : "FAIL"}  ${w}${x ? "  " + x : ""}`); };
const gemma = [[1,"437デオシートキュウシ",1790],[2,"クーポン値引",-110],[3,"404キッチン泡ハイターツ",290],[4,"クーポン値引",-40],[5,"405ドメストオカイドク",206],[6,"クーポン値引",-20],
  [7,"401ビオレu泡HS無香",1455],[8,"（ 3点 X ¥485）",0],[9,"クーポン値引",-210],[10,"405レック水の激落ちくん",338],[11,"クーポン値引",-10],[12,"400クリニカホワイトシト",292],[13,"クーポン値引",-20],
  [14,"401ビオレu泡HS替増量",970],[15,"（ 2点 X ¥485）",0],[16,"クーポン値引",-140],[17,"小計 10点",4791],[18,"合計",4791],[19,"(内、消費税等",435],[20,"現金",10001],[21,"お釣",5210]].map(([n, text, price]) => ({ n, text, price }));
const f = foldDiscounts(gemma); const by = Object.fromEntries(f.map((l) => [l.n, l.price]));
ok(by[7] === 1245, "Biore 1455 - coupon 210 = 1245 (coupon skips the 0-price quantity note)", by[7]);
ok(by[14] === 830, "Biore refill 970 - 140 = 830", by[14]);
ok(by[3] === 250 && by[12] === 272, "Haiter 250, Clinica 272");
ok(f.length === 7 && f.reduce((s, l) => s + l.price, 0) === 4791, "7 item lines, sum = printed total 4,791", f.length + " / " + f.reduce((s, l) => s + l.price, 0));
ok(!f.some((l) => /小計|合計|消費税|現金|お釣|3点/.test(l.text)), "totals, tax, cash, change and quantity notes are never chargeable");
const topup = foldDiscounts([{ n: 1, text: "チャージ", price: 1000 }, { n: 2, text: "現計", price: 1000 }, { n: 3, text: "お釣り", price: 0 }]);
ok(topup.length === 1 && topup[0].text === "チャージ", "card top-up slip: cash total and change dropped");
ok(foldDiscounts([{ n: 1, text: "DISC", price: -50 }, { n: 2, text: "Pocky", price: 200 }]).length === 1, "a discount with no item above is ignored, not applied to the next item");
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
