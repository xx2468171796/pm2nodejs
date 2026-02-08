"use client";

import { useState, useEffect } from "react";
import {
  Navbar, NavbarBrand, NavbarContent, NavbarItem,
  Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
} from "@heroui/react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import type { Machine } from "@/types";

interface AppNavbarProps {
  activeMachineId: number;
  onMachineChange: (id: number) => void;
}

export default function AppNavbar({ activeMachineId, onMachineChange }: AppNavbarProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [username, setUsername] = useState("");

  useEffect(() => {
    fetch("/api/machines").then((r) => r.json()).then((d) => {
      if (d.success) setMachines(d.data);
    });
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.success) setUsername(d.data.username);
    });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const activeName = activeMachineId === 0
    ? "本机"
    : machines.find((m) => m.id === activeMachineId)?.name || "未知";

  const navItems = [
    { label: "进程", href: "/" },
    { label: "监控", href: "/monitor" },
    { label: "机器", href: "/machines" },
    { label: "设置", href: "/settings" },
  ];

  return (
    <Navbar maxWidth="full" isBordered>
      <NavbarBrand>
        <p className="font-bold text-lg bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          PM2
        </p>
      </NavbarBrand>

      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        {navItems.map((item) => (
          <NavbarItem key={item.href} isActive={pathname === item.href}>
            <Button
              variant={pathname === item.href ? "flat" : "light"}
              color={pathname === item.href ? "primary" : "default"}
              size="sm"
              onPress={() => router.push(item.href)}
            >
              {item.label}
            </Button>
          </NavbarItem>
        ))}
      </NavbarContent>

      <NavbarContent justify="end" className="gap-2">
        <NavbarItem>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered" size="sm">
                {activeName}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="选择机器"
              selectionMode="single"
              selectedKeys={new Set([String(activeMachineId)])}
              onSelectionChange={(keys) => {
                const id = Number(Array.from(keys)[0]);
                onMachineChange(id);
              }}
            >
              {[
                <DropdownItem key="0">本机</DropdownItem>,
                ...machines.map((m) => (
                  <DropdownItem key={String(m.id)}>{m.name} ({m.host})</DropdownItem>
                )),
              ]}
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>

        <NavbarItem>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </Button>
        </NavbarItem>

        <NavbarItem>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm">{username || "用户"}</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="用户菜单">
              <DropdownItem key="settings" onPress={() => router.push("/settings")}>设置</DropdownItem>
              <DropdownItem key="logout" color="danger" className="text-danger" onPress={handleLogout}>
                登出
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
