import { execFile } from "child_process";
import { getDb } from "./db";
import { executeSSHCommand } from "./ssh";
import type { SystemInfo, MetricRecord } from "@/types";

function execLocal(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function parseWindowsMetrics(cpuOutput: string, memOutput: string): SystemInfo {
  const cpuLines = cpuOutput.trim().split("\n").filter(Boolean);
  const cpuPercent = parseFloat(cpuLines[cpuLines.length - 1]?.trim() || "0");

  const memLines = memOutput.trim().split("\n").filter(Boolean);
  const lastLine = memLines[memLines.length - 1]?.trim() || "";
  const parts = lastLine.split(/\s+/);
  const totalMb = parseFloat(parts[0] || "0");
  const freeMb = parseFloat(parts[1] || "0");
  const usedMb = totalMb - freeMb;

  return { cpuPercent, memUsedMb: usedMb, memTotalMb: totalMb, uptime: "" };
}

function parseLinuxMetrics(output: string): SystemInfo {
  const lines = output.trim().split("\n");
  let cpuPercent = 0;
  let memUsedMb = 0;
  let memTotalMb = 0;
  let uptime = "";

  for (const line of lines) {
    if (line.startsWith("CPU:")) {
      cpuPercent = parseFloat(line.split(":")[1]?.trim() || "0");
    } else if (line.startsWith("MEM_TOTAL:")) {
      memTotalMb = parseFloat(line.split(":")[1]?.trim() || "0");
    } else if (line.startsWith("MEM_USED:")) {
      memUsedMb = parseFloat(line.split(":")[1]?.trim() || "0");
    } else if (line.startsWith("UPTIME:")) {
      uptime = line.split(":").slice(1).join(":").trim();
    }
  }

  return { cpuPercent, memUsedMb, memTotalMb, uptime };
}

const LINUX_METRICS_CMD = `
  echo "CPU:$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1)"
  echo "MEM_TOTAL:$(free -m | awk '/Mem:/{print $2}')"
  echo "MEM_USED:$(free -m | awk '/Mem:/{print $3}')"
  echo "UPTIME:$(uptime -p 2>/dev/null || uptime)"
`.trim();

export async function collectLocalMetrics(): Promise<SystemInfo> {
  if (process.platform === "win32") {
    const [cpuOut, memOut] = await Promise.all([
      execLocal("wmic", ["cpu", "get", "LoadPercentage", "/value"]).then((o) => {
        const match = o.match(/LoadPercentage=(\d+)/);
        return match ? match[1] : "0";
      }),
      execLocal("wmic", ["OS", "get", "TotalVisibleMemorySize,FreePhysicalMemory", "/value"]).then((o) => {
        const total = (o.match(/TotalVisibleMemorySize=(\d+)/) || [])[1] || "0";
        const free = (o.match(/FreePhysicalMemory=(\d+)/) || [])[1] || "0";
        return `${Math.round(parseInt(total) / 1024)} ${Math.round(parseInt(free) / 1024)}`;
      }),
    ]);
    return parseWindowsMetrics(cpuOut, memOut);
  }

  const output = await execLocal("bash", ["-c", LINUX_METRICS_CMD]);
  return parseLinuxMetrics(output);
}

export async function collectRemoteMetrics(machineId: number): Promise<SystemInfo> {
  const output = await executeSSHCommand(machineId, LINUX_METRICS_CMD);
  return parseLinuxMetrics(output);
}

export async function collectMetrics(machineId?: number): Promise<SystemInfo> {
  if (!machineId || machineId === 0) {
    return collectLocalMetrics();
  }
  return collectRemoteMetrics(machineId);
}

export function saveMetric(machineIdStr: string, info: SystemInfo): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO metrics (machine_id, cpu_percent, mem_used_mb, mem_total_mb, timestamp) VALUES (?, ?, ?, ?, ?)"
  ).run(machineIdStr, info.cpuPercent, info.memUsedMb, info.memTotalMb, Date.now());
}

export function getMetricHistory(machineIdStr: string, fromTimestamp: number): MetricRecord[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM metrics WHERE machine_id = ? AND timestamp >= ? ORDER BY timestamp ASC")
    .all(machineIdStr, fromTimestamp) as MetricRecord[];
}

export function cleanupOldMetrics(): void {
  const db = getDb();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM metrics WHERE timestamp < ?").run(cutoff);
}
