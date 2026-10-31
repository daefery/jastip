// Shared by server and browser. Amounts are integers in minor units (yen, cents).
export const CUR = {
  JPY: { d: 0, s: "¥" },
  TWD: { d: 0, s: "NT$" },
  SGD: { d: 2, s: "S$" },
  THB: { d: 2, s: "฿" },
  HKD: { d: 2, s: "HK$" },
  AUD: { d: 2, s: "A$" },
  EUR: { d: 2, s: "€" },
  GBP: { d: 2, s: "£" },
  USD: { d: 2, s: "$" },
};

// Approximate USD rates, set 30 Oct 2026, only used for the customs meter and the new-friend limit.
export const USD_RATE = { JPY: 0.0066, TWD: 0.031, SGD: 0.77, THB: 0.029, HKD: 0.128, AUD: 0.65, EUR: 1.08, GBP: 1.27, USD: 1 };

// Cities whose currency PayPal supports (IDR and KRW are not on PayPal's currency list).
export const PLACES = [
  { city: "Tokyo", code: "HND", cur: "JPY", shop: "Don Quijote" },
  { city: "Osaka", code: "KIX", cur: "JPY", shop: "Don Quijote" },
  { city: "Singapore", code: "SIN", cur: "SGD", shop: "Mustafa" },
  { city: "Bangkok", code: "BKK", cur: "THB", shop: "Big C" },
  { city: "Hong Kong", code: "HKG", cur: "HKD", shop: "Watsons" },
  { city: "Taipei", code: "TPE", cur: "TWD", shop: "Cosmed" },
  { city: "Sydney", code: "SYD", cur: "AUD", shop: "Chemist Warehouse" },
  { city: "Paris", code: "CDG", cur: "EUR", shop: "Monoprix" },
  { city: "London", code: "LHR", cur: "GBP", shop: "Boots" },
  { city: "New York", code: "JFK", cur: "USD", shop: "Target" },
];
export const HOMES = [
  { city: "Jakarta", code: "CGK" },
  { city: "Surabaya", code: "SUB" },
  { city: "Bali", code: "DPS" },
  { city: "Medan", code: "KNO" },
];

// Request statuses where PayPal may still hold the friend's money (an authorization not yet captured or voided).
export const OUTSTANDING = ["held", "found", "swap_asked", "swapped", "not_found", "releasing"];
export const CUSTOMS_USD = 500; // Indonesia: personal goods free of import duty up to USD 500 per arrival (beacukai.go.id)
export const NEW_FRIEND_USD = 50; // Proposed: total holds allowed before a friend's first completed handover

const dec = (cur) => (CUR[cur] || CUR.USD).d;
export const toMinor = (major, cur) => Math.round(Number(major) * 10 ** dec(cur));
export const toMajor = (minor, cur) => minor / 10 ** dec(cur);
export const toValue = (minor, cur) => (dec(cur) === 0 ? String(Math.round(minor)) : (minor / 100).toFixed(2));
export const step = (cur) => (dec(cur) === 0 ? 100 : 100); // ¥100 or 1.00
export function fmt(minor, cur = "JPY") {
  if (minor == null || Number.isNaN(minor)) return "—";
  const c = CUR[cur] || CUR.USD;
  const v = toMajor(Math.abs(minor), cur);
  const s = v.toLocaleString("en-US", { minimumFractionDigits: c.d, maximumFractionDigits: c.d });
  return (minor < 0 ? "−" : "") + c.s + s;
}
export const usd = (minor, cur) => toMajor(minor, cur) * (USD_RATE[cur] ?? 1);

// 3D character avatars (public/img/avatars/a01..a16.webp). A user gets a random one at sign-up;
// older users without one get a stable pick from their id. Background = the image's own colour.
export const AVATARS = ["#fdd4bf", "#cde0fc", "#fdeebe", "#d7f1e3", "#f0d8f5", "#fdd8c8", "#d6e6fd", "#def3d0", "#fdf0c7", "#e1dbfc", "#fcd4d8", "#d2f0ef", "#fde0c4", "#d7e3f6", "#e4f2dc", "#fadac7"];
export const avatarOf = (u) => {
  let n = Number.isInteger(u?.avatar) && u.avatar >= 1 && u.avatar <= AVATARS.length ? u.avatar : 0;
  if (!n) { let h = 0; for (const ch of String(u?.id || u?.name || "?")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (h % AVATARS.length) + 1; }
  return { n, src: `/img/avatars/a${String(n).padStart(2, "0")}.webp`, bg: AVATARS[n - 1] };
};
