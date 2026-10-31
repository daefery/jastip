// One illustration per tracker stage (Uber Eats style). Soft 3D clay set, generated for Jastip
// (public/img/scenes/*.webp, 900x600). Each scene's background is the image's own edge colour,
// sampled from the file, so the art sits in the panel with no visible edge.
export const SCENES = {
  open: { bg: "#fdf0e3", alt: "Open suitcase with gifts and a paper plane" },
  asked: { bg: "#fef1e4", alt: "Phone with a chat bubble and a shopping tag" },
  held: { bg: "#e7effd", alt: "Payment card with a closed padlock" },
  shopping: { bg: "#fdf8e5", alt: "Shopping basket full of snacks and skincare" },
  paid: { bg: "#e5f7ee", alt: "Receipt with a green check mark" },
  released: { bg: "#f2f1f4", alt: "Grey payment card with an open padlock" },
  flying: { bg: "#e4effd", alt: "Airplane above the clouds" },
  delivered: { bg: "#e5f5ed", alt: "Gift box handed over with both hands" },
};
const pick = (k) => (SCENES[k] ? k : "open");
export const sceneSrc = (k) => `/img/scenes/${pick(k)}.webp`;
// Decorative: the status headline next to it says the same thing in words.
export const sceneHTML = (k) => `<div class="illo"><img src="${sceneSrc(k)}" alt="" width="900" height="600" decoding="async"></div>`;
export const skyOf = (k) => SCENES[pick(k)].bg;
export const artHTML = (k, cls = "art") => `<img class="${cls}" src="${sceneSrc(k)}" alt="" width="900" height="600" decoding="async">`;
