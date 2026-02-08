"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Card, CardBody, CardHeader, Button, Spinner, ButtonGroup } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { SystemInfo, MetricRecord } from "@/types";

type TimeRange = "1h" | "6h" | "24h";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" /></div>}>
      <MonitorContent />
    </Suspense>
  );
}

function MonitorContent() {
  const searchParams = useSearchParams();
  const machineId = searchParams.get("machineId") || "local";

  const [currentInfo, setCurrentInfo] = useState<SystemInfo | null>(null);
  const [history, setHistory] = useState<MetricRecord[]>([]);
  const [range, setRange] = useState<TimeRange>("1h");
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/metrics?machineId=${machineId}&range=${range}`);
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch { /* ignore */ }
  }, [machineId, range]);

  const collectMetric = useCallback(async () => {
    try {
      const numId = machineId === "local" ? undefined : machineId;
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: numId }),
      });
      const data = await res.json();
      if (data.success) setCurrentInfo(data.data);
    } catch { /* ignore */ }
  }, [machineId]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([collectMetric(), fetchHistory()]).finally(() => setIsLoading(false));
  }, [collectMetric, fetchHistory]);

  useEffect(() => {
    const interval = setInterval(() => {
      collectMetric();
      fetchHistory();
    }, 10000);
    return () => clearInterval(interval);
  }, [collectMetric, fetchHistory]);

  const chartData = history.map((m) => ({
    time: formatTime(m.timestamp),
    cpu: Math.round(m.cpu_percent * 10) / 10,
    memUsed: Math.round(m.mem_used_mb),
    memTotal: Math.round(m.mem_total_mb),
    memPercent: m.mem_total_mb > 0 ? Math.round((m.mem_used_mb / m.mem_total_mb) * 1000) / 10 : 0,
  }));

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  const memPercent = currentInfo && currentInfo.memTotalMb > 0
    ? Math.round((currentInfo.memUsedMb / currentInfo.memTotalMb) * 1000) / 10
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">系统监控</h1>
        <ButtonGroup size="sm" variant="bordered">
          {(["1h", "6h", "24h"] as TimeRange[]).map((r) => (
            <Button
              key={r}
              color={range === r ? "primary" : "default"}
              variant={range === r ? "solid" : "bordered"}
              onPress={() => setRange(r)}
            >
              {r}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardBody className="text-center py-4">
            <p className="text-xs text-default-500">CPU</p>
            <p className="text-2xl font-bold text-primary">{currentInfo?.cpuPercent ?? "-"}%</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-4">
            <p className="text-xs text-default-500">内存使用</p>
            <p className="text-2xl font-bold text-secondary">{memPercent}%</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-4">
            <p className="text-xs text-default-500">已用内存</p>
            <p className="text-2xl font-bold">{currentInfo?.memUsedMb?.toFixed(0) ?? "-"} MB</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center py-4">
            <p className="text-xs text-default-500">总内存</p>
            <p className="text-2xl font-bold">{currentInfo?.memTotalMb?.toFixed(0) ?? "-"} MB</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">CPU 使用率 (%)</h2></CardHeader>
        <CardBody>
          <div className="w-full h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cpu" stroke="#006FEE" name="CPU %" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">内存使用 (MB)</h2></CardHeader>
        <CardBody>
          <div className="w-full h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="memUsed" stroke="#9353D3" name="已用 MB" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="memTotal" stroke="#71717A" name="总计 MB" strokeWidth={1} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
