import { buildBoardPayload, type BoardPayload } from "@/lib/board-payload";
import { REQUIRED_SUBMISSIONS } from "@/lib/entries-constants";
import { readVisitorId } from "@/lib/session";
import { SubmitScreen } from "./submit-screen";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const visitorId = await readVisitorId();

  let initial: BoardPayload;
  try {
    initial = await buildBoardPayload({ visitorId, mode: "submit", fresh: true });
  } catch (error) {
    console.error("[/board] initial load failed", error);
    // A cold or unreachable database should not blank the screen. The client
    // keeps polling and fills in as soon as it answers.
    initial = {
      version: "boot",
      total: 0,
      unlocked: false,
      remaining: REQUIRED_SUBMISSIONS,
      required: REQUIRED_SUBMISSIONS,
      ownIds: [],
      entries: null,
      samples: [],
    };
  }

  return <SubmitScreen initial={initial} />;
}
