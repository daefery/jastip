// One trip, two roles. Traveller: requests -> shopping day -> shop -> receipt -> settle.
// Friend: my request -> approve hold (PayPal) -> answer swap -> paid -> confirm delivery.
import { ic, esc, api, av, toast, busy, sheet, ART, qr, sleep } from "../ui.js";
import { navbar, tabbar, store } from "../app.js";
import { passCard } from "./home.js";
import { fmt } from "../money.js";
import { receiptFlow } from "./receipt.js";

const FRIEND_STATUS = {
  asked: ["Waiting for approval", "", "clock"], accepted: ["Approve your hold", "blue", "lock"], declined: ["Declined", "red", "x"],
  held: ["On hold", "blue", "lock"], found: ["Found", "green", "check"], swap_asked: ["Swap suggested", "orange", "swap"], swapped: ["Swap taken", "green", "check"],
  not_found: ["Not found", "", "x"], settled: ["Paid", "green", "check"], released: ["Released", "", "check"], delivered: ["Delivered", "green", "box"],
};
const stageOf = (t) => ({ open: 0, holds: 1, shopping: 2, settled: 3 })[t.status] ?? 0;

let renderToken = 0;
export async function tripScreen(app, tid, params) {
  const mineToken = ++renderToken;
  const v = await api(`/api/trips/${tid}`);
  if (mineToken !== renderToken) return; // a newer render started while this one was loading
  if (params.get("held")) toast("Hold approved. Nothing charged.");
  if (params.get("holdfail")) toast("PayPal didn't approve the hold", "err");
  if (params.has("held") || params.has("holdfail")) history.replaceState(null, "", `#/trip/${tid}`);
  app.innerHTML = v.mine ? travellerView(v) : friendView(v);
  bind(app, v);
}

