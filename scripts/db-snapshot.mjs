#!/usr/bin/env node
/**
 * db-snapshot — verified backup / recovery for AssetPilot's PostgreSQL database.
 *
 * Read-only against the source, insert-only against the target: restoring into
 * a non-empty database fails on primary-key conflicts and therefore can never
 * overwrite or delete existing rows.
 *
 * Usage (DATABASE_URL from the environment / .env):
 *   node scripts/db-snapshot.mjs dump   --out <file.json>       # backup
 *   node scripts/db-snapshot.mjs counts                        # per-table counts
 *   node scripts/db-snapshot.mjs restore --in <file.json> \
 *        --confirm <database-name>                             # recovery
 *
 * `restore` refuses to run unless --confirm equals the target database's name
 * (printed by the script), which prevents accidental restores against the
 * wrong database. Never prints credentials.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import "dotenv/config";

/** Application tables in foreign-key dependency order. */
const TABLES = [
  "User",
  "Session",
  "Account",
  "VerificationToken",
  "Collection",
  "Asset",
  "AssetVersion",
  "DecisionHistoryEntry",
  "ActivityItem",
  "ComparisonRecord",
  "CuratorFeedbackEntry",
  "IgnoredDuplicate",
];

function usage(msg) {
  if (msg) console.error(`error: ${msg}`);
  console.error("Usage: db-snapshot.mjs dump --out <file> | counts | restore --in <file> --confirm <dbname>");
  process.exit(1);
}

function targetInfo() {
  const url = process.env.DATABASE_URL;
  if (!url) usage("DATABASE_URL is not set");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    usage("DATABASE_URL is not a valid URL");
  }
  return { url, host: parsed.hostname, dbName: parsed.pathname.replace(/^\//, "").split("?")[0] };
}

function connect(info) {
  // Local (disposable) PostgreSQL speaks no TLS; Neon requires it.
  const local = /^(127\.0\.0\.1|localhost)$/i.test(info.host);
  return new Client({ connectionString: info.url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
}

async function tableCounts(client) {
  const counts = {};
  for (const t of TABLES) {
    const res = await client.query(`SELECT count(*)::int AS n FROM "${t}"`);
    counts[t] = res.rows[0].n;
  }
  return counts;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" || argv[i] === "--in" || argv[i] === "--confirm") {
      const key = argv[i].slice(2);
      const val = argv[++i];
      if (val === undefined) usage(`missing value for --${key}`);
      args[key] = val;
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

async function dump(args) {
  if (!args.out) usage("dump requires --out <file>");
  const info = targetInfo();
  const client = connect(info);
  await client.connect();
  const tables = [];
  const counts = {};
  for (const t of TABLES) {
    const res = await client.query(`SELECT * FROM "${t}"`);
    tables.push({ name: t, columns: res.fields.map((f) => f.name), rows: res.rows });
    counts[t] = res.rowCount;
  }
  await client.end();
  const payload = {
    tool: "db-snapshot",
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceHost: info.host,
    sourceDb: info.dbName,
    rowCounts: counts,
    tables,
  };
  writeFileSync(args.out, JSON.stringify(payload));
  console.log(`backup written: ${args.out}`);
  console.log(`tables: ${tables.length}, rows: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
}

async function counts() {
  const info = targetInfo();
  const client = connect(info);
  await client.connect();
  const c = await tableCounts(client);
  await client.end();
  console.log(`target: ${info.host}/${info.dbName}`);
  for (const t of TABLES) console.log(`${t}: ${c[t]}`);
}

async function restore(args) {
  if (!args.in) usage("restore requires --in <file>");
  if (!args.confirm) usage("restore requires --confirm <database-name>");
  const info = targetInfo();
  if (args.confirm !== info.dbName) {
    usage(`--confirm ("${args.confirm}") does not match target database name ("${info.dbName}") — refusing to restore`);
  }
  const payload = JSON.parse(readFileSync(args.in, "utf8"));
  if (payload.tool !== "db-snapshot") usage("input file is not a db-snapshot dump");
  const byName = new Map(payload.tables.map((t) => [t.name, t]));
  const client = connect(info);
  await client.connect();
  try {
    for (const t of TABLES) {
      const table = byName.get(t);
      if (!table) usage(`dump is missing table "${t}"`);
      // json/jsonb columns must receive JSON text: node-postgres would otherwise
      // serialize a JS array as a Postgres ARRAY literal, which is invalid JSON.
      const colTypes = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1`, [t]);
      const jsonCols = new Set(
        colTypes.rows.filter((r) => r.data_type === "json" || r.data_type === "jsonb").map((r) => r.column_name),
      );
      if (table.rows.length === 0) continue;
      const cols = table.columns.map((c) => `"${c}"`).join(", ");
      const params = table.columns.map((_, i) => `$${i + 1}`).join(", ");
      let i = 0;
      for (const row of table.rows) {
        try {
          await client.query(
            `INSERT INTO "${t}" (${cols}) VALUES (${params})`,
            table.columns.map((c) => {
              const v = row[c];
              if (jsonCols.has(c) && v !== null && v !== undefined) return JSON.stringify(v);
              return v;
            }),
          );
        } catch (e) {
          e.message = `restore failed while inserting row #${i} into "${t}": ${e.message}`;
          throw e;
        }
        i++;
      }
    }
    const after = await tableCounts(client);
    console.log(`restored into ${info.host}/${info.dbName}`);
    for (const t of TABLES) console.log(`${t}: ${after[t]}`);
  } finally {
    await client.end();
  }
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (cmd === "dump") await dump(args);
else if (cmd === "counts") await counts(args);
else if (cmd === "restore") await restore(args);
else usage(cmd ? `unknown command "${cmd}"` : undefined);
