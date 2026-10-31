# YouTube upload

## Title (max 100 characters)
Jastip: shop abroad for friends with PayPal holds and an AI receipt reader | PayPal AI Hackathon

## Description

Shop abroad for friends, and nobody pays upfront. Each friend approves a PayPal hold up to their max price, the traveller photographs one receipt, AI reads it, and each friend pays exactly their line plus the fee. Anything not found is released.

Try it: https://jastip.feryyp-work.workers.dev (PayPal sandbox, nothing real is charged)
Code: https://github.com/daefery/jastip

Built for the PayPal AI Hackathon 2026.

Chapters
0:00 The problem: someone always fronts the money
0:18 The idea: hold the max, one receipt, release the rest
0:28 The traveller opens a trip
0:36 A friend pastes a link and AI finds the item
0:49 PayPal hold on the real sandbox, ¥0 charged
1:08 Shopping, sold out and swaps
1:20 One receipt: AI reads it, code sets the money
1:34 Exact charge and handover
1:52 Safety rules

How PayPal is used
Orders v2 creates each hold (intent AUTHORIZE, the traveller as payee). Payments v2 captures each friend's exact amount from their hold, and voids the holds for items that weren't found.

How AI is used
Gemma 4 26B on Cloudflare Workers AI reads the receipt photo (Japanese lines, discounts and coupons) and turns a pasted TikTok or shop link into the product and a typical price. The AI never sets an amount: code charges the receipt line plus the fee, never above the hold.

Everything in this video is the real app on the real PayPal sandbox. Illustrations are AI-generated (OpenAI image generation). Narration is Kokoro TTS (open model, Apache 2.0). No music.

#PayPal #AI #Hackathon

## Settings
- Visibility: Public (Devpost also accepts Unlisted with no password)
- Audience: No, it's not made for kids
- Thumbnail: submission/gallery/01-cover.jpg
- Captions (optional): video/out/jastip-demo.srt, English
- Category: Science & Technology
