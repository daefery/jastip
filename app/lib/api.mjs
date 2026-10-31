// HTTP API as a fetch handler (Request -> Response). Used by the Cloudflare Worker and by the Node dev server.
import { makeTrips, Rule } from "./trips.mjs";
import * as ai from "./ai.mjs";
import * as pp from "./paypal.mjs";
import { id } from "./db.mjs";
import { env } from "./env.mjs";
import { PLACES, HOMES, toMinor } from "../public/js/money.js";

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const cookieOf = (req, k) => (req.headers.get("cookie") || "").split(/;\s*/).map((c) => c.split("=")).find(([a]) => a === k)?.[1];
const secure = (req) => new URL(req.url).protocol === "https:" ? "; Secure" : "";
const setSid = (req, sid) => ({ "Set-Cookie": `jt_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure(req)}` });
// Demo switching (one device acting as several people) only when the server says so (DEMO_SWITCH=1).
// Fee is checked as typed, before rounding to minor units (so -0.1 is refused, not rounded to 0).
const feeOf = (v, cur) => {
  const n = v === "" || v == null ? 0 : Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Rule("Fee must be zero or more", 400);
  return toMinor(n, cur);
};
const demoSwitch = () => env("DEMO_SWITCH") === "1";

export function makeApi(db, { saveImage } = {}) {
  const T = makeTrips(db);
  const routes = [];
  const on = (method, pattern, fn) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), fn });

  const newSession = async (uid) => { const sid = id(32); await db.run("INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)", sid, uid, Date.now()); return sid; };
  const me = async (req) => {
    const sid = cookieOf(req, "jt_sid"); if (!sid) return null;
    const row = await db.get("SELECT user_id FROM sessions WHERE token=?", sid);
    return row ? T.user(row.user_id) : null;
  };
  const needMe = async (req) => { const u = await me(req); if (!u) throw new Rule("Sign in first", 401); return u; };
  const needTrip = async (tid) => { const t = tid ? await T.trip(tid) : null; if (!t) throw new Rule("Trip not found", 404); return t; };
  const tripOfReq = async (rid) => { const r = await T.request(rid); if (!r) throw new Rule("Request not found", 404); return needTrip(r.trip_id); };
  const body = async (req, limit = 8e6) => { const s = await req.text(); if (s.length > limit) throw new Rule("Too big", 413); return s ? JSON.parse(s) : {}; };
  const origin = (req) => env("PUBLIC_URL") || new URL(req.url).origin;

  on("GET", "/api/config", () => ({ places: PLACES, homes: HOMES, paypal: pp.paypalReady(), paypalTest: pp.fake(), ai: ai.aiReady(), aiModel: ai.aiName(), sandbox: true, demoSwitch: demoSwitch() }));
  on("GET", "/api/me", async (req) => { const u = await me(req); return u ? { user: u, ...(await T.tripsFor(u)) } : { user: null }; });
  on("POST", "/api/me", async (req) => { const u = await T.createUser((await body(req)).name); return json({ user: u }, 200, setSid(req, await newSession(u.id))); });
  on("POST", "/api/me/avatar", async (req) => ({ user: await T.setAvatar(await needMe(req), (await body(req)).avatar) }));
  on("POST", "/api/switch", async (req) => {
    if (!demoSwitch()) throw new Rule("Not available", 404);
    const cur = await needMe(req); const b = await body(req);
    const u = await T.user(b.id); if (!u) throw new Rule("No such user", 404);
    // only people who share a trip with the current person
    const shared = await db.get(`SELECT 1 AS x FROM trips t LEFT JOIN requests r ON r.trip_id=t.id
      WHERE (t.owner_id=? OR r.friend_id=?) AND (t.owner_id=? OR r.friend_id=?) LIMIT 1`, cur.id, cur.id, u.id, u.id);
    if (!shared && u.id !== cur.id) throw new Rule("No such user", 404);
    return json({ user: u }, 200, setSid(req, await newSession(u.id)));
  });

  on("POST", "/api/trips", async (req) => {
    const u = await needMe(req); const b = await body(req);
    const place = PLACES.find((p) => p.code === b.city_code); const home = HOMES.find((h) => h.code === b.home_code) || HOMES[0];
    if (!place) throw new Rule("Pick a city", 400);
    if (!b.depart || !b.ret || b.ret < b.depart) throw new Rule("Check the dates", 400);
    return { trip: await T.createTrip(u, { home: home.city, home_code: home.code, city: place.city, city_code: place.code, currency: place.cur, depart: b.depart, ret: b.ret, fee: feeOf(b.fee, place.cur), payee_email: (b.payee_email || "").trim() || null }) };
  });
  on("GET", "/api/trips/:tid", async (req, p) => T.view(await needTrip(p.tid), await needMe(req)));
  on("GET", "/api/join/:code", async (_req, p) => {
    const t = await T.byInvite(p.code); if (!t) throw new Rule("This invite link is not valid", 404);
    const o = await T.user(t.owner_id);
    return { trip: { id: t.id, city: t.city, city_code: t.city_code, home: t.home, home_code: t.home_code, currency: t.currency, depart: t.depart, ret: t.ret, fee: t.fee, status: t.status }, owner: { id: o.id, name: o.name, color: o.color, avatar: o.avatar, kept: o.kept } };
  });
  on("POST", "/api/join/:code/requests", async (req, p) => {
    const t = await T.byInvite(p.code); if (!t) throw new Rule("Invalid invite", 404);
    const b = await body(req);
    return { request: await T.addRequest(t, await needMe(req), { ...b, cap: toMinor(b.cap, t.currency), typical: b.typical ? toMinor(b.typical, t.currency) : null }) };
  });
  on("POST", "/api/ai/item", async (req) => {
    await needMe(req); const b = await body(req);
    if (!ai.aiReady()) return { title: String(b.text).slice(0, 40), detail: "", typical: 0, art: "other", ai: false };
    try { return { ...(await ai.readRequest(String(b.text).slice(0, 500), b.currency, b.city)), ai: true }; }
    catch { return { title: String(b.text).replace(/https?:\/\/\S+/g, "").trim().slice(0, 40) || "Item", detail: "", typical: 0, art: "other", ai: false }; }
  });
  on("DELETE", "/api/requests/:rid", async (req, p) => { await T.withdraw(await tripOfReq(p.rid), await needMe(req), p.rid); return { ok: true }; });
  on("POST", "/api/requests/:rid/decide", async (req, p) => { const b = await body(req); await T.decide(await tripOfReq(p.rid), await needMe(req), p.rid, !!b.accept, !!b.vouch); return { ok: true }; });
  on("POST", "/api/trips/:tid/day", async (req, p) => { await T.setShopDay(await needTrip(p.tid), await needMe(req), (await body(req)).day); return { ok: true }; });
  on("POST", "/api/requests/:rid/hold", async (req, p) => T.startHold(await tripOfReq(p.rid), await needMe(req), p.rid, origin(req)));
  on("POST", "/api/trips/:tid/shop", async (req, p) => { await T.startShopping(await needTrip(p.tid), await needMe(req)); return { ok: true }; });
  on("POST", "/api/requests/:rid/mark", async (req, p) => {
    const t = await tripOfReq(p.rid); const b = await body(req);
    await T.mark(t, await needMe(req), p.rid, b.what, b.swap ? { title: b.swap.title, price: toMinor(b.swap.price, t.currency) } : null); return { ok: true };
  });
  on("POST", "/api/requests/:rid/swap", async (req, p) => { await T.answerSwap(await tripOfReq(p.rid), await needMe(req), p.rid, !!(await body(req)).yes); return { ok: true }; });
  on("POST", "/api/requests/:rid/delivered", async (req, p) => { await T.confirmDelivery(await tripOfReq(p.rid), await needMe(req), p.rid); return { ok: true }; });

  // Receipt: AI reads, code plans; nothing moves until /settle.
  on("POST", "/api/trips/:tid/receipt", async (req, p) => {
    const t = await needTrip(p.tid); const u = await needMe(req);
    if (t.owner_id !== u.id) throw new Rule("Only the traveller", 403);
    if (t.status !== "shopping") throw new Rule("Scan the receipt while shopping");
    const b = await body(req, 12e6);
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(b.image || "")) throw new Rule("Send a photo", 400);
    const reqs = await T.markable(t.id);
    if (!reqs.length) throw new Rule("Mark at least one item as found first");
    if (!ai.aiReady()) throw new Rule("AI is not configured on this server", 503);
    let read;
    try { read = await ai.readReceipt(b.image, reqs); }
    catch (e) {
      await T.log(t.id, null, "ai", "Receipt read failed", e.message.slice(0, 280), 0);
      if (e instanceof ai.AiBusy) throw new Rule("The receipt reader has hit today's limit. Try again in a few hours; your holds stay in place.", 503);
      throw new Rule("Couldn't read that photo. Try again, with the whole receipt flat and in good light.", 422);
    }
    const lines = ai.foldDiscounts(read.lines).map((l) => ({ n: l.n, text: String(l.text).slice(0, 80), price: toMinor(l.price, t.currency), disc: !!l.disc }));
    const rid = id(10);
    const image = saveImage ? await saveImage(rid, b.image) : null;
    await T.saveReceipt({ id: rid, trip_id: t.id, image, model: read.model, shop: String(read.shop || "").slice(0, 60), total: toMinor(read.total || 0, t.currency), lines: JSON.stringify(lines), matches: JSON.stringify(read.matches || []) });
    await T.log(t.id, null, "ai", "Receipt read", `${lines.length} lines · ${read.model}`);
    const t2 = await T.trip(t.id); // the revision this plan is built from; settle must match it
    const plan = await T.planSettlement(t2, { lines, matches: read.matches });
    const names = new Map();
    for (const x of plan) if (!names.has(x.r.friend_id)) names.set(x.r.friend_id, (await T.user(x.r.friend_id)).name);
    return { receipt: rid, rev: t2.rev, shop: read.shop, lines, plan: plan.map((x) => ({ id: x.r.id, charge: x.charge, line: x.line, why: x.why, over: x.over, hold: x.r.hold, title: x.r.swap_title || x.r.title, friend: names.get(x.r.friend_id) })) };
  });
  on("POST", "/api/trips/:tid/finish", async (req, p) => ({ results: await T.finishEmpty(await needTrip(p.tid), await needMe(req)) }));
  on("POST", "/api/trips/:tid/retry", async (req, p) => ({ results: await T.retry(await needTrip(p.tid), await needMe(req)) }));
  on("POST", "/api/trips/:tid/settle", async (req, p) => {
    const t = await needTrip(p.tid); const u = await needMe(req); const b = await body(req);
    const rc = await T.receipt(b.receipt, t.id);
    if (!rc) throw new Rule("Scan the receipt first", 400);
    if (!Number.isInteger(b.rev)) throw new Rule("Review the charges first", 400);
    const plan = await T.planSettlement(t, { lines: JSON.parse(rc.lines), matches: JSON.parse(rc.matches) });
    return { results: await T.settle(t, u, plan, rc.id, b.rev) };
  });

  async function paypalReturn(url) {
    const rid = url.searchParams.get("r");
    const r = rid ? await T.request(rid) : null;
    if (!r) return Response.redirect(new URL("/", url).toString(), 302);
    try { await T.finishHold(rid); return Response.redirect(new URL(`/#/trip/${r.trip_id}?held=${rid}`, url).toString(), 302); }
    catch (e) { await T.log(r.trip_id, rid, "paypal", "AUTHORIZE failed", e.message, 0); return Response.redirect(new URL(`/#/trip/${r.trip_id}?holdfail=${rid}&why=${encodeURIComponent(e instanceof Rule ? e.message : "PayPal didn't approve the hold")}`, url).toString(), 302); }
  }

  // Returns a Response for API/PayPal routes, or null so the caller serves static files.
  return async function handle(req) {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/paypal/return") return await paypalReturn(url);
      if (url.pathname === "/paypal/cancel") { const r = await T.request(url.searchParams.get("r")); return Response.redirect(new URL(r ? `/#/trip/${r.trip_id}` : "/", url).toString(), 302); }
      if (!url.pathname.startsWith("/api/")) return null;
      for (const rt of routes) {
        if (rt.method !== req.method) continue;
        const m = url.pathname.match(rt.re);
        if (!m) continue;
        const out = await rt.fn(req, m.groups || {});
        return out instanceof Response ? out : json(out);
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      const code = e instanceof Rule ? e.code : e.status && e.issue ? 502 : 500;
      if (code >= 500) console.error(e);
      return json({ error: e instanceof Rule ? e.message : e.issue ? `PayPal: ${e.issue}` : "Something went wrong" }, code);
    }
  };
}
