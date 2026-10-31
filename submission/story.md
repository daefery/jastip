## Inspiration
In Indonesia, when a friend flies to Tokyo, the group chat fills up: "bring me the matcha KitKat", "the big Hada Labo, please". This is *jastip* (from *jasa titip*, "carry-for-me service"), and it is how millions of people get things from abroad, between friends and as small side businesses.

The money is the hard part. Either friends pay upfront for things that might be sold out or cheaper on the shelf, and then wait for refunds. Or the traveller pays for everything and chases friends for weeks. Every jastip app we found takes full payment upfront.

PayPal already has the right tool: an authorization (a hold) that can later be captured for **less** than it was authorized for, or voided. Jastip is built around that.

## What it does
1. **The traveller opens a trip** (Tokyo, dates, a fee per item) and shares one link.
2. **A friend asks for an item.** They paste a TikTok or shop link, or just type "matcha kitkat". AI turns it into the product, the variant and a typical Tokyo shelf price, so they can set a **max price**. They also choose what happens if it's sold out: ask me, similar is fine, or skip.
3. **The traveller accepts**, picks a shopping day, and each friend **approves a PayPal hold** for their max plus the fee. Nothing is charged.
4. **In the shop**, the traveller ticks items off. If something is sold out, they offer a swap and the friend accepts or skips it from their phone. A swap can never go over the friend's max.
5. **At the till, the traveller photographs one receipt.** AI reads every line (Japanese, Indonesian or English, with discounts and coupons) and matches lines to friends. **Code, not AI, works out the money:** each charge is that receipt line plus the fee, never above the hold.
6. **One tap.** PayPal captures each friend's exact amount from their hold and voids the holds for items that weren't found. Each friend sees "Paid ¥1,288. Exactly." and how much of their hold was never taken.
7. **Handover.** The friend taps "I got my item", which is the delivery record for both of them.

It works on phone, tablet and desktop, and each friend follows their order like a food delivery tracker: Asked, Held, Shopping, Paid, Delivered.

## How we built it
- **PayPal Orders v2** creates each hold (`intent: AUTHORIZE`, the traveller as payee) and authorizes it after the friend approves on PayPal's page.
- **PayPal Payments v2** captures the exact amount from each authorization (`final_capture`, an idempotency key per hold) or voids it.
- **Cloudflare Workers AI (Gemma 4 26B, vision)** reads the receipt photo and turns pasted links or slang into a product and a typical price.
- **Cloudflare Workers + D1** run the app and store trips, asks and every PayPal and AI event. The same code runs locally on Node with SQLite.
- Plain JavaScript with no framework and no runtime dependencies. The interface is our own design, tested at seven screen sizes.

We started with two risk tests before writing the app. In the PayPal sandbox we authorized ¥1,500 and captured exactly ¥1,188, voided another hold, and found that reauthorizing is only allowed once, from day 4 to day 29. So holds are opened for the shopping day and charged at the receipt, inside PayPal's 3-day honor period. We then compared eight vision models on test receipts before choosing one.

## Safety rules, enforced in code
- No hold, no shopping: only asks with an approved hold go on the list.
- A charge is never above the hold, and never above the receipt line plus the fee.
- No matching receipt line means no charge; the hold is voided.
- One capture per hold. If PayPal fails halfway, each friend's charge or release is saved first, and Retry repeats only the steps that didn't go through, with the same amounts.
- A swap needs the friend's tap and can't go over their max.
- A new friend can hold at most $50 until their first handover, unless the traveller confirms they know them.

## Challenges we ran into
- **Real receipt photos.** Coupon lines, quantity notes ("3点 X ¥485"), totals, cash and change all look like prices. The model reads the lines; code folds each coupon into the item above it and drops totals, tax, cash and change, so they can never become a charge. On a real drugstore receipt with seven items and six coupons, every coupon landed on the right item and the lines added up to the printed total.
- **Payment failures in the middle.** An independent reviewer went through seven rounds of trying to break the payment flow: a PayPal approval that arrives after shopping started, a retry after a partial failure, a receipt plan built before the list changed. Each case is now handled and covered by a test.
- **Staying on free tiers.** Identical AI requests are cached, each person has an hourly limit, and if the daily AI allowance runs out the app keeps working: item lookup falls back to plain text, and holds are never affected.

## Accomplishments that we're proud of
- It runs end to end on the real PayPal sandbox: an Indonesian buyer account approving holds in yen, partial captures to the exact receipt amount, and voids. 29 of 29 end-to-end checks pass, both locally and on the live site.
- The AI never decides an amount. Every number a friend pays comes from a receipt line, the friend's own max and the traveller's fee.

## What we learned
PayPal authorizations fit shared shopping well: the friend sees a real hold, nothing is charged, and the final amount can be lower. The timing rules (the 3-day honor period, one reauthorization) decide the whole flow, so we measured them first.

## What's next for Jastip
- Payouts and multi-party flows for travellers who run jastip as a small business.
- Using PayPal's dispute tools with the handover record and receipt as evidence.
- Testing with real jastip groups in Indonesia, starting with Tokyo and Singapore trips.

## AI tools we used
- **Gemma 4 26B** (`@cf/google/gemma-4-26b-a4b-it` on Cloudflare Workers AI), in the product: reads receipt photos and turns pasted links or slang into a product and a typical price.
- **Gemini 3.8 Flash**, in the product when it runs locally (any OpenAI-compatible vision endpoint works).
- **Model comparison during testing** (receipt reading only, not in the product): Gemini 3 Flash, Claude Sonnet 4.6, and on Workers AI Llama 4 Scout, Mistral Small 3.1, Qwen 3.8 and Kimi K2.6.
- **OpenAI image generation** (through the Codex CLI): every illustration, avatar, the app icon and the hero image. All images are AI-generated.
- **Kokoro TTS** (open model, Apache 2.0), run locally: the narration in the demo video.
- **AI coding agents** (Claude through the pi coding agent, and GPT through pi for independent review rounds): used to write and review code, tests and documentation. The idea, the PayPal flow, the safety rules and every design decision were made and checked by the author.

## Try it
Live demo: https://jastip.feryyp-work.workers.dev (PayPal sandbox, nothing real is charged). Code: https://github.com/daefery/jastip
