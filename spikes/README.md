# Risk spikes (30 Oct 2026)

Run before the app was built, to check the two riskiest assumptions: PayPal partial capture in
foreign currency, and AI reading a receipt well enough to match lines to asks.

## Spike 1: PayPal holds (`spikes/paypal-holds.mjs`)

Checks on the PayPal sandbox, in JPY: authorize up to a cap, capture an exact smaller amount,
void a hold, and what reauthorize does inside the 3-day honor period.

```sh
cp .env.example .env        # add sandbox PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET
node spikes/paypal-holds.mjs              # JPY
node spikes/paypal-holds.mjs --currency USD
```

The script prints three approval links. Open each one logged in as the sandbox Personal (buyer)
account, approve, then press Enter.

Result, 30 Oct 2026, JPY, buyer = sandbox Personal account with country ID (Indonesia),
log in `spikes/results-2026-10-30T02-48-51-848Z.json` (not committed):

| Friend | Hold | Action | PayPal result |
|---|---|---|---|
| Ayu | ¥1,500 | capture exact share ¥1,188, final | 201 COMPLETED, auth CAPTURED, fee ¥80, net USD 6.83 |
| Bima | ¥1,800 | void (item not found) | 200 VOIDED |
| Citra | ¥1,200 | reauthorize on day 1 | 422 `REAUTHORIZATION_TOO_SOON` |
| Citra | ¥1,200 | then capture ¥968, final | 201 COMPLETED, auth CAPTURED, fee ¥73, net USD 5.51 |

Findings:
- Capturing less than the hold works in JPY; partial capture was already on for the sandbox account.
- An Indonesian buyer account can approve a JPY hold.
- The API error says reauthorize is allowed **once**, from day 4 to day 29: "A reauthorization is
  only allowed once from Day 4 to Day 29 since the date of the original authorization." The docs
  page says "multiple". Design for one reauthorize, so a hold opens on the shopping day, not at trip booking.
- PayPal took ¥80 on ¥1,188 (6.7%) and ¥73 on ¥968 (7.5%) in fees, and converted the rest to the
  merchant account's USD. The jastip fee has to cover this.

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
