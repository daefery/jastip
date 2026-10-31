# Council round 6 · Jastip app · re-review

Read your round-5 answer first: `/home/feryyp/code/hackathon/paypal/jastip/council/ui5-astra.md` (earlier rounds `ui1`–`ui4`; paths/servers in `ui1-brief.md`; :5181 test mode + `DEMO_SWITCH=1`, DB `/tmp/jastip-fake-5181.db`; :5180 real sandbox; both restarted on the new code).

Fixes are in `HEAD` of `/home/feryyp/code/hackathon/paypal/jastip` (`git show HEAD`). Builder's claims:

- **#33:** completion is one statement: `UPDATE trips SET status='settled' WHERE id=? AND status='settling' AND NOT EXISTS (SELECT 1 FROM requests WHERE trip_id=? AND status IN OUTSTANDING)` (`completeIfDone`). New edge test 21 pauses the finishing call at that statement, lets a late approval save its void (void fails), then resumes: trip stays `settling`. Verified: the same test FAILS against the old count-then-update code ("settled releasing") and PASSES now.
- **#32:** `retry()` is driven by open saved steps, not phase: allowed in `holds`/`shopping`/`settled`/`settling`; only a `settled` trip is reopened; `holds`/`shopping` keep their phase. The "no saved step" refusal applies only while `settling`. Owner screen: any open saved step in any phase puts a "PayPal not confirmed" group first and a "Retry PayPal" action; KPI "held for you" excludes pending steps; holds heading says "No holds yet" instead of "0 of 0". Edge test 20 + browser test (state written into the test DB) cover the one-ask withdrawal/failed-void journey: Retry visible in `holds`, release succeeds, trip stays `holds`.
- **#24 remaining:** summary gives `heldClean` (no pending step), `pendingCharge`, `pendingRelease`. One `moneyLine()` (in `app.js`) is used by home cards and the friend's "Other trips" rail: pending shows "¥388 charge pending" / "¥X release pending", never "held". Browser test checks the friend home for an unconfirmed capture.
- **#34:** friend copy uses `plan_why`: "Ask withdrawn. Releasing your hold." (no shopping sentence); home badge "Releasing…" when only voids are pending, "Paying…" when a charge is.

Tests (claimed): `edges.mjs` 44/44, `ui-edges.mjs` 28/28, `rules.mjs` 9/9, real-sandbox `e2e.mjs` 29/29, ui-flow 32 shots × 7 sizes 0 errors, migrations 0001–0007 = `SCHEMA`.

## What to do
1. Verify each open item (2, 18, 21, 24, 27, 28, 32, 33, 34): **FIXED / PARTIAL / NOT FIXED**, with your own reproduction.
2. Hunt regressions from phase-independent retry (e.g. retry in `shopping` racing with checkout; retry while a late approval is mid-flight; a `holds` trip whose only open item is `releasing`: can the owner still start shopping or pick a day; does the friend still see sensible actions).
3. New findings: severity, where, evidence, exact fix. Keep MINOR separate; only BLOCKER/MAJOR block.
4. End with `VERDICT: SHIP` or `VERDICT: FIX FIRST`.

Do not edit files in `app/`. Write only your answer file.
