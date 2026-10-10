"""FleetYield AI - Seat-Level Demand Estimation Service (FR-SEAT-02).

Analyzes booking patterns, occupancy, and booking velocity separately for each seat category:
- Berth types: Lower vs. Upper sleepers
- Seat positions: Front vs. Middle vs. Back
- Seat types: Sitting vs. Sleeper vs. Semi-Sleeper

Validates whether front/lower seats actually sell faster against empirical data.
Labels estimates as 'Data-backed estimate' when booking timestamps/snapshots exist,
or 'Heuristic estimate' when relying on baseline rules.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from app.db import get_connection
from app.services.competitor_service import CompetitorService


class SeatDemandService:
    @staticmethod
    def get_trip_seats(trip_id: str) -> List[Dict[str, Any]]:
        """Retrieves all seats for a specific trip ordered by deck, row, and column."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM trip_seats
                WHERE trip_id = ?
                ORDER BY 
                    CASE deck WHEN 'lower' THEN 1 WHEN 'upper' THEN 2 ELSE 3 END,
                    row_idx ASC, col_idx ASC;
            """, (trip_id,))
            return [dict(r) for r in cursor.fetchall()]

    @staticmethod
    def get_trip_expenses(trip_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves operating expenses for a trip."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trip_expenses WHERE trip_id = ?;", (trip_id,))
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            # Calculate total fixed expenses (excluding variable platform commission)
            res["total_fixed_expenses"] = (
                res["fuel_cost"] + res["driver_wages"] + res["conductor_wages"] +
                res["toll_charges"] + res["maintenance_allocation"] +
                res["permits_and_taxes"] + res["other_costs"]
            )
            return res

    @staticmethod
    def analyze_category_demand(trip_id: str) -> Dict[str, Any]:
        """
        Analyzes demand across seat categories and positions for a trip.
        Produces empirical velocity, occupancy, and evidence-backed demand classifications.
        """
        seats = SeatDemandService.get_trip_seats(trip_id)
        if not seats:
            return {
                "categories": {},
                "patterns": {},
                "confidence_score": "Heuristic estimate",
                "evidence_notes": "No seats recorded for trip."
            }

        now = datetime.now(timezone.utc)
        recent_window_hours = 12.0
        cutoff_time = now - timedelta(hours=recent_window_hours)

        # 1. Group seats by primary category key
        # e.g., 'lower_sleeper', 'upper_sleeper', 'sitting', 'semi-sleeper'
        categories: Dict[str, Dict[str, Any]] = {}
        positions: Dict[str, Dict[str, Any]] = {"front": {"total": 0, "booked": 0}, "middle": {"total": 0, "booked": 0}, "back": {"total": 0, "booked": 0}}

        has_timestamped_bookings = False

        for s in seats:
            pos = s["position"]
            stype = s["seat_type"]
            berth = s["berth_type"]
            is_booked = s["booking_status"] == "booked"

            # Track position summary
            if pos in positions:
                positions[pos]["total"] += 1
                if is_booked:
                    positions[pos]["booked"] += 1

            # Determine category key
            if berth in ("lower", "upper"):
                cat_key = f"{berth}_sleeper"
                cat_label = f"{berth.capitalize()} Berth Sleeper"
            else:
                cat_key = stype
                cat_label = stype.replace("-", " ").capitalize()

            if cat_key not in categories:
                categories[cat_key] = {
                    "category_key": cat_key,
                    "label": cat_label,
                    "seat_type": stype,
                    "berth_type": berth,
                    "total_seats": 0,
                    "booked_seats": 0,
                    "available_seats": 0,
                    "occupancy_pct": 0.0,
                    "recent_bookings": 0,
                    "booking_velocity": 0.0,  # seats / hr
                    "demand_level": "Medium",
                    "average_collected_fare": 0.0,
                    "collected_fares": []
                }

            cat = categories[cat_key]
            cat["total_seats"] += 1
            if is_booked:
                cat["booked_seats"] += 1
                if s["collected_fare"]:
                    cat["collected_fares"].append(float(s["collected_fare"]))

                # Check recent booking timestamp
                b_str = s.get("booked_at")
                if b_str:
                    has_timestamped_bookings = True
                    try:
                        b_dt = datetime.fromisoformat(b_str.replace("Z", "+00:00"))
                        if b_dt >= cutoff_time:
                            cat["recent_bookings"] += 1
                    except Exception:
                        pass
            else:
                cat["available_seats"] += 1

        # Calculate metrics for each category
        for cat_key, cat in categories.items():
            tot = cat["total_seats"]
            bkd = cat["booked_seats"]
            cat["occupancy_pct"] = round((bkd / tot * 100.0), 1) if tot > 0 else 0.0
            cat["booking_velocity"] = round(cat["recent_bookings"] / recent_window_hours, 2)
            if cat["collected_fares"]:
                cat["average_collected_fare"] = round(sum(cat["collected_fares"]) / len(cat["collected_fares"]), 2)
            else:
                cat["average_collected_fare"] = 0.0

            # Demand classification per category
            # High demand: >=70% occupancy OR high velocity (>0.5 seats/hr)
            # Low demand: <35% occupancy AND low velocity (<=0.1 seats/hr)
            if cat["occupancy_pct"] >= 70.0 or cat["booking_velocity"] >= 0.5:
                cat["demand_level"] = "High"
            elif cat["occupancy_pct"] < 35.0 and cat["booking_velocity"] <= 0.1:
                cat["demand_level"] = "Low"
            else:
                cat["demand_level"] = "Medium"

        # Position analysis
        for pos_key, pdata in positions.items():
            ptot = pdata["total"]
            pbkd = pdata["booked"]
            pdata["occupancy_pct"] = round((pbkd / ptot * 100.0), 1) if ptot > 0 else 0.0

        # Validate empirical patterns:
        # Check if lower berths sell faster than upper berths
        lower_occ = categories.get("lower_sleeper", {}).get("occupancy_pct")
        upper_occ = categories.get("upper_sleeper", {}).get("occupancy_pct")
        lower_premium_warranted = False
        lower_evidence_note = "Single deck or sleeper berth comparison not applicable."

        if lower_occ is not None and upper_occ is not None:
            if lower_occ > upper_occ:
                lower_premium_warranted = True
                lower_evidence_note = f"Empirical booking evidence confirms lower berths lead demand ({lower_occ}% vs {upper_occ}% upper)."
            elif lower_occ == upper_occ:
                lower_premium_warranted = False
                lower_evidence_note = f"Lower and upper berths exhibit identical booking rates ({lower_occ}%). Parity pricing recommended."
            else:
                lower_premium_warranted = False
                lower_evidence_note = f"Upper berths have booked faster ({upper_occ}% vs {lower_occ}% lower). Lower berth premium withheld."

        # Check if front seats sell faster than back seats
        front_occ = positions["front"]["occupancy_pct"]
        back_occ = positions["back"]["occupancy_pct"]
        front_premium_warranted = False
        back_discount_warranted = False

        if front_occ > back_occ:
            front_premium_warranted = True
            pos_evidence_note = f"Front seats show stronger booking conversion ({front_occ}% vs {back_occ}% rear seats)."
        else:
            front_premium_warranted = False
            pos_evidence_note = f"Front seats do not show preferential conversion over rear seats ({front_occ}% front vs {back_occ}% rear). Premium withheld."

        if back_occ < 40.0:
            back_discount_warranted = True

        # Fetch competitor category benchmarks
        comp_summary = CompetitorService.get_competitor_summary(trip_id)
        comp_median = comp_summary.get("median_fare")

        confidence_score = "Data-backed estimate" if has_timestamped_bookings else "Heuristic estimate"

        return {
            "categories": categories,
            "positions": positions,
            "patterns": {
                "lower_premium_warranted": lower_premium_warranted,
                "lower_evidence_note": lower_evidence_note,
                "front_premium_warranted": front_premium_warranted,
                "back_discount_warranted": back_discount_warranted,
                "position_evidence_note": pos_evidence_note
            },
            "competitor_route_median": comp_median,
            "confidence_score": confidence_score
        }
