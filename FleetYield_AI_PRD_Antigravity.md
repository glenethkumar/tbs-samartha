# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## FleetYield AI --- Explainable Bus Seat Pricing & Demand Intelligence

**Document version:** 1.0\
**Status:** Build specification for prototype\
**Target environment:** Google Antigravity IDE\
**Product type:** Responsive web application\
**Primary user:** Bus operator / operations manager\
**Project context:** SAMARTHA Hackathon --- Travel Software Enhancement,
TBS FleetOS\
**Primary workflow selected:** Problem 1 --- Empty seats and weak
demand-based pricing

------------------------------------------------------------------------

# 1. Instructions to the AI coding agent

Build a **working, runnable web application**, not only a static UI
mock-up. Follow this PRD as the source of truth.

Before writing code: 1. Inspect the existing workspace and identify its
framework, files, package manager, and current functionality. 2. If the
workspace already contains a working project, preserve useful existing
code and adapt it rather than replacing everything unnecessarily. 3. If
the workspace is empty, initialize a suitable stack using the defaults
in Section 12. 4. Create a short implementation plan, then implement the
complete vertical slice from data storage through calculations, UI, and
tests. 5. Keep the application runnable throughout development. Do not
leave the main workflow as TODOs, buttons that do nothing, hard-coded
result screens, or unimplemented placeholder pages. 6. If a requested
capability depends on an unavailable external service, build a clearly
labelled local/demo implementation and document the limitation. Never
pretend an integration exists. 7. Run the available checks and fix
errors. Report only tests actually run and results actually observed.

**Non-negotiable truthfulness rules** - Label all starter records as
**synthetic demo data**. Do not imply they came from a real operator. -
The demand classifier and price recommender may initially be
transparent, deterministic rules. Do not call them a trained
machine-learning model. - Never claim live ticketing, payment, GPS,
operator, or TheBusStand integrations unless they have actually been
implemented and verified. - A recommendation or operator approval must
not change a real passenger-facing fare. This prototype records a
decision internally only. - Do not invent test results, customer
feedback, deployment status, forecast accuracy, revenue uplift, or
performance metrics. - Do not put passwords, API keys, access tokens, or
personal information in source code, screenshots, seed data, or
documentation. - Disclose third-party libraries, datasets, APIs, models,
templates, and substantial reused resources in
`THIRD_PARTY_RESOURCES.md`. - Check licence compatibility before adding
dependencies or reusing code/assets. Prefer original UI and synthetic
data. - Do not implement deceptive or discriminatory pricing. Every
recommendation must be explainable, bounded by operator-configured fare
limits, and subject to human review.

------------------------------------------------------------------------

# 2. Product overview

## 2.1 Product name

**FleetYield AI**

## 2.2 One-sentence description

FleetYield AI helps bus operators inspect trip occupancy and booking
demand, receive transparent seat-fare recommendations within configured
limits, and compare a rule-based recommendation policy against a
fixed-fare baseline using explicitly labelled synthetic data.

## 2.3 Problem statement

Bus trips have a fixed number of seats, but booking demand can change by
route, departure time, day, season, and time remaining before departure.
A fixed fare or manual pricing process may not respond well to weak or
strong demand. This can contribute to unused seats or missed
opportunities to manage inventory effectively.

The prototype should help an operator understand the current trip
situation and make an informed pricing decision. It must not promise
that changing prices will always increase revenue or occupancy.

## 2.4 Product goal

Deliver one coherent, demonstrable workflow: 1. Review trips and
available seats. 2. Inspect demand indicators and data freshness. 3.
Generate an explainable recommended fare or fare band. 4. Review,
approve, reject, or override the recommendation. 5. Record the decision
in an audit history. 6. Compare the recommendation policy with a
fixed-fare baseline under the same explicitly documented assumptions.

## 2.5 Intended users

-   **Operator / owner:** reviews trip performance and decides whether
    to accept a recommendation.
-   **Operations manager:** monitors occupancy, booking pace, data
    quality, and upcoming departures.
-   **Demo reviewer:** evaluates the workflow, explanations, validation,
    and baseline comparison.

## 2.6 Out of scope for this version

