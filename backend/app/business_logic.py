import os

import requests
from repository import (
    get_accounts as repo_get_accounts,
    test_db_connection,
    get_categories as repo_get_categories,
    get_category as repo_get_category,
    get_account as repo_get_single_account,
    delete_category as repo_delete_category,
    create_category as repo_create_category,
    get_recurring_transactions as repo_get_recurring_transactions,
    get_recurring_transaction as repo_get_recurring_transaction,
    get_recurring_transaction_model as repo_get_recurring_transaction_model,
    create_recurring_transaction as repo_create_recurring_transaction,
    update_recurring_transaction as repo_update_recurring_transaction,
    delete_recurring_transaction as repo_delete_recurring_transaction,
    get_transactions as repo_get_transactions,
    refresh_transactions as repo_refresh_transactions,
    update_transaction_category as repo_update_transaction,
    update_transaction_recurring as repo_update_transaction_recurring,
    delete_transaction_recurring as repo_delete_transaction_recurring
)
from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional
from sqlalchemy.orm import Session
from models import Categories, RecurringTransactions, Transactions

LUNCHFLOW_URL = os.getenv("LUNCHFLOW_URL", "https://www.lunchflow.app/api/v1/accounts")
LUNCHFLOW_API_KEY_ENV = "LUNCHFLOW_API_KEY"
BUDGET_KINDS = {"DISCRETIONARY", "RECURRING"}

class RawTransaction(BaseModel):
    lunchflow_transaction_id: str
    account_id: int
    account_name: str
    amount: float
    date: datetime
    merchant: str
    description: str
    full_json: dict[str, Any]

def query_lunchflow(URL_appendage):
    api_key = os.getenv(LUNCHFLOW_API_KEY_ENV)
    if not api_key:
        raise RuntimeError(f"{LUNCHFLOW_API_KEY_ENV} must be set")

    response = requests.get(
        LUNCHFLOW_URL+URL_appendage,
        headers={
            "x-api-key": api_key
        }
    )

    return response.json()

def get_account_balance(db: Session, account_id: int):
    account = repo_get_single_account(db, account_id)
    if account is None:
        raise ValueError(f"Account {account_id} was not found")
    try:
        response = query_lunchflow("/"+str(account.lunchflow_account_id)+"/balance")
        balance = {
            "account": account.account_name,
            "institution": account.institution_name,
            "balance": response["balance"]["amount"],
            "error": False
        }
    except Exception as e:
        print("Error getting balance for account: ",account.lunchflow_account_id,", name: ",account.account_name)
        balance = {
            "account": account.account_name,
            "institution": account.institution_name,
            "balance": 0,
            "error": True
        }
    return balance

def get_all_account_balances(db: Session):
    accounts = repo_get_accounts(db)
    balances = []
    for account in accounts:
        try:
            response = query_lunchflow("/"+str(account.lunchflow_account_id)+"/balance")
            print("Response:")
            print(response)

            balances.append(
                {
                    "account": account.account_name,
                    "institution": account.institution_name,
                    "balance": response["balance"]["amount"],
                    "error": False
                }
            )
        except Exception as e:
            print("Error getting balance for account: ",account.lunchflow_account_id,", name: ",account.account_name)
            balances.append(
                {
                    "account": account.account_name,
                    "institution": account.institution_name,
                    "balance": 0,
                    "error": True
                }
            )
    return balances


###### Categories CRUD ######
def get_categories(db: Session) -> list[Categories]:
    return repo_get_categories(db)

def normalize_budget_kind(budget_kind: Optional[str]) -> str:
    if budget_kind is None:
        return "DISCRETIONARY"

    normalized_budget_kind = budget_kind.upper()
    if normalized_budget_kind not in BUDGET_KINDS:
        raise ValueError("budget_kind must be DISCRETIONARY or RECURRING")

    return normalized_budget_kind

def validate_recurring_transaction_fields(
        db: Session,
        category_id: Optional[int],
        expected_amount: Optional[float],
        due_day: Optional[int]
):
    if category_id is not None and repo_get_category(db, category_id) is None:
        raise ValueError(f"Category {category_id} was not found")

    if expected_amount is not None and expected_amount < 0:
        raise ValueError("expected_amount must be greater than or equal to 0")

    if due_day is not None and (due_day < 1 or due_day > 31):
        raise ValueError("due_day must be between 1 and 31")

def update_category(
    db: Session,
    category_id: int,
    category_name: str,
    category_budget: Optional[float],
    budget_kind: Optional[str],
) -> Categories:
    category = repo_get_category(db, category_id)
    if category is None:
        raise ValueError(f"Category {category_id} was not found")

    category.category_name = category_name
    category.budget = category_budget
    if budget_kind is not None:
        category.budget_kind = normalize_budget_kind(budget_kind)
    return category

