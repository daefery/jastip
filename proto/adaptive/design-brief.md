# Design brief: PayPal Jastip flow prototype

What users most need: to see, at a glance, that nobody fronts money and each friend pays exactly
what the receipt says, only when the item arrives.

## Direction
- **Scene:** a trip's paper goods. Requests are **luggage tags** (string hole, notched edge);
  the till receipt is a **thermal strip** with a torn edge; the PayPal layer is a **navy money rail**
  under both phones. One motif family: travel paper (tags, receipt, boarding pass).
- **Mechanism:** one receipt scan turns every hold into an exact share in place: receipt lines print,
  each line gets the friend's avatar, the friend's bar on the money rail shrinks from "hold" to
  "exact", the rest is shown as "never taken".
- **Shapes with meaning:** tag = a friend's request; padlock clip on a tag = PayPal hold;
  receipt strip = the one source of truth for prices; hatched bar = money released, never taken.
- **Icons:** inline SVG, stroke 1.9, round caps. No emoji.
- **Header dock:** mark, 5-stage rail (Request, Hold, Shop, Receipt, Handover), role switch
  and money button on narrow screens. **Guide line:** one short "next" hint; a pulsing ring on the
  control to press (3 cycles, then still).
- **Footer:** what happened in this run (holds, swaps, exact charges, upfront paid ¥0) + replay.
- **Filled example:** all data is a stamped simulation; amounts reuse the sandbox spike (¥1,500 cap,
  ¥1,188 item) and the synthetic Don Quijote receipt.

## Per device class
| Screen | Phone (<700) | Tablet (700-1079) | Laptop/desktop (>=1080) |
|---|---|---|---|
| Frame | the app is the screen; money rail in a bottom sheet | active phone + money rail side by side | Dina's phone, money rail, friend's phone |
| Primary action | in the app, guide bar pinned at the thumb with "Go to Ayu" when the next step is on the other side | same, guide under the rail | ring on the control in whichever phone |
| Shown together | one role | one role + money | both roles + money (cause and effect) |

Pattern: supporting pane (main = phones, support = money rail), wizard progress rail.

## Tokens
Navy ink #0c1b3a, paper #f4efe6, hold blue #0a5bd3, captured green #0d7a4f, swap amber #a85600,
PayPal button yellow #ffc439, kraft tag #efe3cb. Radius by hierarchy: phone 36, sheet 22, card 16,
tag 10, chip 999. Type: Ubuntu Sans (local), receipt in IPAGothic for Japanese lines.
Signature move: the money bars (hold -> exact -> never taken).
