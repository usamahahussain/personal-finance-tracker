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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccountBalance,
  BalanceResponse,
  CategoryResponse,
  CategoryUpdate,
  RawTransaction,
  Transaction,
  formatDateTime,
  formatMoney,
  normaliseBalance,
  normaliseTransaction,
  sortBalances,
  sortByName,
  toAmount
} from "@/lib/finance";

type HealthState = "checking" | "online" | "offline";
type RouteState = "idle" | "loading" | "success" | "error";

type ApiResult<T> = {
  data: T;
  status: number;
};

type RouteLog = {
  method: string;
  path: string;
  label: string;
  state: RouteState;
  detail: string;
  updatedAt: Date | null;
  payload: unknown;
};

type DraftCategory = {
  category_name: string;
  budget: string;
};

class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const routeDefinitions = [
  {
    key: "database",
    method: "GET",
    path: "/database",
    label: "Database status"
  },
  {
    key: "balances",
    method: "GET",
    path: "/balance",
    label: "All account balances"
  },
  {
    key: "balanceDetail",
    method: "GET",
    path: "/balance/{account_id}",
    label: "Single account balance"
  },
  {
    key: "refresh",
    method: "POST",
    path: "/refresh",
    label: "Refresh transactions"
  },
  {
    key: "categories",
    method: "GET",
    path: "/categories",
    label: "List categories"
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
  }
] as const;

type RouteKey = (typeof routeDefinitions)[number]["key"];

const initialRouteLogs = routeDefinitions.reduce(
  (logs, route) => ({
    ...logs,
    [route.key]: {
      method: route.method,
      path: route.path,
      label: route.label,
      state: "idle",
      detail: "Not called",
      updatedAt: null,
      payload: null
    }
  }),
  {} as Record<RouteKey, RouteLog>
);

