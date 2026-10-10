"""FleetYield AI - Trip and Inventory Management Service (FR-01, FR-02)."""

import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.db import get_connection
from app.config import settings
from app.services.validation_service import ValidationService, parse_iso_datetime
from app.services.demand_classifier import DemandClassifier
from app.services.competitor_service import CompetitorService


def calculate_trip_metrics(trip: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes occupancy and available seat metrics safely, guarding against division by zero.
    """
    total = trip.get("total_seats", 0)
    booked = trip.get("booked_seats", 0)

    if total is not None and total > 0:
        available = max(0, total - (booked if booked is not None else 0))
        occupancy = (booked / total) * 100.0 if booked is not None else 0.0
    else:
        available = 0
        occupancy = 0.0

    return {
        "available_seats": available,
        "occupancy_percent": round(occupancy, 1),
    }


class TripService:
    @staticmethod
    def get_trip(trip_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single trip with snapshots and validation metrics."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trips WHERE trip_id = ?", (trip_id,))
            row = cursor.fetchone()
            if not row:
                return None
            trip = dict(row)

            # Get snapshots
            cursor.execute(
                "SELECT * FROM booking_snapshots WHERE trip_id = ? ORDER BY captured_at ASC",
                (trip_id,)
            )
            snapshots = [dict(s) for s in cursor.fetchall()]

            # Get latest recommendation if any
            cursor.execute(
                "SELECT * FROM recommendations WHERE trip_id = ? ORDER BY generated_at DESC LIMIT 1",
                (trip_id,)
            )
            rec_row = cursor.fetchone()
            latest_rec = dict(rec_row) if rec_row else None
            if latest_rec:
                if "contributing_factors" in latest_rec and isinstance(latest_rec["contributing_factors"], str):
                    try:
                        latest_rec["contributing_factors"] = json.loads(latest_rec["contributing_factors"])
                    except Exception:
                        pass
                if "evidence_quality_details" in latest_rec and isinstance(latest_rec["evidence_quality_details"], str):
                    try:
                        latest_rec["evidence_quality_details"] = json.loads(latest_rec["evidence_quality_details"])
                    except Exception:
                        pass
                if "competitor_summary" in latest_rec and isinstance(latest_rec["competitor_summary"], str):
                    try:
                        latest_rec["competitor_summary"] = json.loads(latest_rec["competitor_summary"])
                    except Exception:
                        latest_rec["competitor_summary"] = {}
                if not latest_rec.get("recommended_action"):
                    rf = float(latest_rec.get("recommended_fare", 0.0))
                    cf = float(latest_rec.get("current_fare_at_generation", trip.get("current_fare", 0.0)))
                    if rf > cf:
                        latest_rec["recommended_action"] = "Increase fare"
                    elif rf < cf:
                        latest_rec["recommended_action"] = "Decrease fare"
                    else:
                        latest_rec["recommended_action"] = "Maintain fare"

            # Get decisions for this trip
            cursor.execute(
                "SELECT * FROM operator_decisions WHERE trip_id = ? ORDER BY created_at DESC",
                (trip_id,)
            )
            decisions = [dict(d) for d in cursor.fetchall()]

        # Metrics & Validation
        metrics = calculate_trip_metrics(trip)
        trip.update(metrics)

        is_valid, is_stale, can_recommend, issues = ValidationService.validate_trip(trip)
        trip["is_valid"] = is_valid
        trip["is_stale"] = is_stale
        trip["can_recommend"] = can_recommend
        trip["validation_issues"] = issues
        trip["snapshots"] = snapshots
        trip["decisions"] = decisions

        if latest_rec and not latest_rec.get("evidence_quality_details"):
            pace_obj = (
                latest_rec.get("contributing_factors", {}).get("booking_pace")
                if isinstance(latest_rec.get("contributing_factors"), dict)
                else None
            )
            ev = ValidationService.evaluate_evidence_quality(
                trip=trip,
                is_valid=trip["is_valid"],
                is_stale=trip["is_stale"],
                validation_issues=trip["validation_issues"],
                booking_pace=pace_obj
            )
            latest_rec["evidence_quality_status"] = ev["status"]
            latest_rec["evidence_quality_explanation"] = ev["explanation"]
            latest_rec["evidence_quality_details"] = {
                "status": ev["status"],
                "status_code": ev["status_code"],
                "can_recommend": ev["can_recommend"],
                "explanation": ev["explanation"],
                "occupancy": {
                    "value_pct": trip.get("occupancy_percent", 0.0),
                    "threshold_used": f"< {settings.LOW_OCCUPANCY_THRESHOLD}%" if trip.get("occupancy_percent", 0) < settings.LOW_OCCUPANCY_THRESHOLD else f"> {settings.HIGH_OCCUPANCY_THRESHOLD}%" if trip.get("occupancy_percent", 0) > settings.HIGH_OCCUPANCY_THRESHOLD else f"{settings.LOW_OCCUPANCY_THRESHOLD}% - {settings.HIGH_OCCUPANCY_THRESHOLD}%",
                    "band": latest_rec.get("demand_category", "Medium")
                },
                "booking_pace": pace_obj or {"available": False, "description": latest_rec.get("booking_pace_info", "Not available")},
                "departure": {
                    "departure_time": trip.get("departure_time"),
                    "hours_remaining": None,
                    "label": "Scheduled"
                },
                "data_freshness": ev["freshness"],
                "input_diagnostics": ev["validation_diagnostics"],
                "fare_constraints": {
                    "min_fare": float(latest_rec.get("min_fare", trip.get("min_fare", 0.0))),
                    "max_fare": float(latest_rec.get("max_fare", trip.get("max_fare", 0.0))),
                    "current_fare": float(latest_rec.get("current_fare_at_generation", trip.get("current_fare", 0.0))),
                    "base_fare": float(latest_rec.get("base_fare_at_generation", trip.get("base_fare", 0.0))),
                    "recommended_fare": float(latest_rec.get("recommended_fare", 0.0)),
                    "is_clamped": bool(latest_rec.get("is_clamped")),
                    "clamped_reason": latest_rec.get("clamped_reason")
                },
                "applicable_rules": [
                    f"Pricing Policy: {latest_rec.get('rule_applied', 'Standard Policy')}",
                    f"Rounding: Nearest ₹{settings.FARE_ROUNDING_INCREMENT}"
                ]
            }

        trip["latest_recommendation"] = latest_rec

        if is_valid:
            classification = DemandClassifier.classify(
                trip["occupancy_percent"],
                trip["departure_time"],
                snapshots
            )
            trip["demand_category"] = classification["demand_category"]
            trip["demand_details"] = classification
        else:
            trip["demand_category"] = "Unknown"
            trip["demand_details"] = None

        trip["competitor_summary"] = CompetitorService.get_competitor_summary(trip_id)

        return trip

    @staticmethod
    def list_trips(
        q: Optional[str] = None,
        demand: Optional[str] = None,
        data_status: Optional[str] = None,
        sort_by: str = "departure_time",
        sort_order: str = "asc"
    ) -> List[Dict[str, Any]]:
        """Lists and filters all trips with calculated occupancy and freshness metrics."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trips")
            rows = cursor.fetchall()
            raw_trips = [dict(r) for r in rows]

            # Fetch snapshot counts per trip
            cursor.execute("SELECT trip_id, COUNT(*) as snap_count FROM booking_snapshots GROUP BY trip_id")
            snap_counts = {r["trip_id"]: r["snap_count"] for r in cursor.fetchall()}

        enriched_trips: List[Dict[str, Any]] = []

        for trip in raw_trips:
            metrics = calculate_trip_metrics(trip)
            trip.update(metrics)
            is_valid, is_stale, can_rec, issues = ValidationService.validate_trip(trip)
            trip["is_valid"] = is_valid
            trip["is_stale"] = is_stale
            trip["can_recommend"] = can_rec
            trip["validation_issues"] = issues
            trip["snapshot_count"] = snap_counts.get(trip["trip_id"], 0)

            if is_valid:
                # Classify without deep snapshot query for listing speed
                if trip["occupancy_percent"] < settings.LOW_OCCUPANCY_THRESHOLD:
                    trip["demand_category"] = "Low"
                elif trip["occupancy_percent"] > settings.HIGH_OCCUPANCY_THRESHOLD:
                    trip["demand_category"] = "High"
                else:
                    trip["demand_category"] = "Medium"
            else:
                trip["demand_category"] = "Invalid Data"

            # Apply Search Query
            if q:
                search_text = (
                    f"{trip['trip_id']} {trip['route_name']} {trip['origin']} {trip['destination']}"
                ).lower()
                if q.lower() not in search_text:
                    continue

            # Apply Demand Filter
            if demand and demand.lower() != "all":
                if trip["demand_category"].lower() != demand.lower():
                    continue

            # Apply Data Status Filter
            if data_status and data_status.lower() != "all":
                if data_status.lower() == "valid" and (not trip["is_valid"] or trip["is_stale"]):
                    continue
                elif data_status.lower() == "stale" and not trip["is_stale"]:
                    continue
                elif data_status.lower() == "invalid" and trip["is_valid"]:
                    continue

            enriched_trips.append(trip)

        # Sorting
        reverse = (sort_order.lower() == "desc")
        if sort_by == "occupancy":
            enriched_trips.sort(key=lambda t: t.get("occupancy_percent", 0), reverse=reverse)
        elif sort_by == "departure_time":
            enriched_trips.sort(key=lambda t: t.get("departure_time", ""), reverse=reverse)
        elif sort_by == "trip_id":
            enriched_trips.sort(key=lambda t: t.get("trip_id", ""), reverse=reverse)

        return enriched_trips

    @staticmethod
    def create_trip(trip_data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a new trip after strict validation."""
        is_valid, is_stale, _, issues = ValidationService.validate_trip(trip_data)
        if not is_valid:
            raise ValueError(f"Trip validation failed: {'; '.join(issues)}")

        trip_id = trip_data.get("trip_id") or f"TRIP-{uuid.uuid4().hex[:6].upper()}"
        trip_data["trip_id"] = trip_id

        if not trip_data.get("data_updated_at"):
            trip_data["data_updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        if not trip_data.get("data_source_label"):
            trip_data["data_source_label"] = settings.DATA_SOURCE_LABEL

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT trip_id FROM trips WHERE trip_id = ?", (trip_id,))
            if cursor.fetchone():
                raise ValueError(f"Trip ID '{trip_id}' already exists.")

            cursor.execute("""
                INSERT INTO trips (
                    trip_id, route_name, origin, destination, departure_time,
                    total_seats, booked_seats, base_fare, current_fare,
                    min_fare, max_fare, data_updated_at, data_source_label,
                    bus_type, route_distance_km, operator_notes
                ) VALUES (
                    :trip_id, :route_name, :origin, :destination, :departure_time,
                    :total_seats, :booked_seats, :base_fare, :current_fare,
                    :min_fare, :max_fare, :data_updated_at, :data_source_label,
                    :bus_type, :route_distance_km, :operator_notes
                );
            """, trip_data)

            # Record in audit log
            cursor.execute("""
                INSERT INTO audit_events (
                    audit_id, trip_id, event_type, previous_fare, recommended_fare,
                    final_decision_fare, reason, details, created_at, rule_version,
                    data_source_label, actor_label
                ) VALUES (
                    ?, ?, 'TRIP_CREATED', NULL, NULL, ?, 'Trip created by operator', ?, ?, ?, ?, 'Demo operator'
                );
            """, (
                f"AUD-{uuid.uuid4().hex[:8].upper()}",
                trip_id,
                trip_data["current_fare"],
                json.dumps({"route": trip_data["route_name"], "total_seats": trip_data["total_seats"]}),
                datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                settings.POLICY_VERSION,
                trip_data.get("data_source_label", settings.DATA_SOURCE_LABEL)
            ))
            conn.commit()

        return TripService.get_trip(trip_id)

    @staticmethod
    def update_trip(trip_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Updates an existing trip after validating merged fields."""
        existing = TripService.get_trip(trip_id)
        if not existing:
            raise KeyError(f"Trip '{trip_id}' not found.")

        # Merge updates
        merged = dict(existing)
        for k, v in updates.items():
            if v is not None:
                merged[k] = v

        merged["data_updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        is_valid, _, _, issues = ValidationService.validate_trip(merged)
        if not is_valid:
            raise ValueError(f"Trip update validation failed: {'; '.join(issues)}")

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE trips SET
                    route_name = :route_name,
                    origin = :origin,
                    destination = :destination,
                    departure_time = :departure_time,
                    total_seats = :total_seats,
                    booked_seats = :booked_seats,
                    base_fare = :base_fare,
                    current_fare = :current_fare,
                    min_fare = :min_fare,
                    max_fare = :max_fare,
                    data_updated_at = :data_updated_at,
                    bus_type = :bus_type,
                    route_distance_km = :route_distance_km,
                    operator_notes = :operator_notes
                WHERE trip_id = :trip_id;
            """, merged)

            # Record audit update
            cursor.execute("""
                INSERT INTO audit_events (
                    audit_id, trip_id, event_type, previous_fare, recommended_fare,
                    final_decision_fare, reason, details, created_at, rule_version,
                    data_source_label, actor_label
                ) VALUES (
                    ?, ?, 'TRIP_UPDATED', ?, NULL, ?, 'Trip details updated', ?, ?, ?, ?, 'Demo operator'
                );
            """, (
                f"AUD-{uuid.uuid4().hex[:8].upper()}",
                trip_id,
                existing["current_fare"],
                merged["current_fare"],
                json.dumps(updates),
                datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                settings.POLICY_VERSION,
                merged.get("data_source_label", settings.DATA_SOURCE_LABEL)
            ))
            conn.commit()

        return TripService.get_trip(trip_id)

    @staticmethod
    def get_dashboard_summary() -> Dict[str, Any]:
        """Calculates dashboard aggregations from stored database records."""
        trips = TripService.list_trips()
        now = datetime.now(timezone.utc)

        total_trips = len(trips)
        upcoming_trips = 0
        total_booked = 0
        total_available = 0
        trips_needing_review = 0
        occ_sum = 0.0

        occ_dist = {"low": 0, "medium": 0, "high": 0, "invalid": 0}

        for t in trips:
            if t["is_valid"]:
                total_booked += t["booked_seats"]
                total_available += t["available_seats"]
                occ_sum += t["occupancy_percent"]

                if t["demand_category"] == "Low":
                    occ_dist["low"] += 1
                elif t["demand_category"] == "High":
                    occ_dist["high"] += 1
                else:
                    occ_dist["medium"] += 1
            else:
                occ_dist["invalid"] += 1

            if not t["is_valid"] or t["is_stale"] or t["occupancy_percent"] > 85.0 or t["occupancy_percent"] < 20.0:
                trips_needing_review += 1

            try:
                dep_dt = parse_iso_datetime(t["departure_time"])
                if dep_dt >= now:
                    upcoming_trips += 1
            except Exception:
                pass

        valid_count = sum(1 for t in trips if t["is_valid"])
        avg_occupancy = round(occ_sum / valid_count, 1) if valid_count > 0 else 0.0

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM audit_events")
            recent_count = cursor.fetchone()[0]

        return {
            "total_trips": total_trips,
            "upcoming_trips": upcoming_trips,
            "total_booked_seats": total_booked,
            "total_available_seats": total_available,
            "average_occupancy_pct": avg_occupancy,
            "trips_needing_review": trips_needing_review,
            "recent_activity_count": recent_count,
            "data_source_label": settings.DATA_SOURCE_LABEL,
            "occupancy_distribution": occ_dist
        }
