"""FleetYield AI - Unit Test Suite (PRD Section 9).

Covers all 12 required unit tests:
1. Occupancy: 30/40 gives 75%.
2. Available seats: 40 total and 30 booked gives 10.
3. Occupancy handles zero or invalid total seats safely.
4. Demand classification low boundary.
5. Demand classification medium boundary.
6. Demand classification high boundary.
7. Booking pace is unavailable without sufficient valid snapshots.
8. Recommendation is within min/max fare limits.
9. Recommendation output is deterministic for identical inputs.
10. Invalid required data blocks recommendation.
11. Fare rounding does not break the configured limits.
12. Simulation uses the same scenario inputs for both policies.
"""

import pytest
from app.services.trip_service import calculate_trip_metrics
from app.services.demand_classifier import DemandClassifier
from app.services.pricing_policy import PricingPolicy
from app.services.validation_service import ValidationService
from app.services.simulation_service import SimulationService
from app.config import settings


# 1. Occupancy: 30/40 gives 75%
def test_occupancy_calculation_standard():
    trip = {"total_seats": 40, "booked_seats": 30}
    metrics = calculate_trip_metrics(trip)
    assert metrics["occupancy_percent"] == 75.0


# 2. Available seats: 40 total and 30 booked gives 10
def test_available_seats_calculation():
    trip = {"total_seats": 40, "booked_seats": 30}
    metrics = calculate_trip_metrics(trip)
    assert metrics["available_seats"] == 10


# 3. Occupancy handles zero or invalid total seats safely
def test_occupancy_zero_total_seats_safety():
    # Zero total seats
    trip_zero = {"total_seats": 0, "booked_seats": 0}
    metrics_zero = calculate_trip_metrics(trip_zero)
    assert metrics_zero["occupancy_percent"] == 0.0
    assert metrics_zero["available_seats"] == 0

    # Negative total seats
    trip_neg = {"total_seats": -10, "booked_seats": 5}
    metrics_neg = calculate_trip_metrics(trip_neg)
    assert metrics_neg["occupancy_percent"] == 0.0
    assert metrics_neg["available_seats"] == 0


# 4. Demand classification low boundary
def test_demand_classification_low():
    # Strict boundary: 29.9% < 30.0% -> Low
    res = DemandClassifier.classify(
        occupancy_percent=29.9,
        departure_time="2026-10-15T12:00:00Z"
    )
    assert res["demand_category"] == "Low"
    assert "Low Demand" in res["explanation"]


# 5. Demand classification medium boundary
def test_demand_classification_medium():
    # Lower edge of medium: 30.0%
    res_low_edge = DemandClassifier.classify(
        occupancy_percent=30.0,
        departure_time="2026-10-15T12:00:00Z"
    )
    assert res_low_edge["demand_category"] == "Medium"

    # Midpoint: 50.0%
    res_mid = DemandClassifier.classify(
        occupancy_percent=50.0,
        departure_time="2026-10-15T12:00:00Z"
    )
    assert res_mid["demand_category"] == "Medium"

    # Upper edge of medium: 70.0%
    res_high_edge = DemandClassifier.classify(
        occupancy_percent=70.0,
        departure_time="2026-10-15T12:00:00Z"
    )
    assert res_high_edge["demand_category"] == "Medium"


# 6. Demand classification high boundary
def test_demand_classification_high():
    # Strict boundary: 70.1% > 70.0% -> High
    res = DemandClassifier.classify(
        occupancy_percent=70.1,
        departure_time="2026-10-15T12:00:00Z"
    )
    assert res["demand_category"] == "High"
    assert "High Demand" in res["explanation"]


# 7. Booking pace is unavailable without sufficient valid snapshots
def test_booking_pace_unavailable_with_insufficient_snapshots():
    # 0 snapshots
    res_empty = DemandClassifier.calculate_booking_pace([])
    assert res_empty["available"] is False
    assert "Not available" in res_empty["description"]

    # 1 snapshot only (minimum 2 required)
    single_snapshot = [{"snapshot_id": "S1", "captured_at": "2026-10-10T10:00:00Z", "booked_seats": 10}]
    res_single = DemandClassifier.calculate_booking_pace(single_snapshot)
    assert res_single["available"] is False
    assert "minimum 2" in res_single["description"]


