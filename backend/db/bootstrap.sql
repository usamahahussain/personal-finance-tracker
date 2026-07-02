-- Run this once as ADMIN before running schema.sql.
--
-- Replace the password placeholder before execution, then connect as
-- FINANCE_APP and run schema.sql so the application objects are owned by the
-- application schema rather than ADMIN.

CREATE USER finance_app
    IDENTIFIED BY "insert_password_here"
    DEFAULT TABLESPACE data
    QUOTA UNLIMITED ON data;

GRANT CREATE SESSION TO finance_app;
GRANT CREATE TABLE TO finance_app;
GRANT CREATE VIEW TO finance_app;
GRANT CREATE SEQUENCE TO finance_app;
GRANT CREATE PROCEDURE TO finance_app;
