# Independent UI re-review · round 7

## Scope and verification

Reviewed **`5d380cd91c2bccf9a1ccdba2f4414dafc0279a1c`**. HEAD contains the brief; the implementation is in **`55576f2`**. I read my round-6 answer first, inspected the implementation and tests, and independently reproduced both fixes. HEAD remained unchanged during verification.

Acceptance criteria: recovery must coexist with eligible shopping actions; disabled actions must stay disabled; retry must preserve saved amounts and operations; completed withdrawal must not imply shopping or payment.

Independently executed:

- `node --no-warnings app/test/edges.mjs`: **48/48 passed**.
- `node --no-warnings app/test/rules.mjs`: **9/9 passed**.
- `node --no-warnings app/test/ui-edges.mjs`: **34/34 passed** against **:5181**.
- Additional Chrome journeys at **320×640, 768×1024 and 1440×900**, using the served frontend with intercepted API transport backed by actual `makeTrips()` functions and in-memory SQLite. Authorization was paused deterministically; withdrawal occurred while it was in flight; provider-stub voids then failed. These were independently constructed fixtures, not copied database states or real PayPal faults.
- Applied migrations **0001–0007** to fresh in-memory SQLite: column definitions matched `SCHEMA` for all six application tables, comparing by column name.
- Opened supplied screenshots `flow-320/23-ready-to-pay.png`, `flow-768/17-shopping.png` and `flow-1440/26-settled.png`. These show the ordinary flow, not the exceptional fixtures above.

No application source, tests or screenshots were edited. The browser suite exercised the designated test database; my additional fixtures remained in memory.

## Earlier findings

### 35. MAJOR — FIXED: recovery no longer replaces legitimate phase actions

**Where:** `app/public/js/screens/trip.js:247–262`.

At each of the three widths, my independent fixture contained A's valid **¥1,600** hold and B's failed **¥600** withdrawal compensation.

1. In `holds`, **Start shopping · 1** and **Retry PayPal · 1** were both enabled. Retry was the lighter secondary button.
2. I clicked Retry **twice**, with both void attempts failing. The trip remained `holds`; Start shopping remained enabled.
3. I focused Start shopping and pressed **Enter**. Shopping started. Receipt checkout remained disabled before A was marked Found.
4. I clicked Found. Receipt checkout became enabled while Retry remained available.
5. I opened the receipt sheet, used the sample-image control with a deterministic receipt response, reviewed **¥900**, and clicked Charge. Actual settlement functions produced:

   ```text
   A: settled, charged = 900
   B: releasing, plan_op = void
   trip: settling
   ```

6. After allowing B's void to succeed, I clicked the now-primary Retry. B released **¥600**, the trip settled, and the handover control appeared. A remained charged **¥900**, with exactly **one capture-stub invocation** per fixture.

The seven measured action states—holds and Found at all three widths, plus receipt-free Finish at 320 px—had **zero document horizontal overflow**. Both action centers were hit-testable; primary buttons were **56 px** high and secondary Retry buttons **46 px**. All additional browser journeys completed without page errors.

**Adjacent eligibility checks:** A release-only trip still showed disabled Start shopping and enabled Retry at all three widths. An unanswered swap still disabled receipt checkout. After skipping that swap, **Finish trip** and Retry coexisted; clicking Finish released A without a capture, retained B's failing void, and left `settling`. Subsequent Retry completed settlement.

### 36. MINOR — FIXED: completed withdrawal retains its meaning

**Where:** `app/public/js/app.js:53–63`; `app/public/js/screens/trip.js:37–45,83,105`.

At all three widths, I independently reproduced a one-request withdrawal during authorization, failed compensation, then successful recovery while the trip remained `holds`.

- Pending detail said **“Ask withdrawn. Releasing your hold.”**, without claiming shopping had started.
- Completed detail said **“Ask withdrawn. Hold released.”**
- The progress indicator remained **“Progress: Asked”**; neither timeline copy marked Dina's shopping complete.
- Friend home showed **“Released”**.
- No Hold, Withdraw, Swap or delivery-confirmation action appeared on the released request.
- Adding another accepted ask for the same friend changed the home badge to **“Approve hold”**; approving it changed the badge to **“Held”**. The released ask did not mask active work.

A separate authorization completing after shopping started, with successful compensation, displayed **“Approved too late. Hold released.”** Its shopping timeline was correctly complete.

## Adjacent regression coverage

The executed suites also passed saved-void retry, capture recovery, stale-plan rejection, duplicate settlement, late-authorization compensation, atomic completion, pending exposure, privacy, route-ownership and receipt-free settlement checks. The browser suite retained truthful **“charge pending”** home wording. These results support the earlier fixes; they do not establish real-provider concurrency guarantees.

## New findings

**BLOCKER / MAJOR:** None.

**MINOR:** None.

No issues found in the reviewed change.

## Verification limits

I did **not** independently rerun real-sandbox `e2e.mjs` or the complete 32-checkpoint × seven-size flow. Their claimed results remain unverified in this review. Deployed D1, real PayPal fault recovery/idempotency, Safari/iOS, screen readers and physical devices were not tested. The deterministic receipt response proves UI-to-settlement behavior, not AI receipt accuracy.

## Non-blocking regression proposal

**Proposed; no numerical multiplier established:** Persist the integrated failure-to-recovery journey above. Current `ui-edges.mjs` checks coexistence of controls, while `edges.mjs` separately checks repeated void failure and exact settlement. Connecting them would detect a broken click handler or lost action after retry, not merely a missing button. Start with the 320 px case and append the successful-withdrawal home/detail assertions; measure whether the full failing-retry → checkout → recovery sequence passes without direct phase-changing test calls.

VERDICT: SHIP
