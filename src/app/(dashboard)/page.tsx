"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import {
  Card, CardBody, Button, Chip, Spinner,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Switch,
} from "@heroui/react";
import { useSearchParams } from "next/navigation";
import type { PM2Process } from "@/types";

const STATUS_COLOR: Record<string, "success" | "default" | "danger" | "warning"> = {
  online: "success",
  stopped: "default",
  errored: "danger",
  launching: "warning",
};

function formatUptime(ms: number): string {
  if (!ms) return "-";
  const diff = Date.now() - ms;
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${mins}m`;
}

function formatMemory(bytes: number): string {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ProcessesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" /></div>}>
      <ProcessesContent />
    </Suspense>
  );
}

function ProcessesContent() {
  const searchParams = useSearchParams();
  const machineId = Number(searchParams.get("machineId") || "0");

  const [processes, setProcesses] = useState<PM2Process[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logs, setLogs] = useState("");
  const [logsProcessName, setLogsProcessName] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchProcesses = useCallback(async () => {
    try {
      const res = await fetch(`/api/processes?machineId=${machineId}`);
      const data = await res.json();
      if (data.success) {
        setProcesses(data.data);
        setError("");
      } else {
        setError(data.error);
      }
    } catch {
      setError("获取进程列表失败");
    } finally {
      setIsLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchProcesses, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchProcesses]);

  async function handleAction(action: string, processId: number | string) {
    const key = `${action}-${processId}`;
    setActionLoading(key);
    try {
      await fetch(`/api/processes/${processId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, machineId }),
      });
      await fetchProcesses();
    } catch {
      setError(`操作失败`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleViewLogs(processId: number | string, name: string) {
    setLogsProcessName(name);
    setLogs("加载中...");
    onOpen();
    try {
      const res = await fetch(`/api/processes/${processId}/logs?machineId=${machineId}`);
      const data = await res.json();
      setLogs(data.success ? data.data : data.error);
    } catch {
      setLogs("获取日志失败");
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">进程管理</h1>
        <div className="flex items-center gap-3">
          <Switch size="sm" isSelected={autoRefresh} onValueChange={setAutoRefresh}>
            自动刷新
          </Switch>
          <Button size="sm" variant="bordered" onPress={fetchProcesses}>刷新</Button>
        </div>
      </div>

      {error && (
        <Card className="bg-danger-50 border-danger-200">
          <CardBody><p className="text-danger text-sm">{error}</p></CardBody>
        </Card>
      )}

      {processes.length === 0 && !error && (
        <Card>
          <CardBody className="text-center py-12 text-default-500">
            暂无 PM2 进程
          </CardBody>
        </Card>
      )}

      <div className="hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-default-500">
                <th className="text-left py-3 px-2">ID</th>
                <th className="text-left py-3 px-2">名称</th>
                <th className="text-left py-3 px-2">状态</th>
                <th className="text-left py-3 px-2">CPU</th>
                <th className="text-left py-3 px-2">内存</th>
                <th className="text-left py-3 px-2">重启</th>
                <th className="text-left py-3 px-2">运行时间</th>
                <th className="text-right py-3 px-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => (
                <tr key={p.pm_id} className="border-b border-divider/50 hover:bg-default-50">
                  <td className="py-3 px-2">{p.pm_id}</td>
                  <td className="py-3 px-2 font-medium">{p.name}</td>
                  <td className="py-3 px-2">
                    <Chip size="sm" color={STATUS_COLOR[p.status] || "default"} variant="flat">
                      {p.status}
                    </Chip>
                  </td>
                  <td className="py-3 px-2">{p.cpu}%</td>
                  <td className="py-3 px-2">{formatMemory(p.memory)}</td>
                  <td className="py-3 px-2">{p.restart_time}</td>
                  <td className="py-3 px-2">{formatUptime(p.uptime)}</td>
                  <td className="py-3 px-2 text-right space-x-1">
                    {p.status === "stopped" ? (
                      <Button size="sm" color="success" variant="flat"
                        isLoading={actionLoading === `start-${p.pm_id}`}
                        onPress={() => handleAction("start", p.pm_id)}>启动</Button>
                    ) : (
                      <Button size="sm" color="warning" variant="flat"
                        isLoading={actionLoading === `stop-${p.pm_id}`}
                        onPress={() => handleAction("stop", p.pm_id)}>停止</Button>
                    )}
                    <Button size="sm" color="primary" variant="flat"
                      isLoading={actionLoading === `restart-${p.pm_id}`}
                      onPress={() => handleAction("restart", p.pm_id)}>重启</Button>
                    <Button size="sm" variant="flat"
                      onPress={() => handleViewLogs(p.pm_id, p.name)}>日志</Button>
                    <Button size="sm" color="danger" variant="flat"
                      isLoading={actionLoading === `delete-${p.pm_id}`}
                      onPress={() => handleAction("delete", p.pm_id)}>删除</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sm:hidden space-y-3">
        {processes.map((p) => (
          <Card key={p.pm_id}>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                <Chip size="sm" color={STATUS_COLOR[p.status] || "default"} variant="flat">
                  {p.status}
                </Chip>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-default-500">
                <span>PID: {p.pid}</span>
                <span>CPU: {p.cpu}%</span>
                <span>内存: {formatMemory(p.memory)}</span>
                <span>重启: {p.restart_time}次</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {p.status === "stopped" ? (
                  <Button size="sm" color="success" variant="flat"
                    isLoading={actionLoading === `start-${p.pm_id}`}
                    onPress={() => handleAction("start", p.pm_id)}>启动</Button>
                ) : (
                  <Button size="sm" color="warning" variant="flat"
                    isLoading={actionLoading === `stop-${p.pm_id}`}
                    onPress={() => handleAction("stop", p.pm_id)}>停止</Button>
                )}
                <Button size="sm" color="primary" variant="flat"
                  isLoading={actionLoading === `restart-${p.pm_id}`}
                  onPress={() => handleAction("restart", p.pm_id)}>重启</Button>
                <Button size="sm" variant="flat"
                  onPress={() => handleViewLogs(p.pm_id, p.name)}>日志</Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{logsProcessName} - 日志</ModalHeader>
          <ModalBody>
            <pre className="text-xs bg-black text-green-400 p-4 rounded-lg overflow-auto max-h-[60vh] whitespace-pre-wrap">
              {logs}
            </pre>
          </ModalBody>
          <ModalFooter>
            <Button onPress={onClose}>关闭</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
