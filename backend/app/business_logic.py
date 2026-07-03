import os

import requests
from repository import (
    get_accounts as repo_get_accounts,
    test_db_connection,
    get_categories as repo_get_categories,
    get_category as repo_get_category,
    get_account as repo_get_single_account,
    delete_category as repo_delete_category
)
from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional
from sqlalchemy.orm import Session
from models import Categories

LUNCHFLOW_URL = os.getenv("LUNCHFLOW_URL", "https://www.lunchflow.app/api/v1/accounts")
LUNCHFLOW_API_KEY_ENV = "LUNCHFLOW_API_KEY"

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

    response = query_lunchflow("/"+str(account.lunchflow_account_id)+"/balance")
    balance = {
        "account": account.account_name,
        "institution": account.institution_name,
        "balance": response["balance"]["amount"]
    }
    return balance

def get_all_account_balances(db: Session):
    accounts = repo_get_accounts(db)
    balances = []
    for account in accounts:
        
        response = query_lunchflow("/"+str(account.lunchflow_account_id)+"/balance")
    
        balances.append(
            {
                "account": account.account_name,
                "institution": account.institution_name,
                "balance": response["balance"]["amount"]
            }
        )
    return balances


## TO-DO: Normalize merchant name

def refresh_transactions(db: Session):
    accounts = repo_get_accounts(db)
    
    raw_transactions = []

    for account in accounts:
        db_account_id = account.lunchflow_account_id
        db_account_name = account.account_name
        db_institution_name = account.institution_name
        print("===========================")
        print("DB Account ID: ",db_account_id)
        print("DB Account Name: ",db_account_name)
        print("DB Institution Name: ",db_institution_name)
        print("===========================")
        
        response = query_lunchflow("/"+str(db_account_id)+"/transactions")

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
    return(raw_transactions)

###### Categories CRUD ######
def get_categories(db: Session) -> list[Categories]:
    return repo_get_categories(db)

def update_category(
    db: Session,
    category_id: int,
    category_name: str,
    category_budget: Optional[float],
) -> Categories:
    category = repo_get_category(db, category_id)
    if category is None:
        raise ValueError(f"Category {category_id} was not found")

    category.category_name = category_name
    category.budget = category_budget
    return category

def delete_category(
        db: Session,
        category_id: int
):
    repo_delete_category(db, category_id)
    return    

def test_connection(db: Session) -> bool:
    return test_db_connection(db)
