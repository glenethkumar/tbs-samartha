"""FleetYield AI - SQLite Database Layer and Persistence Manager."""

import sqlite3
import os
import shutil
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

IS_SERVERLESS = bool(
    os.environ.get("VERCEL") 
    or os.environ.get("AWS_LAMBDA_FUNCTION_NAME") 
    or os.environ.get("LAMBDA_TASK_ROOT")
)

ORIGINAL_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
ORIGINAL_DB_PATH = os.path.join(ORIGINAL_DATA_DIR, "fleetyield.db")

if IS_SERVERLESS:
    DB_DIR = "/tmp"
    DB_PATH = os.path.join(DB_DIR, "fleetyield.db")
    if os.path.exists(ORIGINAL_DB_PATH) and not os.path.exists(DB_PATH):
        try:
            shutil.copy2(ORIGINAL_DB_PATH, DB_PATH)
        except Exception as e:
            print(f"Warning: could not copy pre-seeded database to /tmp: {e}")
else:
    try:
        os.makedirs(ORIGINAL_DATA_DIR, exist_ok=True)
        DB_DIR = ORIGINAL_DATA_DIR
        DB_PATH = ORIGINAL_DB_PATH
    except OSError:
        DB_DIR = "/tmp"
        DB_PATH = os.path.join(DB_DIR, "fleetyield.db")


