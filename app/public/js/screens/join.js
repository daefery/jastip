// Friend opens the traveller's link: sees the trip, asks for an item with a max price.
import { ic, esc, api, av, toast, busy, ART } from "../ui.js";
import { navbar, store, refreshMe } from "../app.js";
import { passCard, fmtDates } from "./home.js";
import { fmt, toMinor, step, CUR } from "../money.js";

export async function joinScreen(app, code) {
  let info;
  try { info = await api(`/api/join/${code}`); }
  catch (e) { app.innerHTML = `<div class="screen"><div class="empty" style="padding-top:20vh"><div class="glyph">${ic("link")}</div><b>Link not valid</b><span>${esc(e.message)}</span></div></div>`; return; }
  const { trip: t, owner } = info;

  if (!store.me) {
    app.innerHTML = `<main class="hello">
      ${av(owner, 84).replace('class="av"', 'class="av" style="margin:0 auto 16px;--c:' + esc(owner.color) + ';--s:84px"')}
      <h1 style="font-size:28px">${esc(owner.name)} is going to ${esc(t.city)}</h1>
      <p>${esc(fmtDates(t))}<br>Ask for something. You pay only the receipt price, and only if it's found.</p>
      <form id="hi"><label class="vh" for="name">Your first name</label><input id="name" class="input-big" placeholder="Your first name" maxlength="24" required autocomplete="given-name">
      <div style="height:12px"></div><button class="btn">Continue</button></form></main>`;
    app.querySelector("#hi").onsubmit = async (e) => { e.preventDefault(); await api("/api/me", { body: { name: app.querySelector("#name").value } }); await refreshMe(); joinScreen(app, code); };
    return;
  }

  const c = CUR[t.currency];
  const st = { title: "", detail: "", art: "other", typical: 0, cap: 0, source: "", found: false };
  const draw = () => {
    app.innerHTML = `<div class="screen">${navbar({ title: `${owner.name}'s trip`, back: { href: "#/", label: "Trips" } })}
      <div class="wrap narrow">
        ${passCard(t, { bottom: `<span style="display:flex;align-items:center;gap:8px">${av(owner, 24)}${esc(owner.name)} · ${owner.kept ? `${owner.kept} handovers kept` : "new traveller"}</span><span>Fee <b class="num">${fmt(t.fee, t.currency)}</b></span>` })}
        <div style="height:24px"></div>
        <form id="ask">
          <div class="sec"><div class="sec-h">What should ${esc(owner.name)} buy?</div>
            <div class="list">
              <div class="field" style="padding-right:8px"><label class="vh" for="src">Link or name</label>
                <input id="src" style="text-align:left" placeholder="Paste a link, or type a name" value="${esc(st.source)}" autocomplete="off">
                <button type="button" class="btn sm" id="find" style="flex:none">${ic("sparkle")}<span>Find</span></button></div>
            </div>
            <div class="sec-f">TikTok, Instagram, a shop link, or just "the round Japanese patches".</div>
          </div>
          ${st.found ? `
          <div class="sec"><div class="list">
            <div class="row with-thumb"><span class="thumb">${ART[st.art] || ART.other}</span>
              <div class="main"><input id="title" aria-label="Item" value="${esc(st.title)}" style="width:100%;border:0;background:none;font-size:17px;font-weight:600;outline:none;color:var(--label)">
              <input id="detail" aria-label="Size or variant" value="${esc(st.detail)}" placeholder="Size, colour, variant" style="width:100%;border:0;background:none;font-size:15px;color:var(--label2);outline:none"></div></div>
          </div>${st.typical ? `<div class="sec-f">${ic("sparkle")} AI guess: about ${fmt(st.typical, t.currency)} there. Check before you set your max.</div>` : ""}</div>
          <div class="sec"><div class="sec-h">Your max price</div><div class="list">
            <div class="row"><div class="main"><div class="t num" id="cap-v" style="font:700 28px/1.2 var(--rounded)">${fmt(st.cap, t.currency)}</div><div class="s">+ ${fmt(t.fee, t.currency)} fee · hold up to <span id="hold-v" class="num">${fmt(st.cap + t.fee, t.currency)}</span></div></div>
              <div class="stepper"><button type="button" data-d="-1" aria-label="Lower">−</button><span></span><button type="button" data-d="1" aria-label="Raise">+</button></div></div>
          </div><div class="sec-f">If it costs more than this, ${esc(owner.name)} won't buy it. You pay the receipt price, not this.</div></div>
          <div class="cta no-tab"><button class="btn" id="send">${ic("arrow")}<span>Ask ${esc(owner.name)}</span></button></div>` : ""}
        </form>
      </div></div>`;
    bind();
  };
  const bind = () => {
    const src = app.querySelector("#src");
    app.querySelector("#find").onclick = async (e) => {
      if (!src.value.trim()) { src.focus(); return; }
      busy(e.currentTarget, true);
      try {
        const r = await api("/api/ai/item", { body: { text: src.value, currency: t.currency, city: t.city } });
        Object.assign(st, { source: src.value, title: r.title || src.value.slice(0, 40), detail: r.detail || "", art: r.art || "other", typical: r.typical ? toMinor(r.typical, t.currency) : 0, found: true });
        // suggest typical + 25%, rounded up to the stepper unit; the friend adjusts
        const unit = step(t.currency);
        st.cap = st.typical ? Math.max(unit, Math.ceil((st.typical * 1.25) / unit) * unit) : unit * 10;
        draw();
      } catch (er) { busy(e.currentTarget, false); toast(er.message, "err"); }
    };
    src.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); app.querySelector("#find").click(); } };
    app.querySelectorAll(".stepper button").forEach((b) => b.onclick = () => {
      st.cap = Math.max(step(t.currency), st.cap + Number(b.dataset.d) * step(t.currency));
      app.querySelector("#cap-v").textContent = fmt(st.cap, t.currency);
      app.querySelector("#hold-v").textContent = fmt(st.cap + t.fee, t.currency);
    });
    const form = app.querySelector("#ask");
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!st.found) return;
      const btn = app.querySelector("#send"); busy(btn, true);
      try {
        await api(`/api/join/${code}/requests`, { body: {
          title: app.querySelector("#title").value, detail: app.querySelector("#detail").value,
          source: st.source, art: st.art, cap: st.cap / 10 ** c.d, typical: st.typical ? st.typical / 10 ** c.d : 0,
        } });
        toast(`Sent to ${owner.name}`);
        location.hash = `#/trip/${t.id}`;
      } catch (er) { busy(btn, false); toast(er.message, "err"); }
    };
  };
  draw();
}
