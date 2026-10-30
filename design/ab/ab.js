// A+B prototype: one trip, two phones' worth of views. State drives everything; every control is a real tap.
const $ = (s, el = document) => el.querySelector(s);
const P = {
  plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 4.5 7.5 12l7.5 7.5" stroke-width="2.6"/>',
  up: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke-width="2.6"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="3"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="2.6"/>', swap: '<path d="M5 8h13l-3.5-3.5M19 16H6l3.5 3.5" stroke-width="2.4"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  bag: '<path d="M5 8h14l-1.2 12a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4L12 18.4"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z"/><path d="M4 7V6a2 2 0 0 1 2-2h10v3"/><circle cx="16" cy="13.5" r="1.3" fill="currentColor"/>',
  spark: '<path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z" fill="currentColor" stroke="none"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  compose: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  // product art
  snack: '<path d="M12 3.5a8.5 8.5 0 1 0 8.4 9.8 3 3 0 0 1-3.6-3.6 3 3 0 0 1-3.2-3.2A3 3 0 0 1 12 3.5z"/><circle cx="8.5" cy="11" r=".8" fill="currentColor"/><circle cx="11" cy="15.5" r=".8" fill="currentColor"/>',
  beauty: '<rect x="8" y="9" width="8" height="12" rx="2"/><path d="M10 9V6.5h4V9M11 3.5h2v3h-2z"/>',
  med: '<rect x="4" y="8" width="16" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="m9.7 15.3 4.6-6.6"/>',
};
const ic = (n, c = "i") => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
const Y = (n) => "¥" + Math.round(n).toLocaleString("en-US");
const av = (p, s) => `<span class="av" style="--c:${p.c}${s ? `;--s:${s}px` : ""}">${p.n[0]}</span>`;

const PEOPLE = { dina: { n: "Dina", c: "#5e5ce6" }, ayu: { n: "Ayu", c: "#ff375f" }, bima: { n: "Bima", c: "#ff9f0a" }, citra: { n: "Citra", c: "#30b0c7" } };
const FEE = 100;
const REQ = {
  ayu: { who: "ayu", title: "Matcha KitKat", d: "Big bag · Otona no Amasa", art: "snack", g: "g-snack", cap: 1500, typical: 1200, line: "KITKAT ｵﾄﾅﾉｱﾏｻ 抹茶 大袋", price: 1188 },
  bima: { who: "bima", title: "Tokyo Banana", d: "8 pack", art: "snack", g: "g-sweet", cap: 1800, swapTitle: "Tokyo Banana 4 pack", line: "東京ﾊﾞﾅﾅ ﾐｴﾀｯﾀ 4個入", price: 648 },
  citra: { who: "citra", title: "Hada Labo lotion", d: "Gokujyun 170ml", art: "beauty", g: "g-beauty", cap: 1200, line: "ﾊﾀﾞﾗﾎﾞ 極潤 ﾋｱﾙﾛﾝ液 170ml", price: 968 },
  citra2: { who: "citra", title: "Roihi patches", d: "156 pcs", art: "med", g: "g-med", cap: 1300 },
};
const hold = (k) => REQ[k].cap + FEE;
const charge = (k) => REQ[k].price + FEE;

// The story, in order. Each step says whose phone shows the action.
const STEPS = ["open", "ayuAsk", "accept", "day", "ayuHold", "shop", "swapAsk", "bimaSwap", "receipt", "settled", "got"];
const S = { step: 0, as: "dina", tab: "chat", view: "chat", cap: 1500, rule: "ask", tray: false, sheet: null, openPass: null, scrolled: false };
const at = (id) => S.step >= STEPS.indexOf(id);
const nowIs = (id) => S.step === STEPS.indexOf(id);

