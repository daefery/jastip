# Council round 3 · Jastip app · re-review

Read your round-2 answer first: `/home/feryyp/code/hackathon/paypal/jastip/council/ui2-astra.md` (and round 1 `ui1-astra.md`, brief `ui1-brief.md` for paths and servers: :5181 test mode with `DEMO_SWITCH=1`, :5180 real sandbox; both restarted on the new code).

Fixes are in `HEAD` of `/home/feryyp/code/hackathon/paypal/jastip` (`git show HEAD`). Builder's claims:

- **#16 + #2 (retry changes the decision):** settlement now has two steps. `settle()` first locks the trip (`UPDATE … status='settling' WHERE status='shopping'`, so a double tap can't save two plans), saves the confirmed decision on each request (`plan_op` capture|void, `plan_charge`, `plan_why`, line text/price), then `runPlan()` runs the saved steps. `retry()` only re-runs saved steps still open. Planning never happens again. Migration `0005_plan.sql`.
- **#1 (receipt-free retry):** `finishEmpty` goes through the same `settle()` path, so `/retry` works without a receipt. UI checks `results[].error` before any success toast.
- **#17:** failed-state count and rows include `held` and `swap_asked`; rows show the saved step ("to charge ¥X" or "release ¥Y").
- **#18:** `finishHold` only authorizes an `accepted` ask while the trip is `holds`. After authorizing it re-checks; if it lost the race with "start shopping" it voids the fresh authorization and marks the ask `dropped`. The PayPal return shows the reason.
- **#11:** global `store.route` counter; `tripView` and its `reload` paint only if their route still owns the page; reload errors become a toast.
- **#13:** withdraw confirms, deletes and goes home without reloading the old trip.
- **#6:** Start shopping lists the asks that will be left out and asks for confirmation.
- **#7:** home card for a friend with only never-held asks says "Not included" (summary has `out` and `released` counts).
- **#15:** fee checked before rounding (`feeOf` in `lib/api.mjs`); form shows persistent field errors with `aria-invalid` and keeps the input.
- **#8 nit:** `.jr b.wrap2` now really clamps to 2 lines.

Tests (claimed): `test/edges.mjs` 24/24 (now with void failures, duplicate line, unmarked item at checkout, late return during/after shopping, concurrent settle), `test/ui-edges.mjs` 22/22, `test/rules.mjs` 9/9, real-sandbox `test/e2e.mjs` 29/29, ui-flow 32 shots × 7 sizes with 0 errors. Migrations 0001–0005 produce the same columns as `SCHEMA` (checked in memory).

## What to do
1. Verify each open item from round 2 (1, 2, 6, 7, 11, 13, 15, 16, 17, 18): **FIXED / PARTIAL / NOT FIXED**, with your own reproduction.
2. Hunt regressions from the two-step settlement (e.g. a capture that PayPal completed but the DB write failed; `swap_asked` at checkout; the friend view of `settling`; customs/summary numbers while settling; `plan_*` fields leaking to friends).
3. New findings: severity, where, evidence, exact fix. Only BLOCKER/MAJOR block.
4. End with `VERDICT: SHIP` or `VERDICT: FIX FIRST`.

Do not edit files in `app/`. Write only your answer file.
