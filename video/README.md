# Demo video

Made entirely from the real app; nothing is mocked.

- `record.mjs` – plays the full flow in Chrome (Dina, Ayu, Bima, Citra as separate phones) against a
  server with the **real PayPal sandbox**, and records each phone at 2x (CDP screencast). The PayPal
  approval screen is PayPal's real sandbox page (`PAYPAL_LOCALE=en-US` makes it English).
- `lines.json` – the narration, one line per scene. `tts-all.py` / `tts-some.py` turn it into speech with
  **Kokoro TTS** (open model, Apache 2.0, run locally; voice `af_heart`).
- `cards.html` – the title cards and the frame around the phone footage (brand art from `app/public/img`).
- `build.mjs` – edits it all: one segment per scene, footage speed fitted to the narration (0.8x–1.3x),
  burned-in captions, loudness normalised. Output `/tmp/vid/jastip-demo.mp4` (+ `.srt`).

No music. All visuals are the app's own screens and its AI-generated illustrations.