/* ---------------- traveller ---------------- */
function travellerView(v) {
  const t = v.trip, cur = t.currency, rs = v.requests;
  const by = (...s) => rs.filter((r) => s.includes(r.status));
  const st = stageOf(t);
  const track = ["Requests", "Holds", "Shop", "Settle"].map((x, i) => `<div class="${i < st ? "on" : i === st ? "on now" : ""}"><i></i>${x}</div>`).join("");
  const invite = `${location.origin}/#/join/${t.invite}`;
  let body = "", cta = "";

  if (t.status === "open" || t.status === "holds") {
    const asked = by("asked"), acc = by("accepted", "held"), dec = by("declined");
    body += asked.length ? `<div class="sec"><div class="sec-h">New requests <b>${asked.length}</b></div><div class="list">${asked.map((r) => reqRow(r, cur, `
        <div class="btn-row" style="flex:none;gap:6px"><button class="btn sm gray" data-decide="${r.id}" data-a="0" aria-label="Decline ${esc(r.title)}">${ic("x")}</button><button class="btn sm" data-decide="${r.id}" data-a="1">Accept</button></div>`)).join("")}</div>
        <div class="sec-f">Check the max price. Too low for the item? Decline it now.</div></div>` : "";
    body += acc.length ? `<div class="sec"><div class="sec-h">Your list <b class="num">${acc.length}</b></div><div class="list">${acc.map((r) => reqRow(r, cur, statusPill(r))).join("")}</div></div>` : "";
    if (!rs.length) body += `<div class="empty"><div class="glyph">${ic("people")}</div><b>Share your trip</b><span>Friends open the link, ask for items, and set a max price.</span></div>`;
    body += dec.length ? `<div class="sec"><div class="sec-h">Declined</div><div class="list">${dec.map((r) => reqRow(r, cur, "")).join("")}</div></div>` : "";
    if (t.status === "open") cta = acc.length ? `<button class="btn" data-day>${ic("calendar")}<span>Pick shopping day</span></button>` : `<button class="btn" data-share>${ic("share")}<span>Share trip link</span></button>`;
    else {
      const held = by("held").length, wait = by("accepted").length;
      body = `<div class="sec"><div class="list"><div class="row with-ico"><span class="ico" style="background:var(--orange)">${ic("calendar")}</span><div class="main"><div class="t">Shopping day ${esc(t.shop_day)}</div><div class="s">${held} of ${held + wait} holds approved</div></div></div></div>
        <div class="sec-f">Only approved holds go on your shopping list.</div></div>` + body;
      cta = `<button class="btn" data-shop ${held ? "" : "disabled"}>${ic("bag")}<span>Start shopping · ${held}</span></button>`;
    }
  }

  if (t.status === "shopping") {
    const list = by("held", "found", "swap_asked", "swapped", "not_found");
    const done = list.filter((r) => ["found", "swapped", "not_found"].includes(r.status)).length;
    body += `<div class="sec"><div class="sec-h">Shopping list <b class="num">${done}/${list.length}</b></div><div class="list">${list.map((r) => shopRow(r, cur)).join("")}</div>
      <div class="sec-f">Tap the circle when it's in your basket. Sold out? Suggest a swap.</div></div>`;
    const ready = by("found", "swapped").length;
    cta = `<button class="btn" data-receipt ${ready ? "" : "disabled"}>${ic("camera")}<span>Scan receipt</span></button>`;
  }

  if (t.status === "settled") {
    const paid = by("settled", "delivered"), rel = by("released", "not_found");
    const charged = paid.reduce((s, r) => s + (r.charged || 0), 0), released = rs.reduce((s, r) => s + (r.released || 0), 0);
    const fees = paid.length * t.fee;
    body += `<div class="sec"><div class="money"><div class="ring" style="--p:${Math.round((charged / Math.max(1, charged + released)) * 100)}"><b>${paid.length}</b></div>
      <div><div class="k">Paid to you</div><div class="big num">${fmt(charged, cur)}</div><div class="s" style="color:var(--label2);font-size:15px">${fmt(fees, cur)} fees · ${fmt(released, cur)} never taken</div></div></div></div>`;
    body += `<div class="sec"><div class="sec-h">Hand over</div><div class="list">${paid.map((r) => reqRow(r, cur, r.status === "delivered" ? `<span class="pill green">${ic("check")}Delivered</span>` : `<span class="v strong num">${fmt(r.charged, cur)}</span>`)).join("")}</div>
      <div class="sec-f">Friends confirm in their app when they get the item. That's your proof if anyone disputes.</div></div>`;
    if (rel.length) body += `<div class="sec"><div class="sec-h">Released</div><div class="list">${rel.map((r) => reqRow(r, cur, `<span class="pill">${fmt(0, cur)}</span>`)).join("")}</div></div>`;
  }

  return `<div class="screen">${navbar({ title: `${t.city}`, back: { href: "#/", label: "Trips" }, right: t.invite ? `<button class="nb round" data-share aria-label="Share trip link">${ic("share")}</button>` : "" })}
    <div class="wrap"><div class="split"><div>
      ${passCard(t, { small: true, bottom: `<span>Fee per item <b class="num">${fmt(t.fee, cur)}</b></span>${customsPill(v)}` })}
      <div class="track">${track}</div>
      ${body}
      ${cta ? `<div class="cta">${cta}</div>` : ""}
    </div><aside class="side">${activity(v)}</aside></div></div></div>${tabbar("trips")}
    <template id="invite">${esc(invite)}</template>`;
}

function customsPill(v) {
  const c = v.customs; if (!c.usd) return "";
  const over = c.usd > c.limit;
  return `<span class="pill" style="background:rgba(255,255,255,.2);color:#fff" title="Indonesia: USD ${c.limit} duty-free per arrival">${ic("scale")}$${c.usd} / $${c.limit}${over ? " · over" : ""}</span>`;
}

function statusPill(r) {
  const [label, tone, icon] = FRIEND_STATUS[r.status] || ["", "", "info"];
  const text = r.status === "accepted" ? "Waiting for hold" : label;
  return `<span class="pill ${tone}">${ic(icon)}${esc(text)}</span>`;
}

