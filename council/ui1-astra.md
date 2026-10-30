# Independent UI review · round 1

## Verification

I read the brief, approved prototype entry, UI modules/CSS, API, trip rules, PayPal/AI adapters, and named tests. I opened seven supplied screenshots across 390, 768 and 1440 px, including shopping, receipt review and settlement.

I ran Chrome against **:5181**, verified `paypalTest: true`, and replayed the four-person UI journey at **390×844** with real AI and fake PayPal. All **32 checkpoints** completed with zero errors/problems under the existing test's assertions. I disabled screenshot/directory writes in an in-memory copy of the test; I did not change the test or overwrite supplied images. Those assertions do **not** establish that the exceptional journeys below work.

Additional independent probes covered 320×568, 768×1024, two items per friend, 12 requests, long names, invalid inputs, double-clicking trip creation, reloads, browser Back, keyboard navigation, late asks, all items missing, and cross-person access. I also injected a PayPal network failure into the real settlement function using an **in-memory database**, with outbound fetch disabled. No app source files were edited.

Not verified: the claimed 29/29 real-sandbox result, actual payment-provider failures, real camera hardware, Safari/iOS, screen readers or physical-device usability. Desktop visual review used the supplied screenshots, not a new complete desktop replay.

## Findings

1. **BLOCKER — An entirely unsuccessful shopping trip cannot release its holds.**
   - **Where:** `app/public/js/screens/trip.js:205–210`; `app/public/js/screens/receipt.js:5–12`.
   - **Evidence:** I approved two holds, started shopping, then marked both items “Not here.” The screen said **“All done. Pay at the till, then scan the receipt.”** Its only primary action was disabled. Requests remained `not_found`, with **¥1,300 + ¥1,400** held. There was no release action, and no purchase receipt should be necessary when nothing was bought.
   - **Exact fix:** When every shopping item is resolved and none is found, offer **“Finish trip · release ¥2,700”** with confirmation. Add an owner-only, idempotent server operation that voids those actual authorizations, charges nothing, and finishes only after successful voids. Do not require a receipt or tell the traveller to pay.

2. **BLOCKER — A failed payment still finishes the trip and removes recovery controls.**
   - **Where:** `app/lib/trips.mjs:175–203`; `app/public/js/screens/trip.js:211–215,231–233`; `app/public/js/screens/receipt.js:45–50`.
   - **Evidence:** In the isolated failure test, capture returned an error; the request remained **`found`, hold 1600**, but the trip became **`settled`**. The settled UI branch only lists paid/released requests and says unused holds were released. It offers no retry-payment action. The brief error toast cannot repair that contradiction.
   - **Exact fix:** Keep an explicit incomplete-settlement state while any capture/void is unresolved. Render every failed item, its still-held amount, and **“Retry failed payments.”** Retry only unresolved operations with existing idempotency keys; show final success/release copy only after all results are confirmed.

3. **BLOCKER — A nonparticipant can retrieve the entire receipt.**
   - **Where:** `app/lib/api.mjs:38`; `app/lib/trips.mjs:219–236`.
   - **Evidence:** After my complete flow, a newly created stranger with no requests fetched `/api/trips/4fshPICios`. Response: **200**, `requests: []`, but the full receipt remained: shop, **¥2,959 total**, all five purchased lines, prices and other friends' request-to-line matches. Request filtering does not protect the receipt.
   - **Exact fix:** Reject trip-detail access unless the viewer owns or participates in the trip. For participating friends, return only their own settlement evidence; keep the complete receipt and cross-person matches owner-only. Test both outsiders and another legitimate friend.

4. **BLOCKER — Demo identity switching bypasses the money-operation authorization boundary.**
   - **Where:** `app/lib/api.mjs:12,19,29`; `app/public/js/app.js:90–101`.
   - **Evidence:** My other-person request to decide the owner's item correctly returned **403**. Calling `/api/switch` with the owner ID exposed by the trip view returned **200** and changed that same session to the owner; the next trip view reported `mine: true`. Source inspection confirms no server-side test-mode restriction. The session cookie also uses the public user ID directly.
   - **Exact fix:** Keep switching only behind an explicit server-controlled local/demo boundary, never as a general sandbox/payment-app endpoint. Outside that boundary, authenticate with opaque server-side sessions or verified signed sessions, not a public user ID. Preserve the local demonstration feature without exposing it as the authorization model.

