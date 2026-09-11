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

function connectionString(): string {
  const url =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url) {
    throw new Error(
      "No database URL. Set POSTGRES_URL (or DATABASE_URL) to a pooled Postgres connection string.",
    );
  }
  return url;
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