function reqRow(r, cur, right) {
  return `<div class="row with-thumb" data-req="${r.id}"><span class="thumb">${ART[r.art] || ART.other}</span>
    <div class="main"><div class="t">${esc(r.swap_title || r.title)}</div><div class="s" style="display:flex;align-items:center;gap:6px">${av(r.friend, 18)}${esc(r.friend.name)} · max ${fmt(r.cap, cur)}${r.friend.kept ? "" : ` · <span style="color:var(--orange)">new</span>`}</div></div>${right}</div>`;
}

function shopRow(r, cur) {
  const cls = { found: "on", swapped: "on", not_found: "x", swap_asked: "sw" }[r.status] || "";
  const icon = r.status === "not_found" ? "x" : r.status === "swap_asked" ? "swap" : "check";
  const sub = r.status === "swap_asked" ? `Waiting for ${esc(r.friend.name)} · ${esc(r.swap_title)}` : r.status === "swapped" ? `Swap · ${esc(r.swap_title)} · ${fmt(r.swap_price, cur)}` : `${esc(r.friend.name)} · max ${fmt(r.cap, cur)}${r.detail ? " · " + esc(r.detail) : ""}`;
  return `<div class="shop-item"><button class="check ${cls}" data-toggle="${r.id}" aria-label="${r.status === "found" ? "Unmark" : "Mark found"}: ${esc(r.title)}">${ic(icon)}</button>
    <span class="thumb">${ART[r.art] || ART.other}</span>
    <div class="main" style="flex:1;min-width:0"><div class="t" style="${r.status === "not_found" ? "text-decoration:line-through;color:var(--label2)" : ""}">${esc(r.title)}</div><div class="s" style="font-size:15px;color:var(--label2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</div></div>
    ${["held", "found", "not_found"].includes(r.status) ? `<button class="nb" data-more="${r.id}" aria-label="More for ${esc(r.title)}" style="color:var(--label2)">•••</button>` : ""}</div>`;
}

/* ---------------- friend ---------------- */
function friendView(v) {
  const t = v.trip, cur = t.currency, o = v.owner;
  const cards = v.requests.map((r) => friendCard(v, r)).join("");
  return `<div class="screen">${navbar({ title: `${o.name}'s trip`, back: { href: "#/asks", label: "My asks" } })}
    <div class="wrap"><div class="split"><div>
      ${passCard(t, { small: true, bottom: `<span style="display:flex;align-items:center;gap:8px">${av(o, 22)}${esc(o.name)} · ${o.kept ? `${o.kept} handovers kept` : "new traveller"}</span><span>Fee <b class="num">${fmt(t.fee, cur)}</b></span>` })}
      <div style="height:22px"></div>
      ${cards || `<div class="empty"><div class="glyph">${ic("bag")}</div><b>No requests</b></div>`}
    </div><aside class="side">${activity(v)}</aside></div></div></div>${tabbar("asks")}`;
}

function friendCard(v, r) {
  const t = v.trip, cur = t.currency, o = v.owner;
  const [label, tone, icon] = FRIEND_STATUS[r.status] || ["", "", "info"];
  let action = "", money = "";
  const hold = r.hold || r.hold_needed;
  if (r.status === "asked") action = `<button class="btn red" data-withdraw="${r.id}">Withdraw</button>`;
  if (r.status === "accepted") action = t.status === "holds"
    ? `<button class="btn pp" data-hold="${r.id}">Hold <b>Pay<i>Pal</i></b> · ${fmt(hold, cur)}</button><div class="sec-f" style="text-align:center">Not a payment. You'll pay only the receipt price.</div>`
    : `<div class="sec-f" style="text-align:center">${esc(o.name)} accepted. You'll approve a hold when the shopping day is set.</div>`;
  if (r.status === "swap_asked") action = `<div class="list" style="margin-bottom:10px"><div class="row with-thumb"><span class="thumb">${ic("swap")}</span><div class="main"><div class="t">${esc(r.swap_title)}</div><div class="s">instead of ${esc(r.title)}</div></div><span class="v strong num">${fmt(r.swap_price, cur)}</span></div></div>
      <div class="btn-row"><button class="btn gray" data-swap="${r.id}" data-y="0">Skip</button><button class="btn" data-swap="${r.id}" data-y="1">Take it</button></div>`;
  if (r.status === "settled") action = `<button class="btn green" data-got="${r.id}">${ic("box")}<span>I got it</span></button>`;

  if (r.status === "held" || r.status === "found" || r.status === "swapped" || r.status === "swap_asked") money = moneyBar(hold, null, cur, "On hold", "blue");
  if (r.status === "settled" || r.status === "delivered") money = moneyBar(hold, r.charged, cur, "Paid", "green");
  if (r.status === "released" || r.status === "not_found") money = `<div class="row"><div class="main"><div class="t">Nothing to pay</div><div class="s">Your hold of ${fmt(hold, cur)} was released</div></div>${ic("checkc", "")}</div>`;
  const receiptLine = r.line_text ? `<div class="receipt" style="margin:0 0 4px"><div class="ln mine" style="--i:0"><span>${av(r.friend, 20)}</span><span>${esc(r.line_text)}</span><span>${fmt(r.price, cur)}</span></div><div class="ln" style="--i:1"><span></span><span>Jastip fee</span><span>${fmt(t.fee, cur)}</span></div><hr><div class="ln" style="--i:2;font-weight:700"><span></span><span>Charged</span><span>${fmt(r.charged, cur)}</span></div></div>` : "";

  return `<div class="sec" id="r-${r.id}"><div class="list">
      <div class="row with-thumb" style="padding:14px 16px"><span class="thumb">${ART[r.art] || ART.other}</span><div class="main"><div class="t" style="font-weight:600">${esc(r.title)}</div><div class="s">${r.detail ? esc(r.detail) + " · " : ""}max ${fmt(r.cap, cur)}</div></div><span class="pill ${tone}">${ic(icon)}${esc(label)}</span></div>
      ${money}
    </div>${receiptLine ? `<div style="margin-top:10px">${receiptLine}</div>` : ""}${action ? `<div style="margin-top:10px">${action}</div>` : ""}</div>`;
}

