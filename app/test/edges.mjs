// Exceptional journeys (council round 1): in-memory DB, PayPal stub that can fail on demand.
//   node --no-warnings test/edges.mjs
import { nodeSqlite } from "../lib/db.mjs";
import { makeTrips } from "../lib/trips.mjs";

const res = []; const ok = (c, w, x = "") => { res.push(!!c); console.log(`${c ? "PASS" : "FAIL"}  ${w}${x ? "  " + x : ""}`); };
const failCapture = new Set(), failVoid = new Set();
let authGate = null, sameAuth = false; const voided = [];
let n = 0;
const pp = {
  fake: () => true, paypalReady: () => true,
  createHold: async () => ({ orderId: `O${++n}`, approve: "x" }),
  authorizeOrder: async (orderId) => { if (authGate) await authGate; return { authId: sameAuth ? `AUTH-${orderId}` : `A${++n}`, status: "CREATED" }; },
  capture: async (authId) => { if (failCapture.has(authId)) throw new Error("PayPal 503"); return { captureId: `C${++n}`, status: "COMPLETED" }; },
  voidHold: async (authId) => { if (failVoid.has(authId)) throw new Error("PayPal 503 on void"); voided.push(authId); return { status: "VOIDED" }; },
};
const db = await nodeSqlite(":memory:");
const T = makeTrips(db, pp);
const d = (k) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);

async function setup(names) {
  const dina = await T.createUser("Dina");
  const t0 = await T.createTrip(dina, { home: "Jakarta", home_code: "CGK", city: "Tokyo", city_code: "HND", currency: "JPY", depart: d(1), ret: d(5), fee: 100, payee_email: null });
  const people = [];
  for (const [name, cap] of names) {
    const f = await T.createUser(name);
    const r = await T.addRequest(await T.trip(t0.id), f, { title: `${name} item`, cap, rule: "ask" });
    people.push({ f, r });
  }
  return { dina, tid: t0.id, people };
}
const tripOf = (tid) => T.trip(tid);
const status = async (rid) => (await T.request(rid)).status;
const hold = async (tid, p) => { await T.startHold(await tripOf(tid), p.f, p.r.id, "http://x"); await T.finishHold(p.r.id); };

