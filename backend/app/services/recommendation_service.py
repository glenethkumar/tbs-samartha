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
from app.services.validation_service import ValidationService
from app.services.competitor_service import CompetitorService


class RecommendationService:
    @staticmethod
    def generate_recommendation(trip_id: str) -> Dict[str, Any]:
        """
        Generates an explainable fare recommendation with Evidence-Quality verification
        and Competitor Price Benchmarking (RedBus & AbhiBus).
        Withholds recommendation if data fails validation or is stale (Insufficient data).
        """
        trip = TripService.get_trip(trip_id)
        if not trip:
            raise KeyError(f"Trip '{trip_id}' not found.")

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Validation Guard: Withhold recommendation if data is invalid or stale
        if not trip["is_valid"] or trip["is_stale"]:
            reason_str = "Data quality issues: " + "; ".join(trip["validation_issues"])
            
            # Evaluate deterministic evidence quality status
            evidence_eval = ValidationService.evaluate_evidence_quality(
                trip=trip,
                is_valid=trip["is_valid"],
                is_stale=trip["is_stale"],
                validation_issues=trip["validation_issues"],
                booking_pace=None
            )

            evidence_details = {
                "status": evidence_eval["status"],
                "status_code": evidence_eval["status_code"],
                "can_recommend": False,
                "explanation": evidence_eval["explanation"],
                "occupancy": {
                    "value_pct": trip.get("occupancy_percent", 0.0),
                    "threshold_used": "Not evaluated (blocked by safety policy)",
                    "band": "Blocked"
                },
                "booking_pace": {
                    "available": False,
                    "pace_per_hour": None,
                    "observation_window": "Not evaluated",
                    "description": "Not evaluated (prerequisite data validation failed)"
                },
                "departure": {
                    "departure_time": trip.get("departure_time"),
                    "hours_remaining": None,
                    "label": "Not evaluated"
                },
                "data_freshness": evidence_eval["freshness"],
                "input_diagnostics": evidence_eval["validation_diagnostics"],
                "fare_constraints": {
                    "min_fare": float(trip.get("min_fare", 0.0)),
                    "max_fare": float(trip.get("max_fare", 0.0)),
                    "current_fare": float(trip.get("current_fare", 0.0)),
                    "base_fare": float(trip.get("base_fare", 0.0)),
                    "recommended_fare": float(trip.get("current_fare", 0.0)),
                    "is_clamped": False,
                    "clamped_reason": None
                },
                "competitor_benchmark": {
                    "sample_size": 0,
                    "median_fare": None,
                    "market_position": "Not evaluated (safety block)"
                },
                "applicable_rules": [
                    "Safety Policy: Withhold recommendation on invalid or stale data"
                ]
            }

            rec_id = f"REC-BLOCKED-{uuid.uuid4().hex[:6].upper()}"

            blocked_payload = {
                "recommendation_id": rec_id,
                "trip_id": trip_id,
                "generated_at": now_str,
                "current_fare_at_generation": float(trip["current_fare"]),
                "base_fare_at_generation": float(trip["base_fare"]),
                "recommended_fare": float(trip["current_fare"]),
                "recommended_action": "Maintain fare",
                "fare_difference": 0.0,
                "fare_difference_pct": 0.0,
                "min_fare": float(trip.get("min_fare", 0.0)),
                "max_fare": float(trip.get("max_fare", 0.0)),
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
                    "validation_issues": trip["validation_issues"],
                    "evidence_details": evidence_details
                },
                "booking_pace_info": "Not evaluated",
                "validation_status": "BLOCKED",
                "evidence_quality_status": evidence_eval["status"],
                "evidence_quality_explanation": evidence_eval["explanation"],
                "evidence_quality_details": evidence_details,
                "competitor_summary": {},
                "policy_version": settings.POLICY_VERSION,
                "source_label": trip.get("data_source_label", settings.DATA_SOURCE_LABEL),
                "is_clamped": False,
                "clamped_reason": None,
                "notice": "Rule-based decision support; recommendation withheld due to data checks."
            }

            # Record blocked event in recommendations and audit log
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO recommendations (
                        recommendation_id, trip_id, generated_at, current_fare_at_generation,
                        base_fare_at_generation, recommended_fare, fare_difference,
                        fare_difference_pct, min_fare, max_fare, demand_category,
                        explanation, rule_applied, contributing_factors, booking_pace_info,
                        validation_status, policy_version, source_label, is_clamped,
                        clamped_reason, notice, evidence_quality_status, evidence_quality_details,
                        recommended_action, competitor_summary
                    ) VALUES (
                        :recommendation_id, :trip_id, :generated_at, :current_fare_at_generation,
                        :base_fare_at_generation, :recommended_fare, :fare_difference,
                        :fare_difference_pct, :min_fare, :max_fare, :demand_category,
                        :explanation, :rule_applied, :contributing_factors, :booking_pace_info,
                        :validation_status, :policy_version, :source_label, :is_clamped,
                        :clamped_reason, :notice, :evidence_quality_status, :evidence_quality_details,
                        :recommended_action, :competitor_summary
                    );
                """, {
                    **blocked_payload,
                    "contributing_factors": json.dumps(blocked_payload["contributing_factors"]),
                    "evidence_quality_details": json.dumps(blocked_payload["evidence_quality_details"]),
                    "competitor_summary": json.dumps(blocked_payload["competitor_summary"]),
                    "is_clamped": 0
                })

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
                    json.dumps({
                        "issues": trip["validation_issues"],
                        "is_stale": trip["is_stale"],
                        "evidence_status": evidence_eval["status"]
                    }),
                    now_str,
                    settings.POLICY_VERSION,
                    trip.get("data_source_label", settings.DATA_SOURCE_LABEL)
                ))
                conn.commit()

            return blocked_payload

        # Step 1: Demand classification
        demand_info = DemandClassifier.classify(
            occupancy_percent=trip["occupancy_percent"],
            departure_time=trip["departure_time"],
            snapshots=trip.get("snapshots", [])
        )

        pace_info = demand_info["contributing_factors"].get("booking_pace")
        hours_dep = demand_info["contributing_factors"].get("hours_to_departure")

        # Step 2: Fetch competitor market benchmarks (RedBus & AbhiBus)
        comp_summary = CompetitorService.get_competitor_summary(trip_id)

        # Step 3: Fare recommendation calculation incorporating competitor benchmarks
        pricing_info = PricingPolicy.calculate_recommendation(
            base_fare=trip["base_fare"],
            current_fare=trip["current_fare"],
            min_fare=trip["min_fare"],
            max_fare=trip["max_fare"],
            demand_category=demand_info["demand_category"],
            occupancy_percent=trip["occupancy_percent"],
            booking_pace_info=pace_info,
            hours_to_departure=hours_dep,
            trip_id=trip_id,
            competitor_summary=comp_summary
        )

        # Step 4: Evaluate Explainable Evidence Quality
        evidence_eval = ValidationService.evaluate_evidence_quality(
            trip=trip,
            is_valid=trip["is_valid"],
            is_stale=trip["is_stale"],
            validation_issues=trip["validation_issues"],
            booking_pace=pace_info
        )

        evidence_details = {
            "status": evidence_eval["status"],
            "status_code": evidence_eval["status_code"],
            "can_recommend": True,
            "explanation": evidence_eval["explanation"],
            "occupancy": {
                "value_pct": float(trip["occupancy_percent"]),
                "threshold_used": demand_info["contributing_factors"]["threshold_used"],
                "band": demand_info["demand_category"]
            },
            "booking_pace": {
                "available": pace_info["available"],
                "pace_per_hour": pace_info.get("pace_per_hour"),
                "observation_window": pace_info.get("observation_window_label"),
                "window_hours": pace_info.get("window_hours"),
                "window_start": pace_info.get("window_start"),
                "window_end": pace_info.get("window_end"),
                "snapshots_evaluated": pace_info.get("snapshots_evaluated", 0),
                "seats_delta": pace_info.get("seats_delta"),
                "description": pace_info.get("description")
            },
            "departure": {
                "departure_time": trip["departure_time"],
                "hours_remaining": hours_dep,
                "label": demand_info["contributing_factors"]["time_to_departure_label"]
            },
            "data_freshness": evidence_eval["freshness"],
            "input_diagnostics": evidence_eval["validation_diagnostics"],
            "fare_constraints": {
                "min_fare": float(trip["min_fare"]),
                "max_fare": float(trip["max_fare"]),
                "current_fare": float(trip["current_fare"]),
                "base_fare": float(trip["base_fare"]),
                "raw_calculated_fare": pricing_info.get("raw_fare"),
                "rounding_increment": settings.FARE_ROUNDING_INCREMENT,
                "recommended_fare": float(pricing_info["recommended_fare"]),
                "is_clamped": pricing_info["is_clamped"],
                "clamped_reason": pricing_info["clamped_reason"],
                "suggested_band": pricing_info["suggested_band"]
            },
            "competitor_benchmark": {
                "sample_size": comp_summary.get("sample_size", 0),
                "median_fare": comp_summary.get("median_fare"),
                "min_fare": comp_summary.get("min_fare"),
                "max_fare": comp_summary.get("max_fare"),
                "current_fare_diff_vs_median": comp_summary.get("current_fare_diff_vs_median"),
                "current_fare_diff_vs_median_pct": comp_summary.get("current_fare_diff_vs_median_pct"),
                "market_position": comp_summary.get("market_position", "No data"),
                "platforms": comp_summary.get("platforms_represented", [])
            },
            "applicable_rules": [
                f"Demand Classifier: {demand_info['rule_name']} ({demand_info['contributing_factors']['threshold_used']})",
                f"Pricing Policy: {pricing_info['rule_applied']}",
                f"Action Strategy: {pricing_info.get('recommended_action', 'Maintain fare')}",
                f"Market Benchmark: RedBus & AbhiBus median ₹{comp_summary.get('median_fare', 0):.0f} ({comp_summary.get('sample_size', 0)} listings)" if comp_summary.get("median_fare") else "Market Benchmark: Standalone corridor policy",
                f"Currency Rounding: Nearest ₹{settings.FARE_ROUNDING_INCREMENT}",
                f"Guardrail Constraints: Permitted band ₹{trip['min_fare']:.0f} to ₹{trip['max_fare']:.0f}"
            ]
        }

        rec_id = f"REC-{uuid.uuid4().hex[:8].upper()}"

        rec_payload = {
            "recommendation_id": rec_id,
            "trip_id": trip_id,
            "generated_at": now_str,
            "current_fare_at_generation": float(trip["current_fare"]),
            "base_fare_at_generation": float(trip["base_fare"]),
            "recommended_fare": pricing_info["recommended_fare"],
            "recommended_action": pricing_info.get("recommended_action", "Maintain fare"),
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
                "suggested_band": pricing_info["suggested_band"],
                "evidence_details": evidence_details,
                "competitor_summary": comp_summary
            },
            "booking_pace_info": demand_info["contributing_factors"]["booking_pace"]["description"],
            "validation_status": "VALID",
            "evidence_quality_status": evidence_eval["status"],
            "evidence_quality_explanation": evidence_eval["explanation"],
            "evidence_quality_details": evidence_details,
            "competitor_summary": comp_summary,
            "policy_version": settings.POLICY_VERSION,
            "source_label": trip.get("data_source_label", settings.DATA_SOURCE_LABEL),
            "is_clamped": pricing_info["is_clamped"],
            "clamped_reason": pricing_info["clamped_reason"],
            "notice": "Rule-based decision support; internal operator prototype. Does not modify live passenger fares."
        }

        # Step 5: Persist recommendation and record in audit log
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO recommendations (
                    recommendation_id, trip_id, generated_at, current_fare_at_generation,
                    base_fare_at_generation, recommended_fare, fare_difference,
                    fare_difference_pct, min_fare, max_fare, demand_category,
                    explanation, rule_applied, contributing_factors, booking_pace_info,
                    validation_status, policy_version, source_label, is_clamped,
                    clamped_reason, notice, evidence_quality_status, evidence_quality_details,
                    recommended_action, competitor_summary
                ) VALUES (
                    :recommendation_id, :trip_id, :generated_at, :current_fare_at_generation,
                    :base_fare_at_generation, :recommended_fare, :fare_difference,
                    :fare_difference_pct, :min_fare, :max_fare, :demand_category,
                    :explanation, :rule_applied, :contributing_factors, :booking_pace_info,
                    :validation_status, :policy_version, :source_label, :is_clamped,
                    :clamped_reason, :notice, :evidence_quality_status, :evidence_quality_details,
                    :recommended_action, :competitor_summary
                );
            """, {
                **rec_payload,
                "contributing_factors": json.dumps(rec_payload["contributing_factors"]),
                "evidence_quality_details": json.dumps(rec_payload["evidence_quality_details"]),
                "competitor_summary": json.dumps(rec_payload["competitor_summary"]),
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
                f"Action: {rec_payload['recommended_action']} | {pricing_info['rule_applied']}",
                json.dumps({
                    "demand_category": demand_info["demand_category"],
                    "recommended_action": rec_payload["recommended_action"],
                    "explanation": rec_payload["explanation"],
                    "evidence_status": evidence_eval["status"],
                    "competitor_median": comp_summary.get("median_fare")
                }),
                now_str,
                settings.POLICY_VERSION,
                trip.get("data_source_label", settings.DATA_SOURCE_LABEL)
            ))
            conn.commit()

        return rec_payload
