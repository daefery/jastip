// C · Bag — full flow, one trip, four phones. Each screen has one big visual (dial, bag, rings, meters),
// one headline and one action. Every number says whose money it is.
const $ = (s, el = document) => el.querySelector(s);
const P = {
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  swap: '<path d="M5 8h13l-3.5-3.5M19 16H6l3.5 3.5"/>', more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4L12 18.4"/>',
  spark: '<path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z" fill="currentColor" stroke="none"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  snack: '<path d="M12 3.5a8.5 8.5 0 1 0 8.4 9.8 3 3 0 0 1-3.6-3.6 3 3 0 0 1-3.2-3.2A3 3 0 0 1 12 3.5z"/><circle cx="8.5" cy="11" r=".9" fill="currentColor"/><circle cx="11" cy="15.5" r=".9" fill="currentColor"/><circle cx="15.5" cy="15" r=".9" fill="currentColor"/>',
  beauty: '<rect x="8" y="9" width="8" height="12" rx="2"/><path d="M10 9V6.5h4V9M11 3.5h2v3h-2z"/>',
  med: '<rect x="4" y="8" width="16" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="m9.7 15.3 4.6-6.6"/>',
};
const ic = (n, c = "i") => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
const Y = (n) => "¥" + Math.round(n).toLocaleString("en-US");
const PEOPLE = { dina: { n: "Dina", c: "#5e5ce6" }, ayu: { n: "Ayu", c: "#ff375f" }, bima: { n: "Bima", c: "#ff9f0a" }, citra: { n: "Citra", c: "#30b0c7" } };
const av = (k, s) => `<span class="av" style="--c:${PEOPLE[k].c}${s ? `;--s:${s}px` : ""}" aria-hidden="true">${PEOPLE[k].n[0]}</span>`;
const FEE = 100;
const REQ = {
  ayu: { who: "ayu", title: "Matcha KitKat", d: "Big bag", art: "snack", g: "g-snack", cap: 1500, typical: 1200, line: "KITKAT ｵﾄﾅﾉｱﾏｻ 抹茶 大袋", price: 1188 },
  bima: { who: "bima", title: "Tokyo Banana", d: "8 pack", art: "snack", g: "g-sweet", cap: 1800, swap: "Tokyo Banana 4 pack", line: "東京ﾊﾞﾅﾅ ﾐｴﾀｯﾀ 4個入", price: 648 },
  citra: { who: "citra", title: "Hada Labo", d: "Lotion 170ml", art: "beauty", g: "g-beauty", cap: 1200, line: "ﾊﾀﾞﾗﾎﾞ 極潤 ﾋｱﾙﾛﾝ液 170ml", price: 968 },
  citra2: { who: "citra", title: "Roihi patches", d: "156 pcs", art: "med", g: "g-med", cap: 1300 },
};
const KEYS = Object.keys(REQ);
const hold = (k) => REQ[k].cap + FEE;
const pay = (k) => REQ[k].price + FEE;

// one trip, told in steps; each step belongs to one phone
const STEPS = [
  { id: "open", who: "dina", hint: "Dina opens a trip and shares the link" },
  { id: "ask", who: "ayu", hint: "Ayu pastes a TikTok link and sets a max" },
  { id: "review", who: "dina", hint: "Dina accepts the requests" },
  { id: "day", who: "dina", hint: "Dina picks the shopping day" },
  { id: "hold", who: "ayu", hint: "Ayu approves a PayPal hold (¥0 today)" },
  { id: "shop", who: "dina", hint: "In the shop: tap what goes in the bag" },
  { id: "swap", who: "bima", hint: "Bima's pick is sold out: one-tap swap" },
  { id: "scan", who: "dina", hint: "Dina scans one receipt" },
  { id: "paid", who: "ayu", hint: "Ayu sees her exact charge" },
  { id: "got", who: "ayu", hint: "Ayu got the bag. Done." },
];
const S = { step: 0, as: "dina", cap: 1500, rule: "ask", day: 2, inBag: new Set(), x: new Set(), swapAsked: false, swapPick: "alt", sheet: null, removed: new Set(), anim: null };
const idx = (id) => STEPS.findIndex((s) => s.id === id);
const at = (id) => S.step >= idx(id);
const now = (id) => S.step === idx(id);

