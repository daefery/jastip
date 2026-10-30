import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const id = (n = 10) => randomBytes(n).toString("base64url").slice(0, n);

export function openDb(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, created_at INTEGER NOT NULL,
      kept INTEGER NOT NULL DEFAULT 0          -- completed handovers (trust count)
    );
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      home TEXT NOT NULL, home_code TEXT NOT NULL, city TEXT NOT NULL, city_code TEXT NOT NULL,
      currency TEXT NOT NULL, depart TEXT NOT NULL, ret TEXT NOT NULL,
      fee INTEGER NOT NULL,                   -- jastip fee per item, minor units
      payee_email TEXT,                       -- PayPal account that receives captures (the traveller)
      shop_day TEXT, status TEXT NOT NULL DEFAULT 'open', -- open | holds | shopping | settled
      invite TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id), friend_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, detail TEXT, source TEXT, art TEXT, typical INTEGER,
      cap INTEGER NOT NULL,                   -- max item price, minor units
      status TEXT NOT NULL DEFAULT 'asked',   -- asked | accepted | declined | held | found | swap_asked | swapped | not_found | settled | released | delivered
      swap_title TEXT, swap_price INTEGER,
      line_text TEXT, price INTEGER,          -- from the receipt
      order_id TEXT, auth_id TEXT, capture_id TEXT,
      hold INTEGER, charged INTEGER, released INTEGER,
      authorized_at INTEGER, captured_at INTEGER, delivered_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id), image TEXT, model TEXT,
      shop TEXT, total INTEGER, lines TEXT NOT NULL, matches TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id TEXT NOT NULL, request_id TEXT,
      kind TEXT NOT NULL,                     -- paypal | ai | trip
      label TEXT NOT NULL, detail TEXT, ok INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
    );
  `);
  return db;
}

export const now = () => Date.now();
