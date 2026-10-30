// E · Track — the friend tracks an order like Uber Eats; the money strip under the tracker is the PayPal transaction.
// The traveller works like a courier: one job card, grouped like Instacart (Found / Swaps / Still looking / Not here).
const $ = (s, el = document) => el.querySelector(s);
const P = {
  back: '<path d="M15 4.5 7.5 12l7.5 7.5" stroke-width="2.4"/>', chat: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.6"/>', camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>', qr: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M20.5 14v.01M14 20.5h.01M17 20.5h3.5V17"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.1"/>', swap: '<path d="M5 8h13l-3.5-3.5M19 16H6l3.5 3.5"/>',
  snack: '<path d="M12 3.5a8.5 8.5 0 1 0 8.4 9.8 3 3 0 0 1-3.6-3.6 3 3 0 0 1-3.2-3.2A3 3 0 0 1 12 3.5z"/><circle cx="8.5" cy="11" r=".9" fill="currentColor"/><circle cx="11" cy="15.5" r=".9" fill="currentColor"/>',
  beauty: '<rect x="8" y="9" width="8" height="12" rx="2"/><path d="M10 9V6.5h4V9M11 3.5h2v3h-2z"/>', med: '<rect x="4" y="8" width="16" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="m9.7 15.3 4.6-6.6"/>',
};
const ic = (n, c = "i") => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
const Y = (n) => "¥" + Math.round(n).toLocaleString("en-US");
const PEOPLE = { dina: { n: "Dina", c: "#5e5ce6" }, ayu: { n: "Ayu", c: "#ff375f" }, bima: { n: "Bima", c: "#ff9f0a" }, citra: { n: "Citra", c: "#30b0c7" } };
const av = (k, s) => `<span class="av" style="--c:${PEOPLE[k].c}${s ? `;--s:${s}px` : ""}" aria-hidden="true">${PEOPLE[k].n[0]}</span>`;
const FEE = 100;
const REQ = {
  ayu: { who: "ayu", title: "Matcha KitKat", d: "Big bag", art: "snack", g: "g-snack", cap: 1500, line: "KITKAT ｵﾄﾅﾉｱﾏｻ 抹茶 大袋", price: 1188 },
  bima: { who: "bima", title: "Tokyo Banana", d: "8 pack", art: "snack", g: "g-sweet", cap: 1800, swap: "Tokyo Banana 4 pack", line: "東京ﾊﾞﾅﾅ ﾐｴﾀｯﾀ 4個入", price: 648 },
  citra: { who: "citra", title: "Hada Labo lotion", d: "Gokujyun 170ml", art: "beauty", g: "g-beauty", cap: 1200, line: "ﾊﾀﾞﾗﾎﾞ 極潤 ﾋｱﾙﾛﾝ液 170ml", price: 968 },
  citra2: { who: "citra", title: "Roihi patches", d: "156 pcs", art: "med", g: "g-med", cap: 1300 },
};
const hold = (k) => REQ[k].cap + FEE, pay = (k) => REQ[k].price + FEE;

// The order's journey. Each entry: who acts, tracker step (0-4), time stamp.
const STEPS = [
  { id: "asked", who: "ayu", t: "Thu 29 Oct · 20:16", hint: "Ayu asked. Dina accepts and sets Monday." },
  { id: "approve", who: "ayu", t: "Sat 31 Oct · 09:02", hint: "Ayu approves the PayPal hold" },
  { id: "held", who: "dina", t: "Sat 31 Oct · 09:04", hint: "Dina starts shopping on Monday" },
  { id: "shopping", who: "dina", t: "Mon 2 Nov · 18:31", hint: "Dina marks items found, sold out, not here" },
  { id: "swap", who: "bima", t: "Mon 2 Nov · 18:40", hint: "Bima's banana is sold out: pick a swap" },
  { id: "till", who: "dina", t: "Mon 2 Nov · 18:52", hint: "Dina pays and scans the receipt" },
  { id: "paid", who: "ayu", t: "Mon 2 Nov · 18:53", hint: "Ayu sees her exact charge" },
  { id: "flying", who: "dina", t: "Fri 6 Nov · 21:10", hint: "Back home: Dina hands over" },
  { id: "delivered", who: "ayu", t: "Sat 7 Nov · 16:10", hint: "Delivered. Done." },
];
const S = { step: 0, as: "ayu", sheet: null, found: new Set(), notHere: new Set(), swapAsked: false, swapPick: "alt" };
const idx = (id) => STEPS.findIndex((s) => s.id === id);
const at = (id) => S.step >= idx(id);
const now = (id) => S.step === idx(id);

