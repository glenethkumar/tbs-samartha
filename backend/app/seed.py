"""FleetYield AI - Synthetic Seed Dataset Generator.

Generates 11 varied synthetic trips and booking snapshots according to PRD section 5.2.
Explicitly labels all records as synthetic demo data and includes test fixtures.
"""

import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from app.db import get_connection


def generate_seed_trips() -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    
    # Helper to generate departure times relative to now
    def dep_time(hours_ahead: int) -> str:
        return (now + timedelta(hours=hours_ahead)).strftime("%Y-%m-%dT%H:%M:%SZ")

    def arr_time(hours_ahead: int, duration_hours: float) -> str:
        return (now + timedelta(hours=hours_ahead + duration_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")

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
            "operator_notes": "Early morning intercity route. Steady weekend booking curve expected.",
            "scheduled_arrival_time": arr_time(14, 8.5),
            "estimated_duration_hours": 8.5,
            "expected_arrival_time": arr_time(14, 8.5),
            "actual_arrival_time": None,
            "stop_count": 2,
            "service_category": "express",
            "arrival_convenience_label": "Convenient Morning (06:30)",
            "average_rating": 4.5,
            "review_count": 1450,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(12),
            "amenities": '["AC", "WiFi", "USB Charging", "Reading Light", "Blanket", "Water Bottle"]',
            "on_time_performance_pct": 94.2,
            "cancellation_rate_pct": 0.8,
            "service_quality_score": 4.6
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
            "operator_notes": "Regular corridor trip. Balanced demand pattern.",
            "scheduled_arrival_time": arr_time(8, 5.0),
            "estimated_duration_hours": 5.0,
            "expected_arrival_time": arr_time(8, 5.0),
            "actual_arrival_time": None,
            "stop_count": 4,
            "service_category": "limited_stop",
            "arrival_convenience_label": "Afternoon Arrival (14:30)",
            "average_rating": 4.1,
            "review_count": 920,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(24),
            "amenities": '["AC", "USB Charging", "Water Bottle"]',
            "on_time_performance_pct": 90.5,
            "cancellation_rate_pct": 1.8,
            "service_quality_score": 4.1
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
            "operator_notes": "Heavy commuter route. Approaching full capacity.",
            "scheduled_arrival_time": arr_time(6, 6.0),
            "estimated_duration_hours": 6.0,
            "expected_arrival_time": arr_time(6, 6.0),
            "actual_arrival_time": None,
            "stop_count": 2,
            "service_category": "express",
            "arrival_convenience_label": "Evening Prime (19:30)",
            "average_rating": 4.6,
            "review_count": 2100,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(6),
            "amenities": '["AC", "WiFi", "Charging Port", "Water Bottle"]',
            "on_time_performance_pct": 96.0,
            "cancellation_rate_pct": 0.5,
            "service_quality_score": 4.7
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
            "operator_notes": "Equipped with timestamped booking snapshot history.",
            "scheduled_arrival_time": arr_time(4, 3.5),
            "estimated_duration_hours": 3.5,
            "expected_arrival_time": arr_time(4, 3.5),
            "actual_arrival_time": None,
            "stop_count": 1,
            "service_category": "express",
            "arrival_convenience_label": "Midday Arrival (12:00)",
            "average_rating": 4.4,
            "review_count": 1680,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(10),
            "amenities": '["AC", "Live Tracking", "WiFi"]',
            "on_time_performance_pct": 95.0,
            "cancellation_rate_pct": 0.6,
            "service_quality_score": 4.5
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
            "operator_notes": "Mid-week departure. Sluggish early pickup.",
            "scheduled_arrival_time": arr_time(18, 5.5),
            "estimated_duration_hours": 5.5,
            "expected_arrival_time": arr_time(18, 5.5),
            "actual_arrival_time": None,
            "stop_count": 3,
            "service_category": "regular",
            "arrival_convenience_label": "Night Arrival (22:30)",
            "average_rating": 4.0,
            "review_count": 620,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(18),
            "amenities": '["AC", "Charging Port"]',
            "on_time_performance_pct": 88.0,
            "cancellation_rate_pct": 2.5,
            "service_quality_score": 3.9
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
            "operator_notes": "Long-distance overnight service.",
            "scheduled_arrival_time": arr_time(22, 9.5),
            "estimated_duration_hours": 9.5,
            "expected_arrival_time": arr_time(22, 9.5),
            "actual_arrival_time": None,
            "stop_count": 3,
            "service_category": "express",
            "arrival_convenience_label": "Morning Arrival (07:00)",
            "average_rating": 4.3,
            "review_count": 1180,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(8),
            "amenities": '["AC", "Blanket", "Pillow", "Charging Port", "Water Bottle"]',
            "on_time_performance_pct": 92.5,
            "cancellation_rate_pct": 1.2,
            "service_quality_score": 4.3
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
            "operator_notes": "Popular leisure corridor near sell-out.",
            "scheduled_arrival_time": arr_time(10, 9.0),
            "estimated_duration_hours": 9.0,
            "expected_arrival_time": arr_time(10, 9.0),
            "actual_arrival_time": None,
            "stop_count": 2,
            "service_category": "express",
            "arrival_convenience_label": "Morning Coastal Arrival (07:30)",
            "average_rating": 4.7,
            "review_count": 1890,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(4),
            "amenities": '["AC", "WiFi", "Blanket", "Snack Box", "Charging Port", "Reading Light"]',
            "on_time_performance_pct": 97.0,
            "cancellation_rate_pct": 0.4,
            "service_quality_score": 4.8
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
            "operator_notes": "Short excursion route with seasonal swings.",
            "scheduled_arrival_time": arr_time(16, 4.5),
            "estimated_duration_hours": 4.5,
            "expected_arrival_time": arr_time(16, 4.5),
            "actual_arrival_time": None,
            "stop_count": 6,
            "service_category": "regular",
            "arrival_convenience_label": "Evening Arrival (18:00)",
            "average_rating": 3.7,
            "review_count": 410,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(30),
            "amenities": '["Comfort Seats", "Luggage Rack"]',
            "on_time_performance_pct": 84.0,
            "cancellation_rate_pct": 3.2,
            "service_quality_score": 3.6
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
            "operator_notes": "Demonstrates fare floor limit clamping.",
            "scheduled_arrival_time": arr_time(12, 7.5),
            "estimated_duration_hours": 7.5,
            "expected_arrival_time": arr_time(12, 7.5),
            "actual_arrival_time": None,
            "stop_count": 4,
            "service_category": "limited_stop",
            "arrival_convenience_label": "Afternoon Arrival (15:00)",
            "average_rating": 4.2,
            "review_count": 840,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(14),
            "amenities": '["AC", "Charging Port", "Water Bottle"]',
            "on_time_performance_pct": 91.0,
            "cancellation_rate_pct": 1.4,
            "service_quality_score": 4.2
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
            "operator_notes": "Intentional stale-data test fixture to demonstrate freshness validation warnings.",
            "scheduled_arrival_time": arr_time(20, 7.0),
            "estimated_duration_hours": 7.0,
            "expected_arrival_time": arr_time(20, 7.0),
            "actual_arrival_time": None,
            "stop_count": 4,
            "service_category": "regular",
            "arrival_convenience_label": "Late Night (01:00)",
            "average_rating": 3.9,
            "review_count": 320,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(48),
            "amenities": '["AC", "Charging Port"]',
            "on_time_performance_pct": 86.0,
            "cancellation_rate_pct": 2.1,
            "service_quality_score": 3.8
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
            "operator_notes": "Intentional invalid-data test fixture: booked seats exceeds capacity. Blocks recommendation.",
            "scheduled_arrival_time": arr_time(24, 10.0),
            "estimated_duration_hours": 10.0,
            "expected_arrival_time": arr_time(24, 10.0),
            "actual_arrival_time": None,
            "stop_count": 5,
            "service_category": "regular",
            "arrival_convenience_label": "Morning Arrival (08:00)",
            "average_rating": 4.0,
            "review_count": 510,
            "rating_source": "Consolidated (RedBus & AbhiBus)",
            "rating_updated_at": updated_time(20),
            "amenities": '["AC", "Blanket"]',
            "on_time_performance_pct": 89.0,
            "cancellation_rate_pct": 1.9,
            "service_quality_score": 4.0
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


def generate_trip_seats(trip: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generates realistic seat inventory with configurable bus layouts.
    Supports overlapping attributes:
    - position: front, middle, back
    - seat_type: sitting, sleeper, semi-sleeper
    - berth_type: lower, upper, none
    - deck: lower, upper
    - booking_status: available, booked
    """
    now = datetime.now(timezone.utc)
    trip_id = trip["trip_id"]
    bus_type = trip.get("bus_type", "AC Seater")
    total_seats = int(trip["total_seats"])
    booked_count = min(total_seats, int(trip["booked_seats"]))
    base_fare = float(trip["base_fare"])
    current_fare = float(trip["current_fare"])
    min_fare = float(trip["min_fare"])
    max_fare = float(trip["max_fare"])

    is_sleeper = "Sleeper" in bus_type and "Semi" not in bus_type
    is_semi = "Semi-Sleeper" in bus_type

    all_seats = []

    if is_sleeper:
        # Multi-deck sleeper: Lower & Upper decks (2+1 layout per deck)
        half = total_seats // 2
        decks = [
            ("lower", "lower", half, "L"),
            ("upper", "upper", total_seats - half, "U")
        ]

        for deck_name, berth_pos, deck_seat_count, prefix in decks:
            # 3 berths per row (col 1: Single private sleeper window, col 3: Double sharing aisle, col 4: Double sharing window)
            cols_map = [1, 3, 4]
            num_rows = (deck_seat_count + 2) // 3
            seat_counter = 1

            for r in range(1, num_rows + 1):
                # Classify position
                if r <= 2:
                    pos = "front"
                elif r >= num_rows - 1:
                    pos = "back"
                else:
                    pos = "middle"

                for c in cols_map:
                    if seat_counter > deck_seat_count:
                        break
                    seat_num = f"{prefix}{seat_counter}"
                    seat_id = f"{trip_id}-{seat_num}"

                    # Distinct Single vs Sharing Sleeper pricing & privacy attributes
                    if c == 1:
                        arrangement = "single"
                        max_occ = 1
                        privacy = "private"
                        arrangement_mult = 1.08  # Single private sleeper premium
                    else:
                        arrangement = "sharing"
                        max_occ = 2
                        privacy = "semi_private"
                        arrangement_mult = 0.98  # Sharing sleeper baseline

                    berth_mult = 1.04 if berth_pos == "lower" else 0.96
                    total_mult = berth_mult * arrangement_mult

                    seat_base = round((base_fare * total_mult) / 10.0) * 10.0
                    seat_curr = round((current_fare * total_mult) / 10.0) * 10.0
                    seat_min = round((min_fare * total_mult) / 10.0) * 10.0
                    seat_max = round((max_fare * total_mult) / 10.0) * 10.0

                    all_seats.append({
                        "seat_id": seat_id,
                        "trip_id": trip_id,
                        "seat_number": seat_num,
                        "deck": deck_name,
                        "row_idx": r,
                        "col_idx": c,
                        "position": pos,
                        "seat_type": "sleeper",
                        "berth_type": berth_pos,
                        "sleeper_arrangement": arrangement,
                        "max_occupants": max_occ,
                        "privacy_level": privacy,
                        "is_ac": 1 if "AC" in bus_type else 0,
                        "bus_category": bus_type,
                        "base_fare": float(seat_base),
                        "current_fare": float(seat_curr),
                        "min_fare": float(seat_min),
                        "max_fare": float(seat_max),
                        "booking_status": "available",
                        "booked_at": None,
                        "collected_fare": None,
                        "passenger_gender": None,
                        # Preference score: private single lower > sharing lower > upper
                        "pref_score": (12 if (berth_pos == "lower" and arrangement == "single") else (10 if berth_pos == "lower" else 4)) + (5 if pos == "front" else (3 if pos == "middle" else 0))
                    })
                    seat_counter += 1

    else:
        # Single-deck Seater / Semi-Sleeper (2+2 layout: cols 1, 2 aisle 3, 4)
        cols_map = [1, 2, 3, 4]
        num_rows = (total_seats + 3) // 4
        seat_counter = 1
        stype = "semi-sleeper" if is_semi else "sitting"
        col_letters = {1: "A", 2: "B", 3: "C", 4: "D"}

        for r in range(1, num_rows + 1):
            if r <= 3:
                pos = "front"
            elif r >= num_rows - 2:
                pos = "back"
            else:
                pos = "middle"

            for c in cols_map:
                if seat_counter > total_seats:
                    break
                seat_num = f"{r}{col_letters[c]}"
                seat_id = f"{trip_id}-{seat_num}"

                # Front seats have slight preference/premium
                pos_mult = 1.03 if pos == "front" else (0.97 if pos == "back" else 1.0)
                seat_base = round((base_fare * pos_mult) / 10.0) * 10.0
                seat_curr = round((current_fare * pos_mult) / 10.0) * 10.0
                seat_min = round((min_fare * pos_mult) / 10.0) * 10.0
                seat_max = round((max_fare * pos_mult) / 10.0) * 10.0

                all_seats.append({
                    "seat_id": seat_id,
                    "trip_id": trip_id,
                    "seat_number": seat_num,
                    "deck": "lower",
                    "row_idx": r,
                    "col_idx": c,
                    "position": pos,
                    "seat_type": stype,
                    "berth_type": "none",
                    "sleeper_arrangement": "none",
                    "max_occupants": 1,
                    "privacy_level": "standard",
                    "is_ac": 1 if "AC" in bus_type else 0,
                    "bus_category": bus_type,
                    "base_fare": float(seat_base),
                    "current_fare": float(seat_curr),
                    "min_fare": float(seat_min),
                    "max_fare": float(seat_max),
                    "booking_status": "available",
                    "booked_at": None,
                    "collected_fare": None,
                    "passenger_gender": None,
                    # Preference score: window seats (1, 4) and front rows book first
                    "pref_score": (6 if pos == "front" else (4 if pos == "middle" else 1)) + (3 if c in (1, 4) else 1)
                })
                seat_counter += 1

    # Deterministically book exactly booked_count seats based on preference score
    # Higher preference seats book first, with slight determinism from trip_id
    hash_seed = sum(ord(ch) for ch in trip_id)
    sorted_by_pref = sorted(all_seats, key=lambda s: (-s["pref_score"], (hash_seed + s["row_idx"] * 7 + s["col_idx"]) % 13))

    genders = ["Female", "Male", "Male", "Female", "Male"]
    for i in range(booked_count):
        seat = sorted_by_pref[i]
        hours_ago = max(1.0, float(booked_count - i) * 1.5)
        b_time = (now - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")
        seat["booking_status"] = "booked"
        seat["booked_at"] = b_time
        seat["collected_fare"] = seat["current_fare"]
        seat["passenger_gender"] = genders[i % len(genders)]

    # Clean up temporary key
    for s in all_seats:
        s.pop("pref_score", None)

    return all_seats


def generate_trip_expenses(trip: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes authentic operating expense allocation for an intercity bus trip.
    Covers fuel, driver/conductor wages, tolls, commissions, maintenance, permits, and taxes.
    """
    dist = float(trip.get("route_distance_km") or 350.0)
    bus_type = trip.get("bus_type", "AC Seater")
    is_sleeper = "Sleeper" in bus_type

    # Fuel consumption (~₹26.5/km for multi-axle AC, ~₹24/km for standard AC)
    fuel_rate = 27.0 if is_sleeper else 24.5
    fuel_cost = round((dist * fuel_rate) / 50.0) * 50.0

    # Crew wages (2 drivers for trips > 300km, 1 conductor/attendant)
    driver_wages = 2800.0 if dist > 350.0 else 2200.0
    conductor_wages = 950.0

    # Toll charges (NHAI corridors average ~₹3.2/km)
    toll_charges = round((dist * 3.2) / 50.0) * 50.0

    # Maintenance amortized allocation (tyre wear, engine lube, brake liners: ~₹3.5/km)
    maintenance = round((dist * 3.5) / 50.0) * 50.0

    # Interstate road permits & passenger tax allocation
    permits = 1600.0 if dist > 400.0 else 1200.0

    # Ancillary trip costs (terminal parking, cleaning, bedrolls/water)
    other = 850.0 if is_sleeper else 550.0

    return {
        "trip_id": trip["trip_id"],
        "fuel_cost": float(fuel_cost),
        "driver_wages": float(driver_wages),
        "conductor_wages": float(conductor_wages),
        "toll_charges": float(toll_charges),
        "platform_commission_pct": 8.0,
        "maintenance_allocation": float(maintenance),
        "permits_and_taxes": float(permits),
        "other_costs": float(other),
        "is_estimated": 1,
        "notes": f"Standard fleet operational model for {bus_type} on {dist} km corridor."
    }


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
                    bus_type, route_distance_km, operator_notes,
                    scheduled_arrival_time, estimated_duration_hours,
                    expected_arrival_time, actual_arrival_time, stop_count,
                    service_category, arrival_convenience_label, average_rating,
                    review_count, rating_source, rating_updated_at, amenities,
                    on_time_performance_pct, cancellation_rate_pct, service_quality_score
                ) VALUES (
                    :trip_id, :route_name, :origin, :destination, :departure_time,
                    :total_seats, :booked_seats, :base_fare, :current_fare,
                    :min_fare, :max_fare, :data_updated_at, :data_source_label,
                    :bus_type, :route_distance_km, :operator_notes,
                    :scheduled_arrival_time, :estimated_duration_hours,
                    :expected_arrival_time, :actual_arrival_time, :stop_count,
                    :service_category, :arrival_convenience_label, :average_rating,
                    :review_count, :rating_source, :rating_updated_at, :amenities,
                    :on_time_performance_pct, :cancellation_rate_pct, :service_quality_score
                );
            """, t)

            # Seed realistic seats with bus layouts
            seats = generate_trip_seats(t)
            for s in seats:
                cursor.execute("""
                    INSERT OR REPLACE INTO trip_seats (
                        seat_id, trip_id, seat_number, deck, row_idx, col_idx,
                        position, seat_type, berth_type, sleeper_arrangement,
                        max_occupants, privacy_level, is_ac, bus_category,
                        base_fare, current_fare, min_fare, max_fare, booking_status,
                        booked_at, collected_fare, passenger_gender
                    ) VALUES (
                        :seat_id, :trip_id, :seat_number, :deck, :row_idx, :col_idx,
                        :position, :seat_type, :berth_type, :sleeper_arrangement,
                        :max_occupants, :privacy_level, :is_ac, :bus_category,
                        :base_fare, :current_fare, :min_fare, :max_fare, :booking_status,
                        :booked_at, :collected_fare, :passenger_gender
                    );
                """, s)

            # Seed realistic operating expense allocations
            expenses = generate_trip_expenses(t)
            cursor.execute("""
                INSERT OR REPLACE INTO trip_expenses (
                    trip_id, fuel_cost, driver_wages, conductor_wages, toll_charges,
                    platform_commission_pct, maintenance_allocation, permits_and_taxes,
                    other_costs, is_estimated, notes
                ) VALUES (
                    :trip_id, :fuel_cost, :driver_wages, :conductor_wages, :toll_charges,
                    :platform_commission_pct, :maintenance_allocation, :permits_and_taxes,
                    :other_costs, :is_estimated, :notes
                );
            """, expenses)

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
            INSERT OR REPLACE INTO audit_events (
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

    # Seed realistic competitor benchmarks (RedBus & AbhiBus)
    from app.services.competitor_service import CompetitorService
    comp_count = CompetitorService.seed_sample_competitors()
    print(f"Seeded {comp_count} competitor benchmarks across routes.")

    # Seed historical recommendation performance snapshots (Feature 6)
    with get_connection() as conn:
        cursor = conn.cursor()
        now_dt = datetime.now(timezone.utc)
        completed_snapshots = [
            {
                "snapshot_id": "SNAP-HIST-01",
                "recommendation_id": "REC-HIST-01",
                "trip_id": "TRIP-MUM-PUN-404",
                "seat_id": "SEAT-404-L-01",
                "seat_number": "L1",
                "category_key": "single_lower_sleeper",
                "current_fare": 450.0,
                "proposed_fare": 500.0,
                "forecast_bookings": 1,
                "forecast_occupancy_pct": 78.0,
                "forecast_revenue": 17200.0,
                "forecast_expenses": 11500.0,
                "forecast_profit": 5700.0,
                "scenario_assumptions": json.dumps(["Demand elasticity -0.5", "Base conversion 0.85"]),
                "confidence_score": "High",
                "created_at": (now_dt - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "decision_status": "APPROVED",
                "applied_fare": 500.0,
                "effective_at": (now_dt - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "decision_reason": "Approved system dynamic recommendation",
                "actor_label": "Demo operator",
                "is_trip_completed": 1,
                "completed_at": (now_dt - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "actual_bookings": 28,
                "actual_occupancy_pct": 77.8,
                "actual_revenue": 16800.0,
                "actual_expenses": 11400.0,
                "actual_profit": 5400.0,
                "forecast_error_revenue": 400.0,
                "forecast_error_occupancy": 0.2,
                "forecast_error_pct": 2.4
            },
            {
                "snapshot_id": "SNAP-HIST-02",
                "recommendation_id": "REC-HIST-02",
                "trip_id": "TRIP-MAA-BLR-303",
                "seat_id": "SEAT-303-L-02",
                "seat_number": "L2",
                "category_key": "sharing_lower_sleeper",
                "current_fare": 750.0,
                "proposed_fare": 820.0,
                "forecast_bookings": 1,
                "forecast_occupancy_pct": 85.0,
                "forecast_revenue": 26000.0,
                "forecast_expenses": 16200.0,
                "forecast_profit": 9800.0,
                "scenario_assumptions": json.dumps(["Strong commuter weekend"]),
                "confidence_score": "High",
                "created_at": (now_dt - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "decision_status": "OVERRIDDEN",
                "applied_fare": 800.0,
                "effective_at": (now_dt - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "decision_reason": "Charter party negotiation / Group booking concession",
                "actor_label": "Demo operator",
                "is_trip_completed": 1,
                "completed_at": (now_dt - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "actual_bookings": 34,
                "actual_occupancy_pct": 85.0,
                "actual_revenue": 25500.0,
                "actual_expenses": 16100.0,
                "actual_profit": 9400.0,
                "forecast_error_revenue": 500.0,
                "forecast_error_occupancy": 0.0,
                "forecast_error_pct": 2.0
            },
            {
                "snapshot_id": "SNAP-HIST-03",
                "recommendation_id": "REC-HIST-03",
                "trip_id": "TRIP-BLR-HYD-101",
                "seat_id": "SEAT-101-U-05",
                "seat_number": "U5",
                "category_key": "single_upper_sleeper",
                "current_fare": 900.0,
                "proposed_fare": 850.0,
                "forecast_bookings": 1,
                "forecast_occupancy_pct": 45.0,
                "forecast_revenue": 18500.0,
                "forecast_expenses": 15800.0,
                "forecast_profit": 2700.0,
                "scenario_assumptions": json.dumps(["Discount volume incentive"]),
                "confidence_score": "Medium",
                "created_at": (now_dt - timedelta(days=4)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "decision_status": "REJECTED",
                "applied_fare": 900.0,
                "effective_at": (now_dt - timedelta(days=4)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "decision_reason": "Operator preferred price floor protection during off-peak window",
                "actor_label": "Demo operator",
                "is_trip_completed": 1,
                "completed_at": (now_dt - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "actual_bookings": 18,
                "actual_occupancy_pct": 45.0,
                "actual_revenue": 16200.0,
                "actual_expenses": 15700.0,
                "actual_profit": 500.0,
                "forecast_error_revenue": 2300.0,
                "forecast_error_occupancy": 0.0,
                "forecast_error_pct": 14.2
            }
        ]

        cursor.executemany("""
            INSERT OR REPLACE INTO recommendation_snapshots (
                snapshot_id, recommendation_id, trip_id, seat_id, seat_number,
                category_key, current_fare, proposed_fare, forecast_bookings,
                forecast_occupancy_pct, forecast_revenue, forecast_expenses,
                forecast_profit, scenario_assumptions, confidence_score,
                created_at, decision_status, applied_fare, effective_at,
                decision_reason, actor_label, is_trip_completed, completed_at,
                actual_bookings, actual_occupancy_pct, actual_revenue,
                actual_expenses, actual_profit, forecast_error_revenue,
                forecast_error_occupancy, forecast_error_pct
            ) VALUES (
                :snapshot_id, :recommendation_id, :trip_id, :seat_id, :seat_number,
                :category_key, :current_fare, :proposed_fare, :forecast_bookings,
                :forecast_occupancy_pct, :forecast_revenue, :forecast_expenses,
                :forecast_profit, :scenario_assumptions, :confidence_score,
                :created_at, :decision_status, :applied_fare, :effective_at,
                :decision_reason, :actor_label, :is_trip_completed, :completed_at,
                :actual_bookings, :actual_occupancy_pct, :actual_revenue,
                :actual_expenses, :actual_profit, :forecast_error_revenue,
                :forecast_error_occupancy, :forecast_error_pct
            );
        """, completed_snapshots)
        conn.commit()

    # Generate initial operational alerts (Feature 5)
    from app.services.alert_service import AlertService
    alerts = AlertService.scan_and_generate_alerts()
    print(f"Generated {len(alerts)} initial operational alerts.")


if __name__ == "__main__":
    from app.db import init_db
    init_db()
    seed_data()
    print("Database initialized and seeded successfully.")