Do not build these unless all requirements in scope are complete: -
Passenger booking, ticket issuance, payments, refunds, or cancellation
processing. - Automatic publication or application of fare changes. -
Real-time GPS, live bus tracking, passenger boarding alerts, or parcel
logistics. - Production integration with TheBusStand, a bus operator, or
a ticketing provider. - A trained ML model requiring unavailable
real-world data. - User accounts, social login, or complex role-based
access control. - Claims about actual-world revenue improvement.

------------------------------------------------------------------------

# 3. Scope and core user journey

## 3.1 Main user journey

1.  The user opens the dashboard and sees a summary of trips, seats
    booked, available seats, occupancy, and data-quality warnings.
2.  The user opens **Trips** and selects a trip.
3.  The trip detail shows route, departure, base/current fare,
    configured minimum and maximum fare, seats booked/available,
    occupancy, booking pace when sufficient snapshots exist, and data
    freshness.
4.  The user selects **Generate recommendation**.
5.  The system validates the data. If required data is invalid or stale,
    it shows a clear warning and withholds the recommendation where
    appropriate.
6.  If valid, the system calculates a demand category and a recommended
    fare using documented deterministic rules.
7.  The recommendation panel shows the suggested fare/band, the current
    fare, demand category, contributing factors, rule applied, fare
    limits, and a clear note that this is decision support.
8.  The operator can **Approve**, **Reject**, or **Override**. An
    override requires a valid fare within the configured limits and a
    reason.
9.  The decision is persisted and appears in the audit history after
    refresh.
10. The user opens **Baseline Comparison** to compare fixed-fare and
    rule-based policy outcomes using the same synthetic scenario and
    assumptions.
11. The user can inspect data-quality cases and see which
    recommendations are blocked and why.

## 3.2 Core navigation

Use a clear sidebar on desktop and a usable responsive navigation
pattern on mobile: - Overview - Trips - Recommendations - Baseline
Comparison - Audit Log - Data & Assumptions - About / Resources

Navigation items must lead to functional pages or sections, not empty
placeholders.

------------------------------------------------------------------------

# 4. Functional requirements

## FR-01 --- Trip and route data management

The application must load trip records from persistent local
storage/database. Include a small seed dataset clearly marked synthetic.

Each trip should contain at least: - `trip_id` --- unique ID -
`route_name` - `origin` - `destination` - `departure_time` --- ISO
date/time - `total_seats` --- positive integer - `booked_seats` ---
integer between 0 and total seats - `base_fare` --- positive numeric
amount in INR - `current_fare` --- numeric amount in INR - `min_fare`
--- positive numeric amount - `max_fare` --- numeric amount, greater
than or equal to min fare - `data_updated_at` --- timestamp -
`data_source_label` --- e.g. `Synthetic demo data`

Useful optional fields: - `bus_type` - `route_distance_km` -
`operator_notes`

Requirements: - Display trips in a searchable, filterable table or card
list. - Support viewing a trip's details. - If create/edit is
implemented, validate all fields before saving. - Prevent duplicate trip
IDs. - Ensure `booked_seats <= total_seats`, `total_seats > 0`, and
`min_fare <= max_fare`. - Use persistent storage so changes and
decisions survive a page refresh. - If the chosen local database cannot
run in the environment, use a documented persistent alternative. Do not
silently use in-memory-only state as if it were persistent.

Acceptance criteria: - A seeded trip is visible after launch. - Invalid
trip data cannot be saved. - A saved edit remains after refresh. -
Currency is shown as INR (₹).

## FR-02 --- Seat inventory dashboard

For each trip calculate: -
`available_seats = total_seats - booked_seats` -
`occupancy_percent = (booked_seats / total_seats) * 100`

Requirements: - Show total trips, upcoming trips, seats booked,
available seats, and average occupancy in the overview. - Show per-trip
occupancy with both a numeric percentage and a visual indicator. -
Handle zero/invalid seat capacity safely; do not divide by zero. - Do
not use decorative values that disagree with stored records. - Make it
clear that summary figures come from the loaded dataset and indicate
when that dataset is synthetic.

