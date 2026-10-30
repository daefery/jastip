# Independent UI re-review · round 2

## Verification and scope

Reviewed implementation commit `91c1786`. During review, HEAD advanced to `c157c07`; its only change was `app/README.md`, which I also read. Application code under test did not change.

The acceptance bar was: truthful financial states; recoverable capture **and void** failures; unchanged payment decisions on retry; participant-only access; usable item navigation, shopping details and keyboard dialogs; and navigation that cancels obsolete UI work.

I independently ran:

- `node --no-warnings app/test/edges.mjs`: **15/15 passed**.
- `node --no-warnings app/test/rules.mjs`: **9/9 passed**.
- `node app/test/ui-edges.mjs`: **16/16 passed**.
- Additional Chrome/Playwright probes against **:5181**, confirmed as fake PayPal with `DEMO_SWITCH=1`. These covered 12 requests, 60-character unbroken titles, actual item selection at 699/700/768/1024/1100 px, shopping details at 320/390/768/1440 px, late asks, withdrawal, keyboard file selection, focus restoration, navigation during settlement, and terminal-state copy.
- In-memory real trip/API functions with injected provider failures, including failed voids and duplicate receipt matches. Browser failure-state probes used controlled responses representing those independently reproduced server states; they were not real PayPal failures.
- All four D1 migration SQL files against an in-memory SQLite database, comparing column definitions with `SCHEMA`: all six tables matched. The actual Worker entry passed user/session/trip creation, disabled-switch and asset-fallback probes using a D1-compatible SQLite test binding. This was **not** a deployed Cloudflare execution.
- Supplied shopping screenshots at 390/768 px and settlement at 1440 px; source inspection of the changed modules and named tests. An independent `jsQR` decoder decoded the generated QR SVG to the exact intended trip URL; the decoder ran in memory without adding an application dependency.

One combined exploratory browser run timed out awaiting a file chooser. A focused rerun confirmed Enter opens the chooser and successfully selected the real sample image; forward/reverse Tab and focus restoration also passed. The withdrawal probe separately exposed the unhandled error documented below.

I did **not** rerun the claimed real-sandbox 29/29 or complete seven-width 32-shot suite. Real provider failure/reconciliation, deployed D1 behavior, Safari/iOS, screen readers, camera hardware and physical-device QR scanning remain unverified. I did not edit application files or overwrite screenshots.

## Round-1 findings

### 1. All items missing — **PARTIAL**

**Remaining severity: BLOCKER.**

- **Verified:** The normal all-missing UI now offers Finish, confirms the action, releases the authorization and completes without a receipt. The existing browser test passed independently.
- **Where:** `app/lib/api.mjs:106–113`; `app/lib/trips.mjs:206–219`; `app/public/js/screens/trip.js:291`.
- **Evidence:** With the actual API and a stubbed PayPal 503 on void, `/finish` returned 200 with an item error. The trip correctly became `settling`, but `receipt_id` was null. Its advertised `/retry` then returned **409, “Nothing to retry.”** In the browser, the matching failure response produced **“All holds released”** while the page said **“2 payments didn't go through.”** The finish handler ignores `results[].error`.
- **Exact fix:** Support retrying a receipt-free release operation, retaining its unresolved voids. Inspect finish results before showing success; reload the durable failure state without claiming release. Test one successful and one failed void, then successful retry without repeating the completed void.

### 2. Failed payments and retry — **PARTIAL**

**Remaining severity: BLOCKER.**

- **Verified:** A thrown capture error leaves the trip `settling`; the simple distinct-line retry captures only the unresolved item, and a subsequent settlement on a settled trip is rejected. These checks passed against the implementation.
- **Remaining:** Retry can change an intended **void into a charge** when a receipt line was already used; some failed voids disappear from the error list. See new findings **16–17**, with independent reproductions and fixes. Receipt-free retry is also broken as described in finding 1.
- **Coverage gap:** `app/test/edges.mjs` makes capture fail on demand, but its `voidHold` always succeeds. Passing 15/15 therefore does not verify the claimed void-failure recovery.

### 3. Receipt privacy — **FIXED**

`app/lib/trips.mjs`, `canSee()`/`view()`: outsider trip access returned 404; a participating friend's receipt was null; the owner retained receipt access. The independent browser and in-memory tests both passed. Friend request filtering remains in place.

### 4. Identity switching and public-ID cookies — **FIXED**

`app/lib/api.mjs:21–44`: a public user ID supplied as `jt_sid` resolved to no user. With demo switching disabled, `/api/switch` returned 404; an unrelated user was also refused in demo mode. Worker session creation returned an opaque token with HttpOnly, SameSite=Lax and Secure on HTTPS. Two fake-PayPal return journeys preserved the existing friend's session and showed the authorized requests.

This verifies the explicit demo boundary, not production authentication. Both running local servers advertise `demoSwitch: true`; keep that intentional impersonation mode off on publicly accessible non-demo deployments. Real account recovery is not implemented, as the README acknowledges.

### 5. Tablet multi-item navigation — **FIXED**

