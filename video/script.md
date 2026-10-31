# Jastip · demo video script (target 2:40, hard limit under 3:00)

Voice: Kokoro TTS (Apache 2.0 model, local), voice `af_heart`. Footage: real app, recorded in Chrome
with Playwright, PayPal sandbox approval page included. No music (rules: no copyrighted music).

| # | Scene | Screen | Narration |
|---|---|---|---|
| 1 | Hook | Title card: brand hero + "Jastip" | In Indonesia, when a friend flies to Tokyo, the whole group chat asks them to bring something back. It's called jastip. And someone always ends up fronting the money. |
| 2 | Problem | Title card: two pains | Either friends pay upfront for things that might be sold out, or the traveller pays for everything and chases friends for weeks. |
| 3 | Idea | Title card: 3 steps | Jastip fixes the money with PayPal. Friends approve a hold up to a max price. One receipt sets each friend's exact charge. Anything not found is released. |
| 4 | Traveller opens a trip | Dina's phone: new trip to Tokyo, share link | Dina is flying to Tokyo. She opens a trip and shares one link with her friends. |
| 5 | Friend asks, AI finds | Ayu's phone: paste TikTok link, AI finds item, max price, if sold out | Ayu pastes a TikTok link. AI turns it into the product and a typical Tokyo shelf price, so she can set her max. She also picks what happens if it's sold out. |
| 6 | Accept + hold | Dina accepts; Ayu taps Hold with PayPal → real PayPal sandbox page → approve | Dina accepts and picks her shopping day. Ayu approves a PayPal hold for her max plus Dina's fee. Nothing is charged. It's an authorization, made with PayPal's Orders API. |
| 7 | Shopping | Dina's list: Found, swap for sold out | In the shop, Dina ticks items off. One is sold out, so she offers a smaller pack, and Bima accepts it from his phone. |
| 8 | Receipt + AI | Dina scans the receipt; AI reads Japanese lines; plan | At the till, Dina photographs one receipt. AI reads every Japanese line and matches each line to a friend. Code, not AI, works out the money: the line plus the fee, never above the hold. |
| 9 | Exact charge | Charge → Ayu's phone: "Paid ¥1,288. Exactly." with never-taken bar | One tap. PayPal captures each friend's exact amount from their hold, and voids the hold for the patches Dina couldn't find. Ayu paid exactly her line plus the fee, and the rest of her hold was never taken. |
| 10 | Handover | Ayu: I got my item → Delivered | Back home, Ayu taps I got my item. That's the delivery record for both of them. |
| 11 | Trust + close | Title card: safety rules + Built with | No one pays upfront. No one is overcharged. Every money rule is enforced in code, and it all runs on the PayPal sandbox today. Jastip. Shop abroad for friends. |
