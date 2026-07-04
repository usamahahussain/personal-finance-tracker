from typing import Any, Optional
import datetime
import decimal

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKeyConstraint, Identity, Index, PrimaryKeyConstraint, VARCHAR, JSON
from sqlalchemy.dialects.oracle import NUMBER
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import NullType

class Base(DeclarativeBase):
    pass


class Accounts(Base):
    __tablename__ = 'accounts'
    __table_args__ = (
        PrimaryKeyConstraint('account_id', name='pk_accounts'),
        Index('uq_accounts_lunchflow_account_id', 'lunchflow_account_id', unique=True)
    )

    account_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    lunchflow_account_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), nullable=False)
    account_name: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    institution_name: Mapped[Optional[str]] = mapped_column(VARCHAR(100))

    transactions: Mapped[list['Transactions']] = relationship('Transactions', back_populates='account')


class Categories(Base):
    __tablename__ = 'categories'
    __table_args__ = (
        CheckConstraint('BUDGET IS NULL OR BUDGET >=0', name='ck_categories_budget'),
        PrimaryKeyConstraint('category_id', name='pk_categories'),
        Index('uq_categories_category_name', 'category_name', unique=True)
    )

    category_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    category_name: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    budget: Mapped[Optional[decimal.Decimal]] = mapped_column(NUMBER(19, 4, True))

    transactions: Mapped[list['Transactions']] = relationship('Transactions', back_populates='category')


class Transactions(Base):
    __tablename__ = 'transactions'
    __table_args__ = (
        ForeignKeyConstraint(['account_id'], ['accounts.account_id'], name='fk_transactions_account'),
        ForeignKeyConstraint(['category_id'], ['categories.category_id'], name='fk_transactions_merchant'),
        PrimaryKeyConstraint('transaction_id', name='pk_transactions'),
        Index('uq_transactions_lunchflow_transaction_id', 'lunchflow_transaction_id', unique=True)
    )

    transaction_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    lunchflow_transaction_id: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    account_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(NUMBER(19, 4, True), nullable=False)
    transaction_date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    direction: Mapped[str] = mapped_column(Enum('INBOUND', 'OUTBOUND'), nullable=False)
    merchant_name: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    category_id: Mapped[Optional[float]] = mapped_column(NUMBER(19, 0, False))
    reference: Mapped[Optional[str]] = mapped_column(VARCHAR(255))
    raw_lunchflow_transaction: Mapped[Optional[dict]] = mapped_column(JSON)

    account: Mapped['Accounts'] = relationship('Accounts', back_populates='transactions')
    category: Mapped[Optional['Categories']] = relationship('Categories', back_populates='transactions')
