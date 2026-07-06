export type BalanceResponse = {
  account: string;
  institution?: string | null;
  balance: number | string;
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
  account_name: string;
  institution_name?: string | null;
  amount: number | string;
  transaction_date: string;
  direction: "INBOUND" | "OUTBOUND" | string;
  merchant_name: string;
  category_name?: string | null;
  reference?: string | null;
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

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short"
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

export function formatSignedTransaction(transaction: TransactionResponse) {
  const amount = toNumber(transaction.amount);
  const signedAmount =
    transaction.direction.toUpperCase() === "OUTBOUND" ? -amount : amount;
  return formatMoney(signedAmount);
}

export function signedTransactionAmount(transaction: TransactionResponse) {
  const amount = toNumber(transaction.amount);
  return transaction.direction.toUpperCase() === "OUTBOUND" ? -amount : amount;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value.split("T")[0] || value;
}

export function formatDateTime(value: Date | null) {
  return value ? dateTimeFormatter.format(value) : "Not run";
}

export function formatPayload(payload: unknown) {
  if (payload === null || typeof payload === "undefined") {
    return "No response body";
  }

  if (typeof payload === "string") {
    return payload;
  }

  return JSON.stringify(payload, null, 2);
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
