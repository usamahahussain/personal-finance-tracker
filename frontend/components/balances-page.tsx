"use client";

import { Banknote, RefreshCcw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BalanceResponse,
  apiRequest,
  formatMoney,
  getErrorMessage,
  toNumber
} from "@/lib/finance";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Stat,
  StatusMessage
} from "@/components/ui";

export function BalancesPage() {
  const [balances, setBalances] = useState<BalanceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async (showNotice = false) => {
    setLoading(true);
    setError(null);

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
    const total = balances.reduce(
      (sum, balance) => sum + toNumber(balance.balance),
      0
    );
    const institutions = new Set(
      balances.map((balance) => balance.institution || "Unknown")
    ).size;

    return {
      total,
      institutions
    };
  }, [balances]);

  return (
    <>
      <PageHeader
        kicker="Balances"
        title="Account Balances"
        description="Current balances returned by FastAPI for connected accounts."
        actions={
          <button
            className="primaryButton"
            type="button"
            onClick={() => loadBalances(true)}
            disabled={loading}
            title="GET /balance"
          >
            <RefreshCcw />
            Reload
          </button>
        }
      />

      <StatusMessage error={error} notice={notice} />

      <section className="statGrid compactStats" aria-label="Balance totals">
        <Stat
          label="Balance total"
          value={formatMoney(summary.total)}
          icon={<Banknote />}
        />
        <Stat
          label="Accounts"
          value={String(balances.length)}
          icon={<WalletCards />}
        />
        <Stat
          label="Institutions"
          value={String(summary.institutions)}
          icon={<Banknote />}
        />
      </section>

      <section className="sectionBlock">
        {loading && balances.length === 0 ? (
          <LoadingState title="Loading balances" />
        ) : balances.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Institution</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance, index) => {
                  const amountClass =
                    toNumber(balance.balance) < 0
                      ? "amount outbound"
                      : "amount inbound";

                  return (
                    <tr
                      key={`${balance.account}-${balance.institution || "unknown"}-${index}`}
                    >
                      <td>
                        <strong>{balance.account}</strong>
                      </td>
                      <td>{balance.institution || "-"}</td>
                      <td className={amountClass}>{formatMoney(balance.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<WalletCards />}
            title="No balances loaded"
            detail="Reload account balances when the backend is available."
          />
        )}
      </section>
    </>
  );
}
