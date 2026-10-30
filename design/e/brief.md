# E · Track — delivery tracker + money (Fery asked 30 Oct 2026: "reference like Uber delivery, since there is delivery status, also there is transaction, combine that")

## References and what each gives
| Reference | What we take | Source |
|---|---|---|
| Uber Eats tracker (redesign) | A **5-step tracking bar** with an **animated illustration per step**, plus "latest arrival by" time and the courier's name, because users wanted more information about the delivery flow and it reduces blame | [Restaurant Dive](https://www.restaurantdive.com/news/uber-eats-boosts-delivery-tracker-transparency-with-colorful-animations/552513/) |
| Instacart Order Status page | Status titles in plain words ("Shopping in progress", "Review replacements", "Shopping complete", "Out for delivery", "Delivered"); during shopping the items are split into **found / replacements / in progress / refunded**; an actionable status prompts the one thing to do | [Instacart docs](https://docs.instacart.com/connect/post-checkout_guide/concepts/order_status_page/) |
| Instacart substitution flow | Replacement arrives as a card with photo + approve/refuse | [teardown](https://productguys.arthakram.in/teardowns/instacart-substitutions) |
| Splitwise / Dino | Every amount says whose money it is; green = to you | design/research.md |
| C · Bag (kept) | The dial for money (orange max → blue held → green paid + striped never taken) | design/c |

## Structure (friend's view = the "order", traveller's view = the "courier")
- **Top: big status title + live illustration** (Uber): "Dina is shopping" with a little animated bag/plane scene that changes per step.
- **Tracking bar, 5 steps** (jastip's own journey): Asked → Held → Shopping → Paid → Delivered. Each step gets a time stamp.
- **Money strip under the bar** (the transaction): a horizontal bar that changes meaning per step:
  held (blue full) → paid (green part + striped "never taken") → delivered (green, check).
- **Bottom sheet card** (Uber courier card): traveller avatar, name, "2 handovers kept", Chat + Call buttons, and the item photo with the exact receipt line.
- **Instacart split** during shopping, for the traveller: Found · Swaps · Still looking · Not here, each a group with counts.
- **Action status:** when something needs you (approve hold, pick a swap, confirm handover), the status title becomes the question and one big button appears.

## Traveller view = courier mode
Uber Driver-like: one big job card at a time, one big button at the bottom (Start shopping → Scan receipt → Hand over), list grouped Instacart-style.
