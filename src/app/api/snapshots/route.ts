import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "snapshots");

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

function ensureDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

function getProcessConfig(p: Record<string, unknown>) {
  const env = p.pm2_env as Record<string, unknown> || {};
  return {
    name: p.name,
    script: env.pm_exec_path,
    cwd: env.pm_cwd,
    autorestart: env.autorestart,
    watch: env.watch,
    exec_mode: env.exec_mode,
    args: env.args,
    node_args: env.node_args,
    instances: env.instances,
    max_memory_restart: env.max_memory_restart,
  };
}

// GET - list snapshots, optionally filtered by processName
export async function GET(request: NextRequest) {
  try {
    ensureDir();
    const processName = request.nextUrl.searchParams.get("processName");
    const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith(".json")).sort().reverse();
    const snapshots = files.map(f => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, f), "utf-8"));
        return {
          id: f.replace(".json", ""),
          name: content.name || f.replace(".json", ""),
          createdAt: content.createdAt || "",
          processCount: content.processes?.length || 0,
          processName: content.processName || null,
          type: content.processName ? "single" : "global",
        };
      } catch { return null; }
    }).filter(Boolean);

    const filtered = processName
      ? snapshots.filter(s => s && (s.processName === processName || s.type === "global"))
      : snapshots;

    return NextResponse.json({ success: true, data: filtered });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

// POST - create or restore snapshot (global or per-process)
export async function POST(request: NextRequest) {
  try {
    const { action, name, snapshotId, processId } = await request.json();

    if (action === "create") {
      ensureDir();
      const output = await execCommand("pm2", ["jlist"]);
      const allProcesses = JSON.parse(output);
      const id = `snap_${Date.now()}`;

      if (processId !== undefined && processId !== null) {
        // Per-process snapshot
        const proc = allProcesses.find((p: Record<string, unknown>) =>
          String(p.pm_id) === String(processId) || p.name === String(processId)
        );
        if (!proc) {
          return NextResponse.json({ success: false, error: "进程不存在" }, { status: 404 });
        }
        const config = getProcessConfig(proc);
        const snapshot = {
          name: name || `${config.name} - ${new Date().toLocaleString("zh-CN")}`,
          processName: config.name,
          createdAt: new Date().toISOString(),
          processes: [config],
        };
        fs.writeFileSync(path.join(SNAPSHOT_DIR, `${id}.json`), JSON.stringify(snapshot, null, 2));
        return NextResponse.json({ success: true, message: `进程快照已创建: ${config.name}`, data: { id } });
      } else {
        // Global snapshot (all processes)
        const snapshot = {
          name: name || `全局快照 ${new Date().toLocaleString("zh-CN")}`,
          processName: null,
          createdAt: new Date().toISOString(),
          processes: allProcesses.map((p: Record<string, unknown>) => getProcessConfig(p)),
        };
        fs.writeFileSync(path.join(SNAPSHOT_DIR, `${id}.json`), JSON.stringify(snapshot, null, 2));
        return NextResponse.json({ success: true, message: `全局快照已创建 (${snapshot.processes.length}个进程)`, data: { id } });
      }
    }

    if (action === "restore") {
      if (!snapshotId) {
        return NextResponse.json({ success: false, error: "需要指定快照ID" }, { status: 400 });
      }
      ensureDir();
      const filePath = path.join(SNAPSHOT_DIR, `${snapshotId}.json`);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ success: false, error: "快照不存在" }, { status: 404 });
      }
      const snapshot = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      if (snapshot.processName) {
        // Per-process restore: delete old process with same name, then recreate
        try { await execCommand("pm2", ["delete", snapshot.processName]); } catch { /* may not exist */ }
      } else {
        // Global restore: delete all
        try { await execCommand("pm2", ["delete", "all"]); } catch { /* ignore */ }
      }

      const restored: string[] = [];
      for (const proc of snapshot.processes) {
        if (!proc.script) continue;
        const args = ["start", proc.script, "--name", proc.name];
        if (proc.cwd) args.push("--cwd", proc.cwd);
        if (proc.autorestart === false) args.push("--no-autorestart");
        if (proc.watch) args.push("--watch");
        try {
          await execCommand("pm2", args);
          restored.push(proc.name);
        } catch (e) {
          console.error(`Failed to restore ${proc.name}:`, (e as Error).message);
        }
      }
      await execCommand("pm2", ["save"]);
      return NextResponse.json({
        success: true,
        message: `已恢复 ${restored.length} 个进程: ${restored.join(", ")}`,
      });
    }

    return NextResponse.json({ success: false, error: "无效操作" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request: NextRequest) {
  try {
    const { snapshotId } = await request.json();
    if (!snapshotId) {
      return NextResponse.json({ success: false, error: "需要指定快照ID" }, { status: 400 });
    }
    ensureDir();
    const filePath = path.join(SNAPSHOT_DIR, `${snapshotId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return NextResponse.json({ success: true, message: "快照已删除" });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
