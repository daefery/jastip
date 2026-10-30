// Exceptional journeys (council round 1): in-memory DB, PayPal stub that can fail on demand.
//   node --no-warnings test/edges.mjs
import { nodeSqlite } from "../lib/db.mjs";
import { makeTrips } from "../lib/trips.mjs";

const res = []; const ok = (c, w, x = "") => { res.push(!!c); console.log(`${c ? "PASS" : "FAIL"}  ${w}${x ? "  " + x : ""}`); };
const failCapture = new Set();
let n = 0;
const pp = {
  fake: () => true, paypalReady: () => true,
  createHold: async () => ({ orderId: `O${++n}`, approve: "x" }),
  authorizeOrder: async () => ({ authId: `A${++n}`, status: "CREATED" }),
  capture: async (authId) => { if (failCapture.has(authId)) throw new Error("PayPal 503"); return { captureId: `C${++n}`, status: "COMPLETED" }; },
  voidHold: async () => ({ status: "VOIDED" }),
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
  const out2 = await T.settle(await tripOf(tid), dina, await T.planSettlement(await tripOf(tid), read), "RC1");
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
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