/* ------------------------------------------------ chat log (built from state) */
function chatItems() {
  const me = S.as;
  const L = [];
  const msg = (who, text, extra = "") => L.push({ t: "msg", who, text, extra });
  L.push({ t: "day", text: "<b>Thu 29 Oct</b> 20:14" });
  L.push({ t: "sys", text: `<b>Dina</b> opened a trip to Tokyo · 1–6 Nov` });
  msg("dina", "Flying to Tokyo Sunday! Titip apa? Paste a link here 🙌");
  if (at("accept")) {
    msg("bima", "tokyo banana 8 pcs ya!");
    L.push({ t: "card", kind: "askDone", k: "bima" });
    L.push({ t: "card", kind: "askDone", k: "citra" });
    msg("ayu", "matcha kitkat yg big bag dong 😭");
    L.push({ t: "card", kind: "ask", k: "ayu" });
  }
  if (at("day")) {
    L.push({ t: "day", text: "<b>Sat 31 Oct</b> 09:02" });
    msg("dina", "Shopping day Monday at Don Quijote. Approve your hold 👇");
    L.push({ t: "card", kind: "holdAsk", k: me === "dina" ? null : me });
  }
  if (at("shop")) {
    L.push({ t: "sys", text: `<b>4 holds approved</b> · ${Y(hold("ayu") + hold("bima") + hold("citra") + hold("citra2"))} held by PayPal · ¥0 charged` });
    L.push({ t: "day", text: "<b>Mon 2 Nov</b> 18:31 · Don Quijote Shibuya" });
  }
  if (at("swapAsk")) L.push({ t: "card", kind: "swap", k: "bima" });
  if (at("receipt")) { msg("bima", "take it! makasih 🙏", ""); }
  if (at("settled")) {
    L.push({ t: "card", kind: "receipt" });
    msg("ayu", "wah pas banget, ¥312 ga kepake 🙌", "tb");
  }
  if (at("got")) {
    L.push({ t: "day", text: "<b>Sat 7 Nov</b> 16:10" });
    L.push({ t: "sys", text: "<b>Ayu</b> got the Matcha KitKat · handover confirmed" });
  }
  return L;
}

