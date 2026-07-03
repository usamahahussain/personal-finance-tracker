export type BalanceResponse = {
  account?: string;
  institution?: string | null;
  balance?: number | string | null;
  Account?: string;
  Institution?: string | null;
  Balance?: number | string | null;
};

export type AccountBalance = {
  id: string;
  account: string;
  institution: string;
  amount: number;
};

export type CategoryResponse = {
  category_id: number;
  category_name: string;
  budget: number | string | null;
};

export type CategoryUpdate = {
  category_name: string;
  budget: number | null;
};

export type RawTransaction = {
  lunchflow_transaction_id?: string;
  account_id?: number;
  account_name?: string;
  amount?: number | string;
  date?: string;
  merchant?: string;
  description?: string;
  full_json?: Record<string, unknown>;
};

export type Transaction = {
  id: string;
  accountId: number | null;
  accountName: string;
  amount: number;
  date: string;
  merchant: string;
  description: string;
  raw: RawTransaction;
};

const currency = process.env.NEXT_PUBLIC_CURRENCY || "GBP";

export const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency,
  maximumFractionDigits: 2
});

export function toAmount(value: number | string | null | undefined) {
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
  return moneyFormatter.format(toAmount(value));
}

export function formatDateTime(value: Date | null) {
  if (!value) {
    return "Not run";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export function normaliseBalance(
  raw: BalanceResponse,
  index: number
): AccountBalance {
  const account = raw.account ?? raw.Account;
  const institution = raw.institution ?? raw.Institution;
  const balance = raw.balance ?? raw.Balance;
  const label = account?.trim() || `Account ${index + 1}`;
  const provider = institution?.trim() || "Unknown";

  return {
    id: `${label}-${provider}-${index}`,
    account: label,
    institution: provider,
    amount: toAmount(balance)
  };
}

export function normaliseTransaction(
  raw: RawTransaction,
  index: number
): Transaction {
  return {
    id: raw.lunchflow_transaction_id || `transaction-${index}`,
    accountId: typeof raw.account_id === "number" ? raw.account_id : null,
    accountName: raw.account_name?.trim() || "Unknown account",
    amount: toAmount(raw.amount),
    date: raw.date || "",
    merchant: raw.merchant?.trim() || "Unknown merchant",
    description: raw.description?.trim() || "No description",
    raw
  };
}

export function sortByName<T extends { category_name: string }>(items: T[]) {
  return [...items].sort((a, b) =>
    a.category_name.localeCompare(b.category_name)
  );
}

export function sortBalances(items: AccountBalance[]) {
  return [...items].sort((a, b) => a.account.localeCompare(b.account));
}
