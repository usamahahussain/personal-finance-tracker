"use client";

import {
  Activity,
  AlertCircle,
  Banknote,
  CheckCircle2,
  Database,
  Pencil,
  PlugZap,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  WalletCards,
  X
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  BalanceResponse,
  CategoryResponse,
  CategoryUpdate,
  RefreshResponse,
  TransactionResponse,
  apiRequest,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPayload,
  formatSignedTransaction,
  toNumber
} from "@/lib/finance";

type RouteKey =
  | "database"
  | "balances"
  | "balanceDetail"
  | "categories"
  | "categoryCreate"
  | "categoryUpdate"
  | "categoryDelete"
  | "transactions"
  | "refresh";

type RouteState = "idle" | "loading" | "success" | "error";

type RouteDefinition = {
  key: RouteKey;
  method: "GET" | "POST" | "PUT" | "DELETE";
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

type CategoryDraft = {
  category_name: string;
  budget: string;
};

type HealthState = "checking" | "online" | "offline";

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
    key: "balanceDetail",
    method: "GET",
    path: "/balance/{account_id}",
    label: "Account balance"
  },
  {
    key: "categories",
    method: "GET",
    path: "/categories",
    label: "Categories"
  },
  {
    key: "categoryCreate",
    method: "POST",
    path: "/categories",
    label: "Create category"
  },
  {
    key: "categoryUpdate",
    method: "PUT",
    path: "/categories/{category_id}",
    label: "Update category"
  },
  {
    key: "categoryDelete",
    method: "DELETE",
    path: "/categories/{category_id}",
    label: "Delete category"
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

function parseCategoryDraft(
  draft: CategoryDraft
): { ok: true; payload: CategoryUpdate } | { ok: false; error: string } {
  const categoryName = draft.category_name.trim();

  if (!categoryName) {
    return { ok: false, error: "Category name is required." };
  }

  const budgetText = draft.budget.trim();

  if (!budgetText) {
    return {
      ok: true,
      payload: {
        category_name: categoryName,
        budget: null
      }
    };
  }

  const budget = Number(budgetText);

  if (!Number.isFinite(budget)) {
    return { ok: false, error: "Budget must be a number." };
  }

  return {
    ok: true,
    payload: {
      category_name: categoryName,
      budget
    }
  };
}

function categoryDraft(category: CategoryResponse): CategoryDraft {
  return {
    category_name: category.category_name,
    budget:
      category.budget === null || typeof category.budget === "undefined"
        ? ""
        : String(category.budget)
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.status}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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

function healthLabel(state: HealthState) {
  if (state === "checking") {
    return "Checking";
  }

  return state === "online" ? "Online" : "Offline";
}

function Stat({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="statItem">
      <span className="statIcon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="emptyState">
      <span className="emptyIcon" aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
    </div>
  );
}

export function Dashboard() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [balances, setBalances] = useState<BalanceResponse[]>([]);
  const [selectedBalance, setSelectedBalance] = useState<BalanceResponse | null>(
    null
  );
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [routeLogs, setRouteLogs] = useState(createInitialRouteLogs);
  const [accountId, setAccountId] = useState("1");
  const [newCategory, setNewCategory] = useState<CategoryDraft>({
    category_name: "",
    budget: ""
  });
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<number, CategoryDraft>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runRoute = useCallback(
    async <T,>(
      key: RouteKey,
      actualPath: string,
      init?: RequestInit
    ): Promise<T | undefined> => {
      const route = routeDefinitions.find((item) => item.key === key);

      if (!route) {
        setError(`Unknown route: ${key}`);
        return undefined;
      }

      setError(null);
      setNotice(null);
      setRouteLogs((current) => ({
        ...current,
        [key]: {
          ...current[key],
          state: "loading",
          detail: `Calling ${actualPath}`,
          updatedAt: new Date(),
          payload: null
        }
      }));

      try {
        const result = await apiRequest<T>(actualPath, init);
        setRouteLogs((current) => ({
          ...current,
          [key]: {
            ...current[key],
            state: "success",
            status: result.status,
            detail: `${route.method} ${actualPath}`,
            updatedAt: new Date(),
            payload: result.data
          }
        }));
        setNotice(`${route.label} completed.`);
        return result.data;
      } catch (requestError) {
        const message = getErrorMessage(requestError);
        const payload =
          requestError instanceof ApiError ? requestError.payload : message;
        const status =
          requestError instanceof ApiError ? requestError.status : null;

        setRouteLogs((current) => ({
          ...current,
          [key]: {
            ...current[key],
            state: "error",
            status,
            detail: message,
            updatedAt: new Date(),
            payload
          }
        }));
        setError(message);
        return undefined;
      }
    },
    []
  );

  const checkDatabase = useCallback(async () => {
    const result = await runRoute<{ status: string }>("database", "/database");
    setHealth(result?.status === "OK" ? "online" : "offline");
  }, [runRoute]);

  const loadBalances = useCallback(async () => {
    const result = await runRoute<BalanceResponse[]>("balances", "/balance");

    if (result) {
      setBalances(result);
    }
  }, [runRoute]);

  const loadBalance = useCallback(async () => {
    const id = Number(accountId);

    if (!Number.isInteger(id) || id <= 0) {
      setError("Account ID must be a positive integer.");
      return;
    }

    const result = await runRoute<BalanceResponse>(
      "balanceDetail",
      `/balance/${id}`
    );

    if (result) {
      setSelectedBalance(result);
    }
  }, [accountId, runRoute]);

  const loadCategories = useCallback(async () => {
    const result = await runRoute<CategoryResponse[]>(
      "categories",
      "/categories"
    );

    if (result) {
      const sorted = [...result].sort((a, b) =>
        a.category_name.localeCompare(b.category_name)
      );
      setCategories(sorted);
      setCategoryDrafts(
        Object.fromEntries(
          sorted.map((category) => [category.category_id, categoryDraft(category)])
        )
      );
    }
  }, [runRoute]);

  const loadTransactions = useCallback(async () => {
    const result = await runRoute<TransactionResponse[]>(
      "transactions",
      "/transactions"
    );

    if (result) {
      setTransactions(result);
    }
  }, [runRoute]);

  useEffect(() => {
    void checkDatabase();
    void loadCategories();
    void loadTransactions();
  }, [checkDatabase, loadCategories, loadTransactions]);

  const balanceTotal = useMemo(
    () => balances.reduce((total, balance) => total + toNumber(balance.balance), 0),
    [balances]
  );

  const recentTransactions = useMemo(
    () => transactions.slice(0, 25),
    [transactions]
  );

  async function refreshTransactions() {
    const result = await runRoute<RefreshResponse>("refresh", "/refresh", {
      method: "POST"
    });

    if (result) {
      await loadTransactions();
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseCategoryDraft(newCategory);

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const result = await runRoute<CategoryResponse>("categoryCreate", "/categories", {
      method: "POST",
      body: JSON.stringify(parsed.payload)
    });

    if (result) {
      setNewCategory({ category_name: "", budget: "" });
      setCategories((current) =>
        [...current, result].sort((a, b) =>
          a.category_name.localeCompare(b.category_name)
        )
      );
      setCategoryDrafts((current) => ({
        ...current,
        [result.category_id]: categoryDraft(result)
      }));
    }
  }

  async function updateCategory(categoryId: number) {
    const draft = categoryDrafts[categoryId];

    if (!draft) {
      setError("Category draft was not found.");
      return;
    }

    const parsed = parseCategoryDraft(draft);

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const result = await runRoute<CategoryResponse>(
      "categoryUpdate",
      `/categories/${categoryId}`,
      {
        method: "PUT",
        body: JSON.stringify(parsed.payload)
      }
    );

    if (result) {
      setCategories((current) =>
        current
          .map((category) =>
            category.category_id === categoryId ? result : category
          )
          .sort((a, b) => a.category_name.localeCompare(b.category_name))
      );
      setCategoryDrafts((current) => ({
        ...current,
        [categoryId]: categoryDraft(result)
      }));
    }
  }

  async function deleteCategory(categoryId: number) {
    const result = await runRoute<null>(
      "categoryDelete",
      `/categories/${categoryId}`,
      {
        method: "DELETE"
      }
    );

    if (typeof result !== "undefined") {
      setCategories((current) =>
        current.filter((category) => category.category_id !== categoryId)
      );
      setCategoryDrafts((current) => {
        const next = { ...current };
        delete next[categoryId];
        return next;
      });
    }
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">
            <WalletCards />
          </span>
          <div>
            <p>Personal Finance Tracker</p>
            <h1>Backend Dashboard</h1>
          </div>
        </div>

        <div className="topbarActions">
          <span className={`healthBadge ${health}`}>
            {health === "online" ? <CheckCircle2 /> : <AlertCircle />}
            {healthLabel(health)}
          </span>
          <button
            className="secondaryButton"
            type="button"
            onClick={checkDatabase}
            title="GET /database"
          >
            <Database />
            Check
          </button>
          <button
            className="primaryButton"
            type="button"
            onClick={refreshTransactions}
            title="POST /refresh"
          >
            <RefreshCcw />
            Refresh
          </button>
        </div>
      </header>

      {(notice || error) && (
        <div className={error ? "message error" : "message success"} role="status">
          {error ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <span>{error || notice}</span>
        </div>
      )}

      <section className="statGrid" aria-label="Dashboard totals">
        <Stat label="Balance total" value={formatMoney(balanceTotal)} icon={<Banknote />} />
        <Stat label="Accounts loaded" value={String(balances.length)} icon={<WalletCards />} />
        <Stat label="Categories" value={String(categories.length)} icon={<Pencil />} />
        <Stat label="Transactions" value={String(transactions.length)} icon={<Activity />} />
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <p>Balances</p>
            <h2>Accounts</h2>
          </div>
          <button
            className="secondaryButton"
            type="button"
            onClick={loadBalances}
            title="GET /balance"
          >
            <WalletCards />
            Load All
          </button>
        </div>

        <div className="lookupBar">
          <label>
            <span>Account ID</span>
            <input
              inputMode="numeric"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            />
          </label>
          <button
            className="secondaryButton"
            type="button"
            onClick={loadBalance}
            title="GET /balance/{account_id}"
          >
            <Search />
            Lookup
          </button>
          {selectedBalance && (
            <div className="selectedBalance">
              <strong>{selectedBalance.account}</strong>
              <span>{formatMoney(selectedBalance.balance)}</span>
            </div>
          )}
        </div>

        {balances.length > 0 ? (
          <div className="balanceList">
            {balances.map((balance, index) => (
              <article
                className="balanceItem"
                key={`${balance.account}-${balance.institution || "bank"}-${index}`}
              >
                <div>
                  <strong>{balance.account}</strong>
                  <span>{balance.institution || "Unknown institution"}</span>
                </div>
                <b>{formatMoney(balance.balance)}</b>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={<WalletCards />} title="No balances loaded" />
        )}
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <p>Categories</p>
            <h2>Budgets</h2>
          </div>
          <button
            className="secondaryButton"
            type="button"
            onClick={loadCategories}
            title="GET /categories"
          >
            <RefreshCcw />
            Reload
          </button>
        </div>

        <form className="categoryForm" onSubmit={createCategory}>
          <label>
            <span>Name</span>
            <input
              value={newCategory.category_name}
              onChange={(event) =>
                setNewCategory((current) => ({
                  ...current,
                  category_name: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>Budget</span>
            <input
              inputMode="decimal"
              value={newCategory.budget}
              onChange={(event) =>
                setNewCategory((current) => ({
                  ...current,
                  budget: event.target.value
                }))
              }
            />
          </label>
          <button className="primaryButton" type="submit" title="POST /categories">
            <Save />
            Create
          </button>
        </form>

        {categories.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Budget</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const draft = categoryDrafts[category.category_id] ||
                    categoryDraft(category);

                  return (
                    <tr key={category.category_id}>
                      <td>{category.category_id}</td>
                      <td>
                        <input
                          value={draft.category_name}
                          onChange={(event) =>
                            setCategoryDrafts((current) => ({
                              ...current,
                              [category.category_id]: {
                                ...draft,
                                category_name: event.target.value
                              }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          inputMode="decimal"
                          value={draft.budget}
                          onChange={(event) =>
                            setCategoryDrafts((current) => ({
                              ...current,
                              [category.category_id]: {
                                ...draft,
                                budget: event.target.value
                              }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <div className="rowActions">
                          <button
                            className="iconButton success"
                            type="button"
                            onClick={() => updateCategory(category.category_id)}
                            title="PUT /categories/{category_id}"
                            aria-label={`Save category ${category.category_id}`}
                          >
                            <Save />
                          </button>
                          <button
                            className="iconButton danger"
                            type="button"
                            onClick={() => deleteCategory(category.category_id)}
                            title="DELETE /categories/{category_id}"
                            aria-label={`Delete category ${category.category_id}`}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Pencil />} title="No categories loaded" />
        )}
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <p>Transactions</p>
            <h2>Recent Activity</h2>
          </div>
          <div className="sectionActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={loadTransactions}
              title="GET /transactions"
            >
              <Activity />
              Load
            </button>
            <button
              className="primaryButton"
              type="button"
              onClick={refreshTransactions}
              title="POST /refresh"
            >
              <RefreshCcw />
              Refresh
            </button>
          </div>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction, index) => (
                  <tr
                    key={`${transaction.transaction_id || index}-${transaction.transaction_date}`}
                  >
                    <td>{formatDate(transaction.transaction_date)}</td>
                    <td>
                      <strong>{transaction.merchant_name}</strong>
                      {transaction.reference && <span>{transaction.reference}</span>}
                    </td>
                    <td>
                      {transaction.account_name || `Account ${transaction.account_id}`}
                    </td>
                    <td>{transaction.category_name || transaction.category_id || "-"}</td>
                    <td
                      className={
                        transaction.direction === "OUTBOUND"
                          ? "amount outbound"
                          : "amount inbound"
                      }
                    >
                      {formatSignedTransaction(transaction)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Activity />} title="No transactions loaded" />
        )}
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <p>Routes</p>
            <h2>API Activity</h2>
          </div>
        </div>

        <div className="routeGrid">
          {routeDefinitions.map((route) => {
            const log = routeLogs[route.key];

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
                <details>
                  <summary>Response</summary>
                  <pre>{formatPayload(log.payload)}</pre>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      <footer>
        <PlugZap aria-hidden="true" />
        <span>Proxy target: FASTAPI_BASE_URL</span>
      </footer>
    </main>
  );
}