Acceptance criteria: - For a trip with 30 booked seats out of 40,
display 75% occupancy and 10 available seats. - When booking count
changes, the calculated metrics update from the saved data. - Invalid
records show an error/warning rather than producing misleading metrics.

## FR-03 --- Demand classification

Create a deterministic, documented rule-based classifier that labels
demand as **Low**, **Medium**, or **High**.

Use available signals: - Current occupancy. - Booking pace, only if at
least two valid timestamped booking snapshots are available. - Time
remaining until departure. - Optional historical demand signal only if
the dataset actually contains it.

Requirements: - Put thresholds and rules in a single documented
module/configuration rather than scattering magic numbers across UI
components. - Make thresholds easy to inspect and modify. - Show the
inputs and rule that produced the label. - If booking snapshots are
absent, do not invent booking pace; display "Not available" and classify
only from available valid signals. - If key data is missing, invalid, or
stale, mark demand confidence as limited or withhold the classification
according to the documented rule. - Call this a **rule-based demand
classification**, not machine learning.

Suggested initial transparent rules (document these in the UI or
assumptions page and keep them configurable): - Occupancy below 30%: low
occupancy signal. - Occupancy from 30% through 70%: medium occupancy
signal. - Occupancy above 70%: high occupancy signal. - If reliable
booking pace exists, display it as an additional signal. Do not let an
undocumented booking-pace formula silently override the occupancy
rule. - Time to departure should be shown as context. Any influence it
has on classification must be explicit and tested.

These are prototype starting thresholds, not industry facts. Label them
as configurable assumptions.

Acceptance criteria: - The same input record always yields the same
result. - The UI displays the factors used. - If booking snapshots are
absent, booking pace is not fabricated. - A test verifies low, medium,
and high boundary cases.

## FR-04 --- Fare recommendation engine

Implement a separate, testable pricing-policy module. It must generate a
suggested fare only when the input data passes validation.

Inputs: - Base fare and current fare. - Minimum and maximum permitted
fare. - Occupancy. - Demand category. - Time remaining until
departure. - Booking pace if valid. - Configured rule thresholds and
adjustment limits.

Requirements: - Use deterministic rules with understandable outputs. -
Enforce `min_fare <= recommended_fare <= max_fare` in all cases. - Do
not make fare changes automatically. - Do not use protected or sensitive
personal characteristics or passenger-level profiling. - Do not
implement arbitrary individualized pricing. - Use a transparent
adjustment policy. Keep all adjustment percentages and conditions in one
configuration file/module. - Prefer a conservative starting policy, for
example: low demand may suggest a modest decrease from base fare, medium
demand may retain base fare, and high demand may suggest a modest
increase. The exact adjustment percentages are prototype assumptions and
must be disclosed, configurable, and bounded by min/max fares. - If the
calculated recommendation is outside limits, clamp it to the permitted
limit and explain that the limit was applied. - Round fares consistently
to a practical currency increment (e.g. nearest ₹10) and re-check the
limits after rounding. - Show both the recommended numeric fare and,
where useful, a fare band. - Do not promise that the recommendation
increases revenue or fills seats.

Recommendation output should include: - Trip ID. - Current/base fare. -
Recommended fare. - Minimum and maximum permitted fares. - Demand
category. - Inputs/signals used. - Explanation / reason codes. -
Validation status. - Generated-at timestamp. - Label that it is a
decision-support suggestion based on rules and available data.

Example explanation style: "Suggested fare is ₹X because current
occupancy is Y%, which falls in the configured \[Low/Medium/High\]
range. The rule applied a Z% adjustment to the base fare. The result was
checked against the trip's configured fare limits."

Generate the explanation from the actual calculation inputs and outputs;
do not hard-code a single explanation for every trip.

Acceptance criteria: - Unit tests cover low, medium, and high demand. -
Unit tests prove min/max limits are never exceeded. - Missing/invalid
data blocks a recommendation. - The same valid input always returns the
same output. - Recommendation generation does not change the stored
current fare.

## FR-05 --- Explainability and operator review

