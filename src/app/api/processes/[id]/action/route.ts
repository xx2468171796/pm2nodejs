import { NextRequest, NextResponse } from "next/server";
import { processAction } from "@/lib/pm2-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action, machineId } = await request.json();

    if (!["start", "stop", "restart", "delete"].includes(action)) {
      return NextResponse.json({ success: false, error: "无效操作" }, { status: 400 });
    }

    await processAction(action, id, machineId || undefined);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