// tracker step 0..4 = Asked · Held · Shopping · Paid · Delivered
function trackStep() {
  if (at("delivered")) return 5;
  if (at("paid")) return 3;
  if (at("shopping")) return 2;
  if (at("held")) return 1;
  return 0;
}
const LABELS = ["Asked", "Held", "Shopping", "Paid", "Delivered"];
const steps = () => {
  const s = trackStep();
  return `<div class="steps" aria-label="Order progress">${LABELS.map((_, i) => `<i class="${i < s ? "done" : i === s ? "now" : ""}"></i>`).join("")}</div>
    <div class="steplabels">${LABELS.map((l, i) => `<span class="${i <= s ? "on" : ""}">${l}</span>`).join("")}</div>`;
};

/* ---------- friend: tracker ---------- */
function friendView(me) {
  const k = me === "citra" ? "citra" : me;
  const r = REQ[k];
  const swapped = me === "bima" && at("till");
  const title = swapped ? REQ.bima.swap : r.title;
  let scene = "asked", eta = "", status = "", sub = "", action = "", needs = "";
  if (!at("approve")) { scene = "asked"; eta = "Dina flies Sun 1 Nov"; status = "Dina accepted your ask"; sub = "She'll ask for a PayPal hold before shopping day."; }
  if (now("approve")) { scene = "held"; eta = "Shopping Mon 2 Nov"; status = me === "ayu" ? "Approve your hold" : "Hold approved"; sub = `Up to ${Y(hold(k))}. Nothing is charged today.`; if (me === "ayu") { needs = "Dina needs this before she shops"; action = `<button class="btn pp" data-act="holdSheet">Hold with <b>Pay<i>Pal</i></b></button>`; } }
  if (at("held") && !at("shopping")) { scene = "held"; eta = "Shopping Mon 2 Nov"; status = "Held. See you Monday."; sub = "Dina buys it on shopping day. You pay the receipt price."; }
  if (at("shopping") && !at("paid")) {
    scene = "shopping"; eta = "Don Quijote Shibuya · now";
    const isFound = S.found.has(k), isX = S.notHere.has(k);
    status = isFound ? "In Dina's basket" : isX ? "Not on the shelf" : "Dina is shopping";
    sub = isFound ? "She'll pay at the till next." : isX ? "Your hold will be released when she pays." : "Looking for your item now.";
    if (me === "bima" && now("swap")) { status = "8 pack is sold out"; sub = "Dina found a 4 pack. Take it or skip?"; needs = "Dina is waiting in the shop"; action = `<button class="btn dark" data-act="swapSheet">${ic("swap")}Choose a swap</button>`; }
    if (me === "bima" && at("till") && !at("paid")) { status = "4 pack in the basket"; sub = "Swap taken. She'll pay at the till next."; }
  }
  if (at("paid") && !at("delivered")) {
    const found = k !== "citra2";
    scene = at("flying") ? "flying" : "paid"; eta = at("flying") ? "Handover today" : "Dina lands Fri 6 Nov";
    status = at("flying") ? "Dina is back. Meet up!" : `Paid ${Y(pay(k))}. Exactly.`;
    sub = at("flying") ? "Scan her code when you get the bag." : `The receipt line plus her fee. ${Y(hold(k) - pay(k))} of your hold was never taken.`;
    if (at("flying") && me === "ayu") action = `<button class="btn green" data-act="got">${ic("qr")}I got my bag</button>`;
  }
  if (at("delivered")) { scene = "delivered"; eta = "Delivered Sat 7 Nov"; status = me === "ayu" ? "Delivered. Enjoy!" : "Paid. Handover soon."; sub = me === "ayu" ? "Thanks for using Jastip with Dina." : "Dina will message you to meet."; }

  // money strip: what PayPal is doing with this friend's money now
  const h = hold(k);
  let mb = "", mt = "", ms = "";
  if (!at("approve")) { mt = "¥0"; ms = "no hold yet"; mb = `<div class="mbar"></div>`; }
  else if (now("approve") && me === "ayu") { mt = Y(h); ms = "hold to approve"; mb = `<div class="mbar"><i style="width:100%;background:#cfe0ff"></i></div>`; }
  else if (!at("paid")) { mt = Y(h); ms = "held · ¥0 charged"; mb = `<div class="mbar"><i style="width:100%;background:var(--blue)"></i></div>`; }
  else { const pct = Math.round((pay(k) / h) * 100); mt = Y(pay(k)); ms = `paid · ${Y(h - pay(k))} never taken`; mb = `<div class="mbar"><i style="width:${pct}%;background:var(--green)"></i><u style="left:${pct}%"></u></div>`; }

  const tl = [
    ["Asked", "Thu 29 Oct", at("asked")],
    ["Hold approved", "Sat 31 Oct", at("held"), "money-ev"],
    ["Dina shopping", "Mon 2 Nov", at("shopping")],
    [`Paid ${Y(pay(k))} · ${Y(h - pay(k))} released`, "Mon 2 Nov", at("paid"), "money-ev g"],
    ["Delivered", "Sat 7 Nov", at("delivered")],
  ].map(([a, b, done, cls = ""]) => `<div class="tl ${done ? "done" : ""} ${done ? cls : ""}"><span class="d"></span><span>${a}</span><span>${done ? b : ""}</span></div>`).join("");

  return `<div class="view">
    <div class="scene" style="--sky:${SCENES[scene].sky}"><div class="topbar"><button class="rb" aria-label="Back">${ic("back")}</button><button class="chipb">${ic("help")}Help</button></div>
      <div class="illo"><svg viewBox="0 0 250 190">${SCENES[scene].svg}</svg></div></div>
    <div class="panel"><div class="grab"></div><div class="pscroll">
      <div class="eta">${eta}</div>
      <div class="status">${status}<small>${sub}</small></div>
      ${steps()}
      ${needs ? `<div class="needs">${ic("alert")}${needs}</div>` : ""}
      <div class="money"><div class="row"><b class="num">${mt}</b><span class="pp-chip">Pay<i>Pal</i></span></div>${mb}
        <div class="legend"><span>${ms}</span></div></div>
      <div class="courier">${av("dina", 48)}<div><b>Dina</b><span>Your jastiper · Tokyo · 2 handovers kept</span></div><div class="acts"><button class="circ" aria-label="Chat with Dina">${ic("chat")}</button></div></div>
      <div class="item"><div class="pic ${swapped ? "g-sweet" : r.g}">${ic(r.art)}</div><div><b>${title}</b><span>${swapped ? "Swap · within your max" : r.d} · max ${Y(r.cap)}</span>${at("paid") ? `<div class="rl">${r.line}</div>` : ""}</div>
        <div class="a">${at("paid") ? `<b class="num">${Y(r.price)}</b><span>+ ${Y(FEE)} fee</span>` : `<b class="num">${Y(r.cap)}</b><span>max</span>`}</div></div>
      <div class="sec">Timeline</div><div class="timeline">${tl}</div>
    </div></div>
    ${action ? `<div class="actbar">${action}</div>` : ""}
    ${sheetHTML()}</div>`;
}

