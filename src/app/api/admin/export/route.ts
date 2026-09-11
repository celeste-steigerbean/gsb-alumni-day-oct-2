import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { bucketLabel } from "@/lib/buckets";
import { getAdminEntries } from "@/lib/entries";
import { displayFunctionLabel } from "@/lib/functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 4180 quoting, with a guard against spreadsheet formula injection. */
function csvCell(value: string): string {
  const unsafeLead = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${unsafeLead.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const entries = await getAdminEntries();
  const header = [
    "id",
    "created_at",
    "bucket",
    "bucket_label",
    "function_label",
    "function_display",
    "task",
    "hidden",
    "submitter_cookie_id",
  ];

  const lines = [header.join(",")];
  for (const entry of entries) {
    lines.push(
      [
        csvCell(entry.id),
        csvCell(entry.created_at),
        csvCell(entry.bucket),
        csvCell(bucketLabel(entry.bucket)),
        csvCell(entry.function_label),
        csvCell(displayFunctionLabel(entry.function_label)),
        csvCell(entry.task),
        csvCell(entry.hidden ? "true" : "false"),
        csvCell(entry.submitter_cookie_id),
      ].join(","),
    );
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  // The BOM keeps Excel on a Mac from mangling anything non ascii.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="session-board-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
