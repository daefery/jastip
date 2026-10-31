# Independent UI re-review · round 5

## Verification

Reviewed **`7e04f242e89984b77e02f72dfd957105fd129e2b`**; HEAD remained unchanged. I read round 4 first, inspected the implementation and diff, and reproduced behavior independently. Acceptance criteria: immutable reviewed payment decisions, durable authorizations with reachable recovery, truthful financial displays, and route-owned asynchronous rendering.

Independently executed:

- `node --no-warnings app/test/edges.mjs`: **41/41 passed**.
- `node --no-warnings app/test/rules.mjs`: **9/9 passed**.
- `node app/test/ui-edges.mjs`: **25/25 passed**.
- Six additional settlement interleavings: pause immediately before the settlement batch, then change **Found, Held, Not here, an automatic Similar OK swap, swap acceptance, or swap rejection**. Every change incremented `rev`; every stale settlement returned **409**, saved no plan and made **zero capture/void calls**.
- A live Chrome journey on **:5181**: scan the sample receipt, change the item after reviewing it, then confirm. The receipt returned revision **1**, the list advanced to **2**, settlement returned **409**, the sheet closed, the refreshed Finish action appeared, and `plan_op`/`charged` remained null. No page error.
- Additional in-memory trip-function probes: withdrawn-row visibility, withdrawal during authorization with a failed void, an actual `releasing` authorization against the $50 limit, capture success followed by a failed outcome write, settlement completion racing late compensation, and direct retry of a settled trip containing an open void.
- Chrome rendering of those three financial failure states for **both roles at 320, 390, 768 and 1440 px**: **24 detail renders**, zero document horizontal overflow or page errors. Also checked their home cards. These used actual trip-function responses through intercepted transport, **not real PayPal faults**.
- Separate delayed **join-name submission** and **post-send completion** journeys after navigating home; neither reclaimed the departed route. The supplied suite independently covered delayed invalid-invite and AI responses.
- Applied migrations **0001–0007** to in-memory SQLite; column definitions matched `SCHEMA` for all six application tables, comparing by column name.
- Opened supplied screenshots: `flow-390/23-ready-to-pay.png`, `flow-768/17-shopping.png`, and `flow-1440/26-settled.png`.

The live server reported fake PayPal and demo switching enabled. I did **not** rerun real-sandbox `e2e.mjs` or the complete seven-size, 32-checkpoint flow. Deployed D1, real-provider reconciliation, Safari/iOS, screen readers and physical devices remain unverified. No application source, tests or screenshots were edited.

## Open-item disposition

“FIXED” closes the specified reproduction, not every adjacent failure mode.