Create a prominent recommendation panel with: - Current fare. -
Suggested fare. - Difference in rupees and percentage, where
calculable. - Demand label. - Occupancy and available seats. - Booking
pace only when available. - Reasons for the recommendation. - Fare-limit
check. - Data freshness / validation status. - "Rule-based estimate; not
a live fare change" notice.

Operator actions: - **Approve recommendation:** save a decision record
with the approved suggested fare. - **Reject recommendation:** save
rejection and optional reason. - **Override fare:** let the operator
enter a different fare within min/max limits and require an override
reason. - Display clear success/error feedback based on the actual save
result. - After an action, refresh the decision history from
persistence.

Important: approval means "approved inside this prototype"; it does not
publish or change fares in an external booking system.

Acceptance criteria: - Each action has a working handler. - Override
values outside configured limits are rejected with a helpful message. -
Decisions remain after refresh. - UI distinguishes suggested fare from
current fare.

## FR-06 --- Audit log

Persist each recommendation event and operator decision.

Suggested fields: - `audit_id` - `trip_id` - `event_type` ---
recommendation generated, approved, rejected, overridden, validation
blocked - `previous_fare` where relevant - `recommended_fare` where
relevant - `final_decision_fare` where relevant - `reason` -
`created_at` - `rule_version` or policy identifier - `data_source_label`

Requirements: - Display events newest-first. - Filter by trip and event
type. - Preserve rejected and overridden decisions. - Record the
operator's reason for an override. - Do not store unnecessary personal
data. - Avoid claiming a named human performed an action unless
authentication actually exists. For this prototype, label actions as
"Demo operator" or equivalent if no login system exists.

Acceptance criteria: - Generate, approve, reject, and override events
appear in the log. - Events remain after refresh. - The log does not
invent events or timestamps.

## FR-07 --- Data-quality checks

Validate data before calculating metrics or recommendations.

Check for: - Missing required values. - Invalid numeric values. -
Negative seats or fares. - Booked seats greater than total seats. -
Minimum fare greater than maximum fare. - Invalid departure time. -
Stale `data_updated_at`. - Missing or inconsistent booking snapshots, if
booking pace is requested. - Duplicate trip IDs.

Requirements: - Define a configurable stale-data threshold (e.g. 24
hours for the demo) and label it as an assumption, not an industry
standard. - Show the specific validation issue and affected trip. - If a
critical field is invalid, do not produce a recommendation. - If a
non-critical signal such as booking pace is unavailable, proceed only if
the core fields are valid and clearly disclose the missing signal. -
Include a visible "Data & Assumptions" page explaining dataset source,
freshness threshold, demand rules, pricing rules, and limitations. -
Provide at least one reproducible invalid/stale example in the demo
dataset or a clearly labelled test fixture. Do not corrupt valid
production-like records silently.

Acceptance criteria: - A stale record is visibly flagged. - An invalid
record cannot receive a normal recommendation. - The user can see why a
recommendation was withheld. - The app remains usable when one trip
record is invalid.

## FR-08 --- Fixed-fare baseline comparison

Create a comparison page comparing: 1. **Baseline policy:** every
eligible simulated booking uses the fixed base fare. 2. **FleetYield
policy:** simulated booking outcomes use the rule-based fare policy.

Requirements: - Both policies must use the same trip set, initial
inventory, demand assumptions, time horizon, and simulation rules. -
Clearly label results **SIMULATED --- NOT REAL-WORLD PERFORMANCE**. -
Show assumptions, formula, and input scenario. - Include total simulated
revenue, seats sold, occupancy, unsold seats, and revenue difference if
those quantities are calculated from a deterministic scenario. - Explain
how the simulation models demand response to price. If no defensible
demand-response model or historical dataset exists, do not imply that a
price change causes more bookings. In that case, provide a transparent
**policy-output comparison** or use a simple, configurable hypothetical
demand-response assumption prominently labelled as illustrative. - Do
not fabricate a "lift" percentage or hard-code a winning outcome. -
Allow the user to inspect the scenario inputs and reproduce the
result. - If using a simulation, implement it in code with documented
formulas, not as static numbers in the UI. - Keep baseline and
recommendation logic separately testable.