function passHTML(kind, k) {
  const r = k ? REQ[k] : null;
  const p = r ? PEOPLE[r.who] : null;
  const isDina = S.as === "dina";
  const art = r ? `<div class="art">${ic(r.art)}</div>` : "";
  if (kind === "ask" || kind === "askDone") {
    const accepted = S.step > STEPS.indexOf("accept");
    const state = at("shop") ? "Held" : accepted ? "Accepted" : "Request";
    const showAccept = kind === "ask" && isDina && nowIs("accept");
    return `<div class="pass ${r.g}" data-pass="${k}"><div class="ph"><div class="k"><span>${state} · ${p.n}</span><span class="pp">PayPal</span></div>${art}
      <div class="t">${r.title}</div><div class="d">${r.d}</div>
      <div class="amt"><div><small>Max price</small><b class="num">${Y(r.cap)}</b></div><div class="r">${r.typical ? `~${Y(r.typical)} usual` : ""}</div></div></div>
      ${showAccept ? `<div class="act"><button data-act="decline">Decline</button><button data-act="accept" style="font-weight:700">Accept all 4</button></div>` : accepted && kind === "ask" ? `<div class="done">${ic("check")}Accepted by Dina</div>` : ""}</div>`;
  }
  if (kind === "holdAsk") {
    if (isDina) {
      const n = at("shop") ? 4 : nowIs("ayuHold") ? 3 : 0;
      return `<div class="pass g-hold"><div class="ph"><div class="k"><span>Holds · Mon 2 Nov</span><span class="pp">PayPal</span></div>
        <div class="t">${n}/4 friends approved</div><div class="d">Nothing is charged until the receipt</div>
        <div class="amt"><div><small>Held for you</small><b class="num">${Y(at("shop") ? 6200 : n === 3 ? 4600 : 0)}</b></div><div class="r">max</div></div></div>
        ${nowIs("ayuHold") ? `<div class="done">${ic("lock")}Waiting for Ayu</div>` : at("shop") ? `<div class="done">${ic("check")}All held</div>` : ""}</div>`;
    }
    const kk = S.as === "ayu" ? "ayu" : S.as;
    const rr = REQ[kk];
    const held = at("shop");
    return `<div class="pass ${held ? "g-hold" : rr.g}" data-pass="${kk}"><div class="ph"><div class="k"><span>${held ? "On hold" : "Your hold"}</span><span class="pp">PayPal</span></div><div class="art">${ic(rr.art)}</div>
      <div class="t">${rr.title}</div><div class="d">${held ? "Held by PayPal · not charged" : "Charged the receipt price on Monday"}</div>
      <div class="amt"><div><small>${held ? "Held" : "Up to"}</small><b class="num">${Y(hold(kk))}</b></div><div class="r">¥0 today</div></div></div>
      ${!held && nowIs("ayuHold") ? `<div class="act"><button class="ppb" data-act="holdSheet">Hold with <b>Pay<i>Pal</i></b></button></div>` : held ? `<div class="done">${ic("lock")}Approved</div>` : ""}</div>`;
  }
  if (kind === "swap") {
    const done = at("receipt");
    const canAnswer = S.as === "bima" && nowIs("bimaSwap");
    return `<div class="pass g-sweet"><div class="ph"><div class="k"><span>Swap for ${PEOPLE.bima.n}</span><span class="pp">PayPal</span></div><div class="art">${ic("snack")}</div>
      <div class="t">8 pack sold out</div><div class="d">4 pack instead? Within your max</div>
      <div class="amt"><div><small>Shelf price</small><b class="num">¥648</b></div><div class="r">max ${Y(REQ.bima.cap)}</div></div></div>
      ${canAnswer ? `<div class="act"><button data-act="swapNo">Skip</button><button data-act="swapYes" style="font-weight:700">Take it</button></div>` : done ? `<div class="done">${ic("check")}Bima took the 4 pack</div>` : `<div class="done">${ic("swap")}Waiting for Bima</div>`}</div>`;
  }
  if (kind === "receipt") {
    const rows = ["ayu", "bima", "citra"];
    const lines = rows.map((x) => `<div class="l">${av(PEOPLE[REQ[x].who], 18)}<span>${REQ[x].line}</span><span>${Y(REQ[x].price)}</span></div>`).join("") + `<div class="l"><span></span><span>ﾚｼﾞ袋 L</span><span>¥5</span></div>`;
    const mine = S.as !== "dina" ? S.as : null;
    const shares = rows.filter((x) => !mine || REQ[x].who === mine).map((x) => `<div class="s">${av(PEOPLE[REQ[x].who], 22)}<span>${PEOPLE[REQ[x].who].n}${x === "bima" ? '<span class="sw">swap</span>' : ""}</span><b class="num">${Y(charge(x))}</b></div>`).join("")
      + (!mine || mine === "citra" ? `<div class="s x">${av(PEOPLE.citra, 22)}<span>Patches · not found</span><b>¥1,400 released</b></div>` : "");
    const total = rows.reduce((s, x) => s + charge(x), 0);
    return `<div class="pass g-receipt" style="width:286px"><div class="rc"><div class="shop">ドン・キホーテ 渋谷本店</div><hr>${lines}</div>
      <div class="flowrow"><div class="avs">${av(PEOPLE.ayu)}${av(PEOPLE.bima)}${av(PEOPLE.citra)}</div><div class="arr num">${Y(total)}</div>${av(PEOPLE.dina, 26)}</div>
      <div class="shares">${shares}</div></div>`;
  }
  return "";
}

