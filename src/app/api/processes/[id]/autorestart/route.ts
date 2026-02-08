import { NextRequest, NextResponse } from "next/server";
import { executeSSHCommand } from "@/lib/ssh";
import { execFile } from "child_process";

function execCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

async function getProcessInfo(id: string, machineId?: number) {
  const cmd = machineId ? await executeSSHCommand(machineId, "pm2 jlist") : await execCommand("pm2", ["jlist"]);
  const list = JSON.parse(cmd);
  return list.find((p: Record<string, unknown>) => String(p.pm_id) === id || p.name === id);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { enable, machineId } = await request.json();

    const proc = await getProcessInfo(id, machineId || undefined);
    if (!proc) {
      return NextResponse.json({ success: false, error: "进程不存在" }, { status: 404 });
    }

    const env = proc.pm2_env as Record<string, unknown> || {};
    const script = env.pm_exec_path as string;
    const name = proc.name as string;
    const cwd = env.pm_cwd as string || "";

    if (!script) {
      return NextResponse.json({ success: false, error: "无法获取进程脚本路径" }, { status: 400 });
    }

    const autorestartFlag = enable ? "" : "--no-autorestart";
    const cwdFlag = cwd ? `--cwd "${cwd}"` : "";

    if (!machineId || machineId === 0) {
      await execCommand("pm2", ["delete", id]);
      const args = ["start", script, "--name", name];
      if (cwd) args.push("--cwd", cwd);
      if (!enable) args.push("--no-autorestart");
      await execCommand("pm2", args);
      await execCommand("pm2", ["save"]);
    } else {
      await executeSSHCommand(machineId, `pm2 delete ${id}`);
      await executeSSHCommand(machineId, `pm2 start "${script}" --name "${name}" ${cwdFlag} ${autorestartFlag}`);
      await executeSSHCommand(machineId, "pm2 save");
    }

    return NextResponse.json({ success: true, message: enable ? "已开启自动重启" : "已关闭自动重启" });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
