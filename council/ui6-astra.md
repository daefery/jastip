# Independent UI re-review · round 6

## Verification

Reviewed **`be55cfcc34ab4ff5e4a70d067cea513f670e454f`**. HEAD contains the brief; implementation changes are in its parent, **`b0e9f0a`**. HEAD remained unchanged during review. I read round 5 first, inspected the changed implementation and tests, and reproduced the financial states independently.

Acceptance criteria: saved payment decisions remain immutable, unresolved authorizations have reachable recovery, recovery preserves the trip phase, money displays distinguish pending from confirmed outcomes, and unrelated recovery does not remove legitimate shopping actions.

Independently executed:

- `node --no-warnings app/test/edges.mjs`: **44/44 passed**.
- `node --no-warnings app/test/rules.mjs`: **9/9 passed**.
- `node --no-warnings app/test/ui-edges.mjs`: **28/28 passed** against **:5181**.
- **Completion mutation check:** restored only the old count-then-update completion implementation in an in-memory module, leaving the new retry implementation intact. The suite fell to **43/44**; test 21 failed with **`settled releasing`**. Current code passes that same interleaving. No source file was changed for this check.
- Additional fixtures built through actual trip functions: withdrawal during authorization with failed compensation in `holds`; that compensation alongside a valid held request; failed late compensation during shopping and after settlement; and provider capture success followed by a failed local outcome write.
- **43 Chrome detail renders**, primarily both roles at **320, 390, 768 and 1440 px**, plus home cards and the friend's Other trips rail. These used real trip-function responses through intercepted browser transport and provider stubs, **not real PayPal faults**. Zero document horizontal overflow or page errors in these renders.
- Clicked Retry against function-generated states: a one-ask withdrawal released successfully while preserving `holds`; a deliberately stale `settled` flag still exposed Retry and recovered its saved void. Additional browser checks reproduced the checkout regression below at all four widths.
- **Five additional deterministic interleavings**, described below.
- Applied migrations **0001–0007** to in-memory SQLite. Column definitions matched `SCHEMA` for all six application tables, comparing by column name.
- Opened supplied screenshots `flow-390/23-ready-to-pay.png`, `flow-768/17-shopping.png`, and `flow-1440/26-settled.png`.

Not independently rerun: real-sandbox `e2e.mjs` and the complete 32-checkpoint × seven-size flow. Deployed D1, real-provider concurrency/reconciliation, Safari/iOS, screen readers and physical devices remain unverified. No application source, tests or screenshots were edited.

## Open-item disposition

**FIXED closes the original reproduction, not every adjacent workflow.** The new action-replacement regression in **35** independently blocks shipping.

| Item | Status | Independent evidence |
|---|---|---|
| **2 — Payment recovery** | **FIXED** | Ordinary capture/void and receipt-free retries passed. Additional browser clicks recovered saved voids in `holds` and behind a stale `settled` flag. Shopping-phase retry preserved `shopping` and did not charge the unrelated found item. Normal shopping actions alongside recovery have a separate regression: **35**. |
| **18 — Late authorization** | **FIXED** | The executed suite refused returns beginning after shopping. My gated authorizations finishing after withdrawal, shopping and settlement all retained their authorization as a saved void when compensation failed; subsequent retry recovered it. |
| **21 — Lost late compensation** | **FIXED** | Actual in-flight authorization fixtures retained `auth_id`, `status: releasing` and `plan_op: void`. Both roles displayed pending release; owner recovery was reachable before checkout and after settlement. |
| **24 — Truthful pending states / late swap** | **FIXED** | I completed a **¥900** provider-stub capture, then failed its local outcome UPDATE. Owner and friend home cards showed **“¥900 charge pending”**, not the original **¥1,600 held**. The friend's Other trips rail used the same truthful amount. Detail retained confirmation-pending wording. The executed late-swap case rejected the answer and preserved its saved void. |
| **27 — Late void stranded by logging failure** | **FIXED** | The executed event-write-failure case retained the step and reopened the trip atomically, then recovered. My stale-terminal browser fixture also exposed Retry, released the authorization and finished `settled`. |
| **28 — Outstanding authorization selectors** | **FIXED** | My actual `releasing` authorization counted toward exposure: a new **¥7,100** hold was refused with the $50-limit error. Owner detail separated the pending-release row from clean held money: **¥0 held** for a release-only trip, **¥1,600 held** when one legitimate hold remained. Home named the release-pending amount rather than asserting it was definitely held. |
| **32 — Withdrawal compensation stranded before shopping** | **FIXED** | Recreated the one-ask withdrawal during authorization with failed void. Owner saw the pending row and enabled Retry; friend saw withdrawal/release-pending copy with no inappropriate action. Clicking Retry released it and kept `holds`; owner then saw **“No holds yet.”** |
| **33 — Completion overwrites a newly saved void** | **FIXED** | Current test 21 left **`settling / releasing`**. Replacing only completion with the old implementation reproduced **`settled / releasing`**. The new conditional UPDATE checks outstanding work in the same statement. |
| **34 — Withdrawal described as late shopping approval** | **FIXED** | Pending withdrawal detail now says **“Ask withdrawn. Releasing your hold.”**, omits the shopping-started sentence, and its home badge says **“Releasing…”**. Completed-withdrawal presentation still has a separate non-blocking defect: **36**. |

