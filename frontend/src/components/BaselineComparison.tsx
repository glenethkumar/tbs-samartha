import React, { useEffect, useState } from 'react';
import { 
  RotateCcw, 
  Play, 
  AlertTriangle, 
  HelpCircle,
  Sliders
} from 'lucide-react';
import type { SimulationResult } from '../types';
import { api } from '../api';

export const BaselineComparison: React.FC = () => {
  const [demandMultiplier, setDemandMultiplier] = useState<number>(1.0);
  const [priceElasticity, setPriceElasticity] = useState<number>(-0.5);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async (multiplier = demandMultiplier, elasticity = priceElasticity) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.runSimulation({
        demand_multiplier: multiplier,
        price_elasticity: elasticity,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute simulation scenario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation(1.0, -0.5);
  }, []);

  const handleResetDefaults = () => {
    setDemandMultiplier(1.0);
    setPriceElasticity(-0.5);
    runSimulation(1.0, -0.5);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Simulation Warning Banner (PRD Non-negotiable requirement) */}
      <div className="notice-box notice-warning" id="simulation-notice-banner">
        <AlertTriangle size={20} />
        <div>
          <strong>SIMULATED — NOT REAL-WORLD PERFORMANCE:</strong> The metrics below are generated from an
          illustrative, deterministic mathematical model using synthetic scenario data. This comparison illustrates
          how a rule-based pricing policy differs mathematically from a fixed-fare policy under controlled assumptions.
          It does not guarantee real-world revenue lift or validated customer behavior.
        </div>
      </div>

      {/* Scenario Controls Panel */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Sliders size={18} style={{ color: '#38bdf8' }} />
              <span>Simulation Scenario Controls</span>
            </div>
            <div className="card-subtitle">
              Adjust hypothetical prospective market demand and price sensitivity parameters
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              id="btn-reset-simulation"
              className="btn btn-secondary btn-sm"
              onClick={handleResetDefaults}
              disabled={loading}
            >
              <RotateCcw size={14} />
              <span>Reset Defaults</span>
            </button>
            <button
              id="btn-run-simulation"
              className="btn btn-primary btn-sm"
              onClick={() => runSimulation()}
              disabled={loading}
            >
              <Play size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Simulating...' : 'Run Scenario'}</span>
            </button>
          </div>
        </div>

        <div className="grid-cols-2" style={{ marginTop: '12px' }}>
          {/* Control 1: Market Demand Factor */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Market Demand Multiplier</span>
                <span title="Ratio of unbooked potential travelers relative to remaining empty seats.">
                  <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                </span>
              </label>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                {demandMultiplier.toFixed(2)}x
              </span>
            </div>
            <input
              id="input-demand-multiplier"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={demandMultiplier}
              onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#0ea5e9' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>0.50x (Sluggish Season)</span>
              <span>1.00x (Normal)</span>
              <span>2.00x (Peak Surge)</span>
            </div>
          </div>

          {/* Control 2: Price Elasticity Coefficient */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Illustrative Price Elasticity</span>
                <span title="Hypothetical demand responsiveness to fare changes. 0.0 is perfectly inelastic.">
                  <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                </span>
              </label>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#c084fc' }}>
                {priceElasticity.toFixed(2)}
              </span>
            </div>
            <input
              id="input-price-elasticity"
              type="range"
              min="-2.0"
              max="0.0"
              step="0.05"
              value={priceElasticity}
              onChange={(e) => setPriceElasticity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#a855f7' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>-2.00 (Highly Sensitive)</span>
              <span>-0.50 (Moderate)</span>
              <span>0.00 (Inelastic - Volume Invariant)</span>
            </div>
          </div>
        </div>

        {/* Preset Benchmark Scenarios */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
            BENCHMARK TEST SCENARIOS (EXPLORE SENSITIVITIES &amp; DOWNSIDES)
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
              onClick={() => {
                setDemandMultiplier(1.0);
                setPriceElasticity(-0.5);
                runSimulation(1.0, -0.5);
              }}
            >
              Balanced Market (1.00x / -0.50)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', borderColor: '#f59e0b', color: '#b45309' }}
              onClick={() => {
                setDemandMultiplier(1.0);
                setPriceElasticity(0.0);
                runSimulation(1.0, 0.0);
              }}
            >
              Inelastic Market (Dynamic Underperforms) (1.00x / 0.00)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', borderColor: '#ef4444', color: '#b91c1c' }}
              onClick={() => {
                setDemandMultiplier(0.7);
                setPriceElasticity(-1.8);
                runSimulation(0.7, -1.8);
              }}
            >
              Elastic Backlash (Price Resistance) (0.70x / -1.80)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', borderColor: '#10b981', color: '#047857' }}
              onClick={() => {
                setDemandMultiplier(1.5);
                setPriceElasticity(-0.2);
                runSimulation(1.5, -0.2);
              }}
            >
              Peak Holiday Surge (1.50x / -0.20)
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="notice-box notice-danger">
          <AlertTriangle size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Underperformance Warning Banner if Dynamic Policy Yields Lower Revenue */}
      {result?.dynamic_underperforms_baseline && (
        <div className="notice-box notice-warning" style={{ borderLeft: '4px solid #f59e0b' }}>
          <AlertTriangle size={20} style={{ color: '#d97706' }} />
          <div>
            <strong>POLICY UNDERPERFORMANCE OBSERVED:</strong> {result.underperformance_note}
            <div style={{ fontSize: '0.78rem', marginTop: '4px', color: 'var(--text-dim)' }}>
              This scenario proves that dynamic pricing is not a guaranteed financial panacea: in price-inelastic conditions, discounting off-peak seats erodes yield without stimulating offsetting volume.
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side Policy Comparative Cards */}
      {result && (
        <>
          <div className="grid-cols-2">
            {/* Policy 1: Fixed-Fare Baseline */}
            <div className="card" style={{ borderLeft: '4px solid #64748b' }}>
              <div className="card-header">
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>POLICY A</div>
                  <div className="card-title">Fixed-Fare Baseline</div>
                </div>
                <span className="badge" style={{ backgroundColor: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' }}>
                  Static Base Fare
                </span>
              </div>

              <div style={{ margin: '14px 0' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SIMULATED TOTAL REVENUE</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>
                  ₹{result.baseline_total_revenue.toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SEATS SOLD</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{result.baseline_total_seats_sold}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OCCUPANCY</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{result.baseline_avg_occupancy_pct}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>UNSOLD SEATS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-dim)' }}>{result.baseline_unsold_seats}</div>
                </div>
              </div>
            </div>

            {/* Policy 2: FleetYield Dynamic Policy */}
            <div className="card" style={{ borderLeft: '4px solid #38bdf8' }}>
              <div className="card-header">
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>POLICY B</div>
                  <div className="card-title">FleetYield Dynamic Policy</div>
                </div>
                <span className="badge badge-low">
                  Rule-Adjusted Yield
                </span>
              </div>

              <div style={{ margin: '14px 0' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SIMULATED TOTAL REVENUE</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8' }}>
                  ₹{result.fleetyield_total_revenue.toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SEATS SOLD</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>{result.fleetyield_total_seats_sold}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OCCUPANCY</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>{result.fleetyield_avg_occupancy_pct}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>UNSOLD SEATS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#34d399' }}>{result.fleetyield_unsold_seats}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Variance Breakdown Card */}
          <div className="card" style={{ background: 'rgba(17, 24, 39, 0.95)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>SIMULATED POLICY VARIANCE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: result.revenue_difference >= 0 ? '#34d399' : '#fb7185', marginTop: '2px' }}>
                  {result.revenue_difference >= 0 ? `+₹${result.revenue_difference.toLocaleString()}` : `-₹${Math.abs(result.revenue_difference).toLocaleString()}`}{' '}
                  <span style={{ fontSize: '0.95rem' }}>
                    ({result.revenue_difference_pct >= 0 ? `+${result.revenue_difference_pct}%` : `${result.revenue_difference_pct}%`})
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '580px', lineHeight: 1.5 }}>
                {result.assumptions_narrative}
              </div>
            </div>
          </div>

          {/* Detailed Per-Trip Simulation Breakdown */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="card-title">Per-Trip Scenario Breakdown ({result.trips.length} Valid Trips)</div>
              <div className="card-subtitle">
                Inspect how each trip's capacity and demand category behaves under identical simulated conditions
              </div>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Trip & Route</th>
                    <th>Demand</th>
                    <th>Fixed Fare (A)</th>
                    <th>Fixed Sold / Rev</th>
                    <th>Fleet Fare (B)</th>
                    <th>Fleet Sold / Rev</th>
                    <th>Simulated Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trips.map((row) => (
                    <tr key={row.trip_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.route_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {row.trip_id} &bull; Capacity: {row.total_seats}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${row.demand_category.toLowerCase()}`}>
                          {row.demand_category}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>₹{row.baseline_fare}</div>
                      </td>
                      <td>
                        <div>{row.baseline_sold_seats} seats ({row.baseline_occupancy_pct}%)</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>₹{row.baseline_revenue.toLocaleString()}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#38bdf8' }}>₹{row.fleetyield_fare}</div>
                      </td>
                      <td>
                        <div>{row.fleetyield_sold_seats} seats ({row.fleetyield_occupancy_pct}%)</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>₹{row.fleetyield_revenue.toLocaleString()}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: row.revenue_diff >= 0 ? '#34d399' : '#fb7185' }}>
                          {row.revenue_diff >= 0 ? `+₹${row.revenue_diff.toLocaleString()}` : `-₹${Math.abs(row.revenue_diff).toLocaleString()}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {row.seats_diff >= 0 ? `+${row.seats_diff}` : `${row.seats_diff}`} seats
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mathematical Model & Assumptions Transparency Box */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span>Mathematical Formulation & Assumptions</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              <div>
                <strong>Capacity Constraint:</strong> For both policies, total seats sold cannot exceed physical bus capacity:
                <code style={{ display: 'block', padding: '8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', color: '#38bdf8', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  Realized_Additional_Bookings = min(Available_Capacity, Adjusted_Prospective_Demand)
                </code>
              </div>

              <div>
                <strong>Price Elasticity Response:</strong> Prospective unbooked passenger requests respond to fare deviation from base fare according to:
                <code style={{ display: 'block', padding: '8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', color: '#c084fc', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  Demand_Multiplier_Response = max(0.0, 1.0 + (price_elasticity * ((Fleet_Fare - Base_Fare) / Base_Fare)))
                </code>
              </div>

              <div>
                <strong>Boundary Symmetry:</strong> When elasticity is 0.0 (inelastic), passenger demand volume is identical between both policies, providing a pure fare yield comparison without quantity distortion.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
