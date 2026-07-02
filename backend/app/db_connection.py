import os

import oracledb
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker

username = os.getenv("PFT_DB_USERNAME", "finance_app")
connect_string = os.getenv("PFT_DB_DSN", "pftdev_high")
wallet_dir = os.getenv("PFT_DB_WALLET_DIR", "/opt/oracle/wallet")


def required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} must be set")
    return value

def create_connection():
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

    return engine

def create_session():
    engine = create_connection()
    Session = sessionmaker(bind=engine)
    session = Session()
    return session
