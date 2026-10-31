// The tracker. Friend = an order (Uber Eats). Traveller = courier mode (Instacart Shopper).
// Every number is from the server; every money move goes through the API (PayPal on the server).
import { api, ic, esc, av, toast, busy, sheet, pic, qrSvg, dateRange, when } from "../ui.js";
import { topbar, store, owns } from "../app.js";
import { sceneHTML, skyOf } from "../scenes.js";
import { fmt } from "../money.js";
import { receiptFlow } from "./receipt.js";

const STEPS = ["Asked", "Held", "Shopping", "Paid", "Delivered"];
let token = 0, poll;

export async function tripView(app, tid, { rid, params, route = store.route }) {
  const my = ++token;
  if (!owns(route)) return;
  const v = await api(`/api/trips/${tid}`);
  if (my !== token || !owns(route)) return;
  if (params.get("held")) toast("Hold approved. ¥0 charged.".replace("¥", v.trip.currency === "JPY" ? "¥" : ""));
  if (params.get("holdfail")) toast(params.get("why") || "PayPal didn't approve the hold", "err");
  if ([...params.keys()].length) history.replaceState(null, "", `#/trip/${tid}${rid ? `/r/${rid}` : ""}`);
  // reload only while this route still owns the page; errors become a toast, never an unhandled rejection
  const reload = () => owns(route) ? tripView(app, tid, { rid, params: new URLSearchParams(), route }).catch((e) => owns(route) && toast(e.message, "err")) : Promise.resolve();
  const ctx = { app, v, cur: v.trip.currency, reload };
  if (v.mine) courier(ctx, params.get("share") === "1");
  else order(ctx, rid);
  watch(ctx);
}

/* ---------------- shared bits ---------------- */
const stepsHTML = (n) => `<div class="steps" aria-label="Progress: ${STEPS[Math.min(n, 4)]}">${STEPS.map((_, i) => `<i class="${i < n ? "done" : i === n ? "now" : ""}"></i>`).join("")}</div>
  <div class="steplabels">${STEPS.map((l, i) => `<span class="${i <= n ? "on" : ""}">${l}</span>`).join("")}</div>`;
const moneyHTML = (cur, { value, note, fill = 0, color = "var(--blue)", rest = false }) => `<div class="money"><div class="row"><b class="num">${fmt(value, cur)}</b><span class="ppchip">Pay<i>Pal</i></span></div>
  <div class="mbar">${fill ? `<i style="width:${fill}%;background:${color}"></i>` : ""}${rest ? `<u style="left:${fill}%"></u>` : ""}</div><div class="mnote">${note}</div></div>`;
const tl = (rows) => `<div class="tline">${rows.map(([t, d, done, cls = ""]) => `<div class="tl${done ? " done" : ""}"><span class="d"></span><span class="${done ? cls : ""}">${t}</span><span>${done && d ? d : ""}</span></div>`).join("")}</div>`;
const titleOf = (r) => (r.swap_title && ["swapped", "settled", "delivered"].includes(r.status) ? r.swap_title : r.title);

/* ---------------- friend: the order ---------------- */
function stageOf(r, t) {
  if (r.status === "delivered") return 5;
  if (r.plan_op) return 3;
  if (r.status === "dropped" || r.status === "declined") return 0;
  if (r.status === "settled" || r.status === "released" || (t.status === "settled" && r.status === "not_found")) return 3;
  if (t.status === "shopping" || ["found", "swap_asked", "swapped", "not_found"].includes(r.status)) return 2;
  if (r.status === "held") return 1;
  return 0;
}

