# Council round 7 · Jastip app · re-review

Read your round-6 answer first: `/home/feryyp/code/hackathon/paypal/jastip/council/ui6-astra.md` (paths/servers in `ui1-brief.md`; :5181 test mode + `DEMO_SWITCH=1`, DB `/tmp/jastip-fake-5181.db`; :5180 real sandbox; both restarted on the new code).

Fixes are in `HEAD` (`git show HEAD`). Builder's claims:

- **#35:** in `holds` and `shopping`, the phase action (Start shopping / Pay & scan receipt / Finish) is kept, with eligibility checks unchanged, and "Retry PayPal · N" is added as a second, lighter button. Retry is the main action only when the trip is `settling`, or `settled` with open steps. New browser test at 320/768/1440: one valid hold + one failing saved void → Start shopping and Retry both visible and enabled; after shopping + Found → receipt checkout and Retry both there. New edge test 22: Retry fails twice, then start shopping, mark A found, settle at the reviewed rev → A charged exactly ¥900, B stays `releasing`/void, trip `settling`; B's release later succeeds, A is unchanged, trip `settled`.
- **#36:** friend badge "Released" when every own ask is released/not included; `released` detail says "Ask withdrawn. Hold released." (or "Approved too late. Hold released."); stage 0 for withdrawal compensation; the timeline marks "shopping" done only if the trip really reached shopping.

Tests (claimed): `edges.mjs` 48/48, `ui-edges.mjs` 34/34, `rules.mjs` 9/9, real-sandbox `e2e.mjs` 29/29, ui-flow 32 shots × 7 sizes 0 errors, migrations = `SCHEMA`.

## What to do
1. Verify #35 and #36 with your own reproduction. Also re-check any earlier item you think this change could have touched.
2. New findings: severity, where, evidence, exact fix. Keep MINOR separate; only BLOCKER/MAJOR block.
3. End with `VERDICT: SHIP` or `VERDICT: FIX FIRST`.

Do not edit files in `app/`. Write only your answer file.