| Item | Status | Independent evidence |
|---|---|---|
| **2 — Payment recovery** | **PARTIAL** | Ordinary capture/void retries pass. Two reachable recovery states still lack a usable owner action: **32–33** below. |
| **11 — Route ownership** | **FIXED** | The supplied slow-settlement, slow-route-fetch, invalid-invite and AI-response checks passed. My additional delayed name/send continuations also left the URL and page at home. |
| **18 — Late authorization** | **PARTIAL** | Returns starting after shopping are refused; in-flight authorizations are retained. Recovery remains unreachable in the withdrawal/holds state and can disappear behind a terminal trip flag; **32–33**. |
| **21 — Lost late compensation** | **PARTIAL** | The authorization and saved void now survive the tested provider/log failures. Durability is fixed in these cases, but owner-accessible recovery is not universal; **32–33**. |
| **24 — Truthful pending states / late swap** | **PARTIAL** | Owner recovery now says “not confirmed” and “charge awaiting PayPal”; friend detail shows the pending charge. The late-swap test rejects the answer without changing its void. Friend home still presents the original full authorization as definitely held after an ambiguous capture; remaining **24** below. |
| **26 — Withdrawal deletes the recovery record** | **FIXED** | During a paused authorization, withdrawal retained a `withdrawn` row. Before provider completion, owner requests and count were empty, friend joined trips were empty, and `canSee` was false. Completion retained the authorization as a saved void; the supplied successful-void case released it. Failed-void usability is separately reported in **32**. |
| **27 — Late void stranded by logging failure** | **PARTIAL** | The original logging-failure test passed: request save and trip reopening commit together, then retry releases it. My direct retry of a `settled` trip with an open void also succeeded. A different completion interleaving recreates `settled` plus open work and hides the recovery UI; **33**. |
| **28 — Outstanding authorization selectors** | **PARTIAL** | My actual `releasing` ¥7,100 row blocked another ¥7,100 authorization with the $50 error. The owner KPI includes it. However, the `holds` heading still says ¥0 and its item list omits the row; **32**. The shared list did not fix every phase-specific display. |
| **29 — Join callbacks repaint departed routes** | **FIXED** | All four affected continuations were exercised: invalid invite, AI result, name continuation and send completion. None repainted or navigated back to join/trip after departure. |
| **30 — Stale settlement snapshot** | **FIXED** | The supplied stale-swap case passed; all six additional pre-batch interleavings rejected stale plans with no financial operations. The live receipt UI correctly sent the reviewed revision and recovered from the 409. |
| **31 — Automatic retry / completed-release wording** | **FIXED** | The automatic-retry promise is removed. The independently executed late-swap check returned “its release is already planned,” with the void still pending. The newly substituted owner-retry promise is not actionable in **32–33**, a functional problem rather than the original wording defect. |

## Blocking findings

### 32. BLOCKER — A withdrawn authorization whose void fails is stranded before shopping

**Where:** `app/lib/trips.mjs:150–158,257–264`; `app/public/js/screens/trip.js:224–234,255–257,274–278`.

**Reproduction:** Using real trip functions and a provider stub:

1. Create one accepted ask with a **¥7,100** authorization amount; set the shopping day.
2. Open its PayPal order and pause `authorizeOrder()`.
3. Withdraw the ask. Verify its retained `withdrawn` tombstone is hidden.
4. Complete authorization, but fail its compensating void.

Observed:

```text
trip.status = holds
request.status = releasing
auth_id retained; plan_op = void
finishHold: “Withdrawn. PayPal hasn't confirmed the release yet.
             Dina can retry it from the trip.”
retry: “Nothing to retry”
startShopping: “No approved holds yet”
```

At **all four widths**, the owner page displayed **“0 of 0 holding”**, **“¥0 held for you by PayPal”**, an empty item list, and a disabled Start shopping button. Its KPI simultaneously displayed **¥7,100 held for you**. There was **no Retry button**. Friend detail promised Dina could retry, although both the API and UI prevented it.

The new record retention prevents losing the authorization, but it does not make this pre-shopping compensation recoverable. With this sole ask there is no normal UI path forward.

**Exact fix:** Allow the owner to retry saved compensating voids independently of checkout phase, and show pending-recovery rows/actions in `holds` and `shopping` as well as `settling`. Preserve the collecting/shopping phase when retrying pre-checkout compensation; do not prematurely finish a trip containing other active asks. Separate unresolved authorization amounts from eligible shopping holds in the heading and KPI. Add this exact one-ask failure journey and require a successful retry **without adding another ask or beginning checkout**.

### 33. BLOCKER — The final completion check can overwrite a newly saved late void

**Where:** `app/lib/trips.mjs:150–153,290–292`; terminal owner rendering in `app/public/js/screens/trip.js:243–247,266–275`.

**Reproduction:** I used two requests and deterministic barriers around actual database calls:

1. Authorize A; leave B's authorization in flight.
2. Start shopping, mark A Not here and finish. A's void succeeds.
3. Pause the finishing call **after** its outstanding-row count returns **0**, but before its terminal `UPDATE trips` executes.
4. Complete B's authorization. Its compensation batch saves `releasing` / `plan_op: void`; the trip is already `settling`. Fail B's void. Its own completion check sees the open row and leaves the trip `settling`.
5. Resume A's finishing call. It uses the stale zero count and changes the trip to `settled`.

