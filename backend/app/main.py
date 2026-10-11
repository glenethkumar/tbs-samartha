"""FleetYield AI - FastAPI Application and REST Endpoints.

Implements all core operations for trips, validation, recommendations,
operator decisions, audit logging, simulation, and rule transparency.
"""

import os
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db, reset_and_seed_database
from app.seed import seed_data
from app.models import (
    TripResponse, TripCreate, TripUpdate,
    RecommendationModel, DecisionCreate, OperatorDecisionModel,
    AuditEventModel, SimulationRequest, SimulationResult,
    DashboardSummary, SeatDecisionCreate, WhatIfSimulateRequest
)
from app.services.trip_service import TripService
from app.services.recommendation_service import RecommendationService
from app.services.operator_service import OperatorService
from app.services.audit_service import AuditService
from app.services.simulation_service import SimulationService
from app.services.seat_demand_service import SeatDemandService
from app.services.seat_pricing_policy import SeatPricingPolicy
from app.services.trip_financial_service import TripFinancialService
from app.services.competitor_service import CompetitorService
from app.services.alert_service import AlertService
from app.services.report_service import ReportService
from app.services.performance_service import PerformanceService



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup and seed if empty
    init_db()
    trips = TripService.list_trips()
    if not trips:
        seed_data()
    yield


app = FastAPI(
    title="FleetYield AI",
    description="Explainable Bus Seat Pricing & Demand Intelligence API (TBS FleetOS)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "FleetYield AI API",
        "version": settings.POLICY_VERSION,
        "data_source": settings.DATA_SOURCE_LABEL
    }


@app.get("/api/dashboard/summary")
def get_dashboard_summary():
    return TripService.get_dashboard_summary()


@app.get("/api/trips")
def list_trips(
    q: Optional[str] = Query(None, description="Search by ID, route, origin, or destination"),
    demand: Optional[str] = Query(None, description="Filter by Low, Medium, High"),
    data_status: Optional[str] = Query(None, description="Filter by valid, stale, or invalid"),
    sort_by: str = Query("departure_time", description="Sort field: departure_time, occupancy, trip_id"),
    sort_order: str = Query("asc", description="Sort order: asc or desc")
):
    return TripService.list_trips(q=q, demand=demand, data_status=data_status, sort_by=sort_by, sort_order=sort_order)


@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str):
    trip = TripService.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found")
    return trip


