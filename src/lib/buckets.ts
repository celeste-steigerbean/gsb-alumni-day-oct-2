/**
 * The six task types the session teaches. This list is the source of truth for
 * the Postgres enum, the submit screen, and the board columns. Order is the
 * teaching order and is deliberate: do not sort it.
 */

export const BUCKETS = [
  {
    key: "MONITOR",
    label: "MONITOR",
    helper: "Watch a changing set of inputs and flag the conditions you defined",
  },
  {
    key: "SYNTHESIZE",
    label: "SYNTHESIZE",
    helper: "Pull many sources into one view, with themes identified",
  },
  {
    key: "RESTRUCTURE",
    label: "RESTRUCTURE",
    helper: "Same content, different shape. Notes into a plan",
  },
  {
    key: "RECONCILE",
    label: "RECONCILE",
    helper: "Two versions in two systems. Find where they disagree",
  },
  {
    key: "PRESSURE_TEST",
    label: "PRESSURE TEST",
    helper: "Challenge an argument or plan, or have it argue the other side",
  },
  {
    key: "EVALUATE",
    label: "EVALUATE",
    helper: "Score work against a rubric you wrote",
  },
] as const;

export type BucketKey = (typeof BUCKETS)[number]["key"];

export const BUCKET_KEYS: BucketKey[] = BUCKETS.map((b) => b.key);

const BY_KEY = new Map(BUCKETS.map((b) => [b.key, b]));

export function isBucketKey(value: unknown): value is BucketKey {
  return typeof value === "string" && BY_KEY.has(value as BucketKey);
}

export function bucketLabel(key: BucketKey): string {
  return BY_KEY.get(key)?.label ?? key;
}

export function bucketHelper(key: BucketKey): string {
  return BY_KEY.get(key)?.helper ?? "";
}
