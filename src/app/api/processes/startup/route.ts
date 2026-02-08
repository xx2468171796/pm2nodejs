import { NextRequest, NextResponse } from "next/server";
import { saveStartup, enableStartup, disableStartup } from "@/lib/pm2-service";

export async function POST(request: NextRequest) {
  try {
    const { action, machineId } = await request.json();

    if (action === "save") {
      await saveStartup(machineId || undefined);
      return NextResponse.json({ success: true, message: "进程列表已保存，重启后将自动恢复" });
    }

    if (action === "enable") {
      await enableStartup(machineId || undefined);
      return NextResponse.json({ success: true, message: "已启用开机自启动并保存当前进程" });
    }

    if (action === "disable") {
      await disableStartup(machineId || undefined);
      return NextResponse.json({ success: true, message: "已关闭开机自启动" });
    }

    return NextResponse.json({ success: false, error: "无效操作，支持: save, enable, disable" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
