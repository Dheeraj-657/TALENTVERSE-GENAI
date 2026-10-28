import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL } from "../db/schema.js";

let db = null;
let dbPath = null;

// Opens (or creates) the SQLite database file and applies the schema. ":memory:" is used by tests.
export function connectDB(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(SCHEMA_SQL);
  dbPath = file;
  if (file !== ":memory:") console.log(`[db] SQLite ready at ${path.resolve(file)}`);
  return db;
}

export function getDB() {
  if (!db) throw new Error("Database is not connected.");
  return db;
}

export function disconnectDB() {
  db?.close();
  db = null;
}

export function dbStatus() {
  return db ? { engine: "sqlite", status: "connected", file: dbPath === ":memory:" ? dbPath : path.basename(dbPath) } : { engine: "sqlite", status: "disconnected" };
}