function chatHTML() {
  const items = chatItems();
  let lastWho = null;
  const out = [];
  for (const it of items) {
    if (it.hidden) continue;
    if (it.t === "day") { out.push(`<div class="day">${it.text}</div>`); lastWho = null; continue; }
    if (it.t === "sys") { out.push(`<div class="sys">${it.text}</div>`); lastWho = null; continue; }
    const who = it.t === "card" ? (it.kind === "ask" || it.kind === "askDone" ? REQ[it.k].who : it.kind === "receipt" || it.kind === "holdAsk" || it.kind === "swap" ? "dina" : "dina") : it.who;
    const mine = who === S.as;
    if (!mine && who !== lastWho) out.push(`<div class="from">${PEOPLE[who].n}</div>`);
    const body = it.t === "card" ? passHTML(it.kind, it.k) : `<div class="bub${it.extra === "tb" ? " tapback" : ""}"${it.extra === "tb" ? ' data-tb="❤️"' : ""}>${it.text}</div>`;
    out.push({ who, mine, body });
    lastWho = who;
  }
  return out.map((o, i) => {
    if (typeof o === "string") return o;
    const nx = out[i + 1];
    const lastOfRun = !nx || typeof nx === "string" || nx.who !== o.who;
    return `<div class="msg${o.mine ? " me" : ""}">${o.mine ? "" : lastOfRun ? av(PEOPLE[o.who], 28) : '<span class="sp"></span>'}${o.body}</div>`;
  }).join("");
}

/* ------------------------------------------------ views */
function topBar(sub) {
  const ppl = ["dina", "ayu", "bima", "citra"].map((x) => av(PEOPLE[x], 30)).join("");
  return `<div class="top"><div class="top-row"><button class="back-b" data-act="home">${ic("back")}<span>Trips</span></button>
    <div class="who"><div class="avs">${ppl}</div><b>Jastip Tokyo · Dina</b><small>${sub}</small></div>
    <div class="top-r"></div></div>
    <div class="seg" role="group" aria-label="Chat or Wallet"><button data-act="tab" data-tab="chat" aria-pressed="${S.tab === "chat"}">Chat</button><button data-act="tab" data-tab="wallet" aria-pressed="${S.tab === "wallet"}">Wallet</button></div></div>`;
}

function subtitle() {
  if (at("settled")) return "Settled · Mon 2 Nov";
  if (at("shop")) return "Shopping now · Don Quijote";
  if (at("day")) return "Shopping Mon 2 Nov";
  return "1–6 Nov · 4 people";
}

function composerHTML() {
  const isDina = S.as === "dina";
  const tray = S.tray ? `<div class="tray">${isDina ? `
      <button data-act="share"><span class="ti" style="background:#5e5ce6">${ic("share")}</span><div><b>Share trip link</b><span>Friends join from WhatsApp, no app needed</span></div></button>
      ${at("shop") && !at("settled") ? `<button data-act="shopMode"><span class="ti" style="background:#30d158">${ic("bag")}</span><div><b>Shopping list</b><span>Tick items as they go in the basket</span></div></button>
      <button data-act="scan"><span class="ti" style="background:#ff9f0a">${ic("camera")}</span><div><b>Scan receipt</b><span>One photo, exact charges</span></div></button>` : ""}`
    : `<button data-act="askSheet"><span class="ti" style="background:#ff375f">${ic("link")}</span><div><b>Ask for an item</b><span>Paste a link or type a name</span></div></button>`}
    <button data-act="tab" data-tab="wallet"><span class="ti" style="background:#0a84ff">${ic("wallet")}</span><div><b>Wallet</b><span>Holds and charges for this trip</span></div></button></div>` : "";
  return `${tray}<div class="composer"><button class="plus${S.tray ? " open" : ""}" data-act="tray" aria-label="Actions">${ic("plus")}</button><div class="field">iMessage</div></div>`;
}

