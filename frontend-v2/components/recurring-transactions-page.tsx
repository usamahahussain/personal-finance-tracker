"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, Plus, RefreshCcw, Repeat2, Save, Trash2 } from "lucide-react";
import {
  CategoryResponse,
  RecurringTransactionResponse,
  RecurringTransactionUpdate,
  TransactionResponse,
  apiRequest,
  formatMoney,
  getErrorMessage,
  isOutbound,
  toNumber
} from "@/lib/finance";
import { EmptyBlock, LoadingBlock, MetricTile, StatusMessage } from "@/components/ui";

type RecurringDraft = {
  display_name: string;
  category_id: string;
  expected_amount: string;
  due_day: string;
  active: boolean;
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

function recurringDraft(series: RecurringTransactionResponse): RecurringDraft {
  return {
    display_name: series.display_name,
    category_id:
      series.category_id === null || typeof series.category_id === "undefined"
        ? ""
        : String(series.category_id),
    expected_amount:
      series.expected_amount === null || typeof series.expected_amount === "undefined"
        ? ""
        : String(series.expected_amount),
    due_day:
      series.due_day === null || typeof series.due_day === "undefined"
        ? ""
        : String(series.due_day),
    active: series.active
  };
}

function parseRecurringDraft(
  draft: RecurringDraft
): { ok: true; payload: RecurringTransactionUpdate } | { ok: false; error: string } {
  const displayName = draft.display_name.trim();

  if (!displayName) {
    return { ok: false, error: "Series name is required." };
  }

  const categoryId = draft.category_id ? Number(draft.category_id) : null;

  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1)) {
    return { ok: false, error: "Category selection is invalid." };
  }

  const expectedAmount = draft.expected_amount.trim()
    ? Number(draft.expected_amount)
    : null;

  if (
    expectedAmount !== null &&
    (!Number.isFinite(expectedAmount) || expectedAmount < 0)
  ) {
    return { ok: false, error: "Expected amount must be a positive number." };
  }

  const dueDay = draft.due_day.trim() ? Number(draft.due_day) : null;

  if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
    return { ok: false, error: "Due day must be between 1 and 31." };
  }

  return {
    ok: true,
    payload: {
      display_name: displayName,
      category_id: categoryId,
      expected_amount: expectedAmount,
      due_day: dueDay,
      active: draft.active
    }
  };
}

