# tbs-samartha

## FleetYield AI — Explainable Bus Seat Pricing & Demand Intelligence

**TBS FleetOS Enhancement &bull; SAMARTHA Hackathon**  
**Problem Track:** Problem 1 &mdash; *Empty seats and weak demand-based pricing*  
**Document Status:** Production prototype with persistent data layer and verified tests  

---

## 1. Project Overview

**FleetYield AI** is an explainable decision-support dashboard for bus operators and operations managers. It provides transparent, bounded seat-fare recommendations, real-time occupancy monitoring, human-in-the-loop review controls, strict data-freshness guards, an immutable audit log, and a fixed-fare baseline simulation comparison.

### Key Capabilities
- **Persistent Local Data Layer:** Full relational SQLite storage (`trips`, `booking_snapshots`, `recommendations`, `operator_decisions`, `audit_events`) that survives server restarts and page refreshes.
- **Seat Inventory Dashboard:** Real-time occupancy percentages, vacant seat counts, and distribution metrics with division-by-zero protection.
- **Deterministic Demand Classifier:** Transparent boundary classification (`<30%` Low, `30%-70%` Medium, `>70%` High) with empirical booking-pace detection when timestamped snapshots exist.
- **Explainable Pricing Recommendation Engine:** Generates transparent fare suggestions with percentage adjustments, rounding to practical ₹10 increments, and strict operator min/max limit clamping.
- **Data-Quality & Safety Safeguards:** Detects stale records (`>24h`) and structural errors (`booked > total capacity`), withholding recommendations until data is verified.
- **Human-in-the-Loop Operator Workflow:** Operator can **Approve**, **Reject**, or **Override** recommendations. Manual overrides strictly enforce configured bounds and require an audit reason.
- **Persistent Chronological Audit Log:** Full history of recommendation events, approvals, rejections, manual overrides, and validation blocks.
- **Fixed-Fare Baseline Comparison:** Deterministic simulation comparing Fixed-Fare policy against FleetYield dynamic pricing under identical capacity constraints and scenario variables. Clearly labeled `SIMULATED - NOT REAL-WORLD PERFORMANCE`.

---

## 2. Architecture & Technology Stack

```
FleetYield AI
├── frontend/                     # React 19 + TypeScript + Vite UI
│   ├── src/
│   │   ├── components/           # Navigation, Overview, Trips, Detail, Baseline, Audit, Assumptions, About
│   │   ├── api.ts                # Typed REST client
│   │   ├── types.ts              # Data models and interfaces
│   │   ├── index.css             # Vanilla CSS design tokens & dark theme
│   │   └── App.tsx               # Root application coordinator
│   └── dist/                     # Pre-built production bundle
│
├── backend/                      # Python + FastAPI + SQLite Backend
│   ├── app/
│   │   ├── config.py             # Centralized rule thresholds and assumptions
│   │   ├── db.py                 # SQLite relational persistence manager
│   │   ├── models.py             # Pydantic schemas and models
│   │   ├── seed.py               # 11 varied synthetic trips and snapshots
│   │   ├── services/             # Validation, Demand Classifier, Pricing Policy, Audit, Simulation
│   │   └── main.py               # FastAPI server & REST API endpoints
│   ├── tests/
│   │   ├── test_units.py         # 12 required unit tests (all passing)
│   │   └── test_integration.py   # 8 workflow integration tests (all passing)
│   └── data/
│       └── fleetyield.db         # Persistent SQLite database file
│
├── DATA_DICTIONARY.md            # Entity specifications, formulas, and field types
├── THIRD_PARTY_RESOURCES.md      # Complete third-party library & license disclosures
├── TESTING.md                    # Actual commands run and verification report
└── README.md                     # Setup, usage, and demonstration guide
```

---

## 3. Prerequisites

- **Python:** 3.10 or higher (Tested with Python 3.14.3)
- **Node.js:** 18 or higher (Tested with Node.js 24.20.0 and npm 11.19.0)

---

## 4. Setup & Running the Application

### Option A: Unified Full-Stack Mode (Recommended for Review)
The FastAPI server automatically serves the built frontend production bundle directly on port `8000`:

1. **Start the Backend Server:**
   ```powershell
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
   ```

