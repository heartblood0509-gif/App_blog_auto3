"""SQLAlchemy 데이터베이스 초기화"""

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, Session

from config import settings
from db.models import Base


def get_engine():
    db_path = settings.db_path
    return create_engine(f"sqlite:///{db_path}", echo=False)


def init_db():
    """데이터베이스 및 테이블 생성"""
    engine = get_engine()
    Base.metadata.create_all(engine)
    _migrate_account_password(engine)
    return engine


def _migrate_account_password(engine):
    """profile_path → password 1회성 데이터 이관 (idempotent)."""
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("accounts")}
    with engine.begin() as conn:
        if "password" not in cols:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN password VARCHAR"))
        conn.execute(text(
            "UPDATE accounts SET password = profile_path "
            "WHERE password IS NULL AND profile_path IS NOT NULL"
        ))


def get_session() -> Session:
    engine = get_engine()
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()
