import { isBucketKey, type BucketKey } from "./buckets";
import { MAX_FUNCTION_LENGTH } from "./functions";
import { TASK_MAX_LENGTH, TASK_MIN_LENGTH } from "./entries-constants";

export type ValidationResult =
  | { ok: true; value: { bucket: BucketKey; functionLabel: string; task: string } }
  | { ok: false; field: "bucket" | "function" | "task"; message: string };

/** Control characters and stray line breaks would wreck a projected card. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g;

function clean(value: string): string {
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

export function validateSubmission(input: {
  bucket: unknown;
  functionLabel: unknown;
  task: unknown;
}): ValidationResult {
  if (!isBucketKey(input.bucket)) {
    return { ok: false, field: "bucket", message: "Pick one of the six task types." };
  }

  const functionLabel = clean(String(input.functionLabel ?? ""));
  if (!functionLabel) {
    return { ok: false, field: "function", message: "Pick a function, or add your own." };
  }
  if (functionLabel.length > MAX_FUNCTION_LENGTH) {
    return {
      ok: false,
      field: "function",
      message: `Keep the function under ${MAX_FUNCTION_LENGTH} characters.`,
    };
  }

  const task = clean(String(input.task ?? ""));
  if (task.length < TASK_MIN_LENGTH) {
    return {
      ok: false,
      field: "task",
      message: `Write at least ${TASK_MIN_LENGTH} characters. One sentence is enough.`,
    };
  }
  if (task.length > TASK_MAX_LENGTH) {
    return {
      ok: false,
      field: "task",
      message: `Keep the task under ${TASK_MAX_LENGTH} characters.`,
    };
  }

  return { ok: true, value: { bucket: input.bucket, functionLabel, task } };
}