`app/public/js/screens/trip.js:110–119`; `.pick-asks` in `app/public/css/app.css`: I actually selected the second item and returned to the first at **699, 700, 768, 1024 and 1100 px**. The displayed item changed correctly. This verifies navigation, not just link counts.

### 6. Late asks during holds — **PARTIAL**

**Remaining severity: MAJOR.**

- **Verified:** New asks now have visible Accept/Decline controls during holds, and shopping with zero approved holds is refused.
- **Where:** `app/public/js/screens/trip.js:205–210,287`; `app/lib/trips.mjs:127–132`.
- **Evidence:** With two held requests and ten unresolved asks, clicking Start shopping produced **zero confirmation dialogs** and immediately changed all ten asks to `dropped`. The original requirement to make leaving unresolved asks behind an explicit decision is still absent.
- **Exact fix:** Before starting with outstanding asks/unapproved acceptances, show the excluded items/count and require confirmation, or require resolving them first. Preserve the existing ability to accept late asks and the zero-hold guard.

### 7. Fictitious release for never-held requests — **PARTIAL**

**Remaining severity: MAJOR.**

- **Verified:** Stored status is now `dropped`; the detail page correctly says nothing was held or charged and does not invent a released amount.
- **Where:** `app/public/js/app.js:51–55`; `app/lib/trips.mjs`, `summary()`.
- **Evidence:** I completed a trip where a separate friend's sole request was never authorized. Their home card said **“Released”**; opening it said **“Not included in shopping.”** `friendStatus()` treats every settled trip with zero charges as released, without checking whether any authorization was voided.
- **Exact fix:** Include dropped/released distinctions in the friend summary and derive the card label from actual outcomes. A dropped-only friend should see “Not included,” not “Released.” Test home and detail together.

### 8. Hidden shopping information — **FIXED**

`app/public/js/screens/trip.js:232`; shopping-row CSS: max price and variant were readable without horizontal overflow at **320, 390, 768 and 1440 px**. Titles wrap; More exposes the complete title. The phone shopping scene measured **152 px** high at 844 px viewport height.

The builder's literal “2 lines” claim is not accurate: my 60-character title occupied 120 px because `.jr b` overrides the generic `.wrap2` display declaration. This is non-blocking here: the original information-loss defect is repaired, and further compaction must retain access to the full title.

### 9. Long-text reflow — **FIXED**

With **12 requests** and a **60-character unbroken title**, the friend page at 320 px had **scrollWidth 320**, rather than the previous 734. Eleven other-item links were present; selecting between requests also passed at the widths listed in finding 5. The changed text tracks and wrapping address the reproduced defect.

### 10. Receipt keyboard access and focus — **FIXED**

`app/public/js/screens/receipt.js:10,55`; `app/public/js/ui.js:51–92`: Enter on the real photo button opened the file chooser. Selecting `app/public/sample/receipt.png` reached the receipt-upload path; I intercepted its response to avoid saving a receipt. Forward and reverse Tab stayed within the sheet. Escape removed the sheet, cleared background inertness and restored focus to the connected receipt opener.

### 11. Route-owned dialogs — **PARTIAL**

**Remaining severity: MAJOR.**

- **Verified:** Ordinary browser Back closes the sheet and clears `inert`.
- **Where:** `app/public/js/screens/receipt.js:48–50`; `app/public/js/screens/trip.js:12–19`; `app/public/js/app.js:104–116`.
- **Evidence:** I delayed the settlement response, navigated to `#/`, and observed **Trips** with no sheet. When the response completed, the obsolete `done()` callback rendered the old trip again: URL remained **`#/`**, but the page said **“¥900 paid to you.”** Closing sheets does not invalidate their pending callbacks. The trip token changes only when another trip render starts, not on every route departure.
- **Exact fix:** Invalidate route/render ownership on every navigation. Let an in-flight financial operation finish, but suppress its obsolete reload, focus and navigation callbacks. Before rendering any async result, verify the originating route token still owns the page. Add this delayed-response journey alongside the existing Back test.

### 12. Profile after rerender — **FIXED**

`app/public/js/app.js:120`: I clicked Accept in the live UI, waited for its actual rerender, then opened the avatar menu successfully. Delegating from `document` survives replacement of the profile element.

### 13. Withdrawal before authorization — **PARTIAL**

**Remaining severity: MINOR, non-blocking.**

- **Verified:** The accepted request now exposes Withdraw and the action deletes it successfully.
- **Where:** `app/public/js/screens/trip.js:122–123`.
- **Evidence:** Withdrawing the friend's only accepted request returned to Trips, but emitted an unhandled browser error **“Trip not found.”** The shared action helper calls `reload()` after the handler has navigated home; the new privacy guard correctly denies the now-nonparticipant's obsolete trip fetch.
- **Exact fix:** Do not reload the old trip after successful withdrawal/navigation. Await and handle reload promises for actions that remain on the same route.

### 14. Handover QR — **FIXED**

