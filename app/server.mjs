// Local dev server (Node 22.5+): same API as the Worker, node:sqlite instead of D1, files on disk.
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv, env } from "./lib/env.mjs";
import { nodeSqlite } from "./lib/db.mjs";
import { makeApi } from "./lib/api.mjs";
import * as pp from "./lib/paypal.mjs";
import * as ai from "./lib/ai.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
await loadDotEnv(DIR);
const db = await nodeSqlite(env("DB_FILE") || join(DIR, "data", "jastip.db"));
const UPLOADS = join(DIR, "data", "receipts");
await mkdir(UPLOADS, { recursive: true });
const handle = makeApi(db, {
  saveImage: async (rid, dataUrl) => { const f = join(UPLOADS, `${rid}.img`); await writeFile(f, Buffer.from(dataUrl.split(",")[1], "base64")); return f; },
});
const PORT = Number(env("PORT") || 5180);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };

createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const url = `http://${req.headers.host}${req.url}`;
  const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const out = await handle(request);
  if (out) {
    const headers = {}; out.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(out.status, headers); res.end(Buffer.from(await out.arrayBuffer())); return;
  }
  const pathname = decodeURIComponent(new URL(url).pathname);
  let path = join(DIR, "public", pathname);
  if (!path.startsWith(join(DIR, "public"))) { res.writeHead(403); return res.end(); }
  if (pathname === "/" || !existsSync(path) || !extname(path)) path = join(DIR, "public", "index.html");
  res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(await readFile(path));
}).listen(PORT, () => console.log(`Jastip on http://localhost:${PORT}  paypal=${pp.fake() ? "TEST MODE (no real PayPal calls)" : pp.paypalReady()} ai=${ai.aiReady() ? ai.aiName() : false}`));
