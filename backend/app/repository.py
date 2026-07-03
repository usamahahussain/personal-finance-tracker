from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session
from models import Accounts, Categories

def test_db_connection(db: Session) -> bool:
    db.execute(text("SELECT 1 FROM dual")).scalar_one()
    return True

def get_accounts(db: Session) -> list[Accounts]:
    return db.query(Accounts).all()

def get_account(db: Session, account_id: int) -> Optional[Accounts]:
    return db.query(Accounts).filter_by(account_id=account_id).first()

###### Categories CRUD ######

def get_categories(db: Session) -> list[Categories]:
    return db.query(Categories).all()

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