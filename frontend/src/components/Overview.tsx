import React, { useEffect, useState } from 'react';
import { 
  Bus, 
  Users, 
  TrendingUp, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  BarChart2, 
  Percent 
} from 'lucide-react';
import type { DashboardSummary, Trip } from '../types';
import { api } from '../api';

interface OverviewProps {
  onSelectTrip: (tripId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onSelectTrip, onNavigateTab }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Large Chart state
  const [chartMetric, setChartMetric] = useState<'occupancy' | 'revenue'>('occupancy');
  const [chartTimeRange, setChartTimeRange] = useState<'all' | '24h' | '7d'>('all');
  const [hoveredTripIndex, setHoveredTripIndex] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumData, tripList] = await Promise.all([
        api.getDashboardSummary(),
        api.listTrips({ sort_by: 'departure_time', sort_order: 'asc' }),
      ]);
      setSummary(sumData);
      setTrips(tripList);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading AVGBUS operations analytics...</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="notice-box notice-danger">
        <ShieldAlert size={20} />
        <div>
          <strong>Error loading dashboard:</strong> {error}
          <div style={{ marginTop: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  // Filter trips for chart display based on departure time windows
  const nowMs = Date.now();
  const validTrips = trips.filter((t) => t.is_valid);
  const timeFilteredTrips = validTrips.filter((t) => {
    if (chartTimeRange === 'all') return true;
    const depMs = new Date(t.departure_time).getTime();
    const diffHours = (depMs - nowMs) / (1000 * 3600);
    if (chartTimeRange === '24h') return diffHours >= 0 && diffHours <= 24;
    if (chartTimeRange === '7d') return diffHours >= 0 && diffHours <= 168;
    return true;
  });
  const chartTrips = timeFilteredTrips.length > 0 ? timeFilteredTrips : validTrips;

  // Chart data points
  const points = chartTrips.map((t) => ({
    tripId: t.trip_id,
    route: t.route_name,
    occupancy: t.occupancy_percent,
    revenue: Math.round(t.booked_seats * t.current_fare),
    fare: t.current_fare,
    departure: new Date(t.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  const maxVal = chartMetric === 'occupancy' 
    ? 100 
    : Math.max(...points.map((p) => p.revenue), 10000);

  const occClass = (pct: number) => {
    if (pct < 30) return 'low';
    if (pct > 70) return 'high';
    return 'medium';
  };

  // Donut chart angles for right panel
  const totalCategoryTrips = summary.total_trips || 1;
  const lowCount = summary.occupancy_distribution.low;
  const medCount = summary.occupancy_distribution.medium;
  const highCount = summary.occupancy_distribution.high;
  const invalidCount = summary.occupancy_distribution.invalid;

  const lowPct = Math.round((lowCount / totalCategoryTrips) * 100);
  const medPct = Math.round((medCount / totalCategoryTrips) * 100);
  const highPct = Math.round((highCount / totalCategoryTrips) * 100);
  const invalidPct = Math.round((invalidCount / totalCategoryTrips) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Row of Compact KPI Cards (AVGBUS / Horizon UI Pattern) */}
      <div className="grid-cols-4">
        {/* KPI 1: Total Trips */}
        <div className="stat-card" id="kpi-total-trips">
          <div className="stat-header">
            <span className="stat-label">Total Scheduled Trips</span>
            <div className="stat-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Bus size={18} />
            </div>
          </div>
          <div className="stat-value">{summary.total_trips}</div>
          <div className="stat-footer">
            <span className="trend-badge neutral">
              {summary.upcoming_trips} Upcoming
            </span>
            <span>in current schedule window</span>
          </div>
        </div>

        {/* KPI 2: Booked Seats */}
        <div className="stat-card" id="kpi-total-booked">
          <div className="stat-header">
            <span className="stat-label">Total Booked Seats</span>
            <div className="stat-icon-wrap" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="stat-value">{summary.total_booked_seats}</div>
          <div className="stat-footer">
            <span className="trend-badge positive">
              {Math.round((summary.total_booked_seats / (summary.total_booked_seats + summary.total_available_seats)) * 100)}% Capacity
            </span>
            <span>total reserved seats</span>
          </div>
        </div>

        {/* KPI 3: Available Seats */}
        <div className="stat-card" id="kpi-available-seats">
          <div className="stat-header">
            <span className="stat-label">Available Vacant Seats</span>
            <div className="stat-icon-wrap" style={{ backgroundColor: '#f0f9ff', color: '#0284c7' }}>
              <Percent size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#0284c7' }}>{summary.total_available_seats}</div>
          <div className="stat-footer">
            <span className="trend-badge neutral" style={{ background: '#f0f9ff', color: '#0284c7' }}>
              Vacant
            </span>
            <span>monetization opportunity</span>
          </div>
        </div>

        {/* KPI 4: Average Occupancy */}
        <div className="stat-card" id="kpi-avg-occupancy">
          <div className="stat-header">
            <span className="stat-label">Average Fleet Occupancy</span>
            <div className="stat-icon-wrap" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#7c3aed' }}>{summary.average_occupancy_pct}%</div>
          <div className="stat-footer">
            {summary.trips_needing_review > 0 ? (
              <span className="trend-badge warning">
                <AlertTriangle size={12} /> {summary.trips_needing_review} Need Review
              </span>
            ) : (
              <span className="trend-badge positive">
                <CheckCircle2 size={12} /> Fleet Balanced
              </span>
            )}
            <span>valid trips benchmark</span>
          </div>
        </div>
      </div>

      {/* Large Occupancy / Simulated Revenue Trend Chart Card */}
      <div className="card" id="trend-chart-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div className="card-title">
              <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
              <span>Fleet Occupancy &amp; Revenue Yield Curve</span>
            </div>
            <div className="card-subtitle">
              Interactive departure trajectory &bull; Verified empirical values computed from stored trip records
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Metric Toggle */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: 'var(--radius-md)', padding: '3px' }}>
              <button
                id="btn-metric-occupancy"
                onClick={() => setChartMetric('occupancy')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartMetric === 'occupancy' ? '#ffffff' : 'transparent',
                  color: chartMetric === 'occupancy' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: chartMetric === 'occupancy' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Occupancy Rate (%)
              </button>
              <button
                id="btn-metric-revenue"
                onClick={() => setChartMetric('revenue')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartMetric === 'revenue' ? '#ffffff' : 'transparent',
                  color: chartMetric === 'revenue' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: chartMetric === 'revenue' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Operating Revenue (₹)
              </button>
            </div>

            {/* Time-Range Selector */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: 'var(--radius-md)', padding: '3px' }}>
              <button
                onClick={() => setChartTimeRange('24h')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartTimeRange === '24h' ? '#ffffff' : 'transparent',
                  color: chartTimeRange === '24h' ? 'var(--text-heading)' : 'var(--text-muted)',
                  boxShadow: chartTimeRange === '24h' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Next 24h
              </button>
              <button
                onClick={() => setChartTimeRange('7d')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartTimeRange === '7d' ? '#ffffff' : 'transparent',
                  color: chartTimeRange === '7d' ? 'var(--text-heading)' : 'var(--text-muted)',
                  boxShadow: chartTimeRange === '7d' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                7 Days
              </button>
              <button
                onClick={() => setChartTimeRange('all')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartTimeRange === 'all' ? '#ffffff' : 'transparent',
                  color: chartTimeRange === 'all' ? 'var(--text-heading)' : 'var(--text-muted)',
                  boxShadow: chartTimeRange === 'all' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                All Trips
              </button>
            </div>
          </div>
        </div>

        {/* SVG Interactive Trend Chart */}
        <div style={{ position: 'relative', marginTop: '10px' }}>
          <svg viewBox="0 0 800 240" style={{ width: '100%', height: '230px', overflow: 'visible' }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            <line x1="40" y1="20" x2="780" y2="20" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="70" x2="780" y2="70" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="120" x2="780" y2="120" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="170" x2="780" y2="170" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="210" x2="780" y2="210" stroke="#e2e8f0" strokeWidth="1" />

            {/* Y-Axis Labels */}
            <text x="32" y="24" textAnchor="end" fontSize="10" fill="#94a3b8">
              {chartMetric === 'occupancy' ? '100%' : `₹${Math.round(maxVal / 1000)}k`}
            </text>
            <text x="32" y="124" textAnchor="end" fontSize="10" fill="#94a3b8">
              {chartMetric === 'occupancy' ? '50%' : `₹${Math.round(maxVal / 2000)}k`}
            </text>
            <text x="32" y="214" textAnchor="end" fontSize="10" fill="#94a3b8">
              0
            </text>

            {/* Render Data Curve */}
            {points.length > 1 && (() => {
              const xStep = (740) / (points.length - 1);
              const coords = points.map((p, i) => {
                const val = chartMetric === 'occupancy' ? p.occupancy : p.revenue;
                const y = 210 - ((val / maxVal) * 190);
                const x = 50 + (i * xStep);
                return { x, y, point: p };
              });

              const pathD = coords.reduce((acc, c, idx, arr) => {
                if (idx === 0) return `M ${c.x} ${c.y}`;
                const prev = arr[idx - 1];
                const cx1 = prev.x + (c.x - prev.x) / 2;
                const cx2 = prev.x + (c.x - prev.x) / 2;
                return `${acc} C ${cx1} ${prev.y}, ${cx2} ${c.y}, ${c.x} ${c.y}`;
              }, '');

              const areaD = `${pathD} L ${coords[coords.length - 1].x} 210 L ${coords[0].x} 210 Z`;

              return (
                <g>
                  {/* Fill area */}
                  <path d={areaD} fill="url(#chartGradient)" />
                  {/* Stroke line */}
                  <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

                  {/* Points */}
                  {coords.map((c, i) => (
                    <g key={i}>
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={hoveredTripIndex === i ? 6 : 4}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth="2.5"
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={() => setHoveredTripIndex(i)}
                        onMouseLeave={() => setHoveredTripIndex(null)}
                        onClick={() => onSelectTrip(c.point.tripId)}
                      />
                      <text
                        x={c.x}
                        y={226}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="#64748b"
                        fontWeight="500"
                      >
                        {c.point.tripId.replace('TRIP-', '')}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}
          </svg>

          {/* Active Hover Tooltip */}
          {hoveredTripIndex !== null && points[hoveredTripIndex] && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '20px',
                background: '#0f172a',
                color: '#ffffff',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                fontSize: '0.8rem',
                lineHeight: 1.4,
                zIndex: 20,
              }}
            >
              <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                {points[hoveredTripIndex].route}
              </div>
              <div>ID: <strong>{points[hoveredTripIndex].tripId}</strong> &bull; Departure: {points[hoveredTripIndex].departure}</div>
              <div style={{ marginTop: '4px', display: 'flex', gap: '12px' }}>
                <span>Occupancy: <strong>{points[hoveredTripIndex].occupancy}%</strong></span>
                <span>Revenue: <strong>₹{points[hoveredTripIndex].revenue.toLocaleString()}</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lower Section (2 Columns): Upcoming Trips Table on Left & Demand Analytics Panel on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '22px' }}>
        {/* Left Column: Upcoming Trips Table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Scheduled Departures</div>
              <div className="card-subtitle">Real-time occupancy status from local SQLite storage</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('trips')}>
              All Trips ({trips.length}) <ArrowRight size={14} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Route &amp; ID</th>
                  <th>Departure</th>
                  <th>Occupancy</th>
                  <th>Fare</th>
                  <th>Demand</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {trips.slice(0, 6).map((trip) => (
                  <tr key={trip.trip_id} onClick={() => onSelectTrip(trip.trip_id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{trip.route_name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {trip.trip_id} &bull; {trip.bus_type}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem' }}>
                        {new Date(trip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(trip.departure_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td style={{ minWidth: '120px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{trip.occupancy_percent}%</span>
                        <span style={{ color: 'var(--text-muted)' }}>{trip.booked_seats}/{trip.total_seats}</span>
                      </div>
                      <div className="progress-container">
                        <div 
                          className={`progress-fill ${occClass(trip.occupancy_percent)}`}
                          style={{ width: `${Math.min(100, trip.occupancy_percent)}%` }}
                        />
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>₹{trip.current_fare}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Base: ₹{trip.base_fare}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${trip.demand_category?.toLowerCase() || 'medium'}`}>
                        {trip.demand_category}
                      </span>
                    </td>
                    <td>
                      {trip.is_stale ? (
                        <span className="badge badge-stale" title="Updated >24h ago">
                          Stale
                        </span>
                      ) : !trip.is_valid ? (
                        <span className="badge badge-invalid" title="Violates data constraints">
                          Invalid
                        </span>
                      ) : (
                        <span className="badge badge-valid">
                          Valid
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        id={`btn-table-pricing-${trip.trip_id}`}
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTrip(trip.trip_id);
                        }}
                      >
                        <Sparkles size={12} />
                        <span>Price</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Demand & Occupancy Analytics Panel (Replaces Fake GPS Map with Real Yield Intel) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Donut Chart Demand Distribution */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Demand Category Share</div>
                <div className="card-subtitle">Calculated via deterministic occupancy thresholds</div>
              </div>
            </div>

            {/* Circular Donut Diagram */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', margin: '14px 0' }}>
              <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  {/* Background Circle */}
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                  {/* Segment: Low Demand (Blue) */}
                  <circle
                    cx="18" cy="18" r="15.915"
                    fill="transparent"
                    stroke="#0284c7"
                    strokeWidth="4"
                    strokeDasharray={`${lowPct} ${100 - lowPct}`}
                    strokeDashoffset="0"
                  />
                  {/* Segment: Medium Demand (Emerald) */}
                  <circle
                    cx="18" cy="18" r="15.915"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeDasharray={`${medPct} ${100 - medPct}`}
                    strokeDashoffset={`${-(lowPct)}`}
                  />
                  {/* Segment: High Demand (Purple) */}
                  <circle
                    cx="18" cy="18" r="15.915"
                    fill="transparent"
                    stroke="#8b5cf6"
                    strokeWidth="4"
                    strokeDasharray={`${highPct} ${100 - highPct}`}
                    strokeDashoffset={`${-(lowPct + medPct)}`}
                  />
                  {/* Segment: Invalid/Blocked (Rose) */}
                  {invalidPct > 0 && (
                    <circle
                      cx="18" cy="18" r="15.915"
                      fill="transparent"
                      stroke="#ef4444"
                      strokeWidth="4"
                      strokeDasharray={`${invalidPct} ${100 - invalidPct}`}
                      strokeDashoffset={`${-(lowPct + medPct + highPct)}`}
                    />
                  )}
                </svg>

                {/* Donut Center Label */}
                <div 
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                    {summary.average_occupancy_pct}%
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Avg Load
                  </span>
                </div>
              </div>

              {/* Legend List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0284c7' }} />
                  <span>Low (&lt;30%): <strong>{lowCount} ({lowPct}%)</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span>Medium (30-70%): <strong>{medCount} ({medPct}%)</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8b5cf6' }} />
                  <span>High (&gt;70%): <strong>{highCount} ({highPct}%)</strong></span>
                </div>
                {invalidCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                    <span>Blocked: <strong>{invalidCount} ({invalidPct}%)</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action / Data Guard Notice Card */}
          <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: 'var(--radius-md)', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  Decision-Support Rules Active
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>
                  Pricing recommendations adapt strictly within operator-defined bounds. Approval remains with the operator.
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => onNavigateTab('baseline')}
                  >
                    Compare Baseline
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigateTab('assumptions')}
                  >
                    View Assumptions
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
