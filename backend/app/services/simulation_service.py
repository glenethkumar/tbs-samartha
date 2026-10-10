"""FleetYield AI - Fixed-Fare Baseline Comparison and Simulation Engine (FR-08).

Compares a Fixed-Fare baseline policy against FleetYield rule-based dynamic pricing
under identical scenario inputs, capacity constraints, and transparent assumptions.

PROMINENT NOTICE:
SIMULATED - NOT REAL-WORLD PERFORMANCE.
Illustrative decision-support model; does not guarantee real-world revenue or occupancy.
"""

from typing import Dict, Any, List, Optional
from app.config import settings
from app.services.trip_service import TripService
from app.services.pricing_policy import PricingPolicy
from app.services.demand_classifier import DemandClassifier


class SimulationService:
    @staticmethod
    def run_simulation(
        demand_multiplier: float = 1.0,
        price_elasticity: float = -0.5,
        trip_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Runs a deterministic baseline vs FleetYield policy comparison.

        Inputs:
        - demand_multiplier: market demand factor (0.5 to 2.0, default 1.0)
        - price_elasticity: demand response coefficient (e.g. -0.5, default -0.5; 0.0 = inelastic)
        - trip_ids: optional list of trips to simulate (defaults to all valid trips)
        """
        trips = TripService.list_trips()
        # Filter for valid trips
        valid_trips = [t for t in trips if t["is_valid"] and not t["is_stale"]]
        if trip_ids:
            valid_trips = [t for t in valid_trips if t["trip_id"] in trip_ids]

        if not valid_trips:
            raise ValueError("No valid trips available for simulation.")

        trip_rows: List[Dict[str, Any]] = []

        baseline_rev_total = 0.0
        baseline_seats_total = 0
        baseline_capacity_total = 0

        fleet_rev_total = 0.0
        fleet_seats_total = 0
        fleet_capacity_total = 0

        for t in valid_trips:
            capacity = t["total_seats"]
            existing_booked = t["booked_seats"]
            base_fare = float(t["base_fare"])
            min_fare = float(t["min_fare"])
            max_fare = float(t["max_fare"])
            remaining_seats = max(0, capacity - existing_booked)

            # Determine demand category
            demand_info = DemandClassifier.classify(
                t["occupancy_percent"],
                t["departure_time"],
                snapshots=[]
            )
            category = demand_info["demand_category"]

            # Compute FleetYield recommended fare
            pricing_info = PricingPolicy.calculate_recommendation(
                base_fare=base_fare,
                current_fare=float(t["current_fare"]),
                min_fare=min_fare,
                max_fare=max_fare,
                demand_category=category,
                occupancy_percent=t["occupancy_percent"]
            )
            fleet_fare = pricing_info["recommended_fare"]

            # Base prospective unbooked demand seeking seats for this trip
            base_unmet_demand = round(remaining_seats * demand_multiplier)

            # 1. FIXED-FARE BASELINE POLICY
            # Offered fare is base_fare.
            realized_additional_baseline = min(remaining_seats, base_unmet_demand)
            total_sold_baseline = existing_booked + realized_additional_baseline
            rev_baseline = total_sold_baseline * base_fare
            occ_baseline = (total_sold_baseline / capacity) * 100.0 if capacity > 0 else 0.0

            # 2. FLEETYIELD DYNAMIC POLICY
            # Offered fare is fleet_fare.
            price_ratio = (fleet_fare - base_fare) / base_fare if base_fare > 0 else 0.0
            # Illustrative elasticity demand factor
            demand_response_factor = max(0.0, 1.0 + (price_elasticity * price_ratio))
            adjusted_unmet_demand = max(0, round(base_unmet_demand * demand_response_factor))
            realized_additional_fleet = min(remaining_seats, adjusted_unmet_demand)
            total_sold_fleet = existing_booked + realized_additional_fleet

            # Revenue: initial bookings at base fare, additional new bookings at dynamic fare
            rev_fleet = (existing_booked * base_fare) + (realized_additional_fleet * fleet_fare)
            occ_fleet = (total_sold_fleet / capacity) * 100.0 if capacity > 0 else 0.0

            # Record row
            rev_diff = rev_fleet - rev_baseline
            seats_diff = total_sold_fleet - total_sold_baseline

            trip_rows.append({
                "trip_id": t["trip_id"],
                "route_name": t["route_name"],
                "total_seats": capacity,
                "demand_category": category,
                "baseline_fare": base_fare,
                "baseline_sold_seats": total_sold_baseline,
                "baseline_revenue": round(rev_baseline, 2),
                "baseline_occupancy_pct": round(occ_baseline, 1),
                "fleetyield_fare": fleet_fare,
                "fleetyield_sold_seats": total_sold_fleet,
                "fleetyield_revenue": round(rev_fleet, 2),
                "fleetyield_occupancy_pct": round(occ_fleet, 1),
                "revenue_diff": round(rev_diff, 2),
                "seats_diff": seats_diff
            })

            baseline_rev_total += rev_baseline
            baseline_seats_total += total_sold_baseline
            baseline_capacity_total += capacity

            fleet_rev_total += rev_fleet
            fleet_seats_total += total_sold_fleet
            fleet_capacity_total += capacity

        # Aggregated Metrics
        baseline_avg_occ = (
            (baseline_seats_total / baseline_capacity_total) * 100.0
            if baseline_capacity_total > 0 else 0.0
        )
        fleet_avg_occ = (
            (fleet_seats_total / fleet_capacity_total) * 100.0
            if fleet_capacity_total > 0 else 0.0
        )

        baseline_unsold = baseline_capacity_total - baseline_seats_total
        fleet_unsold = fleet_capacity_total - fleet_seats_total

        total_rev_diff = fleet_rev_total - baseline_rev_total
        total_rev_diff_pct = (
            (total_rev_diff / baseline_rev_total) * 100.0
            if baseline_rev_total > 0 else 0.0
        )
        total_seats_diff = fleet_seats_total - baseline_seats_total

        narrative = (
            f"Simulation evaluated {len(valid_trips)} valid trips with market demand factor {demand_multiplier:.2f} "
            f"and illustrative price elasticity {price_elasticity:.2f}. "
            f"Fixed-Fare policy sold {baseline_seats_total}/{baseline_capacity_total} seats (₹{baseline_rev_total:,.0f}). "
            f"FleetYield rule-based policy sold {fleet_seats_total}/{fleet_capacity_total} seats (₹{fleet_rev_total:,.0f}). "
            f"Simulated variance is ₹{total_rev_diff:+,.0f} ({total_rev_diff_pct:+.1f}%)."
        )

        return {
            "notice": "SIMULATED - NOT REAL-WORLD PERFORMANCE. Illustrative decision support scenario under deterministic rules.",
            "scenario_parameters": {
                "demand_multiplier": demand_multiplier,
                "price_elasticity": price_elasticity,
                "valid_trips_simulated": len(valid_trips),
                "elasticity_formula": "Demand_Adj = 1.0 + (price_elasticity * ((P_fleet - P_base) / P_base))",
                "capacity_constraint": "Realized_Bookings = min(Available_Capacity, Unmet_Demand)"
            },
            "total_trips_simulated": len(valid_trips),
            "baseline_total_revenue": round(baseline_rev_total, 2),
            "baseline_total_seats_sold": baseline_seats_total,
            "baseline_avg_occupancy_pct": round(baseline_avg_occ, 1),
            "baseline_unsold_seats": baseline_unsold,
            "fleetyield_total_revenue": round(fleet_rev_total, 2),
            "fleetyield_total_seats_sold": fleet_seats_total,
            "fleetyield_avg_occupancy_pct": round(fleet_avg_occ, 1),
            "fleetyield_unsold_seats": fleet_unsold,
            "revenue_difference": round(total_rev_diff, 2),
            "revenue_difference_pct": round(total_rev_diff_pct, 1),
            "seats_sold_difference": total_seats_diff,
            "assumptions_narrative": narrative,
            "trips": trip_rows
        }
