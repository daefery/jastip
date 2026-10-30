// UI kit: icons, category tiles, avatars, sheets (bottom sheet on phone, dialog on tablet+), toast, api.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const P = {
  back: '<path d="M15 4.5 7.5 12l7.5 7.5" stroke-width="2.4"/>', plus: '<path d="M12 5v14M5 12h14" stroke-width="2.4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.6"/>', x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="2.4"/>',
  swap: '<path d="M5 8h13l-3.5-3.5M19 16H6l3.5 3.5"/>', camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>', qr: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M20.5 14v.01M14 20.5h.01M17 20.5h3.5V17"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.1"/>', chat: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4L12 18.4"/>',
  spark: '<path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z" fill="currentColor" stroke="none"/>',
  plane: '<path d="M21 15.5v-2l-8-5V4a1.5 1.5 0 0 0-3 0v4.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z" fill="currentColor" stroke="none"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.4-4.6" stroke-width="2.2"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6" stroke-width="2.2"/>', trash: '<path d="M5 7h14M10 4h4M7 7l1 13h8l1-13"/>', more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  scale: '<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z"/>', bag: '<path d="M5 8h14l-1.2 12a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  // categories
  snack: '<path d="M12 3.5a8.5 8.5 0 1 0 8.4 9.8 3 3 0 0 1-3.6-3.6 3 3 0 0 1-3.2-3.2A3 3 0 0 1 12 3.5z"/><circle cx="8.5" cy="11" r=".9" fill="currentColor"/><circle cx="11" cy="15.5" r=".9" fill="currentColor"/><circle cx="15.5" cy="15" r=".9" fill="currentColor"/>',
  beauty: '<rect x="8" y="9" width="8" height="12" rx="2"/><path d="M10 9V6.5h4V9M11 3.5h2v3h-2z"/>', medicine: '<rect x="4" y="8" width="16" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="m9.7 15.3 4.6-6.6"/>',
  drink: '<path d="M6 7h12l-1.5 13h-9z"/><path d="M8 3.5h8M6.5 11.5h11"/>', fashion: '<path d="M8 4 4 7l2 3.5 2-1V20h8V9.5l2 1L20 7l-4-3a4 4 0 0 1-8 0z"/>',
  gadget: '<path d="M4 14a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/>',
  toy: '<circle cx="12" cy="13" r="6"/><circle cx="7" cy="6.5" r="2.3"/><circle cx="17" cy="6.5" r="2.3"/>', other: '<path d="M5 8h14l-1.2 12a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
};
export const ic = (n, c = "i") => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.other}</svg>`;
const CATS = ["snack", "beauty", "medicine", "drink", "fashion", "gadget", "toy", "other"];
export const cat = (a) => (CATS.includes(a) ? a : "other");
export const pic = (a, size) => `<span class="pic c-${cat(a)}"${size ? ` style="--ps:${size}px"` : ""} aria-hidden="true">${ic(cat(a))}</span>`;
export const av = (u, s) => `<span class="av" style="--c:${esc(u?.color || "#8e8e93")}${s ? `;--s:${s}px` : ""}" aria-hidden="true">${esc((u?.name || "?")[0].toUpperCase())}</span>`;

export async function api(path, opts = {}) {
  const res = await fetch(path, { method: opts.method || (opts.body ? "POST" : "GET"), headers: opts.body ? { "Content-Type": "application/json" } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(b.error || `Something went wrong (${res.status})`); e.status = res.status; throw e; }
  return b;
}

let toastT;
export function toast(msg, kind = "ok") {
  const el = document.getElementById("toast");
  el.className = `toast${kind === "err" ? " err" : ""}`;
  el.innerHTML = `${ic(kind === "err" ? "alert" : "check")}<span>${esc(msg)}</span>`;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2600);
  if (kind === "ok" && navigator.vibrate) navigator.vibrate(10);
}

// One sheet at a time. Focus moves in, Esc closes, focus returns. Phone: bottom sheet; tablet+: dialog.
export function sheet({ title, body, left = "", right, onClose, label }) {
  const host = document.getElementById("sheets");
  host.querySelectorAll(".sheet:not(.closing)").forEach((o) => o._close?.());
  const prev = document.activeElement;
  const scrim = document.createElement("div"); scrim.className = "scrim";
  const el = document.createElement("div");
  el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", label || title || "Dialog");
  el.innerHTML = `<div class="grab"></div><div class="sh-h">${left || "<span></span>"}<h2>${esc(title || "")}</h2>${right ?? `<button class="lk" data-close>Close</button>`}</div>${body}`;
  host.append(scrim, el);
  const app = document.getElementById("app");
  app.inert = true;
  let done = false;
  const close = (instant) => {
    if (done) return; done = true;
    app.inert = false;
    removeEventListener("keydown", key);
    const finish = () => { el.remove(); scrim.remove(); if (prev?.isConnected) prev.focus?.({ preventScroll: true }); onClose?.(); };
    if (instant === true) return finish();
    el.classList.add("closing"); scrim.classList.add("closing");
    setTimeout(finish, 260);
  };
  const key = (e) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key !== "Tab") return;
    const f = [...el.querySelectorAll('a[href],button:not([disabled]),input:not([type=hidden]):not([hidden]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  };
  addEventListener("keydown", key);
  scrim.onclick = close;
  el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  let y0 = null;
  el.addEventListener("touchstart", (e) => { if (el.scrollTop > 0 || innerWidth >= 700) return; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener("touchmove", (e) => { if (y0 == null) return; const dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; }, { passive: true });
  el.addEventListener("touchend", (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; el.style.transform = ""; if (dy > 110) close(); });
  setTimeout(() => (el.querySelector("[data-primary],input:not([hidden]),button:not([data-close])") || el.querySelector("button"))?.focus({ preventScroll: true }), 320);
  el._close = close;
  return { el, close };
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>${label ? `<span>${esc(label)}</span>` : ""}`; }
  else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}

import qrcode from "./vendor/qrcode.js";
// Real QR code (MIT, Kazuhiko Arase) for a URL.
export function qrSvg(text, label = "QR code") {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  return `<div class="qrreal" role="img" aria-label="${esc(label)}">${q.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div>`;
}
export function qr(seed) {
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let cells = "";
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const f = (a, b) => x >= a && x < a + 7 && y >= b && y < b + 7;
    let on;
    if (f(0, 0) || f(14, 0) || f(0, 14)) { const lx = x % 14 % 7, ly = y % 14 % 7; on = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx > 1 && lx < 5 && ly > 1 && ly < 5); }
    else { h = (h * 1103515245 + 12345) >>> 0; on = (h >> 16) % 2 === 0; }
    cells += `<i class="${on ? "" : "o"}"></i>`;
  }
  return `<div class="qr" role="img" aria-label="Handover code">${cells}</div>`;
}

export function fileToDataUrl(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL("image/jpeg", 0.88)); URL.revokeObjectURL(img.src); };
    img.onerror = reject; img.src = URL.createObjectURL(file);
  });
}
export const dayLabel = (iso) => new Date(iso + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const dateRange = (t) => { const d = (s) => new Date(s + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }); return `${d(t.depart)} – ${d(t.ret)}`; };
export const when = (ms) => new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Close every open sheet immediately (route change, browser Back).
export function closeAllSheets() {
  document.querySelectorAll("#sheets .sheet").forEach((x) => x._close?.(true));
  document.getElementById("sheets").innerHTML = "";
  document.getElementById("app").inert = false;
}
