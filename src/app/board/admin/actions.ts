"use server";

import {
  adminPasswordConfigured,
  grantAdmin,
  isAdmin,
  passwordMatches,
  revokeAdmin,
} from "@/lib/admin-auth";
import {
  getAdminEntries,
  hideSeedEntries,
  seedExamples,
  setEntryHidden,
  type AdminEntry,
} from "@/lib/entries";

export type AdminResult =
  | { ok: true; entries: AdminEntry[]; note?: string }
  | { ok: false; message: string };

async function guard(): Promise<string | null> {
  if (!adminPasswordConfigured()) return "ADMIN_PASSWORD is not set on this deployment.";
  if (!(await isAdmin())) return "Signed out. Enter the password again.";
  return null;
}

export async function signIn(password: string): Promise<{ ok: boolean; message?: string }> {
  if (!adminPasswordConfigured()) {
    return { ok: false, message: "ADMIN_PASSWORD is not set on this deployment." };
  }
  if (!passwordMatches(password)) {
    return { ok: false, message: "That password does not match." };
  }
  await grantAdmin();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await revokeAdmin();
}

export async function refreshEntries(): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };
  try {
    return { ok: true, entries: await getAdminEntries() };
  } catch (error) {
    console.error("[admin] refresh failed", error);
    return { ok: false, message: "Could not read the board." };
  }
}

export async function toggleHidden(id: string, hidden: boolean): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };
  try {
    await setEntryHidden(id, hidden);
    return { ok: true, entries: await getAdminEntries() };
  } catch (error) {
    console.error("[admin] toggle failed", error);
    return { ok: false, message: "Could not change that entry." };
  }
}

export async function seedBoard(): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };
  try {
    const result = await seedExamples();
    return {
      ok: true,
      entries: await getAdminEntries(),
      note: result.alreadySeeded
        ? "The three examples are already on the board."
        : "Three examples added.",
    };
  } catch (error) {
    console.error("[admin] seed failed", error);
    return { ok: false, message: "Could not add the examples." };
  }
}

export async function clearSeeds(): Promise<AdminResult> {
  const denied = await guard();
  if (denied) return { ok: false, message: denied };
  try {
    const count = await hideSeedEntries();
    return {
      ok: true,
      entries: await getAdminEntries(),
      note: count === 0 ? "No examples were showing." : `${count} examples hidden.`,
    };
  } catch (error) {
    console.error("[admin] clear seeds failed", error);
    return { ok: false, message: "Could not hide the examples." };
  }
}
