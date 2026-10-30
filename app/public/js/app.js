// Router + shell: Welcome, Trips (home), Trip, Join (friend), Activity, Me.
import { api, ic, esc, av, toast } from "./ui.js";
import { fmt } from "./money.js";
import { homeScreen, newTripSheet, fmtDates } from "./screens/home.js";
import { tripScreen } from "./screens/trip.js";
import { joinScreen } from "./screens/join.js";

export const store = { me: null, config: null, mine: [], joined: [] };
const app = document.getElementById("app");
let lastDepth = 0;

export async function refreshMe() {
  const r = await api("/api/me");
  store.me = r.user; store.mine = r.mine || []; store.joined = r.joined || [];
  return r;
}

function welcome() {
  app.innerHTML = `<main class="hello">
    <img class="appicon" src="/icon.svg" alt="">
    <h1>Jastip</h1>
    <p>Shop abroad for friends.<br>No one pays before you buy.</p>
    <div class="feat">
      ${ic("lock")}<div><b>PayPal holds a max price</b><span>Friends approve. Nothing is charged yet.</span></div>
      ${ic("receipt")}<div><b>One receipt, exact charges</b><span>Everyone pays the shelf price. Not found? Released.</span></div>
      ${ic("shield")}<div><b>Safe both ways</b><span>You never front money for a no-show.</span></div>
    </div>
    <form id="hi"><label class="vh" for="name">Your first name</label>
      <input id="name" class="input-big" autocomplete="given-name" placeholder="Your first name" maxlength="24" required>
      <div style="height:12px"></div><button class="btn">Continue</button></form>
    <p style="font-size:12px;margin:18px 0 0">PayPal sandbox · test money only</p>
  </main>`;
  document.getElementById("hi").onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    if (!name) return;
    await api("/api/me", { body: { name } });
    await refreshMe();
    route();
  };
}

export function navbar({ title, back, right = "", large = true }) {
  return `<header class="nav" data-nav><div class="nav-row">
    <div class="nav-l">${back ? `<a class="nb" href="${back.href}" aria-label="Back">${ic("back")}<span>${esc(back.label || "")}</span></a>` : ""}</div>
    <div class="nav-title">${esc(title)}</div>
    <div class="nav-r">${right}</div></div></header>
    ${large ? `<div class="wrap"><h1 class="large">${esc(title)}</h1></div>` : ""}`;
}

export function tabbar(cur) {
  const t = (id, href, icon, label) => `<a class="tab" href="${href}"${cur === id ? ' aria-current="page"' : ""}>${ic(icon)}<span>${label}</span></a>`;
  return `<nav class="tabbar" aria-label="Main"><div class="tabs">${t("trips", "#/", "plane", "Trips")}${t("asks", "#/asks", "bag", "My asks")}${t("me", "#/me", "person", "Me")}</div></nav>`;
}

function watchNav() {
  const nav = document.querySelector("[data-nav]");
  if (!nav) return;
  const f = () => nav.classList.toggle("solid", scrollY > 30);
  removeEventListener("scroll", watchNav._f || (() => {}));
  watchNav._f = f; addEventListener("scroll", f, { passive: true }); f();
}

function asksScreen() {
  const rows = store.joined.map((t) => `<a class="row with-thumb" href="#/trip/${t.id}">
      <span class="thumb">${ic("plane")}</span><div class="main"><div class="t">${esc(t.owner)} → ${esc(t.city)}</div><div class="s">${esc(fmtDates(t))}</div></div>${ic("chev", "chev")}</a>`).join("");
  return `<div class="screen">${navbar({ title: "My asks" })}<div class="wrap">
    ${rows ? `<div class="sec"><div class="list">${rows}</div></div>` : `<div class="empty"><div class="glyph">${ic("bag")}</div><b>No asks yet</b><span>When a friend shares a trip link, your requests show up here.</span></div>`}
  </div></div>${tabbar("asks")}`;
}

