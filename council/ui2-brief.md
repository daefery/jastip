# Council round 2 · Jastip app UI · re-review

You reviewed this app in round 1. Your findings are in `/home/feryyp/code/hackathon/paypal/jastip/council/ui1-astra.md` (read it first). The original brief is `council/ui1-brief.md` (same app, same paths, same servers: http://localhost:5181 test mode with `DEMO_SWITCH=1`, http://localhost:5180 real sandbox).

Fixes are in commit `HEAD` of `/home/feryyp/code/hackathon/paypal/jastip` (`git show HEAD`). The builder's claimed fix per finding:

1. All not found → new `POST /api/trips/:tid/finish` voids every hold, no receipt (`lib/trips.mjs` `finishEmpty`); UI shows "Finish trip · release ¥…".
2. Failed capture/void → trip stays `settling` (not `settled`); UI shows "N payments didn't go through" + "Retry failed payments" (`POST /api/trips/:tid/retry`), retry only touches unresolved items; a settled trip refuses another settle (409).
3. `view()` returns 404 unless owner or a friend with a request; full receipt only for the owner.
4. Cookie is now an opaque random session token (`sessions` table), not the user id. `/api/switch` only works with `DEMO_SWITCH=1` and only to someone who shares a trip with you.
5. "Your other asks" picker visible below 1100 px (`.pick-asks`).
6. New asks during `holds` show Accept/Decline; starting shopping needs ≥1 approved hold.
7. Never-held asks become `dropped` ("Not included in shopping. Nothing was held or charged."), not `released`.
8. Shopping rows: title wraps to 2 lines, friend name on its own line, "max ¥… · detail · rule" never truncated; scene shorter while shopping on phones.
9. Long unbroken text wraps (`overflow-wrap:anywhere`, `minmax(0,1fr)`).
10. Receipt sheet: real button "Take or choose photo" opens the file input; sheets trap Tab, make the page `inert`, restore focus.
11. Route change closes every sheet (`closeAllSheets` in `route()`).
12. Profile button handler delegated from `document`.
13. Withdraw offered while accepted, before the hold.
14. Handover sheet shows a real QR (vendored MIT `qrcode-generator`, `public/js/vendor/qrcode.js`) of the trip URL, plus who still has to confirm.
15. Server rejects negative/non-number fee and malformed PayPal email (400).

New tests: `app/test/edges.mjs` (15 checks, in-memory DB with a PayPal stub that fails on demand), `app/test/ui-edges.mjs` (16 browser checks for findings 1,3,4,5,6,7,9,10,11,12,13). Claimed results: edges 15/15, ui-edges 16/16, rules 9/9, e2e on real sandbox 29/29, ui-flow 32 shots 0 errors at 320, 360, 390, 768, 1024, 1440, 1920.

## What to do
1. For each round-1 finding, verify the fix yourself (reproduce your original steps). Mark each **FIXED**, **PARTIAL** (say what is left), or **NOT FIXED**.
2. Look for regressions and new defects the fixes introduced (e.g. sessions vs. the PayPal return redirect, the `inert` page, D1 migrations `migrations/0003_settling.sql` and `0004_sessions.sql` vs. `lib/db.mjs` schema, the worker path in `worker.mjs`).
3. New findings use the same format: severity, where, evidence, exact fix.
4. End with `VERDICT: SHIP` or `VERDICT: FIX FIRST`.

Do not edit files in `app/`. Write only your answer file.
