# Independent UI re-review · round 4

## Verification

Reviewed **`bad5bdf9e0c7fa423ba40852628eaa3d134a60e9`**; HEAD remained unchanged. I read the previous reviews, current implementation and changed tests. My acceptance bar: atomic and immutable payment decisions, recoverable authorizations, truthful money/status displays, and no obsolete navigation repaint.

Independently executed:

- `node --no-warnings app/test/edges.mjs`: **34/34 passed**.
- `node --no-warnings app/test/rules.mjs`: **9/9 passed**.
- `node app/test/ui-edges.mjs`: **23/23 passed**, including both delayed-settlement and delayed-`/api/me` navigation checks.
- Additional in-memory trip/API probes: failure at every position of a four-statement settlement batch; incomplete-plan retry; late authorization after settlement; withdrawal during authorization; failure between recording compensation and executing it; a remaining-held-row stale-shopping attempt; capture success followed by DB-write failure; and settlement racing a new swap proposal.
- Chrome rendering of function-generated recovery states for both roles at **320, 390, 768 and 1440 px**, plus home cards. All those detail renders had zero document horizontal overflow. These used actual trip-function responses through intercepted browser transport, **not real PayPal failures**.
- Separate browser reproductions of delayed join errors and delayed item-AI results after navigating home.
- **100** overlapping local `get`/`all`/`batch` executions and a failed batch: no transaction/active-statement error; rollback preserved the expected counter of 100.
- Migrations **0001–0006** against in-memory SQLite: column definitions matched `SCHEMA`, comparing by column name rather than physical order. There are **six application tables plus `sqlite_sequence`**.
- Opened supplied shopping screenshots at 390/768 px and settlement at 1440 px.

The running :5181 server reported fake PayPal and demo switching enabled. Cloudflare's [D1 documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/) confirms batch rollback semantics; deployed D1 was **not** exercised. I did not independently verify the absence of pre-migration live data; I accept the brief's explicit deployment boundary rather than demand an unused upgrade path.

Not rerun: real-sandbox 29/29 and the complete 32-checkpoint × seven-size flow. Real provider fault/reconciliation behavior, Safari/iOS, screen readers and physical devices remain unverified. No application, test or screenshot files were edited.

## Open-item disposition

“FIXED” closes the specific earlier reproduction, not every adjacent race.

| Item | Status | Independent evidence |
|---|---|---|
| **2 — Payment recovery** | **PARTIAL** | Ordinary failed capture/void and receipt-free retry passed. Failed plan writes now roll back. A late compensation step can still be stranded on a `settled` trip; see **27**. |
| **11 — Route-owned work** | **PARTIAL** | Both old trip-navigation reproductions pass. Join errors and item-AI completion still repaint home; see **29**. |
| **16 — Retry changes duplicate-match allocation** | **FIXED** | The duplicate-line test captured A for ¥900, retried B's saved void, and released B's ¥1,600 without charging it. Stale shopping cannot reopen this settlement. |
| **18 — Late authorization** | **PARTIAL** | Returns beginning after shopping are refused. An in-flight return after settlement retained its authorization, reopened the trip after failed void, and recovered on retry. Withdrawal during authorization still loses the returned authorization; see **26**, also **27**. |
| **19 — Nonatomic plan save / empty retry** | **FIXED** | I failed the lock, first plan write, second plan write and final drop statement separately. Every case left `shopping`, both plans null and **zero provider calls**. A deliberately incomplete plan returned **409**, not empty success. The declared no-live-upgrade scope is accepted. |
| **20 — Stale shopping reopens settlement** | **FIXED** | My additional fixture retained an actual `held` row with a failed saved void, so the test reached the phase guard rather than failing the no-holds precheck. Stale Start shopping returned “Shopping has already started”; trip stayed `settling`, operation stayed `void`. The supplied stale mark/settle checks also passed. A different, pre-commit race remains in **30**. |
| **21 — Lost late compensation** | **PARTIAL** | Failed void now retains `auth_id`, `releasing` and the saved void, with an honest error. But recording compensation and making it recoverable are separate commits; an intervening failure strands it. See **27**. |
| **22 — Concurrent identical returns void the winner** | **FIXED** | Independently executed shared-auth-ID test: both returns succeeded, the request stayed `held`, and no void occurred. The same-ID reload branch is present. |
| **23 — Missing route check after `/api/me`** | **FIXED** | The delayed initial route fetch no longer paints the old trip over `#/`. The original token is passed into `tripView`. |
| **24 — Misleading pending states / late swap** | **PARTIAL** | At all four widths, pending capture showed “Charging ¥900” and unconfirmed wording; pending void showed release pending; rail labels were Paying/Releasing, and home no longer said Not included. Late swap was refused and its saved void remained unchanged. Owner certainty and some recovery wording remain inaccurate; details below. |
| **25 — Customs follows payment recovery** | **FIXED** | Two ¥1,500 caps produced **$20, basis `max`**. A confirmed ¥800 goods line plus ¥100 fee produced **$5, basis `receipt`**, both while capture/void failed and after successful retry. The browser showed the receipt-prices label. This verifies the app's goods basis, not customs-law applicability or exchange rates. |