/* ------------------------------------------------ dial */
// value -> arc. min 0, max = full arc. Used for "max price" (orange) and later "exact vs hold" (green + hatched).
function dial({ value, max, color = "var(--orange)", rest = 0, label, sub, knob = false }) {
  const R = 112, cx = 135, cy = 140, len = Math.PI * R;
  const arc = `M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const f = Math.max(0, Math.min(1, value / max)), r = Math.max(0, Math.min(1 - f, rest / max));
  const a = Math.PI * (1 - f), kx = cx + R * Math.cos(a), ky = cy - R * Math.sin(a);
  return `<div class="dial${knob ? " drag" : ""}" ${knob ? 'data-dial role="slider" tabindex="0" aria-label="Max price" aria-valuemin="500" aria-valuemax="3000" aria-valuenow="' + value + '"' : ""}>
    <svg viewBox="0 0 270 156"><path d="${arc}" fill="none" stroke="var(--track)" stroke-width="20" stroke-linecap="round"/>
      ${r ? `<path class="rest" d="${arc}" fill="none" stroke="#e6ddd1" stroke-width="20" stroke-linecap="round" stroke-dasharray="${len * r} ${len}" stroke-dashoffset="${-len * f}"/>` : ""}
      <path class="fill" d="${arc}" fill="none" stroke="${color}" stroke-width="20" stroke-linecap="round" stroke-dasharray="${len * f} ${len}"/>
      ${knob ? `<circle class="knob" cx="${kx}" cy="${ky}" r="17" fill="#fff" stroke="${color}" stroke-width="5"/>` : ""}</svg>
    <div class="v"><b class="num">${label}</b><span>${sub}</span></div></div>`;
}

/* ------------------------------------------------ bag */
function bag(items, opts = {}) {
  const cls = items.length ? (opts.done ? " done" : "") : " empty";
  const tiles = items.map((k) => `<span class="it ${REQ[k].g}${S.anim === k ? " drop" : ""}">${ic(REQ[k].art)}${av(REQ[k].who)}</span>`).join("");
  return `<div class="bag${cls}${opts.small ? " small" : ""}" aria-label="${items.length} items in the bag"><div class="handle"></div><div class="body"><div class="items">${tiles}</div>
    <div class="count num">${opts.count ?? items.length}<small>${opts.sub ?? "in the bag"}</small></div></div></div>`;
}

const trip = (right = "") => `<div class="trip"><span class="flag"><i></i></span>${opts.place()}<span class="me">${right}</span></div>`;
const opts = { place: () => (at("shop") && !at("paid") ? "Don Quijote · Shibuya" : S.as === "dina" ? "Tokyo · 1–6 Nov" : "Dina · Tokyo · Mon 2 Nov") };
const cta = (inner) => `<div class="cta">${inner}</div>`;

/* ------------------------------------------------ screens: Dina */
function dinaScreen() {
  const list = KEYS.filter((k) => !S.removed.has(k));
  if (S.step < idx("ask")) return `${trip()}
    <h1>Going to Tokyo.<br>Who wants what?</h1>
    ${bag([], { count: "0", sub: "requests yet" })}
    <p class="fine big">Share the link in your group chat.<br>Friends ask, PayPal holds, you shop.</p>
    ${cta(`<button class="pill dark" data-act="share">${ic("share")}Share trip link</button>`)}`;

  if (now("ask")) return `${trip()}<h1>Link shared.<br>Waiting for asks.</h1>${bag([], { count: "0", sub: "requests yet" })}<p class="fine big">Switch to Ayu to ask for something.</p>`;

  if (now("review")) return `${trip()}
    <h1>${list.length} asks.<br>Check the prices.</h1>
    <div class="scroll">${list.map((k) => askRow(k, true)).join("")}
    <p class="fine">Too low for the item? Remove it now, before anyone holds money.</p></div>
    ${cta(`<button class="pill dark" data-act="accept">${ic("check")}Accept ${list.length}</button>`)}`;

  if (now("day")) return `${trip()}
    <h1>When are you<br>shopping?</h1>
    <div class="days">${[["Sun", 1], ["Mon", 2], ["Tue", 3], ["Wed", 4], ["Thu", 5]].map(([w, d]) => `<button class="day" data-act="day" data-d="${d}" aria-pressed="${S.day === d}"><b>${d}</b><span>${w}</span></button>`).join("")}</div>
    <p class="fine">Friends approve PayPal holds for this day. A hold is most reliable for 3 days.</p>
    <div class="rings">${["ayu", "bima", "citra"].map((p) => `<div class="ring"><span class="av" style="--c:${PEOPLE[p].c}">${PEOPLE[p].n[0]}</span><small>asked</small></div>`).join("")}</div>
    ${cta(`<button class="pill dark" data-act="setDay">${ic("lock")}Ask for holds · Mon ${S.day}</button>`)}`;

  if (now("hold")) {
    const held = { ayu: false, bima: true, citra: true };
    return `${trip()}
    <h1>2 of 3 friends<br>holding.</h1>
    <div class="rings">${Object.entries(held).map(([p, h]) => `<div class="ring${h ? " full" : ""}" style="--p:${h ? 100 : 30}"><span class="av" style="--c:${PEOPLE[p].c}">${PEOPLE[p].n[0]}</span><small>${h ? "held" : "waiting"}</small></div>`).join("")}</div>
    <div class="stat"><b class="num">${Y(hold("bima") + hold("citra") + hold("citra2"))}</b><span>held for you by PayPal · ¥0 charged</span></div>
    ${cta(`<button class="pill" disabled>${ic("clock")}Waiting for Ayu</button>`)}`;
  }

  if (now("shop") || now("swap")) {
    const inBag = [...S.inBag];
    const swapWaiting = now("swap");
    return `${trip()}
    <h1>${inBag.length ? `${inBag.length} in the bag.` : "Let's shop."}</h1>
    ${bag(inBag, { small: true, count: inBag.length, sub: `of ${list.length} · ${Y(list.reduce((s, k) => s + hold(k), 0))} held` })}
    <div class="scroll"><div class="grid">${list.map((k) => tile(k)).join("")}</div>
    <p class="fine">Tap a photo when it's in your basket. ••• for sold out.</p></div>
    ${cta(swapWaiting ? `<button class="pill" disabled>${ic("clock")}Waiting for Bima's swap…</button>`
      : `<button class="pill dark" data-act="toScan" ${S.inBag.size && S.swapAsked ? "" : "disabled"}>${ic("camera")}Done · scan receipt</button>`)}`;
  }

  if (now("scan")) return `${trip()}
    <h1>${S.inBag.size} in the bag.<br>Pay, then snap.</h1>
    ${bag([...S.inBag], { small: true, count: S.inBag.size, sub: "ready for the till" })}
    <div class="meters">${["ayu", "bima", "citra", "citra2"].map((k) => meterRow(k, false)).join("")}</div>
    ${cta(`<button class="pill dark" data-act="scanSheet">${ic("camera")}Scan receipt</button>`)}`;

  // settled
  const total = ["ayu", "bima", "citra"].reduce((s, k) => s + pay(k), 0);
  return `${trip()}
    <h1>${Y(total)} to you.<br>Exactly.</h1>
    ${bag(["ayu", "bima", "citra"], { small: true, done: true, count: Y(total), sub: `3 charges · ${Y(3 * FEE)} fees` })}
    <div class="meters">${["ayu", "bima", "citra", "citra2"].map((k) => meterRow(k, true)).join("")}</div>
    <div class="chipline ${at("got") ? "ok" : "wait"}"><span>${ic(at("got") ? "check" : "box")}${at("got") ? "Ayu got her bag" : "3 handovers to go"}</span></div>`;
}

function askRow(k, removable) {
  const r = REQ[k];
  return `<div class="ask${S.removed.has(k) ? " off" : ""}"><div class="pic ${r.g}">${ic(r.art)}</div>
    <div><b>${r.title}</b><span>${av(r.who, 20)}${PEOPLE[r.who].n} · ${r.d}</span></div>
    <div class="r"><b class="num">${Y(r.cap)}</b><small>max</small></div>
    ${removable ? `<button class="x" data-act="remove" data-k="${k}" aria-label="Remove ${r.title}">${ic("x")}</button>` : "<span></span>"}</div>`;
}

function tile(k) {
  const r = REQ[k];
  const st = S.inBag.has(k) ? "in" : S.x.has(k) ? "x" : k === "bima" && S.swapAsked && !S.inBag.has(k) ? "swap" : "";
  const title = k === "bima" && S.inBag.has("bima") ? "Banana 4 pack" : r.title;
  const sub = st === "in" ? (k === "bima" ? "Swap · ¥648" : "In the bag") : st === "x" ? "Not here · released" : st === "swap" ? "Asked Bima…" : `max ${Y(r.cap)}`;
  return `<div class="tile ${st}"><button class="hit" data-act="tile" data-k="${k}" aria-pressed="${st === "in"}">
      <div class="pic ${r.g}">${ic(r.art)}${st === "in" ? `<div class="ok">${ic("check")}</div>` : ""}</div>
      <b>${title}</b><span class="s">${sub}</span></button>${av(r.who)}
    ${!st ? `<button class="more" data-act="tileMore" data-k="${k}" aria-label="Sold out options for ${r.title}">${ic("more")}</button>` : ""}</div>`;
}

function meterRow(k, done) {
  const r = REQ[k];
  const found = k !== "citra2";
  const exact = found ? pay(k) : 0, h = hold(k);
  const pct = done && found ? Math.round((exact / h) * 100) : done ? 0 : 100;
  const name = `${PEOPLE[r.who].n} · ${k === "bima" ? "Banana 4 pack" : r.title}${k === "bima" ? "<em>swap</em>" : ""}${done && at("got") && k === "ayu" ? `<span class="got">${ic("check")}</span>` : ""}`;
  return `<div class="m${!found ? " off" : ""}">${av(r.who, 34)}<div><div class="n">${name}</div>
    <div class="meter">${done ? `<i style="width:${pct}%"></i><u style="left:${pct}%"></u>` : `<i style="width:100%;background:var(--blue)"></i>`}</div></div>
    <div class="a"><b class="num">${done ? Y(exact) : found ? "·" : "—"}</b><small>${done ? (found ? `of ${Y(h)}` : `${Y(h)} released`) : found ? `${Y(h)} held` : "not found"}</small></div></div>`;
}

/* ------------------------------------------------ screens: a friend */
function friendScreen(me) {
  const mine = KEYS.filter((k) => REQ[k].who === me);
  const k = mine[0], r = REQ[k];
  if (me === "ayu" && S.step < idx("ask")) return `${trip()}<h1>Nothing yet.</h1>${bag([], { count: "0", sub: "asks" })}<p class="fine big">Dina will share her trip link.</p>`;

  if (me === "ayu" && now("ask")) return `${trip()}
    <div class="host">${av("dina", 52)}<div><b>Dina is going to Tokyo</b><span>1–6 Nov · first trip on Jastip</span></div></div>
    <div class="scroll">
    <div class="label">What should she bring?</div>
    <div class="paste"><span>${ic("link")}tiktok.com/@snackjp/video/7431…</span><button data-act="noop">${ic("spark")}Found</button></div>
    <div style="height:14px"></div>
    <div class="prod"><div class="pic ${r.g}">${ic(r.art)}</div><div><span class="ai">${ic("spark")}from your TikTok link</span><b>Matcha KitKat</b><span>Big bag · usually ~${Y(r.typical)}</span></div></div>
    ${dial({ value: S.cap, max: 3000, label: Y(S.cap), sub: `your max · +${Y(FEE)} fee`, knob: true })}
    <div class="pm"><button data-act="cap" data-d="-100" aria-label="Lower max">−</button><button data-act="cap" data-d="100" aria-label="Raise max">+</button></div>
    <div class="label">If it's sold out</div>
    <div class="rules">${[["ask", "Ask me"], ["similar", "Similar ok"], ["skip", "Skip"]].map(([v, l]) => `<button data-act="rule" data-v="${v}" aria-pressed="${S.rule === v}">${l}</button>`).join("")}</div>
    </div>
    ${cta(`<button class="pill dark" data-act="sendAsk">${ic("arrow")}Ask Dina</button>`)}`;

  if (me === "bima" && now("swap")) return `${trip()}
    <h1>8 pack is<br>sold out.</h1>
    <div class="opts">
      <button class="opt${S.swapPick === "alt" ? " on" : ""}" data-act="pick" data-v="alt"><div class="pic g-sweet">${ic("snack")}</div><b>4 pack</b><span class="num">¥648</span></button>
      <button class="opt${S.swapPick === "skip" ? " on" : ""}" data-act="pick" data-v="skip"><div class="pic none">${ic("x")}</div><b>Skip</b><span class="sm">¥1,900 released</span></button>
    </div>
    <p class="fine big">Photo from Dina at Don Quijote.<br>Within your max of ${Y(REQ.bima.cap)}.</p>
    ${cta(`<button class="pill dark" data-act="answerSwap">${ic("check")}${S.swapPick === "alt" ? "Take the 4 pack" : "Skip it"}</button>`)}`;

  // status screens for any friend
  const settled = at("paid");
  const held = at("shop") || (me !== "ayu" && at("hold"));
  if (me === "ayu" && now("hold")) return `${trip()}
    <h1>Your hold for<br>Matcha KitKat</h1>
    <div class="prod mini"><div class="pic ${r.g}">${ic(r.art)}</div><div><b>Matcha KitKat</b><span>Dina shops Mon 2 Nov · Don Quijote</span></div></div>
    ${dial({ value: hold(k), max: 3000, label: Y(hold(k)), sub: `${ic("lock")}held, not charged` })}
    <p class="fine">You pay the receipt price on Monday.<br>Not found? Released.</p>
    ${cta(`<button class="pill pp" data-act="holdSheet">Hold <b>Pay<i>Pal</i></b> · ¥0 today</button>`)}`;

  if (settled) {
    const found = k !== "citra2";
    const ex = pay(k), h = hold(k);
    return `${trip(at("got") && me === "ayu" ? `<span style="color:var(--green)">Delivered</span>` : "")}
      <h1>${Y(ex)}. Exactly<br>the receipt.</h1>
      ${dial({ value: ex, rest: h - ex, max: h, color: "var(--green)", label: Y(ex), sub: `${Y(h - ex)} of your hold never taken` })}
      <div class="receipt" style="margin-top:12px"><div class="l" style="--i:0">${av(r.who, 20)}<span>${r.line}</span><span>${Y(r.price)}</span></div>
        <div class="l" style="--i:1"><span></span><span>Dina's fee</span><span>${Y(FEE)}</span></div><hr><div class="l" style="--i:2;font-weight:700"><span></span><span>Paid with PayPal</span><span>${Y(ex)}</span></div></div>
      ${cta(at("got") ? `<button class="pill" disabled>${ic("check")}Got it · thanks Dina</button>` : `<button class="pill green" data-act="got">${ic("box")}I got my bag</button>`)}`;
  }
  if (held) return `${trip()}
    <h1>${me === "ayu" ? "Held. Dina's<br>shopping now." : "Held. Waiting<br>for Monday."}</h1>
    ${dial({ value: hold(k), max: 3000, color: "var(--blue)", label: Y(hold(k)), sub: `${ic("lock")}held by PayPal · ¥0 charged` })}
    <div class="prod mini" style="margin-top:14px"><div class="pic ${r.g}">${ic(r.art)}</div><div><b>${me === "bima" && at("scan") ? "Banana 4 pack" : r.title}</b><span>${me === "bima" && at("scan") ? "Swap taken · ¥648" : r.d}</span></div></div>
    <p class="fine big">You'll pay the exact receipt price.</p>`;
  return `${trip()}<h1>Asked. Dina<br>will confirm.</h1>${bag([], { count: "1", sub: "ask sent" })}<p class="fine big">Then you'll approve a PayPal hold.<br>Nothing is charged yet.</p>`;
}

