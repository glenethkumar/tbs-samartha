"""FleetYield AI - Seat-Specific Dynamic Pricing Policy Engine (FR-SEAT-03).

Computes granular, explainable dynamic pricing recommendations for each individual seat/berth:
1. Seat & Berth Attributes:
   - Position: front, middle, back.
   - Seat type: sitting vs sleeper.
   - Berth position: upper vs lower.
   - Sleeper arrangement: Single/private sleeper vs Sharing sleeper (treated as distinct fare categories).
   - AC/non-AC and bus category.
   - Seat-level floor (min) and ceiling (max) bounds.
   - Booked seats strictly locked (no retroactive fare modification).

2. Journey Timing Attributes:
   - Duration, stop count, service category (express vs regular), arrival convenience.
   - A faster service may justify a higher fare only when passenger demand validates it.
   - Slower multi-stop routes receive competitive fare positioning.

3. Bus Ratings & Service Quality:
   - Average passenger rating, review count, rating source, on-time performance.
   - Modest quality premium applied only when backed by healthy booking conversion and reliable review volume (>= 50 reviews).
   - Sub-par ratings or stale/sparse reviews withhold quality premiums.

4. Comparable Competitor Benchmarking:
   - Segregates competitor rates by category (single private sleeper vs double sharing vs sitting).
   - Never compares a single private sleeper directly against a double sharing berth.

5. Operating Expenses & Break-Even Feasibility:
   - Verifies whether projected trip revenue covers fixed expenses + platform commission.
   - Hard guardrails: maximum +/- 15% change velocity limit per cycle and min/max clamping.
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
        Generates individual seat pricing recommendations for all seats on a trip,
        incorporating sleeper arrangement, journey timing, quality ratings, and competitor matching.
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
        comp_summary = demand_analysis.get("competitor_summary", {})
        comp_route_median = demand_analysis.get("competitor_route_median")
        confidence = demand_analysis.get("confidence_score", "Heuristic estimate")
        trip_data = demand_analysis.get("trip", {})

        # Trip operating expenses and break-even context
        expenses = SeatDemandService.get_trip_expenses(trip_id)
        fixed_expenses = expenses.get("total_fixed_expenses", 15000.0) if expenses else 15000.0
        comm_pct = (expenses.get("platform_commission_pct", 8.0) / 100.0) if expenses else 0.08
        break_even_rev = fixed_expenses / (1.0 - comm_pct)

        # Overall trip metrics
        total_seats = len(seats)
        booked_seats = [s for s in seats if s["booking_status"] == "booked"]
        booked_count = len(booked_seats)
        trip_occupancy_pct = (booked_count / total_seats * 100.0) if total_seats > 0 else 0.0
        booked_revenue = sum(float(s.get("collected_fare") or s.get("current_fare") or 0.0) for s in booked_seats)

        # Competitor category benchmarks
        category_benchmarks = comp_summary.get("category_benchmarks", {})

        # Journey timing factors from trip
        duration_hours = trip_data.get("estimated_duration_hours")
        stop_count = trip_data.get("stop_count")
        service_category = (trip_data.get("service_category") or "regular").lower()
        is_fast_service = service_category in ("express", "limited-stop") or (stop_count is not None and stop_count <= 2) or (duration_hours and duration_hours < 7.5)
        is_slow_service = service_category == "regular" and ((stop_count is not None and stop_count >= 5) or (duration_hours and duration_hours >= 9.0))

        # Bus quality & rating factors from trip
        avg_rating = trip_data.get("average_rating")
        review_count = trip_data.get("review_count") or 0
        on_time_pct = trip_data.get("on_time_performance_pct")
        has_adequate_reviews = review_count >= 50
        is_high_quality = (avg_rating is not None and avg_rating >= 4.4) and (on_time_pct is None or on_time_pct >= 90.0)
        is_low_quality = avg_rating is not None and avg_rating < 3.8

        inc = settings.FARE_ROUNDING_INCREMENT
        max_pct_change = 15.0  # Max permitted change per update cycle

        seat_recs = []

        for s in seats:
            seat_id = s["seat_id"]
            seat_num = s["seat_number"]
            pos = s["position"]
            stype = s["seat_type"]
            berth = s["berth_type"]
            s_arr = s.get("sleeper_arrangement") or ("single" if stype == "sleeper" and s.get("col_idx") == 1 else ("sharing" if stype == "sleeper" else "none"))
            base_fare = float(s["base_fare"])
            curr_fare = float(s["current_fare"])
            min_fare = float(s["min_fare"])
            max_fare = float(s["max_fare"])
            status = s["booking_status"]

            # Precise Category Key
            if stype == "sleeper":
                cat_key = f"{s_arr}_{berth}_sleeper"
            else:
                cat_key = stype

            cat_data = categories.get(cat_key, {})
            cat_demand = cat_data.get("demand_level", "Medium")
            cat_velocity = cat_data.get("booking_velocity", 0.0)
            cat_occupancy = cat_data.get("occupancy_pct", 0.0)

            warnings: List[str] = []

            # -------------------------------------------------------------
            # 1. LOCKED (BOOKED) SEATS
            # -------------------------------------------------------------
            if status == "booked":
                collected = float(s.get("collected_fare") or curr_fare)
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
                    "explanation": f"Seat {seat_num} is already booked (collected ₹{collected:.0f}). Price is permanently locked to protect passenger ticket contract integrity.",
                    "demand_category": cat_demand,
                    "booking_velocity": cat_velocity,
                    "competitor_median_for_category": comp_route_median,
                    "confidence_score": "Verified Data",
                    "warnings": ["Seat is already booked and locked against fare modifications."],
                    "decision_status": "APPROVED",
                    "approved_fare": curr_fare,
                    "created_at": now_str,
                    "timing_factor_pct": 0.0,
                    "quality_factor_pct": 0.0,
                    "arrangement_factor_pct": 0.0,
                    "break_even_impact": "Not applicable (Ticket confirmed and locked)"
                })
                continue

            # -------------------------------------------------------------
            # 2. EVALUATE DYNAMIC PRICING FOR AVAILABLE SEATS
            # -------------------------------------------------------------
            reasons = []

            # (A) Category & Position Demand Adjustments
            base_adj = 0.0
            if cat_demand == "High":
                base_adj += 5.0
                reasons.append(f"{cat_key.replace('_', ' ').title()} category demand is High ({cat_occupancy:.0f}% booked, {cat_velocity} seats/hr)")
            elif cat_demand == "Low":
                base_adj -= 5.0
                reasons.append(f"{cat_key.replace('_', ' ').title()} category demand is Low ({cat_occupancy:.0f}% booked)")
            else:
                reasons.append(f"{cat_key.replace('_', ' ').title()} category demand is Balanced ({cat_occupancy:.0f}% booked)")

            # Position-specific adjustments (front vs back)
            if pos == "front":
                if patterns.get("front_premium_warranted", False):
                    base_adj += 4.0
                    reasons.append("Front seat premium (+4%) backed by higher passenger booking conversion")
                else:
                    reasons.append("Front seat premium withheld (no preferential conversion over rear seats)")
            elif pos == "back":
                if patterns.get("back_discount_warranted", False):
                    base_adj -= 4.0
                    reasons.append("Rear seat volume stimulation discount (-4%) applied for lagging demand")

            # Berth-specific adjustments (lower vs upper)
            if berth == "lower":
                if patterns.get("lower_premium_warranted", False):
                    base_adj += 4.0
                    reasons.append("Lower berth premium (+4%) validated by strong booking lead")
                else:
                    reasons.append("Lower berth premium withheld (parity with upper deck)")
            elif berth == "upper":
                if cat_demand == "Low":
                    base_adj -= 3.0
                    reasons.append("Upper berth discount (-3%) applied to accelerate conversion")

            # (B) Sleeper Arrangement & Privacy Adjustments
            arrangement_adj = 0.0
            if stype == "sleeper":
                if s_arr == "single":
                    if patterns.get("single_premium_warranted", False):
                        arrangement_adj = 5.0
                        reasons.append("Single private sleeper premium (+5.0%) validated by strong solo booking conversion")
                    else:
                        arrangement_adj = 0.0
                        reasons.append("Single private sleeper premium withheld (conversion does not exceed sharing berths)")
                elif s_arr == "sharing":
                    if cat_demand == "Low":
                        arrangement_adj = -3.0
                        reasons.append("Sharing sleeper volume incentive (-3.0%) applied to attract pairs/budget travelers")
                    else:
                        arrangement_adj = 0.0
                        reasons.append("Standard double sharing sleeper berth parity")
            else:
                arrangement_adj = 0.0

            # (C) Journey Timing Adjustments
            timing_adj = 0.0
            if duration_hours is None:
                warnings.append("Journey duration data is missing or unverified; timing adjustment omitted.")
            elif is_fast_service:
                # Crucial rule: Faster service only gets premium if trip demand validates it
                if trip_occupancy_pct >= 40.0 and cat_demand != "Low":
                    timing_adj = 3.0
                    reasons.append(f"Fast {service_category} service ({duration_hours}h, {stop_count or 1} stops) with validated demand (+3.0%)")
                else:
                    timing_adj = 0.0
                    reasons.append(f"Faster transit premium withheld (trip demand {trip_occupancy_pct:.0f}% insufficient to support time-premium without hurting bookings)")
                    warnings.append("Journey speed premium withheld because passenger demand is not yet high enough to absorb higher fares.")
            elif is_slow_service:
                timing_adj = -2.0
                reasons.append(f"Slower regular schedule ({duration_hours}h, {stop_count} stops) requires competitive fare alignment (-2.0%)")
            else:
                timing_adj = 0.0
                reasons.append("Standard journey duration and arrival window")

            # (D) Bus Ratings & Service Quality Adjustments
            quality_adj = 0.0
            if not has_adequate_reviews:
                warnings.append(f"Rating has low review volume ({review_count} reviews); quality premium withheld to avoid distortion.")
                reasons.append(f"Quality premium withheld due to small review sample ({review_count} reviews)")
            elif is_high_quality:
                # Secondary indicator: apply modest premium only when trip demand is healthy
                if trip_occupancy_pct >= 40.0 and cat_demand != "Low":
                    quality_adj = 2.0
                    reasons.append(f"High passenger rating ({avg_rating:.1f}/5.0 across {review_count:,} reviews, {on_time_pct:.0f}% on-time) supports quality premium (+2.0%)")
                else:
                    quality_adj = 0.0
                    reasons.append("Quality premium withheld because overall trip demand is lagging")
            elif is_low_quality:
                quality_adj = -2.0
                reasons.append(f"Sub-par passenger rating ({avg_rating:.1f}/5.0) requires value-priced fare to maintain bookings (-2.0%)")
            else:
                reasons.append(f"Passenger rating ({avg_rating or 'N/A'}/5.0) within normal market tier")

            # (E) Comparable Competitor Matching (Category Specific)
            comp_cat_median = None
            comp_adj = 0.0

            if stype == "sleeper":
                if s_arr == "single":
                    bench = category_benchmarks.get("single_sleeper")
                else:
                    bench = category_benchmarks.get("sharing_sleeper")
            else:
                bench = category_benchmarks.get("sitting")

            if bench and bench.get("median"):
                comp_cat_median = float(bench["median"])
                reasons.append(f"Benchmarked against competitor {s_arr if stype == 'sleeper' else stype} median (₹{comp_cat_median:.0f} across {bench.get('count', 0)} listings)")
            elif comp_route_median:
                comp_cat_median = float(comp_route_median)
                warnings.append(f"Category-specific competitor benchmark for {cat_key} unavailable; using general corridor median ₹{comp_cat_median:.0f} with caution.")
                reasons.append(f"General route median (₹{comp_cat_median:.0f}) used as benchmark fallback")
            else:
                warnings.append("No comparable competitor fares available on RedBus or AbhiBus for this departure window.")

            if comp_cat_median:
                diff_vs_comp = ((curr_fare - comp_cat_median) / comp_cat_median * 100.0)
                if diff_vs_comp < -10.0 and cat_demand != "Low":
                    comp_adj = 3.0
                    reasons.append(f"Competitor category median (₹{comp_cat_median:.0f}) is higher; upward yield alignment (+3.0%)")
                elif diff_vs_comp > 10.0 and cat_demand != "High":
                    comp_adj = -3.0
                    reasons.append(f"Competitor category median (₹{comp_cat_median:.0f}) is lower; downward alignment (-3.0%) to prevent attrition")

            # Sum of all adjustment factors
            raw_adj_pct = base_adj + arrangement_adj + timing_adj + quality_adj + comp_adj

            # Enforce max percentage change per update cycle (+/- 15%)
            adj_pct = raw_adj_pct
            if adj_pct > max_pct_change:
                adj_pct = max_pct_change
                warnings.append(f"Adjustment capped at maximum change limit (+{max_pct_change}% per cycle).")
            elif adj_pct < -max_pct_change:
                adj_pct = -max_pct_change
                warnings.append(f"Discount capped at maximum change limit (-{max_pct_change}% per cycle).")

            # Calculate raw target and rounded target
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

            # Determine action label
            if fare_diff > 0:
                action = "Increase fare"
            elif fare_diff < 0:
                action = "Decrease fare"
            else:
                action = "Maintain fare"

            if confidence == "Heuristic estimate":
                warnings.append("Insufficient snapshot history for this category; recommendation uses heuristic baseline.")

            # Break-even feasibility check
            # Estimate remaining trip revenue under current trajectory
            available_seats_count = total_seats - booked_count
            est_remaining_rev = available_seats_count * final_fare * 0.65  # 65% base expected absorption
            est_total_rev = booked_revenue + est_remaining_rev
            if est_total_rev < break_even_rev:
                break_even_impact = f"Break-even alert: Projected trip revenue (₹{est_total_rev:.0f}) may fail to cover operating costs (₹{fixed_expenses:.0f})."
                warnings.append("Trip projected revenue may fail to cover operating expenses (break-even requirement not met).")
            else:
                break_even_impact = f"Trip revenue covers operating expenses (projected surplus ₹{est_total_rev - fixed_expenses:.0f})."

            rule_name = f"Multi-Factor Seat Dynamic Policy ({adj_pct:+.1f}% total: base {base_adj:+.1f}%, arr {arrangement_adj:+.1f}%, timing {timing_adj:+.1f}%, qual {quality_adj:+.1f}%, comp {comp_adj:+.1f}%)"
            explanation = (
                f"Action: {action}. Suggested fare: ₹{final_fare:.0f} (current: ₹{curr_fare:.0f}, base: ₹{base_fare:.0f}). "
                f"Signals: {'; '.join(reasons)}. "
                f"Floor: ₹{min_fare:.0f}, Ceiling: ₹{max_fare:.0f}."
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
                "competitor_median_for_category": comp_cat_median,
                "confidence_score": confidence,
                "warnings": warnings,
                "decision_status": "PENDING",
                "approved_fare": None,
                "created_at": now_str,
                "timing_factor_pct": round(timing_adj, 1),
                "quality_factor_pct": round(quality_adj, 1),
                "arrangement_factor_pct": round(arrangement_adj, 1),
                "break_even_impact": break_even_impact
            })

        return seat_recs

    @staticmethod
    def persist_seat_recommendations(seat_recs: List[Dict[str, Any]]) -> None:
        """Saves generated seat recommendations into SQLite table with complete factor breakdowns."""
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
                        decision_status, approved_fare, created_at,
                        timing_factor_pct, quality_factor_pct, arrangement_factor_pct, break_even_impact
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    );
                """, (
                    r["seat_recommendation_id"], r["recommendation_id"], r["trip_id"],
                    r["seat_id"], r["seat_number"], r["category_key"], r["current_fare"],
                    r["recommended_fare"], r["recommended_action"], r["fare_difference"],
                    r["fare_difference_pct"], r["rule_applied"], r["explanation"],
                    r["demand_category"], r["booking_velocity"], r["competitor_median_for_category"],
                    r["confidence_score"], json.dumps(r["warnings"]), r["decision_status"],
                    r["approved_fare"], r["created_at"],
                    r.get("timing_factor_pct", 0.0), r.get("quality_factor_pct", 0.0),
                    r.get("arrangement_factor_pct", 0.0), r.get("break_even_impact", "")
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
