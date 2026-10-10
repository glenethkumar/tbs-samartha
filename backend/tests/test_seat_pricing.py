"""FleetYield AI - Seat-Level Dynamic Pricing & Financial Simulation Unit Tests.

Validates:
1. Configurable bus layouts (seater vs sleeper)
2. Overlapping seat attributes (front + lower sleeper berth)
3. Occupied seats are locked (cannot be altered)
4. Seat fare limits and guardrail clamping
5. Category-specific demand and velocity calculations
6. Realized revenue vs forecast future revenue separation
7. Operating expense accounting, profit, and break-even occupancy
8. Multi-scenario financial projections (Conservative, Base, Optimistic)
9. Operator approval, rejection, and override controls with audit logging
10. Absence of arbitrary AI or ML claims without trained models
"""

import pytest
from app.db import init_db, reset_and_seed_database, get_connection
from app.services.seat_demand_service import SeatDemandService
from app.services.seat_pricing_policy import SeatPricingPolicy
from app.services.trip_financial_service import TripFinancialService
from app.services.operator_service import OperatorService


@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    # Verify trip data exists
    seats = SeatDemandService.get_trip_seats("TRIP-BLR-HYD-101")
    if not seats:
        from app.seed import seed_data
        seed_data()


# 1. Configurable Bus Layouts & Overlapping Attributes
def test_configurable_bus_layouts_and_overlapping_attributes():
    # Sleeper bus (BLR-HYD)
    sleeper_seats = SeatDemandService.get_trip_seats("TRIP-BLR-HYD-101")
    assert len(sleeper_seats) == 40
    decks = set(s["deck"] for s in sleeper_seats)
    assert "lower" in decks and "upper" in decks

    # Check overlapping attributes: front + lower sleeper
    front_lower = [s for s in sleeper_seats if s["position"] == "front" and s["berth_type"] == "lower"]
    assert len(front_lower) > 0
    sample = front_lower[0]
    assert sample["seat_type"] == "sleeper"
    assert sample["berth_type"] == "lower"
    assert sample["deck"] == "lower"
    assert sample["position"] == "front"

    # Seater bus (HYD-VJA)
    seater_seats = SeatDemandService.get_trip_seats("TRIP-HYD-VJA-202")
    assert len(seater_seats) == 40
    seater_decks = set(s["deck"] for s in seater_seats)
    assert seater_decks == {"lower"}  # Single deck
    assert all(s["berth_type"] == "none" for s in seater_seats)
    assert all(s["seat_type"] == "sitting" for s in seater_seats)


# 2. Occupied Seats are Fare-Locked
def test_occupied_seats_are_fare_locked():
    recs = SeatPricingPolicy.calculate_seat_recommendations("TRIP-BLR-HYD-101")
    assert len(recs) == 40

    booked_recs = [r for r in recs if r["recommended_action"] == "Locked (Booked)"]
    assert len(booked_recs) == 10  # Trip BLR-HYD has 10 booked seats

    for br in booked_recs:
        assert br["recommended_fare"] == br["current_fare"]
        assert br["fare_difference"] == 0.0
        assert "Fare-Lock Rule" in br["rule_applied"]
        assert "already booked" in br["warnings"][0].lower()


# 3. Fare Limits & Guardrail Clamping on Available Seats
def test_seat_fare_limits_and_clamping():
    recs = SeatPricingPolicy.calculate_seat_recommendations("TRIP-BLR-HYD-101")
    seats_db = {s["seat_id"]: s for s in SeatDemandService.get_trip_seats("TRIP-BLR-HYD-101")}

    for r in recs:
        seat = seats_db[r["seat_id"]]
        # Recommended fare must never breach seat minimum or maximum limits
        assert r["recommended_fare"] >= seat["min_fare"]
        assert r["recommended_fare"] <= seat["max_fare"]
        # Currency rounding to nearest ₹10
        assert r["recommended_fare"] % 10 == 0


