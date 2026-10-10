# FleetYield AI — Data Dictionary & Schema Specification

**Document Version:** 1.0  
**Context:** SAMARTHA Hackathon — Travel Software Enhancement (TBS FleetOS)  
**Primary Entity:** Bus Seat Yield Management & Demand Intelligence  
**Storage Engine:** SQLite 3 (Relational persistence)

---

## 1. Relational Entities

### 1.1 `trips` Table
Stores bus service inventory, schedule, capacity, and operator-configured fare bounds.

| Column Name | SQLite Type | Nullable | Default | Description | Example / Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `trip_id` | `TEXT` | No | None | Primary Key. Unique trip identifier. | `TRIP-BLR-HYD-101` |
| `route_name` | `TEXT` | No | None | Human-readable service route title. | `Bengaluru to Hyderabad Express` |
| `origin` | `TEXT` | No | None | Departure city/station. | `Bengaluru` |
| `destination` | `TEXT` | No | None | Arrival city/station. | `Hyderabad` |
| `departure_time` | `TEXT` | No | None | Scheduled departure in ISO 8601 UTC format. | `2026-10-15T18:30:00Z` |
| `total_seats` | `INTEGER` | No | None | Total physical bus passenger capacity. | `40` (`> 0`) |
| `booked_seats` | `INTEGER` | No | None | Number of seats currently sold. | `10` (`0 <= booked_seats <= total_seats`) |
| `base_fare` | `REAL` | No | None | Standard tariff in INR. | `900.0` (`> 0`) |
| `current_fare` | `REAL` | No | None | Current operating fare in INR. | `900.0` (`> 0`) |
| `min_fare` | `REAL` | No | None | Operator-configured minimum floor fare limit in INR. | `700.0` (`> 0`) |
| `max_fare` | `REAL` | No | None | Operator-configured maximum ceiling fare limit in INR. | `1200.0` (`>= min_fare`) |
| `data_updated_at` | `TEXT` | No | None | Timestamp of last data synchronization (ISO 8601). | `2026-10-10T12:00:00Z` |
| `data_source_label` | `TEXT` | No | `'Synthetic demo data'` | Provenance label indicating synthetic nature of record. | `Synthetic demo data` |
| `bus_type` | `TEXT` | Yes | `'AC Seater'` | Bus vehicle configuration. | `Multi-Axle AC Sleeper` |
| `route_distance_km` | `REAL` | Yes | `NULL` | Route distance in kilometers. | `570.0` |
| `operator_notes` | `TEXT` | Yes | `NULL` | Operational notes by route manager. | `Early morning commuter service` |

---

### 1.2 `booking_snapshots` Table
Periodic time-stamped booking count snapshots for computing empirical booking pace.

| Column Name | SQLite Type | Nullable | Foreign Key | Description | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `snapshot_id` | `TEXT` | No | None | Primary Key. Unique snapshot identifier. | `SNAP-404-01` |
| `trip_id` | `TEXT` | No | `trips(trip_id)` | Associated trip identifier. | `TRIP-MUM-PUN-404` |
| `captured_at` | `TEXT` | No | None | Timestamp when snapshot was captured (ISO 8601). | `2026-10-10T06:00:00Z` |
| `booked_seats` | `INTEGER` | No | None | Booked seat count at time of capture. | `18` |
| `source_label` | `TEXT` | No | None | Data source label. | `Synthetic demo data` |

*Note: Booking pace is computed if and only if at least two valid snapshots exist for a trip. If fewer than two snapshots exist, the system explicitly reports "Not available".*

---

### 1.3 `recommendations` Table
Persisted outputs from the explainable deterministic pricing rule engine.

