import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "data", "boot-config.json");

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

function ensureDataDir() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readConfig(): Record<string, boolean> {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(config: Record<string, boolean>) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// GET - read boot config for all processes
export async function GET() {
  try {
    const config = readConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

// POST - toggle boot startup for a specific process and smart-save
export async function POST(request: NextRequest) {
  try {
    const { processName, enabled } = await request.json();

    if (!processName) {
      return NextResponse.json({ success: false, error: "需要指定进程名称" }, { status: 400 });
    }

    // Update config
    const config = readConfig();
    config[processName] = !!enabled;
    writeConfig(config);

    // Smart save: stop processes that should NOT boot-start, save, then restart them
    const output = await execCommand("pm2", ["jlist"]);
    const processes = JSON.parse(output);

    const toStopAndRestart: string[] = [];

    for (const p of processes) {
      const name = p.name as string;
      const env = p.pm2_env as Record<string, unknown> || {};
      const status = env.status as string;

      // If process is running but boot is disabled, temporarily stop it for save
      if (config[name] === false && status === "online") {
        toStopAndRestart.push(name);
      }
    }

    // Temporarily stop non-boot processes
    for (const name of toStopAndRestart) {
      try { await execCommand("pm2", ["stop", name]); } catch { /* ignore */ }
    }

    // Save current state (only running processes will be restored on boot)
    await execCommand("pm2", ["save", "--force"]);

    // Restart the temporarily stopped processes
    for (const name of toStopAndRestart) {
      try { await execCommand("pm2", ["start", name]); } catch { /* ignore */ }
    }

    const msg = enabled
      ? `${processName} 已加入开机启动`
      : `${processName} 已移出开机启动`;

    return NextResponse.json({ success: true, message: msg });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
