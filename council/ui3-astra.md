# Independent UI re-review · round 3

## Verification

Reviewed **`50289c4`**, unchanged throughout this review. I read the previous reviews, current implementation, changed tests and migrations. Acceptance criteria: retries preserve the confirmed operation and amount; every authorization has a recovery path; financial states remain truthful for both roles; obsolete navigation cannot repaint the page.

Independently executed:

- `node --no-warnings app/test/edges.mjs`: **24/24 passed**.
- `node --no-warnings app/test/rules.mjs`: **9/9 passed**.
- `node app/test/ui-edges.mjs`: **22/22 passed**.
- Additional Chrome/Playwright journeys against **:5181**, confirmed as fake PayPal with demo switching enabled. These included accepting the shopping-exclusion confirmation, the dropped-only friend's home/detail after settlement, persistent validation, and delayed navigation.
- In-memory trip/API probes with controlled database failures, provider failures and concurrent authorization returns. Browser recovery-state probes used responses from these real trip functions through intercepted transport, **not real PayPal failures**.
- Owner recovery rendering at **320, 390, 768 and 1440 px**: all three unresolved request types appeared, with zero document horizontal overflow. Friend recovery and swap-choice journeys ran at 390 px.
- All migrations **0001–0005** against in-memory SQLite: column definitions matched `SCHEMA` for all six tables. This verifies schema shape, not migration of existing payment work.
- Opened supplied shopping screenshots at 390/768 px and settlement at 1440 px. The `.jr b.wrap2` specificity repair is also present in source.

I did **not** rerun the real-sandbox 29/29 suite or the full seven-size, 32-checkpoint flow. Deployed D1, real provider fault/reconciliation behavior, Safari/iOS, screen readers and physical devices remain unverified. One additional browser probe initially timed out because its setup created a session without refreshing the client store; the corrected setup passed. No application source, test or screenshot files were edited.

## Open-item disposition

“FIXED” below closes the specific earlier reproduction, not every possible failure in the surrounding subsystem.

| Item | Status | Independent evidence |
|---|---|---|
| **1 — Receipt-free retry** | **FIXED** | Injected a failed void into an all-missing trip. Finish retained `settling` with `receipt_id: null`; the browser showed the failure toast, not “All holds released.” Clearing the fault and clicking Retry settled the trip. The edge test also verified only the unresolved void was retried. |
| **2 — Payment recovery** | **PARTIAL** | Ordinary capture/void failures remain retryable and successful requests are skipped. A completed capture followed by a failed DB outcome write recovered with the same amount under an idempotent provider stub. However, failure while saving the plan leaves an unrecoverable empty retry; see **19**. Financial uncertainty is also misrepresented to friends; see **24**. |
| **6 — Confirm excluded asks** | **FIXED** | The independently run UI test dismissed the confirmation and retained `holds`. My separate live-browser journey accepted it: the dialog named “ReviewLate: Never approved,” and that request became `dropped`. |
| **7 — Never-held home label** | **FIXED** | Completed a live fake-provider trip containing a separate friend's unapproved request. After settlement, their home card said **“Not included”** and detail said nothing was held or charged. A different, newly introduced `settling` misclassification remains in **24**. |
| **11 — Route ownership** | **PARTIAL** | The earlier delayed-settlement callback no longer repaints home; the supplied test passed independently. Delaying the router's preceding `/api/me` still lets an obsolete trip route acquire the new route token and repaint home; see **23**. |
| **13 — Withdrawal reload** | **FIXED** | The independently run browser test confirmed withdrawal, reached `#/`, and emitted no page error. The handler no longer invokes the old trip reload. |
| **15 — Fee and persistent errors** | **FIXED** | Actual API calls rejected `-0.1`, `-5`, `"abc"` and `"Infinity"` with 400. In Chrome, fee `-0.1` and malformed email remained unchanged, with field-associated messages and `aria-invalid="true"` still present after **5.2 seconds**. Focus moved to the fee. |
| **16 — Retry changes duplicate-match decision** | **PARTIAL** | Direct `/retry` now preserves the saved void; the duplicate-line edge test passed. But `/shop` can reopen `settling`, allowing settlement to overwrite that saved decision and charge the same receipt line again; see **20**. |
| **17 — Missing unresolved rows** | **FIXED** | Rendered a failed capture, a failed void for `held`, and a failed void for `swap_asked`. At all four tested widths the heading counted **3**, all rows appeared, and amounts were **¥900 to charge**, **release ¥1,600**, **release ¥1,600**. |
| **18 — Late authorization** | **PARTIAL** | Returns beginning after shopping or settlement are refused; both edge cases passed. Authorization already in flight can still become an untracked hold when compensation fails. Concurrent identical returns can also void the winning authorization; see **21–22**. |