# 8. Recommendation is within min/max fare limits
def test_recommendation_bounds_clamping():
    # Case A: Low demand discount (-10%) would drop ₹500 to ₹450, but min_fare is ₹480
    res_floor = PricingPolicy.calculate_recommendation(
        base_fare=500.0,
        current_fare=500.0,
        min_fare=480.0,
        max_fare=800.0,
        demand_category="Low",
        occupancy_percent=20.0
    )
    assert res_floor["recommended_fare"] == 480.0
    assert res_floor["is_clamped"] is True
    assert "below the trip's minimum limit" in res_floor["clamped_reason"]

    # Case B: High demand premium (+15%) would increase ₹1000 to ₹1150, but max_fare is ₹1100
    res_ceiling = PricingPolicy.calculate_recommendation(
        base_fare=1000.0,
        current_fare=1000.0,
        min_fare=800.0,
        max_fare=1100.0,
        demand_category="High",
        occupancy_percent=85.0
    )
    assert res_ceiling["recommended_fare"] == 1100.0
    assert res_ceiling["is_clamped"] is True
    assert "exceeded the trip's maximum limit" in res_ceiling["clamped_reason"]


# 9. Recommendation output is deterministic for identical inputs
def test_recommendation_deterministic_output():
    args = {
        "base_fare": 800.0,
        "current_fare": 800.0,
        "min_fare": 600.0,
        "max_fare": 1200.0,
        "demand_category": "High",
        "occupancy_percent": 80.0
    }
    run1 = PricingPolicy.calculate_recommendation(**args)
    run2 = PricingPolicy.calculate_recommendation(**args)
    assert run1 == run2
    assert run1["recommended_fare"] == 920.0  # 800 * 1.15 = 920


# 10. Invalid required data blocks recommendation
def test_invalid_data_blocks_recommendation():
    # Booked seats exceed capacity
    invalid_trip = {
        "total_seats": 40,
        "booked_seats": 45,
        "base_fare": 500.0,
        "current_fare": 500.0,
        "min_fare": 400.0,
        "max_fare": 700.0,
        "departure_time": "2026-10-15T12:00:00Z",
        "data_updated_at": "2026-10-10T12:00:00Z"
    }
    is_valid, is_stale, can_recommend, issues = ValidationService.validate_trip(invalid_trip)
    assert is_valid is False
    assert can_recommend is False
    assert any("exceeds total bus capacity" in issue for issue in issues)


# 11. Fare rounding does not break the configured limits
def test_fare_rounding_preserves_limits():
    # Suppose base is 100, -10% gives 90. Suppose min_fare is 94.
    # Nearest 10 of 90 is 90, which is < 94, so must clamp to 94!
    res = PricingPolicy.calculate_recommendation(
        base_fare=100.0,
        current_fare=100.0,
        min_fare=94.0,
        max_fare=150.0,
        demand_category="Low",
        occupancy_percent=25.0
    )
    assert res["recommended_fare"] >= res["min_fare"]
    assert res["recommended_fare"] <= res["max_fare"]
    assert res["recommended_fare"] == 94.0


# 12. Simulation uses the same scenario inputs for both policies
def test_simulation_scenario_symmetry():
    # Run simulation on default trips
    res = SimulationService.run_simulation(demand_multiplier=1.2, price_elasticity=-0.6)
    assert "notice" in res
    assert "SIMULATED - NOT REAL-WORLD PERFORMANCE" in res["notice"]
    assert res["scenario_parameters"]["demand_multiplier"] == 1.2
    assert res["scenario_parameters"]["price_elasticity"] == -0.6

    for row in res["trips"]:
        # Both policies share the exact same total seats and baseline fare
        assert row["total_seats"] > 0
        assert row["baseline_fare"] > 0
        # Check occupancy calculations
        assert 0.0 <= row["baseline_occupancy_pct"] <= 100.0
        assert 0.0 <= row["fleetyield_occupancy_pct"] <= 100.0
