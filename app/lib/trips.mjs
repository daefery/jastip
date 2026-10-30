// Trip rules. Every money move goes through here; the AI never decides an amount.
//
// Safeguards (each one is checked in test/e2e.mjs):
//  S1  No hold, no shopping: only HELD requests appear on the shopping list.
//  S2  A charge is never more than the hold (cap + fee) and never more than receipt line + fee.
//  S3  A charge needs a receipt line matched to that request; unmatched requests are voided.
//  S4  Friends can withdraw a request only before their hold is approved.
//  S5  The traveller accepts each request before anyone is asked for a hold.
//  S6  A new friend (no completed handover) can hold at most NEW_FRIEND_USD in total.
//  S7  One capture per hold (idempotent PayPal-Request-Id + status check).
//  S8  Swaps need the friend's tap, and a swap above the cap is refused.
import { id, now } from "./db.mjs";
import * as pp from "./paypal.mjs";
import { fmt, usd, CUSTOMS_USD, NEW_FRIEND_USD } from "../public/js/money.js";

const COLORS = ["#ff2d55", "#007aff", "#af52de", "#34c759", "#ff9500", "#5ac8fa", "#ff3b30", "#5856d6"];
export class Rule extends Error { constructor(msg, code = 409) { super(msg); this.code = code; } }

