"""FleetYield AI - Data Models and Pydantic Schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class BookingSnapshotModel(BaseModel):
    snapshot_id: str
    trip_id: str
    captured_at: str
    booked_seats: int
    source_label: str = "Synthetic demo data"


class TripBase(BaseModel):
    trip_id: str
    route_name: str
    origin: str
    destination: str
    departure_time: str
    total_seats: int
    booked_seats: int
    base_fare: float
    current_fare: float
    min_fare: float
    max_fare: float
    data_updated_at: str
    data_source_label: str = "Synthetic demo data"
    bus_type: Optional[str] = "AC Seater"
    route_distance_km: Optional[float] = None
    operator_notes: Optional[str] = None


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    route_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    departure_time: Optional[str] = None
    total_seats: Optional[int] = None
    booked_seats: Optional[int] = None
    base_fare: Optional[float] = None
    current_fare: Optional[float] = None
    min_fare: Optional[float] = None
    max_fare: Optional[float] = None
    data_updated_at: Optional[str] = None
    bus_type: Optional[str] = None
    route_distance_km: Optional[float] = None
    operator_notes: Optional[str] = None


class TripResponse(TripBase):
    available_seats: int
    occupancy_percent: float
    is_stale: bool
    is_valid: bool
    validation_issues: List[str] = []
    demand_category: Optional[str] = None


class RecommendationModel(BaseModel):
    recommendation_id: str
    trip_id: str
    generated_at: str
    current_fare_at_generation: float
    base_fare_at_generation: float
    recommended_fare: float
    fare_difference: float
    fare_difference_pct: float
    min_fare: float
    max_fare: float
    demand_category: str
    explanation: str
    rule_applied: str
    contributing_factors: Dict[str, Any]
    booking_pace_info: str
    validation_status: str
    policy_version: str
    source_label: str = "Synthetic demo data"
    is_clamped: bool = False
    clamped_reason: Optional[str] = None
    notice: str = "Rule-based decision support; does not change passenger-facing live fares."
    evidence_quality_status: Optional[str] = "Strong data"
    evidence_quality_details: Optional[Dict[str, Any]] = None


class DecisionCreate(BaseModel):
    recommendation_id: str
    decision_type: str  # "APPROVED", "REJECTED", "OVERRIDDEN"
    decision_fare: Optional[float] = None
    reason: Optional[str] = None
    actor_label: str = "Demo operator"


class OperatorDecisionModel(BaseModel):
    decision_id: str
    recommendation_id: str
    trip_id: str
    decision_type: str
    decision_fare: Optional[float] = None
    reason: Optional[str] = None
    created_at: str
    actor_label: str


class AuditEventModel(BaseModel):
    audit_id: str
    trip_id: str
    event_type: str
    previous_fare: Optional[float] = None
    recommended_fare: Optional[float] = None
    final_decision_fare: Optional[float] = None
    reason: Optional[str] = None
    details: Optional[str] = None
    created_at: str
    rule_version: str
    data_source_label: str
    actor_label: str


class SimulationRequest(BaseModel):
    demand_multiplier: float = Field(default=1.0, ge=0.5, le=2.0)
    price_elasticity: float = Field(default=-0.5, ge=-2.0, le=0.0)
    trip_ids: Optional[List[str]] = None


class SimulationTripRow(BaseModel):
    trip_id: str
    route_name: str
    total_seats: int
    baseline_fare: float
    baseline_sold_seats: int
    baseline_revenue: float
    baseline_occupancy_pct: float
    fleetyield_fare: float
    fleetyield_sold_seats: int
    fleetyield_revenue: float
    fleetyield_occupancy_pct: float
    revenue_diff: float
    seats_diff: int
    demand_category: str


class SimulationResult(BaseModel):
    notice: str = "SIMULATED - NOT REAL-WORLD PERFORMANCE. Illustrative decision support scenario under deterministic rules."
    scenario_parameters: Dict[str, Any]
    total_trips_simulated: int
    baseline_total_revenue: float
    baseline_total_seats_sold: int
    baseline_avg_occupancy_pct: float
    baseline_unsold_seats: int
    fleetyield_total_revenue: float
    fleetyield_total_seats_sold: int
    fleetyield_avg_occupancy_pct: float
    fleetyield_unsold_seats: int
    revenue_difference: float
    revenue_difference_pct: float
    seats_sold_difference: int
    assumptions_narrative: str
    trips: List[SimulationTripRow]


class DashboardSummary(BaseModel):
    total_trips: int
    upcoming_trips: int
    total_booked_seats: int
    total_available_seats: int
    average_occupancy_pct: float
    trips_needing_review: int
    recent_activity_count: int
    data_source_label: str
    occupancy_distribution: Dict[str, int]
