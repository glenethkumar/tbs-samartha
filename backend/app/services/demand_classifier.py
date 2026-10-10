"""FleetYield AI - Deterministic Rule-Based Demand Classifier (FR-03).

Categorizes booking demand into Low, Medium, or High using transparent, configurable rules.
Calculates booking pace only when >=2 valid snapshots exist; never fabricates signals.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.config import settings
from app.services.validation_service import parse_iso_datetime


class DemandClassifier:
    @staticmethod
    def calculate_booking_pace(snapshots: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates booking pace only if at least MIN_SNAPSHOTS_FOR_BOOKING_PACE snapshots exist.
        Returns structured pace metrics and human-readable description.
        """
        if not snapshots or len(snapshots) < settings.MIN_SNAPSHOTS_FOR_BOOKING_PACE:
            return {
                "available": False,
                "pace_per_hour": None,
                "description": f"Not available (minimum {settings.MIN_SNAPSHOTS_FOR_BOOKING_PACE} timestamped snapshots required)",
                "snapshots_evaluated": len(snapshots) if snapshots else 0
            }

        # Sort snapshots by captured_at ascending
        sorted_snaps = sorted(
            snapshots,
            key=lambda s: parse_iso_datetime(s["captured_at"])
        )

        first_snap = sorted_snaps[0]
        last_snap = sorted_snaps[-1]

        t_first = parse_iso_datetime(first_snap["captured_at"])
        t_last = parse_iso_datetime(last_snap["captured_at"])

        delta_hours = (t_last - t_first).total_seconds() / 3600.0
        delta_seats = last_snap["booked_seats"] - first_snap["booked_seats"]

        if delta_hours <= 0:
            return {
                "available": False,
                "pace_per_hour": None,
                "description": "Not available (snapshot timestamps are identical)",
                "snapshots_evaluated": len(sorted_snaps)
            }

        pace_per_hour = delta_seats / delta_hours
        sign = "+" if pace_per_hour >= 0 else ""
        desc = f"{sign}{pace_per_hour:.2f} seats/hr over {delta_hours:.1f}h ({delta_seats} seats change)"

        return {
            "available": True,
            "pace_per_hour": round(pace_per_hour, 2),
            "description": desc,
            "snapshots_evaluated": len(sorted_snaps),
            "window_hours": round(delta_hours, 1),
            "seats_delta": delta_seats
        }

    @staticmethod
    def classify(
        occupancy_percent: float,
        departure_time: str,
        snapshots: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Deterministic demand classification.

        Rules:
        - Occupancy < 30.0%: Low Demand
        - 30.0% <= Occupancy <= 70.0%: Medium Demand
        - Occupancy > 70.0%: High Demand
        """
        pace_result = DemandClassifier.calculate_booking_pace(snapshots or [])

        # Calculate time remaining until departure
        hours_to_dep = None
        time_to_dep_str = "Unknown"
        try:
            dep_dt = parse_iso_datetime(departure_time)
            now = datetime.now(timezone.utc)
            hours_to_dep = round((dep_dt - now).total_seconds() / 3600.0, 1)
            if hours_to_dep > 0:
                time_to_dep_str = f"{hours_to_dep} hours remaining"
            else:
                time_to_dep_str = f"Departed {abs(hours_to_dep)} hours ago"
        except Exception:
            pass

        # Apply deterministic rule thresholds
        low_limit = settings.LOW_OCCUPANCY_THRESHOLD
        high_limit = settings.HIGH_OCCUPANCY_THRESHOLD

        if occupancy_percent < low_limit:
            category = "Low"
            rule_detail = f"Occupancy ({occupancy_percent:.1f}%) is strictly below the {low_limit:.1f}% threshold."
        elif occupancy_percent > high_limit:
            category = "High"
            rule_detail = f"Occupancy ({occupancy_percent:.1f}%) strictly exceeds the {high_limit:.1f}% threshold."
        else:
            category = "Medium"
            rule_detail = f"Occupancy ({occupancy_percent:.1f}%) lies in the normal {low_limit:.1f}% to {high_limit:.1f}% band."

        pace_note = (
            f" Booking pace signal: {pace_result['description']}."
            if pace_result["available"]
            else " Booking pace is not available."
        )

        explanation = (
            f"Classified as '{category} Demand'. {rule_detail}{pace_note} "
            f"Departure context: {time_to_dep_str}."
        )

        return {
            "demand_category": category,
            "rule_name": "Deterministic Occupancy-Boundary Classifier",
            "explanation": explanation,
            "contributing_factors": {
                "occupancy_percent": round(occupancy_percent, 1),
                "thresholds": {"low": low_limit, "high": high_limit},
                "booking_pace": pace_result,
                "hours_to_departure": hours_to_dep,
                "time_to_departure_label": time_to_dep_str
            }
        }
