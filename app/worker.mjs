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
      handle = makeApi(d1(env.DB), { saveImage });
    }
    const res = await handle(req);
    if (res) return res;
    // SPA: unknown paths fall back to index.html via assets "not_found_handling".
    return env.ASSETS.fetch(req);
  },
};