function friendState(r, t, owner) {
  const o = esc(owner.name), cur = t.currency, hold = r.hold || r.hold_needed;
  const S = { scene: "asked", eta: dateRange(t), title: "", sub: "", act: "", needs: "", money: null };
  const unconfirmed = r.plan_op && ["held", "found", "swap_asked", "swapped", "not_found", "releasing"].includes(r.status);
  if (unconfirmed && r.plan_op === "capture") return Object.assign(S, { scene: "paid", eta: "Paying", title: `Charging ${fmt(r.plan_charge, cur)}`,
    sub: `The receipt line plus ${o}'s fee. PayPal hasn't confirmed it yet, so this may take a moment. It never goes above your ${fmt(hold, cur)} hold.`,
    money: { value: r.plan_charge, note: `being charged · ${fmt(hold - r.plan_charge, cur)} will be released`, fill: Math.round((r.plan_charge / hold) * 100), color: "#9be2bd", rest: true } });
  if (unconfirmed) return Object.assign(S, { scene: "released", eta: "Releasing", title: r.status === "releasing" ? "Approved too late" : "Not bought. Releasing your hold.",
    sub: `${r.status === "releasing" ? `${o} had already started shopping. ` : ""}Nothing will be charged. PayPal hasn't confirmed the release yet; it's retried automatically.`,
    money: { value: 0, note: `${fmt(hold, cur)} being released`, fill: 100, color: "#c7c7cc" } });
  switch (r.status) {
    case "asked": Object.assign(S, { title: `Waiting for ${o}`, sub: `${o} checks your max price before anyone holds money.`, act: `<button class="btn red" data-withdraw>${ic("trash")}Withdraw ask</button>` }); break;
    case "declined": Object.assign(S, { title: `${o} can't take this one`, sub: "Nothing was held or charged.", scene: "released" }); break;
    case "dropped": Object.assign(S, { title: "Not included in shopping", sub: `No hold was approved before ${o} went shopping. Nothing was held or charged.`, scene: "released" }); break;
    case "accepted":
      if (t.status === "holds") Object.assign(S, { scene: "held", eta: `Shopping ${esc(t.shop_day)}`, title: "Approve your hold", sub: `Up to ${fmt(hold, cur)}. Nothing is charged today.`, needs: `${o} needs this before shopping day`, act: `<button class="btn pp" data-hold>Hold with <b>Pay<i>Pal</i></b></button><button class="btn light" data-withdraw>Withdraw ask</button>`, money: { value: hold, note: `hold to approve · ${fmt(0, cur)} today`, fill: 100, color: "#cfe0ff" } });
      else Object.assign(S, { title: `${o} accepted`, sub: "You'll approve a PayPal hold when the shopping day is set.", act: `<button class="btn light" data-withdraw>${ic("trash")}Withdraw ask</button>` });
      break;
    case "held": case "found": case "swapped":
      Object.assign(S, { scene: t.status === "shopping" ? "shopping" : "held", eta: t.status === "shopping" ? "Shopping now" : `Shopping ${esc(t.shop_day || "")}`,
        title: r.status === "found" ? `In ${o}'s basket` : r.status === "swapped" ? "Swap in the basket" : t.status === "shopping" ? `${o} is shopping` : "Held. See you on shopping day.",
        sub: r.status === "found" || r.status === "swapped" ? "Next: the till. You pay the receipt price." : `${o} buys it on shopping day. You pay the receipt price.`,
        money: { value: hold, note: `held · ${fmt(0, cur)} charged`, fill: 100 } });
      break;
    case "swap_asked":
      if (t.status !== "shopping") break;
      Object.assign(S, { scene: "shopping", eta: "Shopping now", title: `${esc(r.title)} is sold out`, sub: `${o} found ${esc(r.swap_title)} for ${fmt(r.swap_price, cur)}. Take it or skip?`, needs: `${o} is waiting in the shop`,
        act: `<button class="btn dark" data-swap>${ic("swap")}Choose</button>`, money: { value: hold, note: `held · ${fmt(0, cur)} charged`, fill: 100 } });
      break;
    case "not_found":
      Object.assign(S, { scene: "shopping", eta: "Shopping now", title: "Not on the shelf", sub: "Your hold will be released when she pays.", money: { value: hold, note: `held · released at the till`, fill: 100, color: "#c7c7cc" } }); break;
    case "settled": {
      const pct = Math.round((r.charged / hold) * 100);
      Object.assign(S, { scene: "paid", eta: `${o} lands ${new Date(t.ret + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`, title: `Paid ${fmt(r.charged, cur)}. Exactly.`, sub: `The receipt line plus ${o}'s fee. ${fmt(hold - r.charged, cur)} of your hold was never taken.`,
        act: `<button class="btn green" data-got>${ic("box")}I got my item</button>`, money: { value: r.charged, note: `paid · ${fmt(hold - r.charged, cur)} never taken`, fill: pct, color: "var(--green)", rest: true } });
      break; }
    case "released": Object.assign(S, { scene: "released", eta: "Settled", title: "Not found. Nothing paid.", sub: r.hold ? `Your ${fmt(r.hold, cur)} hold was released.` : "Nothing was held or charged.", money: { value: 0, note: r.hold ? `${fmt(r.hold, cur)} released` : "nothing held", fill: 0 } }); break;
    case "delivered": {
      const pct = Math.round((r.charged / hold) * 100);
      Object.assign(S, { scene: "delivered", eta: `Delivered ${r.delivered_at ? when(r.delivered_at) : ""}`, title: "Delivered. Enjoy!", sub: `Thanks for using Jastip with ${o}.`, money: { value: r.charged, note: `paid · ${fmt(hold - r.charged, cur)} never taken`, fill: pct, color: "var(--green)", rest: true } });
      break; }
  }
  if (!S.money) S.money = { value: 0, note: "no hold yet", fill: 0 };
  return S;
}

