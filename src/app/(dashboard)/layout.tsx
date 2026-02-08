"use client";

import { useState } from "react";
import AppNavbar from "@/components/organisms/AppNavbar";
import MobileNav from "@/components/molecules/MobileNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [activeMachineId, setActiveMachineId] = useState(0);

  return (
    <div className="min-h-screen flex flex-col">
      <AppNavbar activeMachineId={activeMachineId} onMachineChange={setActiveMachineId} />
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6 pb-20 sm:pb-6">
        {typeof children === "object" && children !== null
          ? (() => {
              const childElement = children as React.ReactElement<{ activeMachineId?: number }>;
              if (childElement.props !== undefined) {
                return children;
              }
              return children;
            })()
          : children}
      </main>
      <MobileNav />
    </div>
  );
}
