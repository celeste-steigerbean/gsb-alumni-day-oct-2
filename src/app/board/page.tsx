import { buildBoardPayload } from "@/lib/board-payload";
import { readVisitorId } from "@/lib/session";
import { SubmitScreen } from "./submit-screen";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const visitorId = await readVisitorId();

  let initial;
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
      ownIds: [],
      entries: null,
      samples: [],
    };
  }

  return <SubmitScreen initial={initial} />;
}
