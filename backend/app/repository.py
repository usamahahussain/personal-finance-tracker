from typing import Optional

from sqlalchemy import text, select, update
from sqlalchemy.orm import Session
from models import Accounts, Categories, Transactions

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
            Categories.budget
        )
        .order_by(Categories.category_name.desc())
    )
    return db.execute(stmt).mappings().all()

def get_category(db: Session, category_id: int) -> Optional[Categories]:
    return db.query(Categories).filter_by(category_id=category_id).first()

def delete_category(db: Session, category_id: int):
    category = get_category(db, category_id)
    return db.delete(category)

def create_category(db: Session, category_name: str, category_budget: Optional[float]):
    category = Categories(
        category_name = category_name,
        budget = category_budget
    )
    db.add(category)
    db.flush()
    return category

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
            Transactions.reference
        )
        .join(Accounts, Accounts.account_id == Transactions.account_id)
        .outerjoin(Categories, Categories.category_id == Transactions.category_id)
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
            Transactions.reference
        )
        .join(Accounts, Accounts.account_id == Transactions.account_id)
        .outerjoin(Categories, Categories.category_id == Transactions.category_id)
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
    # transaction_to_update = db.query(Transactions).filter_by(transaction_id=transaction_id).first()
    transaction_to_update.category_id = category_id
    db.flush()
    return get_transaction(db, transaction_id)