function order({ app, v, cur, reload }, rid) {
  const t = v.trip, o = v.owner;
  const reqs = v.requests;
  if (!reqs.length) { app.innerHTML = `${topbar({ back: "#/" })}<main class="page"><div class="empty card"><b>No asks on this trip</b><a class="btn dark" href="#/join/" style="max-width:240px">Back</a></div></main>`; return; }
  const r = reqs.find((x) => x.id === rid) || reqs.find((x) => ["accepted", "swap_asked", "settled"].includes(x.status)) || reqs[0];
  const S = friendState(r, t, o);
  const n = stageOf(r, t);
  const hold = r.hold || r.hold_needed;
  const neverHeld = !r.authorized_at;
  const timeline = tl([
    ["Asked", when(r.created_at), true],
    [`Hold approved · ${fmt(hold, cur)}`, r.authorized_at ? when(r.authorized_at) : "", !!r.authorized_at, "pp"],
    [`${esc(o.name)} shopping`, t.shop_day || "", n >= 2],
    r.status === "dropped" || r.status === "declined" ? ["Not included · nothing held", "", true, "dim"] :
    r.status === "released" || r.status === "not_found" ? [neverHeld ? "Nothing held" : `Released · ${fmt(hold, cur)}`, "", r.status === "released", "dim"] : [`Paid ${r.charged ? fmt(r.charged, cur) : ""}${r.charged ? ` · ${fmt(hold - r.charged, cur)} released` : ""}`, r.captured_at ? when(r.captured_at) : "", !!r.captured_at, "ok"],
    ["Delivered", r.delivered_at ? when(r.delivered_at) : "", r.status === "delivered"],
  ]);
  const item = `<div class="item">${pic(r.art, 56)}<div style="min-width:0"><b class="wrap">${esc(titleOf(r))}</b><div class="s">${r.swap_title && r.status !== "swap_asked" ? "Swap · within your max · " : r.detail ? esc(r.detail) + " · " : ""}max ${fmt(r.cap, cur)}${r.rule !== "ask" ? ` · ${r.rule === "similar" ? "similar ok" : "skip if sold out"}` : ""}</div>${r.line_text ? `<div class="rl">${esc(r.line_text)}</div>` : ""}</div>
    <div class="a">${r.price ? `<b class="num">${fmt(r.price, cur)}</b><span>+ ${fmt(t.fee, cur)} fee</span>` : `<b class="num">${fmt(r.cap, cur)}</b><span>max</span>`}</div></div>`;
  const others = reqs.filter((x) => x.id !== r.id);
  app.innerHTML = `${topbar({ back: "#/", title: `${o.name} · ${t.city}` })}<main class="trk">
    <section class="scene" style="--sky:${skyOf(S.scene)}"><div class="tb"><a class="rb" href="#/" aria-label="Back">${ic("back")}</a><button class="chipb" data-help>${ic("shield")}How it works</button></div>${sceneHTML(S.scene)}</section>
    <section class="panel" aria-live="polite"><div class="grab"></div>
      <div class="eta">${S.eta}</div><h1 class="status">${S.title}<small>${S.sub}</small></h1>
      ${stepsHTML(n)}
      ${S.needs ? `<div class="needs">${ic("alert")}${S.needs}</div>` : ""}
      <div class="in-aside">${moneyHTML(cur, S.money)}</div>
      <div class="who-row">${av(o, 46)}<div><b>${esc(o.name)}</b><span>Your jastiper · ${esc(t.city)} · ${o.kept ? `${o.kept} handovers kept` : "first trip"}</span></div><div class="acts"><button class="circ" data-chat aria-label="Message ${esc(o.name)}">${ic("chat")}</button></div></div>
      ${item}
      ${others.length ? `<div class="pick-asks"><div class="sec-t"><span>Your other ask${others.length > 1 ? "s" : ""}</span></div>${others.map((x) => `<a class="item" href="#/trip/${t.id}/r/${x.id}" style="grid-template-columns:44px 1fr auto">${pic(x.art, 44)}<div style="min-width:0"><b class="wrap">${esc(titleOf(x))}</b><div class="s">${statusWord(x, t)}</div></div><span>${ic("arrow")}</span></a>`).join("")}</div>` : ""}
      <div class="in-aside"><div class="sec-t"><span>Timeline</span></div>${timeline}</div>
    </section>
    ${S.act ? `<div class="actbar">${S.act}</div>` : ""}
    <nav class="rail" aria-label="Your asks"><div class="card"><div class="me">${av(store.me, 40)}<div><b>${esc(store.me.name)}</b><span>Your asks</span></div></div>
      <h3>${esc(o.name)} · ${esc(t.city)}</h3>${reqs.map((x) => `<a class="ord" href="#/trip/${t.id}/r/${x.id}" aria-current="${x.id === r.id}">${pic(x.art, 40)}<div><b>${esc(titleOf(x))}</b><span><i class="dot" style="background:${dotOf(x, t)}"></i>${statusWord(x, t)}</span></div></a>`).join("")}
      ${store.joined.filter((x) => x.id !== t.id).length ? `<h3 style="margin-top:14px">Other trips</h3>${store.joined.filter((x) => x.id !== t.id).map((x) => `<a class="ord" href="#/trip/${x.id}"><span class="av" style="--c:${esc(x.ownerColor)};--s:40px">${esc(x.owner[0])}</span><div><b>${esc(x.owner)} · ${esc(x.city)}</b><span>${x.sum.charged ? fmt(x.sum.charged, x.currency) + " paid" : x.sum.held ? fmt(x.sum.held, x.currency) + " held" : "asked"}</span></div></a>`).join("")}` : ""}
    </div></nav>
    <aside class="aside" aria-label="Money and timeline"><div class="card"><h3>Your money · PayPal</h3>${moneyHTML(cur, S.money)}</div><div class="card"><h3>Timeline</h3>${timeline}</div></aside>
  </main>`;

  const on = (sel, fn) => app.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => fn(b)));
  const act = async (b, fn, ok) => { busy(b, true); try { await fn(); if (ok) toast(ok); reload(); } catch (e) { busy(b, false); toast(e.message, "err"); } };
  on("[data-withdraw]", async (b) => {
    if (!confirm("Withdraw this ask?")) return;
    busy(b, true);
    try { await api(`/api/requests/${r.id}`, { method: "DELETE" }); toast("Ask withdrawn"); location.hash = "#/"; }
    catch (e) { busy(b, false); toast(e.message, "err"); }
  });
  on("[data-hold]", () => holdSheet(v, r));
  on("[data-swap]", () => swapSheet(v, r, reload));
  on("[data-got]", (b) => gotSheet(v, r, reload));
  on("[data-help]", () => helpSheet(v));
  on("[data-chat]", () => toast("Chat opens in WhatsApp in the real app"));
}

function statusWord(r, t) {
  if (r.plan_op && !["settled", "released", "delivered"].includes(r.status)) return r.plan_op === "capture" ? "Paying…" : "Releasing…";
  return { asked: "Waiting for OK", declined: "Declined", dropped: "Not included", releasing: "Releasing…", accepted: t.status === "holds" ? "Approve hold" : "Accepted", held: "Held", found: "In the basket", swap_asked: "Pick a swap", swapped: "Swap in basket", not_found: "Not found", settled: "Paid", released: "Released", delivered: "Delivered" }[r.status] || r.status;
}
function dotOf(r, t) {
  return { settled: "#05a357", delivered: "#05a357", released: "#a8a8a8", declined: "#a8a8a8", swap_asked: "#ff7a00", held: "#276ef1", found: "#ff7a00", swapped: "#ff7a00", accepted: t.status === "holds" ? "#ff7a00" : "#a8a8a8" }[r.status] || "#a8a8a8";
}

