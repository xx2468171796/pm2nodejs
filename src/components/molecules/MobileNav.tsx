"use client";

import { Button } from "@heroui/react";
import { useRouter, usePathname } from "next/navigation";

const navItems = [
  { label: "进程", href: "/", icon: "⚡" },
  { label: "监控", href: "/monitor", icon: "📊" },
  { label: "机器", href: "/machines", icon: "🖥" },
  { label: "设置", href: "/settings", icon: "⚙️" },
];

export default function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-divider z-50">
      <div className="flex justify-around py-2">
        {navItems.map((item) => (
          <Button
            key={item.href}
            variant="light"
            size="sm"
            className={`flex flex-col items-center min-w-0 gap-0 ${
              pathname === item.href ? "text-primary" : "text-default-500"
            }`}
            onPress={() => router.push(item.href)}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
