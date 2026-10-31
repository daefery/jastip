# Council round 4 · Jastip app · re-review

Read your round-3 answer first: `/home/feryyp/code/hackathon/paypal/jastip/council/ui3-astra.md` (earlier: `ui2-astra.md`, `ui1-astra.md`; paths/servers in `ui1-brief.md`: :5181 test mode + `DEMO_SWITCH=1`, :5180 real sandbox; both restarted on the new code).

Fixes are in `HEAD` of `/home/feryyp/code/hackathon/paypal/jastip` (`git show HEAD`). Builder's claims:

- **#19:** `db.batch()` added: SQLite `BEGIN IMMEDIATE … COMMIT/ROLLBACK` locally, `D1.batch()` on Cloudflare (Cloudflare docs: "If a statement in the sequence fails … it aborts or rolls back the entire sequence", https://developers.cloudflare.com/d1/worker-api/d1-database/). `settle()` locks the trip (`shopping → settling`, fresh `settle_id`) and saves every step in one batch; each step's UPDATE requires that `settle_id`, so a failed save leaves nothing. `retry()` refuses (409) when any authorized open request has no saved step, rather than returning an empty success. Migration `0006_settle_id.sql`. Pre-migration `settling` trips: none exist outside local test DBs (live D1 never ran this code), so no upgrade path was built (stated, not hidden).
- **#20:** one-way guards inside the UPDATE statements: `setShopDay` only from open|holds; `decide` only while open|holds; `startShopping` is a `holds → shopping` batch; `mark`/swap need trip `shopping` and `plan_op IS NULL` in the same statement; `answerSwap` too.
- **#21:** late authorization: the auth id is stored first (`status='releasing'`, `plan_op='void'`), then released through the same `runPlan`; a failed release stays an open step (trip set back to `settling` if it had settled) and the friend is told the release isn't confirmed yet. No `.catch(() => {})`.
- **#22:** on a lost conditional update, reload; if the same auth id is already attached, return success without voiding.
- **#23:** `route()` returns after `await refreshMe()` if it no longer owns the page; the route token is passed into `tripView`/`joinView` instead of re-captured.
- **#24:** friend view: a saved but unconfirmed step shows "Charging ¥X … PayPal hasn't confirmed it yet" or "Releasing your hold … hasn't confirmed the release yet"; list word "Paying…"/"Releasing…"; home card "Paying…"; swap button only while shopping; server refuses a late swap answer.
- **#25:** customs: before the receipt = friends' max prices labelled "up to … (friends' max prices)"; after the receipt is confirmed = receipt prices of bought goods (no fees), labelled "(receipt prices)", unchanged by retries.

Tests (claimed): `test/edges.mjs` 34/34 (new: plan-save failure rollback, stale shop/mark/settle, late auth with failed release, parallel returns with one shared auth id, late swap answer during pending release); `test/ui-edges.mjs` 23/23 (new: delayed `/api/me` then leave, verified to FAIL on the previous commit and PASS now); `rules.mjs` 9/9; real-sandbox `e2e.mjs` 29/29; ui-flow 32 shots × 7 sizes, 0 errors; migrations 0001–0006 = `SCHEMA` (7 tables).

## What to do
1. Verify each open item (2, 11, 16, 18, 19–25): **FIXED / PARTIAL / NOT FIXED**, with your own reproduction.
2. Hunt regressions from the transaction/guard changes (e.g. `BEGIN IMMEDIATE` while another statement is open in node:sqlite, the `releasing` status everywhere a status list exists, `customs` before/after, summary while `releasing`).
3. New findings: severity, where, evidence, exact fix. Only BLOCKER/MAJOR block. Please keep MINOR separate.
4. End with `VERDICT: SHIP` or `VERDICT: FIX FIRST`.

Do not edit files in `app/`. Write only your answer file.
