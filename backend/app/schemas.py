from pydantic import BaseModel
from typing import Optional
from datetime import datetime

## Expected input model for category update
class CategoryUpdate(BaseModel):
    category_name: str
    budget: Optional[float] = None

## Response model, field names matching ORM model to allow model_config to link the same attributes
class CategoryResponse(BaseModel):
    category_id: int
    category_name: str
    budget: Optional[float] = None

    model_config = {"from_attributes": True}

class BalanceResponse(BaseModel):
    account: str
    institution: Optional[str] = None
    balance: float

    model_config = {"from_attributes": True}

class TransactionResponse(BaseModel):
    account_id: int
    amount: float
    transaction_date: datetime
    direction: str
    merchant_name: str
    category_id: Optional[int] = None
    reference: Optional[str] = None
