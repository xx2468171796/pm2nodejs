import * as localPm2 from "./pm2";
import { executeSSHCommand } from "./ssh";
import type { PM2Process } from "@/types";

export async function getProcessList(machineId?: number): Promise<PM2Process[]> {
  if (!machineId || machineId === 0) {
    return localPm2.listProcesses();
  }

  const output = await executeSSHCommand(machineId, "pm2 jlist");
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

export async function saveStartup(machineId?: number): Promise<string> {
  if (!machineId || machineId === 0) {
    return localPm2.saveProcessList();
  }
  return executeSSHCommand(machineId, "pm2 save");
}

export async function enableStartup(machineId?: number): Promise<string> {
  if (!machineId || machineId === 0) {
    await localPm2.setupStartup();
    return localPm2.saveProcessList();
  }
  await executeSSHCommand(machineId, "pm2 startup systemd -u root --hp /root --no-daemon 2>/dev/null || pm2 startup 2>/dev/null || true");
  return executeSSHCommand(machineId, "pm2 save");
}

export async function disableStartup(machineId?: number): Promise<string> {
  if (!machineId || machineId === 0) {
    return localPm2.removeStartup();
  }
  return executeSSHCommand(machineId, "pm2 unstartup systemd 2>/dev/null || pm2 unstartup 2>/dev/null || true");
}
