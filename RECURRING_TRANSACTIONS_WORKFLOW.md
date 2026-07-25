# Recurring Transactions Workflow

## Goal

Track fixed or expected monthly spend separately from discretionary spend while still linking each recurring payment to the real imported transaction for that month.

## Core Concepts

- **Category budget type**: marks a category as `RECURRING` or `DISCRETIONARY`.
- **Recurring transaction series**: represents the ongoing commitment, such as rent, Spotify, phone bill, or insurance.
- **Transaction occurrence**: the actual imported bank transaction for a specific month, linked back to the recurring transaction series.

The transaction link should be the source of truth for whether a specific payment is recurring. The category type should mainly control budget grouping and dashboard presentation.

## Proposed User Workflow

1. Create or update categories with a budget type.
   - Example: `Subscriptions` as `RECURRING`.
   - Example: `Eating Out` as `DISCRETIONARY`.

2. Create a recurring transaction series.
   - Example: `Spotify`.
   - Optional metadata: category, expected amount, due day, active status.

3. Import transactions from Lunchflow as normal.

4. Review new transactions.
   - Assign a normal category if needed.
   - Link the transaction to a recurring transaction series if it is the monthly occurrence.

5. Dashboard separates spend into recurring and discretionary lanes.
   - Recurring spend shows expected commitments and actual matched payments.
   - Discretionary spend shows flexible spend against discretionary budgets.

6. Continue month to month.
   - Each new monthly occurrence is linked to the same recurring transaction series.
   - The app can eventually detect missing, duplicated, or unexpected recurring payments.

## Minimum API Shape

Existing endpoints can be extended with recurring fields:

- `GET /transactions`
  - Include `recurring_transaction_id` and `recurring_transaction_name`.
- `GET /categories`
  - Include `budget_kind`.
- `POST /categories`
  - Accept `budget_kind`.
- `PUT /categories/{category_id}`
  - Accept `budget_kind`.

New recurring transaction endpoints:

- `GET /recurring-transactions`
- `POST /recurring-transactions`
- `GET /recurring-transactions/{recurring_transaction_id}`
- `PUT /recurring-transactions/{recurring_transaction_id}`
- `DELETE /recurring-transactions/{recurring_transaction_id}`

Transaction linking endpoints:

- `PUT /transactions/{transaction_id}/recurring`
- `DELETE /transactions/{transaction_id}/recurring`

Example link payload:

```json
{
  "recurring_transaction_id": 4
}
```

## Dashboard Ideas

Monthly overview should split the current single budget view into two sections:

- **Recurring commitments**
  - Expected recurring budget.
  - Actual recurring spend this month.
  - Matched recurring transactions.
  - Missing expected recurring transactions.

- **Discretionary spend**
  - Discretionary budget.
  - Actual discretionary spend this month.
  - Remaining discretionary budget.

Transaction table additions:

- Recurring status chip.
- Recurring transaction name column.
- Filter for all, recurring, discretionary, and unlinked transactions.
- Row action to mark or unmark a transaction as recurring.

## First Version Scope

Keep the first version manual and predictable:

- Manually create recurring transaction series.
- Manually link imported transactions to a series.
- Manually mark categories as recurring or discretionary.
- Use frontend aggregation from existing transaction and category responses.

Auto-matching can come later once enough manual data exists to infer merchant, amount, and due-day patterns reliably.