function meScreen() {
  const u = store.me;
  return `<div class="screen">${navbar({ title: "Me" })}<div class="wrap">
    <div class="sec"><div class="list"><div class="row" style="padding:16px">${av(u, 56)}<div class="main"><div class="t" style="font-size:20px;font-weight:600">${esc(u.name)}</div><div class="s">${u.kept} handover${u.kept === 1 ? "" : "s"} kept</div></div></div></div></div>
    <div class="sec"><div class="sec-h">Safety</div><div class="list">
      <div class="row with-ico"><span class="ico" style="background:var(--green)">${ic("shield")}</span><div class="main"><div class="t">New friend limit</div><div class="s">Up to $50 held until a first handover</div></div></div>
      <div class="row with-ico"><span class="ico" style="background:var(--blue)">${ic("lock")}</span><div class="main"><div class="t">Holds, not payments</div><div class="s">Charged only from the receipt</div></div></div>
      <div class="row with-ico"><span class="ico" style="background:var(--orange)">${ic("scale")}</span><div class="main"><div class="t">Customs</div><div class="s">Indonesia allows USD 500 duty-free per arrival</div></div></div>
    </div></div>
    <div class="sec"><div class="sec-h">Demo</div><div class="list">
      <a class="row" href="#/switch"><div class="main"><div class="t" style="color:var(--blue)">Switch person on this device</div></div></a>
    </div><div class="sec-f">PayPal sandbox · ${store.config?.paypal ? "connected" : "not configured"} · AI ${store.config?.ai ? "on" : "off"}</div></div>
  </div></div>${tabbar("me")}`;
}

async function switchScreen() {
  // demo helper: lists people known to this server via trips this user can see
  const people = new Map();
  for (const t of store.mine) {
    const v = await api(`/api/trips/${t.id}`);
    people.set(v.owner.id, v.owner);
    for (const r of v.requests) people.set(r.friend.id, r.friend);
  }
  const rows = [...people.values()].map((p) => `<button class="row with-thumb" data-uid="${p.id}">${av(p, 44)}<div class="main"><div class="t">${esc(p.name)}</div></div>${p.id === store.me.id ? ic("check", "chev") : ""}</button>`).join("");
  app.innerHTML = `<div class="screen">${navbar({ title: "Switch person", back: { href: "#/me", label: "Me" } })}<div class="wrap">
    <div class="sec"><div class="list">${rows || `<div class="row"><div class="main"><div class="s">Open a trip and get a request first.</div></div></div>`}</div>
    <div class="sec-f">For demos on one device. Each person normally uses their own phone.</div></div></div></div>`;
  app.querySelectorAll("[data-uid]").forEach((b) => b.onclick = async () => { await api("/api/switch", { body: { id: b.dataset.uid } }); await refreshMe(); toast(`You are ${store.me.name}`); location.hash = "#/"; });
  watchNav();
}

export async function route() {
  const hash = location.hash.slice(1) || "/";
  const [path, qs] = hash.split("?");
  const params = new URLSearchParams(qs || "");
  const depth = path.split("/").filter(Boolean).length;
  const backAnim = depth < lastDepth; lastDepth = depth;
  if (path.startsWith("/join/")) { await joinScreen(app, path.split("/")[2]); watchNav(); return; }
  if (!store.me) return welcome();
  try {
    if (path === "/") { await refreshMe(); app.innerHTML = homeScreen(store); bindHome(); }
    else if (path === "/asks") { await refreshMe(); app.innerHTML = asksScreen(); }
    else if (path === "/me") { await refreshMe(); app.innerHTML = meScreen(); app.querySelector('a[href="#/switch"]'); }
    else if (path === "/switch") return switchScreen();
    else if (path.startsWith("/trip/")) await tripScreen(app, path.split("/")[2], params);
    else location.hash = "#/";
  } catch (e) { toast(e.message, "err"); }
  if (backAnim) app.querySelector(".screen")?.classList.add("back");
  watchNav();
  scrollTo({ top: 0 });
}

function bindHome() {
  app.querySelectorAll("[data-new]").forEach((b) => b.onclick = () => newTripSheet(store, (t) => { location.hash = `#/trip/${t.id}`; }));
}

(async () => {
  store.config = await api("/api/config");
  await refreshMe();
  addEventListener("hashchange", route);
  route();
})();
export { fmt };
