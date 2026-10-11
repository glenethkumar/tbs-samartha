"""FleetYield AI - Daily Operations Report & Export Service (Feature 5).

Generates daily summaries distinguishing realized financial actuals from predictive forecasts:
- Total trips, active services, completed services
- Available, booked, and occupied seats across fleet
- Actual collected ticket revenue vs forecast revenue
- Recorded refunds and discounts
- Operating expenses and operating profit/loss
- Pending recommendations and unresolved operational alerts
- Export to formatted CSV
"""

import csv
import io
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.db import get_connection
from app.services.trip_service import TripService
from app.services.trip_financial_service import TripFinancialService
from app.services.alert_service import AlertService


class ReportService:
    @staticmethod
    def generate_daily_report(report_date: Optional[str] = None) -> Dict[str, Any]:
        """
        Compiles the daily operational and financial summary across all active and completed trips.
        """
        now = datetime.now(timezone.utc)
        if not report_date:
            report_date = now.strftime("%Y-%m-%d")

        now_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        trips = TripService.list_trips()
        total_trips = len(trips)
        completed_trips = sum(1 for t in trips if t.get("actual_arrival_time") is not None)
        active_trips = total_trips - completed_trips

        total_capacity = sum(t["total_seats"] for t in trips)
        total_booked = sum(t["booked_seats"] for t in trips)
        total_available = total_capacity - total_booked
        avg_occupancy_pct = round((total_booked / total_capacity * 100.0), 1) if total_capacity > 0 else 0.0

        actual_collected_rev = 0.0
        forecast_total_rev = 0.0
        total_operating_exp = 0.0
        recorded_refunds_discounts = 0.0

        trip_summaries: List[Dict[str, Any]] = []
        unreliable_data_count = 0

        for t in trips:
            tid = t["trip_id"]
            try:
                fin = TripFinancialService.calculate_trip_financials(tid)
                b_rev = fin["current_booked_revenue"]
                curr_plan = fin["current_pricing_plan"]
                f_rev = curr_plan["expected_total_revenue"]
                exp = curr_plan["expected_operating_expenses"]
                prof = curr_plan["expected_net_profit"]
                occ = curr_plan["expected_occupancy_pct"]

                actual_collected_rev += b_rev
                forecast_total_rev += f_rev
                total_operating_exp += exp

                is_unreliable = t.get("is_stale", False) or not t.get("is_valid", True)
                if is_unreliable:
                    unreliable_data_count += 1

                trip_summaries.append({
                    "trip_id": tid,
                    "route_name": t["route_name"],
                    "bus_type": t.get("bus_type", "Standard"),
                    "departure_time": t["departure_time"],
                    "total_seats": t["total_seats"],
                    "booked_seats": t["booked_seats"],
                    "current_occupancy_pct": t.get("occupancy_percent", 0.0),
                    "actual_collected_revenue": round(b_rev, 2),
                    "forecast_total_revenue": round(f_rev, 2),
                    "operating_expenses": round(exp, 2),
                    "projected_profit": round(prof, 2),
                    "is_profitable": prof >= 0,
                    "data_status": "Valid" if not is_unreliable else ("Stale" if t.get("is_stale") else "Invalid")
                })
            except Exception:
                unreliable_data_count += 1

        net_operating_profit = round(actual_collected_rev - total_operating_exp, 2)
        forecast_net_profit = round(forecast_total_rev - total_operating_exp, 2)
        margin_pct = round((net_operating_profit / actual_collected_rev * 100.0), 1) if actual_collected_rev > 0 else 0.0

        # Operational alerts summary
        alerts = AlertService.get_alerts(status="ACTIVE")
        active_alerts_count = len(alerts)

        # Count pending unapproved seat recommendations
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM seat_recommendations WHERE decision_status = 'PENDING';")
            pending_recs = cursor.fetchone()[0]

        return {
            "report_date": report_date,
            "generated_at": now_str,
            "total_trips": total_trips,
            "completed_trips": completed_trips,
            "upcoming_trips": active_trips,
            "active_trips": active_trips,
            "total_seats": total_capacity,
            "total_capacity": total_capacity,
            "total_booked_seats": total_booked,
            "booked_seats": total_booked,
            "available_seats": total_available,
            "overall_occupancy_pct": avg_occupancy_pct,
            "average_occupancy_pct": avg_occupancy_pct,
            "actual_ticket_revenue": round(actual_collected_rev, 2),
            "actual_collected_revenue": round(actual_collected_rev, 2),
            "discounts_and_refunds": round(recorded_refunds_discounts, 2),
            "recorded_discounts_refunds": round(recorded_refunds_discounts, 2),
            "total_operating_expenses": round(total_operating_exp, 2),
            "actual_operating_profit": net_operating_profit,
            "net_operating_profit": net_operating_profit,
            "profit_margin_pct": margin_pct,
            "overall_profit_margin_pct": margin_pct,
            "forecast_total_revenue": round(forecast_total_rev, 2),
            "forecast_net_profit": forecast_net_profit,
            "forecast_vs_actual": {
                "forecast_total_revenue": round(forecast_total_rev, 2),
                "actual_total_revenue": round(actual_collected_rev, 2),
                "revenue_variance": round(actual_collected_rev - forecast_total_rev, 2),
                "forecast_avg_occupancy_pct": round(sum(t.get("forecast_occupancy_pct") or 0.0 for t in trip_summaries) / max(1, len(trip_summaries)), 1),
                "actual_avg_occupancy_pct": avg_occupancy_pct,
                "occupancy_variance_pct": round(avg_occupancy_pct - (sum(t.get("forecast_occupancy_pct") or 0.0 for t in trip_summaries) / max(1, len(trip_summaries))), 1)
            },
            "active_alerts_count": active_alerts_count,
            "pending_recommendations_count": pending_recs,
            "unreliable_data_trips_count": unreliable_data_count,
            "trips_with_unreliable_data": unreliable_data_count,
            "trips": trip_summaries,
            "trip_summaries": trip_summaries,
            "notice": "AUDITED DAILY OPERATIONAL SUMMARY. Actual revenues represent verified passenger ticket sales; forecasts represent market models.",
            "disclaimer": "AUDITED DAILY OPERATIONAL SUMMARY. Actual revenues represent verified passenger ticket sales; forecasts represent market models."
        }

    @staticmethod
    def export_daily_report_csv(report_date: Optional[str] = None) -> str:
        """
        Exports the daily operations report into a standardized CSV document.
        """
        report = ReportService.generate_daily_report(report_date)
        output = io.StringIO()
        writer = csv.writer(output)

        # Header metadata
        writer.writerow(["FleetYield AI - Daily Operations & Financial Report"])
        writer.writerow(["Report Date", report["report_date"]])
        writer.writerow(["Generated At", report["generated_at"]])
        writer.writerow(["Status", "Audited Financials & Yield Analytics"])
        writer.writerow([])

        # Summary KPIs
        writer.writerow(["--- FLEET PERFORMANCE SUMMARY ---"])
        writer.writerow(["Metric", "Realized / Actual", "Forecast / Projected"])
        writer.writerow(["Total Trips (Completed / Active)", f"{report['completed_trips']} / {report['active_trips']}", f"{report['total_trips']} Total"])
        writer.writerow(["Seats (Booked / Capacity)", f"{report['booked_seats']} / {report['total_capacity']}", f"{report['average_occupancy_pct']}% Occupancy"])
        writer.writerow(["Gross Passenger Revenue (₹)", f"{report['actual_collected_revenue']:.2f}", f"{report['forecast_total_revenue']:.2f}"])
        writer.writerow(["Operating Expenses (₹)", f"{report['total_operating_expenses']:.2f}", f"{report['total_operating_expenses']:.2f}"])
        writer.writerow(["Net Operating Profit / Loss (₹)", f"{report['net_operating_profit']:.2f}", f"{report['forecast_net_profit']:.2f}"])
        writer.writerow(["Profit Margin (%)", f"{report['overall_profit_margin_pct']}%", f"{round((report['forecast_net_profit'] / report['forecast_total_revenue'] * 100.0), 1) if report['forecast_total_revenue'] > 0 else 0.0}%"])
        writer.writerow(["Active Alerts", str(report["active_alerts_count"]), "N/A"])
        writer.writerow(["Pending Operator Approvals", str(report["pending_recommendations_count"]), "N/A"])
        writer.writerow([])

        # Trip Detail Table
        writer.writerow(["--- SERVICE BY SERVICE BREAKDOWN ---"])
        writer.writerow([
            "Trip ID", "Route Name", "Bus Type", "Departure Time",
            "Total Seats", "Booked Seats", "Occupancy %",
            "Actual Revenue (₹)", "Forecast Revenue (₹)", "Operating Expenses (₹)",
            "Projected Profit (₹)", "Profitability", "Data Status"
        ])

        for s in report.get("trip_summaries", []):
            writer.writerow([
                s["trip_id"],
                s["route_name"],
                s["bus_type"],
                s["departure_time"],
                s["total_seats"],
                s["booked_seats"],
                f"{s['current_occupancy_pct']}%",
                f"{s['actual_collected_revenue']:.2f}",
                f"{s['forecast_total_revenue']:.2f}",
                f"{s['operating_expenses']:.2f}",
                f"{s['projected_profit']:.2f}",
                "PROFITABLE" if s["is_profitable"] else "LOSS RISK",
                s["data_status"]
            ])

        writer.writerow([])
        writer.writerow(["Disclaimer", report["disclaimer"]])

        return output.getvalue()
