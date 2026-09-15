"use server";

import { cookies } from "next/headers";

import {
  ROOM_COOKIE,
  ROOM_COOKIE_MAX_AGE,
  codeMatches,
  roomToken,
} from "@/lib/room-access";
import { isSecureRequest } from "@/lib/secure-cookie";

export async function enterRoom(code: string): Promise<{ ok: boolean; message?: string }> {
  if (!(await codeMatches(code))) {
    return { ok: false, message: "That code does not match. Check the slide at the front." };
  }

  const token = await roomToken();
  if (token) {
    const store = await cookies();
    store.set(ROOM_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: await isSecureRequest(),
      path: "/",
      maxAge: ROOM_COOKIE_MAX_AGE,
    });
  }
  return { ok: true };
}
