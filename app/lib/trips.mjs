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
import * as paypal from "./paypal.mjs";
import { fmt, usd, CUSTOMS_USD, NEW_FRIEND_USD, OUTSTANDING } from "../public/js/money.js";
const OUT_SQL = `(${OUTSTANDING.map((x) => `'${x}'`).join(",")})`;

const COLORS = ["#ff2d55", "#007aff", "#af52de", "#34c759", "#ff9500", "#5ac8fa", "#ff3b30", "#5856d6"];
export class Rule extends Error { constructor(msg, code = 409) { super(msg); this.code = code; } }

export function makeTrips(db, pp = paypal) {
  const one = (sql, ...a) => db.get(sql, ...a);
  const all = (sql, ...a) => db.all(sql, ...a);
  const run = (sql, ...a) => db.run(sql, ...a);
  const log = (trip, req, kind, label, detail = "", ok = 1) =>
    run("INSERT INTO events(trip_id,request_id,kind,label,detail,ok,created_at) VALUES(?,?,?,?,?,?,?)", trip, req ?? null, kind,
      kind === "paypal" && pp.fake() ? `${label} (test mode)` : label, String(detail).slice(0, 300), ok ? 1 : 0, now());

  const user = (uid) => one("SELECT * FROM users WHERE id=?", uid);
  const trip = (tid) => one("SELECT * FROM trips WHERE id=?", tid);
  const request = (rid) => one("SELECT * FROM requests WHERE id=?", rid);
  const nameOf = async (uid) => (await user(uid))?.name || "Someone";

  async function createUser(name) {
    const n = String(name || "").trim().slice(0, 24);
    if (!n) throw new Rule("Name needed", 400);
    const uid = id(14);
    await run("INSERT INTO users(id,name,color,created_at) VALUES(?,?,?,?)", uid, n, COLORS[Math.floor(Math.random() * COLORS.length)], now());
    return user(uid);
  }

  async function createTrip(owner, t) {
    if (!Number.isFinite(t.fee) || t.fee < 0) throw new Rule("Fee must be zero or more", 400);
    if (t.payee_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.payee_email)) throw new Rule("That PayPal email doesn't look right", 400);
    const tid = id(10);
    await run(`INSERT INTO trips(id,owner_id,home,home_code,city,city_code,currency,depart,ret,fee,payee_email,invite,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, tid, owner.id, t.home, t.home_code, t.city, t.city_code, t.currency, t.depart, t.ret,
      Math.max(0, Math.round(t.fee || 0)), t.payee_email || null, id(8), now());
    await log(tid, null, "trip", "Trip opened", `${t.home_code} → ${t.city_code}`);
    return trip(tid);
  }

  const isOwner = (t, u) => t.owner_id === u.id;
  const holdOf = (t, r) => r.cap + t.fee;

  async function addRequest(t, friend, r) {
    if (isOwner(t, friend)) throw new Rule("You can't ask your own trip");
    if (t.status !== "open" && t.status !== "holds") throw new Rule("This trip is not taking requests now");
    const cap = Math.round(r.cap);
    if (!(cap > 0)) throw new Rule("Set a max price", 400);
    const rid = id(10);
    const rule = ["ask", "similar", "skip"].includes(r.rule) ? r.rule : "ask";
    await run(`INSERT INTO requests(id,trip_id,friend_id,title,detail,source,art,typical,cap,rule,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      rid, t.id, friend.id, String(r.title).slice(0, 60), (r.detail || "").slice(0, 60), (r.source || "").slice(0, 300), r.art || "other", r.typical || null, cap, rule, now());
    await log(t.id, rid, "trip", `${friend.name} asked`, r.title);
    return request(rid);
  }

  async function withdraw(t, friend, rid) { // S4
    const r = await request(rid);
    if (!r || r.friend_id !== friend.id) throw new Rule("Not your request", 403);
    if (!["asked", "accepted", "declined"].includes(r.status))
      throw new Rule(`Your hold is approved. It can't be cancelled, but if ${await nameOf(t.owner_id)} doesn't find it, it is released.`);
    // With a PayPal order open, the row stays (as 'withdrawn') so an approval that lands later still
    // has a record to release against. Without an order nothing can be authorized, so it's deleted.
    const ok = r.order_id
      ? await run("UPDATE requests SET status='withdrawn' WHERE id=? AND status IN ('asked','accepted','declined') AND auth_id IS NULL", rid)
      : await run("DELETE FROM requests WHERE id=? AND status IN ('asked','accepted','declined') AND order_id IS NULL", rid);
    if (!ok.changes) throw new Rule("PayPal just approved your hold, so it can't be withdrawn now");
    await log(t.id, rid, "trip", `${friend.name} withdrew`, r.title);
  }

  async function decide(t, owner, rid, accept) { // S5
    if (!isOwner(t, owner)) throw new Rule("Only the traveller decides", 403);
    const r = await request(rid);
    if (!r || r.trip_id !== t.id || !["asked", "accepted", "declined"].includes(r.status)) throw new Rule("Can't change this request");
    const ok = await run(`UPDATE requests SET status=? WHERE id=? AND status IN ('asked','accepted','declined')
      AND EXISTS (SELECT 1 FROM trips WHERE id=? AND status IN ('open','holds'))`, accept ? "accepted" : "declined", rid, t.id);
    if (!ok.changes) throw new Rule("Shopping has already started");
  }

  async function setShopDay(t, owner, day) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    if (!(await all("SELECT id FROM requests WHERE trip_id=? AND status='accepted'", t.id)).length) throw new Rule("Accept at least one request first");
    const ok = await run("UPDATE trips SET shop_day=?, status='holds' WHERE id=? AND status IN ('open','holds')", String(day).slice(0, 40), t.id);
    if (!ok.changes) throw new Rule("Shopping has already started");
    await log(t.id, null, "trip", "Shopping day set", day);
  }

  async function heldUsd(friend) {
    const rows = await all(`SELECT r.hold, t.currency FROM requests r JOIN trips t ON t.id=r.trip_id
                      WHERE r.friend_id=? AND r.auth_id IS NOT NULL AND r.status IN ${OUT_SQL}`, friend.id);
    return rows.reduce((s, x) => s + usd(x.hold, x.currency), 0);
  }

  async function startHold(t, friend, rid, origin) {
    const r = await request(rid);
    if (!r || r.friend_id !== friend.id || r.trip_id !== t.id) throw new Rule("Not your request", 403);
    if (r.status === "held") return { already: true };
    if (r.status !== "accepted") throw new Rule(r.status === "asked" ? "Waiting for the traveller to accept" : "This request can't be held");
    if (t.status !== "holds") throw new Rule("The traveller hasn't set a shopping day yet");
    const hold = holdOf(t, r);
    const fresh = await user(friend.id);
    if ((fresh.kept || 0) === 0 && (await heldUsd(friend)) + usd(hold, t.currency) > NEW_FRIEND_USD) // S6
      throw new Rule(`New friends can hold up to $${NEW_FRIEND_USD} until their first handover`);
    if (!pp.paypalReady()) throw new Rule("PayPal is not configured on this server", 503);
    const o = await pp.createHold({
      requestId: r.id, amount: hold, cur: t.currency, title: r.title, travellerName: await nameOf(t.owner_id), payeeEmail: t.payee_email,
      returnUrl: `${origin}/paypal/return?r=${r.id}`, cancelUrl: `${origin}/paypal/cancel?r=${r.id}`,
    });
    await run("UPDATE requests SET order_id=?, hold=? WHERE id=?", o.orderId, hold, r.id);
    await log(t.id, r.id, "paypal", "CREATE ORDER · AUTHORIZE", `${friend.name} · ${fmt(hold, t.currency)}`);
    return { approve: o.approve };
  }

  async function finishHold(rid) {
    const r = await request(rid);
    if (!r?.order_id) throw new Rule("No PayPal order", 400);
    if (r.auth_id) return r; // already authorized (a repeated PayPal return)
    const t = await trip(r.trip_id);
    // Only an accepted ask on a trip still collecting holds may be authorized. If it's too late,
    // the approved order is never authorized, so no money is held.
    if (r.status !== "accepted" || t.status !== "holds") throw new Rule("Too late: shopping already started, so nothing was held");
    const a = await pp.authorizeOrder(r.order_id);
    const fname = await nameOf(r.friend_id);
    const won = await run(`UPDATE requests SET auth_id=?, status='held', authorized_at=? WHERE id=? AND status='accepted' AND auth_id IS NULL
      AND EXISTS (SELECT 1 FROM trips WHERE id=? AND status='holds')`, a.authId, now(), r.id, t.id);
    if (won.changes) {
      await log(t.id, r.id, "paypal", "AUTHORIZE", `${fname} · ${fmt(r.hold, t.currency)} · ${a.status}`);
      return request(r.id);
    }
    const cur = await request(r.id);
    if (cur?.auth_id === a.authId) return cur; // a parallel return attached this same authorization: fine
    const why = cur?.status === "withdrawn" ? "withdrawn while PayPal was approving" : "approved after shopping started";
    if (!cur) { // no row left to record it on: release right away and say so honestly
      try { await pp.voidHold(a.authId); } catch (e) { await log(t.id, r.id, "paypal", "FAILED", `${fname} · void ${a.authId} · ${e.message}`, 0); throw new Rule("PayPal approved a hold we no longer need and hasn't confirmed its release. Contact the traveller."); }
      throw new Rule("Too late: this ask is gone. PayPal released the hold, nothing was charged.");
    }
    // Save the authorization as an open 'void' step and reopen a finished trip, in one transaction,
    // before talking to PayPal again. Whatever fails after this, the step stays visible and retryable.
    await db.batch([
      [`UPDATE requests SET status='releasing', auth_id=?, authorized_at=?, plan_op='void', plan_charge=0, plan_why=? WHERE id=? AND auth_id IS NULL`, a.authId, now(), why, r.id],
      ["UPDATE trips SET status='settling' WHERE id=? AND status='settled'", t.id],
    ]);
    await log(t.id, r.id, "paypal", "AUTHORIZE", `${fname} · ${fmt(r.hold, t.currency)} · ${why}`).catch(() => {});
    const done = await runPlan(await trip(t.id), r.id);
    const owner = await nameOf(t.owner_id);
    if (done[0]?.error) throw new Rule(`${why === "approved after shopping started" ? "Too late: shopping already started." : "Withdrawn."} PayPal hasn't confirmed the release yet. ${owner} can retry it from the trip.`);
    throw new Rule(`${why === "approved after shopping started" ? "Too late: shopping already started." : "Withdrawn."} PayPal released the hold, nothing was charged.`);
  }

  async function startShopping(t, owner) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    if (!(await all("SELECT id FROM requests WHERE trip_id=? AND status='held'", t.id)).length) throw new Rule("No approved holds yet");
    // One-way holds -> shopping, in one transaction. S1: asks without an approved hold are left out
    // ("dropped": nothing was held, so nothing is "released").
    const [moved] = await db.batch([
      ["UPDATE trips SET status='shopping' WHERE id=? AND status='holds'", t.id],
      ["UPDATE requests SET status='dropped' WHERE trip_id=? AND status IN ('asked','accepted') AND EXISTS (SELECT 1 FROM trips WHERE id=? AND status='shopping')", t.id, t.id],
    ]);
    if (!moved.changes) throw new Rule("Shopping has already started");
  }

  async function mark(t, owner, rid, what, swap) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    const r = await request(rid);
    if (!r || r.trip_id !== t.id) throw new Rule("Unknown request", 404);
    if (!["held", "found", "swap_asked", "not_found", "swapped"].includes(r.status)) throw new Rule("Only held requests can be marked"); // S1
    if (t.status !== "shopping" || r.plan_op) throw new Rule("Shopping is over for this trip");
    // every change re-checks, inside the same statement, that shopping is still on and no step is saved
    // and bumps the trip's revision with it, so a receipt plan made before this change can't be charged
    const live = "AND plan_op IS NULL AND EXISTS (SELECT 1 FROM trips WHERE id=? AND status='shopping')";
    const bump = ["UPDATE trips SET rev=rev+1 WHERE id=? AND status='shopping'", t.id];
    const change = async (sql, ...a) => { const [x] = await db.batch([[sql, ...a], bump]); if (!x.changes) throw new Rule("Shopping is over for this trip"); };
    if (what === "found") await change(`UPDATE requests SET status='found', swap_title=NULL, swap_price=NULL WHERE id=? ${live}`, rid, t.id);
    if (what === "held") await change(`UPDATE requests SET status='held', swap_title=NULL, swap_price=NULL WHERE id=? ${live}`, rid, t.id);
    if (what === "not_found") await change(`UPDATE requests SET status='not_found' WHERE id=? ${live}`, rid, t.id);
    if (what === "swap") {
      const price = Math.round(swap?.price || 0);
      if (!swap?.title || !(price > 0)) throw new Rule("Swap needs a name and price", 400);
      if (price > r.cap) throw new Rule(`Over ${await nameOf(r.friend_id)}'s max (${fmt(r.cap, t.currency)})`); // S8
      if (r.rule === "skip") throw new Rule(`${await nameOf(r.friend_id)} asked to skip if it's sold out. Mark it Not here.`);
      const auto = r.rule === "similar";
      await change(`UPDATE requests SET status='${auto ? "swapped" : "swap_asked"}', swap_title=?, swap_price=? WHERE id=? ${live}`, swap.title.slice(0, 60), price, rid, t.id);
      await log(t.id, rid, "trip", auto ? "Swap taken (similar ok)" : "Swap asked", `${swap.title} · ${fmt(price, t.currency)}`);
    }
  }

  async function answerSwap(t, friend, rid, yes) {
    const r = await request(rid);
    if (!r || r.friend_id !== friend.id || r.status !== "swap_asked") throw new Rule("No swap to answer");
    const [ok] = await db.batch([
      [`UPDATE requests SET status=? WHERE id=? AND status='swap_asked' AND plan_op IS NULL
        AND EXISTS (SELECT 1 FROM trips WHERE id=? AND status='shopping')`, yes ? "swapped" : "not_found", rid, t.id],
      ["UPDATE trips SET rev=rev+1 WHERE id=? AND status='shopping'", t.id],
    ]);
    if (!ok.changes) throw new Rule("Too late to change this item: its release is already planned.");
    await log(t.id, rid, "trip", yes ? `${friend.name} took the swap` : `${friend.name} skipped the swap`, r.swap_title);
  }

  // Receipt: AI result in, code decides every share (S2, S3).
  async function planSettlement(t, read) {
    const lines = read.lines || [];
    const byN = new Map(lines.map((l) => [l.n, l]));
    const reqs = await all("SELECT * FROM requests WHERE trip_id=? AND status IN ('found','swapped','held','swap_asked','not_found')", t.id);
    const used = new Set();
    return reqs.map((r) => {
      const m = (read.matches || []).find((x) => x.request_id === r.id);
      const line = m?.line_n != null ? byN.get(m.line_n) : null;
      const can = (r.status === "found" || r.status === "swapped") && line && !used.has(line.n) && line.price > 0;
      if (!can) return { r, line: null, charge: 0, why: r.status === "not_found" ? "not found" : r.status === "swap_asked" ? "swap not answered" : line ? "line already used" : "not on receipt" };
      used.add(line.n);
      const limit = r.status === "swapped" ? r.swap_price : r.cap;
      const charge = Math.min(Math.min(line.price, limit) + t.fee, r.hold);
      return { r, line, charge, over: line.price > limit, confidence: m.confidence };
    });
  }

  // Settlement in two steps. 1) The confirmed plan is saved on each request (capture amount or void),
  // once, while the trip is still shopping. 2) The saved operations run. A retry runs the same saved
  // operations again for the ones PayPal didn't confirm, so a retry can never change who pays what.
  const OPEN = OUT_SQL;
  // rev: the trip revision the plan was built from (the one the traveller reviewed). If anything on the
  // list changed since, nothing is saved and the traveller has to look at the new plan.
  async function settle(t, owner, plan, receiptId, rev = t.rev) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    if (t.status !== "shopping") throw new Rule(t.status === "settling" ? "Payments already started. Use Retry." : "This trip is already settled");
    // One transaction: lock the trip (shopping -> settling, tagged with a fresh settle id) and save every
    // step. Steps only apply under that settle id, so a failed save leaves nothing, and a second tap
    // or a stale tab can't save a second plan.
    const sid = id(12);
    const tx = [["UPDATE trips SET status='settling', receipt_id=?, settle_id=? WHERE id=? AND status='shopping' AND rev=?", receiptId, sid, t.id, rev]];
    for (const p of plan) {
      tx.push([`UPDATE requests SET plan_op=?, plan_charge=?, plan_why=?, line_text=?, price=? WHERE id=? AND trip_id=? AND plan_op IS NULL AND status IN ${OPEN}
        AND EXISTS (SELECT 1 FROM trips WHERE id=? AND settle_id=?)`,
        p.charge > 0 ? "capture" : "void", p.charge > 0 ? p.charge : 0, p.why || null, p.line?.text || null, p.line?.price ?? null, p.r.id, t.id, t.id, sid]);
    }
    tx.push([`UPDATE requests SET status='dropped' WHERE trip_id=? AND status IN ('asked','accepted') AND EXISTS (SELECT 1 FROM trips WHERE id=? AND settle_id=?)`, t.id, t.id, sid]);
    const [lock] = await db.batch(tx);
    if (!lock.changes) {
      const now2 = await trip(t.id);
      throw new Rule(now2.status === "shopping" ? "The list changed since you checked the receipt. Scan or review it again." : "Payments already started");
    }
    if (receiptId) await log(t.id, null, "trip", "Receipt confirmed", receiptId);
    return runPlan(await trip(t.id));
  }

  async function retry(t, owner) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    // Retry is driven by open saved steps, not by the trip phase: a late approval can need releasing
    // while the trip is still collecting holds, shopping, or (after a race) marked settled.
    const openSteps = await one(`SELECT COUNT(*) AS n FROM requests WHERE trip_id=? AND status IN ${OPEN} AND plan_op IS NOT NULL`, t.id);
    if (!openSteps.n && t.status !== "settling") throw new Rule("Nothing to retry");
    if (t.status === "settled") await run("UPDATE trips SET status='settling' WHERE id=? AND status='settled'", t.id);
    const phase = (await trip(t.id)).status;
    const unplanned = phase === "settling" ? await all(`SELECT id FROM requests WHERE trip_id=? AND status IN ${OPEN} AND auth_id IS NOT NULL AND plan_op IS NULL`, t.id) : [];
    if (unplanned.length) throw new Rule(`${unplanned.length} item(s) have no saved payment step. Check them in PayPal before retrying.`);
    return runPlan(t);
  }

  // Runs saved steps that are still open (all of the trip's, or one request's).
  async function runPlan(t, onlyRid) {
    const todo = await all(`SELECT * FROM requests WHERE trip_id=? AND status IN ${OPEN} AND plan_op IS NOT NULL${onlyRid ? " AND id=?" : ""} ORDER BY created_at`, ...(onlyRid ? [t.id, onlyRid] : [t.id]));
    const out = [];
    for (const r of todo) {
      const fname = await nameOf(r.friend_id);
      try {
        if (r.plan_op === "capture") {
          const c = await pp.capture(r.auth_id, r.plan_charge, t.currency, `${r.line_text} + jastip fee`); // same idempotency key every try (S7)
          await run(`UPDATE requests SET status='settled', capture_id=?, charged=?, released=?, captured_at=? WHERE id=? AND status IN ${OPEN}`, c.captureId, r.plan_charge, r.hold - r.plan_charge, now(), r.id);
          await log(t.id, r.id, "paypal", "CAPTURE", `${fname} · ${fmt(r.plan_charge, t.currency)} of ${fmt(r.hold, t.currency)} · ${c.status}`);
          out.push({ id: r.id, charged: r.plan_charge });
        } else {
          await pp.voidHold(r.auth_id);
          await run(`UPDATE requests SET status='released', charged=0, released=? WHERE id=? AND status IN ${OPEN}`, r.hold, r.id);
          await log(t.id, r.id, "paypal", "VOID", `${fname} · ${fmt(r.hold, t.currency)} released · ${r.plan_why || "not bought"}`);
          out.push({ id: r.id, released: r.hold });
        }
      } catch (e) {
        await log(t.id, r.id, "paypal", "FAILED", `${fname} · ${r.plan_op} · ${e.message}`, 0);
        out.push({ id: r.id, error: e.message, op: r.plan_op });
      }
    }
    await completeIfDone(t.id);
    return out;
  }

  // settling -> settled only if no request is still outstanding, checked inside the same statement
  // (a separate count could go stale while a late approval saves a new step).
  async function completeIfDone(tid) {
    const s2 = await run(`UPDATE trips SET status='settled' WHERE id=? AND status='settling'
      AND NOT EXISTS (SELECT 1 FROM requests WHERE trip_id=? AND status IN ${OPEN})`, tid, tid);
    if (s2.changes) await log(tid, null, "trip", "Trip settled", "").catch(() => {});
  }

  // Nothing bought (every item not found): void all holds, no receipt needed.
  async function finishEmpty(t, owner) {
    if (!isOwner(t, owner)) throw new Rule("Only the traveller", 403);
    if (t.status !== "shopping") throw new Rule(t.status === "settling" ? "Payments already started. Use Retry." : "Nothing to finish");
    const open = await all("SELECT id FROM requests WHERE trip_id=? AND status IN ('held','found','swap_asked','swapped')", t.id);
    if (open.length) throw new Rule("Some items are still in the basket or waiting. Scan the receipt instead.");
    const plan = (await all("SELECT * FROM requests WHERE trip_id=? AND status='not_found'", t.id)).map((r) => ({ r, line: null, charge: 0, why: "not found" }));
    return settle(t, owner, plan, null);
  }

  async function confirmDelivery(t, friend, rid) {
    const r = await request(rid);
    if (!r || r.friend_id !== friend.id || r.status !== "settled") throw new Rule("Nothing to confirm");
    await run("UPDATE requests SET status='delivered', delivered_at=? WHERE id=?", now(), rid);
    await run("UPDATE users SET kept=kept+1 WHERE id IN (?,?)", friend.id, t.owner_id);
    await log(t.id, rid, "trip", `${friend.name} got the item`, r.line_text || r.title);
  }

  // Goods value for the duty-free check. Before the receipt: friends' max prices (an upper estimate).
  // After the receipt is confirmed: the receipt prices of what was bought (fees are not goods).
  async function customs(t) {
    const rows = await all("SELECT status, cap, price, plan_op FROM requests WHERE trip_id=? AND status NOT IN ('declined','asked','dropped','accepted','releasing','withdrawn')", t.id);
    const fromReceipt = ["settling", "settled"].includes(t.status);
    const goods = rows.reduce((s, x) => {
      if (fromReceipt) return s + (x.plan_op === "capture" || ["settled", "delivered"].includes(x.status) ? x.price || 0 : 0);
      return s + (x.status === "not_found" || x.status === "released" ? 0 : x.cap);
    }, 0);
    return { usd: Math.round(usd(goods, t.currency)), limit: CUSTOMS_USD, basis: fromReceipt ? "receipt" : "max" };
  }

  async function canSee(t, viewer) {
    if (isOwner(t, viewer)) return true;
    return !!(await one("SELECT 1 AS x FROM requests WHERE trip_id=? AND friend_id=? AND status<>'withdrawn' LIMIT 1", t.id, viewer.id));
  }

  async function view(t, viewer) {
    if (!(await canSee(t, viewer))) throw new Rule("Trip not found", 404);
    const owner = await user(t.owner_id);
    const mine = isOwner(t, viewer);
    const raw = await all("SELECT * FROM requests WHERE trip_id=? AND status<>'withdrawn' ORDER BY created_at", t.id);
    const people = new Map();
    for (const r of raw) if (!people.has(r.friend_id)) people.set(r.friend_id, await user(r.friend_id));
    const reqs = raw.map((r) => {
      const f = people.get(r.friend_id);
      return { ...r, friend: { id: f.id, name: f.name, color: f.color, kept: f.kept }, hold_needed: holdOf(t, r), order_id: undefined, mineReq: r.friend_id === viewer.id };
    }).filter((r) => mine || r.mineReq);
    const events = (await all("SELECT * FROM events WHERE trip_id=? ORDER BY id DESC LIMIT 40", t.id))
      .filter((e) => mine || !e.request_id || reqs.some((r) => r.id === e.request_id));
    const receipt = await one("SELECT id,shop,total,lines,matches,model,created_at FROM receipts WHERE trip_id=? ORDER BY created_at DESC LIMIT 1", t.id);
    return {
      trip: { ...t, payee_email: mine ? t.payee_email : undefined, invite: mine ? t.invite : undefined },
      owner: { id: owner.id, name: owner.name, color: owner.color, kept: owner.kept },
      mine, requests: reqs, events, customs: await customs(t),
      receipt: receipt && mine ? { ...receipt, lines: JSON.parse(receipt.lines), matches: JSON.parse(receipt.matches) } : null,
    };
  }

  async function summary(t, friendId) {
    const rs = await all(`SELECT status, hold, charged, released, cap, plan_op, plan_charge FROM requests WHERE trip_id=? AND status<>'withdrawn'${friendId ? " AND friend_id=?" : ""}`, ...(friendId ? [t.id, friendId] : [t.id]));
    const held = rs.filter((r) => OUTSTANDING.includes(r.status)).reduce((s2, r) => s2 + (r.hold || 0), 0);
    const charged = rs.reduce((s2, r) => s2 + (r.charged || 0), 0);
    const waiting = rs.filter((r) => r.status === "asked").length;
    const toHold = rs.filter((r) => r.status === "accepted").length;
    const swaps = rs.filter((r) => r.status === "swap_asked").length;
    const toConfirm = rs.filter((r) => r.status === "settled").length;
    const out = rs.filter((r) => ["dropped", "declined"].includes(r.status)).length;
    const released = rs.filter((r) => r.status === "released").length;
    // Saved steps PayPal hasn't confirmed: their amounts are kept apart from "held", which only
    // counts authorizations with no step pending.
    const P = rs.filter((r) => r.plan_op && OUTSTANDING.includes(r.status));
    const pendingCharge = P.filter((r) => r.plan_op === "capture").reduce((a, r) => a + (r.plan_charge || 0), 0);
    const pendingRelease = P.filter((r) => r.plan_op === "void").reduce((a, r) => a + (r.hold || 0), 0);
    const heldClean = rs.filter((r) => OUTSTANDING.includes(r.status) && !r.plan_op).reduce((a, r) => a + (r.hold || 0), 0);
    return { count: rs.length, held, heldClean, charged, waiting, toHold, swaps: t.status === "shopping" ? swaps : 0, toConfirm, out, released, pending: P.length, pendingCharge, pendingRelease };
  }

  async function tripsFor(u) {
    const mineT = await all("SELECT * FROM trips WHERE owner_id=? ORDER BY created_at DESC", u.id);
    const joined = await all("SELECT DISTINCT t.* FROM trips t JOIN requests r ON r.trip_id=t.id WHERE r.friend_id=? AND r.status<>'withdrawn' ORDER BY t.created_at DESC", u.id);
    const mine = [];
    for (const t of mineT) mine.push({ ...t, sum: await summary(t) });
    const out = [];
    for (const t of joined) { const o = await user(t.owner_id); out.push({ ...t, invite: undefined, payee_email: undefined, owner: o.name, ownerColor: o.color, sum: await summary(t, u.id) }); }
    return { mine, joined: out };
  }

  const byInvite = (code) => one("SELECT * FROM trips WHERE invite=?", code);
  const saveReceipt = (r) => run("INSERT INTO receipts(id,trip_id,image,model,shop,total,lines,matches,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
    r.id, r.trip_id, r.image, r.model, r.shop, r.total, r.lines, r.matches, now());
  const receipt = (rid, tid) => one("SELECT * FROM receipts WHERE id=? AND trip_id=?", rid, tid);
  const markable = (tid) => all("SELECT * FROM requests WHERE trip_id=? AND status IN ('found','swapped')", tid);

  return { canSee, finishEmpty, retry, user, trip, request, createUser, createTrip, addRequest, withdraw, decide, setShopDay, startHold, finishHold, startShopping, mark, answerSwap, planSettlement, settle, confirmDelivery, view, tripsFor, log, byInvite, saveReceipt, receipt, markable };
}
