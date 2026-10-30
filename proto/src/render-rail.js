// The PayPal money rail: one bar per friend. Blue = held, green = charged, hatched = never taken.
function railView() {
  const t = totals();
  const rows = FRIENDS.map((f) => {
    const m = money(f);
    const w = (n) => `${Math.max(0, Math.min(100, (n / MAX_BAR) * 100))}%`;
    let fill = "0%", rest = "0%", restLeft = "0%", fc = "", label = "", right = "", st = "", stc = "";
    if (m.status === "none") { st = "—"; label = "no hold"; }
    if (m.status === "held") { fill = w(m.hold); fc = ""; label = YEN(m.hold); st = "HELD"; stc = "h"; }
    if (m.status === "exact" || m.status === "renewed") { fill = w(m.share); restLeft = w(m.share); rest = w(m.hold - m.share); label = YEN(m.share); right = YEN(m.hold - m.share); st = m.status === "renewed" ? "RENEWED" : "HELD"; stc = "h"; }
    if (m.status === "captured") { fill = w(m.share); fc = "c"; restLeft = w(m.share); rest = w(m.hold - m.share); label = YEN(m.share); right = YEN(m.never); st = "CAPTURED"; stc = "c"; }
    if (m.status === "void") { restLeft = "0%"; rest = w(m.hold); label = ""; right = YEN(m.hold); st = "VOIDED"; stc = "v"; }
    return `<div class="mrow" id="m-${f.id}">
      <div class="mh"><span class="mn">${av(f, true)}${f.name}</span><span class="ms ${stc}">${st}</span></div>
      <div class="bar${m.status === "none" ? " empty" : ""}" role="img" aria-label="${f.name}: ${st.toLowerCase() || "no hold"} ${label}">
        <span class="fill ${fc}" style="width:${fill}"></span><span class="rest" style="left:${restLeft};width:${rest}"></span>
        <span class="bl"><span class="num">${label}</span><span class="num">${right}</span></span>
      </div>
    </div>`;
  }).join("");
  const log = apiLog().slice(-4);
  const api = log.length
    ? log.map((l) => `<div class="al"><span class="m">${l.m}</span><span>${l.who}</span><span class="num">${YEN(l.amt)}</span><span class="ok">${l.r}</span></div>`).join("")
    : `<div class="al" style="opacity:1">No PayPal calls yet</div>`;
  return `<div class="grabber"></div>
    <div class="rail-h"><h2 id="rail-h">${ic("i-wallet")}PayPal</h2><span class="stamp" style="color:#ffd27a;border-color:#ffd27a">Sandbox</span>
      <button type="button" class="rail-x" data-act="sheet-close" aria-label="Close PayPal panel">${ic("i-x")}</button></div>
    <div class="kpis">
      <div class="kpi zero"><div class="k">Paid upfront</div><div class="v num">¥0</div></div>
      <div class="kpi"><div class="k">${t.charged ? "Charged" : at("split") ? "To charge, exact" : "On hold"}</div><div class="v num">${YEN(t.charged || t.held)}</div></div>
    </div>
    ${rows}
    <div class="legend"><span><i style="background:#3f7ee8"></i>held</span><span><i style="background:#1fb57a"></i>charged</span><span><i style="background:repeating-linear-gradient(45deg,#3a4f8a 0 3px,#1d2f63 3px 6px)"></i>never taken</span></div>
    <div class="api" aria-label="PayPal API calls">${api}</div>`;
}