2. **Open the Application in Your Browser:**
   Navigate to [http://127.0.0.1:8000](http://127.0.0.1:8000).

---

### Option B: Development Mode (Vite Hot-Reloading)
For active development with Vite HMR:

1. **Start Backend Server (Terminal 1):**
   ```powershell
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
   ```

2. **Start Frontend Dev Server (Terminal 2):**
   ```powershell
   cd frontend
   npm run dev
   ```

3. **Open the Dev UI:**
   Navigate to [http://localhost:5173](http://localhost:5173). The Vite dev server automatically proxies all `/api` requests to port `8000`.

---

## 5. Running Automated Tests

### Run the Pytest Test Suite
To run all 12 required unit tests and 8 workflow integration tests:
```powershell
python -m pytest backend/tests -v
```
*Observed Outcome: 20 passed in ~1.0s.*

### Run the Frontend Build Check
To verify TypeScript compilation and production bundling:
```powershell
cd frontend
npm run build
```
*Observed Outcome: 0 errors, 0 warnings.*

---

## 6. Reviewer Guided Walkthrough

Here is how a reviewer can test the core features in under 3 minutes:

1. **Dashboard Overview:**
   - Open [http://127.0.0.1:8000](http://127.0.0.1:8000).
   - Inspect the KPI summary cards (Total Upcoming Trips, Average Occupancy, Seat Inventory, Review Flags).
   - Notice the Demand Distribution bar showing Low, Medium, and High demand breakdowns.

2. **Low Demand Discount & Clamping:**
   - Go to **Trips Inventory** in the sidebar.
   - Select `TRIP-BLR-HYD-101` (Bengaluru to Hyderabad, 25% occupancy, base fare ₹900).
   - Click **Generate Recommendation**.
   - Notice the result: ₹810 (-10% volume incentive discount), rounded to ₹10, and checked against the [₹700 - ₹1200] limits.
   - Click **Approve**. The decision is saved and the internal current fare updates to ₹810.

3. **Limit Clamping Test Case:**
   - Select `TRIP-CLAMP-850` (Chennai to Madurai, 15% occupancy, base fare ₹620, min fare ₹600).
   - Click **Generate Recommendation**.
   - Notice that unconstrained calculation (-10% of ₹620 = ₹558) is **strictly clamped to the floor limit ₹600** with an explicit clamping reason notice.

4. **Booking Pace Detection:**
   - Select `TRIP-MUM-PUN-404` (Mumbai to Pune).
   - Notice the 3 timestamped booking snapshots timeline.
   - Click **Generate Recommendation** to inspect the empirical pace calculation: `+0.91 seats/hr over 11.0 hours`.
   - On other trips without snapshots, notice booking pace displays *"Not available (insufficient snapshots; minimum 2 required)"* rather than inventing fake data.

5. **Data-Quality & Stale-Data Blocks:**
   - Select `TRIP-STALE-901` (Updated 38 hours ago > 24h threshold).
   - Notice the prominent Stale Data warning banner.
   - Click **Generate Recommendation**.
   - The engine withholds the recommendation: `VALIDATION_BLOCKED` is logged to the audit log and the operator is advised to refresh records.
   - Select `TRIP-INVALID-902` (Booked seats 48 > total capacity 40). Notice it is similarly blocked with clear reasons.

6. **Manual Override with Bounds Check:**
   - Open `TRIP-MAA-BLR-303` (Min ₹600, Max ₹1100).
   - Click **Generate Recommendation** &rarr; **Manual Override**.
   - Attempt to enter ₹1500 (violating maximum fare). The modal immediately prevents submission and warns that the fare violates limits.
   - Enter ₹950, provide a rationale ("Festival demand markup"), and click **Apply Override**.
   - Inspect the Trip Decision History table: the override and rationale are permanently recorded.

7. **Baseline Simulation Comparison:**
   - Open **Baseline Comparison** in the sidebar.
   - Review the side-by-side comparison between the Fixed-Fare Baseline and FleetYield Dynamic Policy under identical inputs.
   - Adjust the **Market Demand Multiplier** slider (e.g. from 1.0x to 1.6x) and **Price Elasticity** slider.
   - Click **Run Scenario**. Notice how both policies recalculate dynamically.
   - Review the mathematical formulas and notice the prominent disclosure: `SIMULATED - NOT REAL-WORLD PERFORMANCE`.

8. **Audit Trail Inspection:**
   - Open **Audit Log** in the sidebar.
   - Filter by event type (`OPERATOR_APPROVED`, `OPERATOR_OVERRIDDEN`, `VALIDATION_BLOCKED`).
   - Click the Eye icon to view the raw JSON payload for any event.

9. **Reset Demo State:**
   - Click **Reset Demo Seed** in the top navigation bar at any time to return the local database to its pristine initial seed state.

---

## 7. Non-Negotiable Disclosures & Truthfulness Rules

- **Synthetic Demo Data:** All starter trips and bookings are synthetic demo data. They do not originate from a real bus operator.
- **Rule-Based Engine:** All demand classifications and price recommendations are computed using transparent, deterministic rules. They are not a trained machine learning model.
- **Internal Decision Support:** Recommendations and operator approvals do not change real passenger-facing fares. This prototype records decisions internally only.
- **No External Live Integrations:** No live ticketing, payment gateway, or GPS tracking integrations are claimed or connected.
- **Simulation Disclaimer:** The baseline comparison is an illustrative mathematical scenario under documented assumptions. It does not claim real-world revenue uplift or validated forecast accuracy.
- **Disclosures:** All third-party libraries and licenses are documented in [THIRD_PARTY_RESOURCES.md](file:///c:/Users/golag/OneDrive/Samartha%20Hackathon/TBS/THIRD_PARTY_RESOURCES.md). Schema and field definitions are documented in [DATA_DICTIONARY.md](file:///c:/Users/golag/OneDrive/Samartha%20Hackathon/TBS/DATA_DICTIONARY.md).