/* ---------- traveller: courier mode ---------- */
function dinaView() {
  const keys = Object.keys(REQ);
  let scene = "held", eta = "", status = "", sub = "", action = "";
  const found = keys.filter((k) => S.found.has(k)), notHere = keys.filter((k) => S.notHere.has(k));
  const swapK = S.swapAsked && !S.found.has("bima") && !S.notHere.has("bima") ? ["bima"] : [];
  const looking = keys.filter((k) => !S.found.has(k) && !S.notHere.has(k) && !swapK.includes(k));
  if (!at("held")) { scene = "asked"; eta = "Sun 1 Nov · Tokyo"; status = "Waiting for holds"; sub = "3 of 4 held. Ayu is approving."; action = `<button class="btn" disabled>Shopping opens when holds are in</button>`; }
  else if (!at("shopping")) { scene = "held"; eta = "Mon 2 Nov · Don Quijote"; status = "4 holds in. Go shopping!"; sub = `${Y(keys.reduce((s, k) => s + hold(k), 0))} held for you by PayPal. ¥0 charged.`; action = `<button class="btn dark" data-act="startShop">Start shopping</button>`; }
  else if (!at("paid")) {
    scene = "shopping"; eta = "Don Quijote Shibuya · now";
    status = now("swap") ? "Waiting for Bima" : `${found.length} of ${keys.length} in the basket`;
    sub = now("swap") ? "He's picking a swap. Keep shopping." : "Tap Found, Swap or Not here for each item.";
    const ready = found.length && !swapK.length && !looking.length;
    action = `<button class="btn dark" data-act="scanSheet" ${ready ? "" : "disabled"}>${ic("camera")}Pay &amp; scan receipt</button>`;
  } else if (!at("flying")) { scene = "paid"; eta = "Mon 2 Nov · 18:53"; status = `${Y(found.reduce((s, k) => s + pay(k), 0))} paid to you`; sub = "Exact receipt lines + your fee. Holds not used were released."; action = `<button class="btn dark" data-act="flyHome">I'm back home</button>`; }
  else { scene = at("delivered") ? "delivered" : "flying"; eta = "Handover"; status = at("delivered") ? "1 of 3 delivered" : "Hand over the bags"; sub = "Friends scan your code to confirm. That's your proof."; action = at("delivered") ? "" : `<button class="btn dark" data-act="showQR">${ic("qr")}Show handover code</button>`; }

  const groups = at("shopping") && !at("paid") ? [
    ["Found", found, "ok"], ["Swaps", swapK, "sw"], ["Still looking", looking, ""], ["Not here", notHere, "x"],
  ].filter(([, ks]) => ks.length).map(([g, ks, t]) => `<div class="group">${g}<span>${ks.length}</span></div>${ks.map((k) => jobRow(k, t)).join("")}`).join("")
    : keys.map((k) => jobRow(k, at("paid") ? (S.notHere.has(k) ? "x" : "paid") : "")).join("");

  const earned = found.reduce((s, k) => s + pay(k), 0);
  const kp = at("paid")
    ? `<div class="kpis"><div class="kpi g"><b class="num">${Y(earned)}</b><span>paid to you</span></div><div class="kpi"><b class="num">${Y(found.length * FEE)}</b><span>your fees</span></div><div class="kpi"><b class="num">${Y(notHere.reduce((s, k) => s + hold(k), 0))}</b><span>released</span></div></div>`
    : `<div class="kpis"><div class="kpi"><b class="num">${Y(keys.reduce((s, k) => s + hold(k), 0))}</b><span>held for you</span></div><div class="kpi"><b>${keys.length}</b><span>items</span></div><div class="kpi"><b>3</b><span>friends</span></div></div>`;

  return `<div class="view">
    <div class="scene" style="--sky:${SCENES[scene].sky};height:250px"><div class="topbar"><button class="rb" aria-label="Back">${ic("back")}</button><button class="chipb">${ic("share")}Trip link</button></div>
      <div class="illo"><svg viewBox="0 0 250 190">${SCENES[scene].svg}</svg></div></div>
    <div class="panel"><div class="grab"></div><div class="pscroll">
      <div class="eta">${eta}</div><div class="status">${status}<small>${sub}</small></div>
      ${steps()}${kp}
      <div class="job">${groups}</div>
    </div></div>
    ${action ? `<div class="actbar">${action}</div>` : ""}${sheetHTML()}</div>`;
}

