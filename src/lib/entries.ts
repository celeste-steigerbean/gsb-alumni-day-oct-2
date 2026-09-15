import "server-only";
import { createHash } from "node:crypto";

import type { BucketKey } from "./buckets";
import { query } from "./db";
import { SEED_COOKIE_ID } from "./entries-constants";
import { SEED_BATCH_SIZE, SEED_EXAMPLES } from "./seed-examples";

export type Entry = {
  id: string;
  created_at: string;
  bucket: BucketKey;
  function_label: string;
  task: string;
  hidden: boolean;
};

export type AdminEntry = Entry & { submitter_cookie_id: string };

export type BoardSnapshot = {
  /** Changes whenever the visible set of entries changes. */
  version: string;
  total: number;
  /** Distinct people behind the visible entries, examples excluded. */
  people: number;
  entries: Entry[];
};

export {
  TASK_MIN_LENGTH,
  TASK_MAX_LENGTH,
  RATE_LIMIT_PER_HOUR,
  REQUIRED_SUBMISSIONS,
  SEED_COOKIE_ID,
} from "./entries-constants";

type Row = {
  id: string;
  created_at: Date;
  bucket: BucketKey;
  function_label: string;
  task: string;
  hidden: boolean;
};

function toEntry(row: Row): Entry {
  return {
    id: String(row.id),
    created_at: row.created_at.toISOString(),
    bucket: row.bucket,
    function_label: row.function_label,
    task: row.task,
    hidden: row.hidden,
  };
}

/**
 * A short-lived cache in front of the board read. Sixty phones polling every
 * few seconds collapse into roughly one query per second per instance.
 */
const CACHE_TTL_MS = 900;
let cached: { at: number; value: BoardSnapshot } | null = null;

function versionOf(entries: Entry[]): string {
  if (entries.length === 0) return "empty";
  const hash = createHash("sha1");
  for (const entry of entries) hash.update(entry.id).update(",");
  return `${entries.length}-${hash.digest("hex").slice(0, 12)}`;
}

/** Every visible entry, newest first. */
export async function getBoardSnapshot(options?: { fresh?: boolean }): Promise<BoardSnapshot> {
  const now = Date.now();
  if (!options?.fresh && cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const rows = await query<Row & { submitter_cookie_id: string }>(
    `SELECT id, created_at, bucket, function_label, task, hidden, submitter_cookie_id
       FROM entries
      WHERE hidden = FALSE
      ORDER BY id DESC`,
  );

  const entries = rows.map(toEntry);
  const people = new Set(
    rows
      .filter((row) => row.submitter_cookie_id !== SEED_COOKIE_ID)
      .map((row) => row.submitter_cookie_id),
  ).size;

  const value: BoardSnapshot = {
    version: versionOf(entries),
    total: entries.length,
    people,
    entries,
  };
  cached = { at: now, value };
  return value;
}

/** Call after any write so the next read does not serve a stale snapshot. */
export function invalidateBoardCache(): void {
  cached = null;
}

export async function getAdminEntries(): Promise<AdminEntry[]> {
  const rows = await query<Row & { submitter_cookie_id: string }>(
    `SELECT id, created_at, bucket, function_label, task, hidden, submitter_cookie_id
       FROM entries
      ORDER BY id DESC`,
  );
  return rows.map((row) => ({ ...toEntry(row), submitter_cookie_id: row.submitter_cookie_id }));
}

export async function getEntryIdsForCookie(cookieId: string): Promise<string[]> {
  if (!cookieId) return [];
  const rows = await query<{ id: string }>(
    `SELECT id FROM entries WHERE submitter_cookie_id = $1 ORDER BY id DESC`,
    [cookieId],
  );
  return rows.map((row) => String(row.id));
}

export async function countRecentForCookie(cookieId: string): Promise<number> {
  if (!cookieId) return 0;
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM entries
      WHERE submitter_cookie_id = $1
        AND created_at > now() - interval '1 hour'`,
    [cookieId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function insertEntry(input: {
  bucket: BucketKey;
  functionLabel: string;
  task: string;
  cookieId: string;
}): Promise<Entry> {
  const rows = await query<Row>(
    `INSERT INTO entries (bucket, function_label, task, submitter_cookie_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at, bucket, function_label, task, hidden`,
    [input.bucket, input.functionLabel, input.task, input.cookieId],
  );
  invalidateBoardCache();
  return toEntry(rows[0]);
}

export async function setEntryHidden(id: string, hidden: boolean): Promise<void> {
  await query(`UPDATE entries SET hidden = $2 WHERE id = $1`, [id, hidden]);
  invalidateBoardCache();
}

/**
 * Removes the examples outright rather than hiding them. They are props, not
 * anybody's answer, so leaving them in the export would pollute the record.
 */
export async function clearSeedEntries(): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM entries WHERE submitter_cookie_id = $1 RETURNING id`,
    [SEED_COOKIE_ID],
  );
  if (rows.length > 0) invalidateBoardCache();
  return rows.length;
}

export async function seedExamples(
  batch: number = SEED_BATCH_SIZE,
): Promise<{ inserted: number; seeded: number; available: number }> {
  const existing = await query<{ task: string }>(
    `SELECT task FROM entries WHERE submitter_cookie_id = $1`,
    [SEED_COOKIE_ID],
  );
  const already = new Set(existing.map((row) => row.task));

  // Only ever add examples that are not already in the table, so clicking
  // the button twice tops up rather than duplicating.
  const remaining = SEED_EXAMPLES.filter((example) => !already.has(example.task));
  const batchToAdd = remaining.slice(0, Math.max(0, batch));

  for (const example of batchToAdd) {
    await query(
      `INSERT INTO entries (bucket, function_label, task, submitter_cookie_id)
       VALUES ($1, $2, $3, $4)`,
      [example.bucket, example.functionLabel, example.task, SEED_COOKIE_ID],
    );
  }

  if (batchToAdd.length > 0) invalidateBoardCache();

  return {
    inserted: batchToAdd.length,
    seeded: already.size + batchToAdd.length,
    available: SEED_EXAMPLES.length,
  };
}
