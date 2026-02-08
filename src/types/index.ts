export interface PM2Process {
  pm_id: number;
  name: string;
  pid: number;
  status: "online" | "stopped" | "errored" | "launching";
  restart_time: number;
  uptime: number;
  cpu: number;
  memory: number;
  pm2_env?: {
    exec_mode: string;
    node_version: string;
    pm_exec_path: string;
  };
}

export interface Machine {
  id: number;
  name: string;
  host: string;
  port: number;
  ssh_user: string;
  auth_type: "password" | "key";
  encrypted_credential: string;
  created_at: string;
  updated_at: string;
}

export interface MachineFormData {
  name: string;
  host: string;
  port: number;
  ssh_user: string;
  auth_type: "password" | "key";
  credential: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface MetricRecord {
  id: number;
  machine_id: string;
  cpu_percent: number;
  mem_used_mb: number;
  mem_total_mb: number;
  timestamp: number;
}

export interface SystemInfo {
  cpuPercent: number;
  memUsedMb: number;
  memTotalMb: number;
  uptime: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
