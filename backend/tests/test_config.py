import pytest
from pydantic import ValidationError

from app.core.config import Settings

SESSION_POOLER = "postgresql://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"


def test_plain_postgres_url_gets_psycopg_driver():
    s = Settings(database_url="postgres://u:p@localhost:5432/revyu")
    assert s.database_url == "postgresql+psycopg://u:p@localhost:5432/revyu"


def test_local_url_is_not_forced_to_ssl():
    s = Settings(database_url="postgresql://u:p@localhost:5432/revyu")
    assert "sslmode" not in s.database_url


def test_supabase_session_pooler_gets_ssl():
    s = Settings(database_url=SESSION_POOLER)
    assert s.database_url.startswith("postgresql+psycopg://")
    assert s.database_url.endswith("/postgres?sslmode=require")


def test_supabase_existing_sslmode_is_kept():
    s = Settings(database_url=SESSION_POOLER + "?sslmode=verify-full")
    assert s.database_url.count("sslmode=") == 1
    assert s.database_url.endswith("sslmode=verify-full")


def test_supabase_direct_host_gets_ssl():
    s = Settings(database_url="postgresql://postgres:pw@db.abc.supabase.co:5432/postgres")
    assert s.database_url.endswith("?sslmode=require")


def test_supabase_transaction_pooler_is_refused():
    with pytest.raises(ValidationError, match="Session pooler"):
        Settings(database_url=SESSION_POOLER.replace(":5432", ":6543"))