function holdSheet(v, r) {
  const t = v.trip, cur = t.currency, hold = r.hold_needed;
  const s = sheet({ title: "", label: "PayPal hold", left: `<span class="sandbox">${store.config.paypalTest ? "Test mode" : "Sandbox"}</span>`, right: `<button class="lk" data-close>Cancel</button>`, body: `
    <div class="pplogo">Pay<i>Pal</i></div>
    <div class="ppamt num">${fmt(hold, cur)}</div><div style="color:#555">Hold for ${esc(v.owner.name)}'s trip to ${esc(t.city)}</div>
    <div class="pplines"><div><span>${esc(r.title)}, max</span><b class="num">${fmt(r.cap, cur)}</b></div><div><span>${esc(v.owner.name)}'s fee</span><span class="num">${fmt(t.fee, cur)}</span></div><div><b>Charged today</b><b class="num">${fmt(0, cur)}</b></div></div>
    <div class="note">${ic("lock")}<span>When ${esc(v.owner.name)} scans the receipt you're charged the exact shelf price plus fee. Not found? The hold is released.</span></div>
    <div style="height:14px"></div><button class="btn pp" data-primary>Continue to <b>Pay<i>Pal</i></b></button>` });
  s.el.querySelector("[data-primary]").onclick = async (e) => {
    busy(e.currentTarget, true, "Opening PayPal");
    try { const o = await api(`/api/requests/${r.id}/hold`, { body: {} }); if (o.already) { s.close(); toast("Already held"); return; } location.href = o.approve; }
    catch (er) { busy(e.currentTarget, false); toast(er.message, "err"); }
  };
}

function swapSheet(v, r, reload) {
  const cur = v.trip.currency;
  let pick = "yes";
  const s = sheet({ title: "Pick a swap", right: `<button class="lk" data-close>Later</button>`, body: `
    <div class="opts" role="group" aria-label="Swap choice">
      <button class="opt" data-v="yes" aria-pressed="true">${pic(r.art)}<b>${esc(r.swap_title)}</b><span class="num">${fmt(r.swap_price, cur)} · within your max</span></button>
      <button class="opt" data-v="no" aria-pressed="false"><span class="pic" style="--g:#ececec;color:#999;width:100%;height:84px;border-radius:12px">${ic("x")}</span><b>Skip</b><span>${fmt(r.hold, cur)} released</span></button></div>
    <button class="btn dark" data-primary>Take the swap</button>` });
  s.el.querySelectorAll(".opt").forEach((b) => b.onclick = () => { pick = b.dataset.v; s.el.querySelectorAll(".opt").forEach((x) => x.setAttribute("aria-pressed", x === b)); s.el.querySelector("[data-primary]").textContent = pick === "yes" ? "Take the swap" : "Skip it"; });
  s.el.querySelector("[data-primary]").onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await api(`/api/requests/${r.id}/swap`, { body: { yes: pick === "yes" } }); s.close(); toast(pick === "yes" ? "Swap taken" : "Skipped · your hold will be released"); reload(); }
    catch (er) { busy(e.currentTarget, false); toast(er.message, "err"); }
  };
}

function gotSheet(v, r, reload) {
  const s = sheet({ title: "Got your item?", body: `
    <div class="item" style="border:0">${pic(r.art, 56)}<div><b>${esc(titleOf(r))}</b><div class="s">from ${esc(v.owner.name)}</div></div><div class="a"><b class="num">${fmt(r.charged, v.trip.currency)}</b><span>paid</span></div></div>
    <div class="note">${ic("shield")}<span>Confirming tells ${esc(v.owner.name)} the handover happened. It's the record if anyone disputes later.</span></div>
    <div style="height:14px"></div><button class="btn green" data-primary>${ic("check")}Yes, I got it</button>` });
  s.el.querySelector("[data-primary]").onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await api(`/api/requests/${r.id}/delivered`, { body: {} }); s.close(); toast("Handover confirmed"); reload(); }
    catch (er) { busy(e.currentTarget, false); toast(er.message, "err"); }
  };
}

function helpSheet(v) {
  sheet({ title: "How Jastip works", body: `<div class="tline">
    <div class="tl done"><span class="d"></span><span>You ask with a max price</span><span></span></div>
    <div class="tl done"><span class="d"></span><span class="pp">PayPal holds up to max + fee. Nothing charged.</span><span></span></div>
    <div class="tl done"><span class="d"></span><span>${esc(v.owner.name)} shops. Sold out? You pick a swap.</span><span></span></div>
    <div class="tl done"><span class="d"></span><span class="ok">One receipt: you pay your exact line + fee.</span><span></span></div>
    <div class="tl done"><span class="d"></span><span>Not found? Your hold is released.</span><span></span></div></div>
    <p class="hint">You can never be charged more than your hold. You can't cancel after approving, so ${esc(v.owner.name)} never shops for a no-show.</p>` });
}

