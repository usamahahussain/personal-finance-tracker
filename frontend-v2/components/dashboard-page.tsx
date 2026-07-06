"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  ListChecks,
  RefreshCcw,
  Tags,
  WalletCards
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BalanceResponse,
  CategoryResponse,
  RefreshResponse,
  TransactionCategoryUpdate,
  TransactionResponse,
  apiRequest,
  formatDate,
  formatMoney,
  formatMonthValue,
  formatSignedTransaction,
  getCategoryName,
  getInstitutionName,
  getMonthValue,
  getTransactionMonthValue,
  getErrorMessage,
  isOutbound,
  toNumber
} from "@/lib/finance";
import { EmptyBlock, LoadingBlock, MetricTile, StatusMessage } from "@/components/ui";

type BudgetRow = {
  key: string;
  name: string;
  budget: number;
  spend: number;
  remaining: number;
};

function sortCategories(categories: CategoryResponse[]) {
  return [...categories].sort((a, b) => a.category_name.localeCompare(b.category_name));
}

function sortTransactionsNewestFirst(transactions: TransactionResponse[]) {
  return [...transactions].sort(
    (a, b) =>
      new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
  );
}

export function DashboardPage() {
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [balances, setBalances] = useState<BalanceResponse[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getMonthValue());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTransactionIds, setSavingTransactionIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async (showNotice = false) => {
    setLoading(true);
    setError(null);

    try {
      const [transactionResult, categoryResult, balanceResult] = await Promise.all([
        apiRequest<TransactionResponse[]>("/transactions"),
        apiRequest<CategoryResponse[]>("/categories"),
        apiRequest<BalanceResponse[]>("/balance")
      ]);

      setTransactions(transactionResult.data);
      setCategories(sortCategories(categoryResult.data));
      setBalances(balanceResult.data);

      if (showNotice) {
        setNotice("Dashboard reloaded.");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const monthlyTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          getTransactionMonthValue(transaction.transaction_date) === selectedMonth
      ),
    [selectedMonth, transactions]
  );

  const monthlyOutbound = useMemo(
    () => monthlyTransactions.filter((transaction) => isOutbound(transaction)),
    [monthlyTransactions]
  );

  const budgetRows = useMemo(() => {
    const rows = new Map<string, BudgetRow>();

    categories.forEach((category) => {
      rows.set(String(category.category_id), {
        key: String(category.category_id),
        name: category.category_name,
        budget: toNumber(category.budget),
        spend: 0,
        remaining: toNumber(category.budget)
      });
    });

    monthlyOutbound.forEach((transaction) => {
      const key = transaction.category_id ? String(transaction.category_id) : "uncategorized";
      const current =
        rows.get(key) ??
        {
          key,
          name: getCategoryName(transaction, categories),
          budget: 0,
          spend: 0,
          remaining: 0
        };

      current.spend += toNumber(transaction.amount);
      current.remaining = current.budget - current.spend;
      rows.set(key, current);
    });

    return [...rows.values()]
      .filter((row) => row.budget > 0 || row.spend > 0)
      .sort(
        (a, b) =>
          Number(b.remaining < 0) - Number(a.remaining < 0) ||
          b.spend - a.spend ||
          a.name.localeCompare(b.name)
      );
  }, [categories, monthlyOutbound]);

  const summary = useMemo(() => {
    const spend = monthlyOutbound.reduce(
      (total, transaction) => total + toNumber(transaction.amount),
      0
    );
    const income = monthlyTransactions
      .filter((transaction) => !isOutbound(transaction))
      .reduce((total, transaction) => total + toNumber(transaction.amount), 0);
    const budget = categories.reduce(
      (total, category) => total + toNumber(category.budget),
      0
    );
    const balanceTotal = balances.reduce(
      (total, balance) => total + toNumber(balance.balance),
      0
    );
    const uncategorized = monthlyTransactions.filter(
      (transaction) => !transaction.category_id
    );

    return {
      spend,
      income,
      net: income - spend,
      budget,
      remaining: budget - spend,
      balanceTotal,
      uncategorizedCount: uncategorized.length
    };
  }, [balances, categories, monthlyOutbound, monthlyTransactions]);

  const uncategorizedTransactions = useMemo(
    () =>
      sortTransactionsNewestFirst(
        monthlyTransactions.filter((transaction) => !transaction.category_id)
      ).slice(0, 8),
    [monthlyTransactions]
  );

  async function refreshTransactions() {
    setRefreshing(true);
    setError(null);
    setNotice(null);

    try {
      const result = await apiRequest<RefreshResponse>("/refresh", {
        method: "POST"
      });
      await loadDashboardData();
      setNotice(
        `Refresh inserted ${result.data.inserted} of ${result.data.received} transactions.`
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRefreshing(false);
    }
  }

  async function updateTransactionCategory(transaction: TransactionResponse, categoryValue: string) {
    const categoryId = Number(categoryValue);

    if (!Number.isInteger(categoryId) || categoryId < 1) {
      return;
    }

    const payload: TransactionCategoryUpdate = {
      category_id: categoryId
    };

    setError(null);
    setNotice(null);
    setSavingTransactionIds((current) => new Set(current).add(transaction.transaction_id));

    try {
      const result = await apiRequest<TransactionResponse>(
        `/transactions/${transaction.transaction_id}/category`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        }
      );

      setTransactions((current) =>
        current.map((currentTransaction) =>
          currentTransaction.transaction_id === transaction.transaction_id
            ? result.data
            : currentTransaction
        )
      );
      setNotice(`Categorized ${result.data.merchant_name}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingTransactionIds((current) => {
        const next = new Set(current);
        next.delete(transaction.transaction_id);
        return next;
      });
    }
  }

  const monthLabel = formatMonthValue(selectedMonth);
  const remainingTone = summary.remaining < 0 ? "bad" : summary.remaining < summary.budget * 0.2 ? "warn" : "good";

  return (
    <>
      <section className="pageTop">
        <div>
          <p className="eyebrow">{monthLabel}</p>
          <h1>Monthly overview</h1>
        </div>
        <div className="toolbar">
          <label className="compactField">
            <span>Month</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value || getMonthValue())}
            />
          </label>
          <button className="ghostButton" type="button" onClick={() => loadDashboardData(true)} disabled={loading}>
            <ListChecks />
            <span>Reload</span>
          </button>
          <button className="primaryButton" type="button" onClick={refreshTransactions} disabled={refreshing}>
            <RefreshCcw />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </section>

      <StatusMessage error={error} notice={notice} />

      <section className="metricGrid" aria-label="Monthly summary">
        <MetricTile
          label="Spent"
          value={formatMoney(summary.spend)}
          detail={`${monthlyOutbound.length} outbound transactions`}
          tone="neutral"
          icon={<ArrowUpRight />}
        />
        <MetricTile
          label="Budget left"
          value={formatMoney(summary.remaining)}
          detail={`${formatMoney(summary.budget)} monthly budget`}
          tone={remainingTone}
          icon={<CircleDollarSign />}
        />
        <MetricTile
          label="Balances"
          value={formatMoney(summary.balanceTotal)}
          detail={`${balances.length} accounts`}
          tone="good"
          icon={<WalletCards />}
        />
        <MetricTile
          label="Needs category"
          value={String(summary.uncategorizedCount)}
          detail="transactions in selected month"
          tone={summary.uncategorizedCount > 0 ? "warn" : "good"}
          icon={<Tags />}
        />
      </section>

      <section className="dashboardGrid">
        <section className="panel widePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Budget pace</p>
              <h2>Category spend</h2>
            </div>
            <strong className={summary.net < 0 ? "amount negative" : "amount positive"}>
              {formatMoney(summary.net)}
            </strong>
          </div>

          {loading && budgetRows.length === 0 ? (
            <LoadingBlock label="Loading monthly spend" />
          ) : budgetRows.length > 0 ? (
            <div className="tableWrap compactTableWrap">
              <table className="dataTable budgetTable">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Spend to date</th>
                    <th>Budget</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td className="amount negative">{formatMoney(row.spend)}</td>
                      <td>{formatMoney(row.budget)}</td>
                      <td className={row.remaining < 0 ? "amount negative" : "amount positive"}>
                        {formatMoney(row.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyBlock
              icon={<CalendarDays aria-hidden="true" />}
              title="No spend for this month"
              detail="Refresh or choose another month."
            />
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Current</p>
              <h2>Balances</h2>
            </div>
            <strong>{formatMoney(summary.balanceTotal)}</strong>
          </div>

          {loading && balances.length === 0 ? (
            <LoadingBlock label="Loading balances" />
          ) : balances.length > 0 ? (
            <div className="balanceList">
              {balances.map((balance, index) => (
                <div className="balanceRow" key={`${balance.account}-${balance.institution || "unknown"}-${index}`}>
                  <div>
                    <strong>{balance.account}</strong>
                    <span>{balance.institution || "Unknown institution"}</span>
                  </div>
                  <strong className={toNumber(balance.balance) < 0 ? "amount negative" : "amount positive"}>
                    {formatMoney(balance.balance)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock icon={<WalletCards aria-hidden="true" />} title="No balances loaded" />
          )}
        </section>
      </section>

      <section className="panel actionPanel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Action queue</p>
            <h2>Uncategorized transactions</h2>
          </div>
          <Link className="textLink" href="/transactions">
            Open transactions
          </Link>
        </div>

        {loading && uncategorizedTransactions.length === 0 ? (
          <LoadingBlock label="Loading action queue" />
        ) : uncategorizedTransactions.length > 0 ? (
          <div className="actionList">
            {uncategorizedTransactions.map((transaction) => {
              const saving = savingTransactionIds.has(transaction.transaction_id);

              return (
                <div className="actionRow" key={transaction.transaction_id}>
                  <span>{formatDate(transaction.transaction_date)}</span>
                  <div>
                    <strong>{transaction.merchant_name}</strong>
                    <span>{getInstitutionName(transaction)} / {transaction.account_name}</span>
                  </div>
                  <strong className={isOutbound(transaction) ? "amount negative" : "amount positive"}>
                    {formatSignedTransaction(transaction)}
                  </strong>
                  <select
                    value=""
                    onChange={(event) => updateTransactionCategory(transaction, event.target.value)}
                    disabled={saving}
                    aria-label={`Category for ${transaction.merchant_name}`}
                  >
                    <option value="" disabled>
                      Choose category
                    </option>
                    {categories.map((category) => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyBlock
            icon={<AlertTriangle aria-hidden="true" />}
            title="No uncategorized transactions"
            detail="The selected month has no transactions waiting for category assignment."
          />
        )}
      </section>
    </>
  );
}
