import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  Building2,
  RefreshCw,
  FilterX
} from 'lucide-react';
import type { Trip, CompetitorTrendResponse } from '../types';
import { api } from '../api';

interface CompetitorTrendsProps {
  tripId: string;
  trip: Trip;
}

export const CompetitorTrends: React.FC<CompetitorTrendsProps> = ({ tripId, trip }) => {
  const [days, setDays] = useState<number>(7);
  const [trends, setTrends] = useState<CompetitorTrendResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCompetitorTrends(tripId, days);
      setTrends(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch competitor fare history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [tripId, days]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
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
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Competitor Price Trends</span>
              {trends && (
                <span className={`badge ${trends.is_stale ? 'badge-stale' : 'badge-valid'}`}>
                  {trends.freshness_status}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Track price changes across competing bus operators on route {trip.origin} &rarr; {trip.destination}.
            </div>
          </div>
        </div>

        {/* Days Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Timeframe:</span>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              {d} Days
            </button>
          ))}
          <button
            onClick={fetchTrends}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px' }}
            title="Refresh trend data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="notice-box notice-danger">
          <AlertTriangle size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Warnings & Stale Data Notices */}
      {trends?.warnings && trends.warnings.length > 0 && (
        <div className="notice-box notice-warning">
          <AlertTriangle size={18} />
          <div>
            {trends.warnings.map((w, i) => (
              <div key={i} style={{ marginBottom: i < trends.warnings.length - 1 ? '4px' : 0 }}>
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      {trends && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Our Current Operating Fare
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
              ₹{trends.our_current_fare}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Trip: {trip.route_name}
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Comparable Competitor Median
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              ₹{Math.round(trends.overall_comparable_median)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Sample: {trends.total_observations} observations
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Market Price Range
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
              ₹{trends.overall_comparable_min} &ndash; ₹{trends.overall_comparable_max}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Lowest to highest comparable fare
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Price Difference vs Median
            </div>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                marginTop: '4px',
                color: trends.our_fare_vs_median_diff > 0 ? '#34d399' : (trends.our_fare_vs_median_diff < 0 ? '#fb7185' : '#38bdf8')
              }}
            >
              {trends.our_fare_vs_median_diff > 0 ? '+' : ''}₹{Math.round(trends.our_fare_vs_median_diff)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              {trends.our_fare_vs_median_diff > 0 ? 'Priced above market median' : (trends.our_fare_vs_median_diff < 0 ? 'Priced below market median' : 'At market parity')}
            </div>
          </div>
        </div>
      )}

      {/* Operator Price Shifts (Increases / Decreases / Unusual Movements) */}
      {trends && trends.recent_price_shifts && trends.recent_price_shifts.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} style={{ color: '#38bdf8' }} />
            <span>Observed Competitor Price Shifts (Last {days} Days)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {trends.recent_price_shifts.map((shift, idx) => (
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
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                    {shift.operator_name}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Shift: ₹{shift.earliest_fare} &rarr; <strong style={{ color: '#0f172a' }}>₹{shift.latest_fare}</strong> ({shift.earliest_date} to {shift.latest_date})
                  </div>
                  {shift.is_unusual_movement && (
                    <span style={{ fontSize: '0.68rem', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
                      <AlertTriangle size={11} />
                      Unusual movement (&ge;15%)
                    </span>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: shift.shift_type === 'INCREASE' ? 'rgba(16, 185, 129, 0.15)' : (shift.shift_type === 'DECREASE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)'),
                      color: shift.shift_type === 'INCREASE' ? '#34d399' : (shift.shift_type === 'DECREASE' ? '#fb7185' : '#38bdf8')
                    }}
                  >
                    {shift.shift_type === 'INCREASE' && <TrendingUp size={12} />}
                    {shift.shift_type === 'DECREASE' && <TrendingDown size={12} />}
                    {shift.shift_type !== 'INCREASE' && shift.shift_type !== 'DECREASE' && <Minus size={12} />}
                    <span>{shift.shift_type} ({shift.fare_difference > 0 ? '+' : ''}₹{Math.abs(shift.fare_difference)})</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Daily Timeline Table */}
      {trends && trends.timeline && trends.timeline.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <div className="card-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: '#38bdf8' }} />
              <span>Competitor Daily Fare Trends Timeline</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Daily median, range, and operator price points
            </span>
          </div>

          <div className="table-responsive">
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Competitor Median</th>
                  <th style={{ textAlign: 'right' }}>Price Range (Min - Max)</th>
                  <th style={{ textAlign: 'right' }}>Our Fare</th>
                  <th style={{ textAlign: 'right' }}>Diff vs Median</th>
                  <th>Observed Rivals</th>
                </tr>
              </thead>
              <tbody>
                {trends.timeline.map((point) => (
                  <tr key={point.date}>
                    <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {point.date}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8' }}>
                      ₹{point.median_fare}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      ₹{point.min_fare} &ndash; ₹{point.max_fare}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}>
                      ₹{point.our_fare}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: point.difference_vs_our_fare > 0 ? '#34d399' : (point.difference_vs_our_fare < 0 ? '#fb7185' : 'var(--text-dim)') }}>
                      {point.difference_vs_our_fare > 0 ? '+' : ''}₹{point.difference_vs_our_fare}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Object.entries(point.operator_fares).map(([opName, fare]) => (
                          <span
                            key={opName}
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#0f172a',
                              borderRadius: '4px'
                            }}
                          >
                            {opName}: <strong>₹{fare}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incomparable Services Flagged Section */}
      {trends && trends.incomparable_services && trends.incomparable_services.length > 0 && (
        <div className="card" style={{ padding: '16px 20px', borderLeft: '3px solid #fbbf24' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <FilterX size={16} />
            <span>Incomparable Competitor Services Excluded from Benchmark ({trends.incomparable_services.length})</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '10px' }}>
            The following services were recorded on this route but excluded from median fare calculations to prevent false parity (e.g. non-AC or seater vs luxury sleeper):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {trends.incomparable_services.map((item, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  backgroundColor: 'rgba(251, 191, 36, 0.08)',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <strong>{item.operator_name}</strong> ({item.platform}) &bull; ₹{item.fare} &bull; <span style={{ color: 'var(--text-muted)' }}>{item.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Integrity Footer Notice */}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0 4px' }}>
        Data integrity policy: Competitor fare observations older than 24 hours are marked stale. Incomparable seating and AC categories are filtered out to ensure accurate pricing benchmarks.
      </div>
    </div>
  );
};