`app/public/js/screens/trip.js:297–303`; `app/public/js/ui.js:100–103`: the handover sheet uses the actual QR encoder and lists outstanding confirmations. Independent decoding of its SVG-generation path returned **exactly** `http://localhost:5181/#/trip/qr-review`, the supplied input. The friend renderer prefers an eligible settled request when there is no explicit request ID. Physical scanning and cross-device account recovery were not tested.

### 15. Invalid payment setup — **PARTIAL**

**Remaining severity: MAJOR.**

- **Verified:** Fee −5 and malformed email are rejected rather than saved; the original invalid browser inputs remained in the form.
- **Where:** `app/lib/api.mjs:52`; `app/lib/trips.mjs:41`; `app/public/js/screens/new.js:9,32–35`.
- **Evidence:** A JPY trip submitted with **fee −0.1** still returned **200** and saved **fee 0**. Conversion rounds before the negative-value guard runs. In the form, the validation error disappeared after the toast timeout; `novalidate` remained enabled and there were no fields marked `aria-invalid`.
- **Exact fix:** Validate the raw numeric fee as finite and nonnegative **before** minor-unit conversion. Restore native validation or provide persistent, field-associated accessible errors while preserving input. Test negative fractional fees as well as −5, nonnumeric values and invalid email.

## New findings

### 16. BLOCKER — Retry changes a rejected duplicate match into a second charge

- **Where:** `app/lib/trips.mjs:163–176`; `app/lib/api.mjs:107–113`.
- **Evidence:** In an in-memory test, two found requests matched the same ¥800 receipt line. The initial plan charged the first **¥900** including the fee and planned to void the second with reason **“line already used.”** I made that void fail. Retry rebuilt the plan using only unresolved requests and an empty `used` set: it now charged the second **¥900** against the same line. The first payment remained settled. This is a changed payment decision, not a duplicate HTTP call; per-authorization idempotency keys do not prevent it.
- **Exact fix:** Persist the confirmed settlement plan, including each request's capture/void decision, amount and stable receipt-line identity. Retry those exact unresolved operations instead of reallocating receipt lines. Preserve line ownership across completed and unresolved requests. Add the duplicate-match/failed-void reproduction and assert that retry only voids the second request.

### 17. BLOCKER — A failed void of a still-looking item vanishes from recovery UI

- **Where:** `app/public/js/screens/trip.js:213–216,224,245–247`; `app/lib/trips.mjs:166–171`.
- **Evidence:** Checkout is enabled when at least one item is found and no swap is pending; another item can remain `held`. I captured the found item and injected a void failure for the held item. The server correctly remained `settling`, with the unresolved request still `held`. Rendering that result showed **“0 payment didn't go through”** and only the successfully charged item in the job list. Both failure selectors omit `held` (and `swap_asked`), although settlement plans include them.
- **Exact fix:** Derive the failure count and rows from unresolved payment operations, consistently with the server. At minimum include every authorized unresolved request status handled by settlement, not just found/swapped/not_found. Show its actual unresolved amount and intended operation. Test this permitted checkout path and subsequent retry.

### 18. BLOCKER — A late PayPal return reopens a hold on a finished trip

- **Where:** `app/lib/trips.mjs:116–132,213–219`; `app/lib/api.mjs:122–127`.
- **Evidence:** Against :5181, I authorized item A and opened—but did not complete—item B's approval. Starting shopping dropped B. Marking A not found and finishing settled the trip. Following B's previously issued return URL then changed B from **`dropped` to `held`, ¥1,100**, while the trip stayed **`settled`**. Both `/finish` and `/retry` returned 409. The new terminal flow therefore can acquire an authorization with no release control. This was a fake-provider reproduction, not a claim about a real sandbox charge.
- **Exact fix:** Guard authorization finalization against current request and trip state. Do not resurrect dropped, declined or terminal requests. Recheck around the provider operation; if an authorization completes after eligibility disappears, record and safely void/reconcile it rather than attaching an unrecoverable hold to a settled trip. Test delayed returns during shopping and after finishing, plus repeated returns for already-resolved requests.

## Highest-value next changes

1. **Proposed:** Make recovery deterministic: retain the confirmed payment plan, retry receipt-free voids, and show every unresolved operation. Findings 1, 16 and 17 currently undermine the exact-charge demonstration.
2. **Proposed:** Close state-transition races: late authorization must not resurrect excluded items, and completed async work must not repaint a departed route. Findings 11 and 18 are reproducible without unusual input.
3. **Proposed:** Make exceptional-state language consistent across list, detail, confirmation and toast. Remove the contradictory release claims and explicitly confirm excluded late asks before shopping.

**10x note — non-blocking proposal, no multiplier claimed:** Extend the newly added edge tests into a failure-position/transition matrix rather than treating capture failure as representative of every provider failure. Start with capture versus void × first versus later item, then delayed return and navigation during settlement. The existing `voidHold` stub cannot fail, while the independent failed-void probes exposed both a dead end and a changed charge. Target: each confirmed operation retains the same verb and amount across retries, and every unresolved authorization has a visible recovery path. No numerical 10× improvement has been measured.

VERDICT: FIX FIRST