5. **BLOCKER — Tablet users cannot select their other item.**
   - **Where:** `app/public/js/screens/trip.js:106–114`; `app/public/css/app.css:185` and the 1100 px rail breakpoint.
   - **Evidence:** At **768×1024**, Citra had two requests but **zero visible `/r/` links**. “Your other asks” is inside `.in-aside`, hidden from 700 px; the alternative rail appears only at 1100 px. After settlement, the default item showed **¥1,068 paid**, with no visible way to inspect the released patches. Automatic selection after approval is not a substitute for navigation.
   - **Exact fix:** Give item navigation its own responsive class. Keep an accessible item selector/list visible below 1100 px; hide it only when the equivalent rail is visible. Replay selecting each of two items at 699, 700, 768, 1024 and 1100 px.

6. **BLOCKER — New asks submitted during the holds phase have no traveller acceptance path.**
   - **Where:** `app/public/js/screens/join.js:14`; `app/lib/trips.mjs:50–52,125–128`; `app/public/js/screens/trip.js:201–204,224–225`.
   - **Evidence:** After two holds were approved, another friend successfully submitted “Late KitKat.” The owner still saw **“2 holds in. Go shopping!”** and had **zero acceptance controls** for the new ask. Starting shopping changed that request straight from `asked` to `released`.
   - **Exact fix:** Since the current contract allows asks during `holds`, render a “New asks” group with accept/decline controls in that phase too. Include unresolved asks in the shopping-start summary and require an explicit decision about leaving them behind. Do not silently accept submissions that cannot progress.

7. **BLOCKER — The UI reports a released hold that never existed.**
   - **Where:** `app/lib/trips.mjs:128`; `app/public/js/screens/trip.js:43,69,86–91`.
   - **Evidence:** The late friend above never approved PayPal. The stored request had `hold: null`, yet their screen said **“Your ¥600 hold was released.”** This comes from treating an unapproved request as `released` and substituting `hold_needed` for actual held money.
   - **Exact fix:** Separate “not purchased / no authorization” from “authorization voided.” Use actual authorization/hold/release fields for financial history, never the proposed hold. This case should say **“Not included in shopping. Nothing was held or charged.”** Do not advance it through fictitious paid/released progress.

8. **MAJOR — The shopping list hides the information needed to buy the right item.**
   - **Where:** `app/public/css/app.css:153–156`; `app/public/js/screens/trip.js:218,312–323`; `app/shots/flow-390/17-shopping.png`; `app/shots/flow-768/17-shopping.png`.
   - **Evidence:** At 390 px, my Hada Labo title needed **440 px** but received **112 px**. The friend/max/variant text needed **308 px** but received **89 px**. Both were ellipsized. The supplied screenshots reproduce this with ordinary names, including truncated max prices. The More sheet shows a title and actions, but not a complete original variant/max-price detail block.
   - **Exact fix:** Put the full max price in a nontruncated position, allow product titles to wrap, and provide a tappable item-detail sheet containing full title, variant, friend, source and cap. Place Found/More on a separate action row when needed. Compact the decorative scene during shopping so usable item details, not artwork, get the scarce vertical space.

9. **MAJOR — Allowed long item text breaks 320 px reflow.**
   - **Where:** `app/public/css/app.css:119–122`; `app/public/js/screens/trip.js:94–106`.
   - **Evidence:** With 12 requests and a permitted 60-character unbroken title, the friend screen at **320 px** had a document width of **734 px**: **414 px horizontal overflow**. Normal shopping rows in a separate 320 px probe had zero overflow; this is a content-dependent failure, not a universal viewport claim.
   - **Exact fix:** Use `minmax(0,1fr)` for item text tracks, `min-width:0` on text containers, and `overflow-wrap:anywhere` for arbitrary user text. On narrow screens, place amount/fee below the title rather than squeezing an unbreakable three-column row. Retest all 12 items and their actions, not only document geometry.

10. **MAJOR — Keyboard users cannot choose their own receipt photo; dialogs do not contain focus.**
    - **Where:** `app/public/js/screens/receipt.js:10–11`; `app/public/js/ui.js:51–76`.
    - **Evidence:** Opening the receipt dialog left focus on the underlying “Pay & scan receipt” button. Tab reached **Cancel → Use sample receipt → outside the dialog**; it never reached “Take photo.” That control is a label with `tabIndex: -1`, attached to a hidden file input. The handover dialog likewise initially left focus behind its scrim.
    - **Exact fix:** Use a real keyboard-operable upload button that activates the file input. Focus a visible dialog control or the dialog heading, not the first hidden input. Trap Tab/Shift+Tab, make the background inert, and restore focus to a connected opener on close. Verify selecting a real file with the keyboard, not just the sample.

