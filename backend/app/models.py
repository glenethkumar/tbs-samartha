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
    # Journey timing attributes
    scheduled_arrival_time: Optional[str] = None
    estimated_duration_hours: Optional[float] = None
    expected_arrival_time: Optional[str] = None
    actual_arrival_time: Optional[str] = None
    stop_count: Optional[int] = 2
    service_category: Optional[str] = "regular"  # "express" | "limited_stop" | "regular"
    arrival_convenience_label: Optional[str] = None
    # Bus ratings and quality
    average_rating: Optional[float] = 4.2
    review_count: Optional[int] = 1200
    rating_source: Optional[str] = "Consolidated (RedBus & AbhiBus)"
    rating_updated_at: Optional[str] = None
    amenities: List[str] = []
    on_time_performance_pct: Optional[float] = 92.0
    cancellation_rate_pct: Optional[float] = 1.5
    service_quality_score: Optional[float] = 4.3


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
    scheduled_arrival_time: Optional[str] = None
    estimated_duration_hours: Optional[float] = None
    stop_count: Optional[int] = None
    service_category: Optional[str] = None
    average_rating: Optional[float] = None
    amenities: Optional[List[str]] = None


class TripResponse(TripBase):
    available_seats: int
    occupancy_percent: float
    is_stale: bool
    is_valid: bool
    validation_issues: List[str] = []
    demand_category: Optional[str] = None


class CompetitorFareModel(BaseModel):
    competitor_fare_id: str
    trip_id: Optional[str] = None
    origin: str
    destination: str
    route_name: Optional[str] = None
    departure_time: str
    bus_type: str
    operator_name: str
    platform: str  # "RedBus" | "AbhiBus"
    fare: float
    currency: str = "INR"
    available_seats: int = 20
    rating: float = 4.2
    review_count: int = 1200
    amenities: List[str] = []
    # Journey timing & comparable matching
    journey_duration_hours: Optional[float] = None
    scheduled_arrival_time: Optional[str] = None
    service_category: str = "regular"
    seat_type: str = "sleeper"
    berth_type: str = "lower"
    sleeper_arrangement: str = "single"  # "single" | "sharing" | "none"
    seat_position: str = "middle"
    additional_fees: float = 0.0
    comparability_notes: Optional[str] = None
    is_simulated: bool = True
    data_source_label: str = "Synthetic competitor data (RedBus & AbhiBus SeatSeller schema)"
    captured_at: str


class CompetitorPriceSummary(BaseModel):
    sample_size: int
    median_fare: Optional[float] = None
    min_fare: Optional[float] = None
    max_fare: Optional[float] = None
    average_fare: Optional[float] = None
    cheapest_operator: Optional[str] = None
    cheapest_platform: Optional[str] = None
    premium_operator: Optional[str] = None
    premium_platform: Optional[str] = None
    current_fare_diff_vs_median: Optional[float] = None
    current_fare_diff_vs_median_pct: Optional[float] = None
    market_position: str = "No data"
    platforms_represented: List[str] = []
    comparable_competitors: List[CompetitorFareModel] = []
    matching_criteria: Dict[str, Any] = {}
    conclusion_action: Optional[str] = None  # "Increase fare", "Decrease fare", "Maintain fare"
    conclusion_headline: Optional[str] = None
    conclusion_reason: Optional[str] = None
    comparability_warnings: List[str] = []
    category_benchmarks: Dict[str, Any] = {}


class CompetitorCsvImportResult(BaseModel):
    success: bool
    records_imported: int
    records_rejected: int
    errors: List[str] = []
    message: str


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
    recommended_action: Optional[str] = "Maintain fare"  # "Increase fare", "Decrease fare", "Maintain fare"
    competitor_summary: Optional[Dict[str, Any]] = None


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


# --- Seat-Level Inventory & Pricing Models ---

class TripSeatModel(BaseModel):
    seat_id: str
    trip_id: str
    seat_number: str
    deck: str = "lower"  # 'lower', 'upper', 'main'
    row_idx: int
    col_idx: int
    position: str  # 'front', 'middle', 'back'
    seat_type: str  # 'sitting', 'sleeper', 'semi-sleeper'
    berth_type: str = "none"  # 'lower', 'upper', 'none'
    sleeper_arrangement: str = "none"  # 'single', 'sharing', 'none'
    max_occupants: int = 1
    privacy_level: str = "standard"  # 'private', 'semi_private', 'standard'
    is_ac: int = 1
    bus_category: str = "Sleeper"
    base_fare: float
    current_fare: float
    min_fare: float
    max_fare: float
    booking_status: str = "available"  # 'available', 'booked', 'blocked'
    booked_at: Optional[str] = None
    collected_fare: Optional[float] = None
    passenger_gender: Optional[str] = None


class TripExpenseModel(BaseModel):
    trip_id: str
    fuel_cost: float
    driver_wages: float
    conductor_wages: float
    toll_charges: float
    platform_commission_pct: float = 8.0
    maintenance_allocation: float
    permits_and_taxes: float
    other_costs: float = 0.0
    is_estimated: bool = True
    notes: Optional[str] = None
    total_fixed_expenses: float = 0.0