/* ------------------------------------------------ sheets */
function sheetHTML() {
  if (S.sheet === "share") return `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-label="Share trip"><div class="grab"></div>
    <div class="sh-h"><b>Share your trip</b><button data-act="close">Done</button></div>
    <div class="linkbox">${ic("link")}jastip.app/j/k3Xq9</div>
    <p class="fine big" style="margin-bottom:16px">Friends open it in the browser. No app, no sign-up.</p>
    <button class="pill dark" data-act="shared">${ic("share")}Send to WhatsApp group</button></div>`;
  if (S.sheet === "hold") return `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-label="PayPal"><div class="grab"></div>
    <div class="sh-h"><span class="sbx">Sandbox</span><button data-act="close" style="color:#0070e0">Cancel</button></div>
    <div class="pplogo">Pay<i>Pal</i></div><div class="ppamt num">${Y(hold("ayu"))}</div><div class="ppsub">Hold for Dina's trip to Tokyo</div>
    <div class="pplines"><div><span>Matcha KitKat, max</span><b class="num">${Y(REQ.ayu.cap)}</b></div><div><span>Dina's fee</span><span>${Y(FEE)}</span></div><div><b>Charged today</b><b>¥0</b></div></div>
    <div class="ppnote">${ic("lock")}<span>On Monday you're charged the receipt price + fee. Not found? Released.</span></div>
    <button class="pill pp" data-act="doHold">Agree &amp; hold with <b>Pay<i>Pal</i></b></button></div>`;
  if (S.sheet === "more") return `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-label="Sold out"><div class="grab"></div>
    <div class="sh-h"><b>Tokyo Banana 8 pack</b><button data-act="close">Cancel</button></div>
    <div class="menu">
      <button data-act="askSwap"><span class="ti" style="background:var(--orange)">${ic("swap")}</span><div><b>Ask Bima for a swap</b><span>4 pack · ¥648 · he picks in one tap</span></div></button>
      <button data-act="notHere" data-k="bima"><span class="ti" style="background:#a39a8e">${ic("x")}</span><div><b>Not here</b><span>Bima's ¥1,900 hold is released</span></div></button>
    </div></div>`;
  if (S.sheet === "scan") {
    const lines = ["ayu", "bima", "citra"].map((k, i) => `<div class="l" style="--i:${i}">${av(REQ[k].who, 20)}<span>${REQ[k].line}</span><span>${Y(REQ[k].price)}</span></div>`).join("") + `<div class="l" style="--i:3"><span></span><span>ﾚｼﾞ袋 L</span><span>¥5</span></div>`;
    return `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-label="Receipt"><div class="grab"></div>
      <div class="sh-h"><b>Read in 9 s</b><button data-act="close">Retake</button></div>
      <div class="receipt"><div class="shop">ドン・キホーテ 渋谷本店</div><hr>${lines}</div>
      <div class="meters" style="margin-top:14px">${["ayu", "bima", "citra", "citra2"].map((k) => meterRow(k, true)).join("")}</div>
      <p class="fine">Each friend pays their line + ${Y(FEE)}. Never more than their hold.</p>
      <div style="height:12px"></div><button class="pill green" data-act="charge">${ic("check")}Charge 3 · release 1</button></div>`;
  }
  return "";
}

