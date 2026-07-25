from typing import Optional

from sqlalchemy import text, select
from sqlalchemy.orm import Session
from models import Accounts, Categories, RecurringTransactions, Transactions

def test_db_connection(db: Session) -> bool:
    db.execute(text("SELECT 1 FROM dual")).scalar_one()
    return True

def get_accounts(db: Session) -> list[Accounts]:
    return db.query(Accounts).all()

def get_account(db: Session, account_id: int) -> Optional[Accounts]:
    return db.query(Accounts).filter_by(account_id=account_id).first()

###### Categories CRUD ######

def get_categories(db: Session) -> list[Categories]:
    stmt = (
        select(
            Categories.category_id,
            Categories.category_name,
            Categories.budget,
            Categories.budget_kind
        )
        .order_by(Categories.category_name.desc())
    )
    return db.execute(stmt).mappings().all()

def get_category(db: Session, category_id: int) -> Optional[Categories]:
    return db.query(Categories).filter_by(category_id=category_id).first()

def delete_category(db: Session, category_id: int):
    category = get_category(db, category_id)
    return db.delete(category)

def create_category(db: Session, category_name: str, category_budget: Optional[float], budget_kind: str):
    category = Categories(
        category_name = category_name,
        budget = category_budget,
        budget_kind = budget_kind
    )
    db.add(category)
    db.flush()
    return category

###### Recurring Transactions CRUD ######

def get_recurring_transactions(db: Session):
    stmt = (
        select(
            RecurringTransactions.recurring_transaction_id,
            RecurringTransactions.display_name,
            RecurringTransactions.category_id,
            Categories.category_name,
            RecurringTransactions.expected_amount,
            RecurringTransactions.due_day,
            RecurringTransactions.active
        )
        .outerjoin(Categories, Categories.category_id == RecurringTransactions.category_id)
        .order_by(RecurringTransactions.display_name.asc())
    )
    return db.execute(stmt).mappings().all()

def get_recurring_transaction(db: Session, recurring_transaction_id: int):
    stmt = (
        select(
            RecurringTransactions.recurring_transaction_id,
            RecurringTransactions.display_name,
            RecurringTransactions.category_id,
            Categories.category_name,
            RecurringTransactions.expected_amount,
            RecurringTransactions.due_day,
            RecurringTransactions.active
        )
        .outerjoin(Categories, Categories.category_id == RecurringTransactions.category_id)
        .where(RecurringTransactions.recurring_transaction_id == recurring_transaction_id)
    )
    return db.execute(stmt).mappings().first()

def get_recurring_transaction_model(db: Session, recurring_transaction_id: int):
    stmt = select(RecurringTransactions).where(
        RecurringTransactions.recurring_transaction_id == recurring_transaction_id
    )
    return db.execute(stmt).scalar_one_or_none()

def create_recurring_transaction(
        db: Session,
        display_name: str,
        category_id: Optional[int],
        expected_amount: Optional[float],
        due_day: Optional[int],
        active: bool
):
    recurring_transaction = RecurringTransactions(
        display_name = display_name,
        category_id = category_id,
        expected_amount = expected_amount,
        due_day = due_day,
        active = active
    )
    db.add(recurring_transaction)
    db.flush()
    return get_recurring_transaction(db, recurring_transaction.recurring_transaction_id)

def update_recurring_transaction(
        db: Session,
        recurring_transaction_id: int,
        display_name: str,
        category_id: Optional[int],
        expected_amount: Optional[float],
        due_day: Optional[int],
        active: bool
):
    recurring_transaction = get_recurring_transaction_model(db, recurring_transaction_id)
    if recurring_transaction is None:
        return None

    recurring_transaction.display_name = display_name
    recurring_transaction.category_id = category_id
    recurring_transaction.expected_amount = expected_amount
    recurring_transaction.due_day = due_day
    recurring_transaction.active = active
    db.flush()
    return get_recurring_transaction(db, recurring_transaction_id)

def delete_recurring_transaction(db: Session, recurring_transaction_id: int):
    recurring_transaction = get_recurring_transaction_model(db, recurring_transaction_id)
    if recurring_transaction is None:
        return None

    recurring_transaction.active = False
    db.flush()
    return recurring_transaction

###### Transactions CRUD ######

