# Jastip

Shop abroad for friends without anyone fronting money. Each friend approves a PayPal **hold** up to
their max price. The traveller photographs **one receipt**; AI reads it and code charges every friend
their **exact line plus fee**. Items not found are **released**. Charges go straight to the
traveller's PayPal account, so the app never holds anyone's money.

## Live

**https://jastip.feryyp-work.workers.dev** (Cloudflare Workers + D1 + Workers AI, PayPal sandbox).
Test buyer: any PayPal sandbox *personal* account.

## Run locally

Node 22.5 or newer. No dependencies.

```sh
cp ../.env.example ../.env     # PayPal sandbox app keys + an OpenAI-compatible AI endpoint
npm start                      # http://localhost:5180
```

`.env` keys: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (sandbox), `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.

## Deploy to Cloudflare

```sh
npx wrangler d1 create jastip                  # put the id in wrangler.jsonc
npx wrangler d1 migrations apply jastip --remote
npx wrangler secret put PAYPAL_CLIENT_ID
npx wrangler secret put PAYPAL_CLIENT_SECRET
npx wrangler deploy
```

Same code runs in both places: `lib/api.mjs` is a fetch handler; `worker.mjs` gives it D1 and the
Workers AI binding, `server.mjs` gives it `node:sqlite` and an OpenAI-compatible endpoint.

## Try it on one device

1. Open the app, enter a name (the traveller), tap **New trip**, pick Tokyo.
2. Tap **Share** and open the link in a private window (a friend). Paste a product link, **Find**,
   set a max price, **Ask**.
3. Back as the traveller: **Accept**, **Pick shopping day**.
4. As the friend: **Hold PayPal**. Log in with a sandbox *personal* account and approve.
5. Traveller: **Start shopping**, tick items, use ••• to suggest a swap or mark not found.
6. **Scan receipt** → **Use sample receipt** → check the charges → **Charge**.
7. Friend: see the exact charge and the part of the hold never taken; tap **I got it**.

For a demo on one device, start the server with `DEMO_SWITCH=1` (`scripts/serve.sh` does this):
Me → **Switch person** then lets one browser act as anyone who shares a trip with you. Without
the flag the switch endpoint returns 404.

## PayPal

| Step | API |
|---|---|
| Friend approves a hold | Orders v2 `POST /v2/checkout/orders` intent `AUTHORIZE`, `payee` = traveller, then `/authorize` |
| Exact charge from the receipt | Payments v2 `POST /v2/payments/authorizations/{id}/capture`, amount = line + fee, `final_capture: true` |
| Not found or swap skipped | `POST /v2/payments/authorizations/{id}/void` |

Sandbox test (30 Oct 2026): a ¥1,500 hold captured at exactly ¥1,188; a ¥1,800 hold voided.
A reauthorize on day 1 returned `REAUTHORIZATION_TOO_SOON` ("only allowed once from Day 4 to Day 29"),
so the app asks for holds on the shopping day and charges at the receipt, inside the 3-day honour period.

## AI

Deployed: Cloudflare Workers AI, `@cf/google/gemma-4-26b-a4b-it`, thinking off, JSON output.
On our 5 synthetic receipts (20 requests) it scored 19/20 three times with thinking off
(the miss: a silicone strainer taken for a "silicone container"), about 10 s per receipt.
On the live site one full receipt read took 11.6 s. Locally we used Gemini 3.8 Flash (20/20, 8-22 s).

- **Request:** turns a pasted link or slang into an item name, variant and a rough shelf price.
- **Receipt:** reads every line (Japanese, Indonesian, English), keeps discount lines separate,
  and picks which line answers which request. Code then folds discounts into the item above,
  caps each charge at the friend's max, and computes the shares. The model never sets an amount.

## Safety rules (enforced in `lib/trips.mjs`, tested in `test/e2e.mjs`)

| | Rule |
|---|---|
| S1 | No hold, no shopping: only requests with an approved hold reach the shopping list |
| S2 | A charge is never above the hold, and never above the receipt line + fee |
| S3 | A charge needs a receipt line matched to that request; the rest is voided |
| S4 | A friend can withdraw only before the hold is approved |
| S5 | The traveller accepts each request before anyone is asked to hold money |
| S6 | A new friend can hold at most $50 in total until a first handover, unless the traveller taps "I know them" when accepting that ask |
| S7 | One capture per hold (idempotency key + status check) |
| S8 | Swaps need the friend's tap, and a swap above the max is refused |

Also shown: Indonesia's USD 500 duty-free limit per arrival, and how many handovers each person has kept.

Also handled: if nothing was found, **Finish trip** voids every hold with no receipt. If PayPal
fails on a capture or void, the trip stays in a "payment problem" state, the hold stays in place,
and **Retry failed payments** retries only those items. Only the traveller and friends with an
ask can open a trip; the full receipt is shown to the traveller only.

**Not covered yet:** a friend filing a false "not received" dispute after the handover (the handover
confirmation and receipt are kept as evidence, but the Disputes API is not wired up), account takeover,
and real sign-in (names only; the cookie is a random session token, so it can't be guessed from a user id).

## Tests

Last full runs, 30 Oct 2026, real PayPal sandbox + real AI (`npm test`): **29/29 passed** locally,
and **29/29 passed** on the live Cloudflare deployment (`BASE=https://jastip.feryyp-work.workers.dev npm test`).
Checked afterwards directly against PayPal's API (not our database):

| Request | Hold | PayPal authorization | Capture |
|---|---|---|---|
| Matcha KitKat | ¥1,600 | CAPTURED | COMPLETED ¥1,288 (PayPal fee ¥84) |
| Tokyo Banana 4 pack (swap) | ¥1,900 | CAPTURED | COMPLETED ¥748 (fee ¥65) |
| Hada Labo lotion | ¥1,300 | CAPTURED | COMPLETED ¥1,068 (fee ¥76) |
| Roihi patches (not found) | ¥1,400 | VOIDED | none |


```sh
scripts/serve.sh 5180           # real PayPal sandbox
SANDBOX_BUYER_EMAIL=... SANDBOX_BUYER_PASSWORD=... npm test

scripts/serve.sh 5181 fake      # PayPal test mode (no PayPal calls), real AI
node --no-warnings test/rules.mjs     # sold-out rules
node test/ui-flow.mjs 390x844         # full 4-person flow in a browser, screenshots in shots/flow-390/
node test/ui-edges.mjs                # edge journeys in a browser (nothing found, late asks, privacy, keyboard)
node --no-warnings test/edges.mjs     # no server: PayPal failure + retry, privacy, validation
```

## License

MIT
