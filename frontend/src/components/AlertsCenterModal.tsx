import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  X,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import type { OperationalAlert } from '../types';
import { api } from '../api';

interface AlertsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip?: (tripId: string) => void;
}

export const AlertsCenterModal: React.FC<AlertsCenterModalProps> = ({
  isOpen,
  onClose,
  onSelectTrip
}) => {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts({
        status: statusFilter === 'all' ? undefined : statusFilter,
        severity: severityFilter === 'all' ? undefined : severityFilter,
        trigger_scan: true
      });
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, statusFilter, severityFilter]);

  if (!isOpen) return null;

  const handleAcknowledge = async (alertId: string) => {
    setProcessingId(alertId);
    try {
      await api.acknowledgeAlert(alertId, 'Operator');
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    setProcessingId(alertId);
    try {
      await api.resolveAlert(alertId, 'Operator');
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to resolve alert', err);
    } finally {
      setProcessingId(null);
    }
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
          maxWidth: '800px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}
      >
        {/* Modal Header */}
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
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Operational Alerts &amp; Risk Monitor
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Real-time operational anomaly detection across trips, competitor shifts &amp; booking velocity
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="btn btn-secondary btn-sm"
              title="Refresh alerts"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
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
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'all'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: statusFilter === st ? '#2563eb' : '#f1f5f9',
                  color: statusFilter === st ? '#ffffff' : '#475569'
                }}
              >
                {st === 'all' ? 'All Alerts' : st}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto' }}
            >
              <option value="all">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>
        </div>

        {/* Alerts List */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alerts.length > 0 ? (
            alerts.map((alt) => {
              const isCrit = alt.severity === 'CRITICAL';
              const isWarn = alt.severity === 'WARNING';
              return (
                <div
                  key={alt.alert_id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#ffffff',
                    border: `1px solid ${isCrit ? '#fca5a5' : isWarn ? '#fcd34d' : '#93c5fd'}`,
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        className={`badge ${isCrit ? 'badge-invalid' : isWarn ? 'badge-medium' : 'badge-valid'}`}
                        style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                      >
                        {alt.severity}
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {alt.title}
                      </span>
                      {alt.trip_id && (
                        <span
                          onClick={() => {
                            if (onSelectTrip) {
                              onSelectTrip(alt.trip_id!);
                              onClose();
                            }
                          }}
                          style={{
                            fontSize: '0.75rem',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            textDecoration: 'underline'
                          }}
                          title="Open trip details"
                        >
                          <span>{alt.trip_id}</span>
                          <ExternalLink size={10} />
                        </span>
                      )}
                      {alt.seat_number && (
                        <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                          (Seat: {alt.seat_number})
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {new Date(alt.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                    {alt.message}
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(51, 65, 85, 0.3)', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      Status: <strong>{alt.status}</strong> {alt.acknowledged_by ? `(Ack by ${alt.acknowledged_by})` : ''}
                    </span>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {alt.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleAcknowledge(alt.alert_id)}
                          disabled={processingId === alt.alert_id}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                        >
                          Acknowledge
                        </button>
                      )}
                      {alt.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleResolve(alt.alert_id)}
                          disabled={processingId === alt.alert_id}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                        >
                          <CheckCircle2 size={12} />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
              <CheckCircle2 size={32} style={{ color: '#34d399', margin: '0 auto 8px', opacity: 0.8 }} />
              <div>No alerts matching the selected filters.</div>
              <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>All services are operating within normal parameters.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