function walletHTML() {
  const me = S.as;
  const keys = me === "dina" ? ["ayu", "bima", "citra", "citra2"] : Object.keys(REQ).filter((k) => REQ[k].who === me);
  const st = (k) => {
    if (at("settled")) return k === "citra2" ? "void" : "paid";
    if (at("shop")) return "held";
    if (k === "ayu" && nowIs("ayuHold")) return "ask";
    if (at("ayuHold") && k !== "ayu") return "held";
    return at("ayuAsk") ? "ask" : "none";
  };
  const cards = keys.filter((k) => st(k) !== "none").map((k) => {
    const r = REQ[k], s = st(k), p = PEOPLE[r.who];
    const g = s === "paid" ? "g-paid" : s === "void" ? "g-void" : s === "held" ? "g-hold" : r.g;
    const label = { ask: "Requested", held: "On hold", paid: "Charged", void: "Released" }[s];
    const big = s === "paid" ? Y(charge(k)) : s === "void" ? "¥0" : Y(hold(k));
    const right = s === "paid" ? `${Y(hold(k) - charge(k))} never taken` : s === "void" ? `${Y(hold(k))} released` : s === "held" ? "¥0 charged" : "";
    const tl = [
      ["Asked", "Thu 29 Oct"], ...(s !== "ask" ? [["Hold approved", "Sat 31 Oct"]] : []),
      ...(s === "paid" ? [["Receipt line", `<code>${r.line || ""}</code>`], ["Captured", `<code>${Y(charge(k))}</code>`]] : []),
      ...(s === "void" ? [["Not on receipt", "Void"]] : []),
    ].map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join("");
    return `<div class="pass ${g}${S.openPass === k ? " open" : ""}" data-act="openPass" data-k="${k}"><div class="ph"><div class="k"><span>${label}${me === "dina" ? " · " + p.n : ""}</span><span class="kamt num">${big}</span></div><div class="art">${ic(r.art)}</div>
      <div class="t">${k === "bima" && at("receipt") ? r.swapTitle : r.title}</div><div class="d">${r.d}</div>
      <div class="amt"><div><small>${s === "paid" ? "Paid" : s === "void" ? "Charged" : "Max held"}</small><b class="num">${big}</b></div><div class="r">${right}</div></div></div>
      ${S.openPass === k ? `<div class="timeline">${tl}</div>` : ""}</div>`;
  }).join("");
  const held = keys.filter((k) => st(k) === "held").reduce((s, k) => s + hold(k), 0);
  const paid = keys.filter((k) => st(k) === "paid").reduce((s, k) => s + charge(k), 0);
  const never = keys.filter((k) => st(k) === "paid" || st(k) === "void").reduce((s, k) => s + hold(k) - (st(k) === "paid" ? charge(k) : 0), 0);
  const sum = me === "dina"
    ? `<div class="wsum"><div class="z"><b class="num">${Y(paid)}</b><span>paid to you</span></div><div><b class="num">${Y(held)}</b><span>held</span></div><div><b class="num">${Y(paid ? keys.filter((k) => st(k) === "paid").length * FEE : 0)}</b><span>your fees</span></div></div>`
    : `<div class="wsum"><div class="z"><b class="num">¥0</b><span>paid upfront</span></div><div><b class="num">${Y(paid || held)}</b><span>${paid ? "paid" : "held"}</span></div><div><b class="num">${Y(never)}</b><span>never taken</span></div></div>`;
  return `<div class="wallet">${sum}<div class="stackw">${cards || `<div class="sys">No holds yet</div>`}</div></div>`;
}

function shopHTML() {
  const rows = ["ayu", "bima", "citra", "citra2"].map((k) => {
    const r = REQ[k], p = PEOPLE[r.who];
    const state = k === "citra2" ? (at("swapAsk") ? "x" : "") : k === "bima" ? (at("receipt") ? "on" : at("swapAsk") ? "sw" : "") : at("swapAsk") ? "on" : "";
    const sub = k === "bima" && at("swapAsk") && !at("receipt") ? "Waiting for Bima · 4 pack ¥648" : k === "bima" && at("receipt") ? "Swap · 4 pack ¥648" : `${p.n} · max ${Y(r.cap)}`;
    return `<div class="sitem"><div class="ph" style="background:var(--g)" ><span class="${r.g}" style="display:grid;place-items:center;width:64px;height:64px;border-radius:14px;background:var(--g)">${ic(r.art)}</span></div>
      <div><b>${k === "bima" && at("receipt") ? r.swapTitle : r.title}</b><span>${sub}</span></div>
      <button class="tick ${state}" aria-label="mark">${ic(state === "x" ? "x" : state === "sw" ? "swap" : "check")}</button></div>`;
  }).join("");
  return `<div class="shop"><div class="sys" style="margin-bottom:10px">Tap ✓ when it's in the basket · hold the circle for <b>swap</b> or <b>not found</b></div>${rows}
    ${nowIs("shop") ? `<button class="big-b blue" data-act="doShop" style="margin-top:8px">${ic("check")}KitKat, lotion in · banana sold out</button>` : ""}
    ${at("receipt") && !at("settled") ? `<button class="big-b white" data-act="scan" style="margin-top:8px">${ic("camera")}Scan receipt</button>` : ""}</div>`;
}

