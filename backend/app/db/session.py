import os
import time
import socket
from pathlib import Path
from typing import Generator, Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool, StaticPool

from .base import Base
from . import models

# Base project path for SQLite database file
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_SQLITE_PATH = os.path.join(BASE_DIR, "ansible_pulse.db")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:5436/ansible_pulse"
)

DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "15"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "25"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))

_engine = None
_SessionFactory = None
_is_connected = False
_db_error = None
_tables_created = False
_active_mode = "unknown"
_active_url = ""

def _is_pg_port_open(host="127.0.0.1", port=5436, timeout=0.08) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

def init_db_engine():
    global _engine, _SessionFactory, _is_connected, _db_error, _tables_created, _active_mode, _active_url
    if _is_connected and _engine is not None:
        return

    # Attempt PostgreSQL first if configured AND port is open
    if "postgresql" in DATABASE_URL and _is_pg_port_open():
        try:
            connect_args = {
                "connect_timeout": 2,
                "application_name": "ansible_pulse_api"
            }
            pg_engine = create_engine(
                DATABASE_URL,
                poolclass=QueuePool,
                pool_size=DB_POOL_SIZE,
                max_overflow=DB_MAX_OVERFLOW,
                pool_timeout=5,
                pool_recycle=DB_POOL_RECYCLE,
                pool_pre_ping=True,
                connect_args=connect_args
            )
            with pg_engine.connect() as conn:
                conn.execute(text("SELECT 1"))

            _engine = pg_engine
            _SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
            _is_connected = True
            _active_mode = "postgresql_production"
            _active_url = DATABASE_URL
            _db_error = None
            if not _tables_created:
                Base.metadata.create_all(bind=_engine)
                _tables_created = True
            return
        except Exception as pg_err:
            _db_error = f"PostgreSQL unavailable ({str(pg_err)[:60]}...). Gracefully switching to embedded SQLite."

    # Zero-configuration SQLite fallback
    try:
        sqlite_url = f"sqlite:///{DEFAULT_SQLITE_PATH}" if "sqlite" not in DATABASE_URL else DATABASE_URL
        sqlite_engine = create_engine(
            sqlite_url,
            connect_args={"check_same_thread": False}
        )
        with sqlite_engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        _engine = sqlite_engine
        _SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
        _is_connected = True
        _active_mode = "sqlite_embedded"
        _active_url = sqlite_url
        if not _tables_created:
            Base.metadata.create_all(bind=_engine)
            _tables_created = True
    except Exception as sq_err:
        _is_connected = False
        _db_error = str(sq_err)
        _engine = None
        _SessionFactory = None

# Initialize immediately
init_db_engine()

def get_db() -> Generator[Optional[Session], None, None]:
    """FastAPI dependency yielding database session with automatic cleanup."""
    global _SessionFactory, _is_connected
    if not _is_connected or not _SessionFactory:
        init_db_engine()

    if _SessionFactory:
        session = _SessionFactory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    else:
        yield None

def check_db_health() -> Dict[str, Any]:
    """Return live database connectivity, version, mode, and pool stats."""
    global _is_connected, _db_error, _engine, _active_mode, _active_url
    if not _is_connected or not _engine:
        init_db_engine()

    if not _is_connected or not _engine:
        return {
            "status": "offline",
            "connected": False,
            "mode": "offline",
            "dialect": "unknown",
            "error": _db_error,
            "database_url": _active_url or DATABASE_URL
        }

    start = time.perf_counter()
    try:
        with _engine.connect() as conn:
            if "postgresql" in _engine.dialect.name:
                res_ver = conn.execute(text("SELECT version();")).scalar()
                res_conn = conn.execute(text(
                    "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();"
                )).scalar()
            else:
                res_ver = conn.execute(text("SELECT sqlite_version();")).scalar()
                res_ver = f"SQLite {res_ver}"
                res_conn = 1

        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        masked_url = _active_url.split("@")[-1] if "@" in _active_url else _active_url

        pool_stats = {
            "size": getattr(_engine.pool, "size", lambda: 5)(),
            "checkedin": getattr(_engine.pool, "checkedin", lambda: 0)(),
            "checkedout": getattr(_engine.pool, "checkedout", lambda: 0)(),
            "mode": _active_mode
        }

        return {
            "status": "healthy",
            "connected": True,
            "mode": _active_mode,
            "dialect": _engine.dialect.name,
            "version": res_ver,
            "latency_ms": latency_ms,
            "active_connections": res_conn,
            "database_url": masked_url,
            "pool": pool_stats
        }
    except Exception as e:
        return {
            "status": "degraded",
            "connected": False,
            "mode": _active_mode,
            "error": str(e),
            "latency_ms": round((time.perf_counter() - start) * 1000, 2)
        }
