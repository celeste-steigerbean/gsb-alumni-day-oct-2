import "server-only";
import { Pool } from "pg";

import { BUCKET_KEYS } from "./buckets";

/**
 * One pooled connection per server instance. Vercel Postgres and Neon both
 * expose a pooled connection string; point POSTGRES_URL at the pooled one.
 */

declare global {
  // eslint-disable-next-line no-var
  var __boardPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __boardSchemaReady: Promise<void> | undefined;
}

/**
 * Names the hosts actually use, most pooled first. Vercel Postgres, the Neon
 * marketplace integration and Supabase each pick a different one, and the
 * integration that writes them can change without warning.
 */
const KNOWN_URL_VARS = [
  "POSTGRES_URL",
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

/**
 * Cleans up the ways a good connection string arrives damaged: wrapping
 * quotes from a copied .env line, a leading "psql " from a dashboard's
 * ready-to-run command, stray whitespace from a paste.
 */
function normalizeUrl(raw: string): string {
  let value = raw.trim();
  value = value.replace(/^psql\s+/i, "").trim();
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      value = value.slice(1, -1).trim();
    }
  }
  return value;
}

function looksLikePostgres(value: string | undefined): value is string {
  return typeof value === "string" && /^postgres(ql)?:\/\//.test(normalizeUrl(value));
}

/** Env var names that could plausibly hold a database URL. Names only. */
function databaseVarNames(): string[] {
  return Object.keys(process.env)
    .filter((name) => /^(POSTGRES|DATABASE|NEON|PG)[A-Z0-9_]*$/.test(name))
    .sort();
}

/** Which env vars hold something that parses as a Postgres URL. Names only. */
export function usableDatabaseVars(): string[] {
  return databaseVarNames().filter((name) => looksLikePostgres(process.env[name]));
}

/**
 * Why each database variable was accepted or rejected. Reports the scheme and
 * the length only. The value itself carries the password and never leaves the
 * server.
 */
export function describeDatabaseVars(): Array<{ name: string; status: string }> {
  return databaseVarNames().map((name) => {
    const raw = process.env[name];

    if (raw === undefined) return { name, status: "not set" };
    if (raw.trim() === "") return { name, status: "set but empty" };

    const value = normalizeUrl(raw);
    if (/^postgres(ql)?:\/\//.test(value)) {
      return { name, status: `usable (${value.length} chars)` };
    }

    const scheme = value.match(/^([A-Za-z0-9+.-]{1,20}):\/\//);
    return {
      name,
      status: scheme
        ? `not a postgres url, scheme is "${scheme[1]}" (${value.length} chars)`
        : `not a url, no scheme found (${value.length} chars)`,
    };
  });
}

export function resolveDatabaseVar(): string | null {
  for (const name of KNOWN_URL_VARS) {
    if (looksLikePostgres(process.env[name])) return name;
  }
  // Last resort: any DB-ish variable whose value really is a Postgres URL.
  // Better to connect than to fail because a host renamed its variable.
  return usableDatabaseVars()[0] ?? null;
}

function connectionString(): string {
  const name = resolveDatabaseVar();
  if (!name) {
    const seen = describeDatabaseVars();
    throw new Error(
      "No usable database URL. " +
        (seen.length
          ? `Checked: ${seen.map((v) => `${v.name} is ${v.status}`).join("; ")}.`
          : "This deployment can see no database related variables at all, so the store is not connected to it, or the variable was not set for the environment this deployment runs in."),
    );
  }
  return normalizeUrl(process.env[name] as string);
}

export function getPool(): Pool {
  if (!global.__boardPool) {
    const url = connectionString();
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    global.__boardPool = new Pool({
      connectionString: url,
      // Serverless instances are short lived and numerous. Stay small.
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: isLocal ? undefined : { rejectUnauthorized: true },
    });
    global.__boardPool.on("error", (error) => {
      console.error("[db] idle client error", error);
    });
  }
  return global.__boardPool;
}

const CREATE_ENUM = `
DO $$
BEGIN
  CREATE TYPE bucket_type AS ENUM (${BUCKET_KEYS.map((k) => `'${k}'`).join(", ")});
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;`;

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS entries (
  id                  BIGSERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  bucket              bucket_type NOT NULL,
  function_label      TEXT        NOT NULL,
  task                TEXT        NOT NULL,
  submitter_cookie_id TEXT        NOT NULL,
  hidden              BOOLEAN     NOT NULL DEFAULT FALSE
);`;

const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS entries_visible_idx ON entries (hidden, id DESC);`,
  `CREATE INDEX IF NOT EXISTS entries_cookie_idx  ON entries (submitter_cookie_id, created_at DESC);`,
];

/**
 * Idempotent schema setup. Runs at most once per server instance so the app
 * works on a fresh database with no migration step before the room walks in.
 */
export function ensureSchema(): Promise<void> {
  if (!global.__boardSchemaReady) {
    global.__boardSchemaReady = (async () => {
      const pool = getPool();
      await pool.query(CREATE_ENUM);
      await pool.query(CREATE_TABLE);
      for (const statement of CREATE_INDEXES) {
        await pool.query(statement);
      }
    })().catch((error) => {
      // Let the next request retry instead of caching a failed setup.
      global.__boardSchemaReady = undefined;
      throw error;
    });
  }
  return global.__boardSchemaReady;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query<T>(text, values);
  return result.rows;
}
