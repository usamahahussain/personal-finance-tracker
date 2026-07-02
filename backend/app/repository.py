import oracledb
from db_connection import create_connection
from db_connection import create_session
from models import Accounts


def test_db_connection():
    try:
        engine = create_connection()
        with engine.connect() as conn:
            result = conn.exec_driver_sql("SELECT * FROM ACCOUNTS")
            print(result.cursor.description)
    except oracledb.Error as e:
        print(f"Could not connect to the database - Error occurred: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()        


def get_accounts():
    session = create_session()
    all_accounts = session.query(Accounts).all()

    return all_accounts
