"""FleetYield AI - Seat-Specific Dynamic Pricing Policy Engine (FR-SEAT-03).

Computes granular, explainable dynamic pricing recommendations for each individual seat/berth:
- Booked seats are strictly locked (no retroactive fare modification).
- High demand front/middle seats: modest premium (+5% to +8%) when empirical evidence supports.
- High demand lower berths: modest premium (+5% to +8%) only when booking evidence warrants.
- Slow-moving back seats: modest discount (-5% to -8%) to stimulate volume.
- Weak demand seat types are NOT inflated simply because another category on the bus is popular.
- Competitor benchmark alignment (RedBus / AbhiBus).
- Hard guardrail clamping to seat min/max bounds and change velocity limits (<= 15% per cycle).
"""

from typing import Dict, Any, List, Optional
import uuid
import json
from datetime import datetime, timezone
from app.config import settings
from app.services.seat_demand_service import SeatDemandService


class SeatPricingPolicy:
    @staticmethod
    def calculate_seat_recommendations(trip_id: str, recommendation_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Generates individual seat pricing recommendations for all seats on a trip.
        Returns a list of seat recommendation records.
        """
        if not recommendation_id:
            recommendation_id = f"REC-SEAT-{uuid.uuid4().hex[:8].upper()}"

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        seats = SeatDemandService.get_trip_seats(trip_id)
        if not seats:
            return []

        demand_analysis = SeatDemandService.analyze_category_demand(trip_id)
        categories = demand_analysis.get("categories", {})
        patterns = demand_analysis.get("patterns", {})
        comp_median = demand_analysis.get("competitor_route_median")
        confidence = demand_analysis.get("confidence_score", "Heuristic estimate")

        inc = settings.FARE_ROUNDING_INCREMENT
        max_pct_change = 15.0  # Max permitted change per update cycle

        seat_recs = []

        for s in seats:
            seat_id = s["seat_id"]
            seat_num = s["seat_number"]
            pos = s["position"]
            stype = s["seat_type"]
            berth = s["berth_type"]
            base_fare = float(s["base_fare"])
            curr_fare = float(s["current_fare"])
            min_fare = float(s["min_fare"])
            max_fare = float(s["max_fare"])
            status = s["booking_status"]

            # Category identification
            cat_key = f"{berth}_sleeper" if berth in ("lower", "upper") else stype
            cat_data = categories.get(cat_key, {})
            cat_demand = cat_data.get("demand_level", "Medium")
            cat_velocity = cat_data.get("booking_velocity", 0.0)

            warnings = []

            # 1. LOCKED (BOOKED) SEATS
            if status == "booked":
                seat_recs.append({
                    "seat_recommendation_id": f"REC-S-{uuid.uuid4().hex[:8].upper()}",
                    "recommendation_id": recommendation_id,
                    "trip_id": trip_id,
                    "seat_id": seat_id,
                    "seat_number": seat_num,
                    "category_key": cat_key,
                    "current_fare": curr_fare,
                    "recommended_fare": curr_fare,
                    "recommended_action": "Locked (Booked)",
                    "fare_difference": 0.0,
                    "fare_difference_pct": 0.0,
                    "rule_applied": "Fare-Lock Rule: Confirmed Passenger Ticket",
                    "explanation": f"Seat {seat_num} is already booked (collected ₹{s.get('collected_fare', curr_fare):.0f}). Price is locked to protect ticket contract integrity.",
                    "demand_category": cat_demand,
                    "booking_velocity": cat_velocity,
                    "competitor_median_for_category": comp_median,
                    "confidence_score": "Verified Data",
                    "warnings": ["Seat is already booked and unavailable for fare changes."],
                    "decision_status": "APPROVED",
                    "approved_fare": curr_fare,
                    "created_at": now_str
                })
                continue

            # 2. EVALUATE DYNAMIC PRICING FOR AVAILABLE SEATS
            # Base adjustment percentage from category demand
            adj_pct = 0.0
            reasons = []

            # Category demand baseline
            if cat_demand == "High":
                adj_pct += 6.0
                reasons.append(f"{cat_key.replace('_', ' ').title()} category demand is High ({cat_data.get('occupancy_pct', 0)}% booked, {cat_velocity} seats/hr)")
            elif cat_demand == "Low":
                adj_pct -= 6.0
                reasons.append(f"{cat_key.replace('_', ' ').title()} category demand is Low ({cat_data.get('occupancy_pct', 0)}% booked)")
            else:
                reasons.append(f"{cat_key.replace('_', ' ').title()} category demand is Balanced ({cat_data.get('occupancy_pct', 0)}% booked)")

            # Position-specific adjustments
            if pos == "front":
                if patterns.get("front_premium_warranted", False):
                    adj_pct += 4.0
                    reasons.append("Front seat premium (+4%) backed by higher passenger booking conversion")
                else:
                    reasons.append("Front seat premium withheld (no preferential conversion over rear seats)")
            elif pos == "back":
                if patterns.get("back_discount_warranted", False):
                    adj_pct -= 4.0
                    reasons.append("Rear seat volume stimulation discount (-4%) applied for lagging demand")

            # Berth-specific adjustments
            if berth == "lower":
                if patterns.get("lower_premium_warranted", False):
                    adj_pct += 5.0
                    reasons.append("Lower berth premium (+5%) validated by strong category booking lead")
                else:
                    reasons.append("Lower berth premium withheld (parity with upper deck)")
            elif berth == "upper":
                if cat_demand == "Low":
                    adj_pct -= 3.0
                    reasons.append("Upper berth discount (-3%) applied to accelerate conversion")

            # Competitor benchmark influence
            if comp_median:
                diff_vs_comp = ((curr_fare - comp_median) / comp_median * 100.0)
                if diff_vs_comp < -10.0 and cat_demand != "Low":
                    adj_pct += 3.0
                    reasons.append(f"Rival apps (RedBus/AbhiBus) charge higher (median ₹{comp_median:.0f}); slight upward yield alignment")
                elif diff_vs_comp > 10.0 and cat_demand != "High":
                    adj_pct -= 3.0
                    reasons.append(f"Rival apps (RedBus/AbhiBus) are cheaper (median ₹{comp_median:.0f}); downward alignment to protect volume")

            # Enforce max percentage change per update cycle (+/- 15%)
            if adj_pct > max_pct_change:
                adj_pct = max_pct_change
                warnings.append(f"Adjustment capped at maximum change limit (+{max_pct_change}% per cycle).")
            elif adj_pct < -max_pct_change:
                adj_pct = -max_pct_change
                warnings.append(f"Discount capped at maximum change limit (-{max_pct_change}% per cycle).")

            # Calculate raw proposed fare
            raw_target = curr_fare * (1.0 + (adj_pct / 100.0))
            rounded_target = round(raw_target / inc) * inc

            # Guardrail clamping against seat-specific min and max bounds
            final_fare = rounded_target
            if rounded_target < min_fare:
                final_fare = min_fare
                warnings.append(f"Target fare ₹{rounded_target:.0f} clamped to permitted floor limit ₹{min_fare:.0f}.")
            elif rounded_target > max_fare:
                final_fare = max_fare
                warnings.append(f"Target fare ₹{rounded_target:.0f} clamped to permitted ceiling limit ₹{max_fare:.0f}.")

            fare_diff = round(final_fare - curr_fare, 2)
            fare_diff_pct = round((fare_diff / curr_fare * 100.0), 1) if curr_fare > 0 else 0.0

            # Determine action
            if fare_diff > 0:
                action = "Increase fare"
            elif fare_diff < 0:
                action = "Decrease fare"
            else:
                action = "Maintain fare"

            if confidence == "Heuristic estimate":
                warnings.append("Insufficient snapshot history for this category; recommendation uses heuristic rule baseline.")

            rule_name = f"Seat Dynamic Policy: {adj_pct:+.1f}% category & position adjustment"
            explanation = (
                f"Action: {action}. Suggested fare: ₹{final_fare:.0f} (current: ₹{curr_fare:.0f}, base: ₹{base_fare:.0f}). "
                f"Signals: {'; '.join(reasons)}. "
                f"Bounded between ₹{min_fare:.0f} and ₹{max_fare:.0f}."
            )

            seat_recs.append({
                "seat_recommendation_id": f"REC-S-{uuid.uuid4().hex[:8].upper()}",
                "recommendation_id": recommendation_id,
                "trip_id": trip_id,
                "seat_id": seat_id,
                "seat_number": seat_num,
                "category_key": cat_key,
                "current_fare": curr_fare,
                "recommended_fare": final_fare,
                "recommended_action": action,
                "fare_difference": fare_diff,
                "fare_difference_pct": fare_diff_pct,
                "rule_applied": rule_name,
                "explanation": explanation,
                "demand_category": cat_demand,
                "booking_velocity": cat_velocity,
                "competitor_median_for_category": comp_median,
                "confidence_score": confidence,
                "warnings": warnings,
                "decision_status": "PENDING",
                "approved_fare": None,
                "created_at": now_str
            })

        return seat_recs

    @staticmethod
    def persist_seat_recommendations(seat_recs: List[Dict[str, Any]]) -> None:
        """Saves generated seat recommendations into SQLite table."""
        if not seat_recs:
            return
        from app.db import get_connection
        with get_connection() as conn:
            cursor = conn.cursor()
            for r in seat_recs:
                cursor.execute("""
                    INSERT OR REPLACE INTO seat_recommendations (
                        seat_recommendation_id, recommendation_id, trip_id, seat_id,
                        seat_number, category_key, current_fare, recommended_fare,
                        recommended_action, fare_difference, fare_difference_pct,
                        rule_applied, explanation, demand_category, booking_velocity,
                        competitor_median_for_category, confidence_score, warnings,
                        decision_status, approved_fare, created_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    );
                """, (
                    r["seat_recommendation_id"], r["recommendation_id"], r["trip_id"],
                    r["seat_id"], r["seat_number"], r["category_key"], r["current_fare"],
                    r["recommended_fare"], r["recommended_action"], r["fare_difference"],
                    r["fare_difference_pct"], r["rule_applied"], r["explanation"],
                    r["demand_category"], r["booking_velocity"], r["competitor_median_for_category"],
                    r["confidence_score"], json.dumps(r["warnings"]), r["decision_status"],
                    r["approved_fare"], r["created_at"]
                ))
            conn.commit()

    @staticmethod
    def get_latest_seat_recommendations(trip_id: str) -> List[Dict[str, Any]]:
        """Fetches the latest recommendation record for each seat on a trip."""
        from app.db import get_connection
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT sr.* FROM seat_recommendations sr
                INNER JOIN (
                    SELECT seat_id, MAX(created_at) as max_created
                    FROM seat_recommendations
                    WHERE trip_id = ?
                    GROUP BY seat_id
                ) latest ON sr.seat_id = latest.seat_id AND sr.created_at = latest.max_created;
            """, (trip_id,))
            rows = [dict(r) for r in cursor.fetchall()]
            for r in rows:
                if isinstance(r.get("warnings"), str):
                    try:
                        r["warnings"] = json.loads(r["warnings"])
                    except Exception:
                        r["warnings"] = []
            return rows
