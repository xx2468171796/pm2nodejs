"use client";

import { useState } from "react";
import { Button, Input, Card, CardBody, CardHeader } from "@heroui/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "登录失败");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-950 via-background to-purple-950">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 items-center pt-8 pb-2">
          <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            PM2 Manager
          </div>
          <p className="text-default-500 text-sm">轻量级 PM2 进程管理工具</p>
        </CardHeader>
        <CardBody className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="用户名"
              placeholder="请输入用户名"
              value={username}
              onValueChange={setUsername}
              variant="bordered"
              isRequired
            />
            <Input
              label="密码"
              placeholder="请输入密码"
              type="password"
              value={password}
              onValueChange={setPassword}
              variant="bordered"
              isRequired
            />
            {error && (
              <p className="text-danger text-sm text-center">{error}</p>
            )}
            <Button
              type="submit"
              color="primary"
              isLoading={isLoading}
              className="mt-2"
              size="lg"
            >
              登录
            </Button>
          </form>
          <p className="text-default-400 text-xs text-center mt-4">
            默认账户: admin / admin
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
