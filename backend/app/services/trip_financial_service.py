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

    @staticmethod
    def simulate_what_if(
        trip_id: str,
        manual_target_fare: Optional[float] = None,
        manual_adjustment_pct: Optional[float] = None,
        custom_seat_fares: Optional[Dict[str, float]] = None,
        expense_overrides: Optional[Dict[str, float]] = None,
        scenario_type: str = "Base Case"
    ) -> Dict[str, Any]:
        """
        Feature 2: What-If Revenue and Profit Simulator.
        Evaluates Current vs Recommended vs Manually entered alternative pricing scenario side-by-side.
        Calculates expected bookings, occupancy, gross ticket sales, discounts/refunds, net revenue,
        expenses by category, profit/loss, margin, revenue per occupied seat, and break-even metrics.
        """
        seats = SeatDemandService.get_trip_seats(trip_id)
        if not seats:
            raise ValueError(f"Trip '{trip_id}' has no seat inventory configured.")

        # Base expenses with overrides
        expenses = SeatDemandService.get_trip_expenses(trip_id)
        if not expenses:
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
                "notes": "Estimated expenses"
            }
        else:
            expenses = dict(expenses)

        # Apply cost category overrides if operator adjusted them
        if expense_overrides:
            for k, v in expense_overrides.items():
                if k in expenses and isinstance(v, (int, float)):
                    expenses[k] = float(v)
            expenses["total_fixed_expenses"] = (
                expenses["fuel_cost"] + expenses["driver_wages"] + expenses["conductor_wages"] +
                expenses["toll_charges"] + expenses["maintenance_allocation"] +
                expenses["permits_and_taxes"] + expenses["other_costs"]
            )

        total_seats = len(seats)
        booked_seats = [s for s in seats if s["booking_status"] == "booked"]
        available_seats = [s for s in seats if s["booking_status"] == "available"]
        booked_count = len(booked_seats)
        available_count = len(available_seats)
        curr_occ_pct = (booked_count / total_seats * 100.0) if total_seats > 0 else 0.0

        # Verified actual realized cash
        actual_booked_rev = sum(float(s.get("collected_fare") or s.get("current_fare") or 0.0) for s in booked_seats)
        avg_collected_fare = (actual_booked_rev / booked_count) if booked_count > 0 else (float(seats[0]["base_fare"]))

        # Base absorption rate
        if curr_occ_pct >= 70.0:
            base_conv = 0.85
        elif curr_occ_pct <= 30.0:
            base_conv = 0.40
        else:
            base_conv = 0.65

        comm_pct = expenses["platform_commission_pct"] / 100.0
        break_even_rev = round(expenses["total_fixed_expenses"] / (1.0 - comm_pct), 2)

        # -------------------------------------------------------------
        # 1. CURRENT PRICING SCENARIO
        # -------------------------------------------------------------
        curr_avail_fares = [float(s["current_fare"]) for s in available_seats]
        avg_curr_fare = (sum(curr_avail_fares) / len(curr_avail_fares)) if curr_avail_fares else avg_collected_fare
        addl_curr = round(available_count * base_conv)
        forecast_rev_curr = addl_curr * avg_curr_fare
        gross_sales_curr = actual_booked_rev + forecast_rev_curr
        discounts_refunds_curr = 0.0
        net_rev_curr = gross_sales_curr - discounts_refunds_curr
        comm_curr = net_rev_curr * comm_pct
        total_exp_curr = expenses["total_fixed_expenses"] + comm_curr
        profit_curr = net_rev_curr - total_exp_curr
        margin_curr = (profit_curr / net_rev_curr * 100.0) if net_rev_curr > 0 else 0.0
        occ_curr = ((booked_count + addl_curr) / total_seats * 100.0) if total_seats > 0 else 0.0
        rev_per_seat_curr = round(net_rev_curr / (booked_count + addl_curr), 2) if (booked_count + addl_curr) > 0 else 0.0

        # -------------------------------------------------------------
        # 2. RECOMMENDED DYNAMIC SCENARIO
        # -------------------------------------------------------------
        recs = SeatPricingPolicy.calculate_seat_recommendations(trip_id)
        rec_map = {r["seat_id"]: r["recommended_fare"] for r in recs}
        rec_avail_fares = [rec_map.get(s["seat_id"], float(s["current_fare"])) for s in available_seats]
        avg_rec_fare = (sum(rec_avail_fares) / len(rec_avail_fares)) if rec_avail_fares else avg_collected_fare

        fare_ratio_rec = ((avg_rec_fare - avg_curr_fare) / avg_curr_fare) if avg_curr_fare > 0 else 0.0
        elasticity = -0.5
        demand_factor_rec = max(0.2, 1.0 + (elasticity * fare_ratio_rec))
        addl_rec = min(available_count, max(0, round(addl_curr * demand_factor_rec)))
        forecast_rev_rec = addl_rec * avg_rec_fare
        gross_sales_rec = actual_booked_rev + forecast_rev_rec
        discounts_refunds_rec = 0.0
        net_rev_rec = gross_sales_rec - discounts_refunds_rec
        comm_rec = net_rev_rec * comm_pct
        total_exp_rec = expenses["total_fixed_expenses"] + comm_rec
        profit_rec = net_rev_rec - total_exp_rec
        margin_rec = (profit_rec / net_rev_rec * 100.0) if net_rev_rec > 0 else 0.0
        occ_rec = ((booked_count + addl_rec) / total_seats * 100.0) if total_seats > 0 else 0.0
        rev_per_seat_rec = round(net_rev_rec / (booked_count + addl_rec), 2) if (booked_count + addl_rec) > 0 else 0.0

        # -------------------------------------------------------------
        # 3. OPERATOR MANUAL ALTERNATIVE SCENARIO
        # -------------------------------------------------------------
        manual_warnings: List[str] = []
        clamped_count = 0
        manual_avail_fares: List[float] = []

        for s in available_seats:
            sid = s["seat_id"]
            cf = float(s["current_fare"])
            mn = float(s["min_fare"])
            mx = float(s["max_fare"])

            target = cf
            if custom_seat_fares and sid in custom_seat_fares:
                target = float(custom_seat_fares[sid])
            elif manual_target_fare is not None:
                target = float(manual_target_fare)
            elif manual_adjustment_pct is not None:
                target = cf * (1.0 + (manual_adjustment_pct / 100.0))

            # Guardrail clamping against floor and ceiling
            if target < mn:
                target = mn
                clamped_count += 1
            elif target > mx:
                target = mx
                clamped_count += 1

            manual_avail_fares.append(round(target, 2))

        avg_manual_fare = (sum(manual_avail_fares) / len(manual_avail_fares)) if manual_avail_fares else avg_curr_fare

        if clamped_count > 0:
            manual_warnings.append(f"{clamped_count} seat fares clamped to permitted min/max limits to enforce policy guardrails.")

        fare_ratio_manual = ((avg_manual_fare - avg_curr_fare) / avg_curr_fare) if avg_curr_fare > 0 else 0.0
        demand_factor_manual = max(0.15, 1.0 + (elasticity * fare_ratio_manual))

        # Demand multiplier based on scenario_type
        scenario_mult = 1.00
        if scenario_type == "Conservative":
            scenario_mult = 0.75
        elif scenario_type == "Optimistic":
            scenario_mult = 1.25

        addl_manual = min(available_count, max(0, round(addl_curr * demand_factor_manual * scenario_mult)))
        forecast_rev_manual = addl_manual * avg_manual_fare
        gross_sales_manual = actual_booked_rev + forecast_rev_manual

        # Handle explicit discounts if manual average is lower than current
        discounts_refunds_manual = 0.0
        if avg_manual_fare < avg_curr_fare:
            discounts_refunds_manual = round((avg_curr_fare - avg_manual_fare) * addl_manual, 2)

        net_rev_manual = gross_sales_manual
        comm_manual = net_rev_manual * comm_pct
        total_exp_manual = expenses["total_fixed_expenses"] + comm_manual
        profit_manual = net_rev_manual - total_exp_manual
        margin_manual = (profit_manual / net_rev_manual * 100.0) if net_rev_manual > 0 else 0.0
        occ_manual = ((booked_count + addl_manual) / total_seats * 100.0) if total_seats > 0 else 0.0
        rev_per_seat_manual = round(net_rev_manual / (booked_count + addl_manual), 2) if (booked_count + addl_manual) > 0 else 0.0

        # Safety warnings for manual scenario
        if avg_manual_fare < avg_curr_fare and profit_manual < profit_curr:
            manual_warnings.append(
                f"Proposed discount of {abs(fare_ratio_manual * 100.0):.1f}% reduces projected profit by ₹{profit_curr - profit_manual:.0f}. "
                "Demand stimulation is insufficient to offset the price drop."
            )

        if avg_manual_fare > avg_curr_fare and addl_manual < addl_curr:
            manual_warnings.append(
                f"Proposed fare increase (+{fare_ratio_manual * 100.0:.1f}%) reduces expected additional bookings by {addl_curr - addl_manual} seats."
            )



        # Break-even seat occupancy check
        break_even_seats = (break_even_rev / avg_manual_fare) if avg_manual_fare > 0 else total_seats
        break_even_occ_pct = round((break_even_seats / total_seats * 100.0), 1) if total_seats > 0 else 0.0

        # Conservative, Expected, Optimistic for manual scenario
        manual_scenarios = []
        for sname, sdesc, smult in [
            ("Conservative", "Demand is 25% lower; high passenger price sensitivity.", 0.75),
            ("Expected", "Market responds as forecasted under category price elasticity (-0.5).", 1.00),
            ("Optimistic", "Demand is 25% stronger; travel surge absorbs remaining inventory.", 1.25)
        ]:
            s_addl = min(available_count, max(0, round(addl_curr * demand_factor_manual * smult)))
            s_gross = actual_booked_rev + (s_addl * avg_manual_fare)
            s_comm = s_gross * comm_pct
            s_exp = expenses["total_fixed_expenses"] + s_comm
            s_profit = s_gross - s_exp
            s_margin = (s_profit / s_gross * 100.0) if s_gross > 0 else 0.0
            s_occ = ((booked_count + s_addl) / total_seats * 100.0) if total_seats > 0 else 0.0
            manual_scenarios.append({
                "scenario_name": sname,
                "description": sdesc,
                "expected_additional_bookings": s_addl,
                "projected_occupancy_pct": round(s_occ, 1),
                "gross_revenue": round(s_gross, 2),
                "total_expenses": round(s_exp, 2),
                "net_profit": round(s_profit, 2),
                "profit_margin_pct": round(s_margin, 1)
            })

        return {
            "trip_id": trip_id,
            "total_seats": total_seats,
            "actual_booked_seats": booked_count,
            "actual_booked_revenue": round(actual_booked_rev, 2),
            "actual_occupancy_pct": round(curr_occ_pct, 1),
            "break_even_revenue": break_even_rev,
            "break_even_occupancy_pct": break_even_occ_pct,
            "expenses": expenses,
            "scenarios_comparison": {
                "current_pricing": {
                    "label": "Current Pricing",
                    "average_available_fare": round(avg_curr_fare, 2),
                    "expected_additional_bookings": addl_curr,
                    "expected_final_occupancy_pct": round(occ_curr, 1),
                    "gross_ticket_sales": round(gross_sales_curr, 2),
                    "discounts_and_refunds": round(discounts_refunds_curr, 2),
                    "net_ticket_revenue": round(net_rev_curr, 2),
                    "platform_commission": round(comm_curr, 2),
                    "operating_expenses": round(total_exp_curr, 2),
                    "operating_profit_loss": round(profit_curr, 2),
                    "profit_margin_pct": round(margin_curr, 1),
                    "revenue_per_occupied_seat": rev_per_seat_curr,
                    "is_profitable": profit_curr >= 0
                },
                "recommended_pricing": {
                    "label": "FleetYield AI Recommended",
                    "average_available_fare": round(avg_rec_fare, 2),
                    "expected_additional_bookings": addl_rec,
                    "expected_final_occupancy_pct": round(occ_rec, 1),
                    "gross_ticket_sales": round(gross_sales_rec, 2),
                    "discounts_and_refunds": round(discounts_refunds_rec, 2),
                    "net_ticket_revenue": round(net_rev_rec, 2),
                    "platform_commission": round(comm_rec, 2),
                    "operating_expenses": round(total_exp_rec, 2),
                    "operating_profit_loss": round(profit_rec, 2),
                    "profit_margin_pct": round(margin_rec, 1),
                    "revenue_per_occupied_seat": rev_per_seat_rec,
                    "revenue_difference_vs_current": round(net_rev_rec - net_rev_curr, 2),
                    "profit_difference_vs_current": round(profit_rec - profit_curr, 2),
                    "is_profitable": profit_rec >= 0
                },
                "manual_alternative": {
                    "label": "Operator Alternative (Simulated)",
                    "average_available_fare": round(avg_manual_fare, 2),
                    "expected_additional_bookings": addl_manual,
                    "expected_final_occupancy_pct": round(occ_manual, 1),
                    "gross_ticket_sales": round(gross_sales_manual, 2),
                    "discounts_and_refunds": round(discounts_refunds_manual, 2),
                    "net_ticket_revenue": round(net_rev_manual, 2),
                    "platform_commission": round(comm_manual, 2),
                    "operating_expenses": round(total_exp_manual, 2),
                    "operating_profit_loss": round(profit_manual, 2),
                    "profit_margin_pct": round(margin_manual, 1),
                    "revenue_per_occupied_seat": rev_per_seat_manual,
                    "revenue_difference_vs_current": round(net_rev_manual - net_rev_curr, 2),
                    "profit_difference_vs_current": round(profit_manual - profit_curr, 2),
                    "is_profitable": profit_manual >= 0,
                    "scenario_type": scenario_type,
                    "warnings": manual_warnings
                }
            },
            "multi_case_forecasts": manual_scenarios,
            "assumptions_explained": [
                "Passenger price elasticity assumed at -0.5 across intercity corridors.",
                f"Platform booking commission rate applied at {expenses['platform_commission_pct']}%.",
                "Actual booked revenue is locked cash; forecasts only model unbooked available inventory.",
                "Fixed costs (fuel, wages, tolls, maintenance, taxes) are non-refundable operating commitments.",
                "Never guarantees future passenger traffic or yields. Realized outcomes subject to market shifts."
            ]
        }

