"use client";

import {
  Activity,
  CheckCircle2,
  Database,
  RefreshCcw,
  WalletCards,
  X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  apiRequest,
  formatDateTime,
  formatPayload,
  getErrorMessage
} from "@/lib/finance";
import { PageHeader, StatusMessage } from "@/components/ui";

type RouteKey = "database" | "balances" | "categories" | "transactions" | "refresh";
type RouteState = "idle" | "loading" | "success" | "error";

type RouteDefinition = {
  key: RouteKey;
  method: "GET" | "POST";
  path: string;
  label: string;
};

type RouteLog = RouteDefinition & {
  state: RouteState;
  status: number | null;
  updatedAt: Date | null;
  detail: string;
  payload: unknown;
};

const routeDefinitions: RouteDefinition[] = [
  {
    key: "database",
    method: "GET",
    path: "/database",
    label: "Database"
  },
  {
    key: "balances",
    method: "GET",
    path: "/balance",
    label: "Balances"
  },
  {
    key: "categories",
    method: "GET",
    path: "/categories",
    label: "Categories"
  },
  {
    key: "transactions",
    method: "GET",
    path: "/transactions",
    label: "Transactions"
  },
  {
    key: "refresh",
    method: "POST",
    path: "/refresh",
    label: "Refresh"
  }
];

function createInitialRouteLogs() {
  return routeDefinitions.reduce(
    (logs, route) => ({
      ...logs,
      [route.key]: {
        ...route,
        state: "idle",
        status: null,
        updatedAt: null,
        detail: "Not called",
        payload: null
      }
    }),
    {} as Record<RouteKey, RouteLog>
  );
}

function stateLabel(state: RouteState) {
  if (state === "loading") {
    return "Loading";
  }

  if (state === "success") {
    return "OK";
  }

  if (state === "error") {
    return "Error";
  }

  return "Idle";
}

export function ApiStatusPage() {
  const [routeLogs, setRouteLogs] = useState(createInitialRouteLogs);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runRoute = useCallback(async (route: RouteDefinition) => {
    setError(null);
    setNotice(null);
    setRouteLogs((current) => ({
      ...current,
      [route.key]: {
        ...current[route.key],
        state: "loading",
        detail: `Calling ${route.path}`,
        updatedAt: new Date(),
        payload: null
      }
    }));

    try {
      const result = await apiRequest<unknown>(
        route.path,
        route.method === "POST" ? { method: "POST" } : undefined
      );
      setRouteLogs((current) => ({
        ...current,
        [route.key]: {
          ...current[route.key],
          state: "success",
          status: result.status,
          detail: `${route.method} ${route.path}`,
          updatedAt: new Date(),
          payload: result.data
        }
      }));
      setNotice(`${route.label} completed.`);
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      setRouteLogs((current) => ({
        ...current,
        [route.key]: {
          ...current[route.key],
          state: "error",
          status: requestError instanceof ApiError ? requestError.status : null,
          detail: message,
          updatedAt: new Date(),
          payload: message
        }
      }));
      setError(message);
    }
  }, []);

  const checkDatabase = useCallback(async () => {
    await runRoute(routeDefinitions[0]);
  }, [runRoute]);

  useEffect(() => {
    void checkDatabase();
  }, [checkDatabase]);

  return (
    <>
      <PageHeader
        kicker="API Status"
        title="Backend Activity"
        description="Run backend checks and inspect recent route responses."
        actions={
          <button
            className="primaryButton"
            type="button"
            onClick={checkDatabase}
            title="GET /database"
          >
            <Database />
            Check Database
          </button>
        }
      />

      <StatusMessage error={error} notice={notice} />

      <section className="routeGrid" aria-label="Backend routes">
        {routeDefinitions.map((route) => {
          const log = routeLogs[route.key];
          const isRefresh = route.key === "refresh";

          return (
            <article className="routeItem" key={route.key}>
              <div className="routeTopline">
                <span className={`method ${route.method.toLowerCase()}`}>
                  {route.method}
                </span>
                <span className={`routeState ${log.state}`}>
                  {log.state === "error" ? <X /> : <CheckCircle2 />}
                  {stateLabel(log.state)}
                </span>
              </div>
              <strong>{route.label}</strong>
              <code>{route.path}</code>
              <span>{log.status ? `HTTP ${log.status}` : log.detail}</span>
              <small>{formatDateTime(log.updatedAt)}</small>
              <button
                className={isRefresh ? "primaryButton" : "secondaryButton"}
                type="button"
                onClick={() => runRoute(route)}
                disabled={log.state === "loading"}
                title={`${route.method} ${route.path}`}
              >
                {isRefresh ? (
                  <RefreshCcw />
                ) : route.key === "balances" ? (
                  <WalletCards />
                ) : (
                  <Activity />
                )}
                Run
              </button>
              <details>
                <summary>Response</summary>
                <pre>{formatPayload(log.payload)}</pre>
              </details>
            </article>
          );
        })}
      </section>
    </>
  );
}
