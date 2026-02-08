import * as localPm2 from "./pm2";
import { executeSSHCommand } from "./ssh";
import type { PM2Process } from "@/types";

export async function getProcessList(machineId?: number): Promise<PM2Process[]> {
  if (!machineId || machineId === 0) {
    return localPm2.listProcesses();
  }

  const output = await executeSSHCommand(machineId, "pm2 jlist");
  const raw = JSON.parse(output);
  return raw.map((p: Record<string, unknown>) => ({
    pm_id: p.pm_id,
    name: p.name,
    pid: p.pid,
    status: (p.pm2_env as Record<string, unknown>)?.status || "stopped",
    restart_time: (p.pm2_env as Record<string, unknown>)?.restart_time || 0,
    uptime: (p.pm2_env as Record<string, unknown>)?.pm_uptime || 0,
    cpu: (p.monit as Record<string, unknown>)?.cpu || 0,
    memory: (p.monit as Record<string, unknown>)?.memory || 0,
  }));
}

export async function processAction(
  action: "start" | "stop" | "restart" | "delete",
  processId: number | string,
  machineId?: number
): Promise<string> {
  if (!machineId || machineId === 0) {
    switch (action) {
      case "start": return localPm2.startProcess(processId);
      case "stop": return localPm2.stopProcess(processId);
      case "restart": return localPm2.restartProcess(processId);
      case "delete": return localPm2.deleteProcess(processId);
    }
  }

  return executeSSHCommand(machineId, `pm2 ${action} ${processId}`);
}

export async function getProcessLogs(
  processId: number | string,
  machineId?: number,
  lines = 100
): Promise<string> {
  if (!machineId || machineId === 0) {
    return localPm2.getProcessLogs(processId, lines);
  }

  return executeSSHCommand(machineId, `pm2 logs ${processId} --lines ${lines} --nostream`);
}