function tripsHTML() {
  const me = S.as;
  const last = at("settled") ? (me === "dina" ? "Ayu: wah pas banget, ¥312 ga kepake 🙌" : "Receipt · you paid " + Y(charge(me === "citra" ? "citra" : me))) : at("shop") ? "Shopping now · Don Quijote" : at("day") ? "Dina: Approve your hold 👇" : "Dina: Titip apa? Paste a link here 🙌";
  const pill = me === "dina" ? (at("settled") ? `<span class="mpill g">+¥3,104</span>` : at("shop") ? `<span class="mpill h">¥6,200 held</span>` : "") : (at("settled") ? `<span class="mpill g">${Y(charge(me === "citra" ? "citra" : me))} paid</span>` : at("shop") ? `<span class="mpill h">${Y(hold(me === "citra" ? "citra" : me))} held</span>` : "");
  return `<div class="view"><div class="top" style="border:0;background:#000"><div class="top-row"><span></span><span></span><div class="top-r"><button class="icon-b" data-act="${me === "dina" ? "noop" : "noop"}">${ic("compose")}</button></div></div></div>
    <div class="large">Trips</div>
    <div class="trips">
      <button class="trow" data-act="openTrip"><div class="gav">${av(PEOPLE.dina, 34)}${av(PEOPLE.ayu, 34)}</div><div><b>Jastip Tokyo · Dina</b><div class="last">${last}</div></div><div class="r"><span>${at("settled") ? "Mon" : at("shop") ? "18:31" : "Sat"}</span>${pill}</div></button>
      <div class="trow" style="opacity:.6"><div class="gav">${av({ n: "Rani", c: "#64d2ff" }, 34)}${av({ n: "Joko", c: "#bf5af2" }, 34)}</div><div><b>Jastip Seoul · Rani</b><div class="last">Rani: closed · 6 items delivered</div></div><div class="r"><span>Sep</span><span class="mpill g">${me === "dina" ? "+₩0" : "₩38,000 paid"}</span></div></div>
      ${me === "dina" ? `<button class="newtrip" data-act="noop">${ic("plus")}<div><b>New trip</b><span>Going somewhere? Friends ask, PayPal holds.</span></div></button>` : ""}
    </div></div>`;
}

