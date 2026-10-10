"""FleetYield AI - Operator Review and Decision Service (FR-05, FR-06).

Processes human-in-the-loop Approve, Reject, and Override actions.
Strictly validates override bounds and enforces mandatory rationale.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.db import get_connection
from app.config import settings


class OperatorService:
    @staticmethod
    def record_decision(
        recommendation_id: str,
        decision_type: str,
        decision_fare: Optional[float] = None,
        reason: Optional[str] = None,
        actor_label: str = "Demo operator"
    ) -> Dict[str, Any]:
        """
        Processes and records an operator decision on a recommendation.

        Validations:
        - APPROVED: adopts recommended fare
        - REJECTED: records rejection with optional rationale
        - OVERRIDDEN: requires explicit decision_fare within [min_fare, max_fare] AND mandatory reason
        """
        dtype = decision_type.upper()
        if dtype not in ("APPROVED", "REJECTED", "OVERRIDDEN"):
            raise ValueError(f"Invalid decision type '{decision_type}'. Must be APPROVED, REJECTED, or OVERRIDDEN.")

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM recommendations WHERE recommendation_id = ?",
                (recommendation_id,)
            )
            rec_row = cursor.fetchone()
            if not rec_row:
                raise KeyError(f"Recommendation '{recommendation_id}' not found.")
            rec = dict(rec_row)

            trip_id = rec["trip_id"]
            cursor.execute("SELECT * FROM trips WHERE trip_id = ?", (trip_id,))
            trip_row = cursor.fetchone()
            if not trip_row:
                raise KeyError(f"Trip '{trip_id}' not found.")
            trip = dict(trip_row)

            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            min_fare = float(trip["min_fare"])
            max_fare = float(trip["max_fare"])
            previous_fare = float(trip["current_fare"])

            final_fare: Optional[float] = None
            audit_event_type = f"OPERATOR_{dtype}"

            if dtype == "APPROVED":
                final_fare = float(rec["recommended_fare"])
                final_reason = reason.strip() if reason and reason.strip() else "Operator approved system recommendation"
            elif dtype == "REJECTED":
                final_fare = None
                final_reason = reason.strip() if reason and reason.strip() else "Operator rejected recommendation"
            elif dtype == "OVERRIDDEN":
                if decision_fare is None:
                    raise ValueError("Override requires an explicit target fare amount.")
                if not reason or not reason.strip():
                    raise ValueError("Operator reason is required for manual fare overrides.")

                final_fare = float(decision_fare)
                # Check limits
                if final_fare < min_fare or final_fare > max_fare:
                    raise ValueError(
                        f"Manual override fare ₹{final_fare:.0f} violates configured fare bounds "
                        f"[₹{min_fare:.0f} - ₹{max_fare:.0f}]. Please specify a value within limits."
                    )
                final_reason = reason.strip()

            decision_id = f"DEC-{uuid.uuid4().hex[:8].upper()}"

            # 1. Insert into operator_decisions table
            cursor.execute("""
                INSERT INTO operator_decisions (
                    decision_id, recommendation_id, trip_id, decision_type,
                    decision_fare, reason, created_at, actor_label
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?
                );
            """, (
                decision_id, recommendation_id, trip_id, dtype,
                final_fare, final_reason, now_str, actor_label
            ))

            # 2. If approved or overridden, update internal prototype current_fare
            if final_fare is not None:
                cursor.execute("""
                    UPDATE trips
                    SET current_fare = ?, data_updated_at = ?
                    WHERE trip_id = ?;
                """, (final_fare, now_str, trip_id))

            # 3. Insert into audit_events table
            cursor.execute("""
                INSERT INTO audit_events (
                    audit_id, trip_id, event_type, previous_fare, recommended_fare,
                    final_decision_fare, reason, details, created_at, rule_version,
                    data_source_label, actor_label
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                );
            """, (
                f"AUD-{uuid.uuid4().hex[:8].upper()}",
                trip_id,
                audit_event_type,
                previous_fare,
                float(rec["recommended_fare"]),
                final_fare,
                final_reason,
                json.dumps({
                    "recommendation_id": recommendation_id,
                    "demand_category": rec["demand_category"],
                    "actor": actor_label
                }),
                now_str,
                settings.POLICY_VERSION,
                trip.get("data_source_label", settings.DATA_SOURCE_LABEL),
                actor_label
            ))

            conn.commit()

        return {
            "decision_id": decision_id,
            "recommendation_id": recommendation_id,
            "trip_id": trip_id,
            "decision_type": dtype,
            "decision_fare": final_fare,
            "previous_fare": previous_fare,
            "reason": final_reason,
            "created_at": now_str,
            "actor_label": actor_label,
            "feedback": (
                f"Successfully recorded {dtype.lower()} decision for trip {trip_id}. "
                + (f"Internal current fare updated to ₹{final_fare:.0f}." if final_fare is not None else "Current fare maintained.")
            )
        }
