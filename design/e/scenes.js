// One illustration per step, like Uber Eats' animated tracker. Plain SVG, motion stops after a few cycles.
const SCENES = {
  // asked: a phone sending a luggage tag
  asked: { sky: "linear-gradient(180deg,#fff2e5,#fff)", svg: `
    <g class="float"><rect x="78" y="30" width="94" height="150" rx="18" fill="#111"/><rect x="85" y="40" width="80" height="130" rx="12" fill="#fff"/>
    <rect x="95" y="60" width="60" height="44" rx="10" fill="#8fd47a"/><rect x="95" y="112" width="44" height="8" rx="4" fill="#ddd"/><rect x="95" y="126" width="30" height="8" rx="4" fill="#eee"/>
    <rect x="95" y="146" width="60" height="16" rx="8" fill="#111"/></g>
    <g class="flyby"><path d="M182 70 l46 -14 v40 l-46 -14z" fill="#ff7a00"/><circle cx="194" cy="76" r="5" fill="#fff"/></g>` },
  // held: a padlock on a PayPal card
  held: { sky: "linear-gradient(180deg,#e9f0ff,#fff)", svg: `
    <g class="float"><rect x="40" y="70" width="170" height="104" rx="16" fill="#276ef1"/><rect x="40" y="94" width="170" height="16" fill="#1d55c0"/>
    <text x="58" y="158" font-family="Verdana" font-style="italic" font-weight="800" font-size="20" fill="#fff">PayPal</text>
    <rect x="150" y="128" width="44" height="30" rx="6" fill="#ffc439"/></g>
    <g class="bob"><path d="M110 58 v-18 a16 16 0 0 1 32 0 v18" fill="none" stroke="#111" stroke-width="9"/><rect x="100" y="56" width="52" height="44" rx="10" fill="#111"/><circle cx="126" cy="76" r="6" fill="#ffc439"/></g>` },
  // shopping: a basket with items popping in
  shopping: { sky: "linear-gradient(180deg,#fff7df,#fff)", svg: `
    <g><rect x="30" y="20" width="190" height="10" rx="5" fill="#e6e0d2"/><rect x="30" y="72" width="190" height="10" rx="5" fill="#e6e0d2"/>
    <rect x="44" y="34" width="26" height="38" rx="5" fill="#d7262c"/><rect x="78" y="40" width="30" height="32" rx="5" fill="#ffd34d"/><rect x="118" y="30" width="22" height="42" rx="5" fill="#9cc0ff"/><rect x="150" y="38" width="34" height="34" rx="5" fill="#8fd47a"/></g>
    <g class="bob"><rect x="96" y="96" width="34" height="44" rx="6" fill="#2f9e44"/><rect x="102" y="112" width="22" height="9" rx="3" fill="#d7262c"/></g>
    <path d="M60 128 h130 l-12 52 h-106z" fill="#ff7a00"/><path d="M84 128 a41 30 0 0 1 82 0" fill="none" stroke="#ff7a00" stroke-width="8"/>
    <path d="M74 148 h102M78 164 h94" stroke="#ffb066" stroke-width="5"/>` },
  // receipt: a receipt with exact lines, coins going three ways
  paid: { sky: "linear-gradient(180deg,#e6f7ee,#fff)", svg: `
    <g class="float"><path d="M85 20 h80 v150 l-10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8 -10 -8 -10 8z" fill="#fffdf6" stroke="#ddd"/>
    <rect x="97" y="38" width="56" height="7" rx="3" fill="#bbb"/><rect x="97" y="60" width="40" height="6" rx="3" fill="#05a357"/><rect x="141" y="60" width="12" height="6" rx="3" fill="#05a357"/>
    <rect x="97" y="76" width="40" height="6" rx="3" fill="#05a357"/><rect x="141" y="76" width="12" height="6" rx="3" fill="#05a357"/><rect x="97" y="92" width="40" height="6" rx="3" fill="#ccc"/>
    <rect x="97" y="120" width="56" height="9" rx="3" fill="#111"/></g>
    <g class="pulse" style="transform-origin:200px 60px"><circle cx="200" cy="60" r="18" fill="#05a357" opacity=".35"/></g>
    <circle cx="200" cy="60" r="14" fill="#05a357"/><path d="m193 60 5 5 9-10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>` },
  // flying home / delivered: plane + bag at the door
  flying: { sky: "linear-gradient(180deg,#e4f0ff,#fff)", svg: `
    <path d="M10 150 q115 -110 230 -20" fill="none" stroke="#cfd8e8" stroke-width="3" stroke-dasharray="6 8"/>
    <g class="flyby"><path d="M120 70 l70 -6 10 6 -10 6 -70 -6z" fill="#111"/><path d="M150 64 l-18 -26 h10 l26 26zM150 76 l-18 26 h10 l26 -26z" fill="#111"/><path d="M122 70 l-12 -12 h8 l14 12z" fill="#111"/></g>
    <circle cx="30" cy="150" r="7" fill="#ff7a00"/><circle cx="226" cy="134" r="7" fill="#276ef1"/>` },
  delivered: { sky: "linear-gradient(180deg,#e6f7ee,#fff)", svg: `
    <rect x="40" y="30" width="80" height="150" rx="6" fill="#e9e4da"/><rect x="50" y="40" width="60" height="140" rx="4" fill="#c9bfae"/><circle cx="100" cy="112" r="4" fill="#8a7f6e"/>
    <g class="bob"><path d="M140 110 h70 l-8 70 h-54z" fill="#ff7a00"/><path d="M156 110 a19 22 0 0 1 38 0" fill="none" stroke="#ff7a00" stroke-width="7"/></g>
    <circle cx="200" cy="80" r="18" fill="#05a357"/><path d="m192 80 6 6 10-11" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>` },
};