export function makeTrips(db) {
  const q = (sql) => db.prepare(sql);
  const one = (sql, ...a) => q(sql).get(...a);
  const all = (sql, ...a) => q(sql).all(...a);
  const run = (sql, ...a) => q(sql).run(...a);
  const log = (trip, req, kind, label, detail = "", ok = 1) =>
    run("INSERT INTO events(trip_id,request_id,kind,label,detail,ok,created_at) VALUES(?,?,?,?,?,?,?)", trip, req, kind, kind === "paypal" && pp.fake() ? `${label} (test mode)` : label, String(detail).slice(0, 300), ok ? 1 : 0, now());

  const user = (uid) => one("SELECT * FROM users WHERE id=?", uid);
  const trip = (tid) => one("SELECT * FROM trips WHERE id=?", tid);
  const request = (rid) => one("SELECT * FROM requests WHERE id=?", rid);

  function createUser(name) {
    const n = String(name || "").trim().slice(0, 24);
    if (!n) throw new Rule("Name needed", 400);
    const u = { id: id(14), name: n, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
    run("INSERT INTO users(id,name,color,created_at) VALUES(?,?,?,?)", u.id, u.name, u.color, now());
    return user(u.id);
  }

  function createTrip(owner, t) {
    const tid = id(10);
    run(`INSERT INTO trips(id,owner_id,home,home_code,city,city_code,currency,depart,ret,fee,payee_email,invite,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, tid, owner.id, t.home, t.home_code, t.city, t.city_code, t.currency, t.depart, t.ret,
      Math.max(0, Math.round(t.fee || 0)), t.payee_email || null, id(8), now());
    log(tid, null, "trip", "Trip opened", `${t.home_code} → ${t.city_code}`);
    return trip(tid);
  }

  const isOwner = (t, u) => t.owner_id === u.id;
  const holdOf = (t, r) => r.cap + t.fee;

  function addRequest(t, friend, r) {
    if (isOwner(t, friend)) throw new Rule("You can't ask your own trip");
    if (t.status !== "open" && t.status !== "holds") throw new Rule("This trip is not taking requests now");
    const cap = Math.round(r.cap);
    if (!(cap > 0)) throw new Rule("Set a max price", 400);
    const rid = id(10);
    run(`INSERT INTO requests(id,trip_id,friend_id,title,detail,source,art,typical,cap,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      rid, t.id, friend.id, String(r.title).slice(0, 60), (r.detail || "").slice(0, 60), (r.source || "").slice(0, 300), r.art || "other", r.typical || null, cap, now());
    log(t.id, rid, "trip", `${friend.name} asked`, r.title);
    return request(rid);
  }

  function withdraw(t, friend, rid) { // S4
    const r = request(rid);
    if (!r || r.friend_id !== friend.id) throw new Rule("Not your request", 403);
    if (!["asked", "accepted", "declined"].includes(r.status)) throw new Rule("Your hold is approved. It can't be cancelled, but if Dina doesn't find it, it is released.".replace("Dina", user(t.owner_id).name));
    run("DELETE FROM requests WHERE id=?", rid);
    log(t.id, rid, "trip", `${friend.name} withdrew`, r.title);
  }

  function decide(t, owner, rid, accept) { // S5
    if (!isOwner(t, owner)) throw new Rule("Only the traveller decides", 403);
    const r = request(rid);
    if (!r || r.trip_id !== t.id || !["asked", "accepted", "declined"].includes(r.status)) throw new Rule("Can't change this request");
    run("UPDATE requests SET status=? WHERE id=?", accept ? "accepted" : "declined", rid);
  }

  function setShopDay(t, owner, day) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    if (!all("SELECT id FROM requests WHERE trip_id=? AND status='accepted'", t.id).length) throw new Rule("Accept at least one request first");
    run("UPDATE trips SET shop_day=?, status='holds' WHERE id=?", day, t.id);
    log(t.id, null, "trip", "Shopping day set", day);
  }

  function heldUsd(t, friend) {
    // across all trips, holds that are still open for a friend who has never completed a handover
    const rows = all(`SELECT r.hold, t.currency FROM requests r JOIN trips t ON t.id=r.trip_id
                      WHERE r.friend_id=? AND r.status IN ('held','found','swap_asked','swapped')`, friend.id);
    return rows.reduce((s, x) => s + usd(x.hold, x.currency), 0);
  }

  async function startHold(t, friend, rid, origin) {
    const r = request(rid);
    if (!r || r.friend_id !== friend.id || r.trip_id !== t.id) throw new Rule("Not your request", 403);
    if (r.status === "held") return { already: true };
    if (r.status !== "accepted") throw new Rule(r.status === "asked" ? "Waiting for the traveller to accept" : "This request can't be held");
    if (t.status !== "holds") throw new Rule("The traveller hasn't set a shopping day yet");
    const hold = holdOf(t, r);
    if ((user(friend.id).kept || 0) === 0 && heldUsd(t, friend) + usd(hold, t.currency) > NEW_FRIEND_USD) // S6
      throw new Rule(`New friends can hold up to $${NEW_FRIEND_USD} until their first handover`);
    if (!pp.paypalReady()) throw new Rule("PayPal is not configured on this server", 503);
    const traveller = user(t.owner_id);
    const o = await pp.createHold({
      requestId: r.id, amount: hold, cur: t.currency, title: r.title, travellerName: traveller.name, payeeEmail: t.payee_email,
      returnUrl: `${origin}/paypal/return?r=${r.id}`, cancelUrl: `${origin}/paypal/cancel?r=${r.id}`,
    });
    run("UPDATE requests SET order_id=?, hold=? WHERE id=?", o.orderId, hold, r.id);
    log(t.id, r.id, "paypal", "CREATE ORDER · AUTHORIZE", `${friend.name} · ${fmt(hold, t.currency)}`);
    return { approve: o.approve };
  }

  async function finishHold(rid) {
    const r = request(rid);
    if (!r?.order_id) throw new Rule("No PayPal order", 400);
    if (r.status === "held") return r;
    const t = trip(r.trip_id);
    const a = await pp.authorizeOrder(r.order_id);
    run("UPDATE requests SET auth_id=?, status='held', authorized_at=? WHERE id=?", a.authId, now(), r.id);
    log(t.id, r.id, "paypal", "AUTHORIZE", `${user(r.friend_id).name} · ${fmt(r.hold, t.currency)} · ${a.status}`);
    return request(r.id);
  }

  function startShopping(t, owner) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    run("UPDATE trips SET status='shopping' WHERE id=?", t.id);
    // accepted requests that were never held are dropped from the list (S1)
    run("UPDATE requests SET status='released' WHERE trip_id=? AND status IN ('asked','accepted')", t.id);
  }

  function mark(t, owner, rid, what, swap) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    const r = request(rid);
    if (!r || r.trip_id !== t.id) throw new Rule("Unknown request", 404);
    if (!["held", "found", "swap_asked", "not_found", "swapped"].includes(r.status)) throw new Rule("Only held requests can be marked"); // S1
    if (t.status !== "shopping") throw new Rule("Start shopping first");
    if (what === "found") run("UPDATE requests SET status='found', swap_title=NULL, swap_price=NULL WHERE id=?", rid);
    if (what === "held") run("UPDATE requests SET status='held', swap_title=NULL, swap_price=NULL WHERE id=?", rid);
    if (what === "not_found") run("UPDATE requests SET status='not_found' WHERE id=?", rid);
    if (what === "swap") {
      const price = Math.round(swap?.price || 0);
      if (!swap?.title || !(price > 0)) throw new Rule("Swap needs a name and price", 400);
      if (price > r.cap) throw new Rule(`Over ${user(r.friend_id).name}'s max (${fmt(r.cap, t.currency)})`); // S8
      run("UPDATE requests SET status='swap_asked', swap_title=?, swap_price=? WHERE id=?", swap.title.slice(0, 60), price, rid);
      log(t.id, rid, "trip", "Swap asked", `${swap.title} · ${fmt(price, t.currency)}`);
    }
  }

  function answerSwap(t, friend, rid, yes) {
    const r = request(rid);
    if (!r || r.friend_id !== friend.id || r.status !== "swap_asked") throw new Rule("No swap to answer");
    run("UPDATE requests SET status=? WHERE id=?", yes ? "swapped" : "not_found", rid);
    log(t.id, rid, "trip", yes ? `${friend.name} took the swap` : `${friend.name} skipped the swap`, r.swap_title);
  }

  // Receipt: AI result in, code decides every share (S2, S3).
  function planSettlement(t, read) {
    const lines = read.lines || [];
    const byN = new Map(lines.map((l) => [l.n, l]));
    const reqs = all("SELECT * FROM requests WHERE trip_id=? AND status IN ('found','swapped','held','swap_asked','not_found')", t.id);
    const usedLines = new Set();
    return reqs.map((r) => {
      const m = (read.matches || []).find((x) => x.request_id === r.id);
      const line = m?.line_n != null ? byN.get(m.line_n) : null;
      const can = (r.status === "found" || r.status === "swapped") && line && !usedLines.has(line.n) && line.price > 0;
      if (!can) return { r, line: null, charge: 0, why: r.status === "not_found" ? "not found" : r.status === "swap_asked" ? "swap not answered" : line ? "line already used" : "not on receipt" };
      usedLines.add(line.n);
      const limit = r.status === "swapped" ? r.swap_price : r.cap;
      const item = Math.min(line.price, limit);
      const charge = item + t.fee;
      return { r, line, charge: Math.min(charge, r.hold), over: line.price > limit, confidence: m.confidence };
    });
  }

  async function settle(t, owner, plan, receiptId) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    const out = [];
    for (const p of plan) {
      const r = request(p.r.id);
      if (!r.auth_id || ["settled", "released", "delivered"].includes(r.status)) { out.push({ id: r.id, skip: true }); continue; } // S7
      const friend = user(r.friend_id);
      try {
        if (p.charge > 0) {
          const c = await pp.capture(r.auth_id, p.charge, t.currency, `${p.line.text} + jastip fee`);
          run("UPDATE requests SET status='settled', capture_id=?, charged=?, released=?, line_text=?, price=?, captured_at=? WHERE id=?",
            c.captureId, p.charge, r.hold - p.charge, p.line.text, p.line.price, now(), r.id);
          log(t.id, r.id, "paypal", "CAPTURE", `${friend.name} · ${fmt(p.charge, t.currency)} of ${fmt(r.hold, t.currency)} · ${c.status}`);
          out.push({ id: r.id, charged: p.charge });
        } else {
          await pp.voidHold(r.auth_id);
          run("UPDATE requests SET status='released', charged=0, released=? WHERE id=?", r.hold, r.id);
          log(t.id, r.id, "paypal", "VOID", `${friend.name} · ${fmt(r.hold, t.currency)} released · ${p.why}`);
          out.push({ id: r.id, released: r.hold });
        }
      } catch (e) {
        log(t.id, r.id, "paypal", "FAILED", `${friend.name} · ${e.message}`, 0);
        out.push({ id: r.id, error: e.message });
      }
    }
    run("UPDATE trips SET status='settled' WHERE id=?", t.id);
    if (receiptId) log(t.id, null, "trip", "Receipt settled", receiptId);
    return out;
  }

  function confirmDelivery(t, friend, rid) {
    const r = request(rid);
    if (!r || r.friend_id !== friend.id || r.status !== "settled") throw new Rule("Nothing to confirm");
    run("UPDATE requests SET status='delivered', delivered_at=? WHERE id=?", now(), rid);
    run("UPDATE users SET kept=kept+1 WHERE id IN (?,?)", friend.id, t.owner_id);
    log(t.id, rid, "trip", `${friend.name} got the item`, r.line_text || r.title);
  }

  function customs(t) {
    const rows = all("SELECT charged, price, cap, status, hold FROM requests WHERE trip_id=? AND status NOT IN ('declined','released','asked')", t.id);
    const used = rows.reduce((s, x) => s + usd(x.charged ?? x.cap, t.currency), 0);
    return { usd: Math.round(used), limit: CUSTOMS_USD };
  }

  // What one viewer may see.
  function view(t, viewer) {
    const owner = user(t.owner_id);
    const mine = isOwner(t, viewer);
    const reqs = all("SELECT * FROM requests WHERE trip_id=? ORDER BY created_at", t.id).map((r) => {
      const f = user(r.friend_id);
      return { ...r, friend: { id: f.id, name: f.name, color: f.color, kept: f.kept }, hold_needed: holdOf(t, r), order_id: undefined, mineReq: r.friend_id === viewer.id };
    }).filter((r) => mine || r.mineReq);
    const events = all("SELECT * FROM events WHERE trip_id=? ORDER BY id DESC LIMIT 40", t.id)
      .filter((e) => mine || !e.request_id || reqs.some((r) => r.id === e.request_id));
    const receipt = one("SELECT id,shop,total,lines,matches,model,created_at FROM receipts WHERE trip_id=? ORDER BY created_at DESC LIMIT 1", t.id);
    return {
      trip: { ...t, payee_email: mine ? t.payee_email : undefined, invite: mine ? t.invite : undefined },
      owner: { id: owner.id, name: owner.name, color: owner.color, kept: owner.kept },
      mine, requests: reqs, events, customs: customs(t),
      receipt: receipt ? { ...receipt, lines: JSON.parse(receipt.lines), matches: JSON.parse(receipt.matches) } : null,
    };
  }

  const tripsFor = (u) => ({
    mine: all("SELECT * FROM trips WHERE owner_id=? ORDER BY created_at DESC", u.id),
    joined: all("SELECT DISTINCT t.* FROM trips t JOIN requests r ON r.trip_id=t.id WHERE r.friend_id=? ORDER BY t.created_at DESC", u.id)
      .map((t) => ({ ...t, invite: undefined, payee_email: undefined, owner: user(t.owner_id)?.name })),
  });

  return { user, trip, request, createUser, createTrip, addRequest, withdraw, decide, setShopDay, startHold, finishHold, startShopping, mark, answerSwap, planSettlement, settle, confirmDelivery, view, tripsFor, log, byInvite: (code) => one("SELECT * FROM trips WHERE invite=?", code) };
}
