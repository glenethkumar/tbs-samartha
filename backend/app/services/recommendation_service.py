"""FleetYield AI - Recommendation Orchestrator Service (FR-04, FR-05, FR-06).

Coordinates validation, demand classification, pricing calculations, persistence, and audit logging.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.db import get_connection
from app.config import settings
from app.services.trip_service import TripService
from app.services.demand_classifier import DemandClassifier
from app.services.pricing_policy import PricingPolicy


class RecommendationService:
    @staticmethod
    def generate_recommendation(trip_id: str) -> Dict[str, Any]:
        """
        Generates an explainable fare recommendation for a given trip.
        Withholds recommendation if data fails validation or is stale.
        """
        trip = TripService.get_trip(trip_id)
        if not trip:
            raise KeyError(f"Trip '{trip_id}' not found.")

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Validation Guard: Withhold recommendation if data is invalid or stale
        if not trip["is_valid"] or trip["is_stale"]:
            reason_str = "Data quality issues: " + "; ".join(trip["validation_issues"])
            
            # Record blocked event in audit log
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO audit_events (
                        audit_id, trip_id, event_type, previous_fare, recommended_fare,
                        final_decision_fare, reason, details, created_at, rule_version,
                        data_source_label, actor_label
                    ) VALUES (
                        ?, ?, 'VALIDATION_BLOCKED', ?, NULL, NULL, ?, ?, ?, ?, ?, 'System Validator'
                    );
                """, (
                    f"AUD-{uuid.uuid4().hex[:8].upper()}",
                    trip_id,
                    trip["current_fare"],
                    reason_str,
                    json.dumps({"issues": trip["validation_issues"], "is_stale": trip["is_stale"]}),
                    now_str,
                    settings.POLICY_VERSION,
                    trip.get("data_source_label", settings.DATA_SOURCE_LABEL)
                ))
                conn.commit()

            return {
                "recommendation_id": f"REC-BLOCKED-{uuid.uuid4().hex[:6].upper()}",
                "trip_id": trip_id,
                "generated_at": now_str,
                "current_fare_at_generation": trip["current_fare"],
                "base_fare_at_generation": trip["base_fare"],
                "recommended_fare": trip["current_fare"],
                "fare_difference": 0.0,
                "fare_difference_pct": 0.0,
                "min_fare": trip.get("min_fare", 0.0),
                "max_fare": trip.get("max_fare", 0.0),
                "demand_category": "Blocked",
                "explanation": (
                    f"Recommendation withheld by safety policy. The trip record failed validation: "
                    f"{'; '.join(trip['validation_issues'])}. Pricing changes cannot be recommended "
                    f"until data is updated and verified."
                ),
                "rule_applied": "Safety Policy: Withhold recommendation on invalid or stale data",
                "contributing_factors": {
                    "is_valid": trip["is_valid"],
                    "is_stale": trip["is_stale"],
                    "validation_issues": trip["validation_issues"]
                },
                "booking_pace_info": "Not evaluated",
                "validation_status": "BLOCKED",
                "policy_version": settings.POLICY_VERSION,
                "source_label": trip.get("data_source_label", settings.DATA_SOURCE_LABEL),
                "is_clamped": False,
                "clamped_reason": None,
                "notice": "Rule-based decision support; recommendation withheld due to data checks."
            }

        # Step 1: Demand classification
        demand_info = DemandClassifier.classify(
            occupancy_percent=trip["occupancy_percent"],
            departure_time=trip["departure_time"],
            snapshots=trip.get("snapshots", [])
        )

        pace_info = demand_info["contributing_factors"].get("booking_pace")
        hours_dep = demand_info["contributing_factors"].get("hours_to_departure")

        # Step 2: Fare recommendation calculation
        pricing_info = PricingPolicy.calculate_recommendation(
            base_fare=trip["base_fare"],
            current_fare=trip["current_fare"],
            min_fare=trip["min_fare"],
            max_fare=trip["max_fare"],
            demand_category=demand_info["demand_category"],
            occupancy_percent=trip["occupancy_percent"],
            booking_pace_info=pace_info,
            hours_to_departure=hours_dep,
            trip_id=trip_id
        )

        rec_id = f"REC-{uuid.uuid4().hex[:8].upper()}"

        rec_payload = {
            "recommendation_id": rec_id,
            "trip_id": trip_id,
            "generated_at": now_str,
            "current_fare_at_generation": float(trip["current_fare"]),
            "base_fare_at_generation": float(trip["base_fare"]),
            "recommended_fare": pricing_info["recommended_fare"],
            "fare_difference": pricing_info["fare_difference"],
            "fare_difference_pct": pricing_info["fare_difference_pct"],
            "min_fare": float(trip["min_fare"]),
            "max_fare": float(trip["max_fare"]),
            "demand_category": demand_info["demand_category"],
            "explanation": f"{demand_info['explanation']} {pricing_info['explanation']}",
            "rule_applied": pricing_info["rule_applied"],
            "contributing_factors": {
                **demand_info["contributing_factors"],
                "adjustment_pct": pricing_info["adjustment_pct_applied"],
                "is_clamped": pricing_info["is_clamped"],
                "clamped_reason": pricing_info["clamped_reason"],
                "suggested_band": pricing_info["suggested_band"]
            },
            "booking_pace_info": demand_info["contributing_factors"]["booking_pace"]["description"],
            "validation_status": "VALID",
            "policy_version": settings.POLICY_VERSION,
            "source_label": trip.get("data_source_label", settings.DATA_SOURCE_LABEL),
            "is_clamped": pricing_info["is_clamped"],
            "clamped_reason": pricing_info["clamped_reason"],
            "notice": "Rule-based decision support; internal operator prototype. Does not modify live passenger fares."
        }

        # Step 3: Persist recommendation and record in audit log
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO recommendations (
                    recommendation_id, trip_id, generated_at, current_fare_at_generation,
                    base_fare_at_generation, recommended_fare, fare_difference,
                    fare_difference_pct, min_fare, max_fare, demand_category,
                    explanation, rule_applied, contributing_factors, booking_pace_info,
                    validation_status, policy_version, source_label, is_clamped,
                    clamped_reason, notice
                ) VALUES (
                    :recommendation_id, :trip_id, :generated_at, :current_fare_at_generation,
                    :base_fare_at_generation, :recommended_fare, :fare_difference,
                    :fare_difference_pct, :min_fare, :max_fare, :demand_category,
                    :explanation, :rule_applied, :contributing_factors, :booking_pace_info,
                    :validation_status, :policy_version, :source_label, :is_clamped,
                    :clamped_reason, :notice
                );
            """, {
                **rec_payload,
                "contributing_factors": json.dumps(rec_payload["contributing_factors"]),
                "is_clamped": 1 if rec_payload["is_clamped"] else 0
            })

            cursor.execute("""
                INSERT INTO audit_events (
                    audit_id, trip_id, event_type, previous_fare, recommended_fare,
                    final_decision_fare, reason, details, created_at, rule_version,
                    data_source_label, actor_label
                ) VALUES (
                    ?, ?, 'RECOMMENDATION_GENERATED', ?, ?, NULL, ?, ?, ?, ?, ?, 'Pricing Engine'
                );
            """, (
                f"AUD-{uuid.uuid4().hex[:8].upper()}",
                trip_id,
                trip["current_fare"],
                pricing_info["recommended_fare"],
                pricing_info["rule_applied"],
                json.dumps({
                    "demand_category": demand_info["demand_category"],
                    "explanation": rec_payload["explanation"]
                }),
                now_str,
                settings.POLICY_VERSION,
                trip.get("data_source_label", settings.DATA_SOURCE_LABEL)
            ))
            conn.commit()

        return rec_payload
