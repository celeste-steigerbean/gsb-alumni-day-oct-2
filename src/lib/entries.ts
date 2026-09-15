import "server-only";
import { createHash } from "node:crypto";

import type { BucketKey } from "./buckets";
import { query } from "./db";
import { SEED_COOKIE_ID } from "./entries-constants";

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

  const rows = await query<Row>(
    `SELECT id, created_at, bucket, function_label, task, hidden
       FROM entries
      WHERE hidden = FALSE
      ORDER BY id DESC`,
  );

  const entries = rows.map(toEntry);
  const value: BoardSnapshot = {
    version: versionOf(entries),
    total: entries.length,
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

export async function hideSeedEntries(): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE entries SET hidden = TRUE
      WHERE submitter_cookie_id = $1 AND hidden = FALSE
      RETURNING id`,
    [SEED_COOKIE_ID],
  );
  invalidateBoardCache();
  return rows.length;
}

const SEED_ENTRIES: Array<{ bucket: BucketKey; functionLabel: string; task: string }> = [
  {
    bucket: "MONITOR",
    functionLabel: "Regulatory affairs",
    task: "Watch four agency feeds for rules touching our device class. Analyst skims them Monday.",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Investor relations",
    task: "Turn thirty LP calls into one themes memo. An associate reads every transcript today.",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Corporate development",
    task: "Argue the seller side of our acquisition thesis. Two partners do this over dinner.",
  },
];

/**
 * Three examples so the board is never empty when the room walks in. A no-op
 * if the seed entries are already showing, so a second click cannot duplicate.
 */
export async function seedExamples(): Promise<{ inserted: number; alreadySeeded: boolean }> {
  const existing = await query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM entries
      WHERE submitter_cookie_id = $1 AND hidden = FALSE`,
    [SEED_COOKIE_ID],
  );
  if (Number(existing[0]?.count ?? 0) > 0) {
    return { inserted: 0, alreadySeeded: true };
  }

  for (const seed of SEED_ENTRIES) {
    await query(
      `INSERT INTO entries (bucket, function_label, task, submitter_cookie_id)
       VALUES ($1, $2, $3, $4)`,
      [seed.bucket, seed.functionLabel, seed.task, SEED_COOKIE_ID],
    );
  }
  invalidateBoardCache();
  return { inserted: SEED_ENTRIES.length, alreadySeeded: false };
}
