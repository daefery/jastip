import { ic, esc, api, sheet, toast, busy } from "../ui.js";
import { navbar, tabbar } from "../app.js";
import { fmt } from "../money.js";

const STATUS = { open: ["Taking requests", "blue"], holds: ["Holds open", "orange"], shopping: ["Shopping", "orange"], settled: ["Settled", "green"] };

export function passCard(t, opts = {}) {
  const [label, tone] = STATUS[t.status] || ["", ""];
  return `<div class="passcard${opts.small ? " small" : ""}">
    <div class="top"><span>${ic("plane", "")} JASTIP</span><span class="pill" style="background:rgba(255,255,255,.2);color:#fff">${esc(label)}</span></div>
    <div class="route"><div><div class="code">${esc(t.home_code)}</div><div class="city">${esc(t.home)}</div></div>
      <div class="plane">${ic("plane")}<span>${esc(fmtDates(t))}</span></div>
      <div class="to"><div class="code">${esc(t.city_code)}</div><div class="city">${esc(t.city)}</div></div></div>
    ${opts.bottom ? `<div class="bot">${opts.bottom}</div>` : ""}
  </div>`;
}
export function fmtDates(t) {
  const d = (s) => new Date(s + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${d(t.depart)} – ${d(t.ret)}`;
}

export function homeScreen(store) {
  const mine = store.mine;
  const cards = mine.map((t) => `<a href="#/trip/${t.id}" style="display:block;margin-bottom:14px">${passCard(t, { bottom: `<span>Fee per item</span><b class="num">${fmt(t.fee, t.currency)}</b>` })}</a>`).join("");
  return `<div class="screen">${navbar({ title: "Trips", right: `<button class="nb round" data-new aria-label="New trip">${ic("plus")}</button>` })}
    <div class="wrap">
      ${mine.length ? `<div class="sec trips-grid">${cards}</div>` : `
        <div class="empty"><div class="glyph">${ic("plane")}</div><b>Going somewhere?</b><span>Open a trip and share the link.<br>Friends ask, PayPal holds, you shop.</span></div>
        <div class="wrap" style="max-width:420px"><button class="btn" data-new>${ic("plus")}<span>New trip</span></button></div>`}
    </div></div>${tabbar("trips")}`;
}

export function newTripSheet(store, done) {
  const places = store.config.places, homes = store.config.homes;
  const today = new Date(); const iso = (d) => d.toISOString().slice(0, 10);
  const d1 = new Date(today.getTime() + 2 * 864e5), d2 = new Date(today.getTime() + 7 * 864e5);
  const s = sheet({
    title: "New Trip",
    left: `<button class="nb" data-close>Cancel</button>`,
    right: `<button class="nb" id="nt-save" style="font-weight:600">Open</button>`,
    body: `<form id="nt">
      <div class="sec"><div class="list">
        <div class="field"><label for="nt-from">From</label><select id="nt-from">${homes.map((h) => `<option value="${h.code}">${esc(h.city)}</option>`).join("")}</select></div>
        <div class="field"><label for="nt-to">To</label><select id="nt-to">${places.map((p) => `<option value="${p.code}">${esc(p.city)} · ${p.cur}</option>`).join("")}</select></div>
      </div><div class="sec-f">PayPal holds friends' money in the trip's currency.</div></div>
      <div class="sec"><div class="list">
        <div class="field"><label for="nt-d1">Depart</label><input id="nt-d1" type="date" value="${iso(d1)}"></div>
        <div class="field"><label for="nt-d2">Return</label><input id="nt-d2" type="date" value="${iso(d2)}"></div>
      </div></div>
      <div class="sec"><div class="list">
        <div class="field"><label for="nt-fee">Fee / item</label><input id="nt-fee" type="number" inputmode="decimal" min="0" step="1" value="300"><span id="nt-cur" style="color:var(--label2)">JPY</span></div>
        <div class="field"><label for="nt-pp">Paid to</label><input id="nt-pp" type="email" inputmode="email" placeholder="your PayPal email" autocomplete="email"></div>
      </div><div class="sec-f">Charges go straight to this PayPal account. Leave empty to use the app's sandbox account.</div></div>
    </form>`,
  });
  const to = s.el.querySelector("#nt-to"), cur = s.el.querySelector("#nt-cur"), fee = s.el.querySelector("#nt-fee");
  const sync = () => { const p = places.find((x) => x.code === to.value); cur.textContent = p.cur; fee.value = p.cur === "JPY" ? 300 : p.cur === "TWD" ? 60 : 2; };
  to.onchange = sync; sync();
  const save = async () => {
    const btn = s.el.querySelector("#nt-save");
    busy(btn, true);
    try {
      const r = await api("/api/trips", { body: {
        home_code: s.el.querySelector("#nt-from").value, city_code: to.value,
        depart: s.el.querySelector("#nt-d1").value, ret: s.el.querySelector("#nt-d2").value,
        fee: Number(fee.value || 0), payee_email: s.el.querySelector("#nt-pp").value,
      } });
      s.close(); toast("Trip opened"); done(r.trip);
    } catch (e) { busy(btn, false); toast(e.message, "err"); }
  };
  s.el.querySelector("#nt-save").onclick = save;
  s.el.querySelector("#nt").onsubmit = (e) => { e.preventDefault(); save(); };
}
