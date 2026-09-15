import { redirect } from "next/navigation";

import { ROOM_COOKIE, roomGateEnabled, safeNextPath, tokenIsValid } from "@/lib/room-access";
import { cookies } from "next/headers";
import { UnlockForm } from "./unlock-form";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);

  // Nothing to unlock, or already in. Do not make anyone look at this page.
  if (!roomGateEnabled()) redirect(next);
  const store = await cookies();
  if (await tokenIsValid(store.get(ROOM_COOKIE)?.value)) redirect(next);

  return <UnlockForm next={next} />;
}
