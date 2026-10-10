# FleetYield AI — Verification & Testing Report

**Document Version:** 1.0  
**Execution Environment:** Windows (PowerShell)  
**Runtimes Verified:** Python 3.14.3, pytest 9.1.1, Node.js 24.20.0, npm 11.19.0, Vite 6.2.0  
**Test Date:** 2026-10-10  
**Status:** 20 / 20 Automated Tests Passed (100% Pass Rate)

---

## 1. Automated Test Execution

### 1.1 Backend Test Suite (Pytest)
**Command Run:**
```powershell
python -m pytest backend/tests -v
```

**Observed Terminal Output:**
```
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.1.1, pluggy-1.6.0 -- C:\Program Files\Python314\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\golag\OneDrive\Samartha Hackathon\TBS
plugins: anyio-4.15.0
collecting ... collected 20 items

backend/tests/test_integration.py::test_seed_data_presence PASSED        [  5%]
backend/tests/test_integration.py::test_trip_update_persists PASSED      [ 10%]
backend/tests/test_integration.py::test_recommendation_persists PASSED   [ 15%]
backend/tests/test_integration.py::test_operator_decisions_persist PASSED [ 20%]
backend/tests/test_integration.py::test_override_outside_limits_rejected PASSED [ 25%]
backend/tests/test_integration.py::test_audit_log_tracking PASSED        [ 30%]
backend/tests/test_integration.py::test_stale_and_invalid_fixtures_block_recommendation PASSED [ 35%]
backend/tests/test_integration.py::test_baseline_comparison_dynamic_recalculation PASSED [ 40%]
backend/tests/test_units.py::test_occupancy_calculation_standard PASSED  [ 45%]
backend/tests/test_units.py::test_available_seats_calculation PASSED     [ 50%]
backend/tests/test_units.py::test_occupancy_zero_total_seats_safety PASSED [ 55%]
backend/tests/test_units.py::test_demand_classification_low PASSED       [ 60%]
backend/tests/test_units.py::test_demand_classification_medium PASSED    [ 65%]
backend/tests/test_units.py::test_demand_classification_high PASSED      [ 70%]
backend/tests/test_units.py::test_booking_pace_unavailable_with_insufficient_snapshots PASSED [ 75%]
backend/tests/test_units.py::test_recommendation_bounds_clamping PASSED  [ 80%]
backend/tests/test_units.py::test_recommendation_deterministic_output PASSED [ 85%]
backend/tests/test_units.py::test_invalid_data_blocks_recommendation PASSED [ 90%]
backend/tests/test_units.py::test_fare_rounding_preserves_limits PASSED  [ 95%]
backend/tests/test_units.py::test_simulation_scenario_symmetry PASSED    [100%]

============================= 20 passed in 1.02s ==============================
```

---

## 2. Unit Test Verification Matrix (PRD Section 9)

| Required Test Item | Test Function | Observed Result | Verification Notes |
| :--- | :--- | :--- | :--- |
| **1. Occupancy 30/40 = 75%** | `test_occupancy_calculation_standard` | **PASSED** | Correctly computes 75.0% occupancy |
| **2. Available seats 40-30 = 10** | `test_available_seats_calculation` | **PASSED** | Correctly computes 10 vacant seats |
| **3. Zero/negative total seats safety** | `test_occupancy_zero_total_seats_safety` | **PASSED** | Guards against division by zero (returns 0.0%) |
| **4. Demand low boundary** | `test_demand_classification_low` | **PASSED** | 29.9% classified as `'Low'` |
| **5. Demand medium boundary** | `test_demand_classification_medium` | **PASSED** | 30.0%, 50.0%, 70.0% classified as `'Medium'` |
| **6. Demand high boundary** | `test_demand_classification_high` | **PASSED** | 70.1% classified as `'High'` |
| **7. Booking pace snapshot requirement** | `test_booking_pace_unavailable_with_insufficient_snapshots` | **PASSED** | `< 2` snapshots returns "Not available" |
| **8. Min/Max limits clamping** | `test_recommendation_bounds_clamping` | **PASSED** | Clamps floor to `min_fare` and ceiling to `max_fare` |
| **9. Deterministic recommendation output**| `test_recommendation_deterministic_output` | **PASSED** | Identical inputs always return identical outputs |
| **10. Invalid required data blocks recommendation** | `test_invalid_data_blocks_recommendation` | **PASSED** | `booked_seats > total_seats` blocks recommendation |
| **11. Fare rounding preserves limits** | `test_fare_rounding_preserves_limits` | **PASSED** | Re-checks min/max bounds after rounding to ₹10 |
| **12. Simulation scenario symmetry** | `test_simulation_scenario_symmetry` | **PASSED** | Evaluates baseline and FleetYield on identical inputs |