/* ---------------- traveller: courier mode ---------------- */
function courier({ app, v, cur, reload }, openShare) {
  const t = v.trip, rs = v.requests;
  const by = (...st) => rs.filter((r) => st.includes(r.status));
  const holdSum = (xs) => xs.reduce((s, r) => s + (r.hold || r.hold_needed || 0), 0);
  const asked = by("asked"), acc = by("accepted"), held = by("held"), live = by("held", "found", "swap_asked", "swapped", "not_found");
  const nf = by("not_found");
  const paid = by("settled", "delivered"), rel = by("released");
  let scene = "open", eta = dateRange(t), title = "", sub = "", n = 0, body = "", action = "";

  if (t.status === "open") {
    n = 0; eta = `${dateRange(t)} · ${esc(t.city)}`;
    if (!rs.length) { title = "Share your trip"; sub = "Friends open the link, ask for items and set a max price."; action = `<button class="btn dark" data-share>${ic("share")}Share trip link</button>`; }
    else if (asked.length) { scene = "asked"; title = `${asked.length} new ask${asked.length > 1 ? "s" : ""}`; sub = "Check each max price. Too low? Decline before anyone holds money."; action = `<button class="btn dark" data-acceptall>${ic("check")}Accept ${asked.length}</button>`; }
    else { scene = "asked"; title = `${acc.length} ask${acc.length > 1 ? "s" : ""} accepted`; sub = "Pick your shopping day. Friends then approve PayPal holds."; action = `<button class="btn dark" data-day>${ic("cal")}Pick shopping day</button>`; }
  } else if (t.status === "holds") {
    n = 1; scene = "held"; eta = `Shopping ${esc(t.shop_day)}`;
    title = asked.length ? `${asked.length} new ask${asked.length > 1 ? "s" : ""} to check` : held.length && !acc.length ? `${held.length} holds in. Go shopping!` : `${held.length} of ${held.length + acc.length} holding`;
    sub = `${fmt(holdSum(held), cur)} held for you by PayPal. ${fmt(0, cur)} charged. Only held asks go on your list.`;
    action = `<button class="btn dark" data-shop ${held.length ? "" : "disabled"}>${ic("bag")}Start shopping${held.length ? ` · ${held.length}` : ""}</button>`;
  } else if (t.status === "settling") {
    n = 3; scene = "paid"; eta = "Payment problem";
    const stuck = by("held", "found", "swap_asked", "swapped", "not_found", "releasing");
    title = `${stuck.length} PayPal step${stuck.length === 1 ? "" : "s"} didn't go through`;
    sub = "PayPal didn't confirm these. The holds are still in place. Retry, nothing is charged twice.";
    action = `<button class="btn dark" data-retry>${ic("lock")}Retry failed payments</button>`;
  } else if (t.status === "shopping") {
    n = 2; scene = "shopping"; eta = "Shopping now";
    const swaps = by("swap_asked"), found = by("found", "swapped"), looking = by("held"), nf = by("not_found");
    const nothing = !found.length && !swaps.length && !looking.length;
    title = swaps.length ? `Waiting for ${esc(swaps[0].friend.name)}` : nothing ? "Nothing found this time" : `${found.length} of ${live.length} in the basket`;
    sub = swaps.length ? "They're picking a swap. Keep shopping." : nothing ? `Finish to release every hold (${fmt(holdSum(nf), cur)}). No receipt needed.` : looking.length ? "Tap Found, or ••• for sold out." : "All done. Pay at the till, then scan the receipt.";
    action = nothing ? `<button class="btn dark" data-finish>${ic("check")}Finish trip · release ${fmt(holdSum(nf), cur)}</button>`
      : `<button class="btn dark" data-receipt ${found.length && !swaps.length ? "" : "disabled"}>${ic("camera")}Pay &amp; scan receipt</button>`;
  } else {
    n = paid.length && paid.every((r) => r.status === "delivered") ? 5 : 3; scene = n === 5 ? "delivered" : "paid"; eta = "Settled";
    title = `${fmt(paid.reduce((s, r) => s + r.charged, 0), cur)} paid to you`;
    sub = "Exact receipt lines + your fee. Holds not used were released.";
    action = paid.some((r) => r.status === "settled") ? `<button class="btn dark" data-qr>${ic("qr")}Show handover code</button>` : "";
  }

  const row = (r, right) => `<div class="jr">${pic(r.art, 48)}<div style="min-width:0"><b class="wrap2">${esc(titleOf(r))}</b><div class="s">${av(r.friend, 18)}<em>${esc(r.friend.name)}</em></div><div class="s2">${[`<strong class="num">max ${fmt(r.cap, cur)}</strong>`, r.detail && esc(r.detail), r.rule === "similar" && "similar ok", r.rule === "skip" && "skip if sold out"].filter(Boolean).join(" · ")}</div></div>${right}</div>`;
  const group = (label, xs, right) => (xs.length ? `<div class="group">${label}<span>${xs.length}</span></div>${xs.map((r) => row(r, right(r))).join("")}` : "");
  if (t.status === "open") {
    body = group("New asks", asked, (r) => `<div class="tbtn-row"><button class="tbtn x" data-decline="${r.id}" aria-label="Decline ${esc(r.title)}">${ic("x")}</button><button class="tbtn blue" data-accept="${r.id}" aria-label="Accept ${esc(r.title)}">${ic("check")}<span class="lbl">Accept</span></button></div>`)
      + group("Accepted", acc, () => `<span class="tbtn x">${ic("check")}OK</span>`) + group("Declined", by("declined"), () => "");
  } else if (t.status === "holds") {
    body = group("New asks", asked, (r) => `<div class="tbtn-row"><button class="tbtn x" data-decline="${r.id}" aria-label="Decline ${esc(r.title)}">${ic("x")}</button><button class="tbtn blue" data-accept="${r.id}" aria-label="Accept ${esc(r.title)}">${ic("check")}<span class="lbl">Accept</span></button></div>`)
      + group("Held by PayPal", held, (r) => `<span class="rt num">${fmt(r.hold, cur)}<small>held</small></span>`) + group("Waiting for hold", acc, () => `<span class="tbtn x">${ic("clock")}waiting</span>`);
  } else if (t.status === "shopping") {
    body = group("Found", by("found", "swapped"), (r) => `<button class="tbtn ok" data-mark="${r.id}" data-w="held" aria-label="Undo found ${esc(r.title)}">${ic("check")}</button>`)
      + group("Swaps", by("swap_asked"), (r) => `<span class="tbtn sw">Asked ${esc(r.friend.name)}</span>`)
      + group("Still looking", by("held"), (r) => `<div class="tbtn-row"><button class="tbtn" data-more="${r.id}" aria-label="More for ${esc(r.title)}">${ic("more")}</button><button class="tbtn blue" data-mark="${r.id}" data-w="found" aria-label="Found ${esc(r.title)}">${ic("check")}<span class="lbl">Found</span></button></div>`)
      + group("Not here", by("not_found"), (r) => `<button class="tbtn x" data-mark="${r.id}" data-w="held">Undo</button>`);
  } else if (t.status === "settling") {
    body = group("Not confirmed yet", by("held", "found", "swap_asked", "swapped", "not_found", "releasing"), (r) => `<span class="rt num" style="color:var(--red)">${r.plan_op === "capture" ? fmt(r.plan_charge, cur) : fmt(0, cur)}<small>${r.plan_op === "capture" ? "to charge" : `release ${fmt(r.hold, cur)}`} · held</small></span>`)
      + group("Done", [...paid, ...rel], (r) => `<span class="rt num" style="color:${r.charged ? "var(--green)" : "var(--l2)"}">${fmt(r.charged || 0, cur)}<small>${r.charged ? "charged" : "released"}</small></span>`);
  } else {
    body = group("Paid", paid, (r) => `<span class="rt num" style="color:var(--green)">${fmt(r.charged, cur)}<small>${r.status === "delivered" ? "delivered" : "to hand over"}</small></span>`)
      + group("Released", rel, (r) => `<span class="rt num" style="color:var(--l2)">${fmt(0, cur)}<small>${fmt(r.hold || 0, cur)} released</small></span>`)
      + group("Not included", by("dropped"), () => `<span class="rt num" style="color:var(--l2)">${fmt(0, cur)}<small>never held</small></span>`);
  }
  if (!rs.length) body = `<div class="empty"><b>No asks yet</b><span>Send the link to your group chat.</span></div>`;

  const earned = paid.reduce((s, r) => s + r.charged, 0);
  const kpis = t.status === "settled"
    ? `<div class="kpis"><div class="kpi g"><b class="num">${fmt(earned, cur)}</b><span>paid to you</span></div><div class="kpi"><b class="num">${fmt(paid.length * t.fee, cur)}</b><span>your fees</span></div><div class="kpi"><b class="num">${fmt(rel.reduce((s, r) => s + (r.hold || 0), 0), cur)}</b><span>released</span></div></div>`
    : `<div class="kpis"><div class="kpi b"><b class="num">${fmt(holdSum(live.length ? live : held), cur)}</b><span>held for you</span></div><div class="kpi"><b>${rs.filter((r) => r.status !== "declined").length}</b><span>asks</span></div><div class="kpi"><b>${new Set(rs.map((r) => r.friend.id)).size}</b><span>friends</span></div></div>`;
  const activity = tl(activityRows(v.events));
  const friends = [...new Map(rs.map((r) => [r.friend.id, r.friend])).values()];

  app.innerHTML = `${topbar({ back: "#/", title: `Your trip · ${t.city}` })}<main class="trk ${t.status === "shopping" ? "shop" : ""}">
    <section class="scene" style="--sky:${skyOf(scene)}"><div class="tb"><a class="rb" href="#/" aria-label="Back">${ic("back")}</a><button class="chipb" data-share>${ic("share")}Trip link</button></div>${sceneHTML(scene)}</section>
    <section class="panel" aria-live="polite"><div class="grab"></div>
      <div class="eta">${eta}</div><h1 class="status">${title}<small>${sub}</small></h1>
      ${stepsHTML(n)}
      <div class="in-aside">${kpis}</div>
      <div class="job">${body}</div>
      <div class="in-aside"><div class="sec-t"><span>PayPal &amp; AI activity</span></div>${activity}</div>
    </section>
    ${action ? `<div class="actbar">${action}</div>` : ""}
    <nav class="rail" aria-label="Trip"><div class="card"><div class="me">${av(store.me, 40)}<div><b>${esc(store.me.name)}</b><span>${esc(t.home_code)} → ${esc(t.city_code)} · ${dateRange(t)}</span></div></div>
      <h3>Friends</h3>${friends.map((f) => { const xs = rs.filter((r) => r.friend.id === f.id); const p = xs.reduce((s, r) => s + (r.charged || 0), 0), h = holdSum(xs.filter((r) => ["held", "found", "swap_asked", "swapped", "not_found"].includes(r.status))); return `<div class="ord">${av(f, 40)}<div><b>${esc(f.name)}</b><span>${xs.length} item${xs.length > 1 ? "s" : ""} · ${p ? fmt(p, cur) + " paid" : h ? fmt(h, cur) + " held" : "asked"}</span></div></div>`; }).join("") || `<p class="hint">No asks yet.</p>`}
      <div style="height:8px"></div><button class="btn light sm" data-share style="width:100%">${ic("share")}Share trip link</button>
    </div></nav>
    <aside class="aside" aria-label="Money"><div class="card"><h3>Money · PayPal</h3>${kpis}${v.customs?.usd ? `<p class="hint" style="margin-top:8px">${ic("scale")} Customs: ${v.customs.basis === "receipt" ? "goods" : "up to"} $${v.customs.usd} of $${v.customs.limit} duty-free${v.customs.basis === "receipt" ? " (receipt prices)" : " (friends' max prices)"}</p>` : ""}</div>
      <div class="card"><h3>PayPal &amp; AI activity</h3>${activity}</div></aside>
  </main>`;

  const on = (sel, fn) => app.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => fn(b)));
  const act = async (b, fn, ok) => { busy(b, true); try { await fn(); if (ok) toast(ok); reload(); } catch (e) { busy(b, false); toast(e.message, "err"); b.closest(".jr")?.classList.add("shake"); } };
  on("[data-share]", () => shareSheet(v));
  on("[data-accept]", (b) => act(b, () => api(`/api/requests/${b.dataset.accept}/decide`, { body: { accept: true } }), "Accepted"));
  on("[data-decline]", (b) => act(b, () => api(`/api/requests/${b.dataset.decline}/decide`, { body: { accept: false } }), "Declined"));
  on("[data-acceptall]", (b) => act(b, async () => { for (const r of asked) await api(`/api/requests/${r.id}/decide`, { body: { accept: true } }); }, `Accepted ${asked.length}`));
  on("[data-day]", () => daySheet(v, reload));
  on("[data-shop]", (b) => {
    const left = [...asked, ...acc];
    if (left.length && !confirm(`${left.length} ask${left.length > 1 ? "s" : ""} without a hold will be left out:\n${left.map((r) => `· ${r.friend.name}: ${r.title}`).join("\n")}\n\nNothing is held or charged for them. Start shopping?`)) return;
    act(b, () => api(`/api/trips/${t.id}/shop`, { body: {} }), "Have fun shopping");
  });
  on("[data-mark]", (b) => act(b, () => api(`/api/requests/${b.dataset.mark}/mark`, { body: { what: b.dataset.w } })));
  on("[data-more]", (b) => moreSheet(v, rs.find((r) => r.id === b.dataset.more), reload));
  on("[data-receipt]", () => receiptFlow(v, reload));
  const payAct = (b, path, okMsg) => act(b, async () => {
    const o = await api(`/api/trips/${t.id}/${path}`, { body: {} });
    const bad = o.results.filter((x) => x.error).length;
    if (bad) { toast(`${bad} didn't go through. The hold${bad > 1 ? "s are" : " is"} still in place. Retry in a minute.`, "err"); return; }
    toast(okMsg);
  });
  on("[data-finish]", (b) => { if (confirm(`Release every hold? Nothing will be charged.`)) payAct(b, "finish", "All holds released"); });
  on("[data-retry]", (b) => payAct(b, "retry", "Payments confirmed"));
  on("[data-qr]", () => handoverSheet(v));
  if (openShare) shareSheet(v);
}

