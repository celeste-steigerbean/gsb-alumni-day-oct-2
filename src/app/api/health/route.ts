import { NextResponse } from "next/server";

import { ensureSchema, query, resolveDatabaseVar, usableDatabaseVars } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates the schema if it is missing and reports what is in the table.
 * Hit this once after deploying to confirm the database is wired up.
 *
 * On failure it also reports which environment this deployment is running as
 * and which database variables it can see, by name only. Never a value: the
 * connection string carries the password.
 */
export async function GET() {
  const startedAt = Date.now();

  const environment = {
    vercelEnv: process.env.VERCEL_ENV ?? "not on vercel",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    adminPasswordSet: Boolean(process.env.ADMIN_PASSWORD),
    databaseVar: resolveDatabaseVar(),
    databaseVarsSeen: usableDatabaseVars(),
  };

  try {
    await ensureSchema();
    const rows = await query<{ visible: string; total: string }>(
      `SELECT count(*) FILTER (WHERE hidden = FALSE)::text AS visible,
              count(*)::text AS total
         FROM entries`,
    );
    return NextResponse.json(
      {
        ok: true,
        schema: "ready",
        visible: Number(rows[0]?.visible ?? 0),
        total: Number(rows[0]?.total ?? 0),
        ms: Date.now() - startedAt,
        environment,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/health] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown",
        ms: Date.now() - startedAt,
        environment,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
