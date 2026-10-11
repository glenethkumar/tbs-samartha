import React, { useState, useEffect } from 'react';
import {
  Award,
  Target,
  SlidersHorizontal,
  AlertTriangle,
  RefreshCw,
  Compass,
  Layers
} from 'lucide-react';
import type { PerformanceSummary } from '../types';
import { api } from '../api';

export const PerformanceDashboard: React.FC = () => {
  const [data, setData] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await api.getPerformanceSummary();
      setData(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendation performance metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '20px 24px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}
          >
            <Award size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Forecast Accuracy &amp; Performance</span>
              {data && (
                <span className="badge badge-valid">
                  {data.data_confidence.status}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Track forecast precision and revenue accuracy for completed trips.
            </div>
          </div>
        </div>

        <button
          onClick={fetchPerformance}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Performance Audit</span>
        </button>
      </div>

      {error && (
        <div className="notice-box notice-danger">
          <AlertTriangle size={18} />
          <div>{error}</div>
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '8px' }}>
            <RefreshCw size={24} />
          </div>
          <div>Auditing historical recommendations and forecast accuracy metrics...</div>
        </div>
      )}

      {data && (
        <>
          {/* Executive KPI Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Recommendations
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {data.total_recommendations}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                {data.completed_trips_evaluated} completed trips evaluated
              </div>
            </div>

            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Operator Approval Rate
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                {data.approval_rate_pct}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                {data.approved_count} approved &bull; {data.rejected_count} rejected &bull; {data.overridden_count} overridden
              </div>
            </div>

            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Revenue Forecast MAPE
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                {data.revenue_forecast_metrics.mean_absolute_pct_error}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Mean Absolute Error: ₹{Math.round(data.revenue_forecast_metrics.mean_absolute_error)}
              </div>
            </div>

            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Occupancy Forecast Error
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                &plusmn;{data.occupancy_forecast_metrics.mean_absolute_error}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Mean Absolute % Error: {data.occupancy_forecast_metrics.mean_absolute_pct_error}%
              </div>
            </div>
          </div>

          {/* Forecast vs. Actual Statistical Metrics */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <div className="card-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} style={{ color: '#38bdf8' }} />
                <span>Forecast Error Breakdown &amp; Statistical Reliability</span>
              </div>
              <div className="card-subtitle">
                Sample size: {data.revenue_forecast_metrics.sample_size} reconciled post-trip observations
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Metric 1: Revenue */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0284c7', marginBottom: '8px' }}>
                  Trip Ticket Revenue Forecasts
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mean Absolute Error (MAE):</span>
                    <strong style={{ color: '#0f172a' }}>₹{Math.round(data.revenue_forecast_metrics.mean_absolute_error)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mean Absolute % Error (MAPE):</span>
                    <strong style={{ color: '#047857' }}>{data.revenue_forecast_metrics.mean_absolute_pct_error}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Directional Accuracy:</span>
                    <strong style={{ color: '#0284c7' }}>{data.revenue_forecast_metrics.direction_accuracy_pct}%</strong>
                  </div>
                </div>
              </div>

              {/* Metric 2: Occupancy */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#b45309', marginBottom: '8px' }}>
                  Final Occupancy Rate Forecasts
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mean Absolute Error (MAE):</span>
                    <strong style={{ color: '#0f172a' }}>{data.occupancy_forecast_metrics.mean_absolute_error}% points</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mean Absolute % Error (MAPE):</span>
                    <strong style={{ color: '#b45309' }}>{data.occupancy_forecast_metrics.mean_absolute_pct_error}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Evaluation Threshold:</span>
                    <strong style={{ color: '#334155' }}>Completed services only</strong>
                  </div>
                </div>
              </div>

              {/* Metric 3: Operating Profit */}
              {data.profit_forecast_metrics && (
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#047857', marginBottom: '8px' }}>
                    Net Operating Profit Forecasts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Mean Absolute Error (MAE):</span>
                      <strong style={{ color: '#0f172a' }}>₹{Math.round(data.profit_forecast_metrics.mean_absolute_error)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Mean Absolute % Error (MAPE):</span>
                      <strong style={{ color: '#047857' }}>{data.profit_forecast_metrics.mean_absolute_pct_error}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Cost Accounting Status:</span>
                      <strong style={{ color: '#047857' }}>Full Expense Reconciled</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grouped Performance: By Route & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Route Accuracy Table */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="card-header" style={{ marginBottom: '12px' }}>
                <div className="card-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Compass size={16} style={{ color: '#38bdf8' }} />
                  <span>Performance by Transit Route Corridor</span>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Corridor</th>
                      <th style={{ textAlign: 'right' }}>Recs</th>
                      <th style={{ textAlign: 'right' }}>Approved</th>
                      <th style={{ textAlign: 'right' }}>Revenue MAPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.route_performance).map(([route, perf]) => (
                      <tr key={route}>
                        <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{route}</td>
                        <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{perf.total_recs}</td>
                        <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#34d399' }}>{perf.approved}</td>
                        <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                          {perf.revenue_mape !== null ? `${perf.revenue_mape}%` : 'Pending actuals'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Seat Category Accuracy Table */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="card-header" style={{ marginBottom: '12px' }}>
                <div className="card-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} style={{ color: '#fbbf24' }} />
                  <span>Performance by Cabin Seat Category</span>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Recs</th>
                      <th style={{ textAlign: 'right' }}>Approved</th>
                      <th style={{ textAlign: 'right' }}>Revenue MAPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.category_performance).map(([cat, perf]) => (
                      <tr key={cat}>
                        <td style={{ fontWeight: 600, fontSize: '0.82rem', textTransform: 'capitalize' }}>
                          {cat.replace(/_/g, ' ')}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{perf.total_recs}</td>
                        <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#34d399' }}>{perf.approved}</td>
                        <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                          {perf.revenue_mape !== null ? `${perf.revenue_mape}%` : 'Pending actuals'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Common Operator Override Rationale Analysis */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div className="card-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={16} style={{ color: '#fbbf24' }} />
                <span>Recurring Operator Override Rationale Analysis</span>
              </div>
              <div className="card-subtitle">
                Identifies pricing policy edge cases where human operators intervened
              </div>
            </div>

            {data.common_override_reasons && data.common_override_reasons.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {data.common_override_reasons.map((ov, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#f8fafc',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 500 }}>
                      &ldquo;{ov.reason}&rdquo;
                    </span>
                    <span className="badge badge-medium" style={{ fontSize: '0.72rem' }}>
                      {ov.count} times
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No manual overrides recorded in the evaluation window. All approved pricing followed system recommendations.
              </div>
            )}
          </div>

          {/* Scientific Methodology Note */}
          <div style={{ padding: '14px 18px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', fontSize: '0.74rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
            <strong style={{ color: '#0f172a' }}>Integrity &amp; Attribution Protocol:</strong> {data.data_confidence.notes} Audit logs record operator actions, while this performance module objectively isolates forecast precision (Mean Absolute Error and Percentage Error) after trips have completed.
          </div>
        </>
      )}
    </div>
  );
};
