"""FleetYield AI - SQLite Database Layer and Persistence Manager."""

import sqlite3
import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DB_DIR, "fleetyield.db")


def get_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with dictionary row access."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Initializes tables and seeds initial synthetic data if empty."""
    os.makedirs(DB_DIR, exist_ok=True)
    with get_connection() as conn:
        cursor = conn.cursor()

        # 1. Trips table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trips (
                trip_id TEXT PRIMARY KEY,
                route_name TEXT NOT NULL,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
                departure_time TEXT NOT NULL,
                total_seats INTEGER NOT NULL,
                booked_seats INTEGER NOT NULL,
                base_fare REAL NOT NULL,
                current_fare REAL NOT NULL,
                min_fare REAL NOT NULL,
                max_fare REAL NOT NULL,
                data_updated_at TEXT NOT NULL,
                data_source_label TEXT NOT NULL DEFAULT 'Synthetic demo data',
                bus_type TEXT DEFAULT 'AC Seater',
                route_distance_km REAL,
                operator_notes TEXT
            );
        """)

        # 2. Booking snapshots table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS booking_snapshots (
                snapshot_id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL,
                captured_at TEXT NOT NULL,
                booked_seats INTEGER NOT NULL,
                source_label TEXT NOT NULL DEFAULT 'Synthetic demo data',
                FOREIGN KEY (trip_id) REFERENCES trips (trip_id) ON DELETE CASCADE
            );
        """)

        # 3. Recommendations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recommendations (
                recommendation_id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                current_fare_at_generation REAL NOT NULL,
                base_fare_at_generation REAL NOT NULL,
                recommended_fare REAL NOT NULL,
                fare_difference REAL NOT NULL,
                fare_difference_pct REAL NOT NULL,
                min_fare REAL NOT NULL,
                max_fare REAL NOT NULL,
                demand_category TEXT NOT NULL,
                explanation TEXT NOT NULL,
                rule_applied TEXT NOT NULL,
                contributing_factors TEXT NOT NULL, -- JSON string
                booking_pace_info TEXT NOT NULL,
                validation_status TEXT NOT NULL,
                policy_version TEXT NOT NULL,
                source_label TEXT NOT NULL DEFAULT 'Synthetic demo data',
                is_clamped INTEGER NOT NULL DEFAULT 0,
                clamped_reason TEXT,
                notice TEXT NOT NULL,
                evidence_quality_status TEXT NOT NULL DEFAULT 'Strong data',
                evidence_quality_details TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (trip_id) REFERENCES trips (trip_id) ON DELETE CASCADE
            );
        """)

        # Schema migrations for existing databases
        for col, col_def in [
            ("evidence_quality_status", "TEXT NOT NULL DEFAULT 'Strong data'"),
            ("evidence_quality_details", "TEXT NOT NULL DEFAULT '{}'"),
            ("recommended_action", "TEXT NOT NULL DEFAULT 'Maintain fare'"),
            ("competitor_summary", "TEXT NOT NULL DEFAULT '{}'"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE recommendations ADD COLUMN {col} {col_def}")
            except sqlite3.OperationalError:
                pass

        # 4. Operator decisions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operator_decisions (
                decision_id TEXT PRIMARY KEY,
                recommendation_id TEXT NOT NULL,
                trip_id TEXT NOT NULL,
                decision_type TEXT NOT NULL,
                decision_fare REAL,
                reason TEXT,
                created_at TEXT NOT NULL,
                actor_label TEXT NOT NULL DEFAULT 'Demo operator',
                FOREIGN KEY (recommendation_id) REFERENCES recommendations (recommendation_id) ON DELETE CASCADE,
                FOREIGN KEY (trip_id) REFERENCES trips (trip_id) ON DELETE CASCADE
            );
        """)

        # 5. Audit events table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_events (
                audit_id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                previous_fare REAL,
                recommended_fare REAL,
                final_decision_fare REAL,
                reason TEXT,
                details TEXT,
                created_at TEXT NOT NULL,
                rule_version TEXT NOT NULL,
                data_source_label TEXT NOT NULL DEFAULT 'Synthetic demo data',
                actor_label TEXT NOT NULL DEFAULT 'Demo operator'
            );
        """)

        # 6. Competitor fares table (RedBus & AbhiBus benchmark integration)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS competitor_fares (
                competitor_fare_id TEXT PRIMARY KEY,
                trip_id TEXT,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
                route_name TEXT,
                departure_time TEXT NOT NULL,
                bus_type TEXT NOT NULL,
                operator_name TEXT NOT NULL,
                platform TEXT NOT NULL, -- 'RedBus' or 'AbhiBus'
                fare REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'INR',
                available_seats INTEGER DEFAULT 20,
                rating REAL DEFAULT 4.2,
                review_count INTEGER DEFAULT 1200,
                amenities TEXT DEFAULT '[]', -- JSON string
                is_simulated INTEGER NOT NULL DEFAULT 1,
                data_source_label TEXT NOT NULL DEFAULT 'Synthetic competitor data (RedBus & AbhiBus SeatSeller schema)',
                captured_at TEXT NOT NULL
            );
        """)

        conn.commit()


def reset_and_seed_database() -> None:
    """Drops and re-populates tables with seed data."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS competitor_fares;")
        cursor.execute("DROP TABLE IF EXISTS operator_decisions;")
        cursor.execute("DROP TABLE IF EXISTS recommendations;")
        cursor.execute("DROP TABLE IF EXISTS booking_snapshots;")
        cursor.execute("DROP TABLE IF EXISTS audit_events;")
        cursor.execute("DROP TABLE IF EXISTS trips;")
        conn.commit()
    init_db()
    from app.seed import seed_data
    seed_data()
