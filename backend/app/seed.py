"""FleetYield AI - Synthetic Seed Dataset Generator.

Generates 11 varied synthetic trips and booking snapshots according to PRD section 5.2.
Explicitly labels all records as synthetic demo data and includes test fixtures.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from app.db import get_connection

def generate_seed_trips() -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    
    # Helper to generate departure times relative to now
    def dep_time(hours_ahead: int) -> str:
        return (now + timedelta(hours=hours_ahead)).strftime("%Y-%m-%dT%H:%M:%SZ")

    def updated_time(hours_ago: int) -> str:
        return (now - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")

    trips = [
        {
            "trip_id": "TRIP-BLR-HYD-101",
            "route_name": "Bengaluru to Hyderabad Express",
            "origin": "Bengaluru",
            "destination": "Hyderabad",
            "departure_time": dep_time(14),
            "total_seats": 40,
            "booked_seats": 10,  # 25% -> Low Demand
            "base_fare": 900.0,
            "current_fare": 900.0,
            "min_fare": 700.0,
            "max_fare": 1200.0,
            "data_updated_at": updated_time(2),
            "data_source_label": "Synthetic demo data",
            "bus_type": "Multi-Axle AC Sleeper",
            "route_distance_km": 570.0,
            "operator_notes": "Early morning intercity route. Steady weekend booking curve expected."
        },
        {
            "trip_id": "TRIP-HYD-VJA-202",
            "route_name": "Hyderabad to Vijayawada Highway Liner",
            "origin": "Hyderabad",
            "destination": "Vijayawada",
            "departure_time": dep_time(8),
            "total_seats": 40,
            "booked_seats": 22,  # 55% -> Medium Demand
            "base_fare": 650.0,
            "current_fare": 650.0,
            "min_fare": 500.0,
            "max_fare": 900.0,
            "data_updated_at": updated_time(1),
            "data_source_label": "Synthetic demo data",
            "bus_type": "AC Seater 2+2",
            "route_distance_km": 275.0,
            "operator_notes": "Regular corridor trip. Balanced demand pattern."
        },
        {
            "trip_id": "TRIP-MAA-BLR-303",
            "route_name": "Chennai to Bengaluru Tech Shuttle",
            "origin": "Chennai",
            "destination": "Bengaluru",
            "departure_time": dep_time(6),
            "total_seats": 40,
            "booked_seats": 34,  # 85% -> High Demand
            "base_fare": 750.0,
            "current_fare": 750.0,
            "min_fare": 600.0,
            "max_fare": 1100.0,
            "data_updated_at": updated_time(1),
            "data_source_label": "Synthetic demo data",
            "bus_type": "Volvo AC Semi-Sleeper",
            "route_distance_km": 350.0,
            "operator_notes": "Heavy commuter route. Approaching full capacity."
        },
        {
            "trip_id": "TRIP-MUM-PUN-404",
            "route_name": "Mumbai to Pune Expressway Direct",
            "origin": "Mumbai",
            "destination": "Pune",
            "departure_time": dep_time(4),
            "total_seats": 36,
            "booked_seats": 28,  # 77.8% -> High Demand, 3 snapshots
            "base_fare": 450.0,
            "current_fare": 450.0,
            "min_fare": 350.0,
            "max_fare": 700.0,
            "data_updated_at": updated_time(1),
            "data_source_label": "Synthetic demo data",
            "bus_type": "Mercedes AC 2+2",
            "route_distance_km": 150.0,
            "operator_notes": "Equipped with timestamped booking snapshot history."
        },
        {
            "trip_id": "TRIP-DEL-JAI-505",
            "route_name": "Delhi to Jaipur Heritage Express",
            "origin": "Delhi",
            "destination": "Jaipur",
            "departure_time": dep_time(18),
            "total_seats": 45,
            "booked_seats": 8,   # 17.8% -> Low Demand, 2 snapshots
            "base_fare": 550.0,
            "current_fare": 550.0,
            "min_fare": 400.0,
            "max_fare": 800.0,
            "data_updated_at": updated_time(3),
            "data_source_label": "Synthetic demo data",
            "bus_type": "Scania AC Seater",
            "route_distance_km": 280.0,
            "operator_notes": "Mid-week departure. Sluggish early pickup."
        },
        {
            "trip_id": "TRIP-COK-BLR-606",
            "route_name": "Kochi to Bengaluru Night Cruiser",
            "origin": "Kochi",
            "destination": "Bengaluru",
            "departure_time": dep_time(22),
            "total_seats": 32,
            "booked_seats": 16,  # 50% -> Medium Demand
            "base_fare": 1100.0,
            "current_fare": 1100.0,
            "min_fare": 900.0,
            "max_fare": 1500.0,
            "data_updated_at": updated_time(4),
            "data_source_label": "Synthetic demo data",
            "bus_type": "AC Sleeper 2+1",
            "route_distance_km": 540.0,
            "operator_notes": "Long-distance overnight service."
        },
        {
            "trip_id": "TRIP-PUN-GOA-707",
            "route_name": "Pune to Goa Coastal Breeze",
            "origin": "Pune",
            "destination": "Goa",
            "departure_time": dep_time(10),
            "total_seats": 30,
            "booked_seats": 27,  # 90% -> High Demand
            "base_fare": 1200.0,
            "current_fare": 1200.0,
            "min_fare": 950.0,
            "max_fare": 1800.0,
            "data_updated_at": updated_time(2),
            "data_source_label": "Synthetic demo data",
            "bus_type": "Luxury Sleeper",
            "route_distance_km": 460.0,
            "operator_notes": "Popular leisure corridor near sell-out."
        },
        {
            "trip_id": "TRIP-KOL-DGH-808",
            "route_name": "Kolkata to Digha Beach Shuttle",
            "origin": "Kolkata",
            "destination": "Digha",
            "departure_time": dep_time(16),
            "total_seats": 42,
            "booked_seats": 12,  # 28.6% -> Low Demand
            "base_fare": 400.0,
            "current_fare": 400.0,
            "min_fare": 300.0,
            "max_fare": 600.0,
            "data_updated_at": updated_time(2),
            "data_source_label": "Synthetic demo data",
            "bus_type": "Non-AC Deluxe",
            "route_distance_km": 185.0,
            "operator_notes": "Short excursion route with seasonal swings."
        },
        {
            "trip_id": "TRIP-CLAMP-850",
            "route_name": "Chennai to Madurai Sunrise",
            "origin": "Chennai",
            "destination": "Madurai",
            "departure_time": dep_time(12),
            "total_seats": 40,
            "booked_seats": 6,   # 15% -> Low Demand (-10% of 620 = 558, clamped to min 600)
            "base_fare": 620.0,
            "current_fare": 620.0,
            "min_fare": 600.0,   # High min fare will trigger clamping
            "max_fare": 900.0,
            "data_updated_at": updated_time(1),
            "data_source_label": "Synthetic demo data",
            "bus_type": "AC Seater",
            "route_distance_km": 460.0,
            "operator_notes": "Demonstrates fare floor limit clamping."
        },
        {
            "trip_id": "TRIP-STALE-901",
            "route_name": "Bengaluru to Mangaluru Ghat Pass",
            "origin": "Bengaluru",
            "destination": "Mangaluru",
            "departure_time": dep_time(20),
            "total_seats": 40,
            "booked_seats": 18,  # 45% -> Stale test fixture
            "base_fare": 700.0,
            "current_fare": 700.0,
            "min_fare": 550.0,
            "max_fare": 950.0,
            "data_updated_at": updated_time(38),  # 38 hours ago > 24h threshold
            "data_source_label": "Synthetic demo data (STALE FIXTURE)",
            "bus_type": "Multi-Axle AC Semi-Sleeper",
            "route_distance_km": 350.0,
            "operator_notes": "Intentional stale-data test fixture to demonstrate freshness validation warnings."
        },
        {
            "trip_id": "TRIP-INVALID-902",
            "route_name": "Hyderabad to Tirupati Pilgrim Link",
            "origin": "Hyderabad",
            "destination": "Tirupati",
            "departure_time": dep_time(24),
            "total_seats": 40,
            "booked_seats": 48,  # 48 > 40: INVALID FIXTURE
            "base_fare": 850.0,
            "current_fare": 850.0,
            "min_fare": 650.0,
            "max_fare": 1200.0,
            "data_updated_at": updated_time(2),
            "data_source_label": "Synthetic demo data (INVALID FIXTURE)",
            "bus_type": "AC Sleeper",
            "route_distance_km": 560.0,
            "operator_notes": "Intentional invalid-data test fixture: booked seats exceeds capacity. Blocks recommendation."
        }
    ]
    return trips


def generate_seed_snapshots() -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    
    def snap_time(hours_ago: int) -> str:
        return (now - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")

    snapshots = [
        # Trip MUM-PUN-404: 3 snapshots showing booking progression
        {
            "snapshot_id": "SNAP-404-01",
            "trip_id": "TRIP-MUM-PUN-404",
            "captured_at": snap_time(12),
            "booked_seats": 18,
            "source_label": "Synthetic demo data"
        },
        {
            "snapshot_id": "SNAP-404-02",
            "trip_id": "TRIP-MUM-PUN-404",
            "captured_at": snap_time(6),
            "booked_seats": 24,
            "source_label": "Synthetic demo data"
        },
        {
            "snapshot_id": "SNAP-404-03",
            "trip_id": "TRIP-MUM-PUN-404",
            "captured_at": snap_time(1),
            "booked_seats": 28,
            "source_label": "Synthetic demo data"
        },
        # Trip DEL-JAI-505: 2 snapshots
        {
            "snapshot_id": "SNAP-505-01",
            "trip_id": "TRIP-DEL-JAI-505",
            "captured_at": snap_time(8),
            "booked_seats": 6,
            "source_label": "Synthetic demo data"
        },
        {
            "snapshot_id": "SNAP-505-02",
            "trip_id": "TRIP-DEL-JAI-505",
            "captured_at": snap_time(2),
            "booked_seats": 8,
            "source_label": "Synthetic demo data"
        }
    ]
    return snapshots


def seed_data() -> None:
    """Inserts seed trips and snapshots into SQLite."""
    trips = generate_seed_trips()
    snapshots = generate_seed_snapshots()

    with get_connection() as conn:
        cursor = conn.cursor()
        for t in trips:
            cursor.execute("""
                INSERT OR REPLACE INTO trips (
                    trip_id, route_name, origin, destination, departure_time,
                    total_seats, booked_seats, base_fare, current_fare,
                    min_fare, max_fare, data_updated_at, data_source_label,
                    bus_type, route_distance_km, operator_notes
                ) VALUES (
                    :trip_id, :route_name, :origin, :destination, :departure_time,
                    :total_seats, :booked_seats, :base_fare, :current_fare,
                    :min_fare, :max_fare, :data_updated_at, :data_source_label,
                    :bus_type, :route_distance_km, :operator_notes
                );
            """, t)

        for s in snapshots:
            cursor.execute("""
                INSERT OR REPLACE INTO booking_snapshots (
                    snapshot_id, trip_id, captured_at, booked_seats, source_label
                ) VALUES (
                    :snapshot_id, :trip_id, :captured_at, :booked_seats, :source_label
                );
            """, s)

        # Record system initialization in audit log
        cursor.execute("""
            INSERT INTO audit_events (
                audit_id, trip_id, event_type, previous_fare, recommended_fare,
                final_decision_fare, reason, details, created_at, rule_version,
                data_source_label, actor_label
            ) VALUES (
                'AUD-SYSTEM-INIT', 'SYSTEM', 'SYSTEM_INITIALIZED', NULL, NULL,
                NULL, 'Synthetic seed dataset populated', '11 trips seeded',
                datetime('now'), 'v1.0-deterministic-rule', 'Synthetic demo data', 'System'
            );
        """)

        conn.commit()


if __name__ == "__main__":
    from app.db import init_db
    init_db()
    seed_data()
    print("Database initialized and seeded successfully.")
