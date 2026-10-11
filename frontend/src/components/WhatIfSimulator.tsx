import React, { useState, useEffect } from 'react';
import {
  Calculator,
  AlertTriangle,
  DollarSign,
  Fuel,
  RefreshCw,
  Scale
} from 'lucide-react';
import type { Trip, WhatIfSimulateResponse } from '../types';
import { api } from '../api';

interface WhatIfSimulatorProps {
  tripId: string;
  trip: Trip;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({ tripId, trip }) => {
  const [scenarioType, setScenarioType] = useState<'expected' | 'conservative' | 'optimistic'>('expected');
  const [manualTargetFare, setManualTargetFare] = useState<number>(trip.current_fare);
  const [changePct, setChangePct] = useState<number>(0);
  const [mode, setMode] = useState<'fare' | 'pct'>('fare');
  
  // Cost category overrides
  const [showCostOverrides, setShowCostOverrides] = useState<boolean>(false);
  const [fuelCost, setFuelCost] = useState<number>(3200);
  const [driverWages, setDriverWages] = useState<number>(1400);
  const [conductorWages, setConductorWages] = useState<number>(900);
  const [tollCharges, setTollCharges] = useState<number>(850);
  const [commissionPct, setCommissionPct] = useState<number>(6.5);
  const [maintenance, setMaintenance] = useState<number>(600);
  const [taxes, setTaxes] = useState<number>(450);

  const [loading, setLoading] = useState<boolean>(false);
  const [simData, setSimData] = useState<WhatIfSimulateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: import('../types').WhatIfSimulateRequest = {
        scenario_type: scenarioType,
        manual_target_fare: mode === 'fare' ? manualTargetFare : null,
        manual_adjustment_pct: mode === 'pct' ? changePct : null,
        expense_overrides: showCostOverrides ? {
          fuel_cost: fuelCost,
          driver_wages: driverWages,
          conductor_wages: conductorWages,
          toll_charges: tollCharges,
          platform_commission_pct: commissionPct,
          maintenance_allocation: maintenance,
          permits_and_taxes: taxes,
        } : null,
      };
      const res = await api.simulateWhatIf(tripId, payload);
      setSimData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to simulate scenario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [tripId, scenarioType]);

  const handleFareChange = (newFare: number) => {
    setManualTargetFare(newFare);
    const diffPct = Math.round(((newFare - trip.current_fare) / trip.current_fare) * 100);
    setChangePct(diffPct);
  };

  const handlePctChange = (newPct: number) => {
    setChangePct(newPct);
    const calcFare = Math.round(trip.current_fare * (1 + newPct / 100));
    setManualTargetFare(calcFare);
  };

