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
  journey_duration_hours?: number | null;
  scheduled_arrival_time?: string | null;
  service_category?: string | null;
  seat_type?: string | null;
  berth_type?: string | null;
  sleeper_arrangement?: string | null;
  seat_position?: string | null;
  additional_fees?: number;
  comparability_notes?: string | null;
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
  category_benchmarks?: Record<string, { count: number; median: number; min: number; max: number }>;
  comparability_warnings?: string[];
  matching_criteria?: Record<string, any>;
  conclusion_action?: PricingAction | string;
  conclusion_headline?: string;
  conclusion_reason?: string;
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
  scheduled_arrival_time?: string;
  estimated_duration_hours?: number;
  expected_arrival_time?: string;
  actual_arrival_time?: string;
  stop_count?: number;
  service_category?: string;
  arrival_convenience_label?: string;
  average_rating?: number;
  review_count?: number;
  rating_source?: string;
  rating_updated_at?: string;
  amenities?: string[] | string;
  on_time_performance_pct?: number;
  cancellation_rate_pct?: number;
  service_quality_score?: number;
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

export interface TripSeat {
  seat_id: string;
  trip_id: string;
  seat_number: string;
  deck: 'lower' | 'upper' | 'main' | string;
  row_idx: number;
  col_idx: number;
  position: 'front' | 'middle' | 'back' | string;
  seat_type: 'sitting' | 'sleeper' | 'semi-sleeper' | string;
  berth_type: 'lower' | 'upper' | 'none' | string;
  sleeper_arrangement: 'single' | 'sharing' | 'none' | string;
  max_occupants: number;
  privacy_level: 'private' | 'semi_private' | 'standard' | string;
  is_ac: number | boolean;
  bus_category: string;
  base_fare: number;
  current_fare: number;
  min_fare: number;
  max_fare: number;
  booking_status: 'available' | 'booked' | 'blocked' | string;
  booked_at?: string | null;
  collected_fare?: number | null;
  passenger_gender?: string | null;
}

export interface SeatRecommendation {
  seat_recommendation_id: string;
  recommendation_id: string;
  trip_id: string;
  seat_id: string;
  seat_number: string;
  category_key: string;
  current_fare: number;
  recommended_fare: number;
  recommended_action: 'Increase fare' | 'Decrease fare' | 'Maintain fare' | 'Locked (Booked)' | string;
  fare_difference: number;
  fare_difference_pct: number;
  rule_applied: string;
  explanation: string;
  demand_category: string;
  demand_level?: string | null;
  booking_velocity: number;
  selling_probability?: number | null;
  expected_final_occupancy_pct?: number | null;
  competitor_median_for_category?: number | null;
  confidence_score: string;
  warnings: string[];
  observed_facts?: string[];
  forecast_assumptions?: string[];
  decision_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN' | string;
  approved_fare?: number | null;
  created_at: string;
  timing_factor_pct?: number;
  quality_factor_pct?: number;
  arrangement_factor_pct?: number;
  break_even_impact?: string;
}

export interface WhatIfSimulateRequest {
  manual_target_fare?: number | null;
  manual_adjustment_pct?: number | null;
  custom_seat_fares?: Record<string, number> | null;
  expense_overrides?: Record<string, number> | null;
  scenario_type?: 'expected' | 'conservative' | 'optimistic' | string;
}

export interface WhatIfPlanMetrics {
  label: string;
  average_available_fare: number;
  expected_additional_bookings: number;
  expected_final_occupancy_pct: number;
  gross_ticket_sales: number;
  discounts_and_refunds: number;
  net_ticket_revenue: number;
  platform_commission: number;
  operating_expenses: number;
  operating_profit_loss: number;
  profit_margin_pct: number;
  revenue_per_occupied_seat: number;
  revenue_difference_vs_current?: number;
  profit_difference_vs_current?: number;
  is_profitable: boolean;
  scenario_type?: string;
  warnings?: string[];
}

export interface WhatIfSimulateResponse {
  trip_id: string;
  total_seats: number;
  actual_booked_seats: number;
  actual_booked_revenue: number;
  actual_occupancy_pct: number;
  break_even_revenue: number;
  break_even_occupancy_pct: number;
  expenses: Record<string, any>;
  scenarios_comparison: {
    current_pricing: WhatIfPlanMetrics;
    recommended_pricing: WhatIfPlanMetrics;
    manual_alternative: WhatIfPlanMetrics;
  };
  multi_case_forecasts: Array<{
    name: string;
    description: string;
    expected_additional_bookings: number;
    expected_final_occupancy_pct: number;
    gross_sales: number;
    net_revenue: number;
    expenses: number;
    operating_profit: number;
    margin_pct: number;
  }>;
  assumptions_explained: string[];
}

export interface CompetitorTimelinePoint {
  date: string;
  median_fare: number;
  min_fare: number;
  max_fare: number;
  average_fare: number;
  our_fare: number;
  sample_count: number;
  operator_fares: Record<string, number>;
  difference_vs_our_fare: number;
}

export interface CompetitorPriceShift {
  operator_name: string;
  platform: string;
  earliest_fare: number;
  latest_fare: number;
  fare_difference: number;
  fare_difference_pct: number;
  shift_type: 'INCREASE' | 'DECREASE' | string;
  is_unusual_movement: boolean;
  earliest_date: string;
  latest_date: string;
}

