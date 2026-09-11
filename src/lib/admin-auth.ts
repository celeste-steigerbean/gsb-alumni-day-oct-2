import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { isSecureRequest } from "./secure-cookie";

export const ADMIN_COOKIE = "sb_board_admin";

function adminPassword(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) {
    throw new Error("ADMIN_PASSWORD is not set. The admin screen is unavailable without it.");
  }
  return value;
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** Cookie value is a hash of the secret, so the secret never leaves the server. */
function adminToken(): string {
  return createHash("sha256").update(`sb-board:${adminPassword()}`).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function passwordMatches(submitted: string): boolean {
  if (!adminPasswordConfigured()) return false;
  return constantTimeEquals(submitted, adminPassword());
}

export async function isAdmin(): Promise<boolean> {
  if (!adminPasswordConfigured()) return false;
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return constantTimeEquals(token, adminToken());
}

export async function grantAdmin(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function revokeAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
