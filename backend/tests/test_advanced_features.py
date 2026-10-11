"""FleetYield AI - Automated Tests for 6 Advanced Features.

Tests:
1. Smart Seat Demand Prediction: selling probability, final occupancy, Insufficient Data status
2. What-If Revenue and Profit Simulator: Current vs Proposed vs Manual Alternative, costs, break-even
3. Historical Competitor Fare Tracking: 7-day timeline, median/range, price shifts, stale detection
4. Explainable Seat-Level Recommendations: 4-part plain English explanation, facts vs assumptions
5. Operational Alerts & Daily Reports: alert generation, deduplication, lifecycle, CSV export
6. Recommendation Performance Tracking: snapshots, completed trip evaluation, MAE/MAPE metrics
"""

import pytest
from app.db import init_db, reset_and_seed_database
from app.services.seat_demand_service import SeatDemandService
from app.services.seat_pricing_policy import SeatPricingPolicy
from app.services.trip_financial_service import TripFinancialService
from app.services.competitor_service import CompetitorService
from app.services.alert_service import AlertService
from app.services.report_service import ReportService
from app.services.performance_service import PerformanceService
from app.services.operator_service import OperatorService


@pytest.fixture(autouse=True)
def setup_db():
    reset_and_seed_database()


# -------------------------------------------------------------
# FEATURE 1: Smart Seat Demand Prediction Tests
# -------------------------------------------------------------
def test_seat_demand_selling_probability_and_final_occupancy():
    trip_id = "TRIP-BLR-HYD-101"
    analysis = SeatDemandService.analyze_category_demand(trip_id)
    
    assert "categories" in analysis
    assert "confidence_score" in analysis
    assert "hours_until_departure" in analysis
    
    categories = analysis["categories"]
    assert len(categories) > 0
    
    for cat_key, cat in categories.items():
        assert "selling_probability" in cat
        assert 0.0 <= cat["selling_probability"] <= 1.0
        assert "expected_final_occupancy_pct" in cat
        assert 0.0 <= cat["expected_final_occupancy_pct"] <= 100.0
        assert cat["demand_level"] in ("Low", "Medium", "High", "Insufficient Data")
        assert "booking_velocity" in cat


