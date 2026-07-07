"use client";

import { AlertTriangle, Banknote, RefreshCcw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BalanceResponse,
  apiRequest,
  formatMoney,
  getErrorMessage,
  toNumber
} from "@/lib/finance";
import { EmptyBlock, LoadingBlock, MetricTile, StatusMessage } from "@/components/ui";

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function BalancesPage() {
  const [balances, setBalances] = useState<BalanceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async (showNotice = false) => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const result = await apiRequest<BalanceResponse[]>("/balance");
      setBalances(result.data);

      if (showNotice) {
        setNotice(`Loaded ${result.data.length} account balances.`);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  const summary = useMemo(() => {
    const unavailable = balances.filter((balance) => balance.error === true).length;
    const total = balances.reduce(
      (sum, balance) =>
        balance.error === true ? sum : sum + toNumber(balance.balance),
      0
    );
    const institutions = new Set(
      balances.map((balance) => balance.institution || "Unknown institution")
    ).size;

    return {
      total,
      available: balances.length - unavailable,
      unavailable,
      institutions
    };
  }, [balances]);

  return (
    <>
      <section className="pageTop">
        <div>
          <p className="eyebrow">Current accounts</p>
          <h1>Balances</h1>
        </div>
        <div className="toolbar">
          <button
            className="primaryButton"
            type="button"
            onClick={() => loadBalances(true)}
            disabled={loading}
            title="GET /balance through FastAPI."
            aria-label="Reload account balances from FastAPI"
          >
            <RefreshCcw />
            <span>{loading ? "Loading balances" : "Reload balances"}</span>
          </button>
        </div>
      </section>

      <StatusMessage error={error} notice={notice} />

      <section className="metricGrid compactMetrics" aria-label="Balance summary">
        <MetricTile
          label="Balance total"
          value={formatMoney(summary.total)}
          detail={`${countLabel(summary.available, "available account")}`}
          tone="good"
          icon={<Banknote />}
        />
        <MetricTile
          label="Accounts"
          value={String(balances.length)}
          detail={countLabel(summary.institutions, "institution")}
          tone="neutral"
          icon={<WalletCards />}
        />
        <MetricTile
          label="Unavailable"
          value={String(summary.unavailable)}
          detail="accounts with balance errors"
          tone={summary.unavailable > 0 ? "warn" : "good"}
          icon={<AlertTriangle />}
        />
      </section>

      <section className="panel widePanel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">GET /balance</p>
            <h2>Account balances</h2>
          </div>
          <strong>{formatMoney(summary.total)}</strong>
        </div>

        {loading && balances.length === 0 ? (
          <LoadingBlock label="Loading balances" />
        ) : balances.length > 0 ? (
          <div className="balanceList">
            {balances.map((balance, index) => {
              const balanceUnavailable = balance.error === true;

              return (
                <div
                  className={balanceUnavailable ? "balanceRow balanceRowWarning" : "balanceRow"}
                  key={`${balance.account}-${balance.institution || "unknown"}-${index}`}
                >
                  <div>
                    <strong>{balance.account}</strong>
                    <span>{balance.institution || "Unknown institution"}</span>
                    {balanceUnavailable ? (
                      <span
                        className="balanceFailureHint"
                        title="Getting the balance for this account was unsuccessful."
                      >
                        <AlertTriangle aria-hidden="true" />
                        Balance unavailable
                      </span>
                    ) : null}
                  </div>
                  {balanceUnavailable ? (
                    <strong className="balanceUnavailableAmount">Unavailable</strong>
                  ) : (
                    <strong
                      className={toNumber(balance.balance) < 0 ? "amount negative" : "amount positive"}
                    >
                      {formatMoney(balance.balance)}
                    </strong>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyBlock
            icon={<WalletCards aria-hidden="true" />}
            title="No balances loaded"
            detail="Reload account balances when the backend is available."
          />
        )}
      </section>
    </>
  );
}
