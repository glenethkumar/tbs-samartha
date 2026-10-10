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

        # Fare boundary adherence checks
        if min_fare is not None and max_fare is not None and min_fare <= max_fare:
            if base_fare is not None and (base_fare < min_fare or base_fare > max_fare):
                issues.append(
                    f"Base fare (₹{base_fare}) is outside configured limits [₹{min_fare} - ₹{max_fare}]"
                )
                is_valid = False
            if current_fare is not None and (current_fare < min_fare or current_fare > max_fare):
                issues.append(
                    f"Current operating fare (₹{current_fare}) is outside configured limits [₹{min_fare} - ₹{max_fare}]"
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

    @staticmethod
    def evaluate_evidence_quality(
        trip: Dict[str, Any],
        is_valid: bool,
        is_stale: bool,
        validation_issues: List[str],
        booking_pace: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Determines explainable evidence-quality status based strictly on deterministic rules:
        - Strong data: all required fields are valid and fresh, and configured minimum evidence requirements (>=2 snapshots) are satisfied.
        - Limited data: recommendation can be calculated from valid and fresh data, but optional historical evidence (booking pace snapshots) is missing.
        - Insufficient data: required inputs are missing, invalid, stale, or inadequate for the applicable rule. Recommendation is blocked.
        """
        data_updated_at = trip.get("data_updated_at")
        age_hours = None
        if data_updated_at:
            try:
                updated_dt = parse_iso_datetime(data_updated_at)
                now = datetime.now(timezone.utc)
                age_hours = round((now - updated_dt).total_seconds() / 3600.0, 1)
            except Exception:
                pass

        pace_avail = bool(booking_pace and booking_pace.get("available"))

        if not is_valid or is_stale:
            status = settings.EVIDENCE_STATUS_INSUFFICIENT
            status_code = "INSUFFICIENT"
            can_rec = False
            issues_text = "; ".join(validation_issues) if validation_issues else "Unspecified schema or freshness failure"
            explanation = (
                f"Insufficient data: Required trip inputs are missing, invalid, or stale ({issues_text}). "
                f"Pricing recommendations cannot be reliably calculated and are withheld by safety policy."
            )
        elif not pace_avail:
            status = settings.EVIDENCE_STATUS_LIMITED
            status_code = "LIMITED"
            can_rec = True
            pace_reason = booking_pace.get("description", "insufficient snapshot history") if booking_pace else "no snapshots recorded"
            explanation = (
                f"Limited data: Core trip inputs, inventory capacity, and occupancy are fully valid and fresh "
                f"(updated {age_hours}h ago, within {settings.STALE_DATA_THRESHOLD_HOURS:.0f}h limit), but optional historical "
                f"booking pace snapshots are missing ({pace_reason}). Recommendation is computed using core occupancy policy."
            )
        else:
            status = settings.EVIDENCE_STATUS_STRONG
            status_code = "STRONG"
            can_rec = True
            explanation = (
                f"Strong data: All required trip attributes are verified and fresh "
                f"(updated {age_hours}h ago, within {settings.STALE_DATA_THRESHOLD_HOURS:.0f}h limit), "
                f"and multi-point historical booking pace evidence is satisfied ({booking_pace.get('description')})."
            )

        return {
            "status": status,
            "status_code": status_code,
            "can_recommend": can_rec,
            "explanation": explanation,
            "freshness": {
                "data_updated_at": data_updated_at,
                "age_hours": age_hours,
                "threshold_hours": settings.STALE_DATA_THRESHOLD_HOURS,
                "is_stale": is_stale
            },
            "validation_diagnostics": {
                "is_valid": is_valid,
                "is_stale": is_stale,
                "issues": validation_issues
            },
            "optional_evidence": {
                "booking_pace_available": pace_avail,
                "booking_pace_details": booking_pace
            }
        }