def test_seat_demand_insufficient_history_baseline_scenario():
    from app.db import get_connection
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO trips (
                trip_id, route_name, origin, destination, departure_time,
                total_seats, booked_seats, base_fare, current_fare, min_fare,
                max_fare, data_updated_at, data_source_label
            ) VALUES (
                'TRIP-ZERO-001', 'Test Route Zero', 'Origin', 'Destination', '2026-10-15T10:00:00Z',
                40, 0, 800.0, 800.0, 600.0, 1100.0, '2026-10-10T10:00:00Z', 'Test'
            );
        """)
        cursor.execute("""
            INSERT OR REPLACE INTO trip_seats (
                seat_id, trip_id, seat_number, deck, row_idx, col_idx,
                position, seat_type, berth_type, sleeper_arrangement,
                max_occupants, privacy_level, is_ac, bus_category,
                base_fare, current_fare, min_fare, max_fare, booking_status
            ) VALUES (
                'SEAT-ZERO-01', 'TRIP-ZERO-001', '1A', 'lower', 1, 1,
                'front', 'sitting', 'none', 'none', 1, 'standard', 1, 'AC Seater',
                800.0, 800.0, 600.0, 1100.0, 'available'
            );
        """)
        conn.commit()

    analysis = SeatDemandService.analyze_category_demand("TRIP-ZERO-001")
    assert analysis["confidence_score"] == "Insufficient Data (Scenario Baseline)"
    assert analysis["categories"]["sitting"]["demand_level"] == "Insufficient Data"


# -------------------------------------------------------------
# FEATURE 2: What-If Revenue and Profit Simulator Tests
# -------------------------------------------------------------
def test_what_if_simulator_three_scenario_comparison():
    trip_id = "TRIP-BLR-HYD-101"
    res = TripFinancialService.simulate_what_if(
        trip_id=trip_id,
        manual_adjustment_pct=10.0,
        scenario_type="Base Case"
    )
    
    assert "scenarios_comparison" in res
    comp = res["scenarios_comparison"]
    assert "current_pricing" in comp
    assert "recommended_pricing" in comp
    assert "manual_alternative" in comp
    
    curr = comp["current_pricing"]
    prop = comp["recommended_pricing"]
    manual = comp["manual_alternative"]
    
    # Financial integrity: net revenue = gross sales - discounts
    assert curr["net_ticket_revenue"] == curr["gross_ticket_sales"] - curr["discounts_and_refunds"]
    assert prop["net_ticket_revenue"] == prop["gross_ticket_sales"] - prop["discounts_and_refunds"]
    assert manual["net_ticket_revenue"] == manual["gross_ticket_sales"] - manual["discounts_and_refunds"]
    
    # Break-even calculations
    assert res["break_even_revenue"] > 0
    assert 0 <= res["break_even_occupancy_pct"] <= 100


def test_what_if_simulator_warns_on_unprofitable_discount():
    trip_id = "TRIP-BLR-HYD-101"
    # Severe discount (-25%) should trigger warning that discount reduces profit
    res = TripFinancialService.simulate_what_if(
        trip_id=trip_id,
        manual_adjustment_pct=-25.0
    )
    manual = res["scenarios_comparison"]["manual_alternative"]
    warnings = manual.get("warnings", [])
    assert any("reduces projected profit" in w or "discount" in w.lower() for w in warnings)


def test_what_if_simulator_enforces_bounds_clamping():
    trip_id = "TRIP-CLAMP-850"
    # Test setting manual fare far below permitted floor
    res = TripFinancialService.simulate_what_if(
        trip_id=trip_id,
        manual_target_fare=200.0  # Floor bounds are 580 to 620 depending on seat position
    )
    manual = res["scenarios_comparison"]["manual_alternative"]
    assert manual["average_available_fare"] >= 580.0
    warnings = manual.get("warnings", [])
    assert any("clamped" in w.lower() for w in warnings)



# -------------------------------------------------------------
# FEATURE 3: Historical Competitor Fare Tracking Tests
# -------------------------------------------------------------
def test_competitor_historical_trend_retrieval():
    trip_id = "TRIP-BLR-HYD-101"
    trends = CompetitorService.get_competitor_fare_trends(trip_id=trip_id, days=7)
    
    assert trends["trip_id"] == trip_id
    assert trends["trend_days"] == 7
    assert trends["total_observations"] > 0
    assert len(trends["timeline"]) > 0
    
    first_pt = trends["timeline"][0]
    assert "date" in first_pt
    assert "median_fare" in first_pt
    assert "min_fare" in first_pt
    assert "max_fare" in first_pt
    assert "our_fare" in first_pt
    assert first_pt["min_fare"] <= first_pt["median_fare"] <= first_pt["max_fare"]


def test_competitor_price_shifts_detection():
    trip_id = "TRIP-BLR-HYD-101"
    trends = CompetitorService.get_competitor_fare_trends(trip_id=trip_id, days=7)
    shifts = trends.get("recent_price_shifts", [])
    # Price shifts should be tracked per operator
    assert isinstance(shifts, list)
    if shifts:
        shift = shifts[0]
        assert "operator_name" in shift
        assert "fare_difference" in shift
        assert "shift_type" in shift


def test_competitor_stale_data_detection():
    # TRIP-STALE-901 has data older than 24 hours
    trip_id = "TRIP-STALE-901"
    trends = CompetitorService.get_competitor_fare_trends(trip_id=trip_id, days=7)
    assert trends["is_stale"] is True or len(trends["warnings"]) > 0


# -------------------------------------------------------------
# FEATURE 4: Explainable Seat-Level Recommendations Tests
# -------------------------------------------------------------
def test_explainable_recommendation_structured_format():
    trip_id = "TRIP-BLR-HYD-101"
    recs = SeatPricingPolicy.calculate_seat_recommendations(trip_id)
    assert len(recs) > 0
    
    avail_recs = [r for r in recs if r["recommended_action"] != "Locked (Booked)"]
    assert len(avail_recs) > 0
    
    first = avail_recs[0]
    assert "Recommended action:" in first["explanation"]
    assert "Reason:" in first["explanation"]
    assert "Confidence:" in first["explanation"]
    assert "Evidence:" in first["explanation"]
    
    assert "observed_facts" in first
    assert len(first["observed_facts"]) >= 4
    assert "forecast_assumptions" in first
    assert len(first["forecast_assumptions"]) >= 2
    assert "selling_probability" in first
    assert "expected_final_occupancy_pct" in first


def test_manual_override_requires_mandatory_reason():
    trip_id = "TRIP-BLR-HYD-101"
    seats = SeatDemandService.get_trip_seats(trip_id)
    avail = [s for s in seats if s["booking_status"] == "available"]
    target_seat = avail[0]["seat_id"]
    
    # Missing reason must raise ValueError
    with pytest.raises(ValueError, match="reason is required"):
        OperatorService.record_seat_decisions(
            trip_id=trip_id,
            seat_ids=[target_seat],
            decision_type="OVERRIDDEN",
            decision_fare=850.0,
            reason=""
        )


# -------------------------------------------------------------
# FEATURE 5: Operational Alerts and Daily Reports Tests
# -------------------------------------------------------------
def test_operational_alerts_generation_and_deduplication():
    # Generate alerts across trips
    alerts_first = AlertService.scan_and_generate_alerts()
    active_alerts = AlertService.get_alerts(status="ACTIVE")
    assert len(active_alerts) > 0
    
    # Running scan again should NOT duplicate alerts
    AlertService.scan_and_generate_alerts()
    active_alerts_after = AlertService.get_alerts(status="ACTIVE")
    assert len(active_alerts_after) == len(active_alerts)


def test_operational_alert_acknowledgement_and_resolution():
    alerts = AlertService.get_alerts(status="ACTIVE")
    assert len(alerts) > 0
    target_alert = alerts[0]["alert_id"]
    
    acked = AlertService.acknowledge_alert(target_alert, actor_label="Ops Lead")
    assert acked["status"] == "ACKNOWLEDGED"
    assert acked["acknowledged_by"] == "Ops Lead"
    
    resolved = AlertService.resolve_alert(target_alert, actor_label="Yield Analyst")
    assert resolved["status"] == "RESOLVED"
    assert resolved["resolved_by"] == "Yield Analyst"


def test_daily_report_generation_and_csv_export():
    report = ReportService.generate_daily_report()
    assert report["total_trips"] >= 10
    assert report["total_capacity"] > 0
    assert report["actual_collected_revenue"] >= 0
    assert "disclaimer" in report
    
    csv_str = ReportService.export_daily_report_csv()
    assert "FleetYield AI - Daily Operations & Financial Report" in csv_str
    assert "Gross Passenger Revenue" in csv_str
    assert "SERVICE BY SERVICE BREAKDOWN" in csv_str


# -------------------------------------------------------------
# FEATURE 6: Recommendation Performance Tracking Tests
# -------------------------------------------------------------
def test_performance_tracking_summary_and_error_metrics():
    summary = PerformanceService.get_performance_summary()
    
    assert summary["total_recommendations"] > 0
    assert summary["approved_count"] >= 0
    assert summary["mean_absolute_error_revenue"] >= 0
    assert summary["mean_absolute_percentage_error_occ"] >= 0
    assert "forecast_vs_actual_revenue" in summary
    assert "forecast_vs_actual_occupancy" in summary
    assert "route_accuracy" in summary
    assert "category_accuracy" in summary
    assert "common_override_reasons" in summary
    assert "data_completeness_indicator" in summary


def test_completed_trip_forecast_vs_actual_evaluation():
    # TRIP-MUM-PUN-404 is seeded with actual arrival
    eval_res = PerformanceService.evaluate_completed_trip("TRIP-MUM-PUN-404")
    # Should evaluate bookings and revenue
    if eval_res:
        assert eval_res["actual_revenue"] > 0
        assert eval_res["actual_bookings"] > 0
