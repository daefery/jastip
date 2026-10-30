// Dina, the traveller.
function dinaPlace() {
  if (S.step <= STEP.day) return `${ic("i-home")}Jakarta`;
  if (S.step <= STEP.split) return `${ic("i-pin")}Tokyo`;
  return `${ic("i-home")}Jakarta`;
}

function dinaView() {
  const k = STEPS[S.step].id;
  const list = (opts = {}) => `<div class="tags">${FRIENDS.filter((f) => opts.all || f.id !== "ayu" || at("day")).map((f) => tagHTML(f, { isNew: f.id === "ayu" && isNow("day"), after: opts.after?.(f) })).join("")}</div>`;
  const reqHead = (n) => `<div class="sec-h"><span>${n} requests</span><span class="num">max ${YEN(FRIENDS.filter((f) => f.id !== "ayu" || at("day")).reduce((s, f) => s + capOf(f), 0))}</span></div>`;

  if (k === "trip") return `
    ${pass()}
    <ol class="how" aria-label="How it works">
      <li>${ic("i-tag")}<b>Friends ask</b><span>with a max price</span></li>
      <li>${ic("i-lock")}<b>PayPal holds</b><span>nothing charged</span></li>
      <li>${ic("i-receipt")}<b>1 receipt</b><span>sets exact prices</span></li>
      <li>${ic("i-qr")}<b>Pay on handover</b><span>rest never taken</span></li>
    </ol>
    
    ${btn("trip", "Open for requests", "i-tag")}`;

  if (k === "paste" || k === "send") return `
    ${pass(pill("g", "i-check", "Open for requests"))}
    ${reqHead(3)}${list()}
    <div class="wait">${ic("i-clock")}More coming in</div>`;

  if (k === "day") return `
    ${reqHead(4)}${list()}
    <div class="sec-h"><span>Shopping day</span></div>
    <div class="btn-row" role="group" aria-label="Shopping day">
      <button type="button" class="btn btn-ghost sm" disabled>Sun 1</button>
      <button type="button" class="btn btn-ink sm" aria-pressed="true">Mon 2</button>
      <button type="button" class="btn btn-ghost sm" disabled>Tue 3</button>
    </div>
    ${btn("day", "Ask 4 PayPal holds", "i-lock", "btn-pp")}`;

  if (k === "approve") return `
    <div class="hero"><span class="big num">3/4</span><span class="sub">holds approved</span></div>
    ${list()}
    <div class="wait">${ic("i-clock")}Waiting for Ayu</div>`;

  if (k === "shelf") return `
    ${shelfHTML(false)}
    <div class="hero"><span class="sub">4 requests on hold</span></div>
    
    ${btn("shelf", "Scan shelf", "i-scan")}`;

  if (k === "found") return `
    ${shelfHTML(true)}
    ${list()}
    ${btn("found", "Ask Bima for a swap", "i-swap")}`;

  if (k === "swap") return `
    ${list()}
    <div class="wait">${ic("i-chat")}Waiting for Bima</div>`;

  if (k === "till") {
    const items = FRIENDS.map(fate).filter((x) => x.price).length;
    return `
    <div class="hero"><span class="big num">${items}</span><span class="sub">items in the basket</span></div>
    ${list()}
    
    ${btn("till", "Pay & scan receipt", "i-camera")}`;
  }

  if (k === "split") return `
    ${receiptHTML()}
    <div class="shares">${FRIENDS.map((f) => {
      const m = money(f), fa = fate(f);
      if (m.released) return `<div class="share" style="opacity:.7">${av(f)}<div><div class="s-n">${f.name}</div><div class="s-m">${fa.kind === "skip" ? "Skipped" : "Not found"}</div></div><div class="s-a num">${YEN(0)}<small>hold released</small></div></div>`;
      return `<div class="share">${av(f)}<div><div class="s-n">${f.name}</div><div class="s-m num">${YEN(fa.price)} + ${YEN(f.fee)} fee</div></div><div class="s-a num">${YEN(m.share)}<small>of ${YEN(m.hold)} hold</small></div></div>`;
    }).join("")}</div>
    ${btn("split", "Fly home", "i-plane")}`;

  const hand = () => `<div class="handlist">${FRIENDS.filter((f) => money(f).share != null).map((f) => {
    const m = money(f);
    return `<div class="hand">${av(f)}<span>${f.name}</span><span class="h-s">${m.captured ? pill("g", "i-check", YEN(m.share)) : pill("n", "i-clock", YEN(m.share))}</span></div>`;
  }).join("")}</div>`;

  if (k === "meet") return `
    <div class="qrbox">${qrHTML()}<span class="pill">${ic("i-qr")}Show to Ayu</span></div>
    ${hand()}`;

  if (k === "paid") return `
    <div class="hero"><span class="pill g">${ic("i-check")}Ayu paid</span><span class="big num">${YEN(money(friend("ayu")).share)}</span></div>
    ${hand()}
    
    ${btn("paid", "Hand over Bima & Citra", "i-qr")}`;

  // done
  const t = totals();
  return `
    <div class="hero"><span class="sub">You earned</span><span class="big num">${YEN(t.fees)}</span><span class="pill g">${ic("i-check")}${t.exact} exact charges</span></div>
    ${hand()}
    
    <button type="button" class="btn btn-ghost" data-act="replay">${ic("i-replay")}<span>Replay</span></button>`;
}
