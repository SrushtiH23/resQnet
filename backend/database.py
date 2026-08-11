import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Default to SQLite file database if DATABASE_URL not set
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./resqnet.db")

# Standardize postgres:// to postgresql:// for SQLAlchemy 2.0 compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # On Vercel Lambda / read-only serverless filesystems, route SQLite fallback to /tmp
    if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        DATABASE_URL = "sqlite:////tmp/resqnet.db"
    else:
        try:
            test_file = "./.write_test"
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
        except Exception:
            DATABASE_URL = "sqlite:////tmp/resqnet.db"

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

