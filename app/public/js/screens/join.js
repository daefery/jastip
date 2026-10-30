// Friend opens the traveller's link and asks for an item. Works without an account: a name is enough.
import { api, ic, esc, av, toast, busy, pic, cat, dateRange } from "../ui.js";
import { topbar, store, refreshMe } from "../app.js";
import { sceneHTML, skyOf } from "../scenes.js";
import { fmt, toMinor, step, CUR } from "../money.js";

export async function joinView(app, code) {
  let info;
  try { info = await api(`/api/join/${code}`); }
  catch (e) { app.innerHTML = `${topbar()}<main class="page"><div class="empty card"><b>This link doesn't work</b><span>${esc(e.message)}. Ask your friend for a new one.</span><a class="btn dark" href="#/" style="max-width:240px">Go home</a></div></main>`; return; }
  const { trip: t, owner } = info;
  const unit = step(t.currency), dec = CUR[t.currency].d;
  const open = t.status === "open" || t.status === "holds";
  const host = `<div class="host">${av(owner, 52)}<div><b>${esc(owner.name)} is going to ${esc(t.city)}</b><span>${dateRange(t)} · ${owner.kept ? `${owner.kept} handovers kept` : "first trip on Jastip"}</span></div>
    <div class="r"><span>Fee per item</span><b class="num">${fmt(t.fee, t.currency)}</b></div></div>`;

  if (!store.me) {
    app.innerHTML = `${topbar()}<main class="page"><div class="form">${host}
      <h1 class="h1">Want something from ${esc(t.city)}?</h1><p class="lead">Ask ${esc(owner.name)}. You pay the exact receipt price, only if it's found.</p>
      <form id="hi"><label class="field"><span>Your first name</span><input class="input" id="name" autocomplete="given-name" maxlength="24" required></label><button class="btn dark">Continue</button></form></div></main>`;
    app.querySelector("#hi").onsubmit = async (e) => { e.preventDefault(); const n = app.querySelector("#name").value.trim(); if (!n) return; await api("/api/me", { body: { name: n } }); await refreshMe(); joinView(app, code); };
    return;
  }
  if (!open) {
    app.innerHTML = `${topbar({ back: "#/" })}<main class="page"><div class="form">${host}<div class="empty card"><b>${esc(owner.name)} isn't taking asks now</b><span>Shopping has started. Ask on the next trip.</span><a class="btn dark" href="#/trip/${t.id}" style="max-width:260px">See your asks</a></div></div></main>`;
    return;
  }

  const st = { source: "", title: "", detail: "", art: "other", typical: 0, cap: unit * 10, rule: "ask", found: false };
  const draw = () => {
    const hold = st.cap + t.fee;
    app.innerHTML = `${topbar({ back: "#/", title: `Ask ${owner.name}` })}<main class="page"><div class="form two">
      <div>
        ${host}
        <h1 class="h1">What should ${esc(owner.name)} bring?</h1><p class="lead">Paste a TikTok, Instagram or shop link, or just type the name.</p>
        <div class="paste"><label class="vh" for="src">Link or name</label><input id="src" placeholder="tiktok.com/… or “round Japanese patches”" value="${esc(st.source)}" autocomplete="off">
          <button class="btn dark" id="find" type="button">${ic("spark")}Find</button></div>
        ${st.found ? `
        <div class="found">${pic(st.art, 72)}<div style="min-width:0"><span class="ai">${ic("spark")}${st.ai ? "Found by AI · check it" : "Your item"}</span>
          <label class="vh" for="ti">Item</label><input id="ti" value="${esc(st.title)}" maxlength="60"><label class="vh" for="de">Size or variant</label><input class="d" id="de" value="${esc(st.detail)}" placeholder="size, colour, variant" maxlength="60"></div></div>
        ${st.typical ? `<p class="hint">${ic("spark")} Usually about ${fmt(st.typical, t.currency)} in ${esc(t.city)}. AI guess, not a quote.</p>` : ""}
        <div class="sec-t"><span>Your max price</span></div>
        <div class="maxbox"><div><b class="num" id="capv">${fmt(st.cap, t.currency)}</b><span>+ ${fmt(t.fee, t.currency)} fee · hold up to <span id="holdv" class="num" style="font-weight:700;color:var(--ink)">${fmt(hold, t.currency)}</span></span></div>
          <div class="stepper"><button type="button" data-d="-1" aria-label="Lower max">−</button><button type="button" data-d="1" aria-label="Raise max">+</button></div></div>
        <p class="hint">If the shelf price is higher, ${esc(owner.name)} won't buy it.</p>
        <div class="sec-t"><span>If it's sold out</span></div>
        <div class="seg" role="group" aria-label="If sold out">${[["ask", "Ask me", "pick a swap"], ["similar", "Similar ok", "within my max"], ["skip", "Skip", "release my hold"]].map(([v, l, s]) => `<button type="button" data-rule="${v}" aria-pressed="${st.rule === v}">${l}<small>${s}</small></button>`).join("")}</div>` : ""}
      </div>
      <aside class="side">${st.found ? `
        <div class="card pad"><div class="sec-t" style="margin-top:0"><span>What happens next</span></div>
          <div class="tline">
            <div class="tl done"><span class="d"></span><span>You ask</span><span>now</span></div>
            <div class="tl"><span class="d"></span><span>${esc(owner.name)} accepts</span><span></span></div>
            <div class="tl"><span class="d"></span><span class="pp">You approve a PayPal hold · <b class="num" data-hold2>${fmt(hold, t.currency)}</b></span><span></span></div>
            <div class="tl"><span class="d"></span><span class="ok">You pay the receipt price + fee</span><span></span></div>
            <div class="tl"><span class="d"></span><span>You get your item</span><span></span></div></div>
          <div style="height:12px"></div><button class="btn dark" id="send">${ic("arrow")}Ask ${esc(owner.name)}</button>
          <p class="hint" style="text-align:center">Nothing is charged now.</p></div>` : `
        <div class="card" style="overflow:hidden"><div class="scene" style="--sky:${skyOf("asked")};height:220px">${sceneHTML("asked")}</div>
          <div style="padding:16px"><b>You pay the receipt price.</b><p class="hint" style="margin:4px 0 0">PayPal only holds your max. If ${esc(owner.name)} can't find it, nothing is charged.</p></div></div>`}
      </aside></div></main>
      ${st.found ? `<div class="actbar only-phone"><button class="btn dark" id="send2">${ic("arrow")}Ask ${esc(owner.name)}</button></div>` : ""}`;
    bind();
  };
  const bind = () => {
    const src = app.querySelector("#src");
    const find = async (btn) => {
      if (!src.value.trim()) { src.focus(); return; }
      busy(btn, true);
      try {
        const r = await api("/api/ai/item", { body: { text: src.value, currency: t.currency, city: t.city } });
        Object.assign(st, { source: src.value, title: r.title || src.value.slice(0, 40), detail: r.detail || "", art: cat(r.art), typical: r.typical ? toMinor(r.typical, t.currency) : 0, found: true, ai: r.ai });
        st.cap = st.typical ? Math.max(unit, Math.ceil((st.typical * 1.25) / unit) * unit) : unit * 10;
        draw();
        app.querySelector("#ti")?.focus({ preventScroll: true });
      } catch (e) { busy(btn, false); toast(e.message, "err"); }
    };
    app.querySelector("#find").onclick = (e) => find(e.currentTarget);
    src.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); find(app.querySelector("#find")); } };
    app.querySelectorAll(".stepper button").forEach((b) => b.onclick = () => {
      st.cap = Math.max(unit, st.cap + Number(b.dataset.d) * unit);
      app.querySelector("#capv").textContent = fmt(st.cap, t.currency);
      app.querySelector("#holdv").textContent = fmt(st.cap + t.fee, t.currency);
      app.querySelectorAll("[data-hold2]").forEach((x) => (x.textContent = fmt(st.cap + t.fee, t.currency)));
    });
    app.querySelectorAll("[data-rule]").forEach((b) => b.onclick = () => { st.rule = b.dataset.rule; app.querySelectorAll("[data-rule]").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
    const send = async (btn) => {
      st.title = app.querySelector("#ti").value.trim() || st.title; st.detail = app.querySelector("#de").value.trim();
      busy(btn, true);
      try {
        await api(`/api/join/${code}/requests`, { body: { title: st.title, detail: st.detail, source: st.source, art: st.art, rule: st.rule, cap: st.cap / 10 ** dec, typical: st.typical ? st.typical / 10 ** dec : 0 } });
        toast(`Sent to ${owner.name}`);
        location.hash = `#/trip/${t.id}`;
      } catch (e) { busy(btn, false); toast(e.message, "err"); }
    };
    app.querySelectorAll("#send,#send2").forEach((b) => b.onclick = () => send(b));
  };
  draw();
}
