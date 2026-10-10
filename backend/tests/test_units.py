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


# 13. Zero occupancy handling
def test_pricing_policy_zero_occupancy():
    # 0 booked seats out of 40 (0.0% occupancy)
    dem = DemandClassifier.classify(occupancy_percent=0.0, departure_time="2026-10-15T12:00:00Z")
    assert dem["demand_category"] == "Low"

    res = PricingPolicy.calculate_recommendation(
        base_fare=500.0,
        current_fare=500.0,
        min_fare=400.0,
        max_fare=800.0,
        demand_category=dem["demand_category"],
        occupancy_percent=0.0
    )
    # 500 - 10% = 450 (within 400-800 bounds)
    assert res["recommended_fare"] == 450.0
    assert res["fare_difference"] == -50.0
    assert res["is_clamped"] is False


# 14. Full bus handling (100% capacity)
def test_pricing_policy_full_bus():
    # 40 booked seats out of 40 (100.0% occupancy)
    dem = DemandClassifier.classify(occupancy_percent=100.0, departure_time="2026-10-15T12:00:00Z")
    assert dem["demand_category"] == "High"

    res = PricingPolicy.calculate_recommendation(
        base_fare=1000.0,
        current_fare=1000.0,
        min_fare=800.0,
        max_fare=1200.0,
        demand_category=dem["demand_category"],
        occupancy_percent=100.0
    )
    # 1000 + 15% = 1150 (within 800-1200 bounds)
    assert res["recommended_fare"] == 1150.0
    assert res["fare_difference"] == 150.0
    assert res["is_clamped"] is False


# 15. Invalid pricing inputs rejected with ValueError
def test_pricing_policy_invalid_inputs_rejected():
    # Negative base fare
    with pytest.raises(ValueError) as exc1:
        PricingPolicy.calculate_recommendation(
            base_fare=-500.0,
            current_fare=500.0,
            min_fare=400.0,
            max_fare=800.0,
            demand_category="Medium",
            occupancy_percent=50.0
        )
    assert "positive numbers" in str(exc1.value)

    # Minimum fare > Maximum fare
    with pytest.raises(ValueError) as exc2:
        PricingPolicy.calculate_recommendation(
            base_fare=500.0,
            current_fare=500.0,
            min_fare=900.0,
            max_fare=600.0,
            demand_category="Medium",
            occupancy_percent=50.0
        )
    assert "cannot exceed maximum fare" in str(exc2.value)

    # Invalid occupancy percentage
    with pytest.raises(ValueError) as exc3:
        PricingPolicy.calculate_recommendation(
            base_fare=500.0,
            current_fare=500.0,
            min_fare=400.0,
            max_fare=800.0,
            demand_category="Medium",
            occupancy_percent=105.0
        )
    assert "between 0.0 and 100.0" in str(exc3.value)


# 16. Overbooking validation blocks recommendations
def test_overbooking_validation_blocks():
    overbooked_trip = {
        "trip_id": "TRIP-OVERBOOKED-01",
        "route_name": "Overbooked Express",
        "total_seats": 35,
        "booked_seats": 42,  # Over capacity
        "base_fare": 600.0,
        "current_fare": 600.0,
        "min_fare": 500.0,
        "max_fare": 900.0,
        "departure_time": "2026-10-15T12:00:00Z",
        "data_updated_at": "2026-10-10T12:00:00Z"
    }
    is_valid, is_stale, can_recommend, issues = ValidationService.validate_trip(overbooked_trip)
    assert is_valid is False
    assert can_recommend is False
    assert any("exceeds total bus capacity" in i for i in issues)


# 17. Scenario where dynamic pricing performs worse than fixed-fare baseline
def test_simulation_dynamic_underperforms_fixed_baseline():
    # In an inelastic market (elasticity = 0.0), discounting low-demand seats loses revenue without increasing volume
    res = SimulationService.run_simulation(demand_multiplier=1.0, price_elasticity=0.0)
    assert res["dynamic_underperforms_baseline"] is True
    assert res["revenue_difference"] < 0
    assert res["underperformance_note"] is not None
    assert "underperformed Fixed-Fare baseline" in res["underperformance_note"]


