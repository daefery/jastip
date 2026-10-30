# A+B: Wallet + Chat · design brief (Fery confirmed 30 Oct 2026: "combine A & B")

Why both: the money runs on PayPal (Wallet), and jastip is social, it lives in group chats (Chat).

## The structure
- **Two tabs, one trip:** `Chat` (the trip's group conversation) and `Wallet` (your money for this trip).
  A top-level home lists trips like iMessage conversations; each row shows the last message and your money pill.
- **Money cards live in the chat.** Every money event is a card in the conversation, styled like a Wallet pass:
  request card, hold card (PayPal), swap card, receipt card, paid card. Tapping a card opens it in Wallet.
- **Wallet = passes.** Each request is a pass, dark glass, colour from the product, stacked like Apple Wallet.
  Front: item, friend, state, big amount. Back (tap): receipt line, PayPal IDs, timeline.
- Only two money colours: **blue = held**, **green = charged / to you**. Released = grey with a "never taken" amount.

## From the research (design/research.md)
- One action per screen (Dino); every number says whose money it is.
- Swaps as one-tap cards with a photo (Instacart), rule set when asking: "Sold out? Ask me / Any similar / Skip".
- Receipt card: avatars → arrow → traveller, green total (Splitwise mapping); each friend next to their receipt line.
- One hand in the shop: big targets in the traveller's shop list (Instacart Shopper).

## Look
Dark UI like Wallet, iMessage bubbles (blue = me, grey = others), passes with gradient by category.
Light mode available later; dark first because Wallet is the signature.

## Screens (every state the real app has)
1. Trips (home): conversations list.
2. Trip chat: Traveller view (open, requests, set day, shopping, receipt) and Friend view (ask, hold, swap, paid, got it).
3. Composer: "+" opens actions (Ask an item / Share trip / Scan receipt) instead of free text first.
4. Wallet: stacked passes; tap one to expand; flip for details.
5. PayPal hold sheet; receipt scan sheet with the plan.