function moneyBar(hold, charged, cur, label, tone) {
  const pct = charged != null ? Math.round((charged / hold) * 100) : 100;
  return `<div class="row" style="display:block"><div style="display:flex;justify-content:space-between;font-size:15px"><span>${label}</span><b class="num">${fmt(charged ?? hold, cur)}</b></div>
    <div class="hbar"><i class="${tone === "green" ? "g" : ""}" style="width:${pct}%"></i>${charged != null ? `<u style="left:${pct}%;right:0"></u>` : ""}</div>
    ${charged != null ? `<div class="s" style="font-size:13px;color:var(--label2);margin-top:6px">${fmt(hold - charged, cur)} of your ${fmt(hold, cur)} hold was never taken</div>` : `<div class="s" style="font-size:13px;color:var(--label2);margin-top:6px">Held by PayPal. Not charged.</div>`}</div>`;
}

/* ---------------- activity (PayPal + AI log) ---------------- */
function activity(v) {
  const ev = v.events.slice(0, 14);
  if (!ev.length) return "";
  const t = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `<div class="sec log"><div class="sec-h">Activity</div><div class="list">${ev.map((e) => `<div class="row" style="--inset:36px"><span class="dot ${e.ok ? e.kind : "bad"}"></span><div class="main"><div class="t">${esc(e.label)}</div><div class="s">${esc(e.detail)}</div></div><span class="v" style="font-size:13px">${t(e.created_at)}</span></div>`).join("")}</div>
    <div class="sec-f"><span style="color:var(--blue)">●</span> PayPal &nbsp; <span style="color:var(--indigo)">●</span> AI &nbsp; <span style="color:var(--label3)">●</span> Trip</div></div>`;
}

