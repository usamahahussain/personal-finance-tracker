"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  ListChecks,
  Repeat2,
  RefreshCcw,
  Tags
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CategoryResponse,
  RecurringTransactionResponse,
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
  isRecurringCategory,
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

type RecurringBudgetRow = {
  key: string;
  name: string;
  expected: number;
  actual: number;
  variance: number;
  active: boolean;
  dueDay?: number | null;
};

function sortCategories(categories: CategoryResponse[]) {
  return [...categories].sort((a, b) => a.category_name.localeCompare(b.category_name));
}

function sortRecurringTransactions(series: RecurringTransactionResponse[]) {
  return [...series].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.display_name.localeCompare(b.display_name)
  );
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
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransactionResponse[]>([]);
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
      const [transactionResult, categoryResult, recurringResult] = await Promise.all([
        apiRequest<TransactionResponse[]>("/transactions"),
        apiRequest<CategoryResponse[]>("/categories"),
        apiRequest<RecurringTransactionResponse[]>("/recurring-transactions")
      ]);

      setTransactions(transactionResult.data);
      setCategories(sortCategories(categoryResult.data));
      setRecurringTransactions(sortRecurringTransactions(recurringResult.data));

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

  const recurringActualTransactions = useMemo(
    () =>
      monthlyOutbound.filter((transaction) => transaction.recurring_transaction_id),
    [monthlyOutbound]
  );

  const discretionaryTransactions = useMemo(
    () =>
      monthlyOutbound.filter((transaction) => !transaction.recurring_transaction_id),
    [monthlyOutbound]
  );

  const recurringRows = useMemo(() => {
    const rows = new Map<string, RecurringBudgetRow>();

    recurringTransactions
      .filter((item) => item.active)
      .forEach((item) => {
        rows.set(String(item.recurring_transaction_id), {
          key: String(item.recurring_transaction_id),
          name: item.display_name,
          expected: toNumber(item.expected_amount),
          actual: 0,
          variance: toNumber(item.expected_amount),
          active: true,
          dueDay: item.due_day
        });
      });

    recurringActualTransactions.forEach((transaction) => {
      const key = String(transaction.recurring_transaction_id);
      const current =
        rows.get(key) ??
        {
          key,
          name: transaction.recurring_transaction_name || transaction.merchant_name,
          expected: 0,
          actual: 0,
          variance: 0,
          active: false,
          dueDay: null
        };

      current.actual += toNumber(transaction.amount);
      current.variance = current.expected - current.actual;
      rows.set(key, current);
    });

    return [...rows.values()].sort(
      (a, b) =>
        Number(a.actual === 0) - Number(b.actual === 0) ||
        b.actual - a.actual ||
        a.name.localeCompare(b.name)
    );
  }, [recurringActualTransactions, recurringTransactions]);

  const discretionaryRows = useMemo(() => {
    const rows = new Map<string, BudgetRow>();

    categories
      .filter((category) => !isRecurringCategory(category))
      .forEach((category) => {
        rows.set(String(category.category_id), {
          key: String(category.category_id),
          name: category.category_name,
          budget: toNumber(category.budget),
          spend: 0,
          remaining: toNumber(category.budget)
        });
      });

    discretionaryTransactions.forEach((transaction) => {
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
  }, [categories, discretionaryTransactions]);

  const summary = useMemo(() => {
    const spend = monthlyOutbound.reduce(
      (total, transaction) => total + toNumber(transaction.amount),
      0
    );
    const recurringExpected = recurringTransactions
      .filter((item) => item.active)
      .reduce((total, item) => total + toNumber(item.expected_amount), 0);
    const recurringActual = recurringActualTransactions.reduce(
      (total, transaction) => total + toNumber(transaction.amount),
      0
    );
    const discretionaryBudget = categories
      .filter((category) => !isRecurringCategory(category))
      .reduce((total, category) => total + toNumber(category.budget), 0);
    const discretionarySpend = discretionaryTransactions.reduce(
      (total, transaction) => total + toNumber(transaction.amount),
      0
    );
    const income = monthlyTransactions
      .filter((transaction) => !isOutbound(transaction))
      .reduce((total, transaction) => total + toNumber(transaction.amount), 0);
    const uncategorized = monthlyTransactions.filter(
      (transaction) => !transaction.category_id
    );
    const recurringCategoryIds = new Set(
      categories
        .filter(isRecurringCategory)
        .map((category) => category.category_id)
    );
    const needsRecurringLink = monthlyOutbound.filter(
      (transaction) =>
        !transaction.recurring_transaction_id &&
        transaction.category_id &&
        recurringCategoryIds.has(transaction.category_id)
    );
    const missingRecurring = recurringRows.filter(
      (row) => row.active && row.actual === 0
    );

    return {
      spend,
      income,
      net: income - spend,
      recurringExpected,
      recurringActual,
      recurringRemaining: recurringExpected - recurringActual,
      discretionaryBudget,
      discretionarySpend,
      discretionaryRemaining: discretionaryBudget - discretionarySpend,
      missingRecurringCount: missingRecurring.length,
      needsRecurringLinkCount: needsRecurringLink.length,
      uncategorizedCount: uncategorized.length
    };
  }, [
    categories,
    discretionaryTransactions,
    monthlyOutbound,
    monthlyTransactions,
    recurringActualTransactions,
    recurringRows,
    recurringTransactions
  ]);

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
  const recurringTone =
    summary.recurringRemaining < 0
      ? "bad"
      : summary.recurringRemaining > 0 ||
          summary.missingRecurringCount > 0
        ? "warn"
        : "good";
  const discretionaryRemainingTone =
    summary.discretionaryRemaining < 0
      ? "bad"
      : summary.discretionaryBudget > 0 &&
          summary.discretionaryRemaining < summary.discretionaryBudget * 0.2
        ? "warn"
        : "good";

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
          <button
            className="ghostButton"
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={loading}
            title="GET /transactions and /categories through FastAPI without importing new transactions."
            aria-label="Reload dashboard transactions and categories from FastAPI without importing new transactions"
          >
            <ListChecks />
            <span>Reload dashboard data</span>
          </button>
          <button
            className="primaryButton"
            type="button"
            onClick={refreshTransactions}
            disabled={refreshing}
            title="POST /refresh to import Lunchflow transactions into the database, then reload dashboard transactions and categories."
            aria-label="Import Lunchflow transactions through FastAPI, then reload dashboard transactions and categories"
          >
            <RefreshCcw />
            <span>{refreshing ? "Importing transactions" : "Import transactions"}</span>
          </button>
        </div>
      </section>

      <StatusMessage error={error} notice={notice} />

      <section className="metricGrid dashboardMetrics" aria-label="Monthly summary">
        <MetricTile
          label="Recurring actual"
          value={formatMoney(summary.recurringActual)}
          detail={`${formatMoney(summary.recurringExpected)} expected`}
          tone={recurringTone}
          icon={<Repeat2 />}
        />
        <MetricTile
          label="Discretionary left"
          value={formatMoney(summary.discretionaryRemaining)}
          detail={`${formatMoney(summary.discretionarySpend)} spent`}
          tone={discretionaryRemainingTone}
          icon={<CircleDollarSign />}
        />
        <MetricTile
          label="Needs link"
          value={String(summary.needsRecurringLinkCount)}
          detail="recurring-category transactions"
          tone={summary.needsRecurringLinkCount > 0 ? "warn" : "good"}
          icon={<ArrowUpRight />}
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
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Recurring commitments</p>
              <h2>Expected versus matched</h2>
            </div>
            <strong className={summary.recurringRemaining < 0 ? "amount negative" : "amount positive"}>
              {formatMoney(summary.recurringRemaining)}
            </strong>
          </div>

          {loading && recurringRows.length === 0 ? (
            <LoadingBlock label="Loading recurring commitments" />
          ) : recurringRows.length > 0 ? (
            <div className="tableWrap compactTableWrap">
              <table className="dataTable budgetTable">
                <thead>
                  <tr>
                    <th>Series</th>
                    <th>Actual</th>
                    <th>Expected</th>
                    <th>Difference</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringRows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td className="amount negative">{formatMoney(row.actual)}</td>
                      <td>{formatMoney(row.expected)}</td>
                      <td className={row.variance < 0 ? "amount negative" : "amount positive"}>
                        {formatMoney(row.variance)}
                      </td>
                      <td>{row.dueDay ? `Day ${row.dueDay}` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyBlock
              icon={<CalendarDays aria-hidden="true" />}
              title="No recurring commitments"
              detail="Create recurring series, then link imported transactions."
            />
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Discretionary spend</p>
              <h2>Flexible category budget</h2>
            </div>
            <strong className={summary.discretionaryRemaining < 0 ? "amount negative" : "amount positive"}>
              {formatMoney(summary.discretionaryRemaining)}
            </strong>
          </div>

          {loading && discretionaryRows.length === 0 ? (
            <LoadingBlock label="Loading discretionary spend" />
          ) : discretionaryRows.length > 0 ? (
            <div className="tableWrap compactTableWrap">
              <table className="dataTable budgetTable">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Spend</th>
                    <th>Budget</th>
                    <th>Left</th>
                  </tr>
                </thead>
                <tbody>
                  {discretionaryRows.map((row) => (
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
              title="No discretionary spend"
              detail="Unlinked outbound transactions appear here."
            />
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
