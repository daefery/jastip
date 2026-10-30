import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Loads .env from the app folder, then from the project root (one level up).
export function loadEnv(dir) {
  for (const p of [join(dir, ".env"), join(dir, "..", ".env")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
