import sqlite3
import os
import shutil
from contextlib import contextmanager
from typing import Generator

ORIGINAL_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campus_events.db")

# In Vercel serverless environment, the root filesystem is read-only.
# Copy database to /tmp so writes (registrations, event creation) succeed.
if os.environ.get("VERCEL"):
    DB_PATH = "/tmp/campus_events.db"
    if not os.path.exists(DB_PATH) and os.path.exists(ORIGINAL_DB_PATH):
        try:
            shutil.copy2(ORIGINAL_DB_PATH, DB_PATH)
        except Exception:
            pass
else:
    DB_PATH = ORIGINAL_DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Enable WAL mode for high concurrency
        cursor.execute("PRAGMA journal_mode=WAL;")
        
        # 1. Users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            reg_no TEXT,
            department TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
        # 2. Events table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            venue TEXT NOT NULL,
            organizer_name TEXT NOT NULL,
            organizer_email TEXT NOT NULL,
            max_capacity INTEGER NOT NULL CHECK(max_capacity > 0),
            current_registrations INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'completed', 'cancelled')),
            banner_url TEXT,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        """)
        
        # 3. Registrations table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT UNIQUE NOT NULL,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled')),
            checked_in INTEGER NOT NULL DEFAULT 0,
            checked_in_at TIMESTAMP,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(event_id, user_id)
        );
        """)
        
        # 4. Notifications table (for user dashboard & event updates)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'info',
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)
        
        # Indexing for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reg_ticket ON registrations(ticket_id);")

if __name__ == "__main__":
    init_db()
    print("Database schema successfully initialized.")
