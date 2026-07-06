"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Filter,
  RefreshCcw,
  Search,
  Tags
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
  formatMonthValue,
  formatSignedTransaction,
  getCategoryName,
  getInstitutionName,
  getMonthValue,
  getTransactionMonthValue,
  getErrorMessage,
  isOutbound,
  signedTransactionAmount,
  toNumber
} from "@/lib/finance";
import { EmptyBlock, LoadingBlock, MetricTile, StatusMessage } from "@/components/ui";

const ALL_VALUE = "all";
const UNCATEGORIZED_VALUE = "uncategorized";

function sortCategories(categories: CategoryResponse[]) {
  return [...categories].sort((a, b) => a.category_name.localeCompare(b.category_name));
}

function sortTransactionsNewestFirst(transactions: TransactionResponse[]) {
  return [...transactions].sort(
    (a, b) =>
      new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
  );
}

function getAccountKey(transaction: TransactionResponse) {
  return `${getInstitutionName(transaction)}::${transaction.account_name}`;
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getMonthValue());
  const [selectedAccount, setSelectedAccount] = useState(ALL_VALUE);
  const [selectedCategory, setSelectedCategory] = useState(ALL_VALUE);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTransactionIds, setSavingTransactionIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPageData = useCallback(async (showNotice = false) => {
    setLoading(true);
    setError(null);

    try {
      const [transactionResult, categoryResult] = await Promise.all([
        apiRequest<TransactionResponse[]>("/transactions"),
        apiRequest<CategoryResponse[]>("/categories")
      ]);

      setTransactions(transactionResult.data);
      setCategories(sortCategories(categoryResult.data));

      if (showNotice) {
        setNotice("Transactions reloaded.");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const monthlyTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          getTransactionMonthValue(transaction.transaction_date) === selectedMonth
      ),
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
      const key = getAccountKey(transaction);

      if (!options.has(key)) {
        options.set(key, {
          key,
          accountName: transaction.account_name,
          institutionName: getInstitutionName(transaction)
        });
      }
    });

    return [...options.values()].sort(
      (a, b) =>
        a.institutionName.localeCompare(b.institutionName) ||
        a.accountName.localeCompare(b.accountName)
    );
  }, [monthlyTransactions]);

  useEffect(() => {
    if (
      selectedAccount !== ALL_VALUE &&
      !accountOptions.some((option) => option.key === selectedAccount)
    ) {
      setSelectedAccount(ALL_VALUE);
    }
  }, [accountOptions, selectedAccount]);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sortTransactionsNewestFirst(
      monthlyTransactions.filter((transaction) => {
        const accountMatches =
          selectedAccount === ALL_VALUE || getAccountKey(transaction) === selectedAccount;
        const categoryMatches =
          selectedCategory === ALL_VALUE ||
          (selectedCategory === UNCATEGORIZED_VALUE && !transaction.category_id) ||
          String(transaction.category_id ?? "") === selectedCategory;
        const queryMatches =
          !normalizedQuery ||
          transaction.merchant_name.toLowerCase().includes(normalizedQuery) ||
          (transaction.reference || "").toLowerCase().includes(normalizedQuery) ||
          transaction.account_name.toLowerCase().includes(normalizedQuery) ||
          getInstitutionName(transaction).toLowerCase().includes(normalizedQuery);

        return accountMatches && categoryMatches && queryMatches;
      })
    );
  }, [monthlyTransactions, query, selectedAccount, selectedCategory]);

  const summary = useMemo(() => {
    let spend = 0;
    let income = 0;

    filteredTransactions.forEach((transaction) => {
      if (isOutbound(transaction)) {
        spend += toNumber(transaction.amount);
      } else {
        income += toNumber(transaction.amount);
      }
    });

    return {
      spend,
      income,
      net: income - spend,
      uncategorized: filteredTransactions.filter((transaction) => !transaction.category_id).length
    };
  }, [filteredTransactions]);

  async function refreshTransactions() {
    setRefreshing(true);
    setError(null);
    setNotice(null);

    try {
      const result = await apiRequest<RefreshResponse>("/refresh", {
        method: "POST"
      });
      await loadPageData();
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

    if (transaction.category_id === categoryId) {
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
      setNotice(`Updated ${result.data.merchant_name}.`);
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
      <section className="pageTop">
        <div>
          <p className="eyebrow">{formatMonthValue(selectedMonth)}</p>
          <h1>Transactions</h1>
        </div>
        <div className="toolbar">
          <button className="ghostButton" type="button" onClick={() => loadPageData(true)} disabled={loading}>
            <Filter />
            <span>Reload</span>
          </button>
          <button className="primaryButton" type="button" onClick={refreshTransactions} disabled={refreshing}>
            <RefreshCcw />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </section>

      <StatusMessage error={error} notice={notice} />

      <section className="metricGrid compactMetrics" aria-label="Filtered transaction summary">
        <MetricTile label="Rows" value={String(filteredTransactions.length)} detail="matching transactions" icon={<CalendarDays />} />
        <MetricTile label="Spent" value={formatMoney(summary.spend)} tone="bad" icon={<ArrowUpRight />} />
        <MetricTile label="Income" value={formatMoney(summary.income)} tone="good" icon={<ArrowDownLeft />} />
        <MetricTile
          label="Uncategorized"
          value={String(summary.uncategorized)}
          tone={summary.uncategorized > 0 ? "warn" : "good"}
          icon={<Tags />}
        />
      </section>

      <section className="filterPanel" aria-label="Transaction filters">
        <label>
          <span>Month</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value || getMonthValue())}
          />
        </label>
        <label>
          <span>Account</span>
          <select value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)}>
            <option value={ALL_VALUE}>All accounts</option>
            {accountOptions.map((account) => (
              <option key={account.key} value={account.key}>
                {account.institutionName} / {account.accountName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Category</span>
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value={ALL_VALUE}>All categories</option>
            <option value={UNCATEGORIZED_VALUE}>Uncategorized</option>
            {categories.map((category) => (
              <option key={category.category_id} value={category.category_id}>
                {category.category_name}
              </option>
            ))}
          </select>
        </label>
        <label className="searchField">
          <span>Search</span>
          <span className="inputWithIcon">
            <Search aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Merchant, reference, account"
            />
          </span>
        </label>
      </section>

      <section className="panel">
        {loading && filteredTransactions.length === 0 ? (
          <LoadingBlock label="Loading transactions" />
        ) : filteredTransactions.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable transactionTable">
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
                  const saving = savingTransactionIds.has(transaction.transaction_id);
                  const signedAmount = signedTransactionAmount(transaction);

                  return (
                    <tr key={transaction.transaction_id}>
                      <td>{formatDate(transaction.transaction_date)}</td>
                      <td>
                        <strong>{transaction.merchant_name}</strong>
                      </td>
                      <td>{transaction.reference || "-"}</td>
                      <td>
                        <select
                          className="tableSelect"
                          value={transaction.category_id ? String(transaction.category_id) : ""}
                          onChange={(event) => updateTransactionCategory(transaction, event.target.value)}
                          disabled={saving}
                          aria-label={`Category for ${transaction.merchant_name}`}
                        >
                          <option value="" disabled>
                            {getCategoryName(transaction, categories)}
                          </option>
                          {categories.map((category) => (
                            <option key={category.category_id} value={category.category_id}>
                              {category.category_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{transaction.account_name}</td>
                      <td>{transaction.institution_name || "-"}</td>
                      <td>
                        <span className={isOutbound(transaction) ? "directionChip outbound" : "directionChip inbound"}>
                          {transaction.direction}
                        </span>
                      </td>
                      <td className={signedAmount < 0 ? "amount negative" : "amount positive"}>
                        {formatSignedTransaction(transaction)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyBlock title="No matching transactions" detail="Adjust filters or refresh the backend data." />
        )}
      </section>
    </>
  );
}
