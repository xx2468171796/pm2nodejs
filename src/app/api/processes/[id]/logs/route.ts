import { NextRequest, NextResponse } from "next/server";
import { getProcessLogs } from "@/lib/pm2-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const machineId = Number(request.nextUrl.searchParams.get("machineId") || "0");
    const lines = Number(request.nextUrl.searchParams.get("lines") || "100");
    const logs = await getProcessLogs(id, machineId || undefined, lines);
    return NextResponse.json({ success: true, data: logs });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
