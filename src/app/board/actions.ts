"use server";

import { buildBoardPayload, type BoardPayload } from "@/lib/board-payload";
import { countRecentForCookie, insertEntry, RATE_LIMIT_PER_HOUR } from "@/lib/entries";
import { readOrCreateVisitorId } from "@/lib/session";
import { validateSubmission } from "@/lib/validate";

export type SubmitResult =
  | { ok: true; entryId: string; payload: BoardPayload }
  | { ok: false; field: "bucket" | "function" | "task" | "form"; message: string };

export async function submitEntry(input: {
  bucket: string;
  functionLabel: string;
  task: string;
}): Promise<SubmitResult> {
  const validation = validateSubmission(input);
  if (!validation.ok) {
    return { ok: false, field: validation.field, message: validation.message };
  }

  let visitorId: string;
  try {
    visitorId = await readOrCreateVisitorId();
  } catch {
    return {
      ok: false,
      field: "form",
      message: "This browser is blocking cookies. Turn off private browsing and try again.",
    };
  }

  try {
    const recent = await countRecentForCookie(visitorId);
    if (recent >= RATE_LIMIT_PER_HOUR) {
      return {
        ok: false,
        field: "form",
        message: `That is ${RATE_LIMIT_PER_HOUR} tasks in an hour, which is the limit. Come find me instead.`,
      };
    }

    const entry = await insertEntry({
      bucket: validation.value.bucket,
      functionLabel: validation.value.functionLabel,
      task: validation.value.task,
      cookieId: visitorId,
    });

    const payload = await buildBoardPayload({ visitorId, mode: "submit", fresh: true });
    return { ok: true, entryId: entry.id, payload };
  } catch (error) {
    console.error("[submitEntry] failed", error);
    return {
      ok: false,
      field: "form",
      message: "The board did not accept that. Try once more.",
    };
  }
}
