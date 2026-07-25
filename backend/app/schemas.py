from pydantic import BaseModel
from typing import Optional
from datetime import datetime

## Expected input model for category update
class CategoryUpdate(BaseModel):
    category_name: str
    budget: Optional[float] = None
    budget_kind: Optional[str] = None

## Response model, field names matching ORM model to allow model_config to link the same attributes
class CategoryResponse(BaseModel):
    category_id: int
    category_name: str
    budget: Optional[float] = None
    budget_kind: str

    model_config = {"from_attributes": True}

class BalanceResponse(BaseModel):
    account: str
    institution: Optional[str] = None
    balance: float
    error: bool

    model_config = {"from_attributes": True}

class TransactionResponse(BaseModel):
    account_name: str
    institution_name: str
    amount: float
    transaction_date: datetime
    direction: str
    merchant_name: str
    transaction_id: int
    category_id: Optional[float]
    category_name: Optional[str] = None
    recurring_transaction_id: Optional[float] = None
    recurring_transaction_name: Optional[str] = None
    reference: Optional[str] = None

class TransactionUpdate(BaseModel):
    category_id: int

class RecurringTransactionBase(BaseModel):
    display_name: str
    category_id: Optional[int] = None
    expected_amount: Optional[float] = None
    due_day: Optional[int] = None
    active: bool = True

class RecurringTransactionCreate(RecurringTransactionBase):
    pass

class RecurringTransactionUpdate(RecurringTransactionBase):
    pass

class RecurringTransactionResponse(RecurringTransactionBase):
    recurring_transaction_id: int
    category_name: Optional[str] = None

    model_config = {"from_attributes": True}

class TransactionRecurringUpdate(BaseModel):
    recurring_transaction_id: int
