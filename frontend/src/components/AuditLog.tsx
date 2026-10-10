import React, { useEffect, useState } from 'react';
import { Filter, Search, RotateCw, X, Eye } from 'lucide-react';
import type { AuditEvent } from '../types';
import { api } from '../api';

export const AuditLog: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState('all');
  const [searchTrip, setSearchTrip] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const fetchAuditEvents = async () => {
    try {
      setLoading(true);
      const [evts, types] = await Promise.all([
        api.listAuditEvents({
          trip_id: searchTrip.trim() || undefined,
          event_type: selectedType !== 'all' ? selectedType : undefined,
          limit: 150,
        }),
        api.listAuditEventTypes(),
      ]);
      setEvents(evts);
      setEventTypes(types);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, [selectedType, searchTrip]);

  const getBadgeColor = (type: string) => {
    if (type.includes('APPROVED')) return 'badge-valid';
    if (type.includes('BLOCKED')) return 'badge-invalid';
    if (type.includes('OVERRIDDEN')) return 'badge-low';
    if (type.includes('REJECTED')) return 'badge-stale';
    return 'badge-medium';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Filter and Search Bar */}
      <div className="card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Trip */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search 
              size={18} 
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} 
            />
            <input
              id="audit-search-trip-input"
              className="input"
              style={{ width: '100%', paddingLeft: '38px' }}
              placeholder="Filter by Trip ID (e.g. TRIP-MUM-PUN-404)..."
              value={searchTrip}
              onChange={(e) => setSearchTrip(e.target.value)}
            />
          </div>

          {/* Event Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              id="audit-event-type-filter"
              className="select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">All Event Types</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={fetchAuditEvents} disabled={loading}>
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="card-title">Audit Log Trail ({events.length} Events)</div>
            <div className="card-subtitle">Chronological record of pricing runs, operator decisions, and validation guards</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading audit trail...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>No audit events found</div>
            <div style={{ fontSize: '0.85rem' }}>Try clearing trip filters or generating recommendations on trips.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Trip ID</th>
                  <th>Fares (Prev &rarr; Target)</th>
                  <th>Rationale / Note</th>
                  <th>Actor & Version</th>
                  <th style={{ textAlign: 'right' }}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.audit_id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(evt.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${getBadgeColor(evt.event_type)}`}>
                        {evt.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                        {evt.trip_id}
                      </span>
                    </td>
                    <td>
                      {evt.final_decision_fare ? (
                        <span>
                          ₹{evt.previous_fare || '—'} &rarr; <strong style={{ color: '#34d399' }}>₹{evt.final_decision_fare}</strong>
                        </span>
                      ) : evt.recommended_fare ? (
                        <span>
                          ₹{evt.previous_fare || '—'} &rarr; <strong style={{ color: '#38bdf8' }}>₹{evt.recommended_fare}</strong>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', maxWidth: '300px' }}>
                      {evt.reason || 'None specified'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div>{evt.actor_label}</div>
                      <div style={{ color: 'var(--text-dim)' }}>{evt.rule_version}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedEvent(evt)}
                        title="View raw payload"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payload Inspection Modal */}
      {selectedEvent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">Audit Record Details</div>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedEvent(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div><strong>Audit ID:</strong> {selectedEvent.audit_id}</div>
              <div><strong>Event:</strong> {selectedEvent.event_type}</div>
              <div><strong>Trip ID:</strong> {selectedEvent.trip_id}</div>
              <div><strong>Recorded At:</strong> {selectedEvent.created_at}</div>
              <div><strong>Actor:</strong> {selectedEvent.actor_label}</div>
              <div><strong>Reason:</strong> {selectedEvent.reason}</div>

              {selectedEvent.details && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>Raw Details Payload:</div>
                  <pre 
                    style={{
                      background: 'var(--bg-input)',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      overflowX: 'auto',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedEvent.details), null, 2);
                      } catch {
                        return selectedEvent.details;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
