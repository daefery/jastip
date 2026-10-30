// Time the AI parts on the live site: request lookup and receipt read (no PayPal approval needed:
// the receipt step only needs found items, so holds are skipped by reading the plan endpoint's error path is not used;
// instead this calls the AI item endpoint and the receipt endpoint through a trip in shopping state is not reachable
// without holds). So: time /api/ai/item 5x, and run the receipt spike against Workers AI through the binding-equivalent REST.
const BASE = process.env.BASE || "https://jastip.feryyp-work.workers.dev";
let cookie = "";
const call = async (path, body) => {
  const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  return r.json();
};
await call("/api/me", { name: "Timer" });
const texts = ["https://www.tiktok.com/@snackjp/video/7431 matcha kitkat big bag", "koyo jepang yang bulet2", "Hada Labo gokujyun lotion", "Tokyo banana 8 pcs", "shiroi koibito 12"];
for (const t of texts) {
  const t0 = Date.now(); const r = await call("/api/ai/item", { text: t, currency: "JPY", city: "Tokyo" });
  console.log(`${String(Date.now() - t0).padStart(5)} ms  ai=${r.ai}  ${r.title} | ${r.detail} | ~${r.typical}`);
}
