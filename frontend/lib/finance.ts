export type RawBalance = {
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
};

const currency = process.env.NEXT_PUBLIC_CURRENCY || "GBP";

export const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency,
  maximumFractionDigits: 2
});

export const compactMoneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency,
  notation: "compact",
  maximumFractionDigits: 1
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

export function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

export function formatCompactMoney(value: number) {
  return compactMoneyFormatter.format(value);
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

export function normaliseBalance(raw: RawBalance, index: number): AccountBalance {
  const account = raw.Account?.trim() || `Account ${index + 1}`;
  const institution = raw.Institution?.trim() || "Unknown";

  return {
    id: `${account}-${institution}-${index}`,
    account,
    institution,
    amount: toAmount(raw.Balance)
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
    description: raw.description?.trim() || "No description"
  };
}

export function sortByAbsoluteAmount<T extends { amount: number }>(items: T[]) {
  return [...items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

export function groupTransactionsByMerchant(transactions: Transaction[]) {
  const totals = new Map<
    string,
    {
      merchant: string;
      count: number;
      amount: number;
    }
  >();

  for (const transaction of transactions) {
    const current =
      totals.get(transaction.merchant) ??
      {
        merchant: transaction.merchant,
        count: 0,
        amount: 0
      };

    current.count += 1;
    current.amount += transaction.amount;
    totals.set(transaction.merchant, current);
  }

  return [...totals.values()].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );
}
