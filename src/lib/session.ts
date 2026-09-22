import "server-only";
import { cookies } from "next/headers";

import { COOKIE_PATH } from "./base-path";
import { isSecureRequest } from "./secure-cookie";

export const VISITOR_COOKIE = "sb_board_id";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: await isSecureRequest(),
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  };
}

/** Reads the anonymous visitor id. Middleware sets it on first visit. */
export async function readVisitorId(): Promise<string> {
  const store = await cookies();
  return store.get(VISITOR_COOKIE)?.value ?? "";
}

/**
 * Reads the visitor id, minting one if middleware has not run yet. Only safe
 * to call from a Server Action or Route Handler, which may write cookies.
 */
export async function readOrCreateVisitorId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;

  const fresh = crypto.randomUUID();
  store.set(VISITOR_COOKIE, fresh, await cookieOptions());
  return fresh;
}