Acceptance criteria: - Comparison outputs are calculated from the same
inputs. - Changing an input changes the output where mathematically
expected. - The assumptions are visible beside the chart/table. - The UI
does not claim real-world uplift or validated forecast accuracy.

------------------------------------------------------------------------

# 5. Data model and seed dataset

## 5.1 Recommended entities

Use a simple relational model or equivalent persistence structure.

### `trips`

Stores the trip fields from FR-01.

### `booking_snapshots` (recommended)

-   `snapshot_id`
-   `trip_id`
-   `captured_at`
-   `booked_seats`
-   `source_label`

Use snapshots only when calculating booking pace. If there are not at
least two valid snapshots for a trip, booking pace should be "Not
available".

### `recommendations`

-   `recommendation_id`
-   `trip_id`
-   `generated_at`
-   `current_fare_at_generation`
-   `recommended_fare`
-   `demand_category`
-   `explanation`
-   `input_summary`
-   `validation_status`
-   `policy_version`
-   `source_label`

### `operator_decisions`

-   `decision_id`
-   `recommendation_id`
-   `decision_type` --- approved, rejected, overridden
-   `decision_fare` nullable
-   `reason` nullable except override requires reason
-   `created_at`
-   `actor_label`

### `audit_events`

Store the event history or use a well-designed audit table. Avoid
duplicating inconsistent records; document the chosen approach.

## 5.2 Seed data

Create 8--12 varied synthetic trips across different routes and
departure times. Include a variety of occupancies and fares. At least: -
One low-occupancy trip. - One medium-occupancy trip. - One
high-occupancy trip. - One trip with two or more booking snapshots. -
One clearly labelled stale-data example or test fixture. - One
invalid-data fixture used only to demonstrate validation.

Use fictional route/trip data or generic route labels. Do not include
real passenger names, phone numbers, payment details, or private
information. Every seed record must have
`source_label = "Synthetic demo data"` or equivalent.

Include a README section describing: - Fields and types. - Meaning of
each field. - How synthetic values were generated. - Which records are
invalid/stale test fixtures. - Limits of using synthetic data.

------------------------------------------------------------------------

# 6. User interface and visual design

## 6.1 Design direction

Build a polished, professional operations dashboard suitable for a
hackathon demonstration: - Modern, clean, high-contrast interface. -
Neutral dark/navy or light dashboard palette with one restrained accent
colour. - Clear typography and consistent spacing. - Useful charts only
where they clarify information. - Status labels for Low / Medium / High
demand and Valid / Warning / Blocked data. - Responsive layout for
desktop, tablet, and mobile. - Accessible contrast, keyboard navigation,
visible focus states, semantic labels, and readable error messages. -
Avoid excessive gradients, decorative animation, fake live indicators,
and visual clutter. - Do not imitate another company's branding without
permission.

## 6.2 Overview page

Show: - Total upcoming trips. - Total booked seats. - Total available
seats. - Average occupancy. - Trips needing data review. - Recent
recommendation/decision activity. - Occupancy by trip chart. - Upcoming
trips table with route, departure, occupancy, available seats, demand
label if available, and data status.

Every number and chart must be computed from current persisted data, not
separately hard-coded.

## 6.3 Trips page

-   Search by trip ID, origin, destination, or route.
-   Filter by demand category, occupancy range, departure window, and
    data-quality status.
-   Sort by departure time and occupancy.
-   Open trip detail and recommendation workflow.
-   Show empty, loading, error, and invalid-data states.

## 6.4 Trip detail / recommendation page

Show: - Route and departure. - Seat inventory. - Base/current fare and
permitted fare range. - Data source and last-updated time. - Booking
history chart only when valid snapshots exist. - Demand classification
with rule explanation. - Generate recommendation action. -
Recommendation result with explanation and validation status. - Approve
/ Reject / Override controls. - Previous decisions for the trip.

## 6.5 Baseline Comparison page

Show: - Clear simulation warning. - Scenario controls or readable
scenario summary. - Fixed-fare baseline and FleetYield policy metrics. -
Comparison chart/table. - Assumptions and formulas. -
Reset-to-seed-scenario control if implemented. - Never show fabricated
success badges or guaranteed gains.

## 6.6 Audit Log page