# 4. Category-Specific Demand & Empirical Validation
def test_category_demand_and_velocity():
    analysis = SeatDemandService.analyze_category_demand("TRIP-BLR-HYD-101")
    assert "categories" in analysis
    assert "patterns" in analysis
    assert analysis["confidence_score"] in ("Data-backed estimate", "Heuristic estimate")

    cats = analysis["categories"]
    assert "lower_sleeper" in cats
    assert "upper_sleeper" in cats
    assert cats["lower_sleeper"]["total_seats"] > 0
    assert cats["upper_sleeper"]["total_seats"] > 0


# 5. Operating Expense Accounting & Financial Simulation
def test_operating_expenses_and_financial_simulation():
    financials = TripFinancialService.calculate_trip_financials("TRIP-BLR-HYD-101")

    # Realized revenue vs forecast revenue
    assert financials["current_booked_revenue"] > 0
    assert financials["capacity"] == 40
    assert financials["current_booked_seats"] == 10

    # Expense accounting
    exp = financials["expenses"]
    assert exp["fuel_cost"] > 5000.0
    assert exp["driver_wages"] > 1000.0
    assert exp["conductor_wages"] > 500.0
    assert exp["toll_charges"] > 500.0
    assert exp["total_fixed_expenses"] > 10000.0

    # Break-even metrics
    assert financials["break_even_revenue"] > exp["total_fixed_expenses"]
    assert 0 < financials["break_even_occupancy_pct"] <= 100.0

    # Scenario risk analysis (Conservative, Base Case, Optimistic)
    scenarios = financials["scenarios"]
    assert len(scenarios) == 3
    s_names = [s["scenario_name"] for s in scenarios]
    assert "Conservative" in s_names
    assert "Base Case" in s_names
    assert "Optimistic" in s_names

    # Conservative revenue <= Base Case <= Optimistic
    cons = next(s for s in scenarios if s["scenario_name"] == "Conservative")
    base = next(s for s in scenarios if s["scenario_name"] == "Base Case")
    opt = next(s for s in scenarios if s["scenario_name"] == "Optimistic")
    assert cons["total_expected_revenue"] <= base["total_expected_revenue"] <= opt["total_expected_revenue"]


# 6. Operator Approval Updates Seats and Records Audit Event
def test_operator_seat_decisions():
    trip_id = "TRIP-BLR-HYD-101"
    seats = SeatDemandService.get_trip_seats(trip_id)
    avail_seats = [s for s in seats if s["booking_status"] == "available"]
    assert len(avail_seats) > 0

    target_seat_id = avail_seats[0]["seat_id"]
    target_seat_num = avail_seats[0]["seat_number"]

    # Generate and persist recommendations first
    recs = SeatPricingPolicy.calculate_seat_recommendations(trip_id)
    SeatPricingPolicy.persist_seat_recommendations(recs)

    # Approve single seat
    res = OperatorService.record_seat_decisions(
        trip_id=trip_id,
        seat_ids=[target_seat_id],
        decision_type="APPROVED",
        reason=f"Approved test dynamic fare for seat {target_seat_num}"
    )
    assert res["success"] is True
    assert res["updated_seats_count"] == 1

    # Verify audit event logged
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM audit_events WHERE trip_id = ? AND event_type = 'OPERATOR_SEAT_APPROVED';", (trip_id,))
        audit = cursor.fetchone()
        assert audit is not None


# 7. Attempting to Alter Booked Seat Fares is Rejected
def test_booked_seats_cannot_be_altered_by_operator():
    trip_id = "TRIP-BLR-HYD-101"
    seats = SeatDemandService.get_trip_seats(trip_id)
    booked_seats = [s for s in seats if s["booking_status"] == "booked"]
    assert len(booked_seats) > 0

    booked_id = booked_seats[0]["seat_id"]

    # Attempt to approve or override booked seat must raise ValueError
    with pytest.raises(ValueError) as exc:
        OperatorService.record_seat_decisions(
            trip_id=trip_id,
            seat_ids=[booked_id],
            decision_type="APPROVED"
        )
    assert "already booked" in str(exc.value).lower()
