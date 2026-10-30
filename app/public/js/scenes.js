// One illustration per tracker stage (Uber Eats style). Motion runs a few cycles, then stops.
export const SCENES = {
  open: { sky: "linear-gradient(180deg,#fff2e5,#fff)", svg: `
    <path d="M20 160 q105 -110 210 -30" fill="none" stroke="#f0d9c2" stroke-width="3" stroke-dasharray="6 8"/>
    <g class="flyby"><path d="M110 82 l70 -6 10 6 -10 6 -70 -6z" fill="#111"/><path d="M140 76 l-18 -26 h10 l26 26zM140 88 l-18 26 h10 l26 -26z" fill="#111"/><path d="M112 82 l-12 -12 h8 l14 12z" fill="#111"/></g>
    <g class="float"><path d="M36 120 l40 -12 v34 l-40 -12z" fill="#ff7a00"/><circle cx="46" cy="126" r="4" fill="#fff"/></g>
    <g class="float" style="animation-delay:.4s"><path d="M196 140 l34 -10 v28 l-34 -10z" fill="#276ef1"/><circle cx="205" cy="145" r="3.5" fill="#fff"/></g>` },
  asked: { sky: "linear-gradient(180deg,#fff2e5,#fff)", svg: `
    <g class="float"><rect x="78" y="22" width="94" height="150" rx="18" fill="#111"/><rect x="85" y="32" width="80" height="130" rx="12" fill="#fff"/>
    <rect x="95" y="52" width="60" height="44" rx="10" fill="#8fd47a"/><rect x="95" y="104" width="44" height="8" rx="4" fill="#ddd"/><rect x="95" y="118" width="30" height="8" rx="4" fill="#eee"/><rect x="95" y="138" width="60" height="16" rx="8" fill="#111"/></g>
    <g class="flyby"><path d="M182 62 l46 -14 v40 l-46 -14z" fill="#ff7a00"/><circle cx="194" cy="68" r="5" fill="#fff"/></g>` },
  held: { sky: "linear-gradient(180deg,#e9f0ff,#fff)", svg: `
    <g class="float"><rect x="40" y="66" width="170" height="104" rx="16" fill="#276ef1"/><rect x="40" y="90" width="170" height="16" fill="#1d55c0"/>
    <text x="58" y="154" font-family="Verdana" font-style="italic" font-weight="800" font-size="20" fill="#fff">PayPal</text><rect x="150" y="124" width="44" height="30" rx="6" fill="#ffc439"/></g>
    <g class="bob"><path d="M110 54 v-18 a16 16 0 0 1 32 0 v18" fill="none" stroke="#111" stroke-width="9"/><rect x="100" y="52" width="52" height="44" rx="10" fill="#111"/><circle cx="126" cy="72" r="6" fill="#ffc439"/></g>` },
  shopping: { sky: "linear-gradient(180deg,#fff7df,#fff)", svg: `
    <rect x="30" y="16" width="190" height="10" rx="5" fill="#e6e0d2"/><rect x="30" y="68" width="190" height="10" rx="5" fill="#e6e0d2"/>
    <rect x="44" y="30" width="26" height="38" rx="5" fill="#d7262c"/><rect x="78" y="36" width="30" height="32" rx="5" fill="#ffd34d"/><rect x="118" y="26" width="22" height="42" rx="5" fill="#9cc0ff"/><rect x="150" y="34" width="34" height="34" rx="5" fill="#8fd47a"/>
    <g class="bob"><rect x="96" y="92" width="34" height="44" rx="6" fill="#2f9e44"/><rect x="102" y="108" width="22" height="9" rx="3" fill="#d7262c"/></g>
    <path d="M60 124 h130 l-12 52 h-106z" fill="#ff7a00"/><path d="M84 124 a41 30 0 0 1 82 0" fill="none" stroke="#ff7a00" stroke-width="8"/><path d="M74 144 h102M78 160 h94" stroke="#ffb066" stroke-width="5"/>` },
  paid: { sky: "linear-gradient(180deg,#e6f7ee,#fff)", svg: `
    <g class="float"><path d="M85 16 h80 v150 l-10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8z" fill="#fffdf6" stroke="#ddd"/>
    <rect x="97" y="34" width="56" height="7" rx="3" fill="#bbb"/><rect x="97" y="56" width="40" height="6" rx="3" fill="#05a357"/><rect x="141" y="56" width="12" height="6" rx="3" fill="#05a357"/>
    <rect x="97" y="72" width="40" height="6" rx="3" fill="#05a357"/><rect x="141" y="72" width="12" height="6" rx="3" fill="#05a357"/><rect x="97" y="88" width="40" height="6" rx="3" fill="#ccc"/><rect x="97" y="116" width="56" height="9" rx="3" fill="#111"/></g>
    <circle cx="200" cy="56" r="22" fill="#05a357" opacity=".18"/><circle cx="200" cy="56" r="14" fill="#05a357"/><path d="m193 56 5 5 9-10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>` },
  released: { sky: "linear-gradient(180deg,#f2f2f2,#fff)", svg: `
    <g class="float"><rect x="40" y="66" width="170" height="104" rx="16" fill="#c7c7cc"/><rect x="40" y="90" width="170" height="16" fill="#b0b0b5"/>
    <text x="58" y="154" font-family="Verdana" font-style="italic" font-weight="800" font-size="20" fill="#fff">PayPal</text></g>
    <g class="bob"><path d="M110 54 v-24 a16 16 0 0 1 32 0" fill="none" stroke="#6b6b6b" stroke-width="9"/><rect x="100" y="52" width="52" height="44" rx="10" fill="#6b6b6b"/></g>` },
  flying: { sky: "linear-gradient(180deg,#e4f0ff,#fff)", svg: `
    <path d="M10 150 q115 -110 230 -20" fill="none" stroke="#cfd8e8" stroke-width="3" stroke-dasharray="6 8"/>
    <g class="flyby"><path d="M120 70 l70 -6 10 6 -10 6 -70 -6z" fill="#111"/><path d="M150 64 l-18 -26 h10 l26 26zM150 76 l-18 26 h10 l26 -26z" fill="#111"/><path d="M122 70 l-12 -12 h8 l14 12z" fill="#111"/></g>
    <circle cx="30" cy="150" r="7" fill="#ff7a00"/><circle cx="226" cy="134" r="7" fill="#276ef1"/>` },
  delivered: { sky: "linear-gradient(180deg,#e6f7ee,#fff)", svg: `
    <rect x="40" y="26" width="80" height="150" rx="6" fill="#e9e4da"/><rect x="50" y="36" width="60" height="140" rx="4" fill="#c9bfae"/><circle cx="100" cy="108" r="4" fill="#8a7f6e"/>
    <g class="bob"><path d="M140 106 h70 l-8 70 h-54z" fill="#ff7a00"/><path d="M156 106 a19 22 0 0 1 38 0" fill="none" stroke="#ff7a00" stroke-width="7"/></g>
    <circle cx="200" cy="76" r="18" fill="#05a357"/><path d="m192 76 6 6 10-11" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>` },
};
export const sceneHTML = (k) => `<div class="illo"><svg viewBox="0 0 250 190" aria-hidden="true">${(SCENES[k] || SCENES.open).svg}</svg></div>`;
export const skyOf = (k) => (SCENES[k] || SCENES.open).sky;
