import oracledb
from db_connection import create_connection
from db_connection import create_session
from sqlalchemy.orm import Session
from models import Accounts, Categories

class Repository:
    def __init__(self, db:Session):
        self.db = db

def get_accounts():
    return self.db.query(Accounts).all()

###### Categories CRUD ######

def get_categories():
    return self.db.query(Categories).all()

def get_category(category_id):
    return self.db.query(Categories).filter_by(category_id=category_id).first()

