// One async SQL interface over Cloudflare D1 (deployed) or node:sqlite (local dev).
//   db.get(sql, ...args)  -> row | null
//   db.all(sql, ...args)  -> rows[]
//   db.run(sql, ...args)  -> { changes }
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, created_at INTEGER NOT NULL,
  kept INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  home TEXT NOT NULL, home_code TEXT NOT NULL, city TEXT NOT NULL, city_code TEXT NOT NULL,
  currency TEXT NOT NULL, depart TEXT NOT NULL, ret TEXT NOT NULL,
  fee INTEGER NOT NULL, payee_email TEXT,
  shop_day TEXT, status TEXT NOT NULL DEFAULT 'open',
  invite TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id), friend_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, detail TEXT, source TEXT, art TEXT, typical INTEGER,
  cap INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'asked', rule TEXT NOT NULL DEFAULT 'ask',
  swap_title TEXT, swap_price INTEGER, line_text TEXT, price INTEGER,
  order_id TEXT, auth_id TEXT, capture_id TEXT, hold INTEGER, charged INTEGER, released INTEGER,
  authorized_at INTEGER, captured_at INTEGER, delivered_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id), image TEXT, model TEXT,
  shop TEXT, total INTEGER, lines TEXT NOT NULL, matches TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id TEXT NOT NULL, request_id TEXT,
  kind TEXT NOT NULL, label TEXT NOT NULL, detail TEXT, ok INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS req_trip ON requests(trip_id);
CREATE INDEX IF NOT EXISTS req_friend ON requests(friend_id);
CREATE INDEX IF NOT EXISTS ev_trip ON events(trip_id, id);
`;

export function d1(D1) {
  return {
    get: async (sql, ...a) => (await D1.prepare(sql).bind(...a).first()) ?? null,
    all: async (sql, ...a) => (await D1.prepare(sql).bind(...a).all()).results ?? [],
    run: async (sql, ...a) => ({ changes: (await D1.prepare(sql).bind(...a).run()).meta?.changes ?? 0 }),
  };
}

export async function nodeSqlite(file) {
  const { DatabaseSync } = await import("node:sqlite");
  if (file !== ":memory:") {
    const { mkdirSync } = await import("node:fs"); const { dirname } = await import("node:path");
    mkdirSync(dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;" + SCHEMA);
  const cols = db.prepare("PRAGMA table_info(requests)").all().map((c) => c.name);
  if (!cols.includes("rule")) db.exec("ALTER TABLE requests ADD COLUMN rule TEXT NOT NULL DEFAULT 'ask'");
  const norm = (a) => a.map((x) => (x === undefined ? null : x));
  return {
    get: async (sql, ...a) => db.prepare(sql).get(...norm(a)) ?? null,
    all: async (sql, ...a) => db.prepare(sql).all(...norm(a)),
    run: async (sql, ...a) => ({ changes: Number(db.prepare(sql).run(...norm(a)).changes) }),
  };
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const id = (n = 10) => { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += ALPHA[x & 63]; return s; };
export const now = () => Date.now();
