// Shell + router. Routes: / (welcome or trips), #/new, #/trip/:id, #/trip/:id/r/:rid, #/join/:code, #/me
import { api, ic, esc, av, toast, sheet, pic, closeAllSheets } from "./ui.js";
import { fmt } from "./money.js";
import { SCENES, sceneHTML } from "./scenes.js";
import { tripView } from "./screens/trip.js";
import { joinView } from "./screens/join.js";
import { newTripView } from "./screens/new.js";

export const store = { me: null, config: null, mine: [], joined: [], route: 0 };
// Every navigation bumps the route number. Async work captures it and checks owns() before painting.
export const owns = (n) => n === store.route;
const app = document.getElementById("app");

export async function refreshMe() {
  const r = await api("/api/me");
  store.me = r.user; store.mine = r.mine || []; store.joined = r.joined || [];
}

export function topbar({ back, title } = {}) {
  const me = store.me;
  return `<header class="top"><div class="top-in">
    ${back ? `<a class="iconb" href="${back}" aria-label="Back">${ic("back")}</a>` : `<a class="brand" href="#/"><span class="logo">J</span><span>Jastip</span></a>`}
    ${title ? `<b style="font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</b>` : ""}
    <span class="sp"></span>
    ${store.config?.paypalTest ? `<span class="sandbox">PayPal test mode</span>` : `<span class="sandbox">Sandbox</span>`}
    ${me ? `<button class="me-b" data-me aria-label="You: ${esc(me.name)}">${av(me, 34)}<span>${esc(me.name)}</span></button>` : ""}
  </div></header>`;
}

function welcome(next) {
  app.innerHTML = `${topbar()}<main class="hello"><div class="box">
    <svg class="art" viewBox="0 0 250 190" aria-hidden="true">${SCENES.open.svg}</svg>
    <h1>Shop abroad for friends.</h1>
    <p>No one pays before you buy.</p>
    <div class="feats">
      <div class="feat"><span class="ic">${ic("lock")}</span><div><b>PayPal holds a max price</b><span>Friends approve. ¥0 charged until the receipt.</span></div></div>
      <div class="feat"><span class="ic">${ic("receipt")}</span><div><b>One receipt, exact charges</b><span>Everyone pays their line. Not found? Released.</span></div></div>
      <div class="feat"><span class="ic">${ic("plane")}</span><div><b>Track it like a delivery</b><span>Held, shopping, paid, delivered.</span></div></div>
    </div>
    <form id="hi"><label class="field"><span>Your first name</span><input class="input" id="name" autocomplete="given-name" maxlength="24" required></label>
      <button class="btn dark">Continue</button></form>
  </div></main>`;
  app.querySelector("#hi").onsubmit = async (e) => {
    e.preventDefault();
    const name = app.querySelector("#name").value.trim(); if (!name) return;
    await api("/api/me", { body: { name } }); await refreshMe(); next();
  };
}

const ROLE_ST = {
  open: ["Taking asks", "gray"], holds: ["Holds open", "blue"], shopping: ["Shopping", "orange"], settling: ["Payment problem", "red"], settled: ["Paid", "green"],
};
function ownerStatus(t) {
  const S = t.sum;
  if (S.pending) return ["PayPal pending", "red"];
  if (S.waiting) return [`${S.waiting} new ask${S.waiting > 1 ? "s" : ""}`, "orange"];
  if (t.status === "settled") return S.toConfirm ? [`Hand over ${S.toConfirm}`, "orange"] : S.charged ? ["Delivered", "green"] : ["Nothing bought", "gray"];
  return ROLE_ST[t.status];
}
function friendStatus(sum, t) {
  if (sum.pending) return sum.pendingCharge ? ["Paying…", "orange"] : ["Releasing…", "orange"];
  if (sum.swaps) return ["Pick a swap", "orange"];
  if (sum.toHold && t.status === "holds") return ["Approve hold", "orange"];
  if (sum.toConfirm) return ["Got it?", "orange"];
  if (t.status === "settled" || t.status === "settling") return sum.charged ? ["Paid", "green"] : sum.released ? ["Released", "gray"] : ["Not included", "gray"];
  if (sum.released && sum.released + sum.out === sum.count) return ["Released", "gray"]; // e.g. withdrawn while PayPal approved
  if (sum.out === sum.count) return ["Not included", "gray"];
  if (t.status === "shopping") return ["Shopping", "orange"];
  if (sum.held) return ["Held", "blue"];
  return ["Asked", "gray"];
}

// One line of money for a trip card. Unconfirmed PayPal steps are named for what they are
// ("¥900 charge pending"), never shown as a definite hold.
export function moneyLine(t, mine) {
  const S = t.sum, c = t.currency;
  const pend = S.pending ? [S.pendingCharge && `${fmt(S.pendingCharge, c)} charge pending`, S.pendingRelease && `${fmt(S.pendingRelease, c)} release pending`].filter(Boolean).join(" · ") : "";
  if (pend) return [S.charged && `${fmt(S.charged, c)} paid`, pend].filter(Boolean).join(" · ");
  if (mine) return t.status === "settled" ? (S.charged ? `+${fmt(S.charged, c)}` : "nothing charged") : S.heldClean ? `${fmt(S.heldClean, c)} held` : `${S.count} ask${S.count === 1 ? "" : "s"}`;
  return S.charged ? `${fmt(S.charged, c)} paid` : S.heldClean ? `${fmt(S.heldClean, c)} held` : "";
}

function home() {
  const trips = [
    ...store.mine.map((t) => ({ t, mine: true })),
    ...store.joined.map((t) => ({ t, mine: false })),
  ];
  const row = ({ t, mine }) => {
    const [label, tone] = mine ? ownerStatus(t) : friendStatus(t.sum, t);
    const money = moneyLine(t, mine);
    return `<a class="trip" href="#/trip/${t.id}">
      <span class="route"><small>${esc(t.home_code)}</small>${esc(t.city_code)}</span>
      <div style="min-width:0"><b>${mine ? `Your trip · ${esc(t.city)}` : `${esc(t.owner)} · ${esc(t.city)}`}</b><div class="sub">${dr(t)}${mine ? "" : ` · you asked ${t.sum.count}`}</div></div>
      <div class="r"><span class="st ${tone}"><i></i>${esc(label)}</span><span class="amt num">${money}</span></div></a>`;
  };
  app.innerHTML = `${topbar()}<main class="page">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><h1 class="h1">Trips</h1><p class="lead" style="margin:0">${trips.length ? "Your trips and the ones you asked from." : ""}</p></div>
      <a class="btn dark sm" href="#/new" style="height:44px">${ic("plus")}New trip</a></div>
    ${trips.length ? `<div class="sec-t"><span>Active</span></div><div class="home">${trips.map(row).join("")}</div>` : `
      <div class="empty card" style="margin-top:18px"><svg class="art" viewBox="0 0 250 190" aria-hidden="true">${SCENES.open.svg}</svg><b>Going somewhere?</b>
        <span>Open a trip and share the link in your group chat. Friends ask, PayPal holds, you shop.</span>
        <a class="btn dark" href="#/new" style="max-width:280px">${ic("plus")}Open a trip</a></div>`}
  </main>`;
}
const dr = (t) => { const d = (s) => new Date(s + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); return `${d(t.depart)} – ${d(t.ret)}`; };

function meSheet() {
  const u = store.me;
  const s = sheet({ title: "You", body: `
    <div class="who-row" style="border:0">${av(u, 52)}<div><b style="font-size:18px">${esc(u.name)}</b><span>${u.kept} handover${u.kept === 1 ? "" : "s"} kept</span></div></div>
    <div class="menu">
      ${store.config?.demoSwitch ? `<button data-switch><span class="ti" style="background:#5e5ce6">${ic("user")}</span><div><b>Switch person</b><span>Demo only: act as someone on this trip</span></div></button>` : ""}
      <a href="#/new" data-close><button style="width:100%"><span class="ti" style="background:#0b0b0b">${ic("plus")}</span><div style="text-align:left"><b>New trip</b><span>Going somewhere?</span></div></button></a>
    </div>
    <p class="hint" style="margin-top:14px">PayPal ${store.config?.paypalTest ? "test mode" : "sandbox"} · AI ${store.config?.ai ? esc(store.config.aiModel) : "off"}</p>` });
  const sw = s.el.querySelector("[data-switch]"); if (sw) sw.onclick = async () => {
    const people = new Map();
    for (const t of [...store.mine, ...store.joined]) { const v = await api(`/api/trips/${t.id}`).catch(() => null); if (!v) continue; people.set(v.owner.id, v.owner); v.requests.forEach((r) => people.set(r.friend.id, r.friend)); }
    s.el.querySelector(".menu").innerHTML = [...people.values()].map((p) => `<button data-uid="${p.id}"><span>${av(p, 44)}</span><div><b>${esc(p.name)}</b><span>${p.id === u.id ? "You now" : "Switch"}</span></div></button>`).join("") || `<p class="hint">Open a trip and get an ask first.</p>`;
    s.el.querySelectorAll("[data-uid]").forEach((b) => b.onclick = async () => { await api("/api/switch", { body: { id: b.dataset.uid } }); await refreshMe(); s.close(); toast(`You are ${store.me.name}`); route(); });
  };
}

export async function route() {
  const my = ++store.route;
  closeAllSheets();
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(qs || "");
  const parts = path.split("/").filter(Boolean);
  try {
    if (parts[0] === "join") return void (await joinView(app, parts[1], my));
    if (!store.me) return welcome(route);
    await refreshMe();
    if (!owns(my)) return; // the user already went somewhere else
    if (parts[0] === "new") newTripView(app);
    else if (parts[0] === "trip") await tripView(app, parts[1], { rid: parts[2] === "r" ? parts[3] : null, params, route: my });
    else home();
  } catch (e) { if (!owns(my)) return; toast(e.message, "err"); if (e.status === 404) location.hash = "#/"; }
  if (owns(my)) scrollTo({ top: 0 });
}

document.addEventListener("click", (e) => { if (e.target.closest("[data-me]")) meSheet(); });
(async () => {
  store.config = await api("/api/config");
  await refreshMe();
  addEventListener("hashchange", route);
  route();
})();
