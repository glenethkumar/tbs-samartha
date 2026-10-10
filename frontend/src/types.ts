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

export type EvidenceQualityStatus = "Strong data" | "Limited data" | "Insufficient data";

export interface EvidenceQualityDetails {
  status: EvidenceQualityStatus;
  status_code: "STRONG" | "LIMITED" | "INSUFFICIENT" | string;
  can_recommend: boolean;
  explanation: string;
  occupancy: {
    value_pct: number;
    threshold_used: string;
    band: string;
  };
  booking_pace: {
    available: boolean;
    pace_per_hour?: number | null;
    observation_window?: string | null;
    window_hours?: number | null;
    window_start?: string | null;
    window_end?: string | null;
    snapshots_evaluated?: number;
    seats_delta?: number | null;
    description?: string;
  };
  departure: {
    departure_time: string;
    hours_remaining?: number | null;
    label: string;
  };
  data_freshness: {
    data_updated_at: string;
    age_hours?: number | null;
    threshold_hours: number;
    is_stale: boolean;
  };
  input_diagnostics: {
    is_valid: boolean;
    is_stale: boolean;
    issues: string[];
  };
  fare_constraints: {
    min_fare: number;
    max_fare: number;
    current_fare: number;
    base_fare: number;
    raw_calculated_fare?: number;
    rounding_increment?: number;
    recommended_fare: number;
    is_clamped: boolean;
    clamped_reason?: string | null;
    suggested_band?: { low: number; high: number };
  };
  applicable_rules: string[];
  competitor_benchmark?: {
    sample_size: number;
    median_fare?: number | null;
    min_fare?: number | null;
    max_fare?: number | null;
    current_fare_diff_vs_median?: number | null;
    current_fare_diff_vs_median_pct?: number | null;
    market_position: string;
    platforms?: string[];
  };
}

export type PricingAction = "Increase fare" | "Decrease fare" | "Maintain fare";

export interface CompetitorFare {
  competitor_fare_id: string;
  trip_id?: string | null;
  origin: string;
  destination: string;
  route_name?: string | null;
  departure_time: string;
  bus_type: string;
  operator_name: string;
  platform: "RedBus" | "AbhiBus" | string;
  fare: number;
  currency: string;
  available_seats: number;
  rating: number;
  review_count: number;
  amenities: string[];
  is_simulated: boolean;
  data_source_label: string;
  captured_at: string;
}

export interface CompetitorPriceSummary {
  sample_size: number;
  median_fare?: number | null;
  min_fare?: number | null;
  max_fare?: number | null;
  average_fare?: number | null;
  cheapest_operator?: string | null;
  cheapest_platform?: string | null;
  cheapest_fare?: number | null;
  premium_operator?: string | null;
  premium_platform?: string | null;
  premium_fare?: number | null;
  current_fare_diff_vs_median?: number | null;
  current_fare_diff_vs_median_pct?: number | null;
  market_position: string;
  platforms_represented: string[];
  comparable_competitors: CompetitorFare[];
  matching_criteria?: Record<string, any>;
}

export interface Recommendation {
  recommendation_id: string;
  trip_id: string;
  generated_at: string;
  current_fare_at_generation: number;
  base_fare_at_generation: number;
  recommended_fare: number;
  recommended_action?: PricingAction | string;
  competitor_summary?: CompetitorPriceSummary | null;
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
  evidence_quality_status?: EvidenceQualityStatus | string;
  evidence_quality_explanation?: string;
  evidence_quality_details?: EvidenceQualityDetails;
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
  recommended_action?: PricingAction | string;
  competitor_summary?: CompetitorPriceSummary | null;
}

export interface CompetitorCsvImportResult {
  success: boolean;
  records_imported: number;
  records_rejected: number;
  errors: string[];
  message: string;
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
  dynamic_underperforms_baseline?: boolean;
  underperformance_note?: string | null;
  truthfulness_statement?: string;
  benchmark_scenarios?: Array<{
    id: string;
    name: string;
    demand_multiplier: number;
    price_elasticity: number;
    description: string;
  }>;
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
