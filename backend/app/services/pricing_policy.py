"""FleetYield AI - Explainable Deterministic Fare Recommendation Engine (FR-04).

Calculates recommended fares within operator-configured [min_fare, max_fare] limits.
Applies consistent currency rounding to the nearest ₹10 increment and re-verifies limits.
Generates fully transparent, audit-ready explanations containing inputs, rules, and constraints.
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
        booking_pace_info: Optional[Dict[str, Any]] = None,
        hours_to_departure: Optional[float] = None,
        trip_id: str = ""
    ) -> Dict[str, Any]:
        """
        Calculates recommended fare using deterministic rule configuration.

        Validates inputs and enforces:
        1. All fares positive; min_fare <= max_fare; base/current within bounds.
        2. Occupancy within [0.0, 100.0].
        3. Adjustment percentage applied to base_fare based on demand_category.
        4. Consistent rounding to nearest FARE_ROUNDING_INCREMENT (₹10).
        5. Strict clamping: min_fare <= recommended_fare <= max_fare.
        """
        # 1. Input parameter validation
        if base_fare <= 0 or current_fare <= 0 or min_fare <= 0 or max_fare <= 0:
            raise ValueError(
                f"All fare amounts must be positive numbers greater than zero. "
                f"Got base_fare={base_fare}, current_fare={current_fare}, min_fare={min_fare}, max_fare={max_fare}."
            )

        if min_fare > max_fare:
            raise ValueError(
                f"Configured minimum fare (₹{min_fare}) cannot exceed maximum fare (₹{max_fare})."
            )

        if base_fare < min_fare or base_fare > max_fare:
            raise ValueError(
                f"Base fare (₹{base_fare}) must be within configured limits [₹{min_fare} - ₹{max_fare}]."
            )

        if current_fare < min_fare or current_fare > max_fare:
            raise ValueError(
                f"Current fare (₹{current_fare}) must be within configured limits [₹{min_fare} - ₹{max_fare}]."
            )

        if occupancy_percent < 0.0 or occupancy_percent > 100.0:
            raise ValueError(
                f"Occupancy percentage must be between 0.0 and 100.0 (got {occupancy_percent})."
            )

        if demand_category not in ("Low", "Medium", "High"):
            raise ValueError(
                f"Demand category must be 'Low', 'Medium', or 'High' (got '{demand_category}')."
            )

        # 2. Determine base adjustment percentage from canonical rule configuration
        if demand_category == "Low":
            adj_pct = settings.ADJUSTMENT_LOW_DEMAND_PCT
            rule_name = f"Low Demand Policy: {adj_pct:+.1f}% volume stimulation discount"
        elif demand_category == "High":
            adj_pct = settings.ADJUSTMENT_HIGH_DEMAND_PCT
            rule_name = f"High Demand Policy: {adj_pct:+.1f}% premium yield capture adjustment"
        else:
            adj_pct = settings.ADJUSTMENT_MEDIUM_DEMAND_PCT
            rule_name = f"Medium Demand Policy: {adj_pct:+.1f}% baseline fare retention"

        # 3. Calculate unrounded raw fare
        raw_fare = base_fare * (1.0 + (adj_pct / 100.0))

        # 4. Practical currency increment rounding (nearest ₹10)
        inc = settings.FARE_ROUNDING_INCREMENT
        rounded_fare = round(raw_fare / inc) * inc

        # 5. Clamp to operator-configured limits and re-verify
        is_clamped = False
        clamped_reason: Optional[str] = None
        final_fare = rounded_fare

        if rounded_fare < min_fare:
            final_fare = min_fare
            is_clamped = True
            clamped_reason = (
                f"Calculated fare ₹{rounded_fare:.0f} fell below the trip's minimum limit "
                f"(₹{min_fare:.0f}); clamped to ₹{min_fare:.0f}."
            )
        elif rounded_fare > max_fare:
            final_fare = max_fare
            is_clamped = True
            clamped_reason = (
                f"Calculated fare ₹{rounded_fare:.0f} exceeded the trip's maximum limit "
                f"(₹{max_fare:.0f}); clamped to ₹{max_fare:.0f}."
            )

        # 6. Fare difference calculations against current operating fare
        fare_diff = final_fare - current_fare
        fare_diff_pct = (fare_diff / current_fare * 100.0) if current_fare > 0 else 0.0

        # 7. Construct comprehensive, audit-ready explanation
        pace_text = ""
        if booking_pace_info and booking_pace_info.get("available"):
            pace_text = f" Booking pace velocity: {booking_pace_info.get('description')}."
        elif booking_pace_info:
            pace_text = " Booking pace: Not available (insufficient snapshot history)."

        dep_text = f" Departure in {hours_to_departure:.1f}h." if hours_to_departure is not None and hours_to_departure > 0 else ""

        clamp_note = f" Guardrail action: {clamped_reason}" if is_clamped else " Boundary constraint: verified within permitted limits."

        explanation = (
            f"Proposed fare: ₹{final_fare:.0f} (current: ₹{current_fare:.0f}, base: ₹{base_fare:.0f}). "
            f"Evaluated signals: occupancy {occupancy_percent:.1f}% ({demand_category} Demand).{pace_text}{dep_text} "
            f"Applied {adj_pct:+.1f}% adjustment on base fare, rounded to nearest ₹{inc}.{clamp_note}"
        )

        # Suggested fare band (±5% bounded by min/max limits)
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
            "currency": settings.CURRENCY_SYMBOL,
            "inputs_evaluated": {
                "base_fare": base_fare,
                "current_fare": current_fare,
                "occupancy_percent": occupancy_percent,
                "demand_category": demand_category,
                "hours_to_departure": hours_to_departure,
                "booking_pace": booking_pace_info
            }
        }
