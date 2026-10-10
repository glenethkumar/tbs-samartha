import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  Sliders, 
  HelpCircle 
} from 'lucide-react';
import type { AssumptionsSummary } from '../types';
import { api } from '../api';

export const Assumptions: React.FC = () => {
  const [assumptions, setAssumptions] = useState<AssumptionsSummary | null>(null);

  useEffect(() => {
    api.getAssumptions().then(setAssumptions).catch(console.error);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title" style={{ fontSize: '1.25rem' }}>
              <ShieldCheck size={22} style={{ color: '#38bdf8' }} />
              <span>System Rules, Assumptions &amp; Methodologies</span>
            </div>
            <div className="card-subtitle">
              FleetYield AI is a transparent decision-support system. All thresholds and policies are documented and auditable.
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
          This document establishes the algorithmic foundation of the FleetYield AI prototype for the SAMARTHA Hackathon.
          Active policy version: <strong>{assumptions?.policy_version || 'v1.0-deterministic-rule'}</strong>.
          It discloses all rule thresholds, currency increment rules, simulation mechanics, and data-integrity safeguards.
        </p>
      </div>

      {/* Grid of Sections */}
      <div className="grid-cols-2">
        {/* Section 1: Synthetic Dataset & Non-Disclosure Notice */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '14px' }}>
            <FileText size={18} style={{ color: '#fbbf24' }} />
            <span>1. Synthetic Demo Dataset</span>
          </div>

          <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '10px' }}>
              All 11 seeded trip records, cities, booking numbers, and passenger volumes are 
              <strong> purely synthetic test fixtures</strong> generated specifically for testing and demonstrative evaluation.
            </p>
            <p style={{ marginBottom: '10px' }}>
              No real passenger PII, customer credit cards, operator commercial contracts, or private GPS routes are contained
              in this repository. Test fixtures include intentional edge cases:
            </p>
            <ul style={{ paddingLeft: '20px', fontSize: '0.82rem' }}>
              <li><strong>TRIP-STALE-901:</strong> 38-hour stale timestamp to verify data age guards ({assumptions?.stale_data_threshold_hours || 24}h threshold).</li>
              <li><strong>TRIP-INVALID-902:</strong> Booked seats (48) exceeding capacity (40) to verify validation blocks.</li>
              <li><strong>TRIP-CLAMP-850:</strong> Minimum fare floor clamping test case.</li>
              <li><strong>TRIP-MUM-PUN-404:</strong> 3 timestamped booking snapshots verifying booking pace rate calculations.</li>
            </ul>
          </div>
        </div>

        {/* Section 2: Rule-Based Demand Classification */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '14px' }}>
            <Sliders size={18} style={{ color: '#38bdf8' }} />
            <span>2. Deterministic Demand Classification</span>
          </div>

          <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '10px' }}>
              Demand is classified into three categories using transparent boundary rules rather than black-box machine learning:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' }}>
              <div style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #0284c7' }}>
                <strong>Low Demand:</strong> Occupancy &lt; {assumptions?.demand_thresholds.low_occupancy_max || 30.0}%
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #10b981' }}>
                <strong>Medium Demand:</strong> {assumptions?.demand_thresholds.low_occupancy_max || 30.0}% &le; Occupancy &le; {assumptions?.demand_thresholds.high_occupancy_min || 70.0}%
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #8b5cf6' }}>
                <strong>High Demand:</strong> Occupancy &gt; {assumptions?.demand_thresholds.high_occupancy_min || 70.0}%
              </div>
            </div>
            <p style={{ fontSize: '0.8rem' }}>
              <strong>Booking Pace Rule:</strong> Pace is computed only when &ge;{assumptions?.booking_pace_rule.min_snapshots_required || 2} timestamped snapshots exist. If unavailable,
              the system reports "Not available" and does not invent synthetic velocity signals.
            </p>
          </div>
        </div>

        {/* Section 3: Pricing Recommendation Policy */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '14px' }}>
            <Sliders size={18} style={{ color: '#34d399' }} />
            <span>3. Pricing Policy &amp; Fare Bounds</span>
          </div>

          <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '10px' }}>
              Fare adjustments are applied deterministically to the trip's base fare:
            </p>
            <ul style={{ paddingLeft: '20px', marginBottom: '12px', fontSize: '0.82rem' }}>
              <li><strong>Low Demand:</strong> {assumptions?.pricing_rules.low_demand_adjustment_pct || -10.0}% volume incentive adjustment</li>
              <li><strong>Medium Demand:</strong> {assumptions?.pricing_rules.medium_demand_adjustment_pct || 0.0}% baseline retention</li>
              <li><strong>High Demand:</strong> +{assumptions?.pricing_rules.high_demand_adjustment_pct || 15.0}% yield premium capture adjustment</li>
            </ul>
            <p style={{ marginBottom: '10px' }}>
              <strong>Currency Increment:</strong> Proposed fares are rounded to the nearest ₹{assumptions?.pricing_rules.rounding_increment_inr || 10} practical increment.
            </p>
            <p>
              <strong>Hard Boundary Clamping:</strong> Output fares are strictly clamped between operator-configured
              <code>[min_fare, max_fare]</code>. Limits are verified again after rounding to ensure no boundary breaches.
            </p>
          </div>
        </div>

        {/* Section 4: Data Quality & Freshness Safeguards */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '14px' }}>
            <AlertTriangle size={18} style={{ color: '#f43f5e' }} />
            <span>4. Data Quality &amp; Safety Guards</span>
          </div>

          <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '10px' }}>
              Before computing pricing recommendations, the system executes validation checks:
            </p>
            <ul style={{ paddingLeft: '20px', marginBottom: '12px', fontSize: '0.82rem' }}>
              <li><code>booked_seats &le; total_seats</code> and <code>total_seats &gt; 0</code></li>
              <li><code>min_fare &le; max_fare</code> and all fares positive</li>
              <li>Departure time and data freshness timestamps are valid ISO dates</li>
              <li><strong>Freshness Threshold:</strong> Trips with <code>data_updated_at &gt; {assumptions?.stale_data_threshold_hours || 24.0} hours</code> are marked Stale</li>
            </ul>
            <p style={{ fontSize: '0.82rem', color: '#fb7185' }}>
              If a trip fails structural validation or freshness checks, automated recommendations are withheld and
              a <strong>VALIDATION_BLOCKED</strong> audit entry is permanently logged.
            </p>
          </div>
        </div>
      </div>

      {/* Section 5: Baseline Comparison Simulation Mechanics */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: '14px' }}>
          <HelpCircle size={18} style={{ color: '#38bdf8' }} />
          <span>5. Fixed-Fare Baseline Comparison Methodology</span>
        </div>

        <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
          <p style={{ marginBottom: '10px' }}>
            The baseline comparison model allows operators to compare a Fixed Base Fare policy against the FleetYield
            dynamic policy under identical capacity constraints and scenario variables:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '14px 0' }}>
            <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <strong>Fixed-Fare Policy:</strong>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                All prospective bookings are sold at the trip's fixed base fare up to available seat capacity.
              </div>
            </div>
            <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <strong>FleetYield Policy:</strong>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Existing bookings retain base fare; additional bookings occur at the rule-recommended fare with
                an illustrative price elasticity multiplier.
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
            Prominent Disclosure: Real-world passenger booking choice involves complex external factors (competing carriers,
            weather, schedule). The simulation is an illustrative policy comparison model and does not claim validated real-world uplift.
          </p>
        </div>
      </div>
    </div>
  );
};
