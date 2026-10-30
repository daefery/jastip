// Config from Cloudflare bindings (deployed) or process.env (Node dev). One getter for both.
const store = {};
export const setEnv = (obj) => { for (const [k, v] of Object.entries(obj || {})) if (typeof v === "string") store[k] = v; };
export const env = (k) => store[k] ?? (typeof process !== "undefined" ? process.env?.[k] : undefined);

// Node only: read .env from the app folder, then from the project root.
export async function loadDotEnv(dir) {
  const { readFileSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  for (const p of [join(dir, ".env"), join(dir, "..", ".env")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
