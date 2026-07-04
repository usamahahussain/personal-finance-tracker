from typing import Annotated

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, Response
from sqlalchemy.orm import Session

import business_logic
from business_logic import RawTransaction
from db_connection import get_db_session
from schemas import BalanceResponse, CategoryResponse, CategoryUpdate, TransactionResponse

app = FastAPI()
DbSession = Annotated[Session, Depends(get_db_session)]

@app.get("/balance/{account_id}", response_model=BalanceResponse)
def get_balance(account_id: int, db: DbSession):
    balance = business_logic.get_account_balance(db, account_id)
    return balance

@app.get("/balance", response_model=list[BalanceResponse])
def get_balances(db: DbSession) -> list[dict]:
    balances = business_logic.get_all_account_balances(db)
    return balances

@app.get("/database")
def test_database_connection(db: DbSession):
    business_logic.test_connection(db)
    return {"status": "OK"}

################## Categories CRUD ##################
@app.get("/categories", response_model=list[CategoryResponse])
def get_categories(db: DbSession):
    categories = business_logic.get_categories(db)
    return categories

@app.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, payload: CategoryUpdate, db: DbSession):
    category = business_logic.update_category(
        db,
        category_id,
        payload.category_name,
        payload.budget
    )
    db.commit()
    db.refresh(category)
    return category

@app.delete("/categories/{category_id}", response_class=Response)
def delete_category(category_id: int, db: DbSession):
    business_logic.delete_category(
        db,
        category_id
    )
    db.commit()
    return Response(status_code=204)

@app.post("/categories", response_model=CategoryResponse)
def create_category(payload: CategoryUpdate, db: DbSession):
    new_category = business_logic.create_category(
        db,
        payload.category_name,
        payload.budget
    )
    db.commit()
    db.refresh(new_category)
    return new_category

################## Transactions ##################
@app.get("/transactions", response_model=list[TransactionResponse])
def get_transactions(db: DbSession):
    transactions = business_logic.get_transactions(
        db
    )
    return transactions

@app.post("/refresh")
def refresh_database(db: DbSession):
    result = business_logic.refresh_transactions(db)
    db.commit()
    return result