// 1. Nothing found: finish releases every hold, no receipt
{
  const { dina, tid, people } = await setup([["Ayu", 1200], ["Bima", 1300]]);
  for (const p of people) await T.decide(await tripOf(tid), dina, p.r.id, true);
  await T.setShopDay(await tripOf(tid), dina, "Mon");
  for (const p of people) await hold(tid, p);
  await T.startShopping(await tripOf(tid), dina);
  for (const p of people) await T.mark(await tripOf(tid), dina, p.r.id, "not_found");
  const out = await T.finishEmpty(await tripOf(tid), dina);
  ok(out.every((x) => x.released > 0), "nothing found: every hold voided without a receipt");
  ok((await tripOf(tid)).status === "settled", "nothing found: trip finishes");
  let e; try { await T.finishEmpty(await tripOf(tid), dina); } catch (x) { e = x; }
  ok(e, "finish cannot run twice");
}
// 1b. finish refused while something is in the basket
{
  const { dina, tid, people } = await setup([["Ayu", 1200], ["Bima", 1300]]);
  for (const p of people) await T.decide(await tripOf(tid), dina, p.r.id, true);
  await T.setShopDay(await tripOf(tid), dina, "Mon");
  for (const p of people) await hold(tid, p);
  await T.startShopping(await tripOf(tid), dina);
  await T.mark(await tripOf(tid), dina, people[0].r.id, "found");
  let e; try { await T.finishEmpty(await tripOf(tid), dina); } catch (x) { e = x; }
  ok(e && /receipt/i.test(e.message), "finish refused when an item was found", e?.message);
}
// 2. A failed capture keeps the trip 'settling', retry charges once
{
  const { dina, tid, people } = await setup([["Ayu", 1500], ["Bima", 1300]]);
  for (const p of people) await T.decide(await tripOf(tid), dina, p.r.id, true);
  await T.setShopDay(await tripOf(tid), dina, "Mon");
  for (const p of people) await hold(tid, p);
  await T.startShopping(await tripOf(tid), dina);
  for (const p of people) await T.mark(await tripOf(tid), dina, p.r.id, "found");
  const ra = await T.request(people[0].r.id);
  failCapture.add(ra.auth_id);
  const read = { lines: [{ n: 1, text: "KitKat", price: 1188 }, { n: 2, text: "Banana", price: 1000 }], matches: [{ request_id: people[0].r.id, line_n: 1 }, { request_id: people[1].r.id, line_n: 2 }] };
  const out = await T.settle(await tripOf(tid), dina, await T.planSettlement(await tripOf(tid), read), "RC1");
  ok(out.some((x) => x.error) && (await tripOf(tid)).status === "settling", "failed capture: trip stays 'settling'");
  ok((await status(people[0].r.id)) === "found" && (await status(people[1].r.id)) === "settled", "failed item still held, other item charged");
  failCapture.clear();
  const out2 = await T.retry(await tripOf(tid), dina);
  ok(out2.length === 1 && out2[0].id === people[0].r.id && out2[0].charged === 1288 && (await tripOf(tid)).status === "settled", "retry charges only the failed item, then settles", JSON.stringify(out2));
  const b = await T.request(people[1].r.id);
  ok(b.status === "settled" && b.charged === 1100, "already-paid item untouched by retry");
  let e; try { await T.settle(await tripOf(tid), dina, [], "RC1"); } catch (x) { e = x; }
  ok(e, "settled trip refuses another settle");
}
// 3. Strangers can't see a trip; friends never see the full receipt
{
  const { dina, tid, people } = await setup([["Ayu", 1500]]);
  const stranger = await T.createUser("Zed");
  let e; try { await T.view(await tripOf(tid), stranger); } catch (x) { e = x; }
  ok(e?.code === 404, "stranger gets 404 for a trip");
  await db.run("INSERT INTO receipts(id,trip_id,image,model,shop,total,lines,matches,created_at) VALUES('R','" + tid + "','',' m','Shop',100,'[]','[]',1)");
  const v = await T.view(await tripOf(tid), people[0].f);
  ok(v.receipt === null, "friend view carries no full receipt");
  const vo = await T.view(await tripOf(tid), dina);
  ok(vo.receipt?.shop === "Shop", "traveller still sees the receipt");
}
// 4. Late / never-held asks are "dropped", not "released", and shopping needs a hold
{
  const { dina, tid, people } = await setup([["Ayu", 1200], ["Late", 600]]);
  await T.decide(await tripOf(tid), dina, people[0].r.id, true);
  await T.setShopDay(await tripOf(tid), dina, "Mon");
  let e; try { await T.startShopping(await tripOf(tid), dina); } catch (x) { e = x; }
  ok(e, "can't start shopping with zero holds");
  await hold(tid, people[0]);
  await T.startShopping(await tripOf(tid), dina);
  const late = await T.request(people[1].r.id);
  ok(late.status === "dropped" && !late.hold, "never-held ask is 'dropped' with no hold", late.status);
}
// 5. Trip input validation
{
  const u = await T.createUser("V");
  let e1, e2; const base = { home: "J", home_code: "CGK", city: "T", city_code: "HND", currency: "JPY", depart: d(1), ret: d(2) };
  try { await T.createTrip(u, { ...base, fee: -5 }); } catch (x) { e1 = x; }
  try { await T.createTrip(u, { ...base, fee: 100, payee_email: "not-an-email" }); } catch (x) { e2 = x; }
  ok(e1?.code === 400 && e2?.code === 400, "negative fee and bad PayPal email are refused");
}

