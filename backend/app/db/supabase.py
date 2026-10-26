"""Supabase database and client module for RADIX Talent Match."""

import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Ensure environment variables are loaded from backend/.env or root .env
backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"

if backend_env.exists():
    load_dotenv(backend_env)
elif root_env.exists():
    load_dotenv(root_env)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://capdvzezqlqzkgpcffzk.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
) or os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhcGR2emV6cWxxemtncGNmZnprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNDM2ODksImV4cCI6MjEwNzcxOTY4OX0.WnQWIgcZh_obuJqLLNRPsPBtzegd-XUfbyCKydr3BHM",
)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.capdvzezqlqzkgpcffzk:company_reserch_v1.1@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
)
DATABASE_URL_DIRECT = os.getenv(
    "DATABASE_URL_DIRECT",
    "postgresql://postgres:company_reserch_v1.1@db.capdvzezqlqzkgpcffzk.supabase.co:5432/postgres",
)

_client = None


def get_supabase_client():
    """Returns the singleton Supabase client instance."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set.")
        from supabase import create_client
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_db_connection():
    """Returns a raw psycopg2 database connection.
    
    Tries the pooler URL first (works across IPv4/IPv6 networks),
    then falls back to direct connection string if needed.
    """
    import psycopg2
    
    errors = []
    for dsn in [DATABASE_URL, DATABASE_URL_DIRECT]:
        if not dsn:
            continue
        try:
            conn = psycopg2.connect(dsn, connect_timeout=5)
            return conn
        except Exception as e:
            errors.append(f"{dsn.split('@')[-1]}: {str(e)}")
            continue
            
    raise RuntimeError(f"Failed to connect to PostgreSQL database: {'; '.join(errors)}")


def check_db_health() -> Dict[str, Any]:
    """Tests both the Supabase API client and direct PostgreSQL connection."""
    health: Dict[str, Any] = {
        "status": "ok",
        "supabase_url": SUPABASE_URL,
        "postgres_connected": False,
        "supabase_client_ready": False,
        "tables_count": 0,
        "companies_count": 0,
        "skill_levels_count": 0,
    }
    
    # 1. Supabase client check
    try:
        client = get_supabase_client()
        # Ping storage or auth
        _ = client.storage.list_buckets()
        health["supabase_client_ready"] = True
    except Exception as e:
        health["supabase_client_error"] = str(e)

    # 2. Postgres direct/pooler check
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
        health["tables_count"] = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM companies;")
        health["companies_count"] = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM company_skill_levels;")
        health["skill_levels_count"] = cur.fetchone()[0]
        
        health["postgres_connected"] = True
        conn.close()
    except Exception as e:
        health["postgres_connected"] = False
        health["postgres_error"] = str(e)
        health["status"] = "degraded" if health["supabase_client_ready"] else "error"
        
    return health


def get_companies_requirements() -> Dict[str, Any]:
    """Fetches companies and their required skill levels from Supabase tables
    and returns a normalized dict formatted for the frontend Talent Check module.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT 
            c.company_id,
            c.name AS company_name,
            c.short_name,
            c.category,
            m.short_name AS skill_category_code,
            l.required_level
        FROM companies c
        JOIN company_skill_levels l ON c.company_id = l.company_id
        JOIN skill_set_master m ON l.skill_set_id = m.skill_set_id
        ORDER BY c.company_id, m.short_name;
    """
    cur.execute(query)
    rows = cur.fetchall()
    conn.close()
    
    companies_map: Dict[int, Dict[str, Any]] = {}
    for cid, name, short_name, category, cat_code, req_level in rows:
        if cid not in companies_map:
            companies_map[cid] = {
                "company_id": str(cid),
                "company_name": name,
                "short_name": short_name or name,
                "category": category,
                "skillsets": {},
            }
        companies_map[cid]["skillsets"][cat_code] = req_level

    return {
        "version": "1.0",
        "source": "supabase",
        "companies": list(companies_map.values())
    }