/* ------------------------------------------------ render + events */
let toastT;
function toast(t) { const el = $("#toast"); el.innerHTML = `${ic("check")}${t}`; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200); }

function render() {
  const body = S.as === "dina" ? dinaScreen() : friendScreen(S.as);
  $("#screen").innerHTML = `<div class="view">${body}${sheetHTML()}</div>`;
  S.anim = null;
  document.querySelectorAll(".controls [data-as]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.as === S.as));
  const st = STEPS[S.step];
  $("#hint").innerHTML = `<b>${S.step + 1}/${STEPS.length}</b>${st.hint}${st.who !== S.as ? ` <button class="go" data-as="${st.who}">Go to ${PEOPLE[st.who].n}</button>` : ""}`;
  bindDial();
}

function next(id) { if (STEPS[S.step].id === id) S.step++; }
function act(a, el) {
  switch (a) {
    case "share": S.sheet = "share"; break;
    case "shared": S.sheet = null; next("open"); toast("Link sent to the group"); break;
    case "cap": S.cap = Math.max(500, Math.min(3000, S.cap + Number(el.dataset.d))); REQ.ayu.cap = S.cap; break;
    case "rule": S.rule = el.dataset.v; break;
    case "sendAsk": next("ask"); toast("Sent to Dina"); break;
    case "remove": S.removed.has(el.dataset.k) ? S.removed.delete(el.dataset.k) : S.removed.add(el.dataset.k); break;
    case "accept": next("review"); toast("Accepted"); break;
    case "day": S.day = Number(el.dataset.d); break;
    case "setDay": next("day"); toast(`Holds asked for Mon ${S.day}`); break;
    case "holdSheet": S.sheet = "hold"; break;
    case "doHold": S.sheet = null; next("hold"); toast(`Held ${Y(hold("ayu"))} · ¥0 charged`); break;
    case "tile": {
      const k = el.dataset.k;
      if (k === "bima" && !S.inBag.has(k)) { S.sheet = "more"; break; }
      if (k === "citra2") { S.x.has(k) ? S.x.delete(k) : S.x.add(k); break; }
      if (S.inBag.has(k)) S.inBag.delete(k); else { S.inBag.add(k); S.anim = k; if (navigator.vibrate) navigator.vibrate(10); }
      break;
    }
    case "tileMore": S.sheet = el.dataset.k === "bima" ? "more" : null; if (el.dataset.k !== "bima") { S.x.add(el.dataset.k); } break;
    case "askSwap": S.sheet = null; S.swapAsked = true; if (!S.x.has("citra2")) S.x.add("citra2"); next("shop"); toast("Asked Bima"); break;
    case "notHere": S.sheet = null; S.x.add(el.dataset.k); break;
    case "pick": S.swapPick = el.dataset.v; break;
    case "answerSwap": if (S.swapPick === "alt") { S.inBag.add("bima"); S.anim = "bima"; } else S.x.add("bima"); next("swap"); toast(S.swapPick === "alt" ? "Dina will grab the 4 pack" : "Skipped · hold released"); break;
    case "toScan": break;
    case "scanSheet": S.sheet = "scan"; break;
    case "charge": S.sheet = null; next("scan"); toast("Charged exactly · ¥1,400 released"); break;
    case "got": next("paid"); toast("Handover confirmed"); break;
    case "close": S.sheet = null; break;
    case "replay": Object.assign(S, { step: 0, as: "dina", cap: 1500, rule: "ask", day: 2, inBag: new Set(), x: new Set(), swapAsked: false, swapPick: "alt", sheet: null, removed: new Set() }); REQ.ayu.cap = 1500; break;
  }
  render();
}

// drag the dial knob
function bindDial() {
  const d = $("[data-dial]"); if (!d) return;
  const set = (e) => {
    const r = d.getBoundingClientRect(), x = (e.touches ? e.touches[0].clientX : e.clientX) - (r.left + r.width / 2), y = r.top + r.height * 140 / 156 - (e.touches ? e.touches[0].clientY : e.clientY);
    const ang = Math.atan2(Math.max(0, y), x); const f = 1 - ang / Math.PI;
    S.cap = Math.max(500, Math.min(3000, Math.round((f * 3000) / 100) * 100)); REQ.ayu.cap = S.cap; render();
  };
  let on = false;
  d.addEventListener("pointerdown", (e) => { on = true; d.setPointerCapture(e.pointerId); set(e); });
  d.addEventListener("pointermove", (e) => { if (on) set(e); });
  d.addEventListener("pointerup", () => { on = false; });
  d.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") act("cap", { dataset: { d: 100 } }); if (e.key === "ArrowLeft" || e.key === "ArrowDown") act("cap", { dataset: { d: -100 } }); });
}

document.addEventListener("click", (e) => {
  const as = e.target.closest("[data-as]");
  if (as) { S.as = as.dataset.as; S.sheet = null; render(); return; }
  const el = e.target.closest("[data-act]");
  if (el) act(el.dataset.act, el);
});
render();
