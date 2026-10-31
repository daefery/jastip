// Cloudflare Worker entry: D1 for data, R2 (optional) for receipt photos, Workers AI for vision,
// static assets for the web app. Secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (wrangler secret put).
import { makeApi } from "./lib/api.mjs";
import { d1 } from "./lib/db.mjs";
import { setEnv } from "./lib/env.mjs";

let handle;
export default {
  async fetch(req, env) {
    if (!handle) {
      setEnv(env);
      globalThis.__JASTIP_AI__ = env.AI;
      const saveImage = env.RECEIPTS
        ? async (rid, dataUrl) => {
            const [head, b64] = dataUrl.split(",");
            const type = head.slice(5, head.indexOf(";"));
            await env.RECEIPTS.put(`receipts/${rid}`, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), { httpMetadata: { contentType: type } });
            return `r2:receipts/${rid}`;
          }
        : null;
      // Sample receipt: stored reading, keyed by the sha-256 of the data URL the app sends.
      globalThis.__JASTIP_SAMPLES__ = {};
      try {
        const get = (p) => env.ASSETS.fetch(new Request("https://assets.local" + p));
        const png = new Uint8Array(await (await get("/sample/receipt.png")).arrayBuffer());
        let bin = ""; for (let i = 0; i < png.length; i += 0x8000) bin += String.fromCharCode(...png.subarray(i, i + 0x8000));
        const url = "data:image/png;base64," + btoa(bin);
        const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)))].map((b) => b.toString(16).padStart(2, "0")).join("");
        globalThis.__JASTIP_SAMPLES__[h] = await (await get("/sample/receipt.json")).json();
      } catch { /* sample falls back to a normal AI read */ }
      handle = makeApi(d1(env.DB), { saveImage });
    }
    const res = await handle(req);
    if (res) return res;
    // SPA: unknown paths fall back to index.html via assets "not_found_handling".
    return env.ASSETS.fetch(req);
  },
};