  const renderMetricRow = (
    label: string,
    currentVal: string | number,
    recommendedVal: string | number,
    manualVal: string | number,
    highlight: boolean = false
  ) => (
    <tr style={{ backgroundColor: highlight ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
      <td style={{ fontWeight: highlight ? 700 : 500, color: highlight ? '#38bdf8' : 'var(--text-main)', fontSize: '0.85rem' }}>
        {label}
      </td>
      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {currentVal}
      </td>
      <td style={{ textAlign: 'right', color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem' }}>
        {recommendedVal}
      </td>
      <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 700, fontSize: '0.9rem' }}>
        {manualVal}
      </td>
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          padding: '18px 24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}
          >
            <Calculator size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              What-If Scenario Simulator
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Test fare adjustments and cost changes to see instant revenue and profit impact.
            </div>
          </div>
        </div>

        {/* Scenario Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {(['conservative', 'expected', 'optimistic'] as const).map((sc) => (
            <button
              key={sc}
              onClick={() => setScenarioType(sc)}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textTransform: 'capitalize',
                backgroundColor: scenarioType === sc ? 'var(--primary)' : 'transparent',
                color: scenarioType === sc ? '#ffffff' : 'var(--text-body)',
                boxShadow: scenarioType === sc ? 'var(--shadow-sm)' : 'none'
              }}
            >
              {sc} Scenario
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="notice-box notice-danger">
          <AlertTriangle size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Control Panel: Fare Adjustment & Cost Categories */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={18} style={{ color: '#38bdf8' }} />
          <span>Scenario Pricing &amp; Operating Cost Inputs</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* Target Fare Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target Alternative Fare (₹):
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Bounds: ₹{trip.min_fare} – ₹{trip.max_fare}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                min={trip.min_fare}
                max={trip.max_fare}
                step={10}
                value={manualTargetFare}
                onChange={(e) => {
                  setMode('fare');
                  handleFareChange(Number(e.target.value));
                }}
                className="form-control"
                style={{ fontSize: '0.95rem', fontWeight: 700 }}
              />
              <button
                className="btn btn-primary"
                onClick={runSimulation}
                disabled={loading}
                style={{ padding: '6px 16px', fontSize: '0.82rem' }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Simulate</span>
              </button>
            </div>
          </div>

          {/* Fare Change % Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Fare Adjustment Percentage:
              </label>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: changePct >= 0 ? '#34d399' : '#fb7185' }}>
                {changePct >= 0 ? `+${changePct}%` : `${changePct}%`}
              </span>
            </div>
            <input
              type="range"
              min={-40}
              max={50}
              step={1}
              value={changePct}
              onChange={(e) => {
                setMode('pct');
                handlePctChange(Number(e.target.value));
              }}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#38bdf8' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              <span>-40% (Aggressive Discount)</span>
              <span>0% (Status Quo)</span>
              <span>+50% (Peak Premium)</span>
            </div>
          </div>
        </div>

        {/* Toggle Cost Overrides */}
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <button
            onClick={() => setShowCostOverrides(!showCostOverrides)}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0
            }}
          >
            <Fuel size={14} />
            <span>{showCostOverrides ? 'Hide Configurable Cost Parameters' : 'Customize Operating Expense Categories (Fuel, Wages, Tolls, Commission)'}</span>
          </button>

          {showCostOverrides && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '12px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fuel Cost (₹)</label>
                <input type="number" value={fuelCost} onChange={(e) => setFuelCost(Number(e.target.value))} className="form-control" style={{ fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Driver Wages (₹)</label>
                <input type="number" value={driverWages} onChange={(e) => setDriverWages(Number(e.target.value))} className="form-control" style={{ fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Conductor Wages (₹)</label>
                <input type="number" value={conductorWages} onChange={(e) => setConductorWages(Number(e.target.value))} className="form-control" style={{ fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Toll Charges (₹)</label>
                <input type="number" value={tollCharges} onChange={(e) => setTollCharges(Number(e.target.value))} className="form-control" style={{ fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Platform Commission (%)</label>
                <input type="number" step={0.5} value={commissionPct} onChange={(e) => setCommissionPct(Number(e.target.value))} className="form-control" style={{ fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Maintenance (₹)</label>
                <input type="number" value={maintenance} onChange={(e) => setMaintenance(Number(e.target.value))} className="form-control" style={{ fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Permits &amp; Taxes (₹)</label>
                <input type="number" value={taxes} onChange={(e) => setTaxes(Number(e.target.value))} className="form-control" style={{ fontSize: '0.8rem' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warnings & Clamping Notes */}
      {simData && simData.scenarios_comparison.manual_alternative.warnings && simData.scenarios_comparison.manual_alternative.warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {simData.scenarios_comparison.manual_alternative.warnings.map((w, idx) => (
            <div key={idx} className="notice-box notice-warning" style={{ margin: 0 }}>
              <AlertTriangle size={16} />
              <div style={{ fontSize: '0.82rem' }}>{w}</div>
            </div>
          ))}
        </div>
      )}

      {/* Side-by-Side Comparison Table */}
      {simData && (() => {
        const curr = simData.scenarios_comparison.current_pricing;
        const recPlan = simData.scenarios_comparison.recommended_pricing;
        const manual = simData.scenarios_comparison.manual_alternative;

        return (
          <div className="card" style={{ padding: '20px' }}>
            <div className="card-header" style={{ marginBottom: '14px' }}>
              <div className="card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={18} style={{ color: '#34d399' }} />
                <span>Multi-Scenario Profitability &amp; Financial Comparison</span>
              </div>
              <span className="badge badge-medium" style={{ textTransform: 'capitalize' }}>
                {scenarioType} Scenario Mode
              </span>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '34%' }}>Metric</th>
                    <th style={{ textAlign: 'right', width: '22%' }}>Current Plan</th>
                    <th style={{ textAlign: 'right', width: '22%' }}>Recommended Plan</th>
                    <th style={{ textAlign: 'right', width: '22%' }}>Manual Alternative</th>
                  </tr>
                </thead>
                <tbody>
                  {renderMetricRow(
                    'Average Available Fare',
                    `₹${Math.round(curr.average_available_fare)}`,
                    `₹${Math.round(recPlan.average_available_fare)}`,
                    `₹${Math.round(manual.average_available_fare)}`,
                    false
                  )}
                  {renderMetricRow(
                    'Additional Bookings Forecast',
                    `+${curr.expected_additional_bookings} seats`,
                    `+${recPlan.expected_additional_bookings} seats`,
                    `+${manual.expected_additional_bookings} seats`,
                    false
                  )}
                  {renderMetricRow(
                    'Projected Final Occupancy',
                    `${curr.expected_final_occupancy_pct}%`,
                    `${recPlan.expected_final_occupancy_pct}%`,
                    `${manual.expected_final_occupancy_pct}%`,
                    false
                  )}
                  {renderMetricRow(
                    'Gross Ticket Sales',
                    `₹${Math.round(curr.gross_ticket_sales).toLocaleString()}`,
                    `₹${Math.round(recPlan.gross_ticket_sales).toLocaleString()}`,
                    `₹${Math.round(manual.gross_ticket_sales).toLocaleString()}`,
                    false
                  )}
                  {renderMetricRow(
                    'Discounts & Refunds',
                    `₹${Math.round(curr.discounts_and_refunds).toLocaleString()}`,
                    `₹${Math.round(recPlan.discounts_and_refunds).toLocaleString()}`,
                    `₹${Math.round(manual.discounts_and_refunds).toLocaleString()}`,
                    false
                  )}
                  {renderMetricRow(
                    'Net Ticket Revenue',
                    `₹${Math.round(curr.net_ticket_revenue).toLocaleString()}`,
                    `₹${Math.round(recPlan.net_ticket_revenue).toLocaleString()}`,
                    `₹${Math.round(manual.net_ticket_revenue).toLocaleString()}`,
                    true
                  )}
                  {renderMetricRow(
                    'Operating Expenses',
                    `₹${Math.round(curr.operating_expenses).toLocaleString()}`,
                    `₹${Math.round(recPlan.operating_expenses).toLocaleString()}`,
                    `₹${Math.round(manual.operating_expenses).toLocaleString()}`,
                    false
                  )}
                  {renderMetricRow(
                    'Operating Profit / (Loss)',
                    `₹${Math.round(curr.operating_profit_loss).toLocaleString()}`,
                    `₹${Math.round(recPlan.operating_profit_loss).toLocaleString()}`,
                    `₹${Math.round(manual.operating_profit_loss).toLocaleString()}`,
                    true
                  )}
                  {renderMetricRow(
                    'Profit Margin %',
                    `${curr.profit_margin_pct}%`,
                    `${recPlan.profit_margin_pct}%`,
                    `${manual.profit_margin_pct}%`,
                    false
                  )}
                  {renderMetricRow(
                    'Revenue per Occupied Seat',
                    `₹${Math.round(curr.revenue_per_occupied_seat)}`,
                    `₹${Math.round(recPlan.revenue_per_occupied_seat)}`,
                    `₹${Math.round(manual.revenue_per_occupied_seat)}`,
                    false
                  )}
                  {renderMetricRow(
                    'Break-Even Revenue',
                    `₹${Math.round(simData.break_even_revenue).toLocaleString()}`,
                    `₹${Math.round(simData.break_even_revenue).toLocaleString()}`,
                    `₹${Math.round(simData.break_even_revenue).toLocaleString()}`,
                    false
                  )}
                  {renderMetricRow(
                    'Break-Even Occupancy %',
                    `${simData.break_even_occupancy_pct}%`,
                    `${simData.break_even_occupancy_pct}%`,
                    `${simData.break_even_occupancy_pct}%`,
                    false
                  )}
                </tbody>
              </table>
            </div>

            {/* Variance Summary Card */}
            <div 
              style={{ 
                marginTop: '16px', 
                padding: '12px 16px', 
                backgroundColor: '#f8fafc', 
                borderRadius: 'var(--radius-md)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600 }}>
                Variance of Manual Scenario vs Current:
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: (manual.revenue_difference_vs_current || 0) >= 0 ? '#047857' : '#dc2626' }}>
                  Revenue: {(manual.revenue_difference_vs_current || 0) >= 0 ? '+' : ''}₹{Math.round(manual.revenue_difference_vs_current || 0)}
                </span>
                <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: (manual.profit_difference_vs_current || 0) >= 0 ? '#047857' : '#dc2626' }}>
                  Profit: {(manual.profit_difference_vs_current || 0) >= 0 ? '+' : ''}₹{Math.round(manual.profit_difference_vs_current || 0)}
                </span>
                <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0284c7' }}>
                  Occupancy: {Math.round(manual.expected_final_occupancy_pct - curr.expected_final_occupancy_pct)}%
                </span>
              </div>
            </div>

            {/* Assumptions & Disclaimer */}
            <div style={{ marginTop: '16px', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                Simulation Modeling Assumptions:
              </div>
              <ul style={{ paddingLeft: '18px', margin: 0 }}>
                {simData.assumptions_explained.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
