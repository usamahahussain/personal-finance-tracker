from fastapi import FastAPI
from business_logic import get_all_account_balances, get_account_balance, refresh_transactions, test_connection
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from business_logic import RawTransaction
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

@app.get("/balance/{account_id}")
async def get_balance(account_id):
    balance = get_account_balance(account_id)
    return balance

@app.get("/balance")
async def get_balances() -> list[dict]:
    balances = get_all_account_balances()
    return balances

@app.post("/refresh")
async def refresh_database() -> list[RawTransaction]:
    transactions = refresh_transactions()
    # print(transactions)
    return transactions
    # json_transactions = jsonable_encoder(transactions)
    # return JSONResponse(content=json_transactions)

@app.get("/database")
async def test_database_connection():
    test_connection()
    return {"status": "OK"}
