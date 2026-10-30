// Small view helpers shared by both phones and the money rail.
const ic = (id, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const art = (id, cls = "art") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const av = (f, sm) => `<span class="av${sm ? " sm" : ""}" style="--c:${f.color}" aria-hidden="true">${f.name[0]}</span>`;
const isNow = (id) => S.step === STEP[id];
const cue = (id) => (isNow(id) ? " cue" : "");
const btn = (id, label, icon, cls = "btn-ink", extra = "") =>
  `<button type="button" class="btn ${cls}${cue(id)}" data-act="do" data-step="${id}"${extra}>${icon ? ic(icon) : ""}<span>${label}</span></button>`;
const pill = (cls, icon, text) => `<span class="pill ${cls}">${icon ? ic(icon) : ""}${text}</span>`;

// The state of one request as a luggage tag.
function tagState(f) {
  const m = money(f), fa = fate(f);
  const base = { cls: "", pill: "", amt: YEN(capOf(f)), sub: "max", art: f.art, label: f.short };
  if (!at("found")) {
    if (m.approved) return { ...base, cls: "held", pill: pill("", "i-lock", "Held") };
    if (isNow("approve")) return { ...base, pill: pill("n", "i-clock", "Waiting") };
    return base;
  }
  if (fa.kind === "none") return { ...base, cls: "none", pill: pill("n", "i-x", m.released ? "Released" : "Not here") };
  if (fa.kind === "skip") return { ...base, cls: "none", pill: pill("n", "i-x", "Skipped") };
  if (fa.kind === "swap" && S.step <= STEP.swap) return { ...base, cls: "swap", pill: pill("a", "i-swap", isNow("swap") ? "Asked" : "Sold out"), amt: "—", sub: "" };
  const st = { ...base, art: fa.art, label: fa.label, amt: YEN(fa.price), sub: "shelf" };
  if (m.captured) return { ...st, cls: "paid", pill: pill("g", "i-check", "Paid"), amt: YEN(m.share), sub: "paid" };
  if (m.share != null) return { ...st, cls: "found", pill: pill("g", "i-check", fa.kind === "swap" ? "Swapped" : "Found"), amt: YEN(m.share), sub: "exact" };
  return { ...st, cls: "found", pill: pill("g", "i-check", fa.kind === "swap" ? "Swapped" : "Found") };
}

function tagHTML(f, opts = {}) {
  const t = tagState(f);
  const isNew = opts.isNew && S.anim ? " new" : "";
  return `<div class="tag ${t.cls}${isNew}" id="tag-${f.id}">
    ${art(t.art)}
    <div><div class="t-n">${t.label}</div><div class="t-m">${av(f, true)}${f.name}${t.pill ? " " + t.pill : ""}</div></div>
    <div class="t-r"><span class="amt num">${t.amt}</span><span class="cap">${t.sub}</span></div>
    ${opts.after || ""}
  </div>`;
}

const pass = (state) => `<div class="pass">
  <div><div class="city">CGK</div><div class="cn">Jakarta</div></div>
  <div class="mid">${ic("i-plane")}<span>1–6 Nov</span></div>
  <div class="to"><div class="city">HND</div><div class="cn">Tokyo</div></div>
</div>${state ? `<div style="display:flex;justify-content:center">${state}</div>` : ""}`;

// Shelf as seen by the camera. After the scan, matched items get the friend's avatar.
function shelfHTML(scanned) {
  const slot = (a, price, who, cls = "") =>
    `<div class="slot ${cls}">${who ? `<span class="who">${av(friend(who), true)}</span>` : ""}${art(a)}<span class="price">${price}</span></div>`;
  const hit = (id) => (scanned ? " hit" : "");
  const r1 = [
    slot("a-kitkat", "¥1,188", scanned && "ayu", hit()),
    slot("a-pocky", "¥162", null, scanned ? "miss" : ""),
    `<div class="slot ${scanned ? "hit" : ""}" style="${scanned ? "border-color:#ff8a8a;background:rgba(255,80,80,.12)" : ""}">${scanned ? `<span class="who">${av(friend("bima"), true)}</span>` : ""}${art("a-empty")}<span class="price">完売</span></div>`,
  ].join("");
  const r2 = [
    slot("a-hadalabo", "¥968", scanned && "citra", hit()),
    slot("a-jar", "¥540", null, scanned ? "miss" : ""),
    slot("a-banana4", "¥648", null, scanned ? "" : ""),
  ].join("");
  return `<div class="shelf" aria-label="Camera view of the shelf"><span class="vf"></span>
    <div class="row">${r1}</div><div class="row">${r2}</div>
    <div class="lbl">${ic(scanned ? "i-check" : "i-scan")}${scanned ? "2 found · 1 sold out · 1 not here" : "Don Quijote Shibuya"}</div></div>`;
}

// One shop receipt, lines owned by friends.
function receiptHTML() {
  const lines = [];
  for (const f of FRIENDS) { const fa = fate(f); if (fa.price) lines.push({ f, text: fa.line, price: fa.price }); }
  for (const o of RECEIPT.others) lines.push({ f: null, text: o.line, price: o.price });
  const total = lines.reduce((s, l) => s + l.price, 0);
  const rows = lines.map((l, i) => `<div class="ln${l.f ? " mine" : ""}${S.anim ? "" : " on"}" style="--i:${i}">
      ${l.f ? av(l.f, true) : `<span class="av sm av-dina">D</span>`}<span class="jp">${l.text}</span><span class="p num">${YEN(l.price)}</span></div>`).join("");
  return `<div class="rc" id="receipt">${S.anim ? `<span class="scanbar"></span>` : ""}
    <div class="shop">${RECEIPT.shop}</div><div class="when">${RECEIPT.when}</div><hr>
    ${rows}<hr><div class="tot"><span>合計</span><span class="num">${YEN(total)}</span></div></div>`;
}

function qrHTML() {
  // deterministic pattern with the three finder squares
  let cells = "";
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
    const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    const ring = finder && !((x % 8 === 1) && (y % 8 === 1));
    const on = finder ? ring : ((x * 7 + y * 13 + x * y) % 3 === 0);
    cells += `<i class="${on ? "" : "o"}"></i>`;
  }
  return `<div class="qr" role="img" aria-label="Handover code">${cells}</div>`;
}
