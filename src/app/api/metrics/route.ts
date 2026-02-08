import { NextRequest, NextResponse } from "next/server";
import { collectMetrics, saveMetric, getMetricHistory, cleanupOldMetrics } from "@/lib/metrics";

export async function GET(request: NextRequest) {
  try {
    const machineId = request.nextUrl.searchParams.get("machineId") || "local";
    const range = request.nextUrl.searchParams.get("range") || "1h";

    let fromTimestamp: number;
    const now = Date.now();
    switch (range) {
      case "6h": fromTimestamp = now - 6 * 60 * 60 * 1000; break;
      case "24h": fromTimestamp = now - 24 * 60 * 60 * 1000; break;
      default: fromTimestamp = now - 60 * 60 * 1000; break;
    }

    const history = getMetricHistory(machineId, fromTimestamp);
    return NextResponse.json({ success: true, data: history });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { machineId } = await request.json();
    const numericId = machineId ? Number(machineId) : 0;
    const machineIdStr = machineId ? String(machineId) : "local";

    const info = await collectMetrics(numericId || undefined);
    saveMetric(machineIdStr, info);
    cleanupOldMetrics();

    return NextResponse.json({ success: true, data: info });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
