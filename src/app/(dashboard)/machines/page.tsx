"use client";

import { useState, useEffect } from "react";
import {
  Card, CardBody, Button, Input, Chip, Spinner,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Select, SelectItem, Textarea,
} from "@heroui/react";
import type { Machine, MachineFormData } from "@/types";

const emptyForm: MachineFormData = {
  name: "", host: "", port: 22, ssh_user: "root", auth_type: "password", credential: "",
};

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<MachineFormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [testResults, setTestResults] = useState<Record<number, string>>({});
  const [setupLoading, setSetupLoading] = useState<number | null>(null);
  const [setupLog, setSetupLog] = useState<Record<number, string>>({});
  const { isOpen, onOpen, onClose } = useDisclosure();

  async function fetchMachines() {
    try {
      const res = await fetch("/api/machines");
      const data = await res.json();
      if (data.success) setMachines(data.data);
    } catch { /* ignore */ }
    setIsLoading(false);
  }

  useEffect(() => { fetchMachines(); }, []);

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setFormError("");
    onOpen();
  }

  function openEdit(m: Machine) {
    setEditId(m.id);
    setForm({ name: m.name, host: m.host, port: m.port, ssh_user: m.ssh_user, auth_type: m.auth_type, credential: "" });
    setFormError("");
    onOpen();
  }

  async function handleSave() {
    setFormError("");
    if (!form.name || !form.host || !form.ssh_user) {
      setFormError("请填写所有必填字段");
      return;
    }
    if (!editId && !form.credential) {
      setFormError("请填写密码或密钥");
      return;
    }

    try {
      const url = editId ? `/api/machines/${editId}` : "/api/machines";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error);
        return;
      }
      onClose();
      fetchMachines();
    } catch {
      setFormError("保存失败");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除该机器？")) return;
    await fetch(`/api/machines/${id}`, { method: "DELETE" });
    fetchMachines();
  }

  async function handleSetup(id: number) {
    setSetupLoading(id);
    setSetupLog((prev) => ({ ...prev, [id]: "正在安装环境，请稍候（可能需要1-2分钟）..." }));
    try {
      const res = await fetch(`/api/machines/${id}/setup`, { method: "POST" });
      const data = await res.json();
      setSetupLog((prev) => ({
        ...prev,
        [id]: data.success ? `✅ 安装完成\n${data.data?.log || ""}` : `❌ ${data.error}\n${data.data?.log || ""}`,
      }));
    } catch {
      setSetupLog((prev) => ({ ...prev, [id]: "❌ 安装失败：网络错误" }));
    } finally {
      setSetupLoading(null);
    }
  }

  async function handleTest(id: number) {
    setTestResults((prev) => ({ ...prev, [id]: "测试中..." }));
    try {
      const res = await fetch(`/api/machines/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [id]: data.success ? `连接成功, PM2 v${data.data.pm2Version}` : `失败: ${data.error}`,
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: "测试失败" }));
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">远程机器</h1>
        <Button color="primary" onPress={openAdd}>添加机器</Button>
      </div>

      {machines.length === 0 && (
        <Card>
          <CardBody className="text-center py-12 text-default-500">
            暂无远程机器，点击"添加机器"开始配置
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {machines.map((m) => (
          <Card key={m.id}>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">{m.name}</span>
                <Chip size="sm" variant="flat">{m.auth_type === "password" ? "密码" : "密钥"}</Chip>
              </div>
              <div className="text-sm text-default-500 space-y-1">
                <p>地址: {m.host}:{m.port}</p>
                <p>用户: {m.ssh_user}</p>
              </div>
              {testResults[m.id] && (
                <p className={`text-xs ${testResults[m.id].startsWith("连接成功") ? "text-success" : "text-danger"}`}>
                  {testResults[m.id]}
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" color="primary" variant="flat" onPress={() => handleTest(m.id)}>测试连接</Button>
                <Button size="sm" color="success" variant="flat"
                  isLoading={setupLoading === m.id}
                  onPress={() => handleSetup(m.id)}>安装环境</Button>
                <Button size="sm" variant="flat" onPress={() => openEdit(m)}>编辑</Button>
                <Button size="sm" color="danger" variant="flat" onPress={() => handleDelete(m.id)}>删除</Button>
              </div>
              {setupLog[m.id] && (
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-slate-600">
                  {setupLog[m.id]}
                </pre>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>{editId ? "编辑机器" : "添加机器"}</ModalHeader>
          <ModalBody className="space-y-3">
            <Input label="名称" placeholder="如：生产服务器" value={form.name}
              onValueChange={(v) => setForm((p) => ({ ...p, name: v }))} isRequired />
            <div className="grid grid-cols-3 gap-3">
              <Input className="col-span-2" label="主机地址" placeholder="IP 或域名" value={form.host}
                onValueChange={(v) => setForm((p) => ({ ...p, host: v }))} isRequired />
              <Input label="端口" type="number" value={String(form.port)}
                onValueChange={(v) => setForm((p) => ({ ...p, port: Number(v) || 22 }))} />
            </div>
            <Input label="SSH 用户" value={form.ssh_user}
              onValueChange={(v) => setForm((p) => ({ ...p, ssh_user: v }))} isRequired />
            <Select label="认证方式" selectedKeys={[form.auth_type]}
              onSelectionChange={(keys) => setForm((p) => ({ ...p, auth_type: Array.from(keys)[0] as "password" | "key" }))}>
              <SelectItem key="password">密码</SelectItem>
              <SelectItem key="key">SSH 私钥</SelectItem>
            </Select>
            {form.auth_type === "password" ? (
              <Input label={editId ? "新密码 (留空不修改)" : "密码"} type="password" value={form.credential}
                onValueChange={(v) => setForm((p) => ({ ...p, credential: v }))} isRequired={!editId} />
            ) : (
              <Textarea label={editId ? "新私钥 (留空不修改)" : "SSH 私钥内容"} value={form.credential}
                onValueChange={(v) => setForm((p) => ({ ...p, credential: v }))} minRows={4} isRequired={!editId} />
            )}
            {formError && <p className="text-danger text-sm">{formError}</p>}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>取消</Button>
            <Button color="primary" onPress={handleSave}>保存</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
