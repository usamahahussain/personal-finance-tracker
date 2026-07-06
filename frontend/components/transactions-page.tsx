"use client";

import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  CircleDollarSign,
  RefreshCcw,
  Tags,
  WalletCards
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CategoryResponse,
  RefreshResponse,
  TransactionCategoryUpdate,
  TransactionResponse,
  apiRequest,
  formatDate,
  formatMoney,
  formatSignedTransaction,
  getErrorMessage,
  toNumber
} from "@/lib/finance";
import {
  DirectionBadge,
  EmptyState,
  LoadingState,
  PageHeader,
  Stat,
  StatusMessage
} from "@/components/ui";

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric"
});

const ALL_ACCOUNTS_VALUE = "all";

function getMonthValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getTransactionMonthValue(value: string) {
  const datePart = value.split("T")[0];
  const match = /^(\d{4})-(\d{2})/.exec(datePart);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : getMonthValue(date);
}

function formatMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return "Selected month";
  }

  return monthFormatter.format(new Date(year, month - 1, 1));
}

function getInstitutionLabel(transaction: TransactionResponse) {
  return transaction.institution_name || "Unknown institution";
}

function getCategoryLabel(transaction: TransactionResponse) {
  return transaction.category_name || "Uncategorized";
}

function getAccountFilterKey(transaction: TransactionResponse) {
  return `${getInstitutionLabel(transaction)}::${transaction.account_name}`;
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedAccountKey, setSelectedAccountKey] =
    useState(ALL_ACCOUNTS_VALUE);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTransactionIds, setSavingTransactionIds] = useState<Set<number>>(
    new Set()
  );
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

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    setError(null);

    try {
      const result = await apiRequest<CategoryResponse[]>("/categories");
      setCategories(
        [...result.data].sort((a, b) =>
          a.category_name.localeCompare(b.category_name)
        )
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadPageData = useCallback(
    async (showNotice = false) => {
      await Promise.all([loadTransactions(showNotice), loadCategories()]);
    },
    [loadCategories, loadTransactions]
  );

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    setSelectedMonth(getMonthValue());
  }, []);

  const monthlyTransactions = useMemo(
    () =>
      selectedMonth
        ? transactions.filter(
            (transaction) =>
              getTransactionMonthValue(transaction.transaction_date) ===
              selectedMonth
          )
        : [],
    [selectedMonth, transactions]
  );

  const accountOptions = useMemo(() => {
    const options = new Map<
      string,
      {
        key: string;
        accountName: string;
        institutionName: string;
      }
    >();

    monthlyTransactions.forEach((transaction) => {
      const key = getAccountFilterKey(transaction);
      if (options.has(key)) {
        return;
      }

      options.set(key, {
        key,
        accountName: transaction.account_name,
        institutionName: getInstitutionLabel(transaction)
      });
    });

    return [...options.values()].sort(
      (a, b) =>
        a.accountName.localeCompare(b.accountName) ||
        a.institutionName.localeCompare(b.institutionName)
    );
  }, [monthlyTransactions]);

  useEffect(() => {
    if (
      selectedAccountKey !== ALL_ACCOUNTS_VALUE &&
      !accountOptions.some((option) => option.key === selectedAccountKey)
    ) {
      setSelectedAccountKey(ALL_ACCOUNTS_VALUE);
    }
  }, [accountOptions, selectedAccountKey]);

  const filteredTransactions = useMemo(
    () =>
      selectedAccountKey === ALL_ACCOUNTS_VALUE
        ? monthlyTransactions
        : monthlyTransactions.filter(
            (transaction) =>
              getAccountFilterKey(transaction) === selectedAccountKey
          ),
    [monthlyTransactions, selectedAccountKey]
  );

  const summary = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;

    filteredTransactions.forEach((transaction) => {
      const amount = toNumber(transaction.amount);

      if (transaction.direction.toUpperCase() === "OUTBOUND") {
        outgoing += amount;
      } else {
        incoming += amount;
      }
    });

    const uncategorized = filteredTransactions.filter(
      (transaction) => !transaction.category_name
    ).length;
    const accounts = new Set(
      filteredTransactions.map((transaction) => getAccountFilterKey(transaction))
    ).size;
    const institutions = new Set(
      filteredTransactions.map((transaction) => getInstitutionLabel(transaction))
    ).size;

    return {
      incoming,
      outgoing,
      net: incoming - outgoing,
      uncategorized,
      accounts,
      institutions
    };
  }, [filteredTransactions]);

  const categorySpend = useMemo(() => {
    const spendByCategory = new Map<
      string,
      {
        categoryName: string;
        transactionCount: number;
        total: number;
      }
    >();

    filteredTransactions.forEach((transaction) => {
      if (transaction.direction.toUpperCase() !== "OUTBOUND") {
        return;
      }

      const categoryName = getCategoryLabel(transaction);
      const current = spendByCategory.get(categoryName);

      if (current) {
        current.transactionCount += 1;
        current.total += toNumber(transaction.amount);
        return;
      }

      spendByCategory.set(categoryName, {
        categoryName,
        transactionCount: 1,
        total: toNumber(transaction.amount)
      });
    });

    return [...spendByCategory.values()].sort(
      (a, b) => b.total - a.total || a.categoryName.localeCompare(b.categoryName)
    );
  }, [filteredTransactions]);

  const maxCategorySpend = categorySpend[0]?.total ?? 0;

  const institutionBreakdown = useMemo(() => {
    const groups = new Map<
      string,
      {
        institutionName: string;
        transactionCount: number;
        accountNames: Set<string>;
        incoming: number;
        outgoing: number;
      }
    >();

    filteredTransactions.forEach((transaction) => {
      const institutionName = getInstitutionLabel(transaction);
      const current =
        groups.get(institutionName) ??
        {
          institutionName,
          transactionCount: 0,
          accountNames: new Set<string>(),
          incoming: 0,
          outgoing: 0
        };

      current.transactionCount += 1;
      current.accountNames.add(transaction.account_name);

      if (transaction.direction.toUpperCase() === "OUTBOUND") {
        current.outgoing += toNumber(transaction.amount);
      } else {
        current.incoming += toNumber(transaction.amount);
      }

      groups.set(institutionName, current);
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        accountCount: group.accountNames.size,
        net: group.incoming - group.outgoing
      }))
      .sort(
        (a, b) =>
          b.outgoing - a.outgoing ||
          Math.abs(b.net) - Math.abs(a.net) ||
          a.institutionName.localeCompare(b.institutionName)
      );
  }, [filteredTransactions]);

  const selectedMonthLabel = useMemo(
    () => (selectedMonth ? formatMonthValue(selectedMonth) : "Current month"),
    [selectedMonth]
  );

  const selectedAccountLabel = useMemo(() => {
    if (selectedAccountKey === ALL_ACCOUNTS_VALUE) {
      return "all accounts";
    }

    const account = accountOptions.find(
      (option) => option.key === selectedAccountKey
    );

    return account
      ? `${account.accountName} at ${account.institutionName}`
      : "selected account";
  }, [accountOptions, selectedAccountKey]);

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
      await loadPageData();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setRefreshing(false);
    }
  }

  async function updateTransactionCategory(
    transaction: TransactionResponse,
    categoryValue: string
  ) {
    let nextCategoryId: number | null = null;

    if (categoryValue) {
      const parsedCategoryId = Number(categoryValue);

      if (!Number.isInteger(parsedCategoryId) || parsedCategoryId < 1) {
        setError("Selected category is invalid.");
        return;
      }

      nextCategoryId = parsedCategoryId;
    }

    if ((transaction.category_id ?? null) === nextCategoryId) {
      return;
    }

    const payload: TransactionCategoryUpdate = {
      category_id: nextCategoryId
    };

    setError(null);
    setNotice(null);
    setSavingTransactionIds((current) => {
      const next = new Set(current);
      next.add(transaction.transaction_id);
      return next;
    });

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
      setNotice(`Updated category for ${result.data.merchant_name}.`);
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
              onClick={() => loadPageData(true)}
              disabled={loading || loadingCategories}
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
          value={String(filteredTransactions.length)}
          icon={<Activity />}
        />
        <Stat
          label="Money out"
          value={formatMoney(summary.outgoing)}
          icon={<ArrowUpRight />}
        />
        <Stat
          label="Money in"
          value={formatMoney(summary.incoming)}
          icon={<ArrowDownLeft />}
        />
        <Stat
          label="Net total"
          value={formatMoney(summary.net)}
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
        <div className="filterBar" aria-label="Transaction filters">
          <label>
            <span>Calendar month</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) =>
                setSelectedMonth(event.target.value || getMonthValue())
              }
            />
          </label>
          <label>
            <span>Account</span>
            <select
              value={selectedAccountKey}
              onChange={(event) => setSelectedAccountKey(event.target.value)}
              disabled={accountOptions.length === 0}
            >
              <option value={ALL_ACCOUNTS_VALUE}>All accounts</option>
              {accountOptions.map((account) => (
                <option key={account.key} value={account.key}>
                  {account.accountName} ({account.institutionName})
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondaryButton compact"
            type="button"
            onClick={() => setSelectedMonth(getMonthValue())}
            title="Show current calendar month"
          >
            <Calendar />
            Current month
          </button>
          <span className="filterSummary">
            {selectedMonthLabel}: {filteredTransactions.length} of{" "}
            {monthlyTransactions.length} monthly transactions for{" "}
            {selectedAccountLabel}
          </span>
        </div>

        <div
          className="insightGrid"
          aria-label="Filtered transaction breakdowns"
        >
          <section className="breakdownPanel" aria-label="Category spend">
            <div className="panelHeader">
              <div>
                <p>Category spend</p>
                <h2>{selectedMonthLabel}</h2>
              </div>
              <strong>{formatMoney(summary.outgoing)}</strong>
            </div>

            {categorySpend.length > 0 ? (
              <div className="breakdownList">
                {categorySpend.map((category) => {
                  const percentOfSpend =
                    summary.outgoing > 0
                      ? Math.round((category.total / summary.outgoing) * 100)
                      : 0;
                  const barWidth =
                    maxCategorySpend > 0
                      ? `${Math.max((category.total / maxCategorySpend) * 100, 3)}%`
                      : "0%";

                  return (
                    <div
                      className="breakdownRow categoryRow"
                      key={category.categoryName}
                    >
                      <div>
                        <strong>{category.categoryName}</strong>
                        <span>
                          {category.transactionCount}{" "}
                          {category.transactionCount === 1
                            ? "transaction"
                            : "transactions"}
                        </span>
                      </div>
                      <div className="breakdownAmount">
                        <strong>{formatMoney(category.total)}</strong>
                        <span>{percentOfSpend}%</span>
                      </div>
                      <div className="spendBar" aria-hidden="true">
                        <span style={{ width: barWidth }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panelEmpty">
                <Tags aria-hidden="true" />
                <span>No outbound category spend in this filter.</span>
              </div>
            )}
          </section>

          <section className="breakdownPanel" aria-label="Institution totals">
            <div className="panelHeader">
              <div>
                <p>Institution totals</p>
                <h2>{summary.institutions} institutions</h2>
              </div>
              <Building2 aria-hidden="true" />
            </div>

            {institutionBreakdown.length > 0 ? (
              <div className="institutionList">
                {institutionBreakdown.map((institution) => {
                  const netClass =
                    institution.net < 0 ? "amount outbound" : "amount inbound";

                  return (
                    <div
                      className="institutionRow"
                      key={institution.institutionName}
                    >
                      <div className="institutionName">
                        <strong>{institution.institutionName}</strong>
                        <span>
                          {institution.accountCount}{" "}
                          {institution.accountCount === 1
                            ? "account"
                            : "accounts"}{" "}
                          / {institution.transactionCount}{" "}
                          {institution.transactionCount === 1
                            ? "transaction"
                            : "transactions"}
                        </span>
                      </div>
                      <dl className="metricList">
                        <div>
                          <dt>Spent</dt>
                          <dd>{formatMoney(institution.outgoing)}</dd>
                        </div>
                        <div>
                          <dt>In</dt>
                          <dd>{formatMoney(institution.incoming)}</dd>
                        </div>
                        <div>
                          <dt>Net</dt>
                          <dd className={netClass}>
                            {formatMoney(institution.net)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panelEmpty">
                <Building2 aria-hidden="true" />
                <span>No institution activity in this filter.</span>
              </div>
            )}
          </section>
        </div>

        {loading && transactions.length === 0 ? (
          <LoadingState title="Loading transactions" />
        ) : transactions.length > 0 && filteredTransactions.length > 0 ? (
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
                {filteredTransactions.map((transaction) => {
                  const amountClass =
                    transaction.direction.toUpperCase() === "OUTBOUND"
                      ? "amount outbound"
                      : "amount inbound";
                  const saving = savingTransactionIds.has(
                    transaction.transaction_id
                  );

                  return (
                    <tr key={transaction.transaction_id}>
                      <td>{formatDate(transaction.transaction_date)}</td>
                      <td>
                        <strong>{transaction.merchant_name}</strong>
                      </td>
                      <td>{transaction.reference || "-"}</td>
                      <td>
                        <select
                          className="categorySelect"
                          value={
                            transaction.category_id
                              ? String(transaction.category_id)
                              : ""
                          }
                          onChange={(event) =>
                            updateTransactionCategory(
                              transaction,
                              event.target.value
                            )
                          }
                          disabled={loadingCategories || saving}
                          aria-label={`Category for ${transaction.merchant_name}`}
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((category) => (
                            <option
                              key={category.category_id}
                              value={category.category_id}
                            >
                              {category.category_name}
                            </option>
                          ))}
                        </select>
                      </td>
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
        ) : transactions.length > 0 ? (
          <EmptyState
            icon={<Calendar />}
            title={`No transactions in ${selectedMonthLabel}`}
            detail="Choose another month, change the account filter, or refresh transactions."
          />
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
