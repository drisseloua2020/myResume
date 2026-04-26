from __future__ import annotations
from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import settings
_ENGINE: Engine | None = None
_SESSION_FACTORY: sessionmaker[Session] | None = None

def _build_engine(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, pool_pre_ping=True, future=True, connect_args=connect_args)

def configure_engine(database_url: str | None = None) -> None:
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = _build_engine(database_url or settings.database_url)
    _SESSION_FACTORY = sessionmaker(bind=_ENGINE, autoflush=False, autocommit=False, expire_on_commit=False)

def get_engine() -> Engine:
    if _ENGINE is None:
        configure_engine()
    assert _ENGINE is not None
    return _ENGINE

def get_session_factory() -> sessionmaker[Session]:
    if _SESSION_FACTORY is None:
        configure_engine()
    assert _SESSION_FACTORY is not None
    return _SESSION_FACTORY

def get_db() -> Generator[Session, None, None]:
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()

def dispose_engine() -> None:
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = None
    _SESSION_FACTORY = None