def delete_category(
        db: Session,
        category_id: int
):
    if repo_get_category(db, category_id) is None:
        raise ValueError(f"Category {category_id} was not found")

    repo_delete_category(db, category_id)
    return

def create_category(
        db: Session,
        category_name: str,
        category_budget: Optional[float],
        budget_kind: Optional[str]
) -> Categories:
    return repo_create_category(db, category_name, category_budget, normalize_budget_kind(budget_kind))

def test_connection(db: Session) -> bool:
    return test_db_connection(db)

###### Recurring Transactions ######
def get_recurring_transactions(db: Session) -> list[RecurringTransactions]:
    return repo_get_recurring_transactions(db)

def get_recurring_transaction(db: Session, recurring_transaction_id: int):
    recurring_transaction = repo_get_recurring_transaction(db, recurring_transaction_id)
    if recurring_transaction is None:
        raise ValueError(f"Recurring transaction {recurring_transaction_id} was not found")

    return recurring_transaction

def create_recurring_transaction(
        db: Session,
        display_name: str,
        category_id: Optional[int],
        expected_amount: Optional[float],
        due_day: Optional[int],
        active: bool
):
    validate_recurring_transaction_fields(db, category_id, expected_amount, due_day)
    return repo_create_recurring_transaction(
        db,
        display_name,
        category_id,
        expected_amount,
        due_day,
        active
    )

def update_recurring_transaction(
        db: Session,
        recurring_transaction_id: int,
        display_name: str,
        category_id: Optional[int],
        expected_amount: Optional[float],
        due_day: Optional[int],
        active: bool
):
    if repo_get_recurring_transaction_model(db, recurring_transaction_id) is None:
        raise ValueError(f"Recurring transaction {recurring_transaction_id} was not found")

    validate_recurring_transaction_fields(db, category_id, expected_amount, due_day)
    return repo_update_recurring_transaction(
        db,
        recurring_transaction_id,
        display_name,
        category_id,
        expected_amount,
        due_day,
        active
    )

def delete_recurring_transaction(db: Session, recurring_transaction_id: int):
    deleted_recurring_transaction = repo_delete_recurring_transaction(db, recurring_transaction_id)
    if deleted_recurring_transaction is None:
        raise ValueError(f"Recurring transaction {recurring_transaction_id} was not found")

    return


###### Transactions ######
def get_transactions(db: Session) -> Optional[list[Transactions]]:
    return repo_get_transactions(db)

def update_transaction(db: Session, transaction_id: int, category_id: int) -> Transactions:
    if repo_get_category(db, category_id) is None:
        raise ValueError(f"Category {category_id} was not found")

    transaction = repo_update_transaction(db, transaction_id, category_id)
    if transaction is None:
        raise ValueError(f"Transaction {transaction_id} was not found")

    return transaction

def update_transaction_recurring(
        db: Session,
        transaction_id: int,
        recurring_transaction_id: int
) -> Transactions:
    if repo_get_recurring_transaction_model(db, recurring_transaction_id) is None:
        raise ValueError(f"Recurring transaction {recurring_transaction_id} was not found")

    transaction = repo_update_transaction_recurring(db, transaction_id, recurring_transaction_id)
    if transaction is None:
        raise ValueError(f"Transaction {transaction_id} was not found")

    return transaction

def delete_transaction_recurring(db: Session, transaction_id: int) -> Transactions:
    transaction = repo_delete_transaction_recurring(db, transaction_id)
    if transaction is None:
        raise ValueError(f"Transaction {transaction_id} was not found")

    return transaction

def refresh_transactions(db: Session):
    accounts = repo_get_accounts(db)

    raw_transactions = []

    for account in accounts:
        db_account_id = account.account_id
        db_lunchflow_account_id = account.lunchflow_account_id
        db_account_name = account.account_name
        db_institution_name = account.institution_name
        print("===========================")
        print("DB Account ID: ",db_account_id)
        print("DB Lunchflow Account ID: ",db_lunchflow_account_id)
        print("DB Account Name: ",db_account_name)
        print("DB Institution Name: ",db_institution_name)
        print("===========================")

        response = query_lunchflow("/"+str(db_lunchflow_account_id)+"/transactions")

        transactions = response["transactions"]
        print("Received "+str(len(transactions))+" transactions")
        for transaction in transactions:
            raw_transactions.append(
                RawTransaction(
                    lunchflow_transaction_id=transaction["id"],
                    account_id=db_account_id,
                    account_name=db_account_name,
                    amount=transaction["amount"],
                    date=datetime.strptime(transaction["date"], "%Y-%m-%d"),
                    merchant=transaction["merchant"], ## TO-DO: Normalize merchant name
                    description=transaction["description"],
                    full_json=transaction
            ))

    response = repo_refresh_transactions(db, raw_transactions)
    return(response)