@app.post("/api/trips", status_code=status.HTTP_201_CREATED)
def create_trip(payload: TripCreate):
    try:
        new_trip = TripService.create_trip(payload.model_dump())
        return new_trip
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/trips/{trip_id}")
def update_trip(trip_id: str, payload: TripUpdate):
    try:
        updated = TripService.update_trip(trip_id, payload.model_dump(exclude_unset=True))
        return updated
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/recommendations/generate")
def generate_recommendation(payload: dict):
    trip_id = payload.get("trip_id")
    if not trip_id:
        raise HTTPException(status_code=400, detail="trip_id is required in request body")
    try:
        rec = RecommendationService.generate_recommendation(trip_id)
        return rec
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/decisions", status_code=status.HTTP_201_CREATED)
def record_decision(payload: DecisionCreate):
    try:
        decision = OperatorService.record_decision(
            recommendation_id=payload.recommendation_id,
            decision_type=payload.decision_type,
            decision_fare=payload.decision_fare,
            reason=payload.reason,
            actor_label=payload.actor_label
        )
        return decision
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/audit-events")
def list_audit_events(
    trip_id: Optional[str] = Query(None, description="Filter by trip ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    limit: int = Query(100, ge=1, le=500)
):
    return AuditService.get_events(trip_id=trip_id, event_type=event_type, limit=limit)


@app.get("/api/audit-events/types")
def list_audit_event_types():
    return AuditService.get_event_types()


@app.post("/api/simulation/run")
def run_simulation(payload: SimulationRequest):
    try:
        res = SimulationService.run_simulation(
            demand_multiplier=payload.demand_multiplier,
            price_elasticity=payload.price_elasticity,
            trip_ids=payload.trip_ids
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/assumptions")
def get_assumptions():
    return settings.get_assumptions_summary()


@app.get("/api/trips/{trip_id}/competitors")
def get_trip_competitors(trip_id: str):
    from app.services.competitor_service import CompetitorService
    summary = CompetitorService.get_competitor_summary(trip_id)
    return summary


@app.get("/api/trips/{trip_id}/seats")
def get_trip_seats(trip_id: str):
    trip = TripService.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found")

    seats = SeatDemandService.get_trip_seats(trip_id)
    demand_analysis = SeatDemandService.analyze_category_demand(trip_id)
    recs = SeatPricingPolicy.get_latest_seat_recommendations(trip_id)
    if not recs:
        # Generate initial recommendations if none exist
        recs = SeatPricingPolicy.calculate_seat_recommendations(trip_id)
        SeatPricingPolicy.persist_seat_recommendations(recs)
        recs = SeatPricingPolicy.get_latest_seat_recommendations(trip_id)

    decks = sorted(list(set(s["deck"] for s in seats)))
    booked_count = sum(1 for s in seats if s["booking_status"] == "booked")
    available_count = len(seats) - booked_count

    from app.services.competitor_service import CompetitorService
    comp_summary = CompetitorService.get_competitor_summary(trip_id)

    return {
        "trip_id": trip_id,
        "trip": trip,
        "bus_type": trip.get("bus_type", "AC Seater"),
        "deck_count": len(decks),
        "decks_available": decks,
        "total_seats": len(seats),
        "booked_seats": booked_count,
        "available_seats": available_count,
        "seats": seats,
        "seat_recommendations": recs,
        "category_summaries": demand_analysis.get("categories", {}),
        "patterns": demand_analysis.get("patterns", {}),
        "confidence_score": demand_analysis.get("confidence_score", "Heuristic estimate"),
        "competitor_category_benchmarks": comp_summary
    }


@app.get("/api/trips/{trip_id}/financials")
def get_trip_financials(trip_id: str):
    trip = TripService.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found")
    try:
        financials = TripFinancialService.calculate_trip_financials(trip_id)
        return financials
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/trips/{trip_id}/seat-recommendations/generate")
def generate_seat_recommendations(trip_id: str):
    trip = TripService.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found")
    try:
        recs = SeatPricingPolicy.calculate_seat_recommendations(trip_id)
        SeatPricingPolicy.persist_seat_recommendations(recs)
        persisted = SeatPricingPolicy.get_latest_seat_recommendations(trip_id)
        financials = TripFinancialService.calculate_trip_financials(trip_id, seat_recommendations=persisted)
        return {
            "trip_id": trip_id,
            "seat_recommendations": persisted,
            "financials": financials,
            "count": len(persisted)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/trips/{trip_id}/seat-decisions", status_code=status.HTTP_201_CREATED)
def record_seat_decisions(trip_id: str, payload: SeatDecisionCreate):
    try:
        res = OperatorService.record_seat_decisions(
            trip_id=trip_id,
            seat_ids=payload.seat_ids,
            decision_type=payload.decision_type,
            decision_fare=payload.decision_fare,
            reason=payload.reason,
            actor_label=payload.actor_label
        )
        return res
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/competitor-fares/import-csv")
def import_competitor_csv(payload: dict):
    from app.services.competitor_service import CompetitorService
    csv_text = payload.get("csv_content", "")
    is_simulated = payload.get("is_simulated", False)
    if not csv_text or not csv_text.strip():
        raise HTTPException(status_code=400, detail="csv_content cannot be empty")
    result = CompetitorService.import_csv(csv_text, is_simulated=is_simulated)
    return result


@app.post("/api/competitor-fares/reset-sample")
def reset_competitor_sample():
    from app.services.competitor_service import CompetitorService
    count = CompetitorService.seed_sample_competitors()
    return {
        "message": f"Successfully re-seeded {count} sample competitor listings across active corridors.",
        "count": count
    }


@app.post("/api/database/reset")
def reset_database():
    reset_and_seed_database()
    return {"message": "Database successfully reset and re-seeded with synthetic demo data."}


# -------------------------------------------------------------
# FEATURE 2: WHAT-IF REVENUE AND PROFIT SIMULATOR ENDPOINT
# -------------------------------------------------------------
@app.post("/api/trips/{trip_id}/what-if-simulate")
def simulate_trip_what_if(trip_id: str, payload: WhatIfSimulateRequest):
    trip = TripService.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found")
    try:
        res = TripFinancialService.simulate_what_if(
            trip_id=trip_id,
            manual_target_fare=payload.manual_target_fare,
            manual_adjustment_pct=payload.manual_adjustment_pct,
            custom_seat_fares=payload.custom_seat_fares,
            expense_overrides=payload.expense_overrides,
            scenario_type=payload.scenario_type
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# FEATURE 3: HISTORICAL COMPETITOR FARE TRACKING ENDPOINTS
# -------------------------------------------------------------
@app.get("/api/trips/{trip_id}/competitor-trends")
def get_trip_competitor_trends(trip_id: str, days: int = Query(7, ge=1, le=30)):
    try:
        trends = CompetitorService.get_competitor_fare_trends(trip_id=trip_id, days=days)
        return trends
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# FEATURE 5: OPERATIONAL ALERTS & DAILY REPORTS ENDPOINTS
# -------------------------------------------------------------
@app.get("/api/alerts")
def get_operational_alerts(
    status: Optional[str] = Query(None, description="Filter by ACTIVE, ACKNOWLEDGED, RESOLVED"),
    severity: Optional[str] = Query(None, description="Filter by CRITICAL, WARNING, INFO"),
    trip_id: Optional[str] = Query(None, description="Filter by trip ID"),
    trigger_scan: bool = Query(True, description="Automatically scan trips for fresh alerts")
):
    if trigger_scan:
        AlertService.scan_and_generate_alerts(trip_id=trip_id)
    return AlertService.get_alerts(status=status, severity=severity, trip_id=trip_id)


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_operational_alert(alert_id: str, payload: dict = None):
    actor = (payload or {}).get("actor_label", "Demo operator")
    try:
        return AlertService.acknowledge_alert(alert_id=alert_id, actor_label=actor)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/alerts/{alert_id}/resolve")
def resolve_operational_alert(alert_id: str, payload: dict = None):
    actor = (payload or {}).get("actor_label", "Demo operator")
    try:
        return AlertService.resolve_alert(alert_id=alert_id, actor_label=actor)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/reports/daily")
def get_daily_operations_report(date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format")):
    try:
        report = ReportService.generate_daily_report(report_date=date)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/daily/export-csv")
def export_daily_operations_report_csv(date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format")):
    try:
        csv_content = ReportService.export_daily_report_csv(report_date=date)
        filename = f"fleetyield_daily_report_{date or 'today'}.csv"
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# FEATURE 6: RECOMMENDATION PERFORMANCE TRACKING ENDPOINT
# -------------------------------------------------------------
@app.get("/api/performance/summary")
def get_recommendation_performance_summary():
    try:
        return PerformanceService.get_performance_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# Mount built frontend if dist directory exists
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
