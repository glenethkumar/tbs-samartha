"""FleetYield AI - Integration and Workflow Test Suite (PRD Section 9).

Covers all 8 required integration and workflow checks:
1. Seed data appears on first run.
2. Saved trip changes persist after update.
3. Recommendation generation creates a persisted recommendation record.
4. Approve, reject, and override actions persist.
5. Override outside fare limits is rejected.
6. Audit log displays saved events.
7. Stale/invalid records show warnings and do not generate normal recommendations.
8. Baseline comparison recalculates when scenario inputs change.
"""

import pytest
from app.db import init_db, reset_and_seed_database
from app.services.trip_service import TripService
from app.services.recommendation_service import RecommendationService
from app.services.operator_service import OperatorService
from app.services.audit_service import AuditService
from app.services.simulation_service import SimulationService


@pytest.fixture(autouse=True)
def setup_clean_database():
    """Ensures database is initialized and seeded before test run."""
    reset_and_seed_database()
    yield


@pytest.fixture
def client():
    """Provides a TestClient for FastAPI route testing."""
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


# 1. Seed data appears on first run
def test_seed_data_presence():
    trips = TripService.list_trips()
    assert len(trips) >= 8
    trip_ids = [t["trip_id"] for t in trips]
    assert "TRIP-BLR-HYD-101" in trip_ids
    assert "TRIP-STALE-901" in trip_ids
    assert "TRIP-INVALID-902" in trip_ids


# 2. Saved trip changes persist
def test_trip_update_persists():
    trip_id = "TRIP-BLR-HYD-101"
    original = TripService.get_trip(trip_id)
    assert original is not None

    new_booked = 15
    updated = TripService.update_trip(trip_id, {"booked_seats": new_booked})
    assert updated["booked_seats"] == new_booked
    assert updated["available_seats"] == 40 - 15  # 25

    # Re-fetch fresh from DB
    re_fetched = TripService.get_trip(trip_id)
    assert re_fetched["booked_seats"] == 15
    assert re_fetched["available_seats"] == 25


# 3. Recommendation generation creates a persisted recommendation record
def test_recommendation_persists():
    trip_id = "TRIP-HYD-VJA-202"
    rec = RecommendationService.generate_recommendation(trip_id)

    assert rec["validation_status"] == "VALID"
    assert rec["recommendation_id"].startswith("REC-")
    assert rec["recommended_fare"] > 0

    # Fetch trip and verify latest recommendation is attached
    trip = TripService.get_trip(trip_id)
    assert trip["latest_recommendation"] is not None
    assert trip["latest_recommendation"]["recommendation_id"] == rec["recommendation_id"]


# 4. Approve, reject, and override actions persist
def test_operator_decisions_persist():
    trip_id = "TRIP-MAA-BLR-303"
    rec = RecommendationService.generate_recommendation(trip_id)
    rec_id = rec["recommendation_id"]

    # Test Approve
    appr_res = OperatorService.record_decision(
        recommendation_id=rec_id,
        decision_type="APPROVED"
    )
    assert appr_res["decision_type"] == "APPROVED"
    assert appr_res["decision_fare"] == rec["recommended_fare"]

    # Verify trip records decision
    trip = TripService.get_trip(trip_id)
    decision_types = [d["decision_type"] for d in trip["decisions"]]
    assert "APPROVED" in decision_types

    # Generate new recommendation and test Reject
    rec2 = RecommendationService.generate_recommendation(trip_id)
    rej_res = OperatorService.record_decision(
        recommendation_id=rec2["recommendation_id"],
        decision_type="REJECTED",
        reason="Market conditions volatile"
    )
    assert rej_res["decision_type"] == "REJECTED"
    assert rej_res["decision_fare"] is None


# 5. Override outside fare limits is rejected
def test_override_outside_limits_rejected():
    trip_id = "TRIP-MUM-PUN-404"
    trip = TripService.get_trip(trip_id)
    min_f = trip["min_fare"]  # 350
    max_f = trip["max_fare"]  # 700

    rec = RecommendationService.generate_recommendation(trip_id)
    rec_id = rec["recommendation_id"]

    # Attempt override above max_fare
    with pytest.raises(ValueError) as excinfo_high:
        OperatorService.record_decision(
            recommendation_id=rec_id,
            decision_type="OVERRIDDEN",
            decision_fare=max_f + 100,
            reason="Want higher fare"
        )
    assert "violates configured fare bounds" in str(excinfo_high.value)

    # Attempt override below min_fare
    with pytest.raises(ValueError) as excinfo_low:
        OperatorService.record_decision(
            recommendation_id=rec_id,
            decision_type="OVERRIDDEN",
            decision_fare=min_f - 100,
            reason="Want rock-bottom fare"
        )
    assert "violates configured fare bounds" in str(excinfo_low.value)

    # Valid override should succeed
    valid_override = OperatorService.record_decision(
        recommendation_id=rec_id,
        decision_type="OVERRIDDEN",
        decision_fare=500.0,
        reason="Special weekend festival markup"
    )
    assert valid_override["decision_fare"] == 500.0


