# Context: Jastip · E Track, adaptive

[Confirmed: Fery, 30 Oct 2026] "make it into adaptive design that fit desktop, tablet and mobile" for direction E (Uber-style tracker + PayPal money).

## Personas, jobs, moment
| Persona | Job | Device and moment |
|---|---|---|
| Friend (Ayu, Bima, Citra) | approve the hold, pick a swap, see the exact charge, confirm handover | phone, at home or commuting [Inferred: jastip runs in WhatsApp/Instagram] |
| Traveller (Dina) | run the shopping list, scan one receipt, hand over | phone in a shop, one hand on a basket [Source: Instacart Shopper research, design/research.md] |
| Traveller planning at home | review all asks, check money, see the trip at a glance | laptop or tablet, evenings before the trip [Inferred] |
| Judge (PayPal) | understand the whole flow and the money in < 3 min | laptop, video or hosted demo [Source: rules] |

## Task-device fit
| Job | compact (<600) | medium (600-1023) | expanded+ (≥1024) |
|---|---|---|---|
| Friend tracks one order | primary: scene + sheet | primary: scene left, panel right | primary: scene + panel, plus the order list in a side rail |
| Friend acts (hold, swap, got it) | primary: pinned button in thumb zone | primary: button in panel | primary: button in panel |
| Traveller shops | primary: grouped list, pinned scan button | primary: list + money summary side by side | primary: list | money + timeline | other orders |
| See money + timeline | in the sheet, scroll | right pane | always visible right column |

## Patterns
- compact: Uber tracker (scene on top, sheet over it), one pinned primary action.
- medium: supporting pane: scene + status on the left, money/details on the right.
- expanded+: three columns: orders rail (friends' orders or "your order") · tracker · money & timeline. Capped at 1280 px.

## Language
English UI, product names and receipt lines in Japanese. Short lines.

## Not tested
Real iOS Safari safe areas, real touch devices, screen readers.
