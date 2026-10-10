export interface BookingSnapshot {
  snapshot_id: string;
  trip_id: string;
  captured_at: string;
  booked_seats: number;
  source_label: string;
}

export interface OperatorDecision {
  decision_id: string;
  recommendation_id: string;
  trip_id: string;
  decision_type: "APPROVED" | "REJECTED" | "OVERRIDDEN" | string;
  decision_fare?: number | null;
  reason?: string | null;
  created_at: string;
  actor_label: string;
}

export interface Recommendation {
  recommendation_id: string;
  trip_id: string;
  generated_at: string;
  current_fare_at_generation: number;
  base_fare_at_generation: number;
  recommended_fare: number;
  fare_difference: number;
  fare_difference_pct: number;
  min_fare: number;
  max_fare: number;
  demand_category: "Low" | "Medium" | "High" | "Blocked" | string;
  explanation: string;
  rule_applied: string;
  contributing_factors: Record<string, any>;
  booking_pace_info: string;
  validation_status: "VALID" | "WARNING" | "BLOCKED" | string;
  policy_version: string;
  source_label: string;
  is_clamped: boolean;
  clamped_reason?: string | null;
  notice: string;
}

export interface Trip {
  trip_id: string;
  route_name: string;
  origin: string;
  destination: string;
  departure_time: string;
  total_seats: number;
  booked_seats: number;
  base_fare: number;
  current_fare: number;
  min_fare: number;
  max_fare: number;
  data_updated_at: string;
  data_source_label: string;
  bus_type?: string;
  route_distance_km?: number;
  operator_notes?: string;
  available_seats: number;
  occupancy_percent: number;
  is_stale: boolean;
  is_valid: boolean;
  can_recommend: boolean;
  validation_issues: string[];
  demand_category?: string;
  snapshot_count?: number;
  snapshots?: BookingSnapshot[];
  latest_recommendation?: Recommendation | null;
  decisions?: OperatorDecision[];
}

export interface DashboardSummary {
  total_trips: number;
  upcoming_trips: number;
  total_booked_seats: number;
  total_available_seats: number;
  average_occupancy_pct: number;
  trips_needing_review: number;
  recent_activity_count: number;
  data_source_label: string;
  occupancy_distribution: {
    low: number;
    medium: number;
    high: number;
    invalid: number;
  };
}

export interface AuditEvent {
  audit_id: string;
  trip_id: string;
  event_type: string;
  previous_fare?: number | null;
  recommended_fare?: number | null;
  final_decision_fare?: number | null;
  reason?: string | null;
  details?: string | null;
  created_at: string;
  rule_version: string;
  data_source_label: string;
  actor_label: string;
}

export interface SimulationTripRow {
  trip_id: string;
  route_name: string;
  total_seats: number;
  demand_category: string;
  baseline_fare: number;
  baseline_sold_seats: number;
  baseline_revenue: number;
  baseline_occupancy_pct: number;
  fleetyield_fare: number;
  fleetyield_sold_seats: number;
  fleetyield_revenue: number;
  fleetyield_occupancy_pct: number;
  revenue_diff: number;
  seats_diff: number;
}

export interface SimulationResult {
  notice: string;
  scenario_parameters: {
    demand_multiplier: number;
    price_elasticity: number;
    valid_trips_simulated: number;
    elasticity_formula: string;
    capacity_constraint: string;
  };
  total_trips_simulated: number;
  baseline_total_revenue: number;
  baseline_total_seats_sold: number;
  baseline_avg_occupancy_pct: number;
  baseline_unsold_seats: number;
  fleetyield_total_revenue: number;
  fleetyield_total_seats_sold: number;
  fleetyield_avg_occupancy_pct: number;
  fleetyield_unsold_seats: number;
  revenue_difference: number;
  revenue_difference_pct: number;
  seats_sold_difference: number;
  assumptions_narrative: string;
  trips: SimulationTripRow[];
}

export interface AssumptionsSummary {
  policy_version: string;
  data_source_label: string;
  stale_data_threshold_hours: number;
  demand_thresholds: {
    low_occupancy_max: number;
    high_occupancy_min: number;
    description: string;
  };
  pricing_rules: {
    low_demand_adjustment_pct: number;
    medium_demand_adjustment_pct: number;
    high_demand_adjustment_pct: number;
    rounding_increment_inr: number;
    clamping: string;
    rounding_check: string;
  };
  booking_pace_rule: {
    min_snapshots_required: number;
    fallback: string;
  };
  baseline_simulation_rules: {
    elasticity_coefficient: number;
    description: string;
    notice: string;
  };
}
