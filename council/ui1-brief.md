# Council round 1 · Jastip app UI (Track design) · independent review

You are reviewing a hackathon app (PayPal AI Hackathon, judged on: technical implementation, design, impact, innovation, presentation). Be the toughest reviewer: find defects, not compliments.

## What it is
Jastip = a traveller (Dina) shops abroad for friends. Each friend approves a PayPal **hold** (authorization) up to a max price; Dina scans **one receipt**; AI reads it; code charges each friend the **exact line + fee** (partial capture) and **voids** holds for items not found. The UI is modelled on an Uber Eats delivery tracker (scene + 5-step bar + status) with a PayPal money strip, and Instacart-style shopping groups for the traveller.

## Where things are
- App: `/home/feryyp/code/hackathon/paypal/jastip/app/` (Node 22, no deps). UI in `public/` (`js/app.js`, `js/screens/trip.js`, `join.js`, `new.js`, `receipt.js`, `css/app.css`). API/logic in `lib/` (`api.mjs`, `trips.mjs` with safeguards S1–S8, `paypal.mjs`, `ai.mjs`).
- Running servers: **http://localhost:5181** (PayPal TEST MODE, real AI) for clicking through freely; http://localhost:5180 (real PayPal sandbox).
- Approved design prototype it implements: `/home/feryyp/code/hackathon/paypal/jastip/design/e/app.html`.
- Screenshots of the full real flow (4 people, 32 screens) at 3 sizes: `app/shots/flow-390/`, `app/shots/flow-768/`, `app/shots/flow-1440/` (file names say the moment).
- Tests: `app/test/ui-flow.mjs` (UI flow, any size, `node test/ui-flow.mjs 390x844`), `app/test/rules.mjs` (sold-out rules), `app/test/e2e.mjs` (29 checks on real PayPal sandbox; last run 29/29).

## What to do
1. Open the screenshots AND run the app yourself on :5181 (use playwright-core at `/home/feryyp/.agents/skills/adaptive-ux/scripts/node_modules/playwright-core`, chrome at `/usr/bin/google-chrome`; or read the code). Try to break it: wrong person acting, reload mid-flow, back button, double taps, empty/invalid inputs, very long item names, many items, a friend with 2 items, a trip with 0 asks, 320 px width, keyboard-only.
2. Judge it as a PayPal judge and as a jastip user on a phone in a shop.
3. Write findings as a numbered list. Each finding: **severity** (BLOCKER / MAJOR / MINOR), **where** (file:line or screenshot name), **what you saw** (evidence you reproduced), **exact fix**.
   - BLOCKER = breaks the flow, shows a wrong amount, leaks another person's data, or would look broken in the demo video.
4. Then answer: what are the 3 changes that would most raise the design and presentation score?
5. End with one line: `VERDICT: SHIP` or `VERDICT: FIX FIRST`.

Do not edit files in `app/`. Write only your answer file.
