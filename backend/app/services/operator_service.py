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

        if recommendation_id.startswith("REC-BLOCKED-"):
            raise ValueError(
                "Cannot record an operator decision on a withheld/blocked recommendation. "
                "Resolve trip validation issues first."
            )

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

            # Prevent duplicate decision submissions for the same recommendation
            cursor.execute(
                "SELECT * FROM operator_decisions WHERE recommendation_id = ?",
                (recommendation_id,)
            )
            existing_decision = cursor.fetchone()
            if existing_decision:
                prev_type = existing_decision["decision_type"]
                raise ValueError(
                    f"A decision ({prev_type}) has already been recorded for recommendation '{recommendation_id}'. "
                    f"Please generate a new recommendation to submit another decision."
                )

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

    @staticmethod
    def record_seat_decisions(
        trip_id: str,
        seat_ids: List[str],
        decision_type: str,
        decision_fare: Optional[float] = None,
        reason: Optional[str] = None,
        actor_label: str = "Demo operator"
    ) -> Dict[str, Any]:
        """
        Processes and records operator approval, rejection, or override for seat recommendations.
        Prevents modifying already-booked seats. Enforces guardrail bounds on overrides.
        """
        dtype = decision_type.upper()
        if dtype not in ("APPROVED", "REJECTED", "OVERRIDDEN"):
            raise ValueError(f"Invalid decision type '{decision_type}'. Must be APPROVED, REJECTED, or OVERRIDDEN.")

        if not seat_ids:
            raise ValueError("No seat IDs provided for decision.")

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        with get_connection() as conn:
            cursor = conn.cursor()

            # Verify trip exists
            cursor.execute("SELECT * FROM trips WHERE trip_id = ?", (trip_id,))
            trip_row = cursor.fetchone()
            if not trip_row:
                raise KeyError(f"Trip '{trip_id}' not found.")
            trip = dict(trip_row)

            # Fetch target seats
            placeholders = ",".join("?" for _ in seat_ids)
            cursor.execute(f"SELECT * FROM trip_seats WHERE trip_id = ? AND seat_id IN ({placeholders});", [trip_id] + seat_ids)
            seats_db = [dict(r) for r in cursor.fetchall()]
            if not seats_db:
                raise ValueError("No matching seats found for this trip.")

            # Filter out booked seats
            available_seats = [s for s in seats_db if s["booking_status"] == "available"]
            if not available_seats:
                raise ValueError("All selected seats are already booked. Booked seats cannot have fares altered.")

            # Validate override bounds
            if dtype == "OVERRIDDEN":
                if decision_fare is None:
                    raise ValueError("Manual override requires an explicit target fare amount.")
                if not reason or not reason.strip():
                    raise ValueError("Operator reason is required for manual seat fare overrides.")
                decision_fare = float(decision_fare)
                for s in available_seats:
                    if decision_fare < s["min_fare"] or decision_fare > s["max_fare"]:
                        raise ValueError(
                            f"Manual override fare ₹{decision_fare:.0f} violates bounds for seat {s['seat_number']} "
                            f"[₹{s['min_fare']:.0f} - ₹{s['max_fare']:.0f}]."
                        )

            # Fetch latest recommendations for available seats
            avail_ids = [s["seat_id"] for s in available_seats]
            avail_placeholders = ",".join("?" for _ in avail_ids)
            cursor.execute(
                f"""
                SELECT sr.* FROM seat_recommendations sr
                INNER JOIN (
                    SELECT seat_id, MAX(created_at) as max_created
                    FROM seat_recommendations
                    WHERE trip_id = ? AND seat_id IN ({avail_placeholders})
                    GROUP BY seat_id
                ) latest ON sr.seat_id = latest.seat_id AND sr.created_at = latest.max_created;
                """,
                [trip_id] + avail_ids
            )
            recs_by_seat = {r["seat_id"]: dict(r) for r in cursor.fetchall()}

            updated_count = 0
            for s in available_seats:
                sid = s["seat_id"]
                prev_fare = float(s["current_fare"])
                rec = recs_by_seat.get(sid)

                if dtype == "APPROVED":
                    target_fare = float(rec["recommended_fare"]) if rec else prev_fare
                    cursor.execute("UPDATE trip_seats SET current_fare = ? WHERE seat_id = ?;", (target_fare, sid))
                    cursor.execute("""
                        UPDATE seat_recommendations
                        SET decision_status = 'APPROVED', approved_fare = ?
                        WHERE trip_id = ? AND seat_id = ? AND decision_status = 'PENDING';
                    """, (target_fare, trip_id, sid))
                    cursor.execute("""
                        UPDATE recommendation_snapshots
                        SET decision_status = 'APPROVED', applied_fare = ?, decision_reason = ?, actor_label = ?, effective_at = ?
                        WHERE trip_id = ? AND seat_id = ? AND decision_status = 'PENDING';
                    """, (target_fare, reason or "Operator approved recommendation", actor_label, now_str, trip_id, sid))
                    updated_count += 1

                elif dtype == "REJECTED":
                    cursor.execute("""
                        UPDATE seat_recommendations
                        SET decision_status = 'REJECTED'
                        WHERE trip_id = ? AND seat_id = ? AND decision_status = 'PENDING';
                    """, (trip_id, sid))
                    cursor.execute("""
                        UPDATE recommendation_snapshots
                        SET decision_status = 'REJECTED', decision_reason = ?, actor_label = ?, effective_at = ?
                        WHERE trip_id = ? AND seat_id = ? AND decision_status = 'PENDING';
                    """, (reason or "Operator rejected recommendation", actor_label, now_str, trip_id, sid))
                    updated_count += 1

                elif dtype == "OVERRIDDEN":
                    target_fare = float(decision_fare)
                    cursor.execute("UPDATE trip_seats SET current_fare = ? WHERE seat_id = ?;", (target_fare, sid))
                    cursor.execute("""
                        UPDATE seat_recommendations
                        SET decision_status = 'OVERRIDDEN', approved_fare = ?
                        WHERE trip_id = ? AND seat_id = ? AND decision_status = 'PENDING';
                    """, (target_fare, trip_id, sid))
                    cursor.execute("""
                        UPDATE recommendation_snapshots
                        SET decision_status = 'OVERRIDDEN', applied_fare = ?, decision_reason = ?, actor_label = ?, effective_at = ?
                        WHERE trip_id = ? AND seat_id = ? AND decision_status = 'PENDING';
                    """, (target_fare, reason, actor_label, now_str, trip_id, sid))
                    updated_count += 1

            # Recalculate trip average current fare
            cursor.execute("SELECT AVG(current_fare) FROM trip_seats WHERE trip_id = ?;", (trip_id,))
            new_avg_fare = cursor.fetchone()[0]
            if new_avg_fare is not None:
                new_avg_rounded = round(float(new_avg_fare) / 10.0) * 10.0

                cursor.execute("UPDATE trips SET current_fare = ?, data_updated_at = ? WHERE trip_id = ?;", (new_avg_rounded, now_str, trip_id))

            # Audit event
            audit_id = f"AUD-SEAT-{uuid.uuid4().hex[:8].upper()}"
            cursor.execute("""
                INSERT INTO audit_events (
                    audit_id, trip_id, event_type, previous_fare, recommended_fare,
                    final_decision_fare, reason, details, created_at, rule_version,
                    data_source_label, actor_label
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                );
            """, (
                audit_id,
                trip_id,
                f"OPERATOR_SEAT_{dtype}",
                float(trip["current_fare"]),
                None,
                float(decision_fare) if decision_fare is not None else None,
                reason or f"Operator {dtype.lower()} recommendations for {updated_count} seats",
                json.dumps({
                    "seat_ids": avail_ids,
                    "updated_count": updated_count,
                    "decision_type": dtype
                }),
                now_str,
                settings.POLICY_VERSION,
                trip.get("data_source_label", settings.DATA_SOURCE_LABEL),
                actor_label
            ))

            conn.commit()

        return {
            "success": True,
            "trip_id": trip_id,
            "decision_type": dtype,
            "updated_seats_count": updated_count,
            "message": f"Successfully applied {dtype.lower()} decision to {updated_count} available seats."
        }
