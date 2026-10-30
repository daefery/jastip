# PayPal Jastip

Working name. A traveller buys things abroad for friends. Each friend approves a PayPal hold up
to their price cap, the traveller photographs one shop receipt, and each friend is charged their
exact share when they receive the item. Items not found are released straight away.

Status: risk spikes (30 Oct 2026). No app yet.

## Spike 1: PayPal holds (`spikes/paypal-holds.mjs`)

Checks on the PayPal sandbox, in JPY: authorize up to a cap, capture an exact smaller amount,
void a hold, and what reauthorize does inside the 3-day honor period.

```sh
cp .env.example .env        # add sandbox PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET
node spikes/paypal-holds.mjs              # JPY
node spikes/paypal-holds.mjs --currency USD
```

The script prints three approval links. Open each one logged in as the sandbox Personal (buyer)
account, approve, then press Enter. Result: not run yet (no sandbox credentials on this machine).

Facts from PayPal docs, checked 30 Oct 2026 ([auth and honor period](https://developer.paypal.com/payment-methods/auth-honor),
[reauthorize](https://developer.paypal.com/api/payments/v2/authorizations-reauthorize),
[currency codes](https://developer.paypal.com/api/rest/reference/currency-codes/)):
- A hold lasts 29 days; capture is most reliable in the first 3 days (honor period).
- Reauthorize is allowed from day 4 to day 29 and restarts the 3-day honor period.
- Capture can be less than the hold. Partial capture on PayPal-account holds must be enabled on the account.
- JPY has no decimals; sending a decimal amount is an error.

## Spike 2: receipt matching (`spikes/receipt-match.mjs`)

The model only transcribes the receipt lines and picks which line answers which request.
Code folds discount lines into the item above them, splits separately printed tax by amount,
and computes each share.

Test set so far: 5 SYNTHETIC receipts made by `receipts/make-synthetic.mjs` (Japanese and
Indonesian, tax included and excluded, line discounts, decoy items), 20 requests in total.
They are typed, not photographed, so they prove nothing about real camera photos.

| Model | Run 1 | Run 2 | Run 3 | Time per receipt |
|---|---|---|---|---|
| gemini-3.8-flash-high | 20/20 | 20/20 | 20/20 | 8 to 22 s |
| gemini-3-flash | 19/20 | 19/20 | 19/20 | 2 to 4 s |
| claude-sonnet-4-6 | 19/20 | 19/20 | 19/20 | 6 to 14 s |

The miss in both 19/20 rows is the same decoy: "silicone food container" was matched to a
silicone strainer. Confidence did not flag it (0.8 and 0.35), so the friend must still confirm
the item at handover before any capture.

Next: replace the synthetic set with at least 10 real receipt photos in `receipts/cases/`
(same JSON shape, `"synthetic": false`).
