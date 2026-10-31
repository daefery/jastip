# Council round 5 · Jastip app · re-review

Read your round-4 answer first: `/home/feryyp/code/hackathon/paypal/jastip/council/ui4-astra.md` (earlier rounds `ui1`–`ui3`; paths/servers in `ui1-brief.md`; :5181 test mode + `DEMO_SWITCH=1`, :5180 real sandbox; both restarted on the new code).

Fixes are in `HEAD` of `/home/feryyp/code/hackathon/paypal/jastip` (`git show HEAD`). Builder's claims:

- **#30:** trips have `rev` (migration `0007_rev.sql`). Every mark/swap/swap-answer bumps `rev` in the same `db.batch` as the request change. `/receipt` returns the `rev` it planned from; `/settle` requires it and the lock is `… WHERE status='shopping' AND rev=?`. Mismatch: nothing saved, 409 "The list changed since you checked the receipt", the UI closes the sheet and reloads.
- **#26:** a withdraw with a PayPal order open sets `status='withdrawn'` (row kept, hidden from every view/summary/list/canSee) instead of deleting; without an order it deletes (guarded `order_id IS NULL`). A late authorization for a withdrawn ask is recorded as an open void (`releasing`) and released; if the row is gone entirely, it voids immediately and reports failure honestly.
- **#27:** the late-void step and "reopen a settled trip to settling" are one `db.batch`, done before logging or calling PayPal; logging failure is swallowed only for the log line. `retry()` also reopens a `settled` trip that still has open saved steps. `runPlan` recomputes completion whenever the trip is `settling`.
- **#28:** one shared list `OUTSTANDING` (in `public/js/money.js`, used by server and UI) = held, found, swap_asked, swapped, not_found, releasing. S6 `heldUsd` uses it (with `auth_id IS NOT NULL`); owner KPIs, rail, summary and settling list use it.
- **#24 remaining / #31:** settling wording is "not confirmed" / "charge awaiting PayPal" / "release of ¥X awaiting PayPal" / "authorized, not settled"; no "still in place", no "retried automatically" (now "Dina can retry it from the trip"); late swap answer says "Too late to change this item: its release is already planned."
- **#29:** `joinView` keeps the route token through the error branch, the name continuation, the AI find result and post-send navigation.

Tests (claimed): `edges.mjs` 41/41 (new: withdraw during authorization, late void with failing log write, releasing counts toward $50, stale plan after a swap → 409 nothing saved); `ui-edges.mjs` 25/25 (new: slow bad-invite and slow AI answer after leaving, both verified FAIL on the previous commit, PASS now); `rules.mjs` 9/9; real-sandbox `e2e.mjs` 29/29; ui-flow 32 shots × 7 sizes, 0 errors; migrations 0001–0007 = `SCHEMA`.

## What to do
1. Verify each open item (2, 11, 18, 21, 24, 26–31): **FIXED / PARTIAL / NOT FIXED**, with your own reproduction.
2. Hunt regressions (e.g. `rev` with `similar`-rule auto swaps, `withdrawn` in any status list or count you can find, the `releasing` row's visibility to the friend and owner, `retry` on a settled trip).
3. New findings: severity, where, evidence, exact fix. Keep MINOR separate; only BLOCKER/MAJOR block.
4. End with `VERDICT: SHIP` or `VERDICT: FIX FIRST`.

Do not edit files in `app/`. Write only your answer file.
