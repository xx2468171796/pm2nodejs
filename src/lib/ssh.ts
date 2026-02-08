import { Client } from "ssh2";
import { decrypt } from "./crypto";
import { getDb } from "./db";
import type { Machine } from "@/types";

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

function getMachineSSHConfig(machineId: number): SSHConfig {
  const db = getDb();
  const machine = db.prepare("SELECT * FROM machines WHERE id = ?").get(machineId) as Machine | undefined;
  if (!machine) throw new Error("Machine not found");

  const credential = decrypt(machine.encrypted_credential);
  const config: SSHConfig = {
    host: machine.host,
    port: machine.port,
    username: machine.ssh_user,
  };

  if (machine.auth_type === "password") {
    config.password = credential;
  } else {
    config.privateKey = credential;
  }

  return config;
}

export function executeSSHCommand(machineId: number, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const config = getMachineSSHConfig(machineId);
    const conn = new Client();

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error("SSH connection timeout (10s)"));
    }, 10000);

    const wrappedCommand = `source ~/.bashrc 2>/dev/null; source ~/.profile 2>/dev/null; export PATH=$PATH:/usr/local/bin:/usr/bin:$HOME/.npm-global/bin; ${command}`;

    conn
      .on("ready", () => {
        clearTimeout(timeout);
        conn.exec(wrappedCommand, (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          let stdout = "";
          let stderr = "";

          stream
            .on("data", (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });

          stream.on("close", () => {
            conn.end();
            if (stderr && !stdout) {
              reject(new Error(stderr));
            } else {
              resolve(stdout);
            }
          });
        });
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`SSH error: ${err.message}`));
      })
      .connect({
        ...config,
        readyTimeout: 10000,
      });
  });
}

export async function testSSHConnection(machineId: number): Promise<string> {
  const output = await executeSSHCommand(machineId, "pm2 --version");
  return output.trim();
}
