// AI budget on the free tier: cache, per-person limit, sample receipt with stored lines.
// Test-mode server: scripts/serve.sh 5181 fake && node --no-warnings test/ai-budget.mjs
import { readFileSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:5181";
const res = []; const ok = (c, w, x = "") => { res.push(!!c); console.log(`${c ? "PASS" : "FAIL"}  ${w}${x ? "  " + x : ""}`); };
const client = () => { let c = ""; return async (p, body) => { const r = await fetch(BASE + p, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Cookie: c }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" }); const sc = r.headers.get("set-cookie"); if (sc) c = sc.split(";")[0]; return { status: r.status, ...(await r.json().catch(() => ({}))) }; }; };
const d = (k) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);
const tm = async (fn) => { const t0 = Date.now(); const r = await fn(); return [r, Date.now() - t0]; };

// 1. item lookup: second identical ask is served from cache
const u = client(); await u("/api/me", { name: "Budget" });
const q = { text: "shiroi koibito 12 pieces " + Date.now(), currency: "JPY", city: "Tokyo" };
const [a1, t1] = await tm(() => u("/api/ai/item", q)); const [a2, t2] = await tm(() => u("/api/ai/item", q));
ok(a1.ai && a2.ai && a1.title === a2.title && t2 < 300 && t2 < t1 / 3, "same item text: second answer from cache", `${t1} ms -> ${t2} ms`);

// 2. per-person limit: past 20 lookups in an hour, the app still answers (plain text, no AI)
const v = client(); await v("/api/me", { name: "Spammer" });
let plain = 0; for (let i = 0; i < 22; i++) { const r = await v("/api/ai/item", { text: `zz-nonexistent-${i}-${Date.now()}`, currency: "JPY", city: "Tokyo" }); if (r.ai === false) plain++; if (i < 20 && r.ai === false && i > 0) break; }
ok(plain >= 2, "over 20 lookups an hour: still answers, without AI", `${plain} plain answers`);

// 3. sample receipt: stored lines (exact), asks matched; same scan again = cached, no AI
const dina = client(), f = client(); await dina("/api/me", { name: "Dina" }); await f("/api/me", { name: "Ayu" });
const { trip } = await dina("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: 100 });
const inv = (await dina(`/api/trips/${trip.id}`)).trip.invite;
const r1 = (await f(`/api/join/${inv}/requests`, { title: "Matcha KitKat big bag", cap: 1500 })).request;
const r2 = (await f(`/api/join/${inv}/requests`, { title: "Royce nama chocolate", cap: 900 })).request;
for (const r of [r1, r2]) await dina(`/api/requests/${r.id}/decide`, { accept: true });
await dina(`/api/trips/${trip.id}/day`, { day: "Mon" });
for (const r of [r1, r2]) { const h = await f(`/api/requests/${r.id}/hold`, {}); await fetch(h.approve, { redirect: "manual" }); }
await dina(`/api/trips/${trip.id}/shop`, {}); for (const r of [r1, r2]) await dina(`/api/requests/${r.id}/mark`, { what: "found" });
const img = "data:image/png;base64," + readFileSync(new URL("../public/sample/receipt.png", import.meta.url)).toString("base64");
const [s1, ts1] = await tm(() => dina(`/api/trips/${trip.id}/receipt`, { image: img }));
const by = Object.fromEntries((s1.plan || []).map((p) => [p.id, p]));
ok(s1.lines?.length === 5 && s1.lines.reduce((a, l) => a + l.price, 0) === 2959, "sample receipt: the 5 stored lines, sum ¥2,959", s1.error || "");
ok(by[r1.id]?.charge === 1288 && !by[r2.id]?.charge, "sample: KitKat ¥1,188 + ¥100, Royce released", JSON.stringify([by[r1.id]?.charge, by[r2.id]?.why]));
const [s2, ts2] = await tm(() => dina(`/api/trips/${trip.id}/receipt`, { image: img }));
ok(s2.plan?.length === s1.plan.length && ts2 < 400, "same scan again: answered from cache", `${ts1} ms -> ${ts2} ms`);
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
