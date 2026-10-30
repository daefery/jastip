// Sold-out rule checks against a test-mode server (PAYPAL_FAKE=1 on :5181).
const BASE = process.env.BASE || "http://localhost:5181";
const res = []; const ok = (c, w, x = "") => { res.push(!!c); console.log(`${c ? "PASS" : "FAIL"}  ${w}${x ? "  " + x : ""}`); };
function client() { let cookie = ""; return async (path, body, method) => { const r = await fetch(BASE + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", Cookie: cookie }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" }); const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0]; return { status: r.status, loc: r.headers.get("location"), ...(await r.json().catch(() => ({}))) }; }; }
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const dina = client(), a = client(), b = client();
await dina("/api/me", { name: "Dina" }); await a("/api/me", { name: "Ana" }); await b("/api/me", { name: "Budi" });
const { trip } = await dina("/api/trips", { home_code: "CGK", city_code: "HND", depart: d(1), ret: d(5), fee: 100 });
const code = (await dina(`/api/trips/${trip.id}`)).trip.invite;
const rs = (await a(`/api/join/${code}/requests`, { title: "Pocky", cap: 400, rule: "similar" })).request;
const rk = (await b(`/api/join/${code}/requests`, { title: "Royce", cap: 1000, rule: "skip" })).request;
const bad = (await b(`/api/join/${code}/requests`, { title: "X", cap: 500, rule: "anything" })).request;
ok(rs.rule === "similar" && rk.rule === "skip" && bad.rule === "ask", "rule stored, unknown rule falls back to 'ask'");
for (const r of [rs, rk]) await dina(`/api/requests/${r.id}/decide`, { accept: true });
await dina(`/api/requests/${bad.id}/decide`, { accept: false });
await dina(`/api/trips/${trip.id}/day`, { day: "Mon" });
for (const [c, r] of [[a, rs], [b, rk]]) { const h = await c(`/api/requests/${r.id}/hold`, {}); const back = await fetch(h.approve, { redirect: "manual" }); ok(back.status === 302, `hold approved for ${r.title} (test mode)`); }
await dina(`/api/trips/${trip.id}/shop`, {});
const sim = await dina(`/api/requests/${rs.id}/mark`, { what: "swap", swap: { title: "Pocky strawberry", price: 300 } });
const v1 = await dina(`/api/trips/${trip.id}`);
ok(v1.requests.find((x) => x.id === rs.id).status === "swapped", "'Similar ok' swap within max is taken without asking", sim.error || "");
const over = await dina(`/api/requests/${rs.id}/mark`, { what: "swap", swap: { title: "Pocky giant", price: 500 } });
ok(over.status === 409, "'Similar ok' still cannot exceed the max", over.error);
const skip = await dina(`/api/requests/${rk.id}/mark`, { what: "swap", swap: { title: "Royce bitter", price: 900 } });
ok(skip.status === 409 && /skip/.test(skip.error), "'Skip' refuses any swap", skip.error);
const nf = await dina(`/api/requests/${rk.id}/mark`, { what: "not_found" });
ok(nf.ok, "'Skip' item can be marked not here");
const home = await dina("/api/me");
ok(home.mine[0].sum.held > 0 && home.mine[0].sum.count === 3, "trip list carries a money summary", JSON.stringify(home.mine[0].sum));
const fh = await a("/api/me");
ok(fh.joined[0].sum.count === 1 && fh.joined[0].owner === "Dina", "friend's list shows only their own asks");
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
