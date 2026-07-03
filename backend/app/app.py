from typing import Annotated

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session

import business_logic
from business_logic import RawTransaction
from db_connection import get_db_session

app = FastAPI()
DbSession = Annotated[Session, Depends(get_db_session)]

@app.get("/balance/{account_id}")
def get_balance(account_id: str):
    balance = business_logic.get_account_balance(account_id)
    return balance

@app.get("/balance")
def get_balances(db: DbSession) -> list[dict]:
    balances = business_logic.get_all_account_balances(db)
    return balances

@app.post("/refresh")
def refresh_database(db: DbSession) -> list[RawTransaction]:
    transactions = business_logic.refresh_transactions(db)
    db.commit()
    return transactions

@app.get("/database")
def test_database_connection(db: DbSession):
    business_logic.test_connection(db)
    return {"status": "OK"}

###### Categories CRUD ######
@app.get("/categories")
def get_categories(db: DbSession):
    categories = business_logic.get_categories(db)
    return categories
