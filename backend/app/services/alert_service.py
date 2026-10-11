"""FleetYield AI - Operational Alerts Engine (Feature 5).

Generates, deduplicates, and manages operational warnings and notifications:
- Low occupancy or slower-than-expected bookings
- Operating loss forecasts (break-even shortfalls)
- Unusually fast or slow seat category velocity
- Competitor fare shifts and stale/missing competitor data
- Insufficient data or clamping alerts
- Unapproved recommendations awaiting operator sign-off
- Deduplication against existing active alerts
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.db import get_connection
from app.services.trip_service import TripService
from app.services.seat_demand_service import SeatDemandService
from app.services.competitor_service import CompetitorService
from app.services.trip_financial_service import TripFinancialService


class AlertService:
    @staticmethod
    def scan_and_generate_alerts(trip_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Scans all trips (or a specific trip) for operational anomalies and generates deduplicated alerts.
        """
        trips = [TripService.get_trip(trip_id)] if trip_id else TripService.list_trips()
        trips = [t for t in trips if t is not None]

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        generated_alerts: List[Dict[str, Any]] = []

        with get_connection() as conn:
            cursor = conn.cursor()

            # Fetch existing active alerts for deduplication
            cursor.execute("SELECT alert_type, trip_id, COALESCE(seat_id, '') as seat_id FROM operational_alerts WHERE status = 'ACTIVE';")
            active_keys = set((row["alert_type"], row["trip_id"], row["seat_id"]) for row in cursor.fetchall())

            def add_alert(alert_type: str, t_id: str, severity: str, title: str, message: str, s_id: Optional[str] = None):
                key = (alert_type, t_id, s_id or "")
                if key in active_keys:
                    return  # Prevent duplicates

                aid = f"ALT-{uuid.uuid4().hex[:8].upper()}"
                cursor.execute("""
                    INSERT INTO operational_alerts (
                        alert_id, trip_id, seat_id, severity, alert_type,
                        title, message, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?);
                """, (aid, t_id, s_id, severity, alert_type, title, message, now_str))
                active_keys.add(key)
                generated_alerts.append({
                    "alert_id": aid,
                    "trip_id": t_id,
                    "seat_id": s_id,
                    "severity": severity,
                    "alert_type": alert_type,
                    "title": title,
                    "message": message,
                    "status": "ACTIVE",
                    "created_at": now_str
                })

            for t in trips:
                tid = t["trip_id"]
                route = t["route_name"]
                total = t["total_seats"]
                booked = t["booked_seats"]
                occ = t.get("occupancy_percent") or (round(booked / total * 100.0, 1) if total > 0 else 0.0)

                # 1. Invalid or overbooked capacity check
                if booked > total:
                    add_alert(
                        "LIMIT_EXCEEDED", tid, "CRITICAL",
                        f"Overbooking Detected on {tid}",
                        f"Booked seats ({booked}) exceeds bus capacity ({total}) on {route}. Action required immediately."
                    )
                    continue

                # 2. Operating loss risk check
                try:
                    fin = TripFinancialService.calculate_trip_financials(tid)
                    exp_curr_profit = fin["current_pricing_plan"]["expected_net_profit"]
                    break_even_rev = fin["break_even_revenue"]
                    exp_curr_rev = fin["current_pricing_plan"]["expected_total_revenue"]

                    if exp_curr_profit < 0:
                        add_alert(
                            "PROJECTED_LOSS", tid, "CRITICAL",
                            f"Operating Loss Forecast for {tid}",
                            f"Trip {tid} ({route}) is projected to generate ₹{exp_curr_profit:.0f} loss. Expected revenue ₹{exp_curr_rev:.0f} falls short of break-even requirement (₹{break_even_rev:.0f})."
                        )
                except Exception:
                    add_alert(
                        "MISSING_EXPENSES", tid, "WARNING",
                        f"Missing Financial Parameters for {tid}",
                        f"Unable to compute trip economics for {tid}. Check operating expenses and cost allocations."
                    )

                # 3. Low occupancy / slow velocity warning
                if occ < 30.0:
                    add_alert(
                        "LOW_OCCUPANCY", tid, "WARNING",
                        f"Low Occupancy Lag on {tid}",
                        f"Current occupancy is only {occ:.0f}% ({booked}/{total} seats). Booking pace is sluggish."
                    )

                # 4. Competitor fare shifts and stale data
                try:
                    comp_summary = CompetitorService.get_competitor_summary(tid)
                    if comp_summary.get("sample_size", 0) == 0:
                        add_alert(
                            "INSUFFICIENT_DATA", tid, "INFO",
                            f"No Competitor Listings for {tid}",
                            f"Zero comparable competitor listings found for {route}. Pricing engine using route heuristic baseline."
                        )

                    trends = CompetitorService.get_competitor_fare_trends(tid, days=7)
                    if trends.get("is_stale"):
                        add_alert(
                            "STALE_COMPETITOR", tid, "WARNING",
                            f"Stale Competitor Data for {tid}",
                            f"Competitor observations for {route} are older than 24 hours. Verify latest market prices."
                        )

                    for shift in trends.get("recent_price_shifts", []):
                        if shift.get("is_unusual_movement"):
                            add_alert(
                                "COMPETITOR_SHIFT", tid, "WARNING",
                                f"Unusual Competitor Fare Movement on {route}",
                                f"{shift['operator_name']} changed fares by {shift['fare_difference_pct']:+.1f}% (₹{shift['earliest_fare']:.0f} to ₹{shift['latest_fare']:.0f})."
                            )
                except Exception:
                    pass

                # 5. Check pending recommendations awaiting operator approval
                cursor.execute("""
                    SELECT COUNT(*) as pending_count,
                           SUM(CASE WHEN warnings LIKE '%clamped%' THEN 1 ELSE 0 END) as clamped_count
                    FROM seat_recommendations sr
                    JOIN trip_seats ts ON sr.seat_id = ts.seat_id
                    WHERE sr.trip_id = ? AND sr.decision_status = 'PENDING' AND ts.booking_status = 'available';
                """, (tid,))
                row = cursor.fetchone()
                pending_count = row["pending_count"] if row else 0
                clamped_count = row["clamped_count"] if row else 0


                if pending_count > 0:
                    add_alert(
                        "PENDING_APPROVAL", tid, "INFO",
                        f"{pending_count} Recommendations Awaiting Approval",
                        f"Trip {tid} has {pending_count} dynamic seat pricing recommendations awaiting operator review."
                    )

                if clamped_count and clamped_count > 0:
                    add_alert(
                        "LIMIT_EXCEEDED", tid, "WARNING",
                        f"Fare Clamping Limit Enforced on {tid}",
                        f"{clamped_count} recommendations on {tid} were clamped to statutory minimum/maximum fare limits."
                    )

            conn.commit()

        return generated_alerts

    @staticmethod
    def get_alerts(status: Optional[str] = None, severity: Optional[str] = None, trip_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves operational alerts with optional status, severity, and trip filtering."""
        with get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM operational_alerts WHERE 1=1"
            params: List[Any] = []

            if status:
                query += " AND status = ?"
                params.append(status.upper())
            if severity:
                query += " AND severity = ?"
                params.append(severity.upper())
            if trip_id:
                query += " AND trip_id = ?"
                params.append(trip_id)

            query += " ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, created_at DESC;"
            cursor.execute(query, params)
            return [dict(r) for r in cursor.fetchall()]

    @staticmethod
    def acknowledge_alert(alert_id: str, actor_label: str = "Demo operator") -> Dict[str, Any]:
        """Marks an alert as acknowledged by the operator."""
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE operational_alerts
                SET status = 'ACKNOWLEDGED', acknowledged_at = ?, acknowledged_by = ?
                WHERE alert_id = ?;
            """, (now_str, actor_label, alert_id))
            if cursor.rowcount == 0:
                raise KeyError(f"Alert '{alert_id}' not found")
            conn.commit()

            cursor.execute("SELECT * FROM operational_alerts WHERE alert_id = ?;", (alert_id,))
            return dict(cursor.fetchone())

    @staticmethod
    def resolve_alert(alert_id: str, actor_label: str = "Demo operator") -> Dict[str, Any]:
        """Marks an alert as resolved."""
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE operational_alerts
                SET status = 'RESOLVED', resolved_at = ?, resolved_by = ?
                WHERE alert_id = ?;
            """, (now_str, actor_label, alert_id))
            if cursor.rowcount == 0:
                raise KeyError(f"Alert '{alert_id}' not found")
            conn.commit()

            cursor.execute("SELECT * FROM operational_alerts WHERE alert_id = ?;", (alert_id,))
            return dict(cursor.fetchone())