def get_transactions(db: Session) -> Optional[list[Transactions]]:
    stmt = (
        select(
            Transactions.transaction_id,
            Transactions.account_id,
            Accounts.account_name,
            Accounts.institution_name,
            Transactions.amount,
            Transactions.transaction_date,
            Transactions.direction,
            Transactions.merchant_name,
            Transactions.category_id,
            Categories.category_name,
            Transactions.recurring_transaction_id,
            RecurringTransactions.display_name.label("recurring_transaction_name"),
            Transactions.reference
        )
        .join(Accounts, Accounts.account_id == Transactions.account_id)
        .outerjoin(Categories, Categories.category_id == Transactions.category_id)
        .outerjoin(
            RecurringTransactions,
            RecurringTransactions.recurring_transaction_id == Transactions.recurring_transaction_id
        )
        .order_by(
            Transactions.transaction_date.desc(),
            Transactions.transaction_id.desc()
        )
    )
    return db.execute(stmt).mappings().all()

def get_transaction(db: Session, transaction_id: int):
    stmt = (
        select(
            Transactions.transaction_id,
            Transactions.account_id,
            Accounts.account_name,
            Accounts.institution_name,
            Transactions.amount,
            Transactions.transaction_date,
            Transactions.direction,
            Transactions.merchant_name,
            Transactions.category_id,
            Categories.category_name,
            Transactions.recurring_transaction_id,
            RecurringTransactions.display_name.label("recurring_transaction_name"),
            Transactions.reference
        )
        .join(Accounts, Accounts.account_id == Transactions.account_id)
        .outerjoin(Categories, Categories.category_id == Transactions.category_id)
        .outerjoin(
            RecurringTransactions,
            RecurringTransactions.recurring_transaction_id == Transactions.recurring_transaction_id
        )
        .where(Transactions.transaction_id == transaction_id)
    )
    return db.execute(stmt).mappings().first()

def refresh_transactions(db:Session, raw_transactions: list):
    ## filter out transactions with lunchflow IDs that already exist in DB
    lunchflow_ids = [t.lunchflow_transaction_id for t in raw_transactions]

    existing_ids = {
        row[0] for row in db.query(Transactions.lunchflow_transaction_id)
        .filter(Transactions.lunchflow_transaction_id.in_(lunchflow_ids))
        .all()
    }

    new_transactions = []

    for raw in raw_transactions:
        if raw.lunchflow_transaction_id in existing_ids:
            continue

        amount = raw.amount
        direction = "INBOUND" if amount >= 0 else "OUTBOUND"

        new_transactions.append(
            Transactions(
                lunchflow_transaction_id=raw.lunchflow_transaction_id,
                account_id=raw.account_id,
                amount=abs(amount),
                transaction_date=raw.date,
                direction=direction,
                merchant_name=raw.merchant,
                category_id=None,
                reference=raw.description,
                raw_lunchflow_transaction=raw.full_json,
            )
        )

    db.add_all(new_transactions)
    db.flush()

    return {
        "received": len(raw_transactions),
        "inserted": len(new_transactions),
        "skipped_existing": len(raw_transactions) - len(new_transactions)
    }

def update_transaction_category(db: Session, transaction_id: int, category_id: int):
    stmt = select(Transactions).where(Transactions.transaction_id == transaction_id)
    transaction_to_update = db.execute(stmt).scalar_one_or_none()
    if transaction_to_update is None:
        return None

    transaction_to_update.category_id = category_id
    db.flush()
    return get_transaction(db, transaction_id)

def update_transaction_recurring(db: Session, transaction_id: int, recurring_transaction_id: int):
    stmt = select(Transactions).where(Transactions.transaction_id == transaction_id)
    transaction_to_update = db.execute(stmt).scalar_one_or_none()
    if transaction_to_update is None:
        return None

    transaction_to_update.recurring_transaction_id = recurring_transaction_id
    db.flush()
    return get_transaction(db, transaction_id)

def delete_transaction_recurring(db: Session, transaction_id: int):
    stmt = select(Transactions).where(Transactions.transaction_id == transaction_id)
    transaction_to_update = db.execute(stmt).scalar_one_or_none()
    if transaction_to_update is None:
        return None

    transaction_to_update.recurring_transaction_id = None
    db.flush()
    return get_transaction(db, transaction_id)
