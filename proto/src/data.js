// Simulation data. Amounts reuse the sandbox spike (30 Oct 2026): ¥1,500 hold -> ¥1,188 capture.
const FRIENDS = [
  { id: "ayu",   name: "Ayu",   city: "Jakarta",  color: "#d6336c", item: "Matcha KitKat, big bag", short: "Matcha KitKat", art: "a-kitkat",   cap: 1500, src: "tiktok.com/@snackjp/video/7431…", fee: 100 },
  { id: "bima",  name: "Bima",  city: "Bandung",  color: "#1c7ed6", item: "Tokyo Banana, 8 pack",   short: "Tokyo Banana 8", art: "a-banana",   cap: 1800, src: "Photo from Instagram story",      fee: 100 },
  { id: "citra", name: "Citra", city: "Surabaya", color: "#7048e8", item: "Hada Labo lotion 170ml", short: "Hada Labo",      art: "a-hadalabo", cap: 1200, src: "shopee.co.id/hada-labo-gokujyun…", fee: 100 },
  { id: "dewi",  name: "Dewi",  city: "Medan",    color: "#0c8599", item: "Roihi patches 156",      short: "Roihi patches",  art: "a-roihi",    cap: 1300, src: "\"koyo jepang yang bulet2\"",        fee: 100 },
];
// What happens in the shop (simulation script, deterministic)
const SHOP = {
  ayu:   { outcome: "found", price: 1188, line: "KITKAT ｵﾄﾅﾉｱﾏｻ 抹茶 大袋" },
  bima:  { outcome: "swap",  want: "Tokyo Banana 8 pack (sold out)", alt: { label: "Tokyo Banana 4 pack", art: "a-banana4", price: 648, line: "東京ﾊﾞﾅﾅ ﾐｴﾀｯﾀ 4個入" } },
  citra: { outcome: "found", price: 968,  line: "ﾊﾀﾞﾗﾎﾞ 極潤 ﾋｱﾙﾛﾝ液 170ml" },
  dewi:  { outcome: "none" },
};
const RECEIPT = {
  shop: "ドン・キホーテ 渋谷本店",
  when: "2026/11/02 18:42",
  others: [{ line: "ﾚｼﾞ袋 L", price: 5 }],
};
const STAGES = [
  { id: "request",  label: "Request",  icon: "i-tag" },
  { id: "hold",     label: "Hold",     icon: "i-lock" },
  { id: "shop",     label: "Shop",     icon: "i-store" },
  { id: "receipt",  label: "Receipt",  icon: "i-receipt" },
  { id: "handover", label: "Handover", icon: "i-qr" },
];
const YEN = (n) => "¥" + Math.round(n).toLocaleString("en-US");