export interface CompetitorTrendResponse {
  trip_id: string;
  origin: string;
  destination: string;
  our_current_fare: number;
  trend_days: number;
  total_observations: number;
  overall_comparable_median: number;
  overall_comparable_min: number;
  overall_comparable_max: number;
  our_fare_vs_median_diff: number;
  timeline: CompetitorTimelinePoint[];
  recent_price_shifts: CompetitorPriceShift[];
  incomparable_services: Array<{
    operator_name: string;
    platform: string;
    fare: number;
    reason: string;
  }>;
  is_stale: boolean;
  last_captured_at?: string;
  freshness_status: string;
  warnings: string[];
}

export interface OperationalAlert {
  alert_id: string;
  trip_id?: string | null;
  seat_id?: string | null;
  seat_number?: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | string;
  category: string;
  title: string;
  message: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | string;
  created_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  acknowledged_by?: string | null;
}

export interface DailyReportTripSummary {
  trip_id: string;
  route_name: string;
  departure_time: string;
  total_seats: number;
  booked_seats: number;
  occupancy_pct: number;
  collected_revenue: number;
  expenses: number;
  actual_net_profit: number;
  status: string;
  forecast_revenue?: number | null;
  forecast_occupancy_pct?: number | null;
  forecast_error_revenue?: number | null;
  data_reliable: boolean;
}

export interface DailyOperationsReport {
  report_date: string;
  total_trips: number;
  completed_trips: number;
  upcoming_trips: number;
  total_seats: number;
  total_booked_seats: number;
  overall_occupancy_pct: number;
  actual_ticket_revenue: number;
  discounts_and_refunds: number;
  total_operating_expenses: number;
  actual_operating_profit: number;
  profit_margin_pct: number;
  forecast_vs_actual: {
    forecast_total_revenue: number;
    actual_total_revenue: number;
    revenue_variance: number;
    forecast_avg_occupancy_pct: number;
    actual_avg_occupancy_pct: number;
    occupancy_variance_pct: number;
  };
  pending_recommendations_count: number;
  active_alerts_count: number;
  unreliable_data_trips_count: number;
  trips: DailyReportTripSummary[];
  notice: string;
}

export interface PerformanceSummary {
  total_recommendations: number;
  approved_count: number;
  rejected_count: number;
  overridden_count: number;
  pending_count: number;
  approval_rate_pct: number;
  completed_trips_evaluated: number;
  revenue_forecast_metrics: {
    sample_size: number;
    mean_absolute_error: number;
    mean_absolute_pct_error: number;
    direction_accuracy_pct: number;
  };
  occupancy_forecast_metrics: {
    sample_size: number;
    mean_absolute_error: number;
    mean_absolute_pct_error: number;
  };
  profit_forecast_metrics?: {
    sample_size: number;
    mean_absolute_error: number;
    mean_absolute_pct_error: number;
  } | null;
  route_performance: Record<string, {
    total_recs: number;
    approved: number;
    revenue_mae?: number | null;
    revenue_mape?: number | null;
  }>;
  category_performance: Record<string, {
    total_recs: number;
    approved: number;
    revenue_mae?: number | null;
    revenue_mape?: number | null;
  }>;
  common_override_reasons: Array<{
    reason: string;
    count: number;
  }>;
  data_confidence: {
    status: string;
    notes: string;
  };
}

export interface TripExpense {
  trip_id: string;
  fuel_cost: number;
  driver_wages: number;
  conductor_wages: number;
  toll_charges: number;
  platform_commission_pct: number;
  maintenance_allocation: number;
  permits_and_taxes: number;
  other_costs: number;
  is_estimated: boolean;
  total_fixed_expenses: number;
  notes?: string | null;
}

export interface TripFinancialScenario {
  scenario_name: 'Conservative' | 'Base Case' | 'Optimistic' | string;
  description: string;
  demand_factor: number;
  expected_additional_bookings: number;
  forecast_additional_revenue: number;
  total_expected_revenue: number;
  total_expenses: number;
  net_profit: number;
  profit_margin_pct: number;
  projected_occupancy_pct: number;
}

export interface TripFinancials {
  trip_id: string;
  capacity: number;
  current_booked_seats: number;
  current_booked_revenue: number;
  average_collected_fare: number;
  expenses: TripExpense;
  total_operating_expenses: number;
  break_even_revenue: number;
  break_even_occupancy_pct: number;
  current_pricing_plan: {
    expected_additional_bookings: number;
    forecast_remaining_revenue: number;
    expected_total_revenue: number;
    expected_operating_expenses: number;
    expected_net_profit: number;
    profit_margin_pct: number;
    expected_occupancy_pct: number;
  };
  proposed_dynamic_plan: {
    expected_additional_bookings: number;
    forecast_remaining_revenue: number;
    expected_total_revenue: number;
    expected_operating_expenses: number;
    expected_net_profit: number;
    profit_margin_pct: number;
    expected_occupancy_pct: number;
    revenue_lift: number;
    profit_lift: number;
  };
  scenarios: TripFinancialScenario[];
  disclaimer: string;
}

export interface SeatMapData {
  trip_id: string;
  trip?: Trip;
  bus_type: string;
  deck_count: number;
  decks_available: string[];
  total_seats: number;
  booked_seats: number;
  available_seats: number;
  seats: TripSeat[];
  seat_recommendations: SeatRecommendation[];
  category_summaries: Record<string, any>;
  patterns: {
    single_premium_warranted?: boolean;
    single_evidence_note?: string;
    lower_premium_warranted?: boolean;
    lower_evidence_note?: string;
    front_premium_warranted?: boolean;
    back_discount_warranted?: boolean;
    position_evidence_note?: string;
  };
  confidence_score: string;
  competitor_category_benchmarks?: any;
}

export interface SeatDecisionPayload {
  seat_ids: string[];
  decision_type: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
  decision_fare?: number;
  reason?: string;
  actor_label?: string;
}
