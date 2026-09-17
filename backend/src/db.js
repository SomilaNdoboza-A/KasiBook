const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "kasibook.db");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    owner TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    location TEXT NOT NULL,
    tagline TEXT,
    icon TEXT DEFAULT '🏪',
    hue TEXT DEFAULT 'green',
    photo TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    duration INTEGER NOT NULL,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    paid INTEGER NOT NULL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    payment_ref TEXT,
    created_at TEXT NOT NULL
  );
`);

module.exports = db;
