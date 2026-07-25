from typing import Optional
import datetime
import decimal
import enum

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKeyConstraint, Identity, Index, JSON, PrimaryKeyConstraint, VARCHAR, text
from sqlalchemy.dialects.oracle import NUMBER
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass


class CategoriesBudgetKind(str, enum.Enum):
    DISCRETIONARY = 'DISCRETIONARY'
    RECURRING = 'RECURRING'


class TransactionsDirection(str, enum.Enum):
    INBOUND = 'INBOUND'
    OUTBOUND = 'OUTBOUND'


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
        CheckConstraint("budget_kind IN ('DISCRETIONARY', 'RECURRING')", name='ck_categories_budget_kind'),
        PrimaryKeyConstraint('category_id', name='pk_categories'),
        Index('uq_categories_category_name', 'category_name', unique=True)
    )

    category_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    category_name: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    budget_kind: Mapped[CategoriesBudgetKind] = mapped_column(Enum(CategoriesBudgetKind, values_callable=lambda cls: [member.value for member in cls]), nullable=False, server_default=text("'DISCRETIONARY' "))
    budget: Mapped[Optional[decimal.Decimal]] = mapped_column(NUMBER(19, 4, True))

    recurring_transactions: Mapped[list['RecurringTransactions']] = relationship('RecurringTransactions', back_populates='category')
    transactions: Mapped[list['Transactions']] = relationship('Transactions', back_populates='category')


class RecurringTransactions(Base):
    __tablename__ = 'recurring_transactions'
    __table_args__ = (
        CheckConstraint('active IN (0, 1)', name='ck_recurring_transactions_active'),
        CheckConstraint('due_day IS NULL OR due_day BETWEEN 1 AND 31', name='ck_recurring_transactions_due_day'),
        CheckConstraint('expected_amount IS NULL OR expected_amount >= 0', name='ck_recurring_transactions_expected_amount'),
        ForeignKeyConstraint(['category_id'], ['categories.category_id'], name='fk_recurring_transactions_category'),
        PrimaryKeyConstraint('recurring_transaction_id', name='pk_recurring_transactions')
    )

    recurring_transaction_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    display_name: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('1 '))
    category_id: Mapped[Optional[float]] = mapped_column(NUMBER(19, 0, False))
    expected_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(NUMBER(19, 4, True))
    due_day: Mapped[Optional[float]] = mapped_column(NUMBER(2, 0, False))

    category: Mapped[Optional['Categories']] = relationship('Categories', back_populates='recurring_transactions')
    transactions: Mapped[list['Transactions']] = relationship('Transactions', back_populates='recurring_transaction')


class Transactions(Base):
    __tablename__ = 'transactions'
    __table_args__ = (
        CheckConstraint("direction IN ('INBOUND', 'OUTBOUND')", name='ck_transactions_direction'),
        ForeignKeyConstraint(['account_id'], ['accounts.account_id'], name='fk_transactions_account'),
        ForeignKeyConstraint(['category_id'], ['categories.category_id'], name='fk_transactions_merchant'),
        ForeignKeyConstraint(['recurring_transaction_id'], ['recurring_transactions.recurring_transaction_id'], name='fk_transactions_recurring_transaction'),
        PrimaryKeyConstraint('transaction_id', name='pk_transactions'),
        Index('uq_transactions_lunchflow_transaction_id', 'lunchflow_transaction_id', unique=True)
    )

    transaction_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    lunchflow_transaction_id: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    account_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(NUMBER(19, 4, True), nullable=False)
    transaction_date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    direction: Mapped[TransactionsDirection] = mapped_column(Enum(TransactionsDirection, values_callable=lambda cls: [member.value for member in cls]), nullable=False)
    merchant_name: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    category_id: Mapped[Optional[float]] = mapped_column(NUMBER(19, 0, False))
    reference: Mapped[Optional[str]] = mapped_column(VARCHAR(255))
    raw_lunchflow_transaction: Mapped[Optional[object]] = mapped_column(JSON)
    recurring_transaction_id: Mapped[Optional[float]] = mapped_column(NUMBER(19, 0, False))

    account: Mapped['Accounts'] = relationship('Accounts', back_populates='transactions')
    category: Mapped[Optional['Categories']] = relationship('Categories', back_populates='transactions')
    recurring_transaction: Mapped[Optional['RecurringTransactions']] = relationship('RecurringTransactions', back_populates='transactions')
