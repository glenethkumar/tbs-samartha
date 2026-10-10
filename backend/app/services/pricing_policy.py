"""FleetYield AI - Explainable Deterministic Fare Recommendation Engine (FR-04).

Calculates recommended fare within operator-configured [min_fare, max_fare] limits.
Rounds consistently to the nearest ₹10 increment and re-verifies limits after rounding.
"""

from typing import Dict, Any, Optional
from app.config import settings


class PricingPolicy:
    @staticmethod
    def calculate_recommendation(
        base_fare: float,
        current_fare: float,
        min_fare: float,
        max_fare: float,
        demand_category: str,
        occupancy_percent: float,
        trip_id: str = ""
    ) -> Dict[str, Any]:
        """
        Calculates recommended fare using deterministic rule configuration.

        Enforces:
        1. Adjustment percentage applied to base_fare.
        2. Rounding to nearest FARE_ROUNDING_INCREMENT (₹10).
        3. Strict clamping: min_fare <= recommended_fare <= max_fare.
        """
        # Determine adjustment percentage based on demand category
        if demand_category == "Low":
            adj_pct = settings.ADJUSTMENT_LOW_DEMAND_PCT
            rule_name = f"Low Demand Policy: {adj_pct:+.1f}% volume stimulation adjustment"
        elif demand_category == "High":
            adj_pct = settings.ADJUSTMENT_HIGH_DEMAND_PCT
            rule_name = f"High Demand Policy: {adj_pct:+.1f}% premium yield capture adjustment"
        else:
            adj_pct = settings.ADJUSTMENT_MEDIUM_DEMAND_PCT
            rule_name = f"Medium Demand Policy: {adj_pct:+.1f}% baseline fare retention"

        # Calculate unrounded proposed fare
        raw_fare = base_fare * (1.0 + (adj_pct / 100.0))

        # Practical currency increment rounding (nearest ₹10)
        inc = settings.FARE_ROUNDING_INCREMENT
        rounded_fare = round(raw_fare / inc) * inc

        # Clamp to operator-configured limits and re-verify
        is_clamped = False
        clamped_reason: Optional[str] = None
        final_fare = rounded_fare

        if rounded_fare < min_fare:
            final_fare = min_fare
            is_clamped = True
            clamped_reason = (
                f"Calculated fare ₹{rounded_fare:.0f} was below the trip's minimum limit "
                f"(₹{min_fare:.0f}); clamped to floor ₹{min_fare:.0f}."
            )
        elif rounded_fare > max_fare:
            final_fare = max_fare
            is_clamped = True
            clamped_reason = (
                f"Calculated fare ₹{rounded_fare:.0f} exceeded the trip's maximum limit "
                f"(₹{max_fare:.0f}); clamped to ceiling ₹{max_fare:.0f}."
            )

        # Fare difference calculations against current fare
        fare_diff = final_fare - current_fare
        fare_diff_pct = (fare_diff / current_fare * 100.0) if current_fare > 0 else 0.0

        # Construct clear dynamic explanation
        clamp_note = f" Note: {clamped_reason}" if is_clamped else " Limits check: within permitted bounds."
        explanation = (
            f"Suggested fare is ₹{final_fare:.0f} because current occupancy is {occupancy_percent:.1f}%, "
            f"categorized as {demand_category} Demand. "
            f"The rule applied a {adj_pct:+.1f}% adjustment to the base fare (₹{base_fare:.0f}) "
            f"and rounded to the nearest ₹{inc}.{clamp_note}"
        )

        # Suggested fare band (e.g. ±5% bounded by min/max)
        band_low = max(min_fare, round((final_fare * 0.95) / inc) * inc)
        band_high = min(max_fare, round((final_fare * 1.05) / inc) * inc)

        return {
            "recommended_fare": float(final_fare),
            "raw_fare": round(raw_fare, 2),
            "rounded_fare": float(rounded_fare),
            "fare_difference": round(fare_diff, 2),
            "fare_difference_pct": round(fare_diff_pct, 1),
            "adjustment_pct_applied": adj_pct,
            "rule_applied": rule_name,
            "explanation": explanation,
            "is_clamped": is_clamped,
            "clamped_reason": clamped_reason,
            "suggested_band": {
                "low": float(band_low),
                "high": float(band_high)
            },
            "min_fare": min_fare,
            "max_fare": max_fare,
            "currency": settings.CURRENCY_SYMBOL
        }
