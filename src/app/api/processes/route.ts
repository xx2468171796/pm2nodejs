import { NextRequest, NextResponse } from "next/server";
import { getProcessList } from "@/lib/pm2-service";

export async function GET(request: NextRequest) {
  try {
    const machineId = Number(request.nextUrl.searchParams.get("machineId") || "0");
    const processes = await getProcessList(machineId || undefined);
    return NextResponse.json({ success: true, data: processes });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