/* ---------------- events ---------------- */
function bind(app, v) {
  const t = v.trip, cur = t.currency;
  const reload = () => tripScreen(app, t.id, new URLSearchParams());
  const on = (sel, fn) => app.querySelectorAll(sel).forEach((b) => b.addEventListener("click", (e) => fn(b, e)));
  const act = async (b, fn, ok) => { busy(b, true); try { await fn(); if (ok) toast(ok); await reload(); } catch (e) { busy(b, false); toast(e.message, "err"); b.closest(".sec,.row")?.classList.add("shake"); } };

  on("[data-share]", async () => {
    const url = app.querySelector("#invite").innerHTML.replace(/&amp;/g, "&");
    const text = `I'm going to ${t.city} ${t.depart}–${t.ret}. Want anything? You pay only the receipt price.`;
    if (navigator.share) { try { await navigator.share({ title: "Jastip", text, url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard?.writeText(url).catch(() => {});
    sheet({ title: "Share trip", body: `<div class="sec"><div class="list"><div class="row"><div class="main"><div class="t" style="white-space:normal;word-break:break-all;font-size:15px">${esc(url)}</div></div></div></div><div class="sec-f">Copied. Send it in your group chat.</div></div>${qr(url)}` });
  });
  on("[data-decide]", (b) => act(b, () => api(`/api/requests/${b.dataset.decide}/decide`, { body: { accept: b.dataset.a === "1" } }), b.dataset.a === "1" ? "Accepted" : "Declined"));
  on("[data-day]", () => {
    const days = []; const d0 = new Date(t.depart + "T00:00"), d1 = new Date(t.ret + "T00:00");
    for (let d = new Date(d0); d <= d1 && days.length < 10; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    const s = sheet({ title: "Shopping day", body: `<p class="lead" style="text-align:center">Friends approve their PayPal holds for this day. A hold is most reliable for 3 days, so pick the day you'll be in the shop.</p>
      <div class="list">${days.map((d) => { const iso = d.toISOString().slice(0, 10); return `<button class="row" data-d="${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}"><div class="main"><div class="t">${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div></div>${ic("chev", "chev")}</button>`; }).join("")}</div>` });
    s.el.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => act(b, async () => { await api(`/api/trips/${t.id}/day`, { body: { day: b.dataset.d } }); s.close(); }, "Friends can approve holds now"));
  });
  on("[data-shop]", (b) => act(b, () => api(`/api/trips/${t.id}/shop`, { body: {} }), "Have fun shopping"));
  on("[data-toggle]", (b) => {
    const r = v.requests.find((x) => x.id === b.dataset.toggle);
    if (r.status === "swap_asked" || r.status === "swapped") return;
    const what = r.status === "found" || r.status === "not_found" ? "held" : "found";
    b.classList.toggle("on", what === "found"); if (navigator.vibrate) navigator.vibrate(8);
    act(b, () => api(`/api/requests/${r.id}/mark`, { body: { what } }));
  });
  on("[data-more]", (b) => {
    const r = v.requests.find((x) => x.id === b.dataset.more);
    const s = sheet({ title: r.title, body: `
      <div class="sec"><div class="list">
        <button class="row with-ico" data-m="found"><span class="ico" style="background:var(--green)">${ic("check")}</span><div class="main"><div class="t">In my basket</div></div></button>
        <button class="row with-ico" data-m="swap"><span class="ico" style="background:var(--orange)">${ic("swap")}</span><div class="main"><div class="t">Suggest a swap</div><div class="s">${esc(r.friend.name)} decides</div></div></button>
        <button class="row with-ico" data-m="not_found"><span class="ico" style="background:var(--label3)">${ic("x")}</span><div class="main"><div class="t">Not found</div><div class="s">Hold is released at checkout</div></div></button>
      </div></div>
      <form id="swapf" hidden><div class="sec"><div class="sec-h">Swap for ${esc(r.friend.name)}</div><div class="list">
        <div class="field"><label for="sw-t">Item</label><input id="sw-t" placeholder="e.g. 4 pack" required></div>
        <div class="field"><label for="sw-p">Price</label><input id="sw-p" type="number" inputmode="decimal" step="any" required placeholder="max ${fmt(r.cap, cur)}"></div>
      </div><div class="sec-f">Must be within ${esc(r.friend.name)}'s max of ${fmt(r.cap, cur)}.</div></div><button class="btn">${ic("arrow")}<span>Ask ${esc(r.friend.name)}</span></button></form>` });
    s.el.querySelectorAll("[data-m]").forEach((x) => x.onclick = () => {
      if (x.dataset.m === "swap") { s.el.querySelector("#swapf").hidden = false; s.el.querySelector("#sw-t").focus(); return; }
      act(x, async () => { await api(`/api/requests/${r.id}/mark`, { body: { what: x.dataset.m } }); s.close(); });
    });
    s.el.querySelector("#swapf").onsubmit = (e) => { e.preventDefault(); const btn = e.target.querySelector(".btn");
      act(btn, async () => { await api(`/api/requests/${r.id}/mark`, { body: { what: "swap", swap: { title: s.el.querySelector("#sw-t").value, price: Number(s.el.querySelector("#sw-p").value) } } }); s.close(); }, `Asked ${r.friend.name}`); };
  });
  on("[data-receipt]", () => receiptFlow(v, reload));

  // friend
  on("[data-withdraw]", (b) => act(b, () => api(`/api/requests/${b.dataset.withdraw}`, { method: "DELETE" }), "Withdrawn"));
  on("[data-hold]", (b) => holdSheet(v, v.requests.find((r) => r.id === b.dataset.hold)));
  on("[data-swap]", (b) => act(b, () => api(`/api/requests/${b.dataset.swap}/swap`, { body: { yes: b.dataset.y === "1" } }), b.dataset.y === "1" ? "Swap taken" : "Skipped. Your hold will be released."));
  on("[data-got]", (b) => act(b, () => api(`/api/requests/${b.dataset.got}/delivered`, { body: {} }), "Thanks! Handover confirmed."));

  // live refresh every 6 s while the trip screen is open (friends and traveller see each other's moves)
  clearInterval(bind._t);
  const sig = JSON.stringify(v.requests.map((r) => r.status)) + t.status;
  bind._t = setInterval(async () => {
    if (!location.hash.includes(t.id) || document.querySelector(".sheet")) return;
    const n = await api(`/api/trips/${t.id}`).catch(() => null);
    if (document.querySelector(".sheet") || !location.hash.includes(t.id)) return;
    if (n && JSON.stringify(n.requests.map((r) => r.status)) + n.trip.status !== sig) reload();
  }, 6000);
}

function holdSheet(v, r) {
  const t = v.trip, cur = t.currency, hold = r.hold_needed;
  const s = sheet({ title: "", cls: "pp-sheet", right: `<button class="nb" data-close style="color:#0070e0">Cancel</button>`, left: `<span class="sandbox">Sandbox</span>`, body: `
    <div class="ppbox">
      <div class="pplogo">Pay<i>Pal</i></div>
      <div class="amt num">${fmt(hold, cur)}</div><div class="sub">Hold for ${esc(v.owner.name)}'s trip to ${esc(t.city)}</div>
      <div class="lines"><div><span>${esc(r.title)}, max</span><span class="num">${fmt(r.cap, cur)}</span></div><div><span>Jastip fee</span><span class="num">${fmt(t.fee, cur)}</span></div><div><span><b>You pay today</b></span><b class="num">${fmt(0, cur)}</b></div></div>
      <div class="note">${ic("lock")}<span>PayPal holds up to ${fmt(hold, cur)}. When ${esc(v.owner.name)} scans the receipt you're charged the exact shelf price plus fee. Not found? The hold is released.</span></div>
      <button class="btn pp" id="go">Continue to <b>Pay<i>Pal</i></b></button>
    </div>` });
  s.el.querySelector("#go").onclick = async (e) => {
    busy(e.currentTarget, true, "Opening PayPal");
    try { const o = await api(`/api/requests/${r.id}/hold`, { body: {} }); if (o.already) { s.close(); toast("Already held"); return; } location.href = o.approve; }
    catch (er) { busy(e.currentTarget, false); toast(er.message, "err"); }
  };
}