# 6. Audit log displays saved events
def test_audit_log_tracking():
    events = AuditService.get_events()
    assert len(events) > 0
    event_types = [e["event_type"] for e in events]
    # Check that events have timestamps and required fields
    for e in events:
        assert "audit_id" in e
        assert "created_at" in e
        assert "rule_version" in e


# 7. Stale/invalid records show warnings and do not generate normal recommendations
def test_stale_and_invalid_fixtures_block_recommendation():
    # Stale fixture: TRIP-STALE-901
    stale_rec = RecommendationService.generate_recommendation("TRIP-STALE-901")
    assert stale_rec["validation_status"] == "BLOCKED"
    assert "Recommendation withheld by safety policy" in stale_rec["explanation"]

    # Invalid fixture: TRIP-INVALID-902
    invalid_rec = RecommendationService.generate_recommendation("TRIP-INVALID-902")
    assert invalid_rec["validation_status"] == "BLOCKED"
    assert "exceeds total bus capacity" in invalid_rec["explanation"]

    # Verify audit log recorded blocked events
    events = AuditService.get_events(event_type="VALIDATION_BLOCKED")
    assert len(events) >= 2


# 8. Baseline comparison recalculates when scenario inputs change
def test_baseline_comparison_dynamic_recalculation():
    # Run with default demand multiplier 1.0
    run1 = SimulationService.run_simulation(demand_multiplier=1.0, price_elasticity=-0.5)

    # Run with higher demand multiplier 1.8
    run2 = SimulationService.run_simulation(demand_multiplier=1.8, price_elasticity=-0.5)

    # Higher market demand should sell more seats where capacity allows
    assert run2["baseline_total_seats_sold"] >= run1["baseline_total_seats_sold"]
    assert run2["baseline_total_revenue"] >= run1["baseline_total_revenue"]
    assert run1["scenario_parameters"]["demand_multiplier"] == 1.0
    assert run2["scenario_parameters"]["demand_multiplier"] == 1.8


# 9. Duplicate decision submissions on the same recommendation are rejected
def test_duplicate_decision_rejected():
    trip_id = "TRIP-BLR-HYD-101"
    rec = RecommendationService.generate_recommendation(trip_id)
    rec_id = rec["recommendation_id"]

    # First decision succeeds
    res1 = OperatorService.record_decision(
        recommendation_id=rec_id,
        decision_type="APPROVED"
    )
    assert res1["decision_type"] == "APPROVED"

    # Second decision on the exact same recommendation must be rejected
    with pytest.raises(ValueError) as exc:
        OperatorService.record_decision(
            recommendation_id=rec_id,
            decision_type="APPROVED"
        )
    assert "already been recorded" in str(exc.value)


# 10. Current fare or base fare outside configured bounds fails validation
def test_fare_outside_configured_bounds_fails_validation():
    from app.services.validation_service import ValidationService

    # Current fare exceeds max_fare
    trip_high_fare = {
        "trip_id": "TRIP-TEST-001",
        "route_name": "Test Route",
        "total_seats": 40,
        "booked_seats": 10,
        "base_fare": 500.0,
        "current_fare": 1500.0,  # Exceeds max 1000
        "min_fare": 400.0,
        "max_fare": 1000.0,
        "departure_time": "2026-10-15T12:00:00Z",
        "data_updated_at": "2026-10-10T12:00:00Z"
    }
    is_valid, _, can_rec, issues = ValidationService.validate_trip(trip_high_fare)
    assert is_valid is False
    assert can_rec is False
    assert any("outside configured limits" in issue for issue in issues)


# 11. Simulation rejects negative demand multiplier or positive elasticity
def test_simulation_invalid_inputs_rejected():
    with pytest.raises(ValueError) as exc1:
        SimulationService.run_simulation(demand_multiplier=-0.5)
    assert "demand_multiplier cannot be negative" in str(exc1.value)

    with pytest.raises(ValueError) as exc2:
        SimulationService.run_simulation(price_elasticity=0.5)
    assert "price_elasticity must be non-positive" in str(exc2.value)


# 12. Competitor API endpoint returns market summary and comparable listings
def test_get_trip_competitors_api(client):
    res = client.get("/api/trips/TRIP-BLR-HYD-101/competitors")
    assert res.status_code == 200
    data = res.json()
    assert data["sample_size"] >= 3
    assert data["median_fare"] is not None
    assert isinstance(data["comparable_competitors"], list)
    assert len(data["comparable_competitors"]) >= 3


# 13. Competitor CSV import API processes uploaded rows
def test_import_competitor_csv_api(client):
    csv_payload = {
        "csv_content": (
            "origin,destination,departure_time,bus_type,operator_name,platform,fare\n"
            "Chennai,Bengaluru,2026-10-15T18:00:00Z,AC Sleeper,SRS Travels,RedBus,780.0\n"
            "Chennai,Bengaluru,2026-10-15T18:30:00Z,AC Sleeper,Parveen Travels,AbhiBus,760.0\n"
        ),
        "is_simulated": True
    }
    res = client.post("/api/competitor-fares/import-csv", json=csv_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["records_imported"] == 2


# 14. Competitor sample reset endpoint re-populates benchmarks
def test_reset_competitor_sample_api(client):
    res = client.post("/api/competitor-fares/reset-sample")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] > 0
    assert "Successfully re-seeded" in data["message"]

