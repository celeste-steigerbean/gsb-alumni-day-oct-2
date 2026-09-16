/**
 * The six task types the session teaches. This list is the source of truth for
 * the Postgres enum, the submit screen, and the board columns. Order is the
 * teaching order and is deliberate: do not sort it.
 *
 * "helper" explains the task type. "prompt" is the second half of a question
 * put to the person once they have picked a type and a function, so it has to
 * read grammatically after "In <function>, ".
 */

export const BUCKETS = [
  {
    key: "MONITOR",
    label: "MONITOR",
    helper: "Watch a changing set of inputs and flag the conditions you defined",
    prompt: "what do we watch by hand, and what should raise a flag?",
  },
  {
    key: "SYNTHESIZE",
    label: "SYNTHESIZE",
    helper: "Pull many sources into one view, with themes identified",
    prompt: "what does someone read through to pull the themes out?",
  },
  {
    key: "RESTRUCTURE",
    label: "RESTRUCTURE",
    helper: "Same content, different shape. Notes into a plan",
    prompt: "what gets rewritten into a different shape, and by whom?",
  },
  {
    key: "RECONCILE",
    label: "RECONCILE",
    helper: "Two versions in two systems. Find where they disagree",
    prompt: "which two versions disagree, and who finds where?",
  },
  {
    key: "PRESSURE_TEST",
    label: "PRESSURE TEST",
    helper: "Challenge an argument or plan, or have it argue the other side",
    prompt: "what argument or plan needs somebody to attack it?",
  },
  {
    key: "EVALUATE",
    label: "EVALUATE",
    helper: "Score work against a rubric you wrote",
    prompt: "what gets scored against a rubric, and who scores it?",
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

export function bucketPrompt(key: BucketKey): string {
  return BY_KEY.get(key)?.prompt ?? "";
}