-   Newest-first event list/table.
-   Filters for trip and event type.
-   Timestamp, event, fare values, reason, source label, and policy
    version.
-   Clear empty state.

## 6.7 Data & Assumptions page

Explain in plain language: - Synthetic dataset notice. - Rule-based
classification logic. - Pricing adjustment rules and fare limits. -
Stale-data threshold. - Baseline comparison formula and assumptions. -
Known limitations and missing external integrations. - Third-party
libraries and resources, linking to `THIRD_PARTY_RESOURCES.md`.

## 6.8 Interaction requirements

-   Every visible button, tab, filter, dropdown, and form control must
    work.
-   Show feedback for success, failure, empty results, and validation
    errors.
-   Avoid buttons that only change appearance without performing an
    action.
-   Do not use fake progress bars or "live" statuses without real
    underlying behavior.

------------------------------------------------------------------------

# 7. Architecture and implementation guidance

Use a clean separation between: 1. **UI/presentation:** pages,
components, forms, charts, accessible feedback. 2. **Domain logic:**
occupancy calculations, validation, demand classification, fare
recommendation, simulation. 3. **Persistence/data access:** trips,
snapshots, recommendations, decisions, audit history. 4. **Tests:** unit
tests for domain logic and integration tests for persistence and user
actions.

Recommended project modules (adapt to the actual stack): -
`tripService` - `validationService` - `demandClassifier` -
`pricingPolicy` - `recommendationService` - `simulationService` -
`auditService`

Keep pricing rules and thresholds centralized in a versioned
configuration module. Do not place business logic exclusively inside UI
components.

## API and persistence

If using a frontend/backend architecture, create typed API endpoints
for: - Listing and retrieving trips. - Creating/updating trips if edit
functionality is included. - Generating a recommendation. - Recording
approve/reject/override decisions. - Reading audit events. - Running a
baseline comparison scenario.

Validate inputs on the server as well as the client. Return meaningful
HTTP error codes and messages. Never trust a fare value merely because
it came from the browser.

If using a full-stack framework with server actions, use the equivalent
well-structured server-side services.

------------------------------------------------------------------------

# 8. Non-functional requirements

-   **Correctness:** formulas and fare limits must be covered by tests.
-   **Persistence:** trips, recommendations, and decisions survive
    refresh and app restart as supported by the chosen database.
-   **Explainability:** every recommendation can be traced to inputs and
    configured rules.
-   **Safety:** invalid or stale critical data blocks recommendations.
-   **Privacy:** no passenger-level personal data is needed for this
    prototype.
-   **Security:** validate input, avoid exposing secrets, and do not
    place server secrets in client bundles.
-   **Accessibility:** keyboard-friendly controls, readable labels, and
    meaningful error messages.
-   **Responsiveness:** core workflow is usable on mobile and desktop.
-   **Maintainability:** reusable components, clear module boundaries,
    readable naming, and a setup guide.
-   **Honesty:** distinguish persisted app behavior, synthetic data,
    assumptions, and unavailable integrations.

------------------------------------------------------------------------

# 9. Testing and verification plan

Implement tests for the domain logic and persistence. Do not report a
test as passing unless it was run.

## Required unit tests

1.  Occupancy: 30/40 gives 75%.
2.  Available seats: 40 total and 30 booked gives 10.
3.  Occupancy handles zero or invalid total seats safely.
4.  Demand classification low boundary.
5.  Demand classification medium boundary.
6.  Demand classification high boundary.
7.  Booking pace is unavailable without sufficient valid snapshots.
8.  Recommendation is within min/max fare limits.
9.  Recommendation output is deterministic for identical inputs.
10. Invalid required data blocks recommendation.
11. Fare rounding does not break the configured limits.
12. Simulation uses the same scenario inputs for both policies.

## Required integration / workflow checks

1.  Seed data appears on first run.
2.  Saved trip changes persist after refresh, if editing is implemented.
3.  Recommendation generation creates a persisted recommendation record.
4.  Approve, reject, and override actions persist.
5.  Override outside fare limits is rejected.
6.  Audit log displays saved events.
7.  Stale/invalid records show warnings and do not generate normal
    recommendations.