function jobRow(k, t) {
  const r = REQ[k], p = PEOPLE[r.who];
  const swapped = k === "bima" && S.found.has("bima");
  const right = at("shopping") && !at("paid")
    ? (t === "" ? `<button class="tbtn" data-act="more" data-k="${k}">Mark</button>` : t === "ok" ? `<button class="tbtn ok" data-act="undo" data-k="${k}">${ic("check")}</button>` : t === "sw" ? `<span class="tbtn sw">Asked</span>` : `<button class="tbtn x" data-act="undo" data-k="${k}">Not here</button>`)
    : t === "paid" ? `<b class="num" style="color:var(--green)">${Y(pay(k))}</b>` : t === "x" ? `<span style="font-size:13px;color:var(--l3)">released</span>` : `<span style="font-size:13px;color:var(--l2)">${Y(hold(k))} held</span>`;
  return `<div class="jr"><div class="pic ${swapped ? "g-sweet" : r.g}">${ic(r.art)}</div><div><b>${swapped ? r.swap : r.title}</b><span>${av(r.who, 18)}${p.n} · max ${Y(r.cap)}</span></div>${right}</div>`;
}

/* ---------- sheets ---------- */
function sheetHTML() {
  if (S.sheet === "hold") return `<div class="scrim" data-act="close"></div><div class="sheet"><div class="grab"></div>
    <div class="sh-h"><span class="sbx">Sandbox</span><button data-act="close">Cancel</button></div>
    <div class="pplogo">Pay<i>Pal</i></div><div class="ppamt num">${Y(hold("ayu"))}</div><div style="color:#555">Hold for Dina's trip to Tokyo</div>
    <div class="pplines"><div><span>Matcha KitKat, max</span><b>${Y(REQ.ayu.cap)}</b></div><div><span>Dina's fee</span><span>${Y(FEE)}</span></div><div><b>Charged today</b><b>¥0</b></div></div>
    <div class="ppnote">${ic("lock")}<span>On Monday you're charged the receipt price + fee. Not found? Released.</span></div>
    <button class="btn pp" data-act="doHold">Agree &amp; hold with <b>Pay<i>Pal</i></b></button></div>`;
  if (S.sheet === "more") { const k = S.moreK, r = REQ[k]; return `<div class="scrim" data-act="close"></div><div class="sheet"><div class="grab"></div>
    <div class="sh-h"><b>${r.title}</b><button data-act="close">Cancel</button></div>
    <button class="btn green" data-act="found" data-k="${k}" style="margin-bottom:8px">${ic("check")}Found it</button>
    ${k === "bima" ? `<button class="btn light" data-act="askSwap" style="margin-bottom:8px">${ic("swap")}Sold out · suggest 4 pack ¥648</button>` : ""}
    <button class="btn light" data-act="notHere" data-k="${k}">Not here · release ${Y(hold(k))}</button></div>`; }
  if (S.sheet === "swap") return `<div class="scrim" data-act="close"></div><div class="sheet"><div class="grab"></div>
    <div class="sh-h"><b>Pick a swap</b><button data-act="close">Later</button></div>
    <div class="opts"><button class="opt" data-act="pick" data-v="alt" aria-pressed="${S.swapPick === "alt"}"><div class="pic g-sweet">${ic("snack")}</div><b>4 pack</b><span>¥648 · within your max</span></button>
      <button class="opt" data-act="pick" data-v="skip" aria-pressed="${S.swapPick === "skip"}"><div class="pic" style="background:#eee;color:#999">${ic("swap")}</div><b>Skip</b><span>${Y(hold("bima"))} released</span></button></div>
    <button class="btn dark" data-act="answerSwap">${S.swapPick === "alt" ? "Take the 4 pack" : "Skip it"}</button></div>`;
  if (S.sheet === "scan") {
    const lines = ["ayu", "bima", "citra"].map((k) => `<div class="l">${av(REQ[k].who, 20)}<span>${REQ[k].line}</span><span>${Y(REQ[k].price)}</span></div>`).join("") + `<div class="l"><span></span><span>ﾚｼﾞ袋 L</span><span>¥5</span></div>`;
    const rows = ["ayu", "bima", "citra"].map((k) => `<div class="sr">${av(REQ[k].who, 28)}<span>${PEOPLE[REQ[k].who].n}${k === "bima" ? " · swap" : ""}</span><b class="num">${Y(pay(k))}</b></div>`).join("") + `<div class="sr x">${av("citra", 28)}<span>Citra · patches</span><b>${Y(hold("citra2"))} released</b></div>`;
    return `<div class="scrim" data-act="close"></div><div class="sheet"><div class="grab"></div>
      <div class="sh-h"><b>Receipt · read in 9 s</b><button data-act="close">Retake</button></div>
      <div class="receipt"><div class="shop">ドン・キホーテ 渋谷本店</div><hr>${lines}</div><div class="split">${rows}</div>
      <p style="font-size:13px;color:var(--l2);margin:10px 0 14px">Each friend pays their line + ${Y(FEE)}. Never more than their hold.</p>
      <button class="btn dark" data-act="charge">Charge 3 · release 1</button></div>`;
  }
  if (S.sheet === "qr") return `<div class="scrim" data-act="close"></div><div class="sheet"><div class="grab"></div>
    <div class="sh-h"><b>Handover code</b><button data-act="close">Done</button></div>
    <div style="display:grid;place-items:center;padding:10px 0 16px">${qr()}</div><p style="text-align:center;color:var(--l2);font-size:14px">Ayu scans this when she gets the bag.</p></div>`;
  return "";
}
function qr() { let s = 9, c = ""; for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { const f = (a, b) => x >= a && x < a + 7 && y >= b && y < b + 7; let on; if (f(0, 0) || f(14, 0) || f(0, 14)) { const lx = x % 14 % 7, ly = y % 14 % 7; on = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx > 1 && lx < 5 && ly > 1 && ly < 5); } else { s = (s * 1103515245 + 12345) >>> 0; on = (s >> 16) % 2 === 0; } c += `<i style="background:${on ? "#111" : "transparent"}"></i>`; } return `<div style="display:grid;grid-template-columns:repeat(21,1fr);gap:2px;width:200px;height:200px">${c}</div>`; }

