// PayPal Jastip server: zero dependencies (Node 22.5+, built-in sqlite).
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
loadEnv(DIR);
const { openDb, id, now } = await import("./lib/db.mjs");
const { makeTrips, Rule } = await import("./lib/trips.mjs");
const ai = await import("./lib/ai.mjs");
const pp = await import("./lib/paypal.mjs");
const { PLACES, HOMES, toMinor } = await import("./public/js/money.js");

const db = openDb(process.env.DB_FILE || join(DIR, "data", "jastip.db"));
const T = makeTrips(db);
const PORT = Number(process.env.PORT || 5180);
const UPLOADS = join(DIR, "data", "receipts");
await mkdir(UPLOADS, { recursive: true });

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".webmanifest": "application/manifest+json" };

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};
const cookie = (req, k) => (req.headers.cookie || "").split(/;\s*/).map((c) => c.split("=")).find(([a]) => a === k)?.[1];
async function body(req, limit = 8e6) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Rule("Too big", 413); chunks.push(c); }
  const s = Buffer.concat(chunks).toString("utf8");
  return s ? JSON.parse(s) : {};
}
const origin = (req) => process.env.PUBLIC_URL || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;

function me(req) {
  const uid = cookie(req, "jt_uid");
  return uid ? T.user(uid) : null;
}
function needMe(req) { const u = me(req); if (!u) throw new Rule("Sign in first", 401); return u; }
function needTrip(tid) { const t = T.trip(tid); if (!t) throw new Rule("Trip not found", 404); return t; }

const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), fn });

