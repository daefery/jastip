# Context: PayPal Jastip prototype

[Confirmed: Fery, 30 Oct 2026] "design the apps and the real flow in html first ... really useful, clean, and visualized, dont add too many text. mobile first adaptive design".

## Purpose
Show the real flow of PayPal Jastip before building the app: a traveller shops abroad for friends;
each friend approves a PayPal hold up to a cap; one receipt sets each exact share; each friend is charged
only at handover; items not found are released.
[Source: chat 30 Oct 2026, spike results README.md]

## Personas and jobs
| Persona | Job | Moment |
|---|---|---|
| Traveller (jastiper), e.g. Dina in Tokyo | open a shopping day, find items, scan one receipt, hand items over | standing in a shop, one hand on a basket, bad signal, in a hurry [Inferred] |
| Friend (penitip), e.g. Ayu in Jakarta | ask for an item with a price cap, approve the hold, approve a swap, confirm handover | on the phone at home or commuting, waiting for news [Inferred] |
| Judge (PayPal) | understand the whole money flow in under 3 minutes | at a laptop, watching a video or clicking the demo [Source: rules, judges may score from video] |

## Device mix
- Traveller and friends: phone only. [Inferred: jastip runs on Instagram and WhatsApp]
- Judge: laptop or desktop. [Source: Devpost judging is online]
=> The product screens are phone screens. On wide screens the prototype shows the two phones side by side
(traveller + friend) with the PayPal money ledger between them, because the judge's job is to see
cause (traveller action) and effect (friend's money) at once.

## Task-device fit
| Job | compact | medium | expanded+ |
|---|---|---|---|
| Traveller flow | primary (one phone) | primary (phone + ledger) | primary (left phone) |
| Friend flow | primary (switch role) | primary (switch) | primary (right phone) |
| Money ledger (holds, captures, voids) | in a sheet | side column | centre column |

## Language
UI copy in English (judges), friend names and shops Indonesian/Japanese. Short labels, numbers big.
[Source: Fery asked for little text]

## Constraints
- Offline single HTML, no CDN. DM Sans is installed locally; bundle as base64 is not needed for a local preview, use system fallbacks.
- Simulated data, stamped "Simulation · sandbox data". Numbers come from the real sandbox spike (¥1,500 hold, ¥1,188 capture, ¥80 fee).
- No AI-tool names in copy.

## Open questions (not blocking the prototype)
- Fee model (who pays the PayPal fee, jastip fee %). Prototype shows fee as a line, value Proposed.