| Column Name | SQLite Type | Nullable | Foreign Key | Description | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `recommendation_id` | `TEXT` | No | None | Primary Key. Unique recommendation identifier. | `REC-8A9C10DF` |
| `trip_id` | `TEXT` | No | `trips(trip_id)` | Associated trip identifier. | `TRIP-BLR-HYD-101` |
| `generated_at` | `TEXT` | No | None | Timestamp when recommendation was generated. | `2026-10-10T10:15:00Z` |
| `current_fare_at_generation` | `REAL` | No | None | Trip operating fare when recommendation was computed. | `900.0` |
| `base_fare_at_generation` | `REAL` | No | None | Trip base fare when recommendation was computed. | `900.0` |
| `recommended_fare` | `REAL` | No | None | Suggested fare in INR, rounded to nearest ₹10. | `810.0` |
| `fare_difference` | `REAL` | No | None | Numeric difference: `recommended_fare - current_fare`. | `-90.0` |
| `fare_difference_pct` | `REAL` | No | None | Percentage difference: `(difference / current_fare) * 100`. | `-10.0` |
| `min_fare` | `REAL` | No | None | Operator minimum limit at time of evaluation. | `700.0` |
| `max_fare` | `REAL` | No | None | Operator maximum limit at time of evaluation. | `1200.0` |
| `demand_category` | `TEXT` | No | None | Deterministic category (`'Low'`, `'Medium'`, `'High'`). | `Low` |
| `explanation` | `TEXT` | No | None | Human-readable explanation generated from inputs. | *See Section 3* |
| `rule_applied` | `TEXT` | No | None | Rule identifier and adjustment percentage. | `Low Demand Policy: -10.0%` |
| `contributing_factors` | `TEXT` | No | None | JSON-serialized dictionary of inputs and signals. | `{"occupancy": 25.0, ...}` |
| `booking_pace_info` | `TEXT` | No | None | Descriptive booking pace signal or "Not available". | `+0.91 seats/hr over 11.0h` |
| `validation_status` | `TEXT` | No | None | Validation status (`'VALID'`, `'WARNING'`, `'BLOCKED'`). | `VALID` |
| `policy_version` | `TEXT` | No | None | Version of active pricing rule set. | `v1.0-deterministic-rule` |
| `source_label` | `TEXT` | No | None | Provenance label. | `Synthetic demo data` |
| `is_clamped` | `INTEGER` | No | None | `1` if fare was clamped to min/max limit; `0` otherwise. | `0` |
| `clamped_reason` | `TEXT` | Yes | None | Narrative explanation if clamping occurred. | `NULL` |
| `notice` | `TEXT` | No | None | Mandatory decision-support notice. | *See Section 3* |

---

### 1.4 `operator_decisions` Table
Persisted record of human operator review actions.

| Column Name | SQLite Type | Nullable | Foreign Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| `decision_id` | `TEXT` | No | None | Primary Key. Unique decision record ID (`DEC-...`). |
| `recommendation_id` | `TEXT` | No | `recommendations` | Associated recommendation record. |
| `trip_id` | `TEXT` | No | `trips(trip_id)` | Associated trip identifier. |
| `decision_type` | `TEXT` | No | None | Action: `'APPROVED'`, `'REJECTED'`, or `'OVERRIDDEN'`. |
| `decision_fare` | `REAL` | Yes | None | Resulting fare if approved or overridden; NULL if rejected. |
| `reason` | `TEXT` | Yes | None | Operator rationale (mandatory for `'OVERRIDDEN'`). |
| `created_at` | `TEXT` | No | None | Timestamp of operator decision (ISO 8601). |
| `actor_label` | `TEXT` | No | None | Reviewer label (`'Demo operator'`). |

---

### 1.5 `audit_events` Table
Immutable chronological event log for system recommendations, validations, and operator actions.

| Column Name | SQLite Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `audit_id` | `TEXT` | No | Primary Key. Unique audit event identifier (`AUD-...`). |
| `trip_id` | `TEXT` | No | Trip identifier or `'SYSTEM'`. |
| `event_type` | `TEXT` | No | Event type (`'RECOMMENDATION_GENERATED'`, `'OPERATOR_APPROVED'`, etc.). |
| `previous_fare` | `REAL` | Yes | Trip fare before event occurred. |
| `recommended_fare` | `REAL` | Yes | Recommendation engine suggested fare (if applicable). |
| `final_decision_fare` | `REAL` | Yes | Final accepted fare (if approved or overridden). |
| `reason` | `TEXT` | Yes | Description or operator reason. |
| `details` | `TEXT` | Yes | JSON string containing event metadata. |
| `created_at` | `TEXT` | No | ISO 8601 timestamp. |
| `rule_version` | `TEXT` | No | Active policy version string. |
| `data_source_label` | `TEXT` | No | `'Synthetic demo data'`. |
| `actor_label` | `TEXT` | No | Actor responsible for event (`'Pricing Engine'`, `'Demo operator'`). |

---

## 2. Calculated Metrics & Formulas

1. **Available Seats:**
   $$\text{available\_seats} = \max(0, \text{total\_seats} - \text{booked\_seats})$$

2. **Occupancy Percentage:**
   $$\text{occupancy\_percent} = \begin{cases} \left(\frac{\text{booked\_seats}}{\text{total\_seats}}\right) \times 100 & \text{if } \text{total\_seats} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$

