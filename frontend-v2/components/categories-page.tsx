"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Save, Tags, Trash2 } from "lucide-react";
import {
  CategoryResponse,
  CategoryUpdate,
  apiRequest,
  formatMoney,
  getErrorMessage,
  toNumber
} from "@/lib/finance";
import { EmptyBlock, LoadingBlock, MetricTile, StatusMessage } from "@/components/ui";

type CategoryDraft = {
  category_name: string;
  budget: string;
};

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

  if (!Number.isFinite(budget) || budget < 0) {
    return { ok: false, error: "Budget must be a positive number." };
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

function sortCategories(categories: CategoryResponse[]) {
  return [...categories].sort((a, b) => a.category_name.localeCompare(b.category_name));
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, CategoryDraft>>({});
  const [newCategory, setNewCategory] = useState<CategoryDraft>({
    category_name: "",
    budget: ""
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async (showNotice = false) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<CategoryResponse[]>("/categories");
      const sorted = sortCategories(result.data);
      setCategories(sorted);
      setCategoryDrafts(
        Object.fromEntries(
          sorted.map((category) => [category.category_id, categoryDraft(category)])
        )
      );

      if (showNotice) {
        setNotice("Categories reloaded.");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const budgetTotal = useMemo(
    () => categories.reduce((total, category) => total + toNumber(category.budget), 0),
    [categories]
  );

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseCategoryDraft(newCategory);

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError(null);
    setNotice(null);

    try {
      const result = await apiRequest<CategoryResponse>("/categories", {
        method: "POST",
        body: JSON.stringify(parsed.payload)
      });
      const nextCategories = sortCategories([...categories, result.data]);

      setNewCategory({ category_name: "", budget: "" });
      setCategories(nextCategories);
      setCategoryDrafts(
        Object.fromEntries(
          nextCategories.map((category) => [category.category_id, categoryDraft(category)])
        )
      );
      setNotice(`Created ${result.data.category_name}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
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

    setError(null);
    setNotice(null);

    try {
      const result = await apiRequest<CategoryResponse>(`/categories/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify(parsed.payload)
      });
      setCategories((current) =>
        sortCategories(
          current.map((category) =>
            category.category_id === categoryId ? result.data : category
          )
        )
      );
      setCategoryDrafts((current) => ({
        ...current,
        [categoryId]: categoryDraft(result.data)
      }));
      setNotice(`Saved ${result.data.category_name}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function deleteCategory(category: CategoryResponse) {
    if (!window.confirm(`Delete ${category.category_name}?`)) {
      return;
    }

    setError(null);
    setNotice(null);

    try {
      await apiRequest<null>(`/categories/${category.category_id}`, {
        method: "DELETE"
      });
      setCategories((current) =>
        current.filter(
          (currentCategory) => currentCategory.category_id !== category.category_id
        )
      );
      setCategoryDrafts((current) => {
        const next = { ...current };
        delete next[category.category_id];
        return next;
      });
      setNotice(`Deleted ${category.category_name}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return (
    <>
      <section className="pageTop">
        <div>
          <p className="eyebrow">Monthly budgets</p>
          <h1>Categories</h1>
        </div>
        <div className="toolbar">
          <button className="ghostButton" type="button" onClick={() => loadCategories(true)} disabled={loading}>
            <RefreshCcw />
            <span>Reload</span>
          </button>
        </div>
      </section>

      <StatusMessage error={error} notice={notice} />

      <section className="metricGrid compactMetrics" aria-label="Category summary">
        <MetricTile label="Categories" value={String(categories.length)} icon={<Tags />} />
        <MetricTile label="Monthly budget" value={formatMoney(budgetTotal)} tone="good" icon={<Save />} />
      </section>

      <section className="panel">
        <form className="categoryCreateForm" onSubmit={createCategory}>
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
            <span>Monthly budget</span>
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
          <button className="primaryButton" type="submit">
            <Plus />
            <span>Create</span>
          </button>
        </form>

        {loading && categories.length === 0 ? (
          <LoadingBlock label="Loading categories" />
        ) : categories.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Monthly budget</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const draft =
                    categoryDrafts[category.category_id] || categoryDraft(category);

                  return (
                    <tr key={category.category_id}>
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
                            className="iconButton good"
                            type="button"
                            onClick={() => updateCategory(category.category_id)}
                            aria-label={`Save ${category.category_name}`}
                          >
                            <Save />
                          </button>
                          <button
                            className="iconButton danger"
                            type="button"
                            onClick={() => deleteCategory(category)}
                            aria-label={`Delete ${category.category_name}`}
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
          <EmptyBlock title="No categories" detail="Create a category to start tracking monthly budgets." />
        )}
      </section>
    </>
  );
}
