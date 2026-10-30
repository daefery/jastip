// The friend's phone (Ayu by default; Bima during the swap; any friend via the tabs).
function friendTabs() {
  return FRIENDS.map((f) => {
    const wants = (f.id === "ayu" && (isNow("paste") || isNow("send") || isNow("approve") || isNow("meet"))) || (f.id === "bima" && isNow("swap"));
    return `<button type="button" class="ftab${wants ? " wants" : ""}" data-act="focus" data-id="${f.id}" aria-pressed="${S.focus === f.id}" aria-label="${f.name}${wants ? ", needs action" : ""}">${av(f)}<span class="ft-n">${f.name}</span></button>`;
  }).join("");
}

function moneyLine(f) {
  const m = money(f);
  const map = {
    none: ["n", "i-clock", "No hold yet"],
    held: ["", "i-lock", `${YEN(m.hold)} on hold`],
    exact: ["", "i-lock", `${YEN(m.share)} to pay at handover`],
    renewed: ["", "i-renew", `${YEN(m.share)} to pay at handover`],
    void: ["g", "i-check", "Hold released · ¥0"],
    captured: ["g", "i-check", `Paid ${YEN(m.share)}`],
  }[m.status];
  return pill(map[0], map[1], map[2]);
}

function friendView() {
  const f = friend(S.focus);
  const k = STEPS[S.step].id;
  const m = money(f);

  // Ayu's own request flow
  if (f.id === "ayu" && S.step <= STEP.send) {
    if (k === "trip") return `<div class="wait">${ic("i-plane")}Dina hasn't opened her trip yet</div>`;
    const found = `<div class="found">${art("a-kitkat")}<div><div class="ai">${ic("i-spark")}Found</div><div style="font-weight:700">Matcha KitKat, big bag</div><div class="s-m" style="font-size:13px;color:var(--ink-3)">Nestlé Japan · 12 pcs</div></div></div>`;
    if (k === "paste") return `
      <div class="pass" style="grid-template-columns:auto 1fr;gap:12px"><span class="av av-dina">D</span><div><div style="font-weight:700">Dina → Tokyo</div><div class="cn" style="font-size:13px;color:var(--ink-3)">1–6 Nov · 3 requests</div></div></div>
      <div class="ask">
        <div class="paste">${ic("i-chat")}<span>${f.src}</span></div>
        ${btn("paste", "Find it", "i-spark")}
      </div>`;
    return `
      <div class="ask">${found}
        <div class="capset"><span style="font-weight:700">Max price</span>
          <div class="step"><button type="button" data-act="cap" data-d="-100" aria-label="Lower max price">−</button><span class="v num" id="cap-v">${YEN(S.capAyu)}</span><button type="button" data-act="cap" data-d="100" aria-label="Raise max price">+</button></div>
        </div>
        <div class="s-m" style="font-size:13px;color:var(--ink-3);font-weight:600">Seen online for about ¥1,200</div>
      </div>
      ${btn("send", "Send to Dina", "i-arrow")}`;
  }

  // Bima's swap
  if (f.id === "bima" && isNow("swap")) {
    const a = SHOP.bima.alt;
    return `
      <div class="chat">
        <div class="bub"><div class="bt">${ic("i-store")}Dina · Don Quijote</div>Tokyo Banana 8 is sold out.</div>
      </div>
      <div class="swapcards" role="group" aria-label="Swap choice">
        <button type="button" class="sw${S.swap === "alt" ? " cue" : ""}" data-act="swap" data-v="alt" aria-pressed="${S.swap === "alt"}">${art(a.art)}<span>4 pack</span><span class="d num">${YEN(a.price)}</span></button>
        <button type="button" class="sw" data-act="swap" data-v="skip" aria-pressed="${S.swap === "skip"}">${art("a-empty")}<span>Skip it</span><span class="d">release hold</span></button>
      </div>
      ${btn("swap", S.swap === "alt" ? "Yes, get the 4 pack" : "Skip, release my hold", "i-check", "btn-ink")}`;
  }

  const head = `<div class="hero">${moneyLine(f)}</div>`;
  const tag = at("send") || f.id !== "ayu" ? `<div class="tags">${tagHTML(f)}</div>` : "";

  if (f.id === "ayu" && isNow("approve")) return `${tag}<div class="wait">${ic("i-lock")}PayPal is asking you</div>`;

  if (f.id === "ayu" && isNow("meet")) return `
    ${tag}
    <div class="qrbox"><div style="font-weight:700">Got your bag?</div>
      <div style="position:relative;width:170px;height:150px;border-radius:14px;background:#1b1e26;display:grid;place-items:center">${qrHTML()}</div>
      ${btn("meet", "Scan Dina's code", "i-qr", "btn-pp")}
    </div>`;

  if (m.status === "captured" && f.id === "ayu") return `
    <div class="hero"><span class="pill g">${ic("i-check")}Paid with PayPal</span><span class="big num">${YEN(m.share)}</span><span class="sub num">${YEN(m.never)} of your hold was never taken</span></div>
    ${tag}`;

  // the receipt is in: show this friend's line from the one receipt, and what they will pay
  if (at("split") && m.share != null && !m.captured && STEPS[S.step].id !== "meet") {
    const fa = fate(f);
    return `${head}
      <div class="rc mini"><div class="shop">${RECEIPT.shop}</div><hr>
        <div class="ln on mine">${av(f, true)}<span class="jp">${fa.line}</span><span class="p num">${YEN(fa.price)}</span></div>
        <div class="ln on"><span></span><span>Jastip fee</span><span class="p num">${YEN(f.fee)}</span></div><hr>
        <div class="tot"><span>At handover</span><span class="num">${YEN(m.share)}</span></div></div>
      <div class="saved"><span class="num">${YEN(m.hold - m.share)}</span> of your hold will never be taken</div>`;
  }

  const waitText = {
    trip: "Dina hasn't opened her trip yet",
    paste: "Request sent", send: "Request sent",
    day: "Shopping day coming", approve: "Hold approved",
    shelf: "Dina is in the shop", found: "Dina is in the shop", swap: "Dina is in the shop",
    till: "Dina is paying", split: "Receipt in", meet: "Waiting for handover", paid: "Waiting for handover", done: "",
  }[k];
  return `${head}${tag}${waitText ? `<div class="wait">${ic(m.status === "void" ? "i-check" : "i-clock")}${m.status === "void" ? "Nothing to pay" : waitText}</div>` : ""}`;
}

// PayPal approval sheet for Ayu
function ppSheet() {
  const f = friend("ayu");
  return `<div class="grab"></div>
    <div class="pp-h"><span class="ppl">Pay<b>Pal</b></span><span class="sbx">Sandbox</span></div>
    <div class="row"><span>Jastip · Dina, Tokyo</span><span>${art("a-kitkat", "art")}</span></div>
    <div class="row"><span>Up to</span><b class="num">${YEN(holdOf(f))}</b></div>
    <div class="row"><span>Item max + fee</span><span class="num">${YEN(capOf(f))} + ${YEN(f.fee)}</span></div>
    <div class="hold">${ic("i-lock")}Hold only. You pay the exact receipt price when you get the item.</div>
    <button type="button" class="btn btn-pp cue" data-act="do" data-step="approve">Agree &amp; hold</button>`;
}
