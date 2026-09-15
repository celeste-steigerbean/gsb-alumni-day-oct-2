/**
 * The room passcode that gates the submit screen and the projected board.
 *
 * Attendees never type it: the QR code carries it as ?code= and the first
 * request exchanges it for a cookie. The typed field exists only as a fallback
 * for someone whose camera will not scan.
 *
 * Deliberately separate from ADMIN_PASSWORD. The room code is shared with
 * sixty people; the admin password is not.
 *
 * Web Crypto only, no node:crypto, so this same module runs in the proxy and
 * in server actions without a second implementation.
 */

export const ROOM_COOKIE = "sb_room";
export const ROOM_COOKIE_MAX_AGE = 60 * 60 * 12;
export const CODE_PARAM = "code";

export function roomPasscode(): string | null {
  const value = process.env.ROOM_PASSCODE?.trim();
  return value ? value : null;
}

/** No passcode configured means the board is open, which is a valid setup. */
export function roomGateEnabled(): boolean {
  return roomPasscode() !== null;
}

/**
 * Spaces, dashes and case are noise when a code is read off a slide by
 * someone in the back row. "gsb 24" and "GSB-24" are the same code.
 */
export function normalizeCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cookie value is a hash of the code, so the code itself never round trips. */
export async function roomToken(): Promise<string | null> {
  const passcode = roomPasscode();
  if (!passcode) return null;
  return sha256Hex(`sb-room:${normalizeCode(passcode)}`);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function codeMatches(submitted: string): Promise<boolean> {
  const passcode = roomPasscode();
  if (!passcode) return true;
  return constantTimeEquals(normalizeCode(submitted), normalizeCode(passcode));
}

export async function tokenIsValid(token: string | undefined): Promise<boolean> {
  if (!roomGateEnabled()) return true;
  if (!token) return false;
  const expected = await roomToken();
  return expected !== null && constantTimeEquals(token, expected);
}

/** Only ever send people back into the board. Never to an arbitrary URL. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/board";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/board";
  return raw.startsWith("/board") ? raw : "/board";
}