function sheetHTML() {
  if (S.sheet === "hold") return `<div class="scrim" data-act="closeSheet"></div><div class="sheet light"><div class="grab"></div>
    <div class="sh-h"><span class="sbx">Sandbox</span><button data-act="closeSheet">Cancel</button></div>
    <div class="pplogo">Pay<i>Pal</i></div>
    <div class="ppamt num">${Y(hold("ayu"))}</div><div class="ppsub">Hold for Dina's trip to Tokyo</div>
    <div class="pplines"><div><span>Matcha KitKat, max</span><b class="num">${Y(REQ.ayu.cap)}</b></div><div><span>Dina's fee</span><span class="num">¥100</span></div><div><span><b>Charged today</b></span><b>¥0</b></div></div>
    <div class="ppnote">${ic("lock")}<span>On Monday you're charged the exact receipt price plus fee. Not found? The hold is released.</span></div>
    <button class="big-b pp" data-act="doHold">Agree &amp; hold with <b>Pay<i>Pal</i></b></button></div>`;
  if (S.sheet === "ask") return `<div class="scrim" data-act="closeSheet"></div><div class="sheet"><div class="grab"></div>
    <div class="sh-h"><button data-act="closeSheet">Cancel</button><b>Ask Dina</b><button data-act="doAsk" style="font-weight:700">Send</button></div>
    <div class="input" style="color:#64a8ff">tiktok.com/@snackjp/video/7431…</div>
    <div class="found"><div class="ph g-snack" style="background:var(--g)">${ic("snack")}</div><div><span style="color:#bf5af2;font-weight:700">${ic("spark", "i")} Found it</span><b>Matcha KitKat, big bag</b><span>Usually about ¥1,200 in Tokyo</span></div></div>
    <div class="maxbox"><div><b class="num">${Y(S.cap)}</b><small>your max · + ¥100 fee</small></div><div class="stp"><button data-act="cap" data-d="-100">−</button><button data-act="cap" data-d="100">+</button></div></div>
    <div class="label">If it's sold out</div>
    <div class="rules">${[["ask", "Ask me"], ["similar", "Any similar"], ["skip", "Skip it"]].map(([v, l]) => `<button data-act="rule" data-v="${v}" aria-pressed="${S.rule === v}">${l}</button>`).join("")}</div>
    <button class="big-b blue" data-act="doAsk">Send to Dina</button></div>`;
  if (S.sheet === "scan") return `<div class="scrim" data-act="closeSheet"></div><div class="sheet"><div class="grab"></div>
    <div class="sh-h"><button data-act="closeSheet">Cancel</button><b>Receipt</b><span style="width:56px"></span></div>
    <div style="border-radius:16px;overflow:hidden;background:#fffdf6;color:#222;position:relative">${passHTML("receipt").replace('class="pass g-receipt" style="width:286px"', 'class="pass g-receipt" style="width:100%;box-shadow:none"')}</div>
    <div class="sys" style="margin:12px 0">Read in 11 s. Each friend pays their line + ¥100. Nobody pays more than their hold.</div>
    <button class="big-b blue" data-act="doSettle">${ic("lock")}Charge 3 · release 1</button></div>`;
  if (S.sheet === "share") return `<div class="scrim" data-act="closeSheet"></div><div class="sheet"><div class="grab"></div>
    <div class="sh-h"><span></span><b>Share trip</b><button data-act="closeSheet">Done</button></div>
    <div class="input" style="font-size:15px;color:#64a8ff">jastip.app/j/k3Xq9</div>
    <div class="sys" style="margin:12px 0">Send it in your WhatsApp group. Friends open it in the browser, ask, and approve their PayPal hold. No app needed.</div>
    <button class="big-b white" data-act="closeSheet">${ic("share")}Share…</button></div>`;
  return "";
}

/* ------------------------------------------------ render */
let toastT;
function toast(t) { const el = $("#toast"); el.innerHTML = `${ic("check")}${t}`; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200); }

function hint() {
  const id = STEPS[S.step];
  const who = { open: "dina", ayuAsk: "ayu", accept: "dina", day: "dina", ayuHold: "ayu", shop: "dina", swapAsk: "dina", bimaSwap: "bima", receipt: "dina", settled: "ayu", got: "ayu" }[id];
  const what = {
    open: "Dina: tap + → Share trip link, then switch to Ayu",
    ayuAsk: "Ayu: tap + → Ask for an item",
    accept: "Dina: Accept the requests on the card",
    day: "Dina: tap + … or here to set Monday",
    ayuHold: "Ayu: Hold with PayPal on the card",
    shop: "Dina: tap + → Shopping list",
    swapAsk: "Dina: banana sold out, swap sent",
    bimaSwap: "Bima: Take it on the swap card",
    receipt: "Dina: tap + → Scan receipt",
    settled: "Ayu: open Wallet, tap the green pass",
    got: "Done. Replay from the top.",
  }[id];
  return { who, what };
}

