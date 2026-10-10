"""FleetYield AI - Centralized Rule Configuration.

Contains all documented deterministic rules, thresholds, and simulation parameters.
All values are prototype assumptions and clearly labeled as such.
"""

from typing import Dict, Any


class Settings:
    POLICY_VERSION: str = "v1.0-deterministic-rule"
    DATA_SOURCE_LABEL: str = "Synthetic demo data"
    CURRENCY_SYMBOL: str = "₹"
    CURRENCY_CODE: str = "INR"

    # Data freshness threshold (in hours). Configurable prototype assumption.
    STALE_DATA_THRESHOLD_HOURS: float = 24.0

    # Demand Classification Boundaries (% occupancy)
    # Occupancy < LOW_OCCUPANCY_THRESHOLD -> Low Demand
    # LOW_OCCUPANCY_THRESHOLD <= Occupancy <= HIGH_OCCUPANCY_THRESHOLD -> Medium Demand
    # Occupancy > HIGH_OCCUPANCY_THRESHOLD -> High Demand
    LOW_OCCUPANCY_THRESHOLD: float = 30.0
    HIGH_OCCUPANCY_THRESHOLD: float = 70.0

    # Minimum number of valid snapshots required to compute booking pace
    MIN_SNAPSHOTS_FOR_BOOKING_PACE: int = 2

    # Deterministic Pricing Adjustments (% adjustment from base fare)
    # Prototype assumptions:
    # Low demand: -10% discount to stimulate volume
    # Medium demand: 0% adjustment (retain base fare)
    # High demand: +15% premium to capture surplus yield
    ADJUSTMENT_LOW_DEMAND_PCT: float = -10.0
    ADJUSTMENT_MEDIUM_DEMAND_PCT: float = 0.0
    ADJUSTMENT_HIGH_DEMAND_PCT: float = 15.0

    # Practical currency increment for rounding fares (e.g. nearest ₹10)
    FARE_ROUNDING_INCREMENT: int = 10

    # Evidence Quality Status Definitions (Deterministic & Rule-Based)
    EVIDENCE_STATUS_STRONG: str = "Strong data"
    EVIDENCE_STATUS_LIMITED: str = "Limited data"
    EVIDENCE_STATUS_INSUFFICIENT: str = "Insufficient data"

    # Baseline simulation default assumptions
    SIMULATION_PRICE_ELASTICITY: float = -0.5  # Illustrative price elasticity coefficient
    SIMULATION_BASELINE_POLICY_NAME: str = "Fixed-Fare Baseline"
    SIMULATION_FLEETYIELD_POLICY_NAME: str = "FleetYield Dynamic Policy"

    @classmethod
    def get_assumptions_summary(cls) -> Dict[str, Any]:
        """Returns a structured dictionary of active rules and assumptions."""
        return {
            "policy_version": cls.POLICY_VERSION,
            "data_source_label": cls.DATA_SOURCE_LABEL,
            "stale_data_threshold_hours": cls.STALE_DATA_THRESHOLD_HOURS,
            "demand_thresholds": {
                "low": f"< {cls.LOW_OCCUPANCY_THRESHOLD}% occupancy",
                "medium": f"{cls.LOW_OCCUPANCY_THRESHOLD}% - {cls.HIGH_OCCUPANCY_THRESHOLD}% occupancy",
                "high": f"> {cls.HIGH_OCCUPANCY_THRESHOLD}% occupancy",
                "low_bound_pct": cls.LOW_OCCUPANCY_THRESHOLD,
                "high_bound_pct": cls.HIGH_OCCUPANCY_THRESHOLD,
                "low_occupancy_max": cls.LOW_OCCUPANCY_THRESHOLD,
                "high_occupancy_min": cls.HIGH_OCCUPANCY_THRESHOLD,
                "description": (
                    f"Occupancy < {cls.LOW_OCCUPANCY_THRESHOLD}% is categorized as Low Demand; "
                    f"{cls.LOW_OCCUPANCY_THRESHOLD}%-{cls.HIGH_OCCUPANCY_THRESHOLD}% as Medium Demand; "
                    f"> {cls.HIGH_OCCUPANCY_THRESHOLD}% as High Demand."
                ),
            },
            "pricing_rules": {
                "low_demand_adjustment_pct": cls.ADJUSTMENT_LOW_DEMAND_PCT,
                "medium_demand_adjustment_pct": cls.ADJUSTMENT_MEDIUM_DEMAND_PCT,
                "high_demand_adjustment_pct": cls.ADJUSTMENT_HIGH_DEMAND_PCT,
                "rounding_increment_inr": cls.FARE_ROUNDING_INCREMENT,
                "clamping": "Recommended fare is strictly clamped between trip min_fare and max_fare.",
                "rounding_check": "Fare limits are verified again after rounding to nearest ₹10.",
            },
            "booking_pace_rule": {
                "min_snapshots_required": cls.MIN_SNAPSHOTS_FOR_BOOKING_PACE,
                "fallback": "If fewer than 2 snapshots exist, booking pace is explicitly reported as 'Not available'.",
            },
            "evidence_quality_framework": {
                "statuses": {
                    "strong": {
                        "label": cls.EVIDENCE_STATUS_STRONG,
                        "condition": (
                            "All required fields are valid and fresh (data_updated_at <= 24h), "
                            "and minimum historical booking pace evidence is satisfied (>= 2 snapshots spanning > 0h)."
                        ),
                        "action": "Calculate full rule-based recommendation with velocity context.",
                    },
                    "limited": {
                        "label": cls.EVIDENCE_STATUS_LIMITED,
                        "condition": (
                            "All required fields are valid and fresh (data_updated_at <= 24h), "
                            "but optional historical booking snapshots are missing or fewer than 2."
                        ),
                        "action": "Calculate safe rule-based recommendation based strictly on verified occupancy.",
                    },
                    "insufficient": {
                        "label": cls.EVIDENCE_STATUS_INSUFFICIENT,
                        "condition": (
                            "Required inputs are missing, invalid (e.g. booked > total seats, fare <= 0), "
                            "or stale (> 24h since last update)."
                        ),
                        "action": "Block recommendation with explicit safety policy reason.",
                    },
                },
                "audit_principle": (
                    "Deterministic evidence quality verification based on verifiable inputs. "
                    "Does NOT use arbitrary AI confidence percentages, black-box ML probability scores, "
                    "or calibrated statistical estimates."
                ),
            },
            "baseline_simulation_rules": {
                "elasticity_coefficient": cls.SIMULATION_PRICE_ELASTICITY,
                "description": (
                    "Fixed-Fare policy sells all eligible simulated demand at fixed base fare. "
                    "FleetYield policy evaluates the rule-adjusted fare against simulated passenger willingness to pay."
                ),
                "notice": "SIMULATED - NOT REAL-WORLD PERFORMANCE. Illustrative decision support scenario.",
            },
        }


settings = Settings()
