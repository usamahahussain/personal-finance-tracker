import os
from collections.abc import Generator

import oracledb
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import Session, sessionmaker
from dotenv import load_dotenv

load_dotenv()

def required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} must be set")
    return value

username = os.getenv("PFT_DB_USERNAME", "finance_app")
connect_string = os.getenv("PFT_DB_DSN", "pftdev_high")
wallet_dir = os.getenv("PFT_DB_WALLET_DIR", "/opt/oracle/wallet")

pool_args = {
    "config_dir": wallet_dir,
    "wallet_location": wallet_dir,
    "user": username,
    "password": required_env("PFT_DB_PASSWORD"),
    "dsn": connect_string,
}
wallet_password = os.getenv("PFT_DB_WALLET_PASSWORD")
if wallet_password:
    pool_args["wallet_password"] = wallet_password

pool = oracledb.create_pool(**pool_args)

engine = create_engine(
    "oracle+oracledb://", creator=pool.acquire, poolclass=NullPool
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_connection():
    return engine

def get_db_session() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