## Remaining and new findings

### 19. BLOCKER — Locking before saving the plan creates a permanent recovery dead end

**Where:** `app/lib/trips.mjs:195–217,238–240`; `app/lib/api.mjs:112–119`; `app/migrations/0005_plan.sql`; retry success handling in `app/public/js/screens/trip.js:302–309`.

**Evidence:** I injected one failure into the first `UPDATE requests SET plan_op...`, after the trip lock succeeded. The actual `/settle` handler returned **500**. The request remained `found`, with **¥1,600 held** and `plan_op: null`; the trip remained `settling`. The actual `/retry` handler then returned **200, `{ "results": [] }`**, made no provider call, and left the trip stuck. Further settlement is refused. The UI treats that empty result as “Payments confirmed.”

This is also an upgrade gap: migration 0005 only adds nullable columns. Existing unresolved requests from the previous `settling` implementation have no saved operations for `runPlan()` to execute. Matching schema columns does not address that data state.

**Exact fix:** Commit the complete confirmed plan and the transition into `settling` atomically, with the same semantics in Node and D1. A failed save must leave no partially committed plan and must not start provider calls. Refuse/report incomplete plans rather than returning successful empty results. Define a safe reconciliation path for pre-migration unresolved trips; do not reconstruct duplicate-line allocation from unresolved requests alone. Add failure-before/after-each-plan-write tests and an upgrade fixture.

### 20. BLOCKER — A stale Start shopping action can reopen settlement and overwrite the saved plan

**Where:** `app/lib/trips.mjs:138–143,195–204`; `/api/trips/:tid/shop` in `app/lib/api.mjs`.

**Evidence:** My reproduction used two requests matching one ¥800 receipt line. A was found and charged **¥900**; B remained `held`, had a saved **void**, and its void failed. The trip was `settling`.

Reissuing `startShopping()` succeeded because B was still `held`; there is no trip-phase guard. After marking B found and settling again, B's saved operation changed from `void` to `capture`. Both requests ended charged **¥900** against that one receipt line. Observed provider sequence:

```text
capture A ¥900
void B → failure
capture B ¥900
```

A second tab retaining the earlier Start shopping control can invoke this endpoint; the endpoint does not enforce the intended one-way transition.

**Exact fix:** Make Start shopping a database-guarded `holds → shopping` transition and reject it from `shopping`, `settling` or `settled`, including when a caller holds a stale trip object. Prevent overwriting an already committed plan. Apply equivalent phase guards to other phase-changing entry points, and test stale `/shop` followed by another `/settle`.

### 21. BLOCKER — Failed late-authorization compensation discards the authorization and reports success

**Where:** `app/lib/trips.mjs:124–132`, especially `await pp.voidHold(a.authId).catch(() => {})`.

**Evidence:** I paused authorization for B, started shopping using A's existing hold, then completed B's authorization as `LATE-AUTH` while making its compensating void fail. The function returned **“the hold was released”** and logged a successful `VOID`, despite the failure. B remained `dropped`, with **`auth_id: null`**. Finishing A settled the trip; no saved operation referenced `LATE-AUTH`.

The authorization existed in the provider stub, but the application discarded the identifier needed to release it. This is the original unrecoverable-hold defect in the in-flight race branch.

**Exact fix:** Durably retain every returned authorization before attempting compensation. Record unsuccessful/uncertain voids as pending recovery operations, including for excluded requests, and expose a retry/reconciliation path. Set released status and successful VOID events only after confirmed release. Never swallow the compensation error or tell the friend that release succeeded when it did not.

### 22. BLOCKER — Concurrent PayPal returns void the authorization that the winning return just attached

**Where:** `app/lib/trips.mjs:118–132`.

**Evidence:** I ran two concurrent `finishHold()` calls for one accepted request and made the provider return the same authorization ID, matching the adapter's stable `auth-${orderId}` request-key design. One conditional update won and returned `held`. The other lost and called **`voidHold("SAME-AUTH")`**. Final database state was still **`held`, auth_id `SAME-AUTH`, hold ¥1,600**, although that authorization had been voided by the losing call. The trip never left `holds`.

The loss of a conditional update is not proof that shopping started or that the authorization is unwanted.

**Exact fix:** On a lost update, reload the request and trip before compensating. If the same authorization is already attached to a valid request, treat the return as idempotent success, without voiding it. Compensate only an authorization proven to be unattached or ineligible, retaining its recovery record as in 21. Add a concurrent-return test with one shared authorization ID, not independently generated IDs.

### 23. MAJOR — The router checks ownership after errors, but not after its successful initial await

**Where:** `app/public/js/app.js:106–120`; `app/public/js/screens/trip.js:12–15`.

