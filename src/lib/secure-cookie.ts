import "server-only";
import { headers } from "next/headers";

/**
 * Whether to mark cookies Secure.
 *
 * Keyed to the actual request protocol, not NODE_ENV. Vercel always sets
 * x-forwarded-proto, so the deployed app gets Secure cookies. A production
 * build served straight over http, which is what a rehearsal from a phone on
 * the same wifi looks like, gets a cookie the browser will actually keep.
 * The failure modes are not symmetric: a Secure cookie over http breaks
 * everything, a plain cookie over https does not.
 */
export async function isSecureRequest(): Promise<boolean> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-proto");
  return forwarded ? forwarded.split(",")[0].trim() === "https" : false;
}