## Phase-independent retry: additional race results

All five interleavings used deterministic barriers around actual trip functions/database calls and provider stubs.

1. **Retry's void in flight while checkout runs:** checkout captured the unrelated found item for **¥900**, released the saved void, and settled. Resuming the earlier retry did not change the charge or payment plan. There was one capture invocation; overlapping retries could invoke the same void more than once. This is not proof of real-provider idempotency.
2. **Checkout completes before retry's saved-step SELECT:** retry returned an empty result after confirmed checkout. The trip stayed settled and the single ¥900 capture was unchanged.
3. **Retry starts in `holds`, another tab starts shopping:** after the void completed, the trip remained `shopping`; the legitimate held item retained a null plan and was not charged.
4. **Retry finishes known work while another authorization is still in flight:** the trip settled, the later failed compensation atomically reopened it to `settling`, and a subsequent retry released that authorization and settled again.
5. **Retry before an in-flight authorization has attached any saved step:** the early call returned “Nothing to retry.” The later authorization still created durable compensation; subsequent retry released it while preserving `holds`.

For a `holds` trip containing **only** an unresolved release, direct Start shopping correctly returned **“No approved holds yet”**; setting another day returned **“Accept at least one request first.”** Neither should be enabled merely to escape recovery. Retry was available, and the friend had no Hold/Withdraw/Swap action. The defect is the different case where another legitimate held/found request exists.

## Blocking finding

### 35. MAJOR — Recovery replaces, rather than accompanies, legitimate shopping actions

**Where:** `app/public/js/screens/trip.js:249–253`, overwriting the phase-specific action computed immediately above.

**Evidence:** I created two requests through real trip functions:

- A has an approved **¥1,600** hold.
- B is withdrawn while authorization is in flight; its **¥600** compensating void keeps failing.

While the trip was still in `holds`, Chrome rendered B's pending group and A's valid Held row, but **the only action was Retry PayPal**. There was **no `[data-shop]` control**, not even a disabled one. Clicking Retry and letting B's void fail again did not restore Start shopping. Calling `startShopping()` directly succeeded, confirming that this restriction comes from the renderer rather than the financial rules.

I then marked A Found. At **320, 390, 768 and 1440 px**, the Found group remained visible, but **Pay & scan receipt disappeared entirely**: zero `[data-receipt]` controls, one Retry button. The traveller cannot finish buying A's item through the UI while unrelated B's release remains unconfirmed.

Calling the existing settlement function with A's reviewed receipt plan produced:

```text
A: charged ¥900
B: releasing, plan_op = void, provider error retained
trip: settling
```

The backend already supports completing legitimate purchases while retaining B's unresolved release. The new blanket `action = Retry` prevents the user from reaching it. This is a regression from the previous phase-specific action rendering, not a request to weaken the no-hold safeguard.

**Exact fix:** Preserve the normal phase action in `holds` and `shopping`, with its existing eligibility checks, and render Retry as an additional recovery action. Keep the pending group prominent. A release-only trip must still be unable to start shopping; a trip with a valid held item must retain Start shopping, and a trip with an eligible found item must retain receipt checkout. Do not change saved plans, revision checks or atomic completion.

**Required regression test:** With one valid held/found request and another failing saved void, fail Retry repeatedly and verify that Start shopping and then receipt checkout remain reachable at phone, tablet and desktop widths. Checkout must capture only the reviewed amount, retain the failed void and leave the trip `settling` until that void succeeds.

## MINOR — non-blocking

### 36. Completed withdrawal loses its meaning while the trip remains in `holds`

**Where:** `app/public/js/app.js:53–62`; `app/public/js/screens/trip.js:39,84,106`.

**Evidence:** In a separate one-ask fixture, I paused authorization, withdrew the ask and then let compensation succeed. Actual final state was:

```text
trip.status = holds
request.status = released
plan_why = withdrawn while PayPal was approving
```

Chrome showed:

- Friend home badge: **“Asked”**, despite the completed withdrawal/release.
- Friend detail: **“Not found. Nothing paid.”**, although this was withdrawal, not an unsuccessful shopping search.
- Timeline: **“Dina shopping · Mon” marked complete**, although the trip never entered shopping. `stageOf()` treats the saved void as stage 3, and the timeline interprets that as proof of shopping.

The released amount itself was correct and no inappropriate money action was offered, so this does not block shipping.

**Exact fix:** Handle an all-released friend summary before the trip-phase fallback, without masking other active asks. Reuse the saved withdrawal reason in the `released` detail branch: **“Ask withdrawn. Hold released.”** Do not mark shopping complete solely because a pre-shopping withdrawal has a payment plan. Add the release-success continuation to the withdrawal UI test, not just its pending state.

## Non-blocking 10x proposal

**Proposed; no numerical multiplier established:** Extend the recovery matrix to assert **both** recovery reachability **and preservation of unrelated eligible actions**. The previous reachability-only bar now passes, yet the replacement action in finding 35 disables ordinary checkout. The smallest addition is a two-request fixture across `holds` and `shopping`, asserting the allowed action set before and after failed retry. Measure lost eligible actions across those states; the target is zero.

VERDICT: FIX FIRST