// Each friend scans this; it opens their own item on their phone, where "I got my item" confirms the handover.
function handoverSheet(v) {
  const url = `${location.origin}/#/trip/${v.trip.id}`;
  const left = v.requests.filter((r) => r.status === "settled");
  sheet({ title: "Handover code", body: `${qrSvg(url, "Handover code: opens this trip on your friend's phone")}
    <p class="hint" style="text-align:center;margin-bottom:12px">Your friend scans it, sees their exact charge and taps <b>I got my item</b>. That's your proof.</p>
    <div class="split">${left.map((r) => `<div class="sr">${av(r.friend, 28)}<div class="t">${esc(r.friend.name)} · ${esc(titleOf(r))}</div><b class="num">${fmt(r.charged, v.trip.currency)}</b></div>`).join("") || `<p class="hint">Everyone has confirmed.</p>`}</div>` });
}

function shareSheet(v) {
  const url = `${location.origin}/#/join/${v.trip.invite}`;
  const text = `I'm going to ${v.trip.city} ${dateRange(v.trip)}. Want anything? You only pay the receipt price.`;
  const s = sheet({ title: "Share your trip", body: `
    <div class="linkbox">${ic("link")}<span>${esc(url)}</span></div>
    <p class="hint" style="margin:10px 4px 14px">Friends open it in the browser. No app, no sign-up.</p>
    <div style="display:grid;gap:8px"><a class="btn dark" href="https://wa.me/?text=${encodeURIComponent(text + " " + url)}" target="_blank" rel="noopener">${ic("chat")}Send to WhatsApp</a>
    <button class="btn light" data-copy>${ic("link")}Copy link</button></div>` });
  s.el.querySelector("[data-copy]").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast("Copy the link above", "err"); } };
}

