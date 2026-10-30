// Receipt: photo -> AI reads lines -> code plans each charge -> traveller confirms -> PayPal captures/voids.
import { ic, esc, api, av, toast, busy, sheet, fileToDataUrl, sleep } from "../ui.js";
import { fmt } from "../money.js";

export function receiptFlow(v, done) {
  const t = v.trip, cur = t.currency;
  const s = sheet({ title: "Receipt", left: `<button class="nb" data-close>Cancel</button>`, right: "", body: `
    <div id="rx">
      <div class="empty" style="padding:18px 8px"><div class="glyph">${ic("receipt")}</div><b>One photo, exact charges</b><span>Lay the receipt flat. Every friend pays their line plus fee.</span></div>
      <label class="btn" for="rx-file" style="cursor:pointer">${ic("camera")}<span>Take photo</span></label>
      <input id="rx-file" type="file" accept="image/*" capture="environment" hidden>
      <div style="height:10px"></div>
      <button class="btn gray" id="rx-sample">${ic("receipt")}<span>Use sample receipt</span></button>
      <div class="sec-f" style="text-align:center">The sample is a Don Quijote receipt for testing.</div>
    </div>` });
  const box = s.el.querySelector("#rx");

  const read = async (dataUrl) => {
    box.innerHTML = `<div class="photo"><img src="${dataUrl}" alt="Receipt photo"><div class="scan"></div></div>
      <p class="lead" style="text-align:center;margin-top:14px" id="rx-msg">Reading the receipt…</p>`;
    const msgs = ["Reading the receipt…", "Matching lines to requests…", "Checking each max price…"];
    let i = 0; const tick = setInterval(() => { const m = box.querySelector("#rx-msg"); if (m) m.textContent = msgs[++i % msgs.length]; }, 1800);
    try {
      const r = await api(`/api/trips/${t.id}/receipt`, { body: { image: dataUrl } });
      clearInterval(tick);
      plan(r, dataUrl);
    } catch (e) {
      clearInterval(tick);
      box.innerHTML = `<div class="empty"><div class="glyph" style="color:var(--red)">${ic("xc")}</div><b>Couldn't read it</b><span>${esc(e.message)}</span></div><button class="btn gray" id="rx-again">Try again</button>`;
      box.querySelector("#rx-again").onclick = () => { s.close(); receiptFlow(v, done); };
    }
  };

  const plan = (r, dataUrl) => {
    const byId = new Map(v.requests.map((x) => [x.id, x]));
    const total = r.plan.reduce((a, p) => a + p.charge, 0);
    const owned = new Map(r.plan.filter((p) => p.line).map((p) => [p.line.n, byId.get(p.id)?.friend]));
    box.innerHTML = `
      <div class="receipt"><div class="shop">${esc(r.shop || "Receipt")}</div><hr>
        ${r.lines.map((l, i) => { const f = owned.get(l.n); return `<div class="ln${f ? " mine" : ""}" style="--i:${i}"><span>${f ? av(f, 20) : ""}</span><span>${esc(l.text)}${l.disc ? " (disc.)" : ""}</span><span>${fmt(l.price, cur)}</span></div>`; }).join("")}
      </div>
      <div style="height:22px"></div>
      <div class="sec"><div class="sec-h">Charges <b class="num">${fmt(total, cur)}</b></div><div class="list">
        ${r.plan.map((p) => { const q = byId.get(p.id); return `<div class="row with-thumb">${av(q.friend, 40)}<div class="main"><div class="t">${esc(q.friend.name)}</div><div class="s">${p.line ? `${esc(p.title)} · ${fmt(p.line.price, cur)} + ${fmt(t.fee, cur)}${p.over ? " · capped at max" : ""}` : `${esc(p.title)} · ${esc(p.why)}`}</div></div>
          <div style="text-align:right">${p.charge ? `<div class="v strong num">${fmt(p.charge, cur)}</div><div class="s num" style="font-size:13px;color:var(--label2)">of ${fmt(p.hold, cur)}</div>` : `<span class="pill">Release</span>`}</div></div>`; }).join("")}
      </div><div class="sec-f">Each charge is the receipt line plus fee, never above the friend's hold. Unmatched holds are released.</div></div>
      <div class="cta no-tab"><button class="btn" id="rx-go">${ic("lock")}<span>Charge ${r.plan.filter((p) => p.charge).length} · release ${r.plan.filter((p) => !p.charge).length}</span></button></div>`;
    box.querySelector("#rx-go").onclick = async (e) => {
      busy(e.currentTarget, true, "Talking to PayPal");
      try {
        const out = await api(`/api/trips/${t.id}/settle`, { body: { receipt: r.receipt } });
        const bad = out.results.filter((x) => x.error);
        s.close();
        if (bad.length) toast(`${bad.length} PayPal call failed. See Activity.`, "err"); else toast("Charged exactly. Holds released.");
        done();
      } catch (er) { busy(e.currentTarget, false); toast(er.message, "err"); }
    };
  };

  box.querySelector("#rx-file").onchange = async (e) => { const f = e.target.files[0]; if (f) read(await fileToDataUrl(f)); };
  box.querySelector("#rx-sample").onclick = async () => {
    const res = await fetch("/sample/receipt.png"); const blob = await res.blob();
    read(await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); }));
  };
}
