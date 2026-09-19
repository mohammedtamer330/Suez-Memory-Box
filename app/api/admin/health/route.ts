import { NextResponse } from "next/server";
import { requireAdmin, safeError } from "@/lib/guard";
import { runChecks } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ checks: await runChecks() });
  } catch (e) {
    return safeError(e, "The system check couldn't run.");
  }
}