**Evidence:** In Chrome I paused the `/api/me` request started by navigation to a trip, navigated home, and waited for **Trips**. Releasing the older response rendered the trip's **“3 PayPal steps didn't go through”** screen while the URL remained **`#/`**.

`route()` captures `my`, but proceeds past `await refreshMe()` without checking it. The obsolete call then enters `tripView()`, which captures the *current* `store.route` and incorrectly becomes its owner.

**Exact fix:** Immediately return after `await refreshMe()` when `!owns(my)`, before invoking any view. Pass the originating token through asynchronous view work rather than recapturing ownership after an await. Apply the same rule to other asynchronous route renderers. Keep both tests: delayed settlement callback and delayed initial route fetch.

### 24. MAJOR — Friends get false final labels and can accept a swap already committed for release

**Where:** `app/public/js/app.js:53–61`; `app/public/js/screens/trip.js:36–76,138–139`; `app/lib/trips.mjs:166–171`.

**Evidence:** Browser rendering of independently generated recovery states showed:

- A failed capture's home card: **“Not included”**, immediately above **“¥1,600 held.”** Detail still said **“In Dina's basket. Next: the till.”**
- A failed void for an unmarked item: home also said **“Not included”**; detail reverted to **“Held. See you on shopping day.”**
- A `swap_asked` request with saved `plan_op: "void"`: home said **“Pick a swap.”** The Choose button remained active. Clicking Take the swap succeeded and changed the page to **“Swap in the basket”**, but the saved operation remained **void**. In the corresponding function test, retry subsequently released it.

The new plan correctly stays immutable during direct retry, but the UI and swap endpoint still invite a choice that can no longer change the outcome.

The completed-capture/failed-DB-write probe also left the friend-facing stored state at `found`, `charged: null`, although the provider stub had completed the capture. Unconditional “¥0 charged” / “holds are still in place” is therefore not a safe description of an unresolved outcome.

**Exact fix:** Derive friend list/detail/action state from their own pending settlement operation before falling back to shopping statuses. Distinguish capture confirmation pending from release pending; do not infer exclusion from zero confirmed charges. Hide swap decisions after plan commitment and reject late `/swap` server-side with a phase/plan guard. Describe ambiguous provider results as unconfirmed, not definitely uncharged or still held. Preserve normal paid/delivered UI for requests whose own outcomes are confirmed.

### 25. MINOR — The customs figure changes with payment recovery rather than the purchased goods

**Where:** `app/lib/trips.mjs:261–264`; customs rendering in `app/public/js/screens/trip.js`.

**Evidence:** The three-operation fixture had one ¥800 receipt item planned for capture and two requests planned for void. While all provider operations failed, the owner saw **“Customs: $30 of $500 duty-free.”** `customs()` summed all three ¥1,500 caps. After successful resolution, the same code would instead use the ¥900 charge, including the ¥100 service fee. The saved receipt and purchase decisions did not change.

**Exact fix:** Separate the pre-purchase cap estimate from a receipt-based goods-value estimate, and label estimates explicitly. Once purchase evidence is known, payment retry status should not change the goods basis. Keep fee amounts separate. This is non-blocking here; I did not verify customs-law applicability or exchange-rate accuracy.

## Other requested regression checks

- **Capture completed, DB write failed:** Retry issued the same authorization/amount again and the idempotent stub returned the original capture: **two calls, one unique capture, ¥900**, then `settled`. This supports the retry mechanism within that modeled provider behavior, not a claim about real PayPal retention or reconciliation. The intermediate certainty problem is included in 24.
- **`swap_asked` at checkout:** Planning selected void, not capture; the owner recovery row appeared. The remaining late-choice defect is reproduced in 24. I invoked settlement directly for this state; the ordinary fresh owner UI disables checkout while swaps are pending.
- **Summary amounts:** In the three-failure fixture, the owner showed **¥4,800 held** and each friend **¥1,600 held**, matching the three recorded authorizations. The friend status labels, not those sums, were wrong. Those amounts cannot establish provider truth after an ambiguous operation.
- **`plan_*` privacy:** A friend's response included `plan_op`, `plan_charge` and `plan_why` for **their own request only**; the full receipt stayed null. I found no cross-friend plan or receipt-line disclosure in this probe. Exposing the friend's own pending operation is useful, not itself a privacy defect.

**10x note — non-blocking proposal; no multiplier claimed:** Extend the failure-position matrix into an operation-lifecycle test harness: before plan commit, after provider success/before local save, during compensation, and during duplicate callbacks. The current 24 passing edge checks coexist with the reproduced lost authorization and incomplete-plan dead end. Proposed invariant: every returned authorization is either durably attached, confirmed released, or durably awaiting reconciliation. Start with tests 19, 21 and 22; no numerical improvement has been measured.

VERDICT: FIX FIRST
