import { execFile } from "child_process";
import { PM2Process } from "@/types";

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

export async function listProcesses(): Promise<PM2Process[]> {
  try {
    const output = await execCommand("pm2", ["jlist"]);
    const raw = JSON.parse(output);
    return raw.map((p: Record<string, unknown>) => {
      const env = p.pm2_env as Record<string, unknown> || {};
      return {
        pm_id: p.pm_id,
        name: p.name,
        pid: p.pid,
        status: env.status || "stopped",
        restart_time: env.restart_time || 0,
        uptime: env.pm_uptime || 0,
        cpu: (p.monit as Record<string, unknown>)?.cpu || 0,
        memory: (p.monit as Record<string, unknown>)?.memory || 0,
        autorestart: env.autorestart !== false,
        watch: !!env.watch,
        script: (env.pm_exec_path as string) || "",
      };
    });
  } catch (err) {
    throw new Error(`PM2 not available: ${(err as Error).message}`);
  }
}

export async function startProcess(id: number | string): Promise<string> {
  return execCommand("pm2", ["start", String(id)]);
}

export async function stopProcess(id: number | string): Promise<string> {
  return execCommand("pm2", ["stop", String(id)]);
}

export async function restartProcess(id: number | string): Promise<string> {
  return execCommand("pm2", ["restart", String(id)]);
}

export async function deleteProcess(id: number | string): Promise<string> {
  return execCommand("pm2", ["delete", String(id)]);
}

export async function getProcessLogs(id: number | string, lines = 100): Promise<string> {
  return execCommand("pm2", ["logs", String(id), "--lines", String(lines), "--nostream"]);
}

export async function saveProcessList(): Promise<string> {
  return execCommand("pm2", ["save"]);
}

export async function setupStartup(): Promise<string> {
  return execCommand("pm2", ["startup", "systemd", "-u", "root", "--hp", "/root"]);
}

export async function removeStartup(): Promise<string> {
  return execCommand("pm2", ["unstartup", "systemd"]);
}
