from typing import Annotated

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Response
from sqlalchemy.orm import Session

import business_logic
from business_logic import RawTransaction
from db_connection import get_db_session
from schemas import (
    BalanceResponse,
    CategoryResponse,
    CategoryUpdate,
    RecurringTransactionCreate,
    RecurringTransactionResponse,
    RecurringTransactionUpdate,
    TransactionRecurringUpdate,
    TransactionResponse,
    TransactionUpdate
)

app = FastAPI()
DbSession = Annotated[Session, Depends(get_db_session)]

def raise_http_exception(error: ValueError):
    message = str(error)
    status_code = 404 if "was not found" in message else 400
    raise HTTPException(status_code=status_code, detail=message)

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
    try:
        category = business_logic.update_category(
            db,
            category_id,
            payload.category_name,
            payload.budget,
            payload.budget_kind
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    db.refresh(category)
    return category

@app.delete("/categories/{category_id}", response_class=Response)
def delete_category(category_id: int, db: DbSession):
    try:
        business_logic.delete_category(
            db,
            category_id
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    return Response(status_code=204)

@app.post("/categories", response_model=CategoryResponse)
def create_category(payload: CategoryUpdate, db: DbSession):
    try:
        new_category = business_logic.create_category(
            db,
            payload.category_name,
            payload.budget,
            payload.budget_kind
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    db.refresh(new_category)
    return new_category

################## Recurring Transactions ##################
@app.get("/recurring-transactions", response_model=list[RecurringTransactionResponse])
def get_recurring_transactions(db: DbSession):
    recurring_transactions = business_logic.get_recurring_transactions(db)
    return recurring_transactions

@app.get("/recurring-transactions/{recurring_transaction_id}", response_model=RecurringTransactionResponse)
def get_recurring_transaction(recurring_transaction_id: int, db: DbSession):
    try:
        recurring_transaction = business_logic.get_recurring_transaction(
            db,
            recurring_transaction_id
        )
    except ValueError as error:
        raise_http_exception(error)

    return recurring_transaction

@app.post("/recurring-transactions", response_model=RecurringTransactionResponse)
def create_recurring_transaction(payload: RecurringTransactionCreate, db: DbSession):
    try:
        new_recurring_transaction = business_logic.create_recurring_transaction(
            db,
            payload.display_name,
            payload.category_id,
            payload.expected_amount,
            payload.due_day,
            payload.active
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    return new_recurring_transaction

@app.put("/recurring-transactions/{recurring_transaction_id}", response_model=RecurringTransactionResponse)
def update_recurring_transaction(
        recurring_transaction_id: int,
        payload: RecurringTransactionUpdate,
        db: DbSession
):
    try:
        recurring_transaction = business_logic.update_recurring_transaction(
            db,
            recurring_transaction_id,
            payload.display_name,
            payload.category_id,
            payload.expected_amount,
            payload.due_day,
            payload.active
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    return recurring_transaction

@app.delete("/recurring-transactions/{recurring_transaction_id}", response_class=Response)
def delete_recurring_transaction(recurring_transaction_id: int, db: DbSession):
    try:
        business_logic.delete_recurring_transaction(
            db,
            recurring_transaction_id
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    return Response(status_code=204)

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

@app.put("/transactions/{transaction_id}/category", response_model=TransactionResponse)
def update_transaction(transaction_id: int, payload: TransactionUpdate, db: DbSession):
    try:
        updated_transaction = business_logic.update_transaction(
            db,
            transaction_id,
            payload.category_id
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    return updated_transaction

@app.put("/transactions/{transaction_id}/recurring", response_model=TransactionResponse)
def update_transaction_recurring(transaction_id: int, payload: TransactionRecurringUpdate, db: DbSession):
    try:
        updated_transaction = business_logic.update_transaction_recurring(
            db,
            transaction_id,
            payload.recurring_transaction_id
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    return updated_transaction

@app.delete("/transactions/{transaction_id}/recurring", response_model=TransactionResponse)
def delete_transaction_recurring(transaction_id: int, db: DbSession):
    try:
        updated_transaction = business_logic.delete_transaction_recurring(
            db,
            transaction_id
        )
    except ValueError as error:
        raise_http_exception(error)

    db.commit()
    return updated_transaction
