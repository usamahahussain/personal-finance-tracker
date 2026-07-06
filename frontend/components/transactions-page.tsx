"use client";

import { Activity, CircleDollarSign, RefreshCcw, Tags, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshResponse,
  TransactionResponse,
  apiRequest,
  formatDate,
  formatMoney,
  formatSignedTransaction,
  getErrorMessage,
  signedTransactionAmount
} from "@/lib/finance";
import {
  DirectionBadge,
  EmptyState,
  LoadingState,
  PageHeader,
  Stat,
  StatusMessage
} from "@/components/ui";

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async (showNotice = false) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<TransactionResponse[]>("/transactions");
      setTransactions(result.data);

      if (showNotice) {
        setNotice(`Loaded ${result.data.length} transactions.`);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const summary = useMemo(() => {
    const total = transactions.reduce(
      (sum, transaction) => sum + signedTransactionAmount(transaction),
      0
    );
    const uncategorized = transactions.filter(
      (transaction) => !transaction.category_name
    ).length;
    const accounts = new Set(
      transactions.map((transaction) => transaction.account_name)
    ).size;

    return {
      total,
      uncategorized,
      accounts
    };
  }, [transactions]);

  async function refreshTransactions() {
    setRefreshing(true);
    setError(null);
    setNotice(null);

    try {
      const result = await apiRequest<RefreshResponse>("/refresh", {
        method: "POST"
      });
      setNotice(
        `Refresh inserted ${result.data.inserted} of ${result.data.received} transactions.`
      );
      await loadTransactions();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Transactions"
        title="All Transactions"
        description="Every transaction field currently returned by FastAPI."
        actions={
          <>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => loadTransactions(true)}
              disabled={loading}
              title="GET /transactions"
            >
              <Activity />
              Load
            </button>
            <button
              className="primaryButton"
              type="button"
              onClick={refreshTransactions}
              disabled={refreshing}
              title="POST /refresh"
            >
              <RefreshCcw />
              Refresh
            </button>
          </>
        }
      />

      <StatusMessage error={error} notice={notice} />

      <section className="statGrid" aria-label="Transaction totals">
        <Stat
          label="Transactions"
          value={String(transactions.length)}
          icon={<Activity />}
        />
        <Stat
          label="Signed total"
          value={formatMoney(summary.total)}
          icon={<CircleDollarSign />}
        />
        <Stat
          label="Accounts"
          value={String(summary.accounts)}
          icon={<WalletCards />}
        />
        <Stat
          label="Uncategorized"
          value={String(summary.uncategorized)}
          icon={<Tags />}
        />
      </section>

      <section className="sectionBlock">
        {loading && transactions.length === 0 ? (
          <LoadingState title="Loading transactions" />
        ) : transactions.length > 0 ? (
          <div className="tableWrap">
            <table className="transactionsTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Reference</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th>Institution</th>
                  <th>Direction</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => {
                  const amountClass =
                    transaction.direction.toUpperCase() === "OUTBOUND"
                      ? "amount outbound"
                      : "amount inbound";

                  return (
                    <tr
                      key={[
                        transaction.transaction_date,
                        transaction.account_name,
                        transaction.merchant_name,
                        transaction.reference || "",
                        index
                      ].join("|")}
                    >
                      <td>{formatDate(transaction.transaction_date)}</td>
                      <td>
                        <strong>{transaction.merchant_name}</strong>
                      </td>
                      <td>{transaction.reference || "-"}</td>
                      <td>{transaction.category_name || "-"}</td>
                      <td>{transaction.account_name}</td>
                      <td>{transaction.institution_name || "-"}</td>
                      <td>
                        <DirectionBadge direction={transaction.direction} />
                      </td>
                      <td className={amountClass}>
                        {formatSignedTransaction(transaction)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Activity />}
            title="No transactions found"
            detail="Load or refresh transactions to populate this table."
          />
        )}
      </section>
    </>
  );
}