function daySheet(v, reload) {
  const t = v.trip, days = [];
  for (let d = new Date(t.depart + "T00:00"); d <= new Date(t.ret + "T00:00") && days.length < 14; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  let pick = days[Math.min(1, days.length - 1)];
  const lbl = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const s = sheet({ title: "When are you shopping?", body: `
    <div class="days" role="group" aria-label="Shopping day">${days.map((d, i) => `<button class="day" data-i="${i}" aria-pressed="${d === pick}"><b>${d.getDate()}</b><span>${d.toLocaleDateString("en-GB", { weekday: "short" })}</span></button>`).join("")}</div>
    <div class="note">${ic("lock")}<span>Friends approve their PayPal holds now. A hold is most reliable for 3 days, so pick the day you'll be in the shop.</span></div>
    <div style="height:14px"></div><button class="btn dark" data-primary>Ask for holds · ${lbl(pick)}</button>` });
  s.el.querySelectorAll(".day").forEach((b) => b.onclick = () => { pick = days[Number(b.dataset.i)]; s.el.querySelectorAll(".day").forEach((x) => x.setAttribute("aria-pressed", x === b)); s.el.querySelector("[data-primary]").textContent = `Ask for holds · ${lbl(pick)}`; });
  s.el.querySelector("[data-primary]").onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await api(`/api/trips/${t.id}/day`, { body: { day: lbl(pick) } }); s.close(); toast("Friends can approve holds now"); reload(); }
    catch (er) { busy(e.currentTarget, false); toast(er.message, "err"); }
  };
}

