export type BalanceResponse = {
  account: string;
  institution?: string | null;
  balance: number | string;
  error?: boolean;
};

export type CategoryResponse = {
  category_id: number;
  category_name: string;
  budget?: number | string | null;
};

export type CategoryUpdate = {
  category_name: string;
  budget: number | null;
};

export type TransactionResponse = {
  transaction_id: number;
  account_name: string;
  institution_name?: string | null;
  amount: number | string;
  transaction_date: string;
  direction: "INBOUND" | "OUTBOUND" | string;
  merchant_name: string;
  category_id?: number | null;
  category_name?: string | null;
  reference?: string | null;
};

export type TransactionCategoryUpdate = {
  category_id: number;
};

export type RefreshResponse = {
  received: number;
  inserted: number;
  skipped_existing: number;
};

export type ApiResult<T> = {
  data: T;
  status: number;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const currency = process.env.NEXT_PUBLIC_CURRENCY || "GBP";

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency,
  maximumFractionDigits: 2
});

const compactMoneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency,
  notation: "compact",
  maximumFractionDigits: 1
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric"
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short"
});

export function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatMoney(value: number | string | null | undefined) {
  return moneyFormatter.format(toNumber(value));
}

export function formatCompactMoney(value: number | string | null | undefined) {
  return compactMoneyFormatter.format(toNumber(value));
}

export function getMonthValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getTransactionMonthValue(value: string) {
  const datePart = value.split("T")[0];
  const match = /^(\d{4})-(\d{2})/.exec(datePart);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : getMonthValue(date);
}

export function formatMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return "Selected month";
  }

  return monthFormatter.format(new Date(year, month - 1, 1));
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return shortDateFormatter.format(date);
  }

  return value.split("T")[0] || value;
}

export function isOutbound(transaction: TransactionResponse) {
  return transaction.direction.toUpperCase() === "OUTBOUND";
}

export function signedTransactionAmount(transaction: TransactionResponse) {
  const amount = toNumber(transaction.amount);
  return isOutbound(transaction) ? -amount : amount;
}

export function formatSignedTransaction(transaction: TransactionResponse) {
  return formatMoney(signedTransactionAmount(transaction));
}

export function getInstitutionName(transaction: TransactionResponse) {
  return transaction.institution_name || "Unknown institution";
}

export function getCategoryName(
  transaction: TransactionResponse,
  categories: CategoryResponse[] = []
) {
  if (transaction.category_name) {
    return transaction.category_name;
  }

  const category = categories.find(
    (item) => item.category_id === transaction.category_id
  );

  return category?.category_name || "Uncategorized";
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.status}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  const endpoint = path.startsWith("/api/backend")
    ? path
    : path.startsWith("/")
      ? `/api/backend${path}`
      : `/api/backend/${path}`;

  const response = await fetch(endpoint, {
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