export function RecurringTransactionsPage() {
  const [series, setSeries] = useState<RecurringTransactionResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [drafts, setDrafts] = useState<Record<number, RecurringDraft>>({});
  const [newSeries, setNewSeries] = useState<RecurringDraft>({
    display_name: "",
    category_id: "",
    expected_amount: "",
    due_day: "",
    active: true
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingSeriesIds, setSavingSeriesIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPageData = useCallback(async (showNotice = false) => {
    setLoading(true);
    setError(null);

    try {
      const [seriesResult, categoryResult, transactionResult] = await Promise.all([
        apiRequest<RecurringTransactionResponse[]>("/recurring-transactions"),
        apiRequest<CategoryResponse[]>("/categories"),
        apiRequest<TransactionResponse[]>("/transactions")
      ]);
      const sortedSeries = sortRecurringTransactions(seriesResult.data);

      setSeries(sortedSeries);
      setCategories(sortCategories(categoryResult.data));
      setTransactions(transactionResult.data);
      setDrafts(
        Object.fromEntries(
          sortedSeries.map((item) => [
            item.recurring_transaction_id,
            recurringDraft(item)
          ])
        )
      );

      if (showNotice) {
        setNotice("Recurring transactions reloaded.");
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

  const linkedCounts = useMemo(() => {
    const counts = new Map<number, number>();

    transactions.forEach((transaction) => {
      if (isOutbound(transaction) && transaction.recurring_transaction_id) {
        counts.set(
          transaction.recurring_transaction_id,
          (counts.get(transaction.recurring_transaction_id) || 0) + 1
        );
      }
    });

    return counts;
  }, [transactions]);

  const summary = useMemo(() => {
    const activeSeries = series.filter((item) => item.active);
    const expected = activeSeries.reduce(
      (total, item) => total + toNumber(item.expected_amount),
      0
    );
    const linkedTransactions = [...linkedCounts.values()].reduce(
      (total, count) => total + count,
      0
    );

    return {
      active: activeSeries.length,
      expected,
      linkedTransactions
    };
  }, [linkedCounts, series]);

  async function createSeries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseRecurringDraft(newSeries);

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError(null);
    setNotice(null);
    setCreating(true);

    try {
      const result = await apiRequest<RecurringTransactionResponse>(
        "/recurring-transactions",
        {
          method: "POST",
          body: JSON.stringify(parsed.payload)
        }
      );
      setSeries((current) =>
        sortRecurringTransactions([...current, result.data])
      );
      setDrafts((current) => ({
        ...current,
        [result.data.recurring_transaction_id]: recurringDraft(result.data)
      }));
      setNewSeries({
        display_name: "",
        category_id: "",
        expected_amount: "",
        due_day: "",
        active: true
      });
      setNotice(`Created ${result.data.display_name}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setCreating(false);
    }
  }

  async function updateSeries(seriesId: number) {
    const draft = drafts[seriesId];

    if (!draft) {
      setError("Recurring transaction draft was not found.");
      return;
    }

    const parsed = parseRecurringDraft(draft);

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError(null);
    setNotice(null);
    setSavingSeriesIds((current) => new Set(current).add(seriesId));

    try {
      const result = await apiRequest<RecurringTransactionResponse>(
        `/recurring-transactions/${seriesId}`,
        {
          method: "PUT",
          body: JSON.stringify(parsed.payload)
        }
      );

      setSeries((current) =>
        sortRecurringTransactions(
          current.map((item) =>
            item.recurring_transaction_id === seriesId ? result.data : item
          )
        )
      );
      setDrafts((current) => ({
        ...current,
        [seriesId]: recurringDraft(result.data)
      }));
      setNotice(`Saved ${result.data.display_name}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingSeriesIds((current) => {
        const next = new Set(current);
        next.delete(seriesId);
        return next;
      });
    }
  }

  async function deactivateSeries(item: RecurringTransactionResponse) {
    if (!window.confirm(`Deactivate ${item.display_name}?`)) {
      return;
    }

    setError(null);
    setNotice(null);
    setSavingSeriesIds((current) =>
      new Set(current).add(item.recurring_transaction_id)
    );

    try {
      await apiRequest<null>(
        `/recurring-transactions/${item.recurring_transaction_id}`,
        {
          method: "DELETE"
        }
      );

      setSeries((current) =>
        sortRecurringTransactions(
          current.map((currentItem) =>
            currentItem.recurring_transaction_id === item.recurring_transaction_id
              ? { ...currentItem, active: false }
              : currentItem
          )
        )
      );
      setDrafts((current) => ({
        ...current,
        [item.recurring_transaction_id]: {
          ...(current[item.recurring_transaction_id] || recurringDraft(item)),
          active: false
        }
      }));
      setNotice(`Deactivated ${item.display_name}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingSeriesIds((current) => {
        const next = new Set(current);
        next.delete(item.recurring_transaction_id);
        return next;
      });
    }
  }

  return (
    <>
      <section className="pageTop">
        <div>
          <p className="eyebrow">Expected monthly spend</p>
          <h1>Recurring transactions</h1>
        </div>
        <div className="toolbar">
          <button
            className="ghostButton"
            type="button"
            onClick={() => loadPageData(true)}
            disabled={loading}
          >
            <RefreshCcw />
            <span>Reload</span>
          </button>
        </div>
      </section>

      <StatusMessage error={error} notice={notice} />

      <section className="metricGrid compactMetrics" aria-label="Recurring transaction summary">
        <MetricTile label="Series" value={String(series.length)} icon={<Repeat2 />} />
        <MetricTile label="Active" value={String(summary.active)} tone="good" icon={<Save />} />
        <MetricTile
          label="Expected"
          value={formatMoney(summary.expected)}
          icon={<CircleDollarSign />}
        />
        <MetricTile
          label="Linked"
          value={String(summary.linkedTransactions)}
          icon={<CalendarDays />}
        />
      </section>

      <section className="panel">
        <form className="seriesCreateForm" onSubmit={createSeries}>
          <label>
            <span>Name</span>
            <input
              value={newSeries.display_name}
              onChange={(event) =>
                setNewSeries((current) => ({
                  ...current,
                  display_name: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>Category</span>
            <select
              value={newSeries.category_id}
              onChange={(event) =>
                setNewSeries((current) => ({
                  ...current,
                  category_id: event.target.value
                }))
              }
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Expected</span>
            <input
              inputMode="decimal"
              value={newSeries.expected_amount}
              onChange={(event) =>
                setNewSeries((current) => ({
                  ...current,
                  expected_amount: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>Due day</span>
            <input
              inputMode="numeric"
              value={newSeries.due_day}
              onChange={(event) =>
                setNewSeries((current) => ({
                  ...current,
                  due_day: event.target.value
                }))
              }
            />
          </label>
          <button className="primaryButton" type="submit" disabled={creating}>
            <Plus />
            <span>{creating ? "Creating" : "Create"}</span>
          </button>
        </form>

        {loading && series.length === 0 ? (
          <LoadingBlock label="Loading recurring transactions" />
        ) : series.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable recurringTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Expected</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Linked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {series.map((item) => {
                  const draft =
                    drafts[item.recurring_transaction_id] || recurringDraft(item);
                  const saving = savingSeriesIds.has(item.recurring_transaction_id);

                  return (
                    <tr key={item.recurring_transaction_id}>
                      <td>
                        <input
                          value={draft.display_name}
                          aria-label={`Name for ${item.display_name}`}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.recurring_transaction_id]: {
                                ...draft,
                                display_name: event.target.value
                              }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={draft.category_id}
                          aria-label={`Category for ${item.display_name}`}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.recurring_transaction_id]: {
                                ...draft,
                                category_id: event.target.value
                              }
                            }))
                          }
                        >
                          <option value="">No category</option>
                          {categories.map((category) => (
                            <option key={category.category_id} value={category.category_id}>
                              {category.category_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          inputMode="decimal"
                          value={draft.expected_amount}
                          aria-label={`Expected amount for ${item.display_name}`}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.recurring_transaction_id]: {
                                ...draft,
                                expected_amount: event.target.value
                              }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          value={draft.due_day}
                          aria-label={`Due day for ${item.display_name}`}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.recurring_transaction_id]: {
                                ...draft,
                                due_day: event.target.value
                              }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={draft.active ? "active" : "inactive"}
                          aria-label={`Status for ${item.display_name}`}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.recurring_transaction_id]: {
                                ...draft,
                                active: event.target.value === "active"
                              }
                            }))
                          }
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td>{linkedCounts.get(item.recurring_transaction_id) || 0}</td>
                      <td>
                        <div className="rowActions">
                          <button
                            className="iconButton good"
                            type="button"
                            onClick={() => updateSeries(item.recurring_transaction_id)}
                            disabled={saving}
                            aria-label={`Save ${item.display_name}`}
                          >
                            <Save />
                          </button>
                          <button
                            className="iconButton danger"
                            type="button"
                            onClick={() => deactivateSeries(item)}
                            disabled={saving || !item.active}
                            aria-label={`Deactivate ${item.display_name}`}
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
          <EmptyBlock
            title="No recurring transactions"
            detail="Create a series before linking imported transactions to it."
          />
        )}
      </section>
    </>
  );
}