## Remaining and new blocking findings

### 24, remaining. MAJOR — Owner recovery still asserts that an ambiguous capture left the hold untouched

**Where:** `app/public/js/screens/trip.js:233,264,274–276,315–317`; home money rendering in `app/public/js/app.js`.

**Evidence:** I let the provider stub complete a **¥900 capture**, then failed the following request-outcome write. The operation returned an error; local state remained `found`, `charged: null`, `plan_op: capture`. The owner recovery renderer still says **“The holds are still in place”**, labels the row **“to charge · held”**, and totals the full authorization as held. The browser independently reproduced that wording for the unresolved capture state. Local absence of a capture result cannot prove the provider still holds the full amount.

**Exact fix:** Use “PayPal hasn't confirmed the outcome” and distinguish **last recorded authorization** from confirmed current held money. Describe the row as **“¥900 charge awaiting confirmation.”** Apply the same distinction to owner totals, home summaries and retry-error toasts. Keep confirmed outcomes separate; do not turn an unknown result into a definitely-held claim.

### 26. BLOCKER — Withdrawal during authorization deletes the recovery record

**Where:** `app/lib/trips.mjs:67–72,119–140`.

**Evidence:** Using real trip functions:

1. Create an accepted request and start its PayPal order.
2. Pause `authorizeOrder()` after `finishHold()` has read eligibility.
3. Withdraw the request from another tab; this succeeds because it is still `accepted`.
4. Return the authorization from the provider stub.

The conditional attachment loses, then `cur.auth_id` throws **“Cannot read properties of null (reading 'auth_id')”**. The request is gone and **no void is called**. The returned authorization has no durable recovery record. This is not solved by adding optional chaining: the following UPDATE would still affect zero rows.

**Exact fix:** Retain an authorization-attempt/request tombstone before making the external call. Withdrawal must atomically cancel eligibility without deleting a record needed by an in-flight attempt. A later returned authorization must attach to durable compensation work and be released/reconciled, even if the ask was withdrawn. Test withdrawal both before provider completion and between eligibility checks and attachment.

### 27. BLOCKER — A saved late void can remain on a settled trip with no retry

**Where:** `app/lib/trips.mjs:139–145,235–239`; settled-owner branch in `app/public/js/screens/trip.js`.

**Evidence:** I completed a trip while another authorization was paused. After returning that late authorization, I allowed its `status='releasing'` / `plan_op='void'` UPDATE to succeed, then injected failure into the immediately following authorization-event INSERT.

Observed durable result:

```text
trip: settled
request: releasing, auth_id retained, plan_op: void, hold: 1600
provider void calls: 0
retry: 409 "Nothing to retry"
```

The trip only reopens after `runPlan()` returns an error. Failure or interruption before that branch leaves the new saved operation outside the recovery UI. This is a distinct hole from the now-fixed ordinary failed-void case.

**Exact fix:** Atomically save the compensation step **and** reopen a terminal trip for recovery before logging or contacting PayPal. Make recovery discover pending operations independently of a stale terminal trip flag. Once that pending work finishes, recompute completion. Add this exact failure-position test; an optional event-log failure must not disable financial recovery.

### 28. BLOCKER — `releasing` is missing from financial selectors outside `summary()`

**Where:** `app/lib/trips.mjs:93–96`; `app/public/js/screens/trip.js:213–216,274–276,288`.

**Evidence:** Two consequences of the new status were independently reproduced:

- **Wrong owner amount:** With one released request and a late **¥7,100** authorization awaiting void, API summary correctly reported `held: 7100, pending: 1`. At **320/390/768/1440 px**, owner detail instead showed **“¥0 held for you”** beside **“release ¥7,100 · held.”** The desktop friend rail called that friend **“asked”**. Home correctly showed ¥7,100 held, so navigation changes the apparent amount.
- **S6 bypass:** The same new friend had `kept: 0`. While that ¥7,100 authorization remained `releasing`, they successfully opened and authorized another ¥7,100 hold on a second trip. Total outstanding authorization value was **$93.72** under the app's rate, despite its **$50** new-friend limit. `heldUsd()` excludes `releasing`.

**Exact fix:** Include unresolved release authorizations in exposure checks, owner totals and rail summaries, not just API `summary()`. Use a consistent unresolved-authorization predicate; account for `not_found` exposure too, which `heldUsd()` also omits. Pending capture amounts must retain the uncertainty distinction in finding 24. Test the same releasing-only fixture across the limit check, home, detail and rail.

### 29. MAJOR — Join callbacks still repaint a departed route

**Where:** `app/public/js/screens/join.js:9–10,21,68–75,89–93`.

**Evidence:** Two separate Chrome reproductions at 390 px:

- Delay a join response, navigate home and wait for **Trips**, then return 404. URL remains **`#/`**, but the page changes to **“This link doesn't work.”** Only the successful fetch branch checks ownership.
- On a valid join page, click Find, delay `/api/ai/item`, navigate home, then complete the response. URL remains **`#/`**, but the page changes to **“What should Dina bring?”**, with an active Send control.

Neither produced a page error; the wrong rendering is the failure. The name-submission continuation also calls `joinView(app, code)` without the route token.

**Exact fix:** Keep the originating token through every join continuation. Check ownership before error rendering, `draw()`, focus, recursive rendering and post-send navigation. Let completed server work persist, but suppress obsolete UI work. Add both delayed-response journeys, not only the initial successful join fetch.

### 30. BLOCKER — Settlement can charge from a stale shopping snapshot before its atomic lock

**Where:** `app/lib/api.mjs:114–119`; `app/lib/trips.mjs:195–208,215–231`.

**Evidence:** I reproduced this through the actual API with fake PayPal, suspending `db.batch()` immediately before the settlement transaction executes:

1. `/settle` computes a **¥900 capture** for a found item matched to a ¥800 receipt line.
2. Another owner request successfully proposes a **¥500 swap requiring friend approval**; `/mark` returns **200**, storing `swap_asked`.
3. Resume the settlement batch.

`/settle` returns **200** and charges **¥900**. Final state is `settled`, with `swap_title: "Replacement needs consent"`, `swap_price: 500`, but `line_text: "Original"`, `price: 800`. The friend never accepted the replacement. The new UPDATE guard admits any open status, so the transaction atomically persists a decision computed from an obsolete request state.

**Exact fix:** Validate the planning snapshot as part of acquiring the settlement lock. For example, use a shopping revision incremented atomically with marks/swap answers, and condition the trip lock on the revision used to build the plan. A mismatch must commit **no payment plan**, return 409 and require refreshed review. Merely adding per-row predicates is insufficient if zero-row updates still let the batch commit and provider calls start. Test this exact interleaving and a concurrent Not here change.

## MINOR — non-blocking wording

### 31. Pending release copy promises automation or completion that has not happened

**Where:** `app/public/js/screens/trip.js:55`; `app/lib/trips.mjs:189`.

**Evidence:** Pending release renders **“it's retried automatically.”** The inspected browser watcher only GETs state; ordinary recovery is invoked by the owner's Retry button, and the Worker entry has no scheduled retry handler. Also, the independently executed late-swap test deliberately failed the void but returned **“this one is released”** while the request still had a pending void.

**Exact replacements:** Use **“Dina can retry the release from her trip”** (substitute the owner's actual name), and **“Too late to change this item: its release is already planned.”** This wording issue does not independently block the verdict.

## Non-blocking 10x proposal

**Proposed; no numerical multiplier established:** Extend the existing failure-position harness with a model invariant: after every interruption, each returned authorization must be durably represented, and every unresolved operation must have a reachable recovery action. The ordinary failed-void test now passes, but interruption immediately before its recovery-state update still fails. Start with fixtures 26–27 and assert both database recoverability and owner-visible actions; measure uncovered interruption positions rather than only total passing checks.

VERDICT: FIX FIRST