class SeatRecommendationModel(BaseModel):
    seat_recommendation_id: str
    recommendation_id: str
    trip_id: str
    seat_id: str
    seat_number: str
    category_key: str
    current_fare: float
    recommended_fare: float
    recommended_action: str  # 'Increase fare', 'Decrease fare', 'Maintain fare', 'Locked (Booked)'
    fare_difference: float
    fare_difference_pct: float
    rule_applied: str
    explanation: str
    demand_category: str
    booking_velocity: float = 0.0
    competitor_median_for_category: Optional[float] = None
    confidence_score: str = "Heuristic estimate"
    warnings: List[str] = []
    decision_status: str = "PENDING"  # 'PENDING', 'APPROVED', 'REJECTED', 'OVERRIDDEN'
    approved_fare: Optional[float] = None
    created_at: str
    # Factor breakdown
    sleeper_arrangement: str = "none"
    timing_factor_pct: float = 0.0
    quality_factor_pct: float = 0.0
    arrangement_factor_pct: float = 0.0
    break_even_impact: Optional[str] = ""


class SeatDecisionCreate(BaseModel):
    seat_ids: List[str]
    decision_type: str  # 'APPROVED', 'REJECTED', 'OVERRIDDEN'
    decision_fare: Optional[float] = None
    reason: Optional[str] = None
    actor_label: str = "Demo operator"


class TripFinancialScenario(BaseModel):
    scenario_name: str  # 'Conservative', 'Base Case', 'Optimistic'
    description: str
    demand_factor: float
    expected_additional_bookings: int
    forecast_additional_revenue: float
    total_expected_revenue: float
    total_expenses: float
    net_profit: float
    profit_margin_pct: float
    projected_occupancy_pct: float


class TripFinancialsResponse(BaseModel):
    trip_id: str
    capacity: int
    current_booked_seats: int
    current_booked_revenue: float
    average_collected_fare: float
    expenses: TripExpenseModel
    total_operating_expenses: float
    break_even_revenue: float
    break_even_occupancy_pct: float
    current_pricing_plan: Dict[str, Any]
    proposed_dynamic_plan: Dict[str, Any]
    scenarios: List[TripFinancialScenario]
    disclaimer: str = "SIMULATED FINANCIAL PROJECTION - NOT GUARANTEED PROFIT. Actual realization depends on live passenger demand and market conditions."


class SeatMapResponse(BaseModel):
    trip_id: str
    bus_type: str
    deck_count: int
    decks_available: List[str]
    total_seats: int
    booked_seats: int
    available_seats: int
    seats: List[TripSeatModel]
    seat_recommendations: List[SeatRecommendationModel]
    category_summaries: Dict[str, Any]
    competitor_category_benchmarks: Dict[str, Any]


class WhatIfSimulateRequest(BaseModel):
    manual_target_fare: Optional[float] = None
    manual_adjustment_pct: Optional[float] = None
    custom_seat_fares: Optional[Dict[str, float]] = None
    expense_overrides: Optional[Dict[str, float]] = None
    scenario_type: str = "Base Case"  # "Conservative", "Base Case", "Optimistic"


class OperationalAlertModel(BaseModel):
    alert_id: str
    trip_id: str
    seat_id: Optional[str] = None
    severity: str  # 'CRITICAL', 'WARNING', 'INFO'
    alert_type: str
    title: str
    message: str
    status: str = "ACTIVE"  # 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'
    created_at: str
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None


class DailyReportSummary(BaseModel):
    report_date: str
    generated_at: str
    total_trips: int
    completed_trips: int
    active_trips: int
    total_capacity: int
    booked_seats: int
    available_seats: int
    average_occupancy_pct: float
    actual_collected_revenue: float
    recorded_discounts_refunds: float
    total_operating_expenses: float
    net_operating_profit: float
    overall_profit_margin_pct: float
    forecast_total_revenue: float
    forecast_net_profit: float
    active_alerts_count: int
    pending_recommendations_count: int
    trips_with_unreliable_data: int
    trip_summaries: List[Dict[str, Any]] = []
    disclaimer: str = "AUDITED OPERATIONAL REPORT. Distinguishes realized transactions from predictive forecasts."


class PerformanceSummaryModel(BaseModel):
    total_recommendations: int
    approved_count: int
    rejected_count: int
    overridden_count: int
    pending_count: int
    approval_rate_pct: float
    completed_trips_evaluated: int
    mean_absolute_error_revenue: float
    mean_absolute_percentage_error_occ: float
    revenue_forecast_accuracy_pct: float
    forecast_vs_actual_revenue: Dict[str, float]
    forecast_vs_actual_occupancy: Dict[str, float]
    forecast_vs_actual_profit: Dict[str, float]
    route_accuracy: List[Dict[str, Any]] = []
    category_accuracy: List[Dict[str, Any]] = []
    common_override_reasons: List[Dict[str, Any]] = []
    data_completeness_indicator: str
    disclaimer: str = "HISTORICAL RECOMMENDATION OUTCOME EVALUATION. Evaluates predictive forecast fidelity against completed trip realization."

