// Traveller opens a trip.
import { api, ic, esc, toast, busy } from "../ui.js";
import { topbar, store } from "../app.js";

export function newTripView(app) {
  const { places, homes } = store.config;
  const iso = (d) => d.toISOString().slice(0, 10);
  const d1 = new Date(Date.now() + 2 * 864e5), d2 = new Date(Date.now() + 7 * 864e5);
  app.innerHTML = `${topbar({ back: "#/", title: "New trip" })}<main class="page"><form class="form" id="nt" novalidate>
    <h1 class="h1">Where are you going?</h1><p class="lead">Friends will ask for things from there. PayPal holds their money in that currency.</p>
    <div class="row2">
      <label class="field"><span>From</span><select class="select" id="from">${homes.map((h) => `<option value="${h.code}">${esc(h.city)}</option>`).join("")}</select></label>
      <label class="field"><span>To</span><select class="select" id="to">${places.map((p) => `<option value="${p.code}">${esc(p.city)} · ${p.cur}</option>`).join("")}</select></label>
    </div>
    <div class="row2">
      <label class="field"><span>Leave</span><input class="input" type="date" id="d1" value="${iso(d1)}" required></label>
      <label class="field"><span>Back</span><input class="input" type="date" id="d2" value="${iso(d2)}" required></label>
    </div>
    <label class="field"><span>Your fee per item (<b id="cur">JPY</b>)</span><input class="input" type="number" inputmode="decimal" min="0" step="1" id="fee" value="300"></label>
    <label class="field"><span>Your PayPal email (paid to)</span><input class="input" type="email" inputmode="email" autocomplete="email" id="pp" placeholder="optional in the demo"></label>
    <div class="note">${ic("shield")}<span>Charges go straight to your PayPal. Jastip never holds the money. Friends pay ¥0 until your receipt.</span></div>
    <div style="height:16px"></div>
    <button class="btn dark" id="go">${ic("plane")}Open trip</button>
  </form></main>`;
  const to = app.querySelector("#to"), fee = app.querySelector("#fee"), cur = app.querySelector("#cur");
  const sync = () => { const p = places.find((x) => x.code === to.value); cur.textContent = p.cur; fee.value = p.cur === "JPY" ? 300 : p.cur === "TWD" ? 60 : 2; };
  to.onchange = sync; sync();
  app.querySelector("#nt").onsubmit = async (e) => {
    e.preventDefault();
    const btn = app.querySelector("#go"); busy(btn, true);
    try {
      const r = await api("/api/trips", { body: { home_code: app.querySelector("#from").value, city_code: to.value, depart: app.querySelector("#d1").value, ret: app.querySelector("#d2").value, fee: Number(fee.value || 0), payee_email: app.querySelector("#pp").value } });
      toast("Trip opened. Share the link.");
      location.hash = `#/trip/${r.trip.id}?share=1`;
    } catch (er) { busy(btn, false); toast(er.message, "err"); }
  };
}
