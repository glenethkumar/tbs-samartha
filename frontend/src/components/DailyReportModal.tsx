import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Calendar,
  X,
  TrendingUp,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import type { DailyOperationsReport } from '../types';
import { api } from '../api';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({ isOpen, onClose }) => {
  const [reportDate, setReportDate] = useState<string>('2026-10-10');
  const [report, setReport] = useState<DailyOperationsReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDailyReport(reportDate);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate daily report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, reportDate]);

  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    const url = api.downloadDailyReportCsvUrl(reportDate);
    window.open(url, '_blank');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8'
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Daily Operations &amp; Revenue Reconciliation Report
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Audited actual financial results reconciled against dynamic forecast models
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleDownloadCsv}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Date Selector Banner */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Report Date:</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.78rem', padding: '4px 8px', width: 'auto' }}
            />
          </div>

          <button
            onClick={fetchReport}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Regenerate Summary</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className="notice-box notice-danger">
              <AlertTriangle size={16} />
              <div>{error}</div>
            </div>
          )}

          {report && (
            <>
              {/* Financial & Operational KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Scheduled Trips
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    {report.total_trips}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {report.completed_trips} Completed &bull; {report.upcoming_trips} Upcoming
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Seats &amp; Occupancy
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                    {report.overall_occupancy_pct}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {report.total_booked_seats} of {report.total_seats} booked
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Actual Collected Revenue
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                    ₹{Math.round(report.actual_ticket_revenue).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    Discounts/Refunds: ₹{report.discounts_and_refunds}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Operating Profit / (Loss)
                  </div>
                  <div 
                    style={{ 
                      fontSize: '1.3rem', 
                      fontWeight: 800, 
                      marginTop: '2px',
                      color: report.actual_operating_profit >= 0 ? '#34d399' : '#fb7185'
                    }}
                  >
                    ₹{Math.round(report.actual_operating_profit).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    Margin: {report.profit_margin_pct}% (Expenses: ₹{Math.round(report.total_operating_expenses).toLocaleString()})
                  </div>
                </div>
              </div>

              {/* Forecast vs Actual Reconciliation Card */}
              <div 
                style={{ 
                  padding: '16px', 
                  backgroundColor: '#f8fafc', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #e2e8f0'
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284c7', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} />
                  <span>Forecast vs. Actual Reconciliation Variance</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Revenue Forecast Comparison</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '2px' }}>
                      Forecast: <strong>₹{Math.round(report.forecast_vs_actual.forecast_total_revenue).toLocaleString()}</strong> vs Actual: <strong>₹{Math.round(report.forecast_vs_actual.actual_total_revenue).toLocaleString()}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: report.forecast_vs_actual.revenue_variance >= 0 ? '#34d399' : '#fb7185', marginTop: '2px' }}>
                      Variance: {report.forecast_vs_actual.revenue_variance >= 0 ? '+' : ''}₹{Math.round(report.forecast_vs_actual.revenue_variance).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Occupancy Rate Comparison</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '2px' }}>
                      Forecast: <strong>{report.forecast_vs_actual.forecast_avg_occupancy_pct}%</strong> vs Actual: <strong>{report.forecast_vs_actual.actual_avg_occupancy_pct}%</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: report.forecast_vs_actual.occupancy_variance_pct >= 0 ? '#34d399' : '#fb7185', marginTop: '2px' }}>
                      Variance: {report.forecast_vs_actual.occupancy_variance_pct >= 0 ? '+' : ''}{report.forecast_vs_actual.occupancy_variance_pct}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Outstanding Items</div>
                    <div style={{ fontSize: '0.85rem', color: '#fbbf24', marginTop: '2px' }}>
                      {report.pending_recommendations_count} Pending Approvals &bull; {report.active_alerts_count} Active Alerts
                    </div>
                    {report.unreliable_data_trips_count > 0 && (
                      <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>
                        {report.unreliable_data_trips_count} services flagged with unreliable data
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Trip-by-Trip Audit Table */}
              <div style={{ marginTop: '4px' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Trip Service Performance Summary
                </div>

                <div className="table-responsive">
                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Trip / Route</th>
                        <th>Status</th>
                        <th>Dep Time</th>
                        <th style={{ textAlign: 'right' }}>Occupancy</th>
                        <th style={{ textAlign: 'right' }}>Collected Rev</th>
                        <th style={{ textAlign: 'right' }}>Net Profit</th>
                        <th>Data Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.trips.map((tr) => (
                        <tr key={tr.trip_id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{tr.route_name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{tr.trip_id}</div>
                          </td>
                          <td>
                            <span className={`badge ${tr.status === 'COMPLETED' ? 'badge-valid' : 'badge-medium'}`} style={{ fontSize: '0.68rem' }}>
                              {tr.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(tr.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 600 }}>
                            {tr.occupancy_pct}% ({tr.booked_seats}/{tr.total_seats})
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                            ₹{Math.round(tr.collected_revenue)}
                          </td>
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontSize: '0.85rem', 
                              fontWeight: 700,
                              color: tr.actual_net_profit >= 0 ? '#34d399' : '#fb7185'
                            }}
                          >
                            ₹{Math.round(tr.actual_net_profit)}
                          </td>
                          <td>
                            {tr.data_reliable ? (
                              <span style={{ fontSize: '0.7rem', color: '#34d399' }}>Verified</span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: '#fbbf24' }}>Stale/Unreliable</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legal Notice */}
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                {report.notice}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
