-- Run bootstrap.sql once as ADMIN before running this file.
--
-- This file must be run while connected as FINANCE_APP so these objects are
-- created in the application schema rather than in ADMIN.

CREATE TABLE accounts (
    account_id              NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    lunchflow_account_id    NUMBER(19,0) NOT NULL,
    account_name            VARCHAR2(100) NOT NULL,
    institution_name        VARCHAR2(100),
    CONSTRAINT pk_accounts PRIMARY KEY (account_id),
    CONSTRAINT uq_accounts_lunchflow_account_id UNIQUE (lunchflow_account_id)
);

CREATE TABLE categories (
    category_id             NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    category_name           VARCHAR2(100) NOT NULL,
    budget                  NUMBER(19,4),
    CONSTRAINT pk_categories PRIMARY KEY (category_id),
    CONSTRAINT uq_categories_category_name UNIQUE (category_name),
    CONSTRAINT ck_categories_budget
        CHECK (budget IS NULL OR budget >= 0)
);


CREATE TABLE transactions (
    transaction_id              NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    lunchflow_transaction_id    VARCHAR2(100) NOT NULL,
    account_id                  NUMBER(19,0) NOT NULL,
    amount                      NUMBER(19,4) NOT NULL,
    transaction_date            DATE NOT NULL,
    direction                   VARCHAR2(10) NOT NULL,
    merchant_name               VARCHAR2(100) NOT NULL,
    category_id                 NUMBER(19,0),
    reference                   VARCHAR2(255),
    raw_lunchflow_transaction   JSON,
    CONSTRAINT pk_transactions PRIMARY KEY (transaction_id),
    CONSTRAINT uq_transactions_lunchflow_transaction_id UNIQUE (lunchflow_transaction_id),
    CONSTRAINT fk_transactions_account
        FOREIGN KEY (account_id) REFERENCES accounts(account_id),
    CONSTRAINT fk_transactions_category
        FOREIGN KEY (category_id) REFERENCES categories(category_id),
    -- CONSTRAINT fk_transactions_recurring_obligation
    CONSTRAINT ck_transactions_direction
        CHECK (direction IN ('INBOUND', 'OUTBOUND'))
);

-- CREATE TABLE merchants (
--     merchant_id             NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
--     merchant_name           VARCHAR2(100) NOT NULL,
--     search_key              VARCHAR2(100) NOT NULL,
--     CONSTRAINT pk_merchants PRIMARY KEY (merchant_id),
--     CONSTRAINT uq_merchants_merchant_name UNIQUE (merchant_name),
--     CONSTRAINT uq_merchants_search_key UNIQUE (search_key)
-- );


-- CREATE TABLE recurring_obligations (
--     recurring_obligation_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
--     merchant_id             NUMBER(19,0) NOT NULL,
--     expected_amount         NUMBER(19,4),
--     cadence                 VARCHAR2(20) NOT NULL,
--     due_day                 NUMBER(2,0),
--     variance_type           VARCHAR2(20) NOT NULL,
--     status                  VARCHAR2(20) DEFAULT 'pending_approval' NOT NULL,
--     confidence_score        NUMBER(5,4),
--     auto_detected           NUMBER(1,0) DEFAULT 1 NOT NULL,
--     CONSTRAINT pk_recurring_obligations PRIMARY KEY (recurring_obligation_id),
--     CONSTRAINT fk_recurring_obligations_merchant
--         FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id),
--     CONSTRAINT ck_recurring_obligations_expected_amount
--         CHECK (expected_amount IS NULL OR expected_amount >= 0),
--     CONSTRAINT ck_recurring_obligations_cadence
--         CHECK (cadence IN ('monthly', 'weekly')),
--     CONSTRAINT ck_recurring_obligations_due_day
--         CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
--     CONSTRAINT ck_recurring_obligations_variance_type
--         CHECK (variance_type IN ('fixed', 'variable')),
--     CONSTRAINT ck_recurring_obligations_status
--         CHECK (status IN ('pending_approval', 'active', 'rejected')),
--     CONSTRAINT ck_recurring_obligations_confidence
--         CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
--     CONSTRAINT ck_recurring_obligations_auto_detected
--         CHECK (auto_detected IN (0, 1))
-- );

-- CREATE TABLE merchant_category_mappings (
--     merchant_id             NUMBER(19,0) NOT NULL,
--     category_id             NUMBER(19,0) NOT NULL,
--     CONSTRAINT pk_merchant_category_mappings PRIMARY KEY (merchant_id),
--     CONSTRAINT fk_merchant_category_mappings_merchant
--         FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id),
--     CONSTRAINT fk_merchant_category_mappings_category
--         FOREIGN KEY (category_id) REFERENCES categories(category_id)
-- );

-- CREATE TABLE transactions (
--     transaction_id              NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
--     lunchflow_transaction_id    VARCHAR2(100) NOT NULL,
--     account_id                  NUMBER(19,0) NOT NULL,
--     amount                      NUMBER(19,4) NOT NULL,
--     transaction_date            DATE NOT NULL,
--     direction                   VARCHAR2(10) NOT NULL,
--     merchant_id                 NUMBER(19,0) NOT NULL,
--     category_id                 NUMBER(19,0),
--     reference                   VARCHAR2(255),
--     recurring_obligation_id     NUMBER(19,0),
--     needs_review                NUMBER(1,0) DEFAULT 0 NOT NULL,
--     raw_lunchflow_transaction   JSON,
--     CONSTRAINT pk_transactions PRIMARY KEY (transaction_id),
--     CONSTRAINT uq_transactions_lunchflow_transaction_id UNIQUE (lunchflow_transaction_id),
--     CONSTRAINT fk_transactions_account
--         FOREIGN KEY (account_id) REFERENCES accounts(account_id),
--     CONSTRAINT fk_transactions_merchant
--         FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id),
--     CONSTRAINT fk_transactions_category
--         FOREIGN KEY (category_id) REFERENCES categories(category_id),
--     CONSTRAINT fk_transactions_recurring_obligation
--         FOREIGN KEY (recurring_obligation_id)
--         REFERENCES recurring_obligations(recurring_obligation_id),
--     CONSTRAINT ck_transactions_direction
--         CHECK (direction IN ('INBOUND', 'OUTBOUND')),
--     CONSTRAINT ck_transactions_needs_review
--         CHECK (needs_review IN (0, 1))
-- );
