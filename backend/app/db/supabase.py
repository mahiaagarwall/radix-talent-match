"""Supabase client configuration and factory for RADIX Talent Match.

Safe credential loading from environment variables.
Never crashes when environment variables are not yet configured.
Never exposes secret keys or connection strings in logs or exceptions.
"""

from __future__ import annotations

import os
from typing import Optional, Dict, Any
from supabase import create_client, Client


def get_supabase_url() -> Optional[str]:
    return os.getenv("SUPABASE_URL") or None


def get_supabase_key() -> Optional[str]:
    # Check for service role key first, then anon key / general key
    return (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or None
    )


def is_supabase_configured() -> bool:
    url = get_supabase_url()
    key = get_supabase_key()
    return bool(url and key and str(url).startswith("http"))


_client_instance: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """Return a singleton Supabase client, or None if credentials are missing."""
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    if not is_supabase_configured():
        return None

    try:
        url = get_supabase_url()
        key = get_supabase_key()
        if url and key:
            _client_instance = create_client(url, key)
            return _client_instance
    except Exception:
        return None

    return None


def get_db_connection():
    """Return a raw psycopg2 database connection if configured and available.
    
    Raises RuntimeError if psycopg2 is missing or credentials cannot connect.
    Never exposes passwords or sensitive DSN details.
    """
    database_url = os.getenv("DATABASE_URL")
    database_url_direct = os.getenv("DATABASE_URL_DIRECT")

    if not database_url and not database_url_direct:
        raise RuntimeError("DATABASE_URL is not configured in environment.")

    try:
        import psycopg2
    except ImportError:
        raise RuntimeError("psycopg2 is not installed.")

    errors = []
    for dsn in [database_url, database_url_direct]:
        if not dsn:
            continue
        try:
            conn = psycopg2.connect(dsn, connect_timeout=5)
            return conn
        except Exception as exc:
            errors.append(type(exc).__name__)

    raise RuntimeError(f"Failed to connect to PostgreSQL ({', '.join(errors)})")


def check_db_health() -> Dict[str, Any]:
    """Test Supabase API and/or PostgreSQL connection safely."""
    health: Dict[str, Any] = {
        "status": "ok",
        "supabase_configured": is_supabase_configured(),
        "supabase_client_ready": False,
        "postgres_connected": False,
        "tables_accessible": False,
    }

    client = get_supabase_client()
    if client:
        try:
            # Simple probe on public tables
            res = client.table("candidate_profiles").select("profile_id", count="exact").limit(1).execute()
            health["supabase_client_ready"] = True
            health["tables_accessible"] = True
        except Exception:
            health["supabase_client_ready"] = True

    try:
        conn = get_db_connection()
        health["postgres_connected"] = True
        conn.close()
    except Exception:
        health["postgres_connected"] = False

    if not health["supabase_configured"] and not health["postgres_connected"]:
        health["status"] = "offline_fixtures_active"
    elif not health["supabase_client_ready"] and not health["postgres_connected"]:
        health["status"] = "degraded"

    return health


def reset_client():
    """Reset cached client instance for testing."""
    global _client_instance
    _client_instance = None