3. **Booking Pace (Rate per Hour):**
   $$\text{pace} = \frac{\text{booked\_seats}_{\text{latest}} - \text{booked\_seats}_{\text{earliest}}}{\Delta t_{\text{hours}}}$$
   *(Requires at least 2 timestamped snapshots; otherwise reported as "Not available".)*

4. **Deterministic Fare Recommendation:**
   $$\text{raw\_fare} = \text{base\_fare} \times \left(1 + \frac{\text{adj\_pct}}{100}\right)$$
   $$\text{rounded\_fare} = \text{round}\left(\frac{\text{raw\_fare}}{10}\right) \times 10$$
   $$\text{recommended\_fare} = \min(\text{max\_fare}, \max(\text{min\_fare}, \text{rounded\_fare}))$$

5. **Simulated Prospective Demand Response:**
   $$\text{Demand\_Adj} = \max\left(0.0, 1.0 + \left(\text{price\_elasticity} \times \frac{P_{\text{fleet}} - P_{\text{base}}}{P_{\text{base}}}\right)\right)$$
   $$\text{Realized\_Bookings} = \min(\text{Available\_Capacity}, \text{round}(\text{Unmet\_Demand} \times \text{Demand\_Adj}))$$

---

## 3. Synthetic Seed Dataset & Test Fixtures

The system seeds 11 varied synthetic trips to test all normal and edge scenarios:

| Trip ID | Route Name | Seats (Booked/Total) | Occupancy | Base Fare | Limits [Min-Max] | Purpose / Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TRIP-BLR-HYD-101` | Bengaluru &rarr; Hyderabad | 10 / 40 | 25.0% | ₹900 | ₹700 - ₹1200 | Low demand discount test case (-10% &rarr; ₹810) |
| `TRIP-HYD-VJA-202` | Hyderabad &rarr; Vijayawada | 22 / 40 | 55.0% | ₹650 | ₹500 - ₹900 | Medium demand retention test case (0% &rarr; ₹650) |
| `TRIP-MAA-BLR-303` | Chennai &rarr; Bengaluru | 34 / 40 | 85.0% | ₹750 | ₹600 - ₹1100 | High demand premium test case (+15% &rarr; ₹860) |
| `TRIP-MUM-PUN-404` | Mumbai &rarr; Pune | 28 / 36 | 77.8% | ₹450 | ₹350 - ₹700 | Has 3 booking snapshots to verify booking pace calculation |
| `TRIP-DEL-JAI-505` | Delhi &rarr; Jaipur | 8 / 45 | 17.8% | ₹550 | ₹400 - ₹800 | Has 2 booking snapshots to verify pace calculation |
| `TRIP-COK-BLR-606` | Kochi &rarr; Bengaluru | 16 / 32 | 50.0% | ₹1100 | ₹900 - ₹1500 | Overnight corridor medium occupancy |
| `TRIP-PUN-GOA-707` | Pune &rarr; Goa | 27 / 30 | 90.0% | ₹1200 | ₹950 - ₹1800 | Near full load (+15% markup &rarr; ₹1380) |
| `TRIP-KOL-DGH-808` | Kolkata &rarr; Digha | 12 / 42 | 28.6% | ₹400 | ₹300 - ₹600 | Low occupancy excursion shuttle |
| `TRIP-CLAMP-850` | Chennai &rarr; Madurai | 6 / 40 | 15.0% | ₹620 | ₹600 - ₹900 | **Clamping Fixture:** Low demand (-10% of 620 = ₹558) clamped to min ₹600 |
| `TRIP-STALE-901` | Bengaluru &rarr; Mangaluru | 18 / 40 | 45.0% | ₹700 | ₹550 - ₹950 | **Stale Fixture:** Updated 38h ago (&gt;24h threshold); blocks recommendation |
| `TRIP-INVALID-902`| Hyderabad &rarr; Tirupati | 48 / 40 | 120.0% | ₹850 | ₹650 - ₹1200 | **Invalid Fixture:** Booked seats &gt; total capacity; blocks recommendation |

---

## 4. Disclosures & Synthetic Data Limitations

1. **Synthetic Nature:** All seed data is artificially generated for functional evaluation in the hackathon. It does not represent actual passenger flow or commercial data from any bus operator.
2. **Pricing Rules:** The pricing adjustments (-10%, 0%, +15%) and demand boundaries (<30%, 30-70%, >70%) are prototype configuration assumptions, not trained machine learning models.
3. **Simulation Notice:** Baseline simulation outputs are mathematical projections from deterministic scenario inputs. They do not forecast real-world market elasticity or guaranteed revenue gains.
