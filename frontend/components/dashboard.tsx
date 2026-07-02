"use client";

import {
  Activity,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  Database,
  PlugZap,
  RefreshCcw,
  Search,
  WalletCards
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccountBalance,
  RawBalance,
  RawTransaction,
  Transaction,
  formatCompactMoney,
  formatDateTime,
  formatMoney,
  groupTransactionsByMerchant,
  normaliseBalance,
  normaliseTransaction,
  sortByAbsoluteAmount
} from "@/lib/finance";

type HealthState = "checking" | "online" | "offline";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      payload?.detail ||
      payload?.error ||
      `Request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return payload as T;
}

function statusLabel(state: HealthState) {
  if (state === "checking") {
    return "Checking";
  }

  return state === "online" ? "Online" : "Offline";
}

function StatusIcon({ state }: { state: HealthState }) {
  if (state === "online") {
    return <CheckCircle2 aria-hidden="true" />;
  }

  if (state === "offline") {
    return <AlertCircle aria-hidden="true" />;
  }

  return <Activity aria-hidden="true" />;
}

function Kpi({
  label,
  value,
  detail,
  tone,
  icon
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "blue" | "amber" | "red";
  icon: React.ReactNode;
}) {
  return (
    <article className={`kpi kpi-${tone}`}>
      <div className="kpiIcon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function EmptyState({
  icon,
  title,
  detail
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="emptyState">
      <div className="emptyIcon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [health, setHealth] = useState<HealthState>("checking");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [query, setQuery] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [balanceResult, healthResult] = await Promise.allSettled([
      apiRequest<RawBalance[]>("balance"),
      apiRequest<{ status?: string }>("database")
    ]);

    if (balanceResult.status === "fulfilled") {
      setBalances(balanceResult.value.map(normaliseBalance));
      setLastLoaded(new Date());
    } else {
      setBalances([]);
      setError(balanceResult.reason.message);
    }

    setHealth(
      healthResult.status === "fulfilled" &&
        healthResult.value.status?.toUpperCase() === "OK"
        ? "online"
        : "offline"
    );

    if (healthResult.status === "rejected" && !error) {
      setError(healthResult.reason.message);
    }

    setLoading(false);
  }, [error]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const refreshTransactions = async () => {
    setSyncing(true);
    setError(null);

    try {
      const payload = await apiRequest<RawTransaction[]>("refresh", {
        method: "POST"
      });
      setTransactions(payload.map(normaliseTransaction));
      setLastRefresh(new Date());
      await loadDashboard();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Refresh failed"
      );
    } finally {
      setSyncing(false);
    }
  };

  const totalBalance = useMemo(
    () => balances.reduce((total, account) => total + account.amount, 0),
    [balances]
  );

  const institutionCount = useMemo(
    () => new Set(balances.map((account) => account.institution)).size,
    [balances]
  );

  const filteredBalances = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return sortByAbsoluteAmount(balances);
    }

    return sortByAbsoluteAmount(
      balances.filter((account) =>
        `${account.account} ${account.institution}`.toLowerCase().includes(term)
      )
    );
  }, [balances, query]);

  const maxAccountBalance = useMemo(
    () =>
      Math.max(
        1,
        ...balances.map((account) => Math.abs(account.amount))
      ),
    [balances]
  );

  const transactionSummary = useMemo(() => {
    const credits = transactions
      .filter((transaction) => transaction.amount > 0)
      .reduce((total, transaction) => total + transaction.amount, 0);
    const debits = transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

    return {
      credits,
      debits,
      net: transactions.reduce(
        (total, transaction) => total + transaction.amount,
        0
      )
    };
  }, [transactions]);

  const topMerchants = useMemo(
    () => groupTransactionsByMerchant(transactions).slice(0, 6),
    [transactions]
  );

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, 10),
    [transactions]
  );

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brandBlock">
          <div className="brandMark" aria-hidden="true">
            <WalletCards />
          </div>
          <div>
            <p>Personal Finance Tracker</p>
            <h1>Finance Dashboard</h1>
          </div>
        </div>

        <div className="topbarActions">
          <button
            className="iconButton"
            type="button"
            onClick={loadDashboard}
            disabled={loading || syncing}
            title="Reload balances"
            aria-label="Reload balances"
          >
            <RefreshCcw aria-hidden="true" />
          </button>
          <button
            className="primaryButton"
            type="button"
            onClick={refreshTransactions}
            disabled={syncing}
          >
            <PlugZap aria-hidden="true" />
            <span>{syncing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </header>

      {error ? (
        <section className="alertBar" role="status">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </section>
      ) : null}

      <section className="kpiGrid" aria-label="Summary">
        <Kpi
          label="Visible Balance"
          value={formatMoney(totalBalance)}
          detail={`${balances.length} accounts loaded`}
          tone={totalBalance >= 0 ? "green" : "red"}
          icon={<Banknote />}
        />
        <Kpi
          label="Institutions"
          value={String(institutionCount)}
          detail="From FastAPI balances"
          tone="blue"
          icon={<Database />}
        />
        <Kpi
          label="Backend"
          value={statusLabel(health)}
          detail="Database health endpoint"
          tone={health === "online" ? "green" : health === "offline" ? "red" : "amber"}
          icon={<StatusIcon state={health} />}
        />
        <Kpi
          label="Last Loaded"
          value={lastLoaded ? formatDateTime(lastLoaded) : "Pending"}
          detail={`Refresh payload: ${transactions.length} rows`}
          tone="amber"
          icon={<Clock3 />}
        />
      </section>

      <section className="workspace">
        <div className="mainColumn">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <p>Accounts</p>
                <h2>Balances</h2>
              </div>
              <label className="searchBox">
                <Search aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search accounts"
                />
              </label>
            </div>

            {loading ? (
              <EmptyState
                icon={<Activity />}
                title="Loading balances"
                detail="Waiting for FastAPI to return account data."
              />
            ) : filteredBalances.length > 0 ? (
              <div className="accountList">
                {filteredBalances.map((account) => {
                  const width = `${Math.max(
                    5,
                    (Math.abs(account.amount) / maxAccountBalance) * 100
                  )}%`;

                  return (
                    <article className="accountRow" key={account.id}>
                      <div>
                        <strong>{account.account}</strong>
                        <span>{account.institution}</span>
                      </div>
                      <div className="accountAmount">
                        <strong>{formatMoney(account.amount)}</strong>
                        <div
                          className={
                            account.amount >= 0
                              ? "balanceTrack positive"
                              : "balanceTrack negative"
                          }
                          aria-hidden="true"
                        >
                          <span style={{ width }} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<WalletCards />}
                title="No balances returned"
                detail="The dashboard is connected, but the balance endpoint returned an empty list."
              />
            )}
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p>Lunchflow</p>
                <h2>Refresh Payload</h2>
              </div>
              <span className="timestamp">{formatDateTime(lastRefresh)}</span>
            </div>

            {transactions.length > 0 ? (
              <>
                <div className="flowGrid">
                  <div className="flowMetric">
                    <ArrowUpCircle aria-hidden="true" />
                    <span>Credits</span>
                    <strong>{formatMoney(transactionSummary.credits)}</strong>
                  </div>
                  <div className="flowMetric">
                    <ArrowDownCircle aria-hidden="true" />
                    <span>Debits</span>
                    <strong>{formatMoney(transactionSummary.debits)}</strong>
                  </div>
                  <div className="flowMetric">
                    <Activity aria-hidden="true" />
                    <span>Net</span>
                    <strong>{formatMoney(transactionSummary.net)}</strong>
                  </div>
                </div>

                <div className="transactionTable">
                  <div className="tableHead">
                    <span>Date</span>
                    <span>Merchant</span>
                    <span>Account</span>
                    <span>Amount</span>
                  </div>
                  {recentTransactions.map((transaction) => (
                    <div className="tableRow" key={transaction.id}>
                      <span>
                        {transaction.date
                          ? new Intl.DateTimeFormat("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            }).format(new Date(transaction.date))
                          : "Unknown"}
                      </span>
                      <span>
                        <strong>{transaction.merchant}</strong>
                        <small>{transaction.description}</small>
                      </span>
                      <span>{transaction.accountName}</span>
                      <span
                        className={
                          transaction.amount >= 0 ? "amountIn" : "amountOut"
                        }
                      >
                        {formatMoney(transaction.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<PlugZap />}
                title="No refresh payload yet"
                detail="Refresh will display the raw transactions returned by FastAPI."
              />
            )}
          </section>
        </div>

        <aside className="sideRail">
          <section className="panel compactPanel">
            <div className="panelHeader">
              <div>
                <p>Coverage</p>
                <h2>Backend Surface</h2>
              </div>
            </div>
            <div className="endpointList">
              <span className="endpoint online">GET /balance</span>
              <span className="endpoint online">GET /database</span>
              <span className="endpoint online">POST /refresh</span>
              <span className="endpoint pending">Ledger API pending</span>
              <span className="endpoint pending">Categories API pending</span>
            </div>
          </section>

          <section className="panel compactPanel">
            <div className="panelHeader">
              <div>
                <p>Schema</p>
                <h2>Finance Objects</h2>
              </div>
            </div>
            <div className="schemaList">
              {[
                "Accounts",
                "Transactions",
                "Merchants",
                "Categories",
                "Recurring obligations"
              ].map((item) => (
                <div key={item}>
                  <Database aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel compactPanel">
            <div className="panelHeader">
              <div>
                <p>Merchants</p>
                <h2>Refresh Leaders</h2>
              </div>
            </div>
            {topMerchants.length > 0 ? (
              <div className="merchantList">
                {topMerchants.map((merchant) => (
                  <div key={merchant.merchant} className="merchantRow">
                    <div>
                      <strong>{merchant.merchant}</strong>
                      <span>{merchant.count} transactions</span>
                    </div>
                    <span>{formatCompactMoney(merchant.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Activity />}
                title="No merchant totals"
                detail="Merchant rollups appear after a refresh payload is returned."
              />
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
