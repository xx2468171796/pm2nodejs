"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Button, Divider } from "@heroui/react";

export default function SettingsPage() {
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [usernameMsg, setUsernameMsg] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [isDefaultPwd, setIsDefaultPwd] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.success) {
        setUsername(d.data.username);
        setNewUsername(d.data.username);
        setIsDefaultPwd(d.data.isDefaultPassword);
      }
    });
  }, []);

  async function handleChangeUsername() {
    setUsernameMsg("");
    if (!newUsername.trim() || newUsername.trim().length < 2) {
      setUsernameMsg("用户名至少2个字符");
      return;
    }
    try {
      const res = await fetch("/api/auth/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername: newUsername.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setUsername(newUsername.trim());
        setUsernameMsg("修改成功");
      } else {
        setUsernameMsg(data.error);
      }
    } catch {
      setUsernameMsg("修改失败");
    }
  }

  async function handleChangePwd() {
    setPwdMsg("");
    if (!currentPwd || !newPwd) {
      setPwdMsg("请填写完整");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg("两次输入的新密码不一致");
      return;
    }
    if (newPwd.length < 4) {
      setPwdMsg("新密码至少4位");
      return;
    }
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (data.success) {
        setPwdMsg("密码修改成功");
        setCurrentPwd("");
        setNewPwd("");
        setConfirmPwd("");
        setIsDefaultPwd(false);
      } else {
        setPwdMsg(data.error);
      }
    } catch {
      setPwdMsg("修改失败");
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">设置</h1>

      {isDefaultPwd && (
        <Card className="bg-warning-50 border-warning">
          <CardBody>
            <p className="text-warning-700 font-medium">⚠️ 安全警告：当前使用默认密码，请立即修改！</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold">修改用户名</h2></CardHeader>
        <CardBody className="space-y-3">
          <Input label="用户名" value={newUsername} onValueChange={setNewUsername} />
          {usernameMsg && (
            <p className={`text-sm ${usernameMsg === "修改成功" ? "text-success" : "text-danger"}`}>{usernameMsg}</p>
          )}
          <Button color="primary" onPress={handleChangeUsername} isDisabled={newUsername === username}>
            保存用户名
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">修改密码</h2></CardHeader>
        <CardBody className="space-y-3">
          <Input label="当前密码" type="password" value={currentPwd} onValueChange={setCurrentPwd} />
          <Divider />
          <Input label="新密码" type="password" value={newPwd} onValueChange={setNewPwd} />
          <Input label="确认新密码" type="password" value={confirmPwd} onValueChange={setConfirmPwd} />
          {pwdMsg && (
            <p className={`text-sm ${pwdMsg === "密码修改成功" ? "text-success" : "text-danger"}`}>{pwdMsg}</p>
          )}
          <Button color="primary" onPress={handleChangePwd}>修改密码</Button>
        </CardBody>
      </Card>
    </div>
  );
}