async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  const response = await fetch(`/api/backend/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload && "detail" in payload
        ? String((payload as { detail?: unknown }).detail)
        : typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error?: unknown }).error)
          : `Request failed with status ${response.status}`;

    throw new ApiError(detail, response.status, payload);
  }

  return {
    data: payload as T,
    status: response.status
  };
}

function routeStatusLabel(state: RouteState) {
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

function statusLabel(state: HealthState) {
  if (state === "checking") {
    return "Checking";
  }

  return state === "online" ? "Online" : "Offline";
}

function formatPayload(payload: unknown) {
  if (payload === null || typeof payload === "undefined") {
    return "No response body";
  }

  if (typeof payload === "string") {
    return payload;
  }

  return JSON.stringify(payload, null, 2);
}

function countPayload(payload: unknown, singular: string, plural: string) {
  return Array.isArray(payload)
    ? `${payload.length} ${payload.length === 1 ? singular : plural}`
    : null;
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <section className="alertBar" role="status">
      <AlertCircle aria-hidden="true" />
      <span>{error}</span>
    </section>
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

function Metric({
  label,
  value,
  detail,
  icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="metric">
      <div className="metricIcon" aria-hidden="true">
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

function RouteCard({ route }: { route: RouteLog }) {
  const payloadCount =
    countPayload(route.payload, "item", "items") ??
    (route.payload ? "Response body" : "No body");

  return (
    <article className={`routeCard route-${route.state}`}>
      <div className="routeHeader">
        <div>
          <span className="method">{route.method}</span>
          <code>{route.path}</code>
        </div>
        <span className="statusBadge">{routeStatusLabel(route.state)}</span>
      </div>
      <h3>{route.label}</h3>
      <p>{route.detail}</p>
      <div className="routeMeta">
        <span>{payloadCount}</span>
        <span>{formatDateTime(route.updatedAt)}</span>
      </div>
      <details>
        <summary>Response</summary>
        <pre>{formatPayload(route.payload)}</pre>
      </details>
    </article>
  );
}

function BalanceRow({ balance }: { balance: AccountBalance }) {
  return (
    <div className="dataRow balanceRow">
      <span>
        <strong>{balance.account}</strong>
        <small>{balance.institution}</small>
      </span>
      <span>{formatMoney(balance.amount)}</span>
    </div>
  );
}

function CategoryRow({
  category,
  isEditing,
  draft,
  saving,
  deleting,
  onEdit,
  onDraftChange,
  onCancel,
  onSave,
  onDelete
}: {
  category: CategoryResponse;
  isEditing: boolean;
  draft: DraftCategory;
  saving: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDraftChange: (draft: DraftCategory) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  if (isEditing) {
    return (
      <div className="dataRow categoryRow editing">
        <span className="categoryId">#{category.category_id}</span>
        <label>
          <span>Name</span>
          <input
            value={draft.category_name}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                category_name: event.target.value
              })
            }
          />
        </label>
        <label>
          <span>Budget</span>
          <input
            inputMode="decimal"
            placeholder="No budget"
            value={draft.budget}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                budget: event.target.value
              })
            }
          />
        </label>
        <div className="rowActions">
          <button
            className="iconButton success"
            type="button"
            title="Save category"
            aria-label={`Save ${category.category_name}`}
            disabled={saving}
            onClick={onSave}
          >
            <Save aria-hidden="true" />
          </button>
          <button
            className="iconButton"
            type="button"
            title="Cancel edit"
            aria-label="Cancel edit"
            disabled={saving}
            onClick={onCancel}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dataRow categoryRow">
      <span className="categoryId">#{category.category_id}</span>
      <span>
        <strong>{category.category_name}</strong>
        <small>category_name</small>
      </span>
      <span>
        <strong>
          {category.budget === null ? "No budget" : formatMoney(category.budget)}
        </strong>
        <small>budget</small>
      </span>
      <div className="rowActions">
        <button
          className="iconButton"
          type="button"
          title="Edit category"
          aria-label={`Edit ${category.category_name}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" />
        </button>
        <button
          className="iconButton danger"
          type="button"
          title="Delete category"
          aria-label={`Delete ${category.category_name}`}
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [routeLogs, setRouteLogs] =
    useState<Record<RouteKey, RouteLog>>(initialRouteLogs);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [singleBalance, setSingleBalance] = useState<AccountBalance | null>(
    null
  );
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [health, setHealth] = useState<HealthState>("checking");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [accountId, setAccountId] = useState("");
  const [query, setQuery] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null
  );
  const [categoryDraft, setCategoryDraft] = useState<DraftCategory>({
    category_name: "",
    budget: ""
  });
  const [savingCategoryId, setSavingCategoryId] = useState<number | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(
    null
  );

  const updateRoute = useCallback(
    (key: RouteKey, patch: Partial<RouteLog>) => {
      setRouteLogs((current) => ({
        ...current,
        [key]: {
          ...current[key],
          ...patch
        }
      }));
    },
    []
  );

  const runRoute = useCallback(
    async <T,>(key: RouteKey, path: string, init?: RequestInit) => {
      updateRoute(key, {
        state: "loading",
        detail: "Request in progress",
        updatedAt: new Date()
      });

      try {
        const result = await apiRequest<T>(path, init);
        updateRoute(key, {
          state: "success",
          detail:
            result.status === 204
              ? "204 No Content"
              : `${result.status} response received`,
          updatedAt: new Date(),
          payload: result.data
        });
        return result.data;
      } catch (routeError) {
        const message =
          routeError instanceof Error ? routeError.message : "Request failed";
        updateRoute(key, {
          state: "error",
          detail:
            routeError instanceof ApiError
              ? `${routeError.status} ${message}`
              : message,
          updatedAt: new Date(),
          payload: routeError instanceof ApiError ? routeError.payload : null
        });
        throw routeError;
      }
    },
    [updateRoute]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [databaseResult, balanceResult, categoriesResult] =
      await Promise.allSettled([
        runRoute<{ status?: string }>("database", "database"),
        runRoute<BalanceResponse[]>("balances", "balance"),
        runRoute<CategoryResponse[]>("categories", "categories")
      ]);

    if (databaseResult.status === "fulfilled") {
      setHealth(
        databaseResult.value.status?.toUpperCase() === "OK"
          ? "online"
          : "offline"
      );
    } else {
      setHealth("offline");
      setError(
        databaseResult.reason instanceof Error
          ? databaseResult.reason.message
          : "Database check failed"
      );
    }

    if (balanceResult.status === "fulfilled") {
      setBalances(balanceResult.value.map(normaliseBalance));
    } else {
      setBalances([]);
      setError(
        balanceResult.reason instanceof Error
          ? balanceResult.reason.message
          : "Balance request failed"
      );
    }

    if (categoriesResult.status === "fulfilled") {
      setCategories(sortByName(categoriesResult.value));
    } else {
      setCategories([]);
      setError(
        categoriesResult.reason instanceof Error
          ? categoriesResult.reason.message
          : "Category request failed"
      );
    }

    setLastLoaded(new Date());
    setLoading(false);
  }, [runRoute]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const refreshTransactions = async () => {
    setSyncing(true);
    setError(null);

    try {
      const payload = await runRoute<RawTransaction[]>("refresh", "refresh", {
        method: "POST"
      });
      setTransactions(payload.map(normaliseTransaction));
      await loadDashboard();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : "Refresh failed"
      );
    } finally {
      setSyncing(false);
    }
  };

  const lookupBalance = async () => {
    const trimmedId = accountId.trim();
    if (!trimmedId) {
      setError("Enter an account_id before calling GET /balance/{account_id}");
      return;
    }

    setError(null);

    try {
      const payload = await runRoute<BalanceResponse>(
        "balanceDetail",
        `balance/${encodeURIComponent(trimmedId)}`
      );
      setSingleBalance(normaliseBalance(payload, 0));
    } catch (lookupError) {
      setSingleBalance(null);
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Balance lookup failed"
      );
    }
  };

  const startCategoryEdit = (category: CategoryResponse) => {
    setEditingCategoryId(category.category_id);
    setCategoryDraft({
      category_name: category.category_name,
      budget: category.budget === null ? "" : String(category.budget)
    });
  };

  const cancelCategoryEdit = () => {
    setEditingCategoryId(null);
    setCategoryDraft({
      category_name: "",
      budget: ""
    });
  };

  const saveCategory = async (categoryId: number) => {
    const categoryName = categoryDraft.category_name.trim();
    const budgetText = categoryDraft.budget.trim();
    const budget = budgetText === "" ? null : Number(budgetText);

    if (!categoryName) {
      setError("category_name is required");
      return;
    }

    if (budgetText !== "" && !Number.isFinite(budget)) {
      setError("budget must be a number or empty");
      return;
    }

    setSavingCategoryId(categoryId);
    setError(null);

    try {
      const payload: CategoryUpdate = {
        category_name: categoryName,
        budget
      };
      const updated = await runRoute<CategoryResponse>(
        "categoryUpdate",
        `categories/${categoryId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload)
        }
      );
      setCategories((current) =>
        sortByName(
          current.map((category) =>
            category.category_id === categoryId ? updated : category
          )
        )
      );
      cancelCategoryEdit();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Category update failed"
      );
    } finally {
      setSavingCategoryId(null);
    }
  };

  const deleteCategory = async (category: CategoryResponse) => {
    const confirmed = window.confirm(
      `Delete category "${category.category_name}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingCategoryId(category.category_id);
    setError(null);

    try {
      await runRoute<null>("categoryDelete", `categories/${category.category_id}`, {
        method: "DELETE"
      });
      setCategories((current) =>
        current.filter((item) => item.category_id !== category.category_id)
      );
      if (editingCategoryId === category.category_id) {
        cancelCategoryEdit();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Delete failed"
      );
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const totalBalance = useMemo(
    () => balances.reduce((total, account) => total + account.amount, 0),
    [balances]
  );

  const budgetTotal = useMemo(
    () =>
      categories.reduce(
        (total, category) => total + toAmount(category.budget),
        0
      ),
    [categories]
  );

  const filteredBalances = useMemo(() => {
    const term = query.trim().toLowerCase();
    const sorted = sortBalances(balances);

    if (!term) {
      return sorted;
    }

    return sorted.filter((account) =>
      `${account.account} ${account.institution}`.toLowerCase().includes(term)
    );
  }, [balances, query]);

  const routeLogList = useMemo(
    () => routeDefinitions.map((route) => routeLogs[route.key]),
    [routeLogs]
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
            <h1>API Console</h1>
          </div>
        </div>

        <div className="topbarActions">
          <button
            className="iconButton"
            type="button"
            onClick={loadDashboard}
            disabled={loading || syncing}
            title="Reload API data"
            aria-label="Reload API data"
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
            <span>{syncing ? "Refreshing" : "POST /refresh"}</span>
          </button>
        </div>
      </header>

      <ErrorMessage error={error} />

      <section className="metricGrid" aria-label="API summary">
        <Metric
          label="Database"
          value={statusLabel(health)}
          detail="GET /database"
          icon={health === "online" ? <CheckCircle2 /> : <Database />}
        />
        <Metric
          label="Balances"
          value={formatMoney(totalBalance)}
          detail={`${balances.length} rows from GET /balance`}
          icon={<Banknote />}
        />
        <Metric
          label="Categories"
          value={String(categories.length)}
          detail={`${formatMoney(budgetTotal)} total budget`}
          icon={<Database />}
        />
        <Metric
          label="Last Loaded"
          value={lastLoaded ? formatDateTime(lastLoaded) : "Pending"}
          detail="Latest automatic route refresh"
          icon={<Activity />}
        />
      </section>

      <section className="routeGrid" aria-label="Backend routes">
        {routeLogList.map((route) => (
          <RouteCard key={`${route.method}-${route.path}`} route={route} />
        ))}
      </section>

      <section className="workspace">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p>GET /balance</p>
              <h2>Account Balances</h2>
            </div>
            <label className="searchBox">
              <Search aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search account or institution"
              />
            </label>
          </div>

          {loading ? (
            <EmptyState
              icon={<Activity />}
              title="Loading balances"
              detail="Waiting for the FastAPI balance route."
            />
          ) : filteredBalances.length > 0 ? (
            <div className="dataList">
              {filteredBalances.map((balance) => (
                <BalanceRow key={balance.id} balance={balance} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Banknote />}
              title="No balances returned"
              detail="The route returned an empty array."
            />
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p>GET /balance/{"{account_id}"}</p>
              <h2>Single Account Lookup</h2>
            </div>
          </div>
          <div className="lookupForm">
            <label>
              <span>account_id</span>
              <input
                inputMode="numeric"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                placeholder="1"
              />
            </label>
            <button className="secondaryButton" type="button" onClick={lookupBalance}>
              Call route
            </button>
          </div>
          {singleBalance ? (
            <div className="dataList singleResult">
              <BalanceRow balance={singleBalance} />
            </div>
          ) : (
            <EmptyState
              icon={<Search />}
              title="No account selected"
              detail="Enter an account_id and call the single balance route."
            />
          )}
        </section>

        <section className="panel widePanel">
          <div className="panelHeader">
            <div>
              <p>GET, PUT, DELETE /categories</p>
              <h2>Categories</h2>
            </div>
          </div>
          {categories.length > 0 ? (
            <div className="dataList">
              {categories.map((category) => (
                <CategoryRow
                  key={category.category_id}
                  category={category}
                  isEditing={editingCategoryId === category.category_id}
                  draft={categoryDraft}
                  saving={savingCategoryId === category.category_id}
                  deleting={deletingCategoryId === category.category_id}
                  onEdit={() => startCategoryEdit(category)}
                  onDraftChange={setCategoryDraft}
                  onCancel={cancelCategoryEdit}
                  onSave={() => saveCategory(category.category_id)}
                  onDelete={() => deleteCategory(category)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Database />}
              title="No categories returned"
              detail="The category list route returned an empty array."
            />
          )}
        </section>

        <section className="panel widePanel">
          <div className="panelHeader">
            <div>
              <p>POST /refresh</p>
              <h2>Refresh Transactions</h2>
            </div>
          </div>
          {transactions.length > 0 ? (
            <div className="transactionTable">
              <div className="tableHead">
                <span>Date</span>
                <span>Merchant</span>
                <span>Account</span>
                <span>Amount</span>
                <span>Raw</span>
              </div>
              {transactions.map((transaction) => (
                <div className="tableRow" key={transaction.id}>
                  <span>{transaction.date || "Unknown"}</span>
                  <span>
                    <strong>{transaction.merchant}</strong>
                    <small>{transaction.description}</small>
                  </span>
                  <span>
                    <strong>{transaction.accountName}</strong>
                    <small>
                      {transaction.accountId === null
                        ? "account_id unavailable"
                        : `account_id ${transaction.accountId}`}
                    </small>
                  </span>
                  <span
                    className={
                      transaction.amount >= 0 ? "amountIn" : "amountOut"
                    }
                  >
                    {formatMoney(transaction.amount)}
                  </span>
                  <details className="rowDetails">
                    <summary>JSON</summary>
                    <pre>{formatPayload(transaction.raw)}</pre>
                  </details>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<PlugZap />}
              title="No refresh response yet"
              detail="Use POST /refresh to display returned transactions."
            />
          )}
        </section>
      </section>
    </main>
  );
}