def get_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with dictionary row access."""
    try:
        os.makedirs(DB_DIR, exist_ok=True)
    except OSError:
        pass
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Initializes tables and seeds initial synthetic data if empty."""
    try:
        os.makedirs(DB_DIR, exist_ok=True)
    except OSError:
        pass
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
                operator_notes TEXT,
                -- Journey timing attributes
                scheduled_arrival_time TEXT,
                estimated_duration_hours REAL,
                expected_arrival_time TEXT,
                actual_arrival_time TEXT,
                stop_count INTEGER DEFAULT 2,
                service_category TEXT DEFAULT 'regular', -- 'express', 'limited_stop', 'regular'
                arrival_convenience_label TEXT,
                -- Bus ratings and quality
                average_rating REAL DEFAULT 4.2,
                review_count INTEGER DEFAULT 1200,
                rating_source TEXT DEFAULT 'Consolidated (RedBus & AbhiBus)',
                rating_updated_at TEXT,
                amenities TEXT DEFAULT '[]', -- JSON string
                on_time_performance_pct REAL DEFAULT 92.0,
                cancellation_rate_pct REAL DEFAULT 1.5,
                service_quality_score REAL DEFAULT 4.3
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
                -- Journey timing & comparable matching
                journey_duration_hours REAL,
                scheduled_arrival_time TEXT,
                service_category TEXT DEFAULT 'regular',
                seat_type TEXT DEFAULT 'sleeper',
                berth_type TEXT DEFAULT 'lower',
                sleeper_arrangement TEXT DEFAULT 'single', -- 'single', 'sharing', 'none'
                seat_position TEXT DEFAULT 'middle',
                additional_fees REAL DEFAULT 0.0,
                comparability_notes TEXT,
                is_simulated INTEGER NOT NULL DEFAULT 1,
                data_source_label TEXT NOT NULL DEFAULT 'Synthetic competitor data (RedBus & AbhiBus SeatSeller schema)',
                captured_at TEXT NOT NULL
            );
        """)

        # 7. Trip seats table (Seat-level dynamic pricing inventory)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trip_seats (
                seat_id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL,
                seat_number TEXT NOT NULL,
                deck TEXT NOT NULL DEFAULT 'lower', -- 'lower', 'upper', 'main'
                row_idx INTEGER NOT NULL,
                col_idx INTEGER NOT NULL,
                position TEXT NOT NULL, -- 'front', 'middle', 'back'
                seat_type TEXT NOT NULL, -- 'sitting', 'sleeper', 'semi-sleeper'
                berth_type TEXT NOT NULL DEFAULT 'none', -- 'lower', 'upper', 'none'
                -- Sharing and privacy attributes
                sleeper_arrangement TEXT NOT NULL DEFAULT 'none', -- 'single', 'sharing', 'none'
                max_occupants INTEGER NOT NULL DEFAULT 1,
                privacy_level TEXT NOT NULL DEFAULT 'standard', -- 'private', 'semi_private', 'standard'
                is_ac INTEGER NOT NULL DEFAULT 1,
                bus_category TEXT NOT NULL DEFAULT 'Sleeper',
                base_fare REAL NOT NULL,
                current_fare REAL NOT NULL,
                min_fare REAL NOT NULL,
                max_fare REAL NOT NULL,
                booking_status TEXT NOT NULL DEFAULT 'available', -- 'available', 'booked', 'blocked'
                booked_at TEXT,
                collected_fare REAL,
                passenger_gender TEXT,
                FOREIGN KEY (trip_id) REFERENCES trips (trip_id) ON DELETE CASCADE
            );
        """)

        # 8. Trip expenses table (Fuel, wages, tolls, commissions, maintenance, permits)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trip_expenses (
                trip_id TEXT PRIMARY KEY,
                fuel_cost REAL NOT NULL,
                driver_wages REAL NOT NULL,
                conductor_wages REAL NOT NULL,
                toll_charges REAL NOT NULL,
                platform_commission_pct REAL NOT NULL DEFAULT 8.0,
                maintenance_allocation REAL NOT NULL,
                permits_and_taxes REAL NOT NULL,
                other_costs REAL NOT NULL DEFAULT 0.0,
                is_estimated INTEGER NOT NULL DEFAULT 1,
                notes TEXT,
                FOREIGN KEY (trip_id) REFERENCES trips (trip_id) ON DELETE CASCADE
            );
        """)

        # 9. Seat recommendations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS seat_recommendations (
                seat_recommendation_id TEXT PRIMARY KEY,
                recommendation_id TEXT NOT NULL,
                trip_id TEXT NOT NULL,
                seat_id TEXT NOT NULL,
                seat_number TEXT NOT NULL,
                category_key TEXT NOT NULL,
                current_fare REAL NOT NULL,
                recommended_fare REAL NOT NULL,
                recommended_action TEXT NOT NULL, -- 'Increase fare', 'Decrease fare', 'Maintain fare', 'Locked (Booked)'
                fare_difference REAL NOT NULL,
                fare_difference_pct REAL NOT NULL,
                rule_applied TEXT NOT NULL,
                explanation TEXT NOT NULL,
                demand_category TEXT NOT NULL,
                booking_velocity REAL DEFAULT 0.0,
                competitor_median_for_category REAL,
                confidence_score TEXT NOT NULL DEFAULT 'Heuristic estimate',
                warnings TEXT NOT NULL DEFAULT '[]', -- JSON string
                decision_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'OVERRIDDEN'
                approved_fare REAL,
                created_at TEXT NOT NULL,
                -- Enhanced factor breakdown
                timing_factor_pct REAL DEFAULT 0.0,
                quality_factor_pct REAL DEFAULT 0.0,
                arrangement_factor_pct REAL DEFAULT 0.0,
                break_even_impact TEXT DEFAULT '',
                FOREIGN KEY (trip_id) REFERENCES trips (trip_id) ON DELETE CASCADE,
                FOREIGN KEY (seat_id) REFERENCES trip_seats (seat_id) ON DELETE CASCADE
            );
        """)

        # 10. Competitor fare history table (Historical tracking over time)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS competitor_fare_history (
                history_id TEXT PRIMARY KEY,
                competitor_fare_id TEXT,
                trip_id TEXT,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
                route_name TEXT,
                departure_time TEXT NOT NULL,
                bus_type TEXT NOT NULL,
                operator_name TEXT NOT NULL,
                platform TEXT NOT NULL,
                fare REAL NOT NULL,
                additional_fees REAL DEFAULT 0.0,
                seat_type TEXT DEFAULT 'sleeper',
                berth_type TEXT DEFAULT 'lower',
                sleeper_arrangement TEXT DEFAULT 'single',
                is_comparable INTEGER DEFAULT 1,
                incomparability_reason TEXT DEFAULT '',
                captured_at TEXT NOT NULL,
                freshness_status TEXT DEFAULT 'fresh',
                data_source_label TEXT DEFAULT 'Synthetic competitor observation history'
            );
        """)

        # 11. Operational alerts table (Alert management, deduplication, resolution)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operational_alerts (
                alert_id TEXT PRIMARY KEY,
                trip_id TEXT NOT NULL,
                seat_id TEXT,
                severity TEXT NOT NULL, -- 'CRITICAL', 'WARNING', 'INFO'
                alert_type TEXT NOT NULL, -- 'LOW_OCCUPANCY', 'PROJECTED_LOSS', 'UNUSUAL_VELOCITY', 'COMPETITOR_SHIFT', 'STALE_COMPETITOR', 'INSUFFICIENT_DATA', 'LIMIT_EXCEEDED', 'UNPROFITABLE_DISCOUNT', 'PENDING_APPROVAL', 'MISSING_EXPENSES'
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'
                created_at TEXT NOT NULL,
                acknowledged_at TEXT,
                acknowledged_by TEXT,
                resolved_at TEXT,
                resolved_by TEXT,
                FOREIGN KEY (trip_id) REFERENCES trips (trip_id) ON DELETE CASCADE
            );
        """)

        # 12. Recommendation snapshots table (Performance tracking & forecast vs actual)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recommendation_snapshots (
                snapshot_id TEXT PRIMARY KEY,
                recommendation_id TEXT NOT NULL,
                trip_id TEXT NOT NULL,
                seat_id TEXT,
                seat_number TEXT,
                category_key TEXT,
                current_fare REAL NOT NULL,
                proposed_fare REAL NOT NULL,
                forecast_bookings INTEGER,
                forecast_occupancy_pct REAL,
                forecast_revenue REAL,
                forecast_expenses REAL,
                forecast_profit REAL,
                scenario_assumptions TEXT, -- JSON string
                confidence_score TEXT,
                created_at TEXT NOT NULL,
                decision_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'OVERRIDDEN', 'EXPIRED'
                applied_fare REAL,
                effective_at TEXT,
                decision_reason TEXT,
                actor_label TEXT,
                is_trip_completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                actual_bookings INTEGER,
                actual_occupancy_pct REAL,
                actual_revenue REAL,
                actual_refunds_discounts REAL DEFAULT 0.0,
                actual_expenses REAL,
                actual_profit REAL,
                forecast_error_revenue REAL,
                forecast_error_occupancy REAL,
                forecast_error_pct REAL,
                FOREIGN KEY (trip_id) REFERENCES trips (trip_id) ON DELETE CASCADE
            );
        """)

        # Schema migrations for existing databases
        migrations = [
            ("trips", "scheduled_arrival_time", "TEXT"),
            ("trips", "estimated_duration_hours", "REAL"),
            ("trips", "expected_arrival_time", "TEXT"),
            ("trips", "actual_arrival_time", "TEXT"),
            ("trips", "stop_count", "INTEGER DEFAULT 2"),
            ("trips", "service_category", "TEXT DEFAULT 'regular'"),
            ("trips", "arrival_convenience_label", "TEXT"),
            ("trips", "average_rating", "REAL DEFAULT 4.2"),
            ("trips", "review_count", "INTEGER DEFAULT 1200"),
            ("trips", "rating_source", "TEXT DEFAULT 'Consolidated (RedBus & AbhiBus)'"),
            ("trips", "rating_updated_at", "TEXT"),
            ("trips", "amenities", "TEXT DEFAULT '[]'"),
            ("trips", "on_time_performance_pct", "REAL DEFAULT 92.0"),
            ("trips", "cancellation_rate_pct", "REAL DEFAULT 1.5"),
            ("trips", "service_quality_score", "REAL DEFAULT 4.3"),
            ("trip_seats", "sleeper_arrangement", "TEXT NOT NULL DEFAULT 'none'"),
            ("trip_seats", "max_occupants", "INTEGER NOT NULL DEFAULT 1"),
            ("trip_seats", "privacy_level", "TEXT NOT NULL DEFAULT 'standard'"),
            ("trip_seats", "is_ac", "INTEGER NOT NULL DEFAULT 1"),
            ("trip_seats", "bus_category", "TEXT NOT NULL DEFAULT 'Sleeper'"),
            ("competitor_fares", "journey_duration_hours", "REAL"),
            ("competitor_fares", "scheduled_arrival_time", "TEXT"),
            ("competitor_fares", "service_category", "TEXT DEFAULT 'regular'"),
            ("competitor_fares", "seat_type", "TEXT DEFAULT 'sleeper'"),
            ("competitor_fares", "berth_type", "TEXT DEFAULT 'lower'"),
            ("competitor_fares", "sleeper_arrangement", "TEXT DEFAULT 'single'"),
            ("competitor_fares", "seat_position", "TEXT DEFAULT 'middle'"),
            ("competitor_fares", "additional_fees", "REAL DEFAULT 0.0"),
            ("competitor_fares", "comparability_notes", "TEXT"),
            ("recommendations", "evidence_quality_status", "TEXT NOT NULL DEFAULT 'Strong data'"),
            ("recommendations", "evidence_quality_details", "TEXT NOT NULL DEFAULT '{}'"),
            ("recommendations", "recommended_action", "TEXT NOT NULL DEFAULT 'Maintain fare'"),
            ("recommendations", "competitor_summary", "TEXT NOT NULL DEFAULT '{}'"),
            ("seat_recommendations", "timing_factor_pct", "REAL DEFAULT 0.0"),
            ("seat_recommendations", "quality_factor_pct", "REAL DEFAULT 0.0"),
            ("seat_recommendations", "arrangement_factor_pct", "REAL DEFAULT 0.0"),
            ("seat_recommendations", "break_even_impact", "TEXT DEFAULT ''"),
        ]
        for tbl, col, col_def in migrations:
            try:
                cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_def}")
            except sqlite3.OperationalError:
                pass

        conn.commit()


def reset_and_seed_database() -> None:
    """Drops and re-populates tables with seed data."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS recommendation_snapshots;")
        cursor.execute("DROP TABLE IF EXISTS operational_alerts;")
        cursor.execute("DROP TABLE IF EXISTS competitor_fare_history;")
        cursor.execute("DROP TABLE IF EXISTS seat_recommendations;")
        cursor.execute("DROP TABLE IF EXISTS trip_seats;")
        cursor.execute("DROP TABLE IF EXISTS trip_expenses;")
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

