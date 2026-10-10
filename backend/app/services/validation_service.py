"""FleetYield AI - Data Quality and Freshness Validation Service.

Validates trips against business rules and freshness thresholds (FR-07).
Ensures unsafe or stale data never silently produces normal pricing recommendations.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
from app.config import settings


def parse_iso_datetime(dt_str: str) -> datetime:
    """Safely parses ISO 8601 datetime strings handling both 'Z' and offset notations."""
    if not dt_str:
        raise ValueError("Datetime string is empty")
    cleaned = dt_str.replace("Z", "+00:00")
    return datetime.fromisoformat(cleaned)


class ValidationService:
    @staticmethod
    def validate_trip(trip: Dict[str, Any]) -> Tuple[bool, bool, bool, List[str]]:
        """
        Validates a trip record.

        Returns:
            (is_valid, is_stale, can_recommend, issues)
            - is_valid: True if all structural business constraints are satisfied
            - is_stale: True if data_updated_at exceeds freshness threshold
            - can_recommend: True if data is both valid and fresh enough for pricing recommendations
            - issues: List of human-readable diagnostic messages
        """
        issues: List[str] = []
        is_valid = True
        is_stale = False

        # 1. Total seats check
        total_seats = trip.get("total_seats")
        if total_seats is None or total_seats <= 0:
            issues.append(f"Total seats must be a positive integer (got {total_seats})")
            is_valid = False

        # 2. Booked seats check
        booked_seats = trip.get("booked_seats")
        if booked_seats is None or booked_seats < 0:
            issues.append(f"Booked seats cannot be negative (got {booked_seats})")
            is_valid = False
        elif total_seats is not None and total_seats > 0 and booked_seats > total_seats:
            issues.append(
                f"Booked seats ({booked_seats}) exceeds total bus capacity ({total_seats})"
            )
            is_valid = False

        # 3. Fare checks
        base_fare = trip.get("base_fare")
        if base_fare is None or base_fare <= 0:
            issues.append(f"Base fare must be greater than zero (got {base_fare})")
            is_valid = False

        current_fare = trip.get("current_fare")
        if current_fare is None or current_fare <= 0:
            issues.append(f"Current fare must be greater than zero (got {current_fare})")
            is_valid = False

        min_fare = trip.get("min_fare")
        if min_fare is None or min_fare <= 0:
            issues.append(f"Minimum fare must be greater than zero (got {min_fare})")
            is_valid = False

        max_fare = trip.get("max_fare")
        if max_fare is None or max_fare <= 0:
            issues.append(f"Maximum fare must be greater than zero (got {max_fare})")
            is_valid = False
        elif min_fare is not None and min_fare > max_fare:
            issues.append(
                f"Configured minimum fare (₹{min_fare}) is greater than maximum fare (₹{max_fare})"
            )
            is_valid = False

        # 4. Departure time validity
        departure_time = trip.get("departure_time")
        if not departure_time:
            issues.append("Departure time is required")
            is_valid = False
        else:
            try:
                parse_iso_datetime(departure_time)
            except Exception:
                issues.append(f"Invalid departure time format: '{departure_time}'")
                is_valid = False

        # 5. Data freshness check (STALE detection)
        data_updated_at = trip.get("data_updated_at")
        if not data_updated_at:
            issues.append("Last updated timestamp (data_updated_at) is missing")
            is_valid = False
        else:
            try:
                updated_dt = parse_iso_datetime(data_updated_at)
                now = datetime.now(timezone.utc)
                age_hours = (now - updated_dt).total_seconds() / 3600.0
                if age_hours > settings.STALE_DATA_THRESHOLD_HOURS:
                    is_stale = True
                    issues.append(
                        f"Data is stale: last updated {age_hours:.1f} hours ago "
                        f"(threshold is {settings.STALE_DATA_THRESHOLD_HOURS:.1f}h)"
                    )
            except Exception:
                issues.append(f"Invalid data_updated_at timestamp format: '{data_updated_at}'")
                is_valid = False

        # Recommendation policy safety rule:
        # Cannot generate recommendation if invalid or stale
        can_recommend = is_valid and not is_stale

        return is_valid, is_stale, can_recommend, issues