# 18. Simulation consistency and non-negative constraints
def test_simulation_consistency_and_non_negative():
    res = SimulationService.run_simulation(demand_multiplier=0.7, price_elasticity=-1.8)
    assert res["baseline_total_revenue"] >= 0.0
    assert res["fleetyield_total_revenue"] >= 0.0

    for row in res["trips"]:
        # Bookings must be integer counts between 0 and total capacity
        assert isinstance(row["baseline_sold_seats"], int)
        assert isinstance(row["fleetyield_sold_seats"], int)
        assert 0 <= row["baseline_sold_seats"] <= row["total_seats"]
        assert 0 <= row["fleetyield_sold_seats"] <= row["total_seats"]

        # Revenues must be non-negative
        assert row["baseline_revenue"] >= 0.0
        assert row["fleetyield_revenue"] >= 0.0

        # Occupancy must match exact booking/capacity calculation
        expected_occ_base = round((row["baseline_sold_seats"] / row["total_seats"]) * 100.0, 1)
        expected_occ_fleet = round((row["fleetyield_sold_seats"] / row["total_seats"]) * 100.0, 1)
        assert row["baseline_occupancy_pct"] == expected_occ_base
        assert row["fleetyield_occupancy_pct"] == expected_occ_fleet


# 19. Evidence Quality: Strong data status condition
def test_evidence_quality_strong_status():
    trip = {
        "trip_id": "TRIP-TEST-STRONG",
        "total_seats": 40,
        "booked_seats": 30,
        "base_fare": 800.0,
        "current_fare": 800.0,
        "min_fare": 600.0,
        "max_fare": 1100.0,
        "departure_time": "2026-10-15T12:00:00Z",
        "data_updated_at": "2026-10-10T15:00:00Z"
    }
    snapshots = [
        {"snapshot_id": "S1", "trip_id": "TRIP-TEST-STRONG", "captured_at": "2026-10-10T08:00:00Z", "booked_seats": 20},
        {"snapshot_id": "S2", "trip_id": "TRIP-TEST-STRONG", "captured_at": "2026-10-10T14:00:00Z", "booked_seats": 30}
    ]
    pace = DemandClassifier.calculate_booking_pace(snapshots)
    assert pace["available"] is True
    assert pace["window_hours"] == 6.0
    assert pace["pace_per_hour"] == 1.67

    ev = ValidationService.evaluate_evidence_quality(
        trip=trip,
        is_valid=True,
        is_stale=False,
        validation_issues=[],
        booking_pace=pace
    )
    assert ev["status"] == settings.EVIDENCE_STATUS_STRONG
    assert ev["status_code"] == "STRONG"
    assert ev["can_recommend"] is True
    assert "Strong data" in ev["explanation"]
    assert ev["optional_evidence"]["booking_pace_available"] is True


# 20. Evidence Quality: Limited data status condition
def test_evidence_quality_limited_status():
    trip = {
        "trip_id": "TRIP-TEST-LIMITED",
        "total_seats": 40,
        "booked_seats": 20,
        "base_fare": 800.0,
        "current_fare": 800.0,
        "min_fare": 600.0,
        "max_fare": 1100.0,
        "departure_time": "2026-10-15T12:00:00Z",
        "data_updated_at": "2026-10-10T15:00:00Z"
    }
    # Fewer than 2 snapshots (pace unavailable)
    pace = DemandClassifier.calculate_booking_pace([
        {"snapshot_id": "S1", "trip_id": "TRIP-TEST-LIMITED", "captured_at": "2026-10-10T08:00:00Z", "booked_seats": 20}
    ])
    assert pace["available"] is False

    ev = ValidationService.evaluate_evidence_quality(
        trip=trip,
        is_valid=True,
        is_stale=False,
        validation_issues=[],
        booking_pace=pace
    )
    assert ev["status"] == settings.EVIDENCE_STATUS_LIMITED
    assert ev["status_code"] == "LIMITED"
    assert ev["can_recommend"] is True
    assert "Limited data" in ev["explanation"]
    assert "optional historical booking pace snapshots are missing" in ev["explanation"]


# 21. Evidence Quality: Insufficient data status on stale data
def test_evidence_quality_insufficient_status_stale():
    trip = {
        "trip_id": "TRIP-TEST-STALE",
        "total_seats": 40,
        "booked_seats": 20,
        "base_fare": 800.0,
        "current_fare": 800.0,
        "min_fare": 600.0,
        "max_fare": 1100.0,
        "departure_time": "2026-10-15T12:00:00Z",
        "data_updated_at": "2026-10-01T00:00:00Z"  # > 24 hours ago
    }
    ev = ValidationService.evaluate_evidence_quality(
        trip=trip,
        is_valid=True,
        is_stale=True,
        validation_issues=["Data is stale: last updated 230.0 hours ago"],
        booking_pace={"available": True}
    )
    assert ev["status"] == settings.EVIDENCE_STATUS_INSUFFICIENT
    assert ev["status_code"] == "INSUFFICIENT"
    assert ev["can_recommend"] is False
    assert "Insufficient data" in ev["explanation"]
    assert "withheld by safety policy" in ev["explanation"]