on("GET", "/api/config", () => ({ places: PLACES, homes: HOMES, paypal: pp.paypalReady(), paypalTest: pp.fake(), ai: ai.aiReady(), sandbox: true }));
on("GET", "/api/me", (req) => { const u = me(req); return u ? { user: u, ...T.tripsFor(u) } : { user: null }; });
on("POST", "/api/me", async (req, res) => {
  const b = await body(req);
  const u = T.createUser(b.name);
  res.setHeader("Set-Cookie", `jt_uid=${u.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  return { user: u };
});
on("POST", "/api/switch", async (req, res) => { // demo helper: act as another existing user on this device
  const b = await body(req); const u = T.user(b.id);
  if (!u) throw new Rule("No such user", 404);
  res.setHeader("Set-Cookie", `jt_uid=${u.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  return { user: u };
});

on("POST", "/api/trips", async (req) => {
  const u = needMe(req); const b = await body(req);
  const place = PLACES.find((p) => p.code === b.city_code); const home = HOMES.find((h) => h.code === b.home_code) || HOMES[0];
  if (!place) throw new Rule("Pick a city", 400);
  if (!b.depart || !b.ret || b.ret < b.depart) throw new Rule("Check the dates", 400);
  return { trip: T.createTrip(u, { home: home.city, home_code: home.code, city: place.city, city_code: place.code, currency: place.cur, depart: b.depart, ret: b.ret, fee: toMinor(b.fee || 0, place.cur), payee_email: (b.payee_email || "").trim() || null }) };
});
on("GET", "/api/trips/:tid", (req, _r, p) => T.view(needTrip(p.tid), needMe(req)));
on("GET", "/api/join/:code", (req, _r, p) => {
  const t = T.byInvite(p.code); if (!t) throw new Rule("This invite link is not valid", 404);
  const o = T.user(t.owner_id);
  return { trip: { id: t.id, city: t.city, city_code: t.city_code, home: t.home, home_code: t.home_code, currency: t.currency, depart: t.depart, ret: t.ret, fee: t.fee, status: t.status }, owner: { name: o.name, color: o.color, kept: o.kept } };
});
on("POST", "/api/join/:code/requests", async (req, _r, p) => {
  const t = T.byInvite(p.code); if (!t) throw new Rule("Invalid invite", 404);
  const b = await body(req);
  return { request: T.addRequest(t, needMe(req), { ...b, cap: toMinor(b.cap, t.currency), typical: b.typical ? toMinor(b.typical, t.currency) : null }) };
});
on("POST", "/api/ai/item", async (req) => {
  needMe(req); const b = await body(req);
  if (!ai.aiReady()) return { title: String(b.text).slice(0, 40), detail: "", typical: 0, art: "other", ai: false };
  const r = await ai.readRequest(String(b.text).slice(0, 500), b.currency, b.city);
  return { ...r, ai: true };
});
on("DELETE", "/api/requests/:rid", (req, _r, p) => { const r = T.request(p.rid); if (!r) throw new Rule("Gone", 404); T.withdraw(T.trip(r.trip_id), needMe(req), p.rid); return { ok: true }; });
on("POST", "/api/requests/:rid/decide", async (req, _r, p) => { const r = T.request(p.rid); const b = await body(req); T.decide(needTrip(r?.trip_id), needMe(req), p.rid, !!b.accept); return { ok: true }; });
on("POST", "/api/trips/:tid/day", async (req, _r, p) => { const b = await body(req); T.setShopDay(needTrip(p.tid), needMe(req), b.day); return { ok: true }; });
on("POST", "/api/requests/:rid/hold", async (req, _r, p) => { const r = T.request(p.rid); return T.startHold(needTrip(r?.trip_id), needMe(req), p.rid, origin(req)); });
on("POST", "/api/trips/:tid/shop", (req, _r, p) => { T.startShopping(needTrip(p.tid), needMe(req)); return { ok: true }; });
on("POST", "/api/requests/:rid/mark", async (req, _r, p) => {
  const r = T.request(p.rid); const t = needTrip(r?.trip_id); const b = await body(req);
  T.mark(t, needMe(req), p.rid, b.what, b.swap ? { title: b.swap.title, price: toMinor(b.swap.price, t.currency) } : null); return { ok: true };
});
on("POST", "/api/requests/:rid/swap", async (req, _r, p) => { const r = T.request(p.rid); const b = await body(req); T.answerSwap(needTrip(r?.trip_id), needMe(req), p.rid, !!b.yes); return { ok: true }; });
on("POST", "/api/requests/:rid/delivered", (req, _r, p) => { const r = T.request(p.rid); T.confirmDelivery(needTrip(r?.trip_id), needMe(req), p.rid); return { ok: true }; });

// Receipt: read with AI, return the plan; nothing moves until /settle.
on("POST", "/api/trips/:tid/receipt", async (req, _r, p) => {
  const t = needTrip(p.tid); const u = needMe(req);
  if (t.owner_id !== u.id) throw new Rule("Only the traveller", 403);
  const b = await body(req, 12e6);
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(b.image || "")) throw new Rule("Send a photo", 400);
  const reqs = db.prepare("SELECT * FROM requests WHERE trip_id=? AND status IN ('found','swapped')").all(t.id);
  if (!reqs.length) throw new Rule("Mark at least one item as found first");
  let read;
  if (ai.aiReady()) {
    try { read = await ai.readReceipt(b.image, reqs); }
    catch (e) { T.log(t.id, null, "ai", "Receipt read failed", e.message, 0); throw new Rule("Couldn't read that photo. Try again in better light.", 422); }
  } else throw new Rule("AI is not configured on this server", 503);
  // receipt prices come in normal units; convert to minor units
  const lines = ai.foldDiscounts(read.lines).map((l) => ({ n: l.n, text: String(l.text).slice(0, 80), price: toMinor(l.price, t.currency), disc: !!l.disc }));
  const rid = id(10);
  const file = join(UPLOADS, `${rid}.${b.image.slice(11, 15).replace(/[;b]/g, "")}`);
  await writeFile(file, Buffer.from(b.image.split(",")[1], "base64"));
  db.prepare("INSERT INTO receipts(id,trip_id,image,model,shop,total,lines,matches,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(rid, t.id, file, read.model, String(read.shop || "").slice(0, 60), toMinor(read.total || 0, t.currency), JSON.stringify(lines), JSON.stringify(read.matches || []), now());
  T.log(t.id, null, "ai", "Receipt read", `${lines.length} lines · ${read.model}`);
  const plan = T.planSettlement(t, { lines, matches: read.matches });
  return { receipt: rid, shop: read.shop, lines, plan: plan.map((x) => ({ id: x.r.id, charge: x.charge, line: x.line, why: x.why, over: x.over, hold: x.r.hold, title: x.r.swap_title || x.r.title, friend: T.user(x.r.friend_id).name })) };
});
on("POST", "/api/trips/:tid/settle", async (req, _r, p) => {
  const t = needTrip(p.tid); const u = needMe(req); const b = await body(req);
  const rc = db.prepare("SELECT * FROM receipts WHERE id=? AND trip_id=?").get(b.receipt, t.id);
  if (!rc) throw new Rule("Scan the receipt first", 400);
  const plan = T.planSettlement(t, { lines: JSON.parse(rc.lines), matches: JSON.parse(rc.matches) });
  return { results: await T.settle(t, u, plan, rc.id) };
});

// PayPal returns here after the friend approves the hold.
async function paypalReturn(req, res, url) {
  const rid = url.searchParams.get("r");
  const r = T.request(rid);
  if (!r) return send(res, 302, "", "text/plain"), res.end();
  try { await T.finishHold(rid); res.writeHead(302, { Location: `/#/trip/${r.trip_id}?held=${rid}` }); }
  catch (e) { T.log(r.trip_id, rid, "paypal", "AUTHORIZE failed", e.message, 0); res.writeHead(302, { Location: `/#/trip/${r.trip_id}?holdfail=${rid}` }); }
  res.end();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/paypal/return") return await paypalReturn(req, res, url);
    if (url.pathname === "/paypal/cancel") { const r = T.request(url.searchParams.get("r")); res.writeHead(302, { Location: r ? `/#/trip/${r.trip_id}` : "/" }); return res.end(); }
    if (url.pathname.startsWith("/api/")) {
      for (const rt of routes) {
        if (rt.method !== req.method) continue;
        const m = url.pathname.match(rt.re);
        if (m) return send(res, 200, await rt.fn(req, res, m.groups || {}));
      }
      return send(res, 404, { error: "Not found" });
    }
    let path = join(DIR, "public", decodeURIComponent(url.pathname));
    if (!path.startsWith(join(DIR, "public"))) return send(res, 403, "no", "text/plain");
    if (url.pathname === "/" || !existsSync(path) || !extname(path)) path = join(DIR, "public", "index.html");
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(await readFile(path));
  } catch (e) {
    const code = e instanceof Rule ? e.code : e.status && e.issue ? 502 : 500;
    if (code >= 500) console.error(e);
    send(res, code, { error: e instanceof Rule ? e.message : e.issue ? `PayPal: ${e.issue}` : "Something went wrong" });
  }
});
server.listen(PORT, () => console.log(`Jastip on http://localhost:${PORT}  paypal=${pp.fake() ? "TEST MODE (no real PayPal calls)" : pp.paypalReady()} ai=${ai.aiReady()}`));
export { server, db };
