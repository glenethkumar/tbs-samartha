"""FleetYield AI - Trip Revenue, Expense & Profit Simulation Service (FR-SEAT-04).

Calculates comprehensive economic metrics for a bus trip:
- Actual booked revenue (verified from confirmed passenger transactions)
- Forecast remaining revenue under Current Pricing vs Proposed Seat Dynamic Pricing
- Operating expenses (fuel, driver/conductor wages, tolls, commissions, maintenance, permits)
- Expected trip profit and profit margin percentage
- Break-even revenue and break-even occupancy percentage
- Multi-scenario risk modeling (Conservative, Base Case, Optimistic)
- Clear distinction between actual realized revenue and forecast revenue.
"""

from typing import Dict, Any, List, Optional
from app.services.seat_demand_service import SeatDemandService
from app.services.seat_pricing_policy import SeatPricingPolicy


class TripFinancialService:
    @staticmethod
    def calculate_trip_financials(trip_id: str, seat_recommendations: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Computes detailed financial statements, expense breakdown, and scenario projections.
        """
        seats = SeatDemandService.get_trip_seats(trip_id)
        if not seats:
            raise ValueError(f"Trip '{trip_id}' has no seat inventory configured.")

        expenses = SeatDemandService.get_trip_expenses(trip_id)
        if not expenses:
            # Default fallback expenses if not seeded
            expenses = {
                "trip_id": trip_id,
                "fuel_cost": 8500.0,
                "driver_wages": 2200.0,
                "conductor_wages": 900.0,
                "toll_charges": 1200.0,
                "platform_commission_pct": 8.0,
                "maintenance_allocation": 1400.0,
                "permits_and_taxes": 1200.0,
                "other_costs": 500.0,
                "is_estimated": 1,
                "total_fixed_expenses": 15900.0,
                "notes": "Estimated fallback expenses"
            }

        total_seats = len(seats)
        booked_seats = [s for s in seats if s["booking_status"] == "booked"]
        available_seats = [s for s in seats if s["booking_status"] == "available"]

        booked_count = len(booked_seats)
        available_count = len(available_seats)

        # 1. ACTUAL BOOKED REVENUE (VERIFIED REALIZED CASH)
        booked_rev = sum(float(s.get("collected_fare") or s.get("current_fare") or 0.0) for s in booked_seats)
        avg_collected_fare = (booked_rev / booked_count) if booked_count > 0 else (float(seats[0]["base_fare"]))

        # 2. SEAT RECOMMENDATIONS
        if not seat_recommendations:
            seat_recommendations = SeatPricingPolicy.calculate_seat_recommendations(trip_id)

        rec_fare_map = {r["seat_id"]: r["recommended_fare"] for r in seat_recommendations}

        # 3. BASELINE VS PROPOSED FUTURE REALIZATION MODELING
        # Average available current fare vs proposed dynamic fare
        curr_avail_fares = [float(s["current_fare"]) for s in available_seats]
        prop_avail_fares = [rec_fare_map.get(s["seat_id"], float(s["current_fare"])) for s in available_seats]

        avg_curr_avail_fare = (sum(curr_avail_fares) / len(curr_avail_fares)) if curr_avail_fares else avg_collected_fare
        avg_prop_avail_fare = (sum(prop_avail_fares) / len(prop_avail_fares)) if prop_avail_fares else avg_collected_fare

        # Baseline expected pickup rate (based on current occupancy)
        # Low occupancy trips pick up fewer remaining seats; High occupancy trips convert remaining seats quickly
        curr_occ_pct = (booked_count / total_seats * 100.0) if total_seats > 0 else 0.0
        if curr_occ_pct >= 70.0:
            base_conversion_rate = 0.85  # strong momentum to sell remaining
        elif curr_occ_pct <= 30.0:
            base_conversion_rate = 0.40  # sluggish momentum
        else:
            base_conversion_rate = 0.65  # balanced

        # Base case expected additional bookings
        expected_addl_curr = round(available_count * base_conversion_rate)

        # Price elasticity impact on proposed plan (-0.5 elasticity)
        fare_change_ratio = ((avg_prop_avail_fare - avg_curr_avail_fare) / avg_curr_avail_fare) if avg_curr_avail_fare > 0 else 0.0
        elasticity = -0.5
        demand_response_factor = max(0.2, 1.0 + (elasticity * fare_change_ratio))
        expected_addl_prop = min(available_count, max(0, round(expected_addl_curr * demand_response_factor)))

        # 4. CURRENT PRICING PLAN TOTALS
        forecast_rev_curr = expected_addl_curr * avg_curr_avail_fare
        total_rev_curr = booked_rev + forecast_rev_curr
        comm_pct = expenses["platform_commission_pct"] / 100.0
        total_exp_curr = expenses["total_fixed_expenses"] + (total_rev_curr * comm_pct)
        profit_curr = total_rev_curr - total_exp_curr
        margin_curr = (profit_curr / total_rev_curr * 100.0) if total_rev_curr > 0 else 0.0
        proj_occ_curr = ((booked_count + expected_addl_curr) / total_seats * 100.0) if total_seats > 0 else 0.0

        # 5. PROPOSED DYNAMIC PLAN TOTALS
        forecast_rev_prop = expected_addl_prop * avg_prop_avail_fare
        total_rev_prop = booked_rev + forecast_rev_prop
        total_exp_prop = expenses["total_fixed_expenses"] + (total_rev_prop * comm_pct)
        profit_prop = total_rev_prop - total_exp_prop
        margin_prop = (profit_prop / total_rev_prop * 100.0) if total_rev_prop > 0 else 0.0
        proj_occ_prop = ((booked_count + expected_addl_prop) / total_seats * 100.0) if total_seats > 0 else 0.0

        rev_lift = round(total_rev_prop - total_rev_curr, 2)
        profit_lift = round(profit_prop - profit_curr, 2)

        # 6. BREAK-EVEN METRICS
        # Revenue required to cover fixed operating expenses + platform commission
        break_even_rev = round(expenses["total_fixed_expenses"] / (1.0 - comm_pct), 2)
        avg_seat_fare = (avg_collected_fare + avg_prop_avail_fare) / 2.0
        break_even_seats = (break_even_rev / avg_seat_fare) if avg_seat_fare > 0 else total_seats
        break_even_occ_pct = round((break_even_seats / total_seats * 100.0), 1) if total_seats > 0 else 0.0

        # 7. MULTI-SCENARIO PROJECTIONS (CONSERVATIVE, BASE CASE, OPTIMISTIC)
        scenarios = []
        scenario_defs = [
            ("Conservative", "Demand is 25% lower than expected; passengers exhibit high price friction.", 0.75),
            ("Base Case", "Expected market response using category elasticity and empirical booking pace.", 1.00),
            ("Optimistic", "Demand is 25% stronger; travel surge allows rapid remaining seat absorption.", 1.25)
        ]

        for sname, sdesc, sfactor in scenario_defs:
            s_addl = min(available_count, max(0, round(expected_addl_prop * sfactor)))
            s_forecast_rev = s_addl * avg_prop_avail_fare
            s_total_rev = booked_rev + s_forecast_rev
            s_exp = expenses["total_fixed_expenses"] + (s_total_rev * comm_pct)
            s_profit = s_total_rev - s_exp
            s_margin = (s_profit / s_total_rev * 100.0) if s_total_rev > 0 else 0.0
            s_occ = ((booked_count + s_addl) / total_seats * 100.0) if total_seats > 0 else 0.0

            scenarios.append({
                "scenario_name": sname,
                "description": sdesc,
                "demand_factor": sfactor,
                "expected_additional_bookings": s_addl,
                "forecast_additional_revenue": round(s_forecast_rev, 2),
                "total_expected_revenue": round(s_total_rev, 2),
                "total_expenses": round(s_exp, 2),
                "net_profit": round(s_profit, 2),
                "profit_margin_pct": round(s_margin, 1),
                "projected_occupancy_pct": round(s_occ, 1)
            })

        return {
            "trip_id": trip_id,
            "capacity": total_seats,
            "current_booked_seats": booked_count,
            "current_booked_revenue": round(booked_rev, 2),
            "average_collected_fare": round(avg_collected_fare, 2),
            "expenses": expenses,
            "total_operating_expenses": round(total_exp_prop, 2),
            "break_even_revenue": break_even_rev,
            "break_even_occupancy_pct": break_even_occ_pct,
            "current_pricing_plan": {
                "expected_additional_bookings": expected_addl_curr,
                "forecast_remaining_revenue": round(forecast_rev_curr, 2),
                "expected_total_revenue": round(total_rev_curr, 2),
                "expected_operating_expenses": round(total_exp_curr, 2),
                "expected_net_profit": round(profit_curr, 2),
                "profit_margin_pct": round(margin_curr, 1),
                "expected_occupancy_pct": round(proj_occ_curr, 1)
            },
            "proposed_dynamic_plan": {
                "expected_additional_bookings": expected_addl_prop,
                "forecast_remaining_revenue": round(forecast_rev_prop, 2),
                "expected_total_revenue": round(total_rev_prop, 2),
                "expected_operating_expenses": round(total_exp_prop, 2),
                "expected_net_profit": round(profit_prop, 2),
                "profit_margin_pct": round(margin_prop, 1),
                "expected_occupancy_pct": round(proj_occ_prop, 1),
                "revenue_lift": rev_lift,
                "profit_lift": profit_lift
            },
            "scenarios": scenarios,
            "disclaimer": "SIMULATED FINANCIAL PROJECTION - NOT GUARANTEED PROFIT. Actual realization depends on live passenger demand and market conditions."
        }
