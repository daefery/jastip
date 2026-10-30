// Tiny UI kit: icons (SF Symbols look-alikes), html escaping, sheets, toast, api.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const P = {
  back: '<path d="M15 4.5 7.5 12l7.5 7.5" stroke-width="2.6"/>',
  chev: '<path d="m9 5 7 7-7 7" stroke-width="2.4"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke-width="2.4"/>',
  plane: '<path d="M21 15.5v-2l-8-5V4a1.5 1.5 0 0 0-3 0v4.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z" fill="currentColor" stroke="none"/>',
  bag: '<path d="M5 8h14l-1.2 12a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke-width="2.2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.8"/>',
  checkc: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="m7.5 12.3 3 3 6-6.3" stroke="#fff" stroke-width="2.4"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="2.6"/>',
  xc: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.2"/>',
  swap: '<path d="M5 8h13l-3.5-3.5M19 16H6l3.5 3.5" stroke-width="2.2"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  qr: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M20.5 14v.01M14 20.5h.01M17 20.5h3.5V17"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4L12 18.4"/>',
  sparkle: '<path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z" fill="currentColor" stroke="none"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 5a3.2 3.2 0 0 1 0 6.3M18 14.8c2 .7 3.3 2.4 3.6 5.2"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z"/><path d="M4 7V6a2 2 0 0 1 2-2h10v3"/><circle cx="16" cy="13.5" r="1.3" fill="currentColor"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.4-4.6" stroke-width="2.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  trash: '<path d="M5 7h14M10 4h4M7 7l1 13h8l1-13"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1" stroke-width="2.4"/>',
  scale: '<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5 11.5V20h14v-8.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6" stroke-width="2.2"/>',
};
export const ic = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
export const av = (u, s) => `<span class="av" style="--c:${esc(u.color)}${s ? `;--s:${s}px` : ""}" aria-hidden="true">${esc((u.name || "?")[0].toUpperCase())}</span>`;

// Product category tiles (iOS-style tinted squares with a glyph)
const CAT = {
  snack: ["#ff9500", '<path d="M12 3.5a8.5 8.5 0 1 0 8.4 9.8 3 3 0 0 1-3.6-3.6 3 3 0 0 1-3.2-3.2A3 3 0 0 1 12 3.5z"/><circle cx="8.5" cy="11" r=".6" fill="currentColor"/><circle cx="11" cy="15.5" r=".6" fill="currentColor"/><circle cx="15.5" cy="15" r=".6" fill="currentColor"/>'],
  beauty: ["#ff2d55", '<rect x="8" y="9" width="8" height="12" rx="2"/><path d="M10 9V6.5h4V9M11 3.5h2v3h-2z"/>'],
  medicine: ["#34c759", '<rect x="4" y="8" width="16" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="m9.7 15.3 4.6-6.6"/>'],
  drink: ["#30b0c7", '<path d="M6 7h12l-1.5 13h-9z"/><path d="M8 3.5h8M6.5 11.5h11"/>'],
  fashion: ["#5856d6", '<path d="M8 4 4 7l2 3.5 2-1V20h8V9.5l2 1L20 7l-4-3a4 4 0 0 1-8 0z"/>'],
  gadget: ["#007aff", '<path d="M4 14a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/>'],
  toy: ["#af52de", '<circle cx="12" cy="13" r="6"/><circle cx="7" cy="6.5" r="2.3"/><circle cx="17" cy="6.5" r="2.3"/><path d="M10 13h.01M14 13h.01M10.5 16c1 .8 2 .8 3 0"/>'],
  other: ["#8e8e93", '<path d="M5 8h14l-1.2 12a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>'],
};
const tile = (k) => { const [c, p] = CAT[k] || CAT.other; return `<span class="cat" style="--c:${c}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg></span>`; };
export const ART = new Proxy({}, { get: (_, k) => tile(String(k)) });

export async function api(path, opts = {}) {
  const res = await fetch(path, { method: opts.method || (opts.body ? "POST" : "GET"), headers: opts.body ? { "Content-Type": "application/json" } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(b.error || `Error ${res.status}`); e.status = res.status; throw e; }
  return b;
}

let toastT;
export function toast(msg, kind = "ok") {
  const el = document.getElementById("toast");
  el.className = `toast ${kind}`;
  el.innerHTML = `${ic(kind === "ok" ? "checkc" : kind === "err" ? "xc" : "info")}<span>${esc(msg)}</span>`;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2600);
  if (kind === "ok" && navigator.vibrate) navigator.vibrate(12);
}

// Sheet: returns {el, close}. Focus moves in, Esc closes, focus returns.
export function sheet({ title, body, left, right, cls = "", onClose }) {
  const host = document.getElementById("sheets");
  // one sheet at a time: a second open (double tap, re-render race) closes the old one first
  host.querySelectorAll(".sheet:not(.closing)").forEach((old) => old._close?.());
  const prev = document.activeElement;
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const el = document.createElement("div");
  el.className = `sheet ${cls}`;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", title || "Sheet");
  el.innerHTML = `<div class="grab"></div><div class="sh-h"><div>${left || ""}</div><h2>${esc(title || "")}</h2><div style="justify-self:end">${right ?? `<button class="nb" data-close>Done</button>`}</div></div><div class="sh-b">${body}</div>`;
  host.append(scrim, el);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    el.classList.add("closing"); scrim.classList.add("closing");
    setTimeout(() => { el.remove(); scrim.remove(); prev?.focus?.(); onClose?.(); }, 300);
    document.removeEventListener("keydown", key);
  };
  const key = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", key);
  scrim.onclick = close;
  el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  // swipe down to dismiss
  let y0 = null;
  el.querySelector(".grab").parentElement.addEventListener("touchstart", (e) => { if (e.target.closest(".sh-b")) return; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener("touchmove", (e) => { if (y0 == null) return; const dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; }, { passive: true });
  el.addEventListener("touchend", (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; el.style.transform = ""; if (dy > 110) close(); });
  setTimeout(() => el.querySelector("input,button:not([data-close])")?.focus({ preventScroll: true }), 350);
  el._close = close;
  return { el, close };
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>${label ? `<span>${esc(label)}</span>` : ""}`; }
  else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}

export function qr(seed) {
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  let cells = "";
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const f = (a, b) => x >= a && x < a + 7 && y >= b && y < b + 7;
    const fin = f(0, 0) || f(14, 0) || f(0, 14);
    let on;
    if (fin) { const lx = x % 14 % 7, ly = y % 14 % 7; on = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx > 1 && lx < 5 && ly > 1 && ly < 5); }
    else { h = (h * 1103515245 + 12345) >>> 0; on = (h >> 16) % 2 === 0; }
    cells += `<i class="${on ? "" : "o"}"></i>`;
  }
  return `<div class="qr" style="grid-template-columns:repeat(21,1fr)" role="img" aria-label="Handover code">${cells}</div>`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function fileToDataUrl(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.88));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
