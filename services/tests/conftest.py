from __future__ import annotations
import os
from collections.abc import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-regression-only-2026")
os.environ.setdefault("AUTH_REQUESTS_PER_MINUTE", "10000")
if os.environ["APP_ENV"] != "test" or os.environ["DATABASE_URL"] != "sqlite+pysqlite:///./test.db":
    raise RuntimeError("Tests refuse inherited database targets. Use APP_ENV=test and DATABASE_URL=sqlite+pysqlite:///./test.db")
from app.db.base import Base
from app.db.session import configure_engine, dispose_engine, get_engine, get_session_factory
from app.main import app
@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    configure_engine(os.environ["DATABASE_URL"])
    engine = get_engine(); Base.metadata.drop_all(bind=engine); Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine); dispose_engine()
@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try: yield session
    finally: session.close()
@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client