async function shopping(names) {
  const s = await setup(names);
  for (const p of s.people) await T.decide(await tripOf(s.tid), s.dina, p.r.id, true);
  await T.setShopDay(await tripOf(s.tid), s.dina, "Mon");
  for (const p of s.people) await hold(s.tid, p);
  await T.startShopping(await tripOf(s.tid), s.dina);
  return s;
}
// 6. duplicate receipt line: retry keeps the void a void (round 2 #16)
{
  const { dina, tid, people } = await shopping([["Ayu", 1500], ["Bima", 1500]]);
  for (const p of people) await T.mark(await tripOf(tid), dina, p.r.id, "found");
  const rb = await T.request(people[1].r.id); failVoid.add(rb.auth_id);
  const read = { lines: [{ n: 1, text: "KitKat", price: 800 }], matches: [{ request_id: people[0].r.id, line_n: 1 }, { request_id: people[1].r.id, line_n: 1 }] };
  const out = await T.settle(await tripOf(tid), dina, await T.planSettlement(await tripOf(tid), read), "RC2");
  ok(out.find((x) => x.id === people[0].r.id)?.charged === 900 && out.find((x) => x.id === people[1].r.id)?.error, "same line twice: first charged, second's void failed");
  failVoid.clear();
  const out2 = await T.retry(await tripOf(tid), dina);
  ok(out2.length === 1 && out2[0].released === 1600 && (await T.request(people[1].r.id)).charged === 0, "retry voids it again, never charges it", JSON.stringify(out2));
}
// 7. checkout with an item still 'held' (not marked): its failed void stays visible + retryable (#17)
{
  const { dina, tid, people } = await shopping([["Ayu", 1500], ["Bima", 1300]]);
  await T.mark(await tripOf(tid), dina, people[0].r.id, "found");
  const rb = await T.request(people[1].r.id); failVoid.add(rb.auth_id);
  const read = { lines: [{ n: 1, text: "KitKat", price: 1188 }], matches: [{ request_id: people[0].r.id, line_n: 1 }] };
  await T.settle(await tripOf(tid), dina, await T.planSettlement(await tripOf(tid), read), "RC3");
  const rb2 = await T.request(people[1].r.id);
  ok((await tripOf(tid)).status === "settling" && rb2.status === "held" && rb2.plan_op === "void", "unmarked item: failed void saved as an open 'void' step");
  failVoid.clear();
  await T.retry(await tripOf(tid), dina);
  ok((await T.request(people[1].r.id)).status === "released" && (await tripOf(tid)).status === "settled", "retry releases it, trip settles");
}
// 8. nothing found + failed void: finish -> settling -> retry works without a receipt (#1)
{
  const { dina, tid, people } = await shopping([["Ayu", 1200], ["Bima", 1300]]);
  for (const p of people) await T.mark(await tripOf(tid), dina, p.r.id, "not_found");
  failVoid.add((await T.request(people[0].r.id)).auth_id);
  const out = await T.finishEmpty(await tripOf(tid), dina);
  ok(out.filter((x) => x.error).length === 1 && (await tripOf(tid)).status === "settling", "finish with a failed void: trip stays settling");
  failVoid.clear();
  const out2 = await T.retry(await tripOf(tid), dina);
  ok(out2.length === 1 && out2[0].released && (await tripOf(tid)).status === "settled", "receipt-free retry releases only the failed one", JSON.stringify(out2));
}
// 9. late PayPal return after shopping started never resurrects the ask (#18)
{
  const s = await setup([["Ayu", 1200], ["Late", 900]]);
  for (const p of s.people) await T.decide(await tripOf(s.tid), s.dina, p.r.id, true);
  await T.setShopDay(await tripOf(s.tid), s.dina, "Mon");
  await hold(s.tid, s.people[0]);
  await T.startHold(await tripOf(s.tid), s.people[1].f, s.people[1].r.id, "http://x"); // opened PayPal, didn't finish
  await T.startShopping(await tripOf(s.tid), s.dina);
  let e; try { await T.finishHold(s.people[1].r.id); } catch (x) { e = x; }
  const late = await T.request(s.people[1].r.id);
  ok(e && late.status === "dropped" && !late.auth_id, "late return during shopping: refused, stays dropped, no auth", late.status);
  await T.mark(await tripOf(s.tid), s.dina, s.people[0].r.id, "not_found");
  await T.finishEmpty(await tripOf(s.tid), s.dina);
  let e2; try { await T.finishHold(s.people[1].r.id); } catch (x) { e2 = x; }
  ok(e2 && (await T.request(s.people[1].r.id)).status === "dropped", "late return after finishing: refused");
}
// 10. double settle tap can't save two plans
{
  const { dina, tid, people } = await shopping([["Ayu", 1500]]);
  await T.mark(await tripOf(tid), dina, people[0].r.id, "found");
  const read = { lines: [{ n: 1, text: "KitKat", price: 1188 }], matches: [{ request_id: people[0].r.id, line_n: 1 }] };
  const t1 = await tripOf(tid), plan = await T.planSettlement(t1, read);
  const both = await Promise.allSettled([T.settle(t1, dina, plan, "A"), T.settle(t1, dina, plan, "B")]);
  ok(both.filter((x) => x.status === "fulfilled").length === 1 && (await T.request(people[0].r.id)).charged === 1288, "two settle taps at once: one runs, one is refused");
}