Final durable state:

```text
trip.status = settled
B.status = releasing
B.auth_id retained
B.plan_op = void
B.hold = 1600
```

At **320/390/768/1440 px**, owner detail said **“Holds not used were released”**, listed only A's completed release, and offered **no Retry**. Owner home said **“Paid · +¥0”**. B's friend detail still reported an unconfirmed release and told them Dina could retry.

I then cleared the fault and invoked `retry()` directly: it successfully reopened, released B and settled the trip. Thus the new API fallback works, but the ordinary owner cannot reach it from the rendered state.

**Exact fix:** Make completion an atomic conditional update, checking absence of outstanding requests **inside the same SQL statement**, rather than counting and then updating:

```sql
UPDATE trips SET status='settled'
WHERE id=? AND status='settling'
  AND NOT EXISTS (
    SELECT 1 FROM requests
    WHERE trip_id=? AND status IN (/* shared OUTSTANDING statuses */)
  );
```

Keep the atomic late-step/reopen batch. Also expose recovery whenever open saved steps exist, even if a stale terminal flag is encountered; that makes the existing settled-trip retry fallback usable. Add the count/late-attachment/terminal-update interleaving as a regression test.

### 24, remaining. MAJOR — Friend home still turns an uncertain capture into a definite full hold

**Where:** `app/public/js/app.js:72–73`; the analogous other-trip amount expression in `app/public/js/screens/trip.js`.

**Evidence:** I allowed the provider stub to complete a **¥900 capture**, then failed the local request-outcome UPDATE. The trip remained `settling`; the request retained `found`, `plan_op: capture`, `charged: null`, and its original **¥1,600** authorization amount.

Chrome showed:

- Owner detail: **“charge awaiting PayPal”**; owner home: **“¥1,600 awaiting PayPal.”** These no longer assert the hold is untouched.
- Friend detail: **“Charging ¥900”**, with confirmation-pending wording.
- Friend home: **“Paying… · ¥1,600 held.”**

The friend-home branch was not changed by this fix. The locally retained authorization amount cannot establish that PayPal still holds that entire amount after capture succeeded.

**Exact fix:** Give pending operations precedence in friend money summaries, not just their status badge. At minimum, replace the pending case's “held” with **“authorization outcome unconfirmed”** or **“awaiting PayPal”**; ideally show the saved **¥900 charge awaiting confirmation**, separately from the original authorization ceiling. Apply the same rule to other-trip summaries and retain confirmed paid totals separately. Test the provider-success/local-write-failure case on both home and detail.

## MINOR — non-blocking

### 34. Withdrawal compensation is described as late shopping approval

**Where:** `app/public/js/screens/trip.js:54–55`; `app/public/js/app.js:53–54`.

**Evidence:** In reproduction 32, the trip never left `holds`, and the saved reason was `withdrawn while PayPal was approving`. Nevertheless, friend detail said **“Approved too late. Dina had already started shopping.”** Its home badge also said **“Paying…”** for a void-only pending operation.

**Exact fix:** Use `plan_why` to distinguish withdrawal from shopping already starting: **“Ask withdrawn. Releasing your hold.”** Omit the shopping sentence for withdrawal compensation. Use **“Releasing…”** for void-only home summaries, or a neutral **“PayPal pending”** when operations are mixed. The unavailable retry action is already covered by blocking finding 32; this finding concerns wording only.

## Non-blocking 10x proposal

**Proposed; no multiplier established:** Extend the existing interruption harness to assert **recovery reachability across every trip phase**, not merely presence of `auth_id` and `plan_op`. Round 5 preserves the money records in the two new reproductions, but both owner screens hide the action. The first addition should generate the owner response after each interrupted operation and require either a confirmed outcome or an enabled recovery control whose endpoint accepts it. Measure reachable-recovery cases against tested interruption states; start with 32–33.

VERDICT: FIX FIRST