/* ---------- render + events ---------- */
let toastT;
function toast(t) { const el = $("#toast"); el.innerHTML = `${ic("check")}${t}`; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200); }
function render() {
  $("#screen").innerHTML = S.as === "dina" ? dinaView() : friendView(S.as);
  document.querySelectorAll(".controls [data-as]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.as === S.as));
  const st = STEPS[S.step];
  $("#hint").innerHTML = `<b>${S.step + 1}/${STEPS.length}</b>${st.hint}${st.who !== S.as ? ` <button class="go" data-as="${st.who}">Go to ${PEOPLE[st.who].n}</button>` : ""}`;
}
const next = (id) => { if (STEPS[S.step].id === id) S.step++; };
function act(a, el) {
  const k = el?.dataset?.k;
  switch (a) {
    case "holdSheet": S.sheet = "hold"; break;
    case "doHold": S.sheet = null; if (now("asked")) next("asked"); next("approve"); toast(`Held ${Y(hold("ayu"))} · ¥0 charged`); break;
    case "startShop": next("held"); break;
    case "more": S.moreK = k; S.sheet = "more"; break;
    case "found": S.found.add(k); S.notHere.delete(k); S.sheet = null; break;
    case "notHere": S.notHere.add(k); S.found.delete(k); S.sheet = null; break;
    case "undo": S.found.delete(k); S.notHere.delete(k); break;
    case "askSwap": S.swapAsked = true; S.sheet = null; next("shopping"); toast("Asked Bima"); break;
    case "swapSheet": S.sheet = "swap"; break;
    case "pick": S.swapPick = el.dataset.v; break;
    case "answerSwap": S.sheet = null; (S.swapPick === "alt" ? S.found : S.notHere).add("bima"); next("swap"); toast(S.swapPick === "alt" ? "Swap taken" : "Skipped · hold released"); break;
    case "scanSheet": S.sheet = "scan"; break;
    case "charge": S.sheet = null; next("till"); toast("Charged exactly · holds released"); break;
    case "flyHome": next("paid"); break;
    case "showQR": S.sheet = "qr"; break;
    case "got": next("flying"); toast("Handover confirmed"); break;
    case "close": S.sheet = null; break;
    case "replay": Object.assign(S, { step: 0, as: "ayu", sheet: null, found: new Set(), notHere: new Set(), swapAsked: false, swapPick: "alt" }); break;
  }
  render();
}
document.addEventListener("click", (e) => {
  const as = e.target.closest("[data-as]");
  if (as) { S.as = as.dataset.as; S.sheet = null; render(); return; }
  const el = e.target.closest("[data-act]");
  if (el) act(el.dataset.act, el);
});
// the story starts with Ayu's request already accepted; step 0 -> approve needs Ayu's tap
S.step = 1;
render();