// 11. plan save fails half-way: nothing saved, trip still shopping, settle works afterwards (round 3 #19)
{
  const { dina, tid, people } = await shopping([["Ayu", 1500], ["Bima", 1300]]);
  for (const p of people) await T.mark(await tripOf(tid), dina, p.r.id, "found");
  const read = { lines: [{ n: 1, text: "KitKat", price: 1188 }, { n: 2, text: "Banana", price: 1000 }], matches: [{ request_id: people[0].r.id, line_n: 1 }, { request_id: people[1].r.id, line_n: 2 }] };
  const realBatch = db.batch; let calls = 0;
  db.batch = async (list) => realBatch(list.map((q, i) => (i === 2 && ++calls ? ["UPDATE nope SET x=1"] : q)));
  let e; try { await T.settle(await tripOf(tid), dina, await T.planSettlement(await tripOf(tid), read), "RCX"); } catch (x) { e = x; }
  db.batch = realBatch;
  const a = await T.request(people[0].r.id);
  ok(e && (await tripOf(tid)).status === "shopping" && !a.plan_op, "plan save fails: all rolled back, trip still shopping", e?.message);
  const out = await T.settle(await tripOf(tid), dina, await T.planSettlement(await tripOf(tid), read), "RCX");
  ok(out.filter((x) => x.charged).length === 2, "settle works after the rollback");
}
// 12. stale "start shopping" can't reopen a settling trip or rewrite its plan (#20)
{
  const { dina, tid, people } = await shopping([["Ayu", 1500], ["Bima", 1500]]);
  const stale = await tripOf(tid);
  for (const p of people) await T.mark(await tripOf(tid), dina, p.r.id, "found");
  failVoid.add((await T.request(people[1].r.id)).auth_id);
  const read = { lines: [{ n: 1, text: "KitKat", price: 800 }], matches: [{ request_id: people[0].r.id, line_n: 1 }, { request_id: people[1].r.id, line_n: 1 }] };
  await T.settle(await tripOf(tid), dina, await T.planSettlement(await tripOf(tid), read), "RC5");
  let e1, e2, e3; try { await T.startShopping({ ...stale, status: "holds" }, dina); } catch (x) { e1 = x; }
  try { await T.mark({ ...stale, status: "shopping" }, dina, people[1].r.id, "found"); } catch (x) { e2 = x; }
  try { await T.settle({ ...stale, status: "shopping" }, dina, await T.planSettlement(await tripOf(tid), read), "RC6"); } catch (x) { e3 = x; }
  const b = await T.request(people[1].r.id);
  ok(e1 && e2 && e3 && (await tripOf(tid)).status === "settling" && b.plan_op === "void", "stale shop/mark/settle all refused, saved void unchanged", [e1?.message, e2?.message, e3?.message].join(" | "));
  failVoid.clear(); await T.retry(await tripOf(tid), dina);
  ok((await T.request(people[1].r.id)).charged === 0, "B is released, never charged");
}
// 13. late authorization whose release fails: the auth id is kept and retried (#21)
{
  const s2 = await setup([["Ayu", 1200], ["Late", 900]]);
  for (const p of s2.people) await T.decide(await tripOf(s2.tid), s2.dina, p.r.id, true);
  await T.setShopDay(await tripOf(s2.tid), s2.dina, "Mon");
  await hold(s2.tid, s2.people[0]);
  await T.startHold(await tripOf(s2.tid), s2.people[1].f, s2.people[1].r.id, "http://x");
  let release; authGate = new Promise((r) => (release = r)); sameAuth = true;
  const lateOrder = (await T.request(s2.people[1].r.id)).order_id;
  failVoid.add(`AUTH-${lateOrder}`);
  const pending = T.finishHold(s2.people[1].r.id).catch((x) => x);
  await new Promise((r) => setTimeout(r, 20));
  await T.startShopping(await tripOf(s2.tid), s2.dina);
  release(); authGate = null;
  const e = await pending;
  const late = await T.request(s2.people[1].r.id);
  ok(/hasn't confirmed/.test(e?.message) && late.auth_id === `AUTH-${lateOrder}` && late.plan_op === "void" && late.status === "releasing", "late auth + failed release: auth kept as an open void, honest message", e?.message);
  await T.mark(await tripOf(s2.tid), s2.dina, s2.people[0].r.id, "not_found");
  let e2; try { await T.finishEmpty(await tripOf(s2.tid), s2.dina); } catch (x) { e2 = x; }
  const tNow = await tripOf(s2.tid);
  ok(tNow.status === "settling" || e2, "trip can't silently settle while that release is open", tNow.status + " " + (e2?.message || ""));
  failVoid.clear();
  if (tNow.status === "shopping") await T.finishEmpty(tNow, s2.dina);
  await T.retry(await tripOf(s2.tid), s2.dina).catch(() => {});
  ok((await T.request(s2.people[1].r.id)).status === "released" && voided.includes(`AUTH-${lateOrder}`) && (await tripOf(s2.tid)).status === "settled", "retry releases the late auth, trip settles");
  sameAuth = false;
}
// 14. two PayPal returns at once with the same authorization: kept, never voided (#22)
{
  const s3 = await setup([["Ayu", 1200]]);
  await T.decide(await tripOf(s3.tid), s3.dina, s3.people[0].r.id, true);
  await T.setShopDay(await tripOf(s3.tid), s3.dina, "Mon");
  await T.startHold(await tripOf(s3.tid), s3.people[0].f, s3.people[0].r.id, "http://x");
  sameAuth = true; voided.length = 0;
  const both = await Promise.allSettled([T.finishHold(s3.people[0].r.id), T.finishHold(s3.people[0].r.id)]);
  sameAuth = false;
  const r = await T.request(s3.people[0].r.id);
  ok(both.every((x) => x.status === "fulfilled") && r.status === "held" && !voided.length, "parallel returns: both succeed, hold kept, nothing voided", JSON.stringify(both.map((x) => x.status)));
}
// 15. a swap answer after the receipt is refused (#24)
{
  const { dina, tid, people } = await shopping([["Ayu", 1500], ["Bima", 1300]]);
  await T.mark(await tripOf(tid), dina, people[0].r.id, "found");
  await T.mark(await tripOf(tid), dina, people[1].r.id, "swap", { title: "Small one", price: 600 });
  const read = { lines: [{ n: 1, text: "KitKat", price: 1188 }], matches: [{ request_id: people[0].r.id, line_n: 1 }] };
  failVoid.add((await T.request(people[1].r.id)).auth_id);
  await T.settle(await tripOf(tid), dina, await T.planSettlement(await tripOf(tid), read), "RC7");
  const before = await T.request(people[1].r.id);
  let e; try { await T.answerSwap(await tripOf(tid), people[1].f, people[1].r.id, true); } catch (x) { e = x; }
  const after = await T.request(people[1].r.id);
  ok(before.status === "swap_asked" && e && /Too late/.test(e.message) && after.status === "swap_asked" && after.plan_op === "void", "late swap answer refused while its release is pending", e?.message);
  failVoid.clear(); await T.retry(await tripOf(tid), dina);
  ok((await T.request(people[1].r.id)).status === "released", "then the retry releases it");
}
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
