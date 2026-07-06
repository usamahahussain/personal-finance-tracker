"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban, Pencil, RefreshCcw, Save, Trash2 } from "lucide-react";
import {
  CategoryResponse,
  CategoryUpdate,
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
  return [...categories].sort((a, b) =>
    a.category_name.localeCompare(b.category_name)
  );
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<number, CategoryDraft>
  >({});
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
        setNotice(`Loaded ${sorted.length} categories.`);
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
    () =>
      categories.reduce((total, category) => total + toNumber(category.budget), 0),
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
          nextCategories.map((category) => [
            category.category_id,
            categoryDraft(category)
          ])
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
      const result = await apiRequest<CategoryResponse>(
        `/categories/${categoryId}`,
        {
          method: "PUT",
          body: JSON.stringify(parsed.payload)
        }
      );
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
    setError(null);
    setNotice(null);

    try {
      await apiRequest<null>(`/categories/${category.category_id}`, {
        method: "DELETE"
      });
      setCategories((current) =>
        current.filter(
          (currentCategory) =>
            currentCategory.category_id !== category.category_id
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
      <PageHeader
        kicker="Categories"
        title="Budgets"
        description="Create, edit, and delete transaction categories."
        actions={
          <button
            className="secondaryButton"
            type="button"
            onClick={() => loadCategories(true)}
            disabled={loading}
            title="GET /categories"
          >
            <RefreshCcw />
            Reload
          </button>
        }
      />

      <StatusMessage error={error} notice={notice} />

      <section className="statGrid compactStats" aria-label="Category totals">
        <Stat
          label="Categories"
          value={String(categories.length)}
          icon={<FolderKanban />}
        />
        <Stat
          label="Budget total"
          value={formatMoney(budgetTotal)}
          icon={<Pencil />}
        />
      </section>

      <section className="sectionBlock">
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

        {loading && categories.length === 0 ? (
          <LoadingState title="Loading categories" />
        ) : categories.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Budget</th>
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
                            onClick={() => deleteCategory(category)}
                            title="DELETE /categories/{category_id}"
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
          <EmptyState
            icon={<FolderKanban />}
            title="No categories loaded"
            detail="Create a category or reload from the backend."
          />
        )}
      </section>
    </>
  );
}
