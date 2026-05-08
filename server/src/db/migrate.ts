import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase } from "./index.js";

const databaseUrl = process.env["DATABASE_URL"] ?? "./data/advisor.sqlite";

mkdirSync(dirname(databaseUrl), { recursive: true });

const db = createDatabase(databaseUrl);

migrate(db, { migrationsFolder: "./drizzle" });

console.log("Migrations applied successfully.");
