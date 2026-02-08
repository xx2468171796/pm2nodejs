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
  const [startupMsg, setStartupMsg] = useState("");
  const [snapshots, setSnapshots] = useState<{id:string;name:string;createdAt:string;processCount:number;type:string;processName:string|null}[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapName, setSnapName] = useState("");
  const [bootConfig, setBootConfig] = useState<Record<string, boolean>>({});
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

  async function fetchBootConfig() {
    try {
      const res = await fetch("/api/processes/boot");
      const data = await res.json();
      if (data.success) setBootConfig(data.data);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchProcesses();
    fetchSnapshots();
    fetchBootConfig();
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

  async function handleStartup(action: "save" | "enable" | "disable") {
    setActionLoading(`startup-${action}`);
    setStartupMsg("");
    try {
      const res = await fetch("/api/processes/startup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, machineId }),
      });
      const data = await res.json();
      if (data.success) {
        setStartupMsg(data.message);
      } else {
        setError(data.error);
      }
    } catch {
      setError("操作失败");
    } finally {
      setActionLoading(null);
      setTimeout(() => setStartupMsg(""), 5000);
    }
  }

  async function handleToggleBoot(processName: string, currentEnabled: boolean) {
    setActionLoading(`boot-${processName}`);
    try {
      const res = await fetch("/api/processes/boot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processName, enabled: !currentEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        setStartupMsg(data.message);
        setTimeout(() => setStartupMsg(""), 3000);
        await fetchBootConfig();
      } else {
        setError(data.error);
      }
    } catch {
      setError("切换开机启动失败");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleAutorestart(processId: number | string, currentValue: boolean) {
    setActionLoading(`autorestart-${processId}`);
    try {
      const res = await fetch(`/api/processes/${processId}/autorestart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: !currentValue, machineId }),
      });
      const data = await res.json();
      if (data.success) {
        setStartupMsg(data.message);
        setTimeout(() => setStartupMsg(""), 3000);
      } else {
        setError(data.error);
      }
      await fetchProcesses();
    } catch {
      setError("切换自动重启失败");
    } finally {
      setActionLoading(null);
    }
  }

  async function fetchSnapshots() {
    try {
      const res = await fetch("/api/snapshots");
      const data = await res.json();
      if (data.success) setSnapshots(data.data);
    } catch { /* ignore */ }
  }

  async function handleCreateSnapshot(processId?: number | string) {
    const key = processId !== undefined ? `snap-create-${processId}` : "snap-create";
    setActionLoading(key);
    try {
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: snapName || undefined, processId: processId ?? null }),
      });
      const data = await res.json();
      if (data.success) {
        setStartupMsg(data.message);
        setSnapName("");
        await fetchSnapshots();
        setTimeout(() => setStartupMsg(""), 3000);
      } else {
        setError(data.error);
      }
    } catch {
      setError("创建快照失败");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    if (!confirm("恢复快照将删除当前所有进程并替换为快照中的进程，确定继续？")) return;
    setActionLoading(`snap-restore-${snapshotId}`);
    try {
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", snapshotId }),
      });
      const data = await res.json();
      if (data.success) {
        setStartupMsg(data.message);
        await fetchProcesses();
        setTimeout(() => setStartupMsg(""), 3000);
      } else {
        setError(data.error);
      }
    } catch {
      setError("恢复快照失败");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteSnapshot(snapshotId: string) {
    setActionLoading(`snap-del-${snapshotId}`);
    try {
      await fetch("/api/snapshots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      await fetchSnapshots();
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
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
    <div className="space-y-5">
      {/* 顶部标题 + 操作栏 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">进程管理</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Switch size="sm" isSelected={autoRefresh} onValueChange={setAutoRefresh}>
            <span className="text-xs">自动刷新</span>
          </Switch>
          <Button size="sm" variant="bordered" onPress={fetchProcesses}>刷新</Button>
        </div>
      </div>

      {/* 提示消息 */}
      {startupMsg && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          {startupMsg}
        </div>
      )}
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
          <button className="ml-2 underline text-xs" onClick={() => setError("")}>关闭</button>
        </div>
      )}

      {/* 开机自启 + 快照 工具栏 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border border-slate-200 shadow-none">
          <CardBody className="py-3 px-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">开机自启动</p>
                <p className="text-xs text-slate-400">服务器重启后自动恢复所有进程</p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" color="success" variant="flat"
                  isLoading={actionLoading === "startup-enable"}
                  onPress={() => handleStartup("enable")}>开启</Button>
                <Button size="sm" color="danger" variant="flat"
                  isLoading={actionLoading === "startup-disable"}
                  onPress={() => handleStartup("disable")}>关闭</Button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <p className="text-xs text-slate-400">手动保存当前进程列表到启动配置</p>
              <Button size="sm" variant="flat"
                isLoading={actionLoading === "startup-save"}
                onPress={() => handleStartup("save")}>保存</Button>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-slate-200 shadow-none">
          <CardBody className="py-3 px-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">进程快照</p>
                <p className="text-xs text-slate-400">保存/恢复进程状态，类似 Docker 快照</p>
              </div>
              <Button size="sm" color="primary" variant="flat"
                isLoading={actionLoading === "snap-create"}
                onPress={() => handleCreateSnapshot()}>创建快照</Button>
            </div>
            {snapshots.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-slate-100 max-h-32 overflow-y-auto">
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.type === "single" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                        {s.type === "single" ? s.processName : "全局"}
                      </span>
                      <span className="font-medium text-slate-700 truncate">{s.name}</span>
                      <span className="text-slate-400 shrink-0">{s.processCount}个进程</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" color="success" variant="light" className="min-w-0 h-6 px-2 text-xs"
                        isLoading={actionLoading === `snap-restore-${s.id}`}
                        onPress={() => handleRestoreSnapshot(s.id)}>恢复</Button>
                      <Button size="sm" color="danger" variant="light" className="min-w-0 h-6 px-2 text-xs"
                        isLoading={actionLoading === `snap-del-${s.id}`}
                        onPress={() => handleDeleteSnapshot(s.id)}>删</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 进程列表为空 */}
      {processes.length === 0 && !error && (
        <Card className="border border-slate-200 shadow-none">
          <CardBody className="text-center py-16 text-slate-400">
            暂无 PM2 进程
          </CardBody>
        </Card>
      )}

      {/* 桌面端表格 */}
      {processes.length > 0 && (
        <Card className="border border-slate-200 shadow-none overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="text-left py-2.5 px-3 font-medium">ID</th>
                  <th className="text-left py-2.5 px-3 font-medium">名称</th>
                  <th className="text-left py-2.5 px-3 font-medium">状态</th>
                  <th className="text-left py-2.5 px-3 font-medium">CPU</th>
                  <th className="text-left py-2.5 px-3 font-medium">内存</th>
                  <th className="text-left py-2.5 px-3 font-medium">重启次数</th>
                  <th className="text-left py-2.5 px-3 font-medium">运行时间</th>
                  <th className="text-center py-2.5 px-3 font-medium" title="服务器重启后是否自动启动该进程">开机自启</th>
                  <th className="text-center py-2.5 px-3 font-medium" title="进程崩溃后是否自动重启">崩溃守护</th>
                  <th className="text-right py-2.5 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((p) => (
                  <tr key={p.pm_id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">{p.pm_id}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{p.name}</td>
                    <td className="py-2.5 px-3">
                      <Chip size="sm" color={STATUS_COLOR[p.status] || "default"} variant="flat">
                        {p.status}
                      </Chip>
                    </td>
                    <td className="py-2.5 px-3">{p.cpu}%</td>
                    <td className="py-2.5 px-3">{formatMemory(p.memory)}</td>
                    <td className="py-2.5 px-3">{p.restart_time}</td>
                    <td className="py-2.5 px-3">{formatUptime(p.uptime)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Switch size="sm"
                        isSelected={bootConfig[p.name] !== false}
                        isDisabled={actionLoading === `boot-${p.name}`}
                        onValueChange={() => handleToggleBoot(p.name, bootConfig[p.name] !== false)} />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Switch size="sm"
                        isSelected={p.autorestart}
                        isDisabled={actionLoading === `autorestart-${p.pm_id}`}
                        onValueChange={() => handleToggleAutorestart(p.pm_id, p.autorestart)} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
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
                        <Button size="sm" color="secondary" variant="flat"
                          isLoading={actionLoading === `snap-create-${p.pm_id}`}
                          onPress={() => handleCreateSnapshot(p.pm_id)}>快照</Button>
                        <Button size="sm" color="danger" variant="flat"
                          isLoading={actionLoading === `delete-${p.pm_id}`}
                          onPress={() => handleAction("delete", p.pm_id)}>删除</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端卡片列表 */}
          <div className="sm:hidden divide-y divide-slate-100">
            {processes.map((p) => (
              <div key={p.pm_id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">#{p.pm_id}</span>
                    <span className="font-semibold text-slate-800">{p.name}</span>
                  </div>
                  <Chip size="sm" color={STATUS_COLOR[p.status] || "default"} variant="flat">
                    {p.status}
                  </Chip>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">CPU</span><span>{p.cpu}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">内存</span><span>{formatMemory(p.memory)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">重启</span><span>{p.restart_time}次</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">运行</span><span>{formatUptime(p.uptime)}</span></div>
                </div>
                <div className="flex items-center justify-between py-1 border-t border-slate-100">
                  <span className="text-xs text-slate-500">开机自启</span>
                  <Switch size="sm"
                    isSelected={bootConfig[p.name] !== false}
                    isDisabled={actionLoading === `boot-${p.name}`}
                    onValueChange={() => handleToggleBoot(p.name, bootConfig[p.name] !== false)} />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-500">崩溃守护（自动重启）</span>
                  <Switch size="sm"
                    isSelected={p.autorestart}
                    isDisabled={actionLoading === `autorestart-${p.pm_id}`}
                    onValueChange={() => handleToggleAutorestart(p.pm_id, p.autorestart)} />
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
                  <Button size="sm" color="secondary" variant="flat"
                    isLoading={actionLoading === `snap-create-${p.pm_id}`}
                    onPress={() => handleCreateSnapshot(p.pm_id)}>快照</Button>
                  <Button size="sm" color="danger" variant="flat"
                    isLoading={actionLoading === `delete-${p.pm_id}`}
                    onPress={() => handleAction("delete", p.pm_id)}>删除</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 日志弹窗 */}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{logsProcessName} - 日志</ModalHeader>
          <ModalBody>
            <pre className="text-xs bg-slate-900 text-green-400 p-4 rounded-lg overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono">
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