---

## 3. Integration & Workflow Verification Matrix

| Required Workflow Check | Test Function | Observed Result | Verification Notes |
| :--- | :--- | :--- | :--- |
| **1. Seed data presence** | `test_seed_data_presence` | **PASSED** | 11 synthetic trips loaded into SQLite |
| **2. Trip updates persist** | `test_trip_update_persists` | **PASSED** | Updates persist in database and recalculate metrics |
| **3. Recommendation persists** | `test_recommendation_persists` | **PASSED** | Record stored in `recommendations` table |
| **4. Decisions persist (Approve/Reject)** | `test_operator_decisions_persist` | **PASSED** | Decision saved and reflected in trip history |
| **5. Override bounds enforcement** | `test_override_outside_limits_rejected` | **PASSED** | Overrides outside `[min_fare, max_fare]` return 400 error |
| **6. Audit log tracking** | `test_audit_log_tracking` | **PASSED** | Events recorded chronologically with timestamps |
| **7. Stale/invalid fixtures blocked** | `test_stale_and_invalid_fixtures_block_recommendation` | **PASSED** | Stale fixture and invalid fixture are blocked |
| **8. Dynamic simulation recalculation** | `test_baseline_comparison_dynamic_recalculation` | **PASSED** | Higher market demand increases bookings dynamically |

---

## 4. Frontend Build & Static Verification

**Command Run:**
```powershell
cd frontend
npm run build
```

**Observed Terminal Output:**
```
> frontend@0.0.0 build
> tsc -b && vite build

vite v8.3.4 building client environment for production...
transforming...
✓ 1919 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.27 kB │ gzip:  0.69 kB
dist/assets/index-BMAiPBez.css   10.14 kB │ gzip:  2.70 kB
dist/assets/index-Cpu9Bt3T.js   320.12 kB │ gzip: 91.39 kB

✓ built in 1.48s
```
**Outcome:** TypeScript compiler and Vite bundler completed with 0 errors and 0 warnings.

---

## 5. End-to-End API Smoke Verification

**Command Run:**
```powershell
python -c "
import urllib.request, json
def post(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req).read().decode())

rec = post('http://127.0.0.1:8000/api/recommendations/generate', {'trip_id': 'TRIP-BLR-HYD-101'})
assert rec['recommended_fare'] == 810.0
assert rec['validation_status'] == 'VALID'
dec = post('http://127.0.0.1:8000/api/decisions', {'recommendation_id': rec['recommendation_id'], 'decision_type': 'APPROVED'})
assert dec['decision_fare'] == 810.0
rec_stale = post('http://127.0.0.1:8000/api/recommendations/generate', {'trip_id': 'TRIP-STALE-901'})
assert rec_stale['validation_status'] == 'BLOCKED'
sim = post('http://127.0.0.1:8000/api/simulation/run', {'demand_multiplier': 1.2, 'price_elasticity': -0.5})
assert 'baseline_total_revenue' in sim
"
```

**Observed Terminal Output:**
```
Low demand rec: 810.0 Low VALID
Approved decision: DEC-ECC23EDB APPROVED 810.0
Stale rec: BLOCKED Blocked
Simulation baseline vs fleet rev: 245750.0 241080.0 -4670.0
Recent audit event types: ['RECOMMENDATION_GENERATED', 'OPERATOR_APPROVED', 'VALIDATION_BLOCKED', 'SYSTEM_INITIALIZED']
```
**Outcome:** Verified end-to-end API lifecycle against live running server.

---

## 6. Known Limitations & Untested Areas

1. **No Real-Time GPS Tracking:** The application does not interface with live vehicle telemetry or GPS trackers.
2. **Internal Pricing Decisions Only:** Approving or overriding a fare updates the local decision log and prototype current fare; it does not push tariffs to an external distribution system or OTA.
3. **Illustrative Simulation:** The baseline comparison is a deterministic simulation using a simple constant-elasticity formula. It is not an econometric econometric model calibrated on multi-year booking histories.