11. **MAJOR — Browser Back leaves a stale dialog over a different page.**
    - **Where:** `app/public/js/app.js:104–118`; `app/public/js/ui.js:51–77`.
    - **Evidence:** I opened “Handover code,” pressed browser Back, and reached `#/` with the **Trips** heading while the old handover dialog and scrim remained. In another probe, a previous trip's share sheet intercepted clicks on a different trip's receipt action.
    - **Exact fix:** Give sheets a route-owned lifecycle. Either push a dialog history state so Back closes it first, or close/cancel every open sheet on route change. Guard asynchronous dialog work against navigation and never retain an old trip's actionable sheet over a new route.

12. **MAJOR — The profile/demo-switch button stops working after routine trip updates.**
    - **Where:** `app/public/js/app.js:116`; `app/public/js/screens/trip.js:19` and the render functions.
    - **Evidence:** After clicking Accept all, the avatar button still rendered, but clicking it opened **zero sheets**. `reload()` rerenders `tripView()` directly, replacing the element; the profile listener is attached only by `route()`. This interrupts the advertised one-device demonstration flow.
    - **Exact fix:** Delegate `[data-me]` clicks from the stable app shell, or bind shared shell controls after every render. Test profile opening after acceptance, shopping marks, live refresh and settlement.

13. **MAJOR — Withdrawal disappears before the friend has authorized money.**
    - **Where:** `app/public/js/screens/trip.js:46–51`; `app/lib/trips.mjs:65–72`.
    - **Evidence:** After the traveller accepted my request but before any hold, the friend screen showed the accepted status and **zero withdrawal controls**. The server expressly allows withdrawal in `asked`, `accepted` and `declined`, and the help text says cancellation stops after approval.
    - **Exact fix:** Offer a secondary Withdraw action in every allowed pre-authorization state. Remove it once authorization actually succeeds; keep the server guard authoritative.

14. **MAJOR — “Show handover code” displays a decorative pattern, not a usable QR code.**
    - **Where:** `app/public/js/ui.js:86–99`; `app/public/js/screens/trip.js:279`.
    - **Evidence:** I opened the handover dialog. Source verification shows `qr(seed)` hashes the trip ID into pseudorandom squares; it does not encode a URL or implement QR data/error-correction structure. The dialog's instructions instead tell friends to find and tap “I got my item” themselves.
    - **Exact fix:** Encode a real handover URL using a QR implementation and verify decoding it. Resolve the visitor's own eligible item after authentication. Until that exists, replace this CTA with an honest handover-status/share-link action; do not present the random pattern as an operational code.

15. **MAJOR — Invalid payment setup is silently saved.**
    - **Where:** `app/public/js/screens/new.js:9,32`; `app/lib/api.mjs:31–36`; `app/lib/trips.mjs:44`.
    - **Evidence:** Through the browser I entered fee **−5** and PayPal email **`not-an-email`**, then double-clicked Open trip. The saved trip had **fee 0** and the invalid email unchanged. The form uses `novalidate`; the server silently clamps a negative fee and does not validate the supplied payee email.
    - **Exact fix:** Reject negative/nonfinite fees and malformed nonempty email addresses on the server; show persistent field-specific errors and retain input. Restore native form validation or implement equivalent accessible validation. Preserve the explicitly permitted blank demo email, but never silently change the entered fee.

## Three changes with the greatest design/presentation payoff

1. **Proposed: make receipt-to-money proof the central demonstration.** Keep the existing tracker direction, but show the source receipt alongside each complete match: receipt line, fee, actual charge, unused authorization, and capture/void result. The current phone receipt screen truncates matching text, and failed settlement currently has no durable recovery state. A judge should be able to verify the arithmetic without narration. Distinguish fake/test mode from actual sandbox evidence throughout.

2. **Proposed: build a genuine in-shop mode.** Collapse the hero to a compact status strip once shopping begins. Give product/variant and max price priority; retain thumb-reachable Found, More and checkout actions. On tablet, prioritize the shopping list and item navigation over the activity log. This directly addresses the measured 112 px product-title allocation and missing multi-item navigation.

3. **Proposed: make the exceptional endings demonstration-ready.** Give all-missing, late/unapproved, failed-payment and released-item states truthful headings, money and next actions. Fix sheet/back behavior and the profile switch before recording. Demonstrate one failure and recovery, not only the 32-checkpoint success path; this supports technical credibility and presentation clarity with observable behavior.

**10x note — non-blocking proposal, not a promised multiplier:** Turn the existing UI runner into a state/role/viewport regression matrix. Its successful 32 checkpoints coexist with the reproduced all-missing dead end and tablet item-navigation failure. Start by adding those two journeys at 320, 390, 768 and 1440 px, asserting actual financial states and visible navigation rather than only overflow/action geometry. Target: both journeys pass all four profiles after fixes; no evidence supports claiming a numerical 10× improvement yet.

VERDICT: FIX FIRST
