// Flow state. Everything on screen is derived from S.step plus two choices (Ayu's cap, Bima's swap).
const STEPS = [
  { id: "trip",     stage: 0, side: "dina",  friend: "ayu",  guide: "Dina flies to Tokyo. She opens her trip for requests." },
  { id: "paste",    stage: 0, side: "friend",friend: "ayu",  guide: "Ayu pastes a TikTok link. AI finds the product." },
  { id: "send",     stage: 0, side: "friend",friend: "ayu",  guide: "Ayu sets her max price and sends the request." },
  { id: "day",      stage: 1, side: "dina",  friend: "ayu",  guide: "4 friends asked. Dina picks Monday as shopping day." },
  { id: "approve",  stage: 1, side: "friend",friend: "ayu",  guide: "Ayu approves a PayPal hold. Nothing is charged." },
  { id: "shelf",    stage: 2, side: "dina",  friend: "ayu",  guide: "In the shop, Dina points her camera at the shelf." },
  { id: "found",    stage: 2, side: "dina",  friend: "bima", guide: "2 found. Bima's pick is sold out, Dewi's isn't here." },
  { id: "swap",     stage: 2, side: "friend",friend: "bima", guide: "Bima picks a swap in one tap." },
  { id: "till",     stage: 3, side: "dina",  friend: "ayu",  guide: "Dina pays at the till and scans one receipt." },
  { id: "split",    stage: 3, side: "dina",  friend: "ayu",  guide: "Each friend gets an exact share. Dewi's hold is released." },
  { id: "meet",     stage: 4, side: "friend",friend: "ayu",  guide: "Back home. Ayu scans Dina's code when she gets her bag." },
  { id: "paid",     stage: 4, side: "dina",  friend: "ayu",  guide: "Ayu paid exactly her share. The rest was never taken." },
  { id: "done",     stage: 4, side: "dina",  friend: "ayu",  guide: "Done. No one paid upfront. No one paid too much." },
];
const STEP = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));
const MAX_BAR = 2000; // yen at 100% bar width

const S = {
  step: 0,
  role: "dina",          // which phone a narrow screen shows
  focus: "ayu",          // which friend's phone is shown
  capAyu: 1500,
  swap: "alt",           // "alt" | "skip"
  sheet: false,          // money sheet open on phones
  anim: false,           // true right after a forward step (play entry animations)
  prev: -1,
};

const at = (id) => S.step >= STEP[id];
const friend = (id) => FRIENDS.find((f) => f.id === id);
const capOf = (f) => (f.id === "ayu" ? S.capAyu : f.cap);
const holdOf = (f) => capOf(f) + f.fee;

// What happened to one friend's request, at the current step.
function fate(f) {
  const shop = SHOP[f.id];
  if (shop.outcome === "found") return { kind: "found", price: shop.price, line: shop.line, art: f.art, label: f.short };
  if (shop.outcome === "swap") {
    if (S.swap === "skip") return { kind: "skip" };
    return { kind: "swap", price: shop.alt.price, line: shop.alt.line, art: shop.alt.art, label: shop.alt.label };
  }
  return { kind: "none" };
}

// Money state of one friend's PayPal hold.
function money(f) {
  const hold = holdOf(f);
  const approved = at("shelf") || (S.step === STEP.approve && f.id !== "ayu");
  const fa = fate(f);
  const released = (fa.kind === "none" && at("split")) || (fa.kind === "skip" && at("till"));
  const share = (fa.kind === "found" || fa.kind === "swap") && at("split") ? fa.price + f.fee : null;
  const captured = share != null && (at("done") || (at("paid") && f.id === "ayu"));
  const renewed = approved && !released && at("meet") && !captured;
  let status = "none";
  if (approved) status = "held";
  if (share != null) status = "exact";
  if (renewed) status = "renewed";
  if (released) status = "void";
  if (captured) status = "captured";
  return { hold, approved, share, captured, released, renewed, status, never: share != null ? hold - share : released ? hold : 0 };
}

function totals() {
  let held = 0, charged = 0, released = 0, fees = 0, exact = 0;
  for (const f of FRIENDS) {
    const m = money(f);
    if (m.approved && !m.released && !m.captured) held += m.share ?? m.hold;
    if (m.captured) { charged += m.share; fees += f.fee; exact++; }
    if (m.released) released += m.hold;
    if (m.share != null && !m.released) released += m.hold - m.share;
  }
  const till = FRIENDS.reduce((s, f) => { const fa = fate(f); return s + (at("split") && fa.price ? fa.price : 0); }, 0) + (at("split") ? RECEIPT.others.reduce((s, o) => s + o.price, 0) : 0);
  return { held, charged, released, fees, exact, till };
}

// PayPal API calls made up to now (what the money rail prints).
function apiLog() {
  const L = [];
  const short = (f) => f.name;
  if (S.step >= STEP.approve) for (const f of FRIENDS) if (f.id !== "ayu") L.push({ m: "AUTHORIZE", who: short(f), amt: holdOf(f), r: "201" });
  if (at("shelf")) L.push({ m: "AUTHORIZE", who: "Ayu", amt: holdOf(friend("ayu")), r: "201" });
  if (S.swap === "skip" && at("till")) L.push({ m: "VOID", who: "Bima", amt: holdOf(friend("bima")), r: "VOIDED" });
  if (at("split")) L.push({ m: "VOID", who: "Dewi", amt: holdOf(friend("dewi")), r: "VOIDED" });
  if (at("meet")) for (const f of FRIENDS) { const m = money(f); if (m.share != null) L.push({ m: "REAUTHORIZE", who: short(f), amt: m.hold, r: "day 6" }); }
  if (at("paid")) L.push({ m: "CAPTURE", who: "Ayu", amt: money(friend("ayu")).share, r: "COMPLETED" });
  if (at("done")) for (const f of FRIENDS) { const m = money(f); if (m.captured && f.id !== "ayu") L.push({ m: "CAPTURE", who: short(f), amt: m.share, r: "COMPLETED" }); }
  return L;
}

function go(n, opts = {}) {
  const next = Math.max(0, Math.min(STEPS.length - 1, n));
  S.prev = S.step;
  S.anim = !opts.jump && next === S.step + 1;
  if (next < STEP.swap) S.swap = "alt";
  if (next <= STEP.send && opts.jump) S.capAyu = 1500;
  S.step = next;
  S.focus = STEPS[next].friend;
  render();
}
const advance = (fromId) => { if (S.step === STEP[fromId]) go(S.step + 1); };
