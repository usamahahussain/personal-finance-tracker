from pydantic import BaseModel

## Expected input model for category update
class CategoryUpdate(BaseModel):
    category_name: str
    budget: float | None = None

## Response model, field names matching ORM model to allow model_config to link the same attributes
class CategoryResponse(BaseModel):
    category_id: int
    category_name: str
    budget: float | None = None

    model_config = {"from_attributes": True}

class BalanceResponse(BaseModel):
    account: str
    institution: str | None
    balance: float

    model_config = {"from_attributes": True}
