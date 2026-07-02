from typing import Any, Optional
import datetime
import decimal

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Enum, ForeignKeyConstraint, Identity, Index, PrimaryKeyConstraint, Table, VARCHAR, text, JSON
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
        CheckConstraint('monthly_target_amount IS NULL OR monthly_target_amount >= 0', name='ck_categories_monthly_target_amount'),
        PrimaryKeyConstraint('category_id', name='pk_categories'),
        Index('uq_categories_category_name', 'category_name', unique=True)
    )

    category_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    category_name: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    monthly_target_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(NUMBER(19, 4, True))

    merchant: Mapped[list['Merchants']] = relationship('Merchants', secondary='merchant_category_mappings', back_populates='category')
    transactions: Mapped[list['Transactions']] = relationship('Transactions', back_populates='category')


class Merchants(Base):
    __tablename__ = 'merchants'
    __table_args__ = (
        PrimaryKeyConstraint('merchant_id', name='pk_merchants'),
        Index('uq_merchants_merchant_name', 'merchant_name', unique=True),
        Index('uq_merchants_search_key', 'search_key', unique=True)
    )

    merchant_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    merchant_name: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    search_key: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)

    category: Mapped[list['Categories']] = relationship('Categories', secondary='merchant_category_mappings', back_populates='merchant')
    recurring_obligations: Mapped[list['RecurringObligations']] = relationship('RecurringObligations', back_populates='merchant')
    transactions: Mapped[list['Transactions']] = relationship('Transactions', back_populates='merchant')


t_merchant_category_mappings = Table(
    'merchant_category_mappings', Base.metadata,
    Column('merchant_id', NUMBER(19, 0, False), primary_key=True),
    Column('category_id', NUMBER(19, 0, False), nullable=False),
    ForeignKeyConstraint(['category_id'], ['categories.category_id'], name='fk_merchant_category_mappings_category'),
    ForeignKeyConstraint(['merchant_id'], ['merchants.merchant_id'], name='fk_merchant_category_mappings_merchant'),
    PrimaryKeyConstraint('merchant_id', name='pk_merchant_category_mappings')
)


class RecurringObligations(Base):
    __tablename__ = 'recurring_obligations'
    __table_args__ = (
        CheckConstraint('confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1', name='ck_recurring_obligations_confidence'),
        CheckConstraint('due_day IS NULL OR due_day BETWEEN 1 AND 31', name='ck_recurring_obligations_due_day'),
        CheckConstraint('expected_amount IS NULL OR expected_amount >= 0', name='ck_recurring_obligations_expected_amount'),
        ForeignKeyConstraint(['merchant_id'], ['merchants.merchant_id'], name='fk_recurring_obligations_merchant'),
        PrimaryKeyConstraint('recurring_obligation_id', name='pk_recurring_obligations')
    )

    recurring_obligation_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    merchant_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), nullable=False)
    cadence: Mapped[str] = mapped_column(Enum('monthly', 'weekly'), nullable=False)
    variance_type: Mapped[str] = mapped_column(Enum('fixed', 'variable'), nullable=False)
    status: Mapped[str] = mapped_column(Enum('pending_approval', 'active', 'rejected'), nullable=False, server_default=text("'pending_approval' "))
    auto_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('1 '))
    expected_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(NUMBER(19, 4, True))
    due_day: Mapped[Optional[float]] = mapped_column(NUMBER(2, 0, False))
    confidence_score: Mapped[Optional[decimal.Decimal]] = mapped_column(NUMBER(5, 4, True))

    merchant: Mapped['Merchants'] = relationship('Merchants', back_populates='recurring_obligations')
    transactions: Mapped[list['Transactions']] = relationship('Transactions', back_populates='recurring_obligation')


class Transactions(Base):
    __tablename__ = 'transactions'
    __table_args__ = (
        ForeignKeyConstraint(['account_id'], ['accounts.account_id'], name='fk_transactions_account'),
        ForeignKeyConstraint(['category_id'], ['categories.category_id'], name='fk_transactions_category'),
        ForeignKeyConstraint(['merchant_id'], ['merchants.merchant_id'], name='fk_transactions_merchant'),
        ForeignKeyConstraint(['recurring_obligation_id'], ['recurring_obligations.recurring_obligation_id'], name='fk_transactions_recurring_obligation'),
        PrimaryKeyConstraint('transaction_id', name='pk_transactions'),
        Index('uq_transactions_lunchflow_transaction_id', 'lunchflow_transaction_id', unique=True)
    )

    transaction_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), Identity(always=True, on_null=False, start=1, increment=1, minvalue=1, maxvalue=9999999999999999999999999999, cycle=False, cache=20, order=False), primary_key=True)
    lunchflow_transaction_id: Mapped[str] = mapped_column(VARCHAR(100), nullable=False)
    account_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(NUMBER(19, 4, True), nullable=False)
    transaction_date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    direction: Mapped[str] = mapped_column(Enum('INBOUND', 'OUTBOUND'), nullable=False)
    merchant_id: Mapped[float] = mapped_column(NUMBER(19, 0, False), nullable=False)
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('0 '))
    category_id: Mapped[Optional[float]] = mapped_column(NUMBER(19, 0, False))
    reference: Mapped[Optional[str]] = mapped_column(VARCHAR(255))
    recurring_obligation_id: Mapped[Optional[float]] = mapped_column(NUMBER(19, 0, False))
    raw_lunchflow_transaction: Mapped[Optional[dict]] = mapped_column(JSON)

    account: Mapped['Accounts'] = relationship('Accounts', back_populates='transactions')
    category: Mapped[Optional['Categories']] = relationship('Categories', back_populates='transactions')
    merchant: Mapped['Merchants'] = relationship('Merchants', back_populates='transactions')
    recurring_obligation: Mapped[Optional['RecurringObligations']] = relationship('RecurringObligations', back_populates='transactions')
