# Jastip

Shop abroad for friends without anyone fronting money. Each friend approves a PayPal **hold** up to
their max price. The traveller photographs **one receipt**; AI reads it and code charges every friend
their **exact line plus fee**. Items not found are **released**. Charges go straight to the
traveller's PayPal account, so the app never holds anyone's money.

## Run

Node 22.5 or newer. No dependencies.

```sh
cp ../.env.example ../.env     # PayPal sandbox app keys + an OpenAI-compatible AI endpoint
npm start                      # http://localhost:5180
```

`.env` keys: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (sandbox), `AI_BASE_URL`, `AI_API_KEY`,
`AI_MODEL` (a vision model; `gemini-3.8-flash-high` scored 20/20 on our synthetic receipt set),
optional `PUBLIC_URL` when hosted.

## Try it on one device

1. Open the app, enter a name (the traveller), tap **New trip**, pick Tokyo.
2. Tap **Share** and open the link in a private window (a friend). Paste a product link, **Find**,
   set a max price, **Ask**.
3. Back as the traveller: **Accept**, **Pick shopping day**.
4. As the friend: **Hold PayPal**. Log in with a sandbox *personal* account and approve.
5. Traveller: **Start shopping**, tick items, use ••• to suggest a swap or mark not found.
6. **Scan receipt** → **Use sample receipt** → check the charges → **Charge**.
7. Friend: see the exact charge and the part of the hold never taken; tap **I got it**.

Me → **Switch person** lets one browser act as each person for a demo.

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
| S6 | A new friend can hold at most $50 in total until a first handover |
| S7 | One capture per hold (idempotency key + status check) |
| S8 | Swaps need the friend's tap, and a swap above the max is refused |

Also shown: Indonesia's USD 500 duty-free limit per arrival, and how many handovers each person has kept.

**Not covered yet:** a friend filing a false "not received" dispute after the handover (the handover
confirmation and receipt are kept as evidence, but the Disputes API is not wired up), account takeover,
and hosted multi-user sign-in (names only, cookie session).

## Tests

```sh
scripts/serve.sh 5180           # real PayPal sandbox
SANDBOX_BUYER_EMAIL=... SANDBOX_BUYER_PASSWORD=... npm test

scripts/serve.sh 5181 fake      # PayPal test mode (no network), for UI screenshots
node test/shots-late.mjs 390x844
```

## License

MIT
