import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "sovereign_strength.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        equipment_increments TEXT,
        available_equipment TEXT,
        updated_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        date TEXT,
        session_type TEXT,
        duration_min INTEGER,
        notes TEXT,
        program_id TEXT,
        program_day_label TEXT,
        entries TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        date TEXT,
        sleep_score INTEGER,
        energy_score INTEGER,
        soreness_score INTEGER,
        time_budget_min INTEGER,
        notes TEXT,
        created_at TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS session_results (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        date TEXT,
        session_type TEXT,
        timing_state TEXT,
        readiness_score INTEGER,
        completed INTEGER,
        notes TEXT,
        results TEXT,
        created_at TEXT
    )
    """)

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("SQLite schema initialized:", DB_PATH)
