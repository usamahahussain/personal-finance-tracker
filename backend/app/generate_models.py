from sqlacodegen.generators import DeclarativeGenerator
import oracledb
from sqlalchemy import create_engine, text, MetaData
from sqlalchemy.pool import NullPool
from db_connection import create_connection
from dotenv import load_dotenv

load_dotenv()

def generate_models():
    print("Connecting to database and reflecting schema...")
    try:
        engine = create_connection()
        # 1. Create MetaData and reflect the database schema
        metadata = MetaData()
        metadata.reflect(bind=engine)
        
        # 2. Initialize the sqlacodegen generator
        # options can include things like ignoring certain tables if needed
        generator = DeclarativeGenerator(metadata, engine, options=())
        
        # 3. Generate the Python code string
        print("Generating ORM models...")
        generated_code = generator.generate()
        
        # 4. Write the output to a file
        with open("models.py", "w", encoding="utf-8") as f:
            f.write(generated_code)
            
        print("Success! Check the models.py file in your directory.")
        
    except Exception as e:
        import traceback
        print(f"Failed to generate models:")
        traceback.print_exc()

if __name__ == "__main__":
    generate_models()    