function render() {
  const phone = $("#phone");
  let html = "";
  if (S.view === "home") html = tripsHTML();
  else {
    const body = S.view === "shop" ? shopHTML() : S.tab === "wallet" ? walletHTML() : `<div class="chat" id="chat">${chatHTML()}</div>`;
    html = `<div class="view">${S.view === "shop" ? `<div class="top"><div class="top-row"><button class="back-b" data-act="closeShop">${ic("back")}<span>Chat</span></button><div class="who"><b style="font-size:16px">Shopping list</b><small>Don Quijote Shibuya</small></div><span></span></div></div>` : topBar(subtitle())}
      ${body}${S.view === "shop" ? "" : composerHTML()}${sheetHTML()}</div>`;
  }
  phone.querySelector(".screen").innerHTML = html;
  const chat = $("#chat");
  if (chat) chat.scrollTop = chat.scrollHeight;
  document.querySelectorAll("[data-as]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.as === S.as));
  const h = hint();
  $("#hint").innerHTML = `<b>${S.step + 1}/${STEPS.length}</b> ${h.what}${h.who !== S.as ? ` <button data-as="${h.who}" class="go">Switch to ${PEOPLE[h.who].n}</button>` : ""}`;
}

function next() { S.step = Math.min(STEPS.length - 1, S.step + 1); }
function act(a, el) {
  const id = STEPS[S.step];
  switch (a) {
    case "tray": S.tray = !S.tray; break;
    case "tab": S.tab = el.dataset.tab; S.tray = false; S.view = "chat"; break;
    case "home": S.view = "home"; S.tray = false; break;
    case "openTrip": S.view = "chat"; break;
    case "share": S.tray = false; S.sheet = "share"; if (id === "open") next(); break;
    case "askSheet": S.tray = false; S.sheet = "ask"; break;
    case "cap": S.cap = Math.max(500, S.cap + Number(el.dataset.d)); REQ.ayu.cap = S.cap; break;
    case "rule": S.rule = el.dataset.v; break;
    case "doAsk": S.sheet = null; if (id === "ayuAsk") { next(); toast("Sent to Dina"); } break;
    case "accept": if (id === "accept") { next(); next(); toast("Accepted · shopping day Mon 2 Nov"); } break;
    case "decline": toast("Declined"); break;
    case "holdSheet": S.sheet = "hold"; break;
    case "doHold": S.sheet = null; if (id === "ayuHold") { next(); toast(`Held ${Y(hold("ayu"))} · ¥0 charged`); } break;
    case "shopMode": S.tray = false; S.view = "shop"; break;
    case "doShop": if (id === "shop") { next(); next(); toast("Swap sent to Bima"); } break;
    case "closeShop": S.view = "chat"; break;
    case "swapYes": case "swapNo": if (id === "bimaSwap") { next(); toast(a === "swapYes" ? "Swap taken" : "Skipped · hold released"); } break;
    case "scan": S.tray = false; S.view = "chat"; S.sheet = "scan"; break;
    case "doSettle": S.sheet = null; if (id === "receipt") { next(); toast("Charged exactly · ¥1,400 released"); } break;
    case "openPass": S.openPass = S.openPass === el.dataset.k ? null : el.dataset.k; if (id === "settled" && S.as === "ayu" && el.dataset.k === "ayu") next(); break;
    case "closeSheet": S.sheet = null; break;
    case "replay": Object.assign(S, { step: 0, as: "dina", tab: "chat", view: "chat", tray: false, sheet: null, openPass: null, cap: 1500 }); REQ.ayu.cap = 1500; break;
  }
  render();
}

document.addEventListener("click", (e) => {
  const as = e.target.closest("[data-as]");
  if (as) { S.as = as.dataset.as; S.tray = false; S.sheet = null; S.openPass = null; S.view = S.view === "shop" && S.as !== "dina" ? "chat" : S.view; render(); return; }
  const el = e.target.closest("[data-act]");
  if (el) act(el.dataset.act, el);
});
render();