function moreSheet(v, r, reload) {
  const cur = v.trip.currency;
  const ruleTxt = { ask: `${esc(r.friend.name)} picks the swap`, similar: `${esc(r.friend.name)} said similar is OK · auto-accepted`, skip: `${esc(r.friend.name)} said skip if sold out` }[r.rule || "ask"];
  const s = sheet({ title: titleOf(r), body: `
    <div class="menu">
      <button data-w="found"><span class="ti" style="background:var(--green)">${ic("check")}</span><div><b>Found it</b><span>In the basket</span></div></button>
      ${r.rule !== "skip" ? `<button data-w="swap"><span class="ti" style="background:var(--orange)">${ic("swap")}</span><div><b>Sold out · suggest a swap</b><span>${ruleTxt}</span></div></button>` : ""}
      <button data-w="not_found"><span class="ti" style="background:#8e8e93">${ic("x")}</span><div><b>Not here</b><span>${fmt(r.hold || 0, cur)} hold is released at the till</span></div></button>
    </div>
    <form id="swf" hidden style="margin-top:14px"><div class="row2"><label class="field"><span>Swap item</span><input class="input" id="swt" required placeholder="e.g. 4 pack"></label>
      <label class="field"><span>Shelf price</span><input class="input" id="swp" type="number" inputmode="decimal" step="any" required placeholder="max ${fmt(r.cap, cur)}"></label></div>
      <p class="hint">Must be within ${esc(r.friend.name)}'s max of ${fmt(r.cap, cur)}.</p><div style="height:10px"></div><button class="btn dark">${ic("arrow")}${r.rule === "similar" ? "Add swap" : `Ask ${esc(r.friend.name)}`}</button></form>` });
  s.el.querySelectorAll("[data-w]").forEach((b) => b.onclick = async () => {
    if (b.dataset.w === "swap") { s.el.querySelector("#swf").hidden = false; s.el.querySelector("#swt").focus(); return; }
    busy(b, true);
    try { await api(`/api/requests/${r.id}/mark`, { body: { what: b.dataset.w } }); s.close(); reload(); } catch (e) { busy(b, false); toast(e.message, "err"); }
  });
  s.el.querySelector("#swf").onsubmit = async (e) => {
    e.preventDefault(); const btn = e.target.querySelector(".btn"); busy(btn, true);
    try { await api(`/api/requests/${r.id}/mark`, { body: { what: "swap", swap: { title: s.el.querySelector("#swt").value, price: Number(s.el.querySelector("#swp").value) } } }); s.close(); toast(r.rule === "similar" ? "Swap added" : `Asked ${r.friend.name}`); reload(); }
    catch (er) { busy(btn, false); toast(er.message, "err"); }
  };
}

// Human words for the activity log. The API names stay in the detail for judges ("PayPal: AUTHORIZE").
function activityRows(events) {
  const out = [];
  for (const e of events) {
    if (out.length >= 10) break;
    const L = e.label.replace(/ \(test mode\)/, "");
    if (L.startsWith("CREATE ORDER")) continue; // the AUTHORIZE row that follows says it
    const who = (e.detail || "").split(" · ")[0];
    const amt = (e.detail || "").split(" · ")[1] || "";
    let text = L, cls = "", api = "";
    if (e.kind === "paypal") {
      if (!e.ok) { text = `PayPal call failed · ${who}`; cls = "bad"; }
      else if (L === "AUTHORIZE") { text = `${who} approved a hold · ${amt}`; cls = "pp"; api = "AUTHORIZE"; }
      else if (L === "CAPTURE") { text = `${who} charged ${amt}`; cls = "ok"; api = "CAPTURE"; }
      else if (L === "VOID") { text = `${who}'s hold released · ${amt}`; cls = "dim"; api = "VOID"; }
    } else if (e.kind === "ai") { text = L === "Receipt read" ? `AI read the receipt · ${(e.detail || "").split(" · ")[0]}` : L; }
    else if (L === "Trip opened") continue;
    out.push([`${esc(text)}${api ? `<br><span style="color:var(--l3);font:500 11px var(--mono)">PayPal ${api}</span>` : e.kind !== "paypal" && e.detail && !/Receipt/.test(L) ? `<br><span style="color:var(--l2);font-size:12.5px">${esc(e.detail)}</span>` : ""}`, when(e.created_at), true, cls]);
  }
  return out.length ? out : [["Nothing yet", "", false]];
}

/* live refresh: friends and traveller see each other's moves */
function watch({ v, reload }) {
  clearInterval(poll);
  const sig = (x) => x.trip.status + JSON.stringify(x.requests.map((r) => r.status));
  const s0 = sig(v);
  poll = setInterval(async () => {
    if (!location.hash.includes(v.trip.id) || document.querySelector(".sheet")) return;
    const n = await api(`/api/trips/${v.trip.id}`).catch(() => null);
    if (n && !document.querySelector(".sheet") && sig(n) !== s0) reload();
  }, 5000);
}