8.  Baseline comparison recalculates when scenario inputs change.

## Manual verification

-   Test at desktop and mobile widths.
-   Test empty search results.
-   Test invalid form submissions.
-   Test a missing or stale record.
-   Check browser console and server logs for errors.
-   Verify no secret keys are committed or shown in the UI.

Create a `TESTING.md` file listing the actual commands run, the actual
outcomes, and any known failures or untested areas. Do not fill it with
assumed successes.

------------------------------------------------------------------------

# 10. Documentation and disclosure requirements

Create these files: - `README.md` --- project purpose, features,
prerequisites, installation, run commands, test commands, and
limitations. - `THIRD_PARTY_RESOURCES.md` --- every substantial external
resource. - `DATA_DICTIONARY.md` --- schema and field definitions. -
`TESTING.md` --- tests actually run and their real outcomes. -
`.env.example` --- placeholder environment variable names only, if
environment variables are needed. - `.gitignore` --- exclude secrets,
local databases when appropriate, build output, and dependency folders.

`THIRD_PARTY_RESOURCES.md` should contain a table with: - Resource
name. - Version. - Type (library, API, dataset, model, template, icon,
font, etc.). - Where it is used. - Licence. - Source URL. -
Modifications made. - Whether it is required at runtime.

If only standard libraries and original UI are used, state that
accurately; do not claim "no third-party resources" if packages, fonts,
icons, templates, or generated assets were used.

------------------------------------------------------------------------

# 11. Definition of done

The prototype is complete only when: - The project starts using
documented commands. - The main pages are functional and responsive. -
Trip data comes from the app's data layer and persists as documented. -
Occupancy and available-seat metrics are calculated, not hard-coded. -
Demand classification is deterministic and explained. - Fare
recommendations are deterministic, bounded, and explained. -
Invalid/stale data is visibly handled. - Approve/reject/override actions
work and persist. - Audit history is stored and visible. - Baseline
comparison is computed from documented scenario inputs and labels
simulated outcomes honestly. - Required tests have been run; actual
outcomes are documented. - Third-party resources and licences are
disclosed. - No real external integration or real-world performance
claim is implied without evidence. - No main workflow button is a dead
end.

If time is limited, prioritize the full core workflow over adding
unrelated features.

------------------------------------------------------------------------

# 12. Suggested technology stack

Use these only if the existing workspace does not already establish a
suitable stack: - **Frontend:** React + TypeScript + Vite. -
**Styling:** Tailwind CSS or a small, consistent CSS system. -
**Charts:** Recharts or another actively maintained, licence-compatible
chart library. - **Backend:** Python + FastAPI, or an equivalent backend
that fits the workspace. - **Data processing:** Python standard library
and Pandas only if useful. - **Database:** SQLite for a local hackathon
prototype. - **Testing:** Pytest for Python services; Vitest/Testing
Library for frontend logic. - **Validation:** Pydantic on a FastAPI
backend; equivalent schema validation if another stack is used.

Do not add dependencies merely because they are listed here. Choose the
smallest stack that produces a reliable, runnable application, and
record all chosen dependencies in `THIRD_PARTY_RESOURCES.md`.

------------------------------------------------------------------------

# 13. Implementation sequence

Build in this order: 1. Inspect workspace and document the chosen stack.
2. Create the data schema and synthetic seed dataset. 3. Implement
validation and occupancy calculations. 4. Implement and test demand
classification. 5. Implement and test the fare recommendation policy. 6.
Implement persistence for recommendations, decisions, and audit events.
7. Build the trip list, dashboard, and trip detail pages. 8. Connect the
recommendation workflow and operator actions. 9. Build the baseline
comparison with explicit assumptions. 10. Build data-quality and
assumptions views. 11. Add responsive styling and accessibility checks.
12. Run tests, fix defects, and write documentation/disclosures.

At the end, provide a concise completion report stating: - What was
implemented. - How to start the app. - Which tests were actually run and
their observed results. - Which parts use synthetic data or
assumptions. - Any known limitations or incomplete features.

**Start by inspecting the current workspace, then implement the project
according to this PRD.**
