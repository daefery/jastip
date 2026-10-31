// Receipt: photo -> AI reads lines -> code plans each charge -> traveller confirms -> PayPal captures/voids.
import { ic, esc, api, av, toast, busy, sheet, fileToDataUrl } from "../ui.js";
import { fmt } from "../money.js";

export function receiptFlow(v, done) {
  const t = v.trip, cur = t.currency;
  const s = sheet({ title: "Scan receipt", right: `<button class="lk" data-close>Cancel</button>`, body: `<div id="rx">
      <div class="note">${ic("receipt")}<span>Lay the receipt flat in good light. Each friend pays their line + ${fmt(t.fee, cur)}, never more than their hold.</span></div>
      <div style="height:14px"></div>
      <button class="btn dark" id="rx-take" data-primary>${ic("camera")}Take or choose photo</button>
      <input id="rx-file" type="file" accept="image/*" capture="environment" hidden>
      <div style="height:8px"></div>
      <button class="btn light" id="rx-sample">${ic("receipt")}Use sample receipt</button>
      <p class="hint" style="text-align:center">The sample is a Don Quijote receipt for testing.</p></div>` });
  const box = s.el.querySelector("#rx");

  const read = async (dataUrl) => {
    box.innerHTML = `<div class="photo"><img src="${dataUrl}" alt="Receipt photo"><div class="scan"></div></div><p class="hint" style="text-align:center;margin-top:12px" id="rx-msg" aria-live="polite">Reading the receipt…</p>`;
    const msgs = ["Reading the receipt…", "Matching lines to asks…", "Checking each max price…"];
    let i = 0; const tick = setInterval(() => { const m = box.querySelector("#rx-msg"); if (m) m.textContent = msgs[++i % msgs.length]; }, 1800);
    const t0 = Date.now();
    try { const r = await api(`/api/trips/${t.id}/receipt`, { body: { image: dataUrl } }); clearInterval(tick); plan(r, Math.round((Date.now() - t0) / 1000)); }
    catch (e) {
      clearInterval(tick);
      box.innerHTML = `<div class="empty" style="padding:20px"><b>Couldn't read it</b><span>${esc(e.message)}</span></div><button class="btn dark" id="rx-again">Try again</button>`;
      box.querySelector("#rx-again").onclick = () => { s.close(); setTimeout(() => receiptFlow(v, done), 300); };
    }
  };

  const plan = (r, secs) => {
    const byId = new Map(v.requests.map((x) => [x.id, x]));
    const owned = new Map(r.plan.filter((p) => p.line).map((p) => [p.line.n, byId.get(p.id)?.friend]));
    const total = r.plan.reduce((a, p) => a + p.charge, 0);
    const nC = r.plan.filter((p) => p.charge).length, nR = r.plan.filter((p) => !p.charge).length;
    s.el.querySelector(".sh-h h2").textContent = `Read in ${secs} s`;
    box.innerHTML = `
      <div class="receipt"><div class="shop">${esc(r.shop || "Receipt")}</div><hr>
        ${r.lines.map((l) => { const f = owned.get(l.n); return `<div class="l"><span>${f ? av(f, 20) : ""}</span><span>${esc(l.text)}${l.disc ? " (disc.)" : ""}</span><span>${fmt(l.price, cur)}</span></div>`; }).join("")}</div>
      <div class="split" style="margin-top:12px">${r.plan.map((p) => { const q = byId.get(p.id); return `<div class="sr${p.charge ? "" : " x"}">${av(q.friend, 28)}<div class="t">${esc(q.friend.name)} · ${esc(p.title)}<small>${p.line ? `${fmt(p.line.price, cur)} + ${fmt(t.fee, cur)} fee${p.over ? " · capped at max" : ""}` : esc(p.why)}</small></div>
        <b class="num">${p.charge ? fmt(p.charge, cur) : `${fmt(p.hold || 0, cur)} released`}${p.charge ? `<small>of ${fmt(p.hold, cur)}</small>` : ""}</b></div>`; }).join("")}</div>
      <p class="hint" style="margin:10px 4px 14px">Wrong match? Cancel and retake. Nothing moves until you tap below.</p>
      <button class="btn dark" id="rx-go">${ic("lock")}Charge ${nC}${nR ? ` · release ${nR}` : ""} · ${fmt(total, cur)}</button>`;
    box.querySelector("#rx-go").onclick = async (e) => {
      busy(e.currentTarget, true, "Talking to PayPal");
      try {
        const out = await api(`/api/trips/${t.id}/settle`, { body: { receipt: r.receipt, rev: r.rev } });
        const bad = out.results.filter((x) => x.error);
        s.close();
        toast(bad.length ? `PayPal hasn't confirmed ${bad.length} step${bad.length > 1 ? "s" : ""}. Retry from the trip.` : "Charged exactly. Holds released.", bad.length ? "err" : "ok");
        done();
      } catch (er) {
        busy(e.currentTarget, false); toast(er.message, "err");
        if (/changed/.test(er.message)) { s.close(); done(); } // list changed: show the fresh trip, scan again
      }
    };
  };

  box.querySelector("#rx-take").onclick = () => box.querySelector("#rx-file").click();
  box.querySelector("#rx-file").onchange = async (e) => { const f = e.target.files[0]; if (f) read(await fileToDataUrl(f)); };
  box.querySelector("#rx-sample").onclick = async () => {
    const blob = await (await fetch("/sample/receipt.png")).blob();
    read(await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); }));
  };
}
