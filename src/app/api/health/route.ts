import { NextResponse } from "next/server";

import { ensureSchema, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates the schema if it is missing and reports what is in the table.
 * Hit this once after deploying to confirm the database is wired up.
 */
export async function GET() {
  const startedAt = Date.now();
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
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
