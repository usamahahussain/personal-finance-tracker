"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  FolderKanban,
  RefreshCcw,
  WalletCards
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/finance";

type HealthState = "checking" | "online" | "offline";

const navItems = [
  {
    href: "/transactions",
    label: "Transactions",
    icon: Activity
  },
  {
    href: "/balances",
    label: "Balances",
    icon: WalletCards
  },
  {
    href: "/categories",
    label: "Categories",
    icon: FolderKanban
  },
  {
    href: "/api-status",
    label: "API Status",
    icon: Database
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

  const activePath = pathname === "/" ? "/transactions" : pathname;

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">
            <BarChart3 />
          </span>
          <div>
            <p>Personal Finance Tracker</p>
            <h1>Finance Workspace</h1>
          </div>
        </div>

        <div className="topbarActions">
          <span className={`healthBadge ${health}`}>
            {health === "online" ? <CheckCircle2 /> : <AlertCircle />}
            {healthLabel(health)}
          </span>
          <button
            className="secondaryButton compact"
            type="button"
            onClick={checkDatabase}
            title="GET /database"
          >
            <RefreshCcw />
            Check
          </button>
        </div>
      </header>

      <nav className="pageNav" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePath === item.href;

          return (
            <Link
              className={active ? "active" : undefined}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {children}

      <footer>
        <Database aria-hidden="true" />
        <span>Proxy target: FASTAPI_BASE_URL</span>
      </footer>
    </main>
  );
}
