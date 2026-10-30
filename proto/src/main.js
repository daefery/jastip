// Render everything and wire events (one delegated listener).
const $ = (s) => document.querySelector(s);
const wide = () => matchMedia("(min-width:1080px)").matches;
const tablet = () => matchMedia("(min-width:700px)").matches;

function stagesHTML() {
  const cur = STEPS[S.step].stage;
  return STAGES.map((s, i) => `<li><button type="button" class="stg${i < cur || (i === cur && S.step === STEPS.length - 1) ? " done" : ""}" data-act="stage" data-i="${i}"${i === cur ? ' aria-current="step"' : ""}>
    <span class="dot">${ic(i < cur ? "i-check" : s.icon)}</span><span>${s.label}</span></button></li>`).join("");
}

function guideHTML() {
  const st = STEPS[S.step];
  const other = !wide() && S.role !== st.side;
  const who = st.side === "dina" ? "Dina" : friend(st.friend).name;
  const n = `<span class="g-n num">${S.step + 1}/${STEPS.length}</span>`;
  const go = other
    ? `<button type="button" class="g-go cue" data-act="role" data-role="${st.side}">${ic("i-arrow")}${who}'s phone</button>`
    : "";
  return `${n}<span class="g-t">${st.guide}</span>${go}`;
}

function footHTML() {
  const t = totals();
  const swaps = at("swap") && S.step > STEP.swap && S.swap === "alt" ? 1 : 0;
  return `<div class="sum" aria-label="This run">
      <div class="si z"><b class="num">¥0</b><span>paid upfront</span></div>
      <div class="si"><b class="num">${YEN(t.charged)}</b><span>charged, exact</span></div>
      <div class="si"><b class="num">${YEN(t.released)}</b><span>never taken</span></div>
      <div class="si"><b class="num">${swaps}</b><span>swap${swaps === 1 ? "" : "s"} approved</span></div>
    </div>
    <div class="foot-row"><span class="stamp">Simulation · sandbox data</span>
      <button type="button" class="btn btn-ghost sm" data-act="replay">${ic("i-replay")}<span>Replay</span></button></div>`;
}

let toastT;
function toast(text) {
  const el = $("#toast");
  el.innerHTML = `${ic("i-wallet")}${text}`;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2200);
}

function render() {
  const st = STEPS[S.step];
  // on narrow screens follow the step's side unless the user picked a phone
  document.body.dataset.role = S.role;
  $("#stages").innerHTML = stagesHTML();
  $("#dina-place").innerHTML = dinaPlace();
  $("#dina-body").innerHTML = dinaView();
  $("#friend-tabs").innerHTML = friendTabs();
  $("#friend-body").innerHTML = friendView();
  const showPP = isNow("approve") && S.focus === "ayu" && (wide() || S.role === "friend");
  $("#pp").hidden = !showPP;
  $("#pp").innerHTML = showPP ? ppSheet() : "";
  $("#rail-in").innerHTML = railView();
  $("#guide").innerHTML = guideHTML();
  $("#foot").innerHTML = footHTML();
  const f = friend(S.focus);
  $("#role-friend-av").textContent = f.name[0];
  $("#role-friend-av").style.setProperty("--c", f.color);
  $("#role-friend-name").textContent = f.name;
  $("#role-dina").setAttribute("aria-pressed", S.role === "dina");
  $("#role-friend").setAttribute("aria-pressed", S.role === "friend");
  const t = totals();
  $("#money-n").textContent = YEN(t.charged || t.held);
  const rail = $("#rail");
  rail.classList.toggle("open", S.sheet);
  $("#scrim").hidden = !(S.sheet && !tablet());
  $("#money-btn").setAttribute("aria-expanded", S.sheet);
  if (!tablet()) rail.setAttribute("aria-hidden", String(!S.sheet)); else rail.removeAttribute("aria-hidden");
  if (S.anim) {
    document.querySelectorAll(".rc .ln").forEach((el, i) => setTimeout(() => el.classList.add("on"), 250 + i * 180));
    const last = apiLog().slice(-1)[0];
    if (last && S.prev >= 0) {
      const before = (() => { const s = S.step; S.step = S.prev; const n = apiLog().length; S.step = s; return n; })();
      if (apiLog().length > before) toast(`${last.m} ${last.who} ${YEN(last.amt)}`);
    }
  }
  S.anim = false;
}

function act(el) {
  const a = el.dataset.act;
  if (a === "do") {
    const id = el.dataset.step;
    if (S.step !== STEP[id]) return;
    go(S.step + 1);
    const nx = STEPS[S.step];
    if (!wide()) { S.role = nx.side; render(); }
    if (!tablet()) window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (a === "role") { S.role = el.dataset.role; if (S.role === "friend") S.focus = STEPS[S.step].friend; render(); if (!tablet()) window.scrollTo({ top: 0 }); return; }
  if (a === "focus") { S.focus = el.dataset.id; render(); return; }
  if (a === "cap") { S.capAyu = Math.max(800, Math.min(2500, S.capAyu + Number(el.dataset.d))); render(); return; }
  if (a === "swap") { S.swap = el.dataset.v; render(); return; }
  if (a === "stage") {
    const i = Number(el.dataset.i);
    const first = STEPS.findIndex((s) => s.stage === i);
    go(first, { jump: true });
    if (!wide()) { S.role = STEPS[S.step].side; render(); }
    return;
  }
  if (a === "sheet") { S.sheet = !S.sheet; render(); if (S.sheet) $("#rail .rail-x")?.focus(); return; }
  if (a === "sheet-close") { S.sheet = false; render(); $("#money-btn").focus(); return; }
  if (a === "replay") { S.capAyu = 1500; S.swap = "alt"; S.sheet = false; go(0, { jump: true }); S.role = "dina"; render(); window.scrollTo({ top: 0 }); }
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (el && !el.disabled) act(el);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && S.sheet) { S.sheet = false; render(); $("#money-btn").focus(); }
});
let lastW = innerWidth;
addEventListener("resize", () => { if ((lastW < 1080) !== (innerWidth < 1080) || (lastW < 700) !== (innerWidth < 700)) { S.sheet = false; render(); } lastW = innerWidth; });

render();
