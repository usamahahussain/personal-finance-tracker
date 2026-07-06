"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  LayoutDashboard,
  ReceiptText,
  RefreshCcw,
  Tags
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/finance";

type HealthState = "checking" | "online" | "offline";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: ReceiptText
  },
  {
    href: "/categories",
    label: "Categories",
    icon: Tags
  }
];

function healthLabel(state: HealthState) {
  if (state === "checking") {
    return "Checking";
  }

  return state === "online" ? "Online" : "Offline";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthState>("checking");

  const checkDatabase = useCallback(async () => {
    setHealth("checking");

    try {
      const result = await apiRequest<{ status: string }>("/database");
      setHealth(result.data.status === "OK" ? "online" : "offline");
    } catch {
      setHealth("offline");
    }
  }, []);

  useEffect(() => {
    void checkDatabase();
  }, [checkDatabase]);

  return (
    <main className="shell">
      <header className="masthead">
        <Link className="brandLink" href="/">
          <span className="brandMark" aria-hidden="true">
            <Database />
          </span>
          <span>
            <strong>Finance</strong>
            <small>Monthly workspace</small>
          </span>
        </Link>

        <nav className="mainNav" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link className={active ? "active" : undefined} href={item.href} key={item.href}>
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="healthCluster">
          <span className={`healthBadge ${health}`}>
            {health === "online" ? <CheckCircle2 /> : <AlertCircle />}
            {healthLabel(health)}
          </span>
          <button
            className="iconTextButton"
            type="button"
            onClick={checkDatabase}
            title="GET /database through FastAPI and update the Online/Offline badge."
            aria-label="Check FastAPI database health"
          >
            <RefreshCcw />
            <span>Check database</span>
          </button>
        </div>
      </header>

      <div className="workspace">{children}</div>
    </main>
  );
}