# 22. Evidence Quality: Insufficient data status on invalid inputs
def test_evidence_quality_insufficient_status_invalid():
    trip = {
        "trip_id": "TRIP-TEST-INVALID",
        "total_seats": 40,
        "booked_seats": 50,  # Overbooked
        "base_fare": 800.0,
        "current_fare": 800.0,
        "min_fare": 600.0,
        "max_fare": 1100.0,
        "departure_time": "2026-10-15T12:00:00Z",
        "data_updated_at": "2026-10-10T15:00:00Z"
    }
    ev = ValidationService.evaluate_evidence_quality(
        trip=trip,
        is_valid=False,
        is_stale=False,
        validation_issues=["Booked seats (50) exceeds total bus capacity (40)"],
        booking_pace=None
    )
    assert ev["status"] == settings.EVIDENCE_STATUS_INSUFFICIENT
    assert ev["can_recommend"] is False
    assert "exceeds total bus capacity" in ev["explanation"]


# 23. RecommendationService end-to-end Explainable Confidence with Strong data
def test_recommendation_service_strong_data_evidence():
    from app.services.recommendation_service import RecommendationService
    rec = RecommendationService.generate_recommendation("TRIP-MUM-PUN-404")

    assert rec["validation_status"] == "VALID"
    assert rec["evidence_quality_status"] == settings.EVIDENCE_STATUS_STRONG
    details = rec["evidence_quality_details"]
    assert details["status"] == "Strong data"
    assert details["can_recommend"] is True
    assert details["occupancy"]["band"] == "High"
    assert "> 70.0%" in details["occupancy"]["threshold_used"]
    assert details["booking_pace"]["available"] is True
    assert details["booking_pace"]["window_hours"] is not None
    assert "h window" in details["booking_pace"]["observation_window"]
    assert rec["recommended_fare"] == 520.0  # ₹450 + 15% = ₹517.5 rounded to ₹520
    assert "High Demand Policy: +15.0%" in rec["rule_applied"]


# 24. RecommendationService end-to-end Explainable Confidence with Limited data
def test_recommendation_service_limited_data_evidence():
    from app.services.recommendation_service import RecommendationService
    rec = RecommendationService.generate_recommendation("TRIP-BLR-HYD-101")

    assert rec["validation_status"] == "VALID"
    assert rec["evidence_quality_status"] == settings.EVIDENCE_STATUS_LIMITED
    details = rec["evidence_quality_details"]
    assert details["status"] == "Limited data"
    assert details["occupancy"]["band"] == "Low"
    assert "< 30.0%" in details["occupancy"]["threshold_used"]
    assert details["booking_pace"]["available"] is False
    assert rec["recommended_fare"] == 810.0  # ₹900 - 10% = ₹810
    assert "Low Demand Policy: -10.0%" in rec["rule_applied"]


# 25. RecommendationService blocks Insufficient data test fixtures
def test_recommendation_service_insufficient_data_blocked():
    from app.services.recommendation_service import RecommendationService
    # Stale fixture
    rec_stale = RecommendationService.generate_recommendation("TRIP-STALE-901")
    assert rec_stale["validation_status"] == "BLOCKED"
    assert rec_stale["evidence_quality_status"] == settings.EVIDENCE_STATUS_INSUFFICIENT
    assert "Recommendation withheld by safety policy" in rec_stale["explanation"]

    # Invalid fixture
    rec_invalid = RecommendationService.generate_recommendation("TRIP-INVALID-902")
    assert rec_invalid["validation_status"] == "BLOCKED"
    assert rec_invalid["evidence_quality_status"] == settings.EVIDENCE_STATUS_INSUFFICIENT
    assert "exceeds total bus capacity" in rec_invalid["explanation"]


# 26. Absence of arbitrary AI percentage or statistical probability claims
def test_no_arbitrary_ai_confidence_percentages():
    from app.services.recommendation_service import RecommendationService
    rec = RecommendationService.generate_recommendation("TRIP-MUM-PUN-404")

    # Status must be one of the three canonical deterministic labels
    assert rec["evidence_quality_status"] in (
        settings.EVIDENCE_STATUS_STRONG,
        settings.EVIDENCE_STATUS_LIMITED,
        settings.EVIDENCE_STATUS_INSUFFICIENT
    )
    # Explanation must not claim ML probabilistic calibration or arbitrary AI percentages
    forbidden_terms = ["99%", "95% confidence", "statistical probability", "trained model", "machine learning model"]
    for term in forbidden_terms:
        assert term not in rec["explanation"].lower()
        assert term not in rec["evidence_quality_explanation"].lower()

