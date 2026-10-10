import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Check, 
  X, 
  SlidersHorizontal, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  History, 
  TrendingUp, 
  CheckCircle2, 
  Info,
  Calendar,
  MapPin,
  RefreshCw
} from 'lucide-react';
import type { Trip } from '../types';
import { api } from '../api';
import { DecisionModal } from './DecisionModal';

interface TripDetailProps {
  tripId: string;
  onBack: () => void;
  onRefreshList: () => void;
}

export const TripDetail: React.FC<TripDetailProps> = ({ tripId, onBack, onRefreshList }) => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Decision modal state
  const [decisionModalType, setDecisionModalType] = useState<'REJECTED' | 'OVERRIDDEN' | null>(null);

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getTrip(tripId);
      setTrip(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch trip details' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripDetails();
  }, [tripId]);

  const handleGenerateRecommendation = async () => {
    setGenerating(true);
    setFeedback(null);
    try {
      const rec = await api.generateRecommendation(tripId);
      // Refresh trip details so latest recommendation and audit events are up to date
      await fetchTripDetails();
      onRefreshList();
      if (rec.validation_status === 'BLOCKED') {
        setFeedback({
          type: 'error',
          message: 'Recommendation withheld by safety policy due to data-quality flags.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Generated rule-based recommendation: ₹${rec.recommended_fare}`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to generate recommendation' });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!trip?.latest_recommendation) return;
    setApproving(true);
    setFeedback(null);
    try {
      const res = await api.recordDecision({
        recommendation_id: trip.latest_recommendation.recommendation_id,
        decision_type: 'APPROVED',
        actor_label: 'Demo operator',
      });
      setFeedback({ type: 'success', message: res.feedback });
      await fetchTripDetails();
      onRefreshList();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Approval failed' });
    } finally {
      setApproving(false);
    }
  };

  const handleDecisionSaved = (msg: string) => {
    setFeedback({ type: 'success', message: msg });
    fetchTripDetails();
    onRefreshList();
  };

  if (loading && !trip) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading trip intelligence profile...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="card">
        <div className="notice-box notice-danger">
          <ShieldAlert size={20} />
          <div>Trip '{tripId}' could not be located in local database.</div>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Trips
        </button>
      </div>
    );
  }

  const rec = trip.latest_recommendation;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header / Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button id="btn-back-to-trips" className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>All Trips</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{trip.route_name}</h2>
              <span className={`badge badge-${trip.demand_category?.toLowerCase() || 'medium'}`}>
                {trip.demand_category} Demand
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '4px' }}>
              <span>ID: <strong>{trip.trip_id}</strong></span>
              <span>&bull;</span>
              <span>Bus Type: <strong>{trip.bus_type}</strong></span>
              <span>&bull;</span>
              <span>Distance: <strong>{trip.route_distance_km ? `${trip.route_distance_km} km` : 'N/A'}</strong></span>
            </div>
          </div>
        </div>

        <button
          id="btn-refresh-trip"
          className="btn btn-secondary btn-sm"
          onClick={fetchTripDetails}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Details</span>
        </button>
      </div>

      {/* User Action Feedback Banner */}
      {feedback && (
        <div className={`notice-box notice-${feedback.type === 'success' ? 'info' : 'danger'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <div>{feedback.message}</div>
        </div>
      )}

      {/* Validation or Stale Warning Banner if applicable */}
      {(!trip.is_valid || trip.is_stale) && (
        <div className={`notice-box notice-${trip.is_stale ? 'warning' : 'danger'}`} id="validation-warning-banner">
          <AlertTriangle size={20} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>
              {trip.is_stale ? 'Data Quality Warning: Stale Records' : 'Data Integrity Block: Invalid Record'}
            </div>
            <ul style={{ paddingLeft: '18px', fontSize: '0.82rem' }}>
              {trip.validation_issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', fontStyle: 'italic' }}>
              Safety Rule: Automated pricing recommendations are withheld until data values are corrected or refreshed.
            </div>
          </div>
        </div>
      )}

      {/* Overview Grid */}
      <div className="grid-cols-3">
        {/* Card 1: Seat Inventory */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Seat Inventory & Occupancy</div>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
              {trip.occupancy_percent}%
            </span>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div className="progress-container" style={{ height: '10px' }}>
              <div 
                className={`progress-fill ${trip.occupancy_percent < 30 ? 'low' : trip.occupancy_percent > 70 ? 'high' : 'medium'}`}
                style={{ width: `${Math.min(100, trip.occupancy_percent)}%` }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
            <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TOTAL</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{trip.total_seats}</div>
            </div>
            <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BOOKED</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{trip.booked_seats}</div>
            </div>
            <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VACANT</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{trip.available_seats}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Fare Limits and Current Price */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Fare Structure & Bounds</div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>INR (₹)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CURRENT OPERATING FARE</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
                ₹{trip.current_fare}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BASE FARE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>₹{trip.base_fare}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span>Configured Limits:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
              ₹{trip.min_fare} (Min) &mdash; ₹{trip.max_fare} (Max)
            </span>
          </div>
        </div>

        {/* Card 3: Route Schedule & Data Provenance */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Schedule & Provenance</div>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={14} style={{ color: '#38bdf8' }} />
              <span>{trip.origin} &rarr; {trip.destination}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} style={{ color: '#38bdf8' }} />
              <span>{new Date(trip.departure_time).toLocaleString()}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Source: <strong>{trip.data_source_label}</strong>
              <br />
              Updated: {new Date(trip.data_updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Snapshots History & Booking Pace */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Booking Pace & Timestamped Snapshots</div>
            <div className="card-subtitle">
              Pace is calculated strictly when &ge;2 snapshots exist. Never fabricated or guessed.
            </div>
          </div>
          <div>
            {trip.snapshots && trip.snapshots.length >= 2 ? (
              <span className="badge badge-valid">
                <TrendingUp size={12} /> {trip.snapshots.length} Snapshots Available
              </span>
            ) : (
              <span className="badge badge-stale">
                <Info size={12} /> Booking Pace Not Available
              </span>
            )}
          </div>
        </div>

        {trip.snapshots && trip.snapshots.length > 0 ? (
          <div>
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
              {trip.snapshots.map((snap, idx) => (
                <div 
                  key={snap.snapshot_id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(31, 41, 55, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    minWidth: '160px'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Snapshot #{idx + 1}
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', margin: '4px 0' }}>
                    {snap.booked_seats} seats
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {new Date(snap.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(snap.captured_at).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} style={{ color: '#34d399' }} />
              <span>
                Booking Pace Signal: <strong>{trip.latest_recommendation?.booking_pace_info || 'Evaluated during recommendation generation.'}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>
            No intermediate booking snapshots exist for this trip. Booking pace is reported as <strong>Not available</strong> and the rule classifier relies solely on verified occupancy.
          </div>
        )}
      </div>

      {/* Recommendation Engine Workspace */}
      <div className="card" style={{ border: '1px solid #38bdf8', boxShadow: 'var(--shadow-glow)' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ fontSize: '1.15rem' }}>
              <Sparkles size={20} style={{ color: '#38bdf8' }} />
              <span>Explainable Pricing Recommendation Engine</span>
            </div>
            <div className="card-subtitle">
              Generates deterministic recommendations within configured bounds with full factor transparency
            </div>
          </div>

          <button
            id="btn-generate-recommendation"
            className="btn btn-primary"
            onClick={handleGenerateRecommendation}
            disabled={generating}
          >
            <Sparkles size={16} className={generating ? 'animate-spin' : ''} />
            <span>{generating ? 'Calculating Rule Output...' : 'Generate Recommendation'}</span>
          </button>
        </div>

        {rec ? (
          rec.validation_status === 'BLOCKED' ? (
            <div className="notice-box notice-danger">
              <ShieldAlert size={20} />
              <div>
                <strong>Recommendation Blocked:</strong> {rec.explanation}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Proposed Fare Spotlight */}
              <div 
                style={{
                  background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(99, 102, 241, 0.08))',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '20px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    SUGGESTED SEAT FARE
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '6px' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#38bdf8' }}>
                      ₹{rec.recommended_fare}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: rec.fare_difference >= 0 ? '#34d399' : '#fb7185' }}>
                      {rec.fare_difference >= 0 ? `+₹${rec.fare_difference}` : `-₹${Math.abs(rec.fare_difference)}`}{' '}
                      ({rec.fare_difference_pct >= 0 ? `+${rec.fare_difference_pct}%` : `${rec.fare_difference_pct}%`})
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Suggested Fare Band: <strong>₹{rec.contributing_factors?.suggested_band?.low || rec.min_fare} &ndash; ₹{rec.contributing_factors?.suggested_band?.high || rec.max_fare}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>CURRENT OPERATING FARE</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, textDecoration: rec.fare_difference !== 0 ? 'line-through' : 'none', color: 'var(--text-muted)' }}>
                    ₹{rec.current_fare_at_generation}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px' }}>
                    Policy Rule: {rec.rule_applied}
                  </div>
                </div>
              </div>

              {/* Clamping indicator if limit was hit */}
              {rec.is_clamped && (
                <div className="notice-box notice-warning">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Fare Floor / Ceiling Clamped:</strong> {rec.clamped_reason}
                  </div>
                </div>
              )}

              {/* Factor Breakdown & Explanation Narrative */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  REASONING &amp; CONTRIBUTING SIGNALS
                </div>
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                  {rec.explanation}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', fontSize: '0.78rem' }}>
                    Demand Category: <strong>{rec.demand_category}</strong>
                  </div>
                  <div style={{ padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', fontSize: '0.78rem' }}>
                    Occupancy at Generation: <strong>{trip.occupancy_percent}%</strong>
                  </div>
                  <div style={{ padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', fontSize: '0.78rem' }}>
                    Rule Adjustment: <strong>{rec.contributing_factors?.adjustment_pct}%</strong>
                  </div>
                  <div style={{ padding: '6px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', fontSize: '0.78rem' }}>
                    Rounding Rule: <strong>Nearest ₹10</strong>
                  </div>
                </div>
              </div>

              {/* Decision Support Notice */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                {rec.notice}
              </div>

              {/* Operator Decision Actions / Status */}
              {(() => {
                const existingDecision = trip.decisions?.find((d) => d.recommendation_id === rec.recommendation_id);
                if (existingDecision) {
                  const isRej = existingDecision.decision_type === 'REJECTED';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                        <CheckCircle2 size={18} style={{ color: isRej ? '#ef4444' : '#10b981' }} />
                        <span>
                          Decision recorded: <strong style={{ color: isRej ? '#ef4444' : '#10b981' }}>{existingDecision.decision_type}</strong>
                          {existingDecision.decision_fare ? ` (₹${existingDecision.decision_fare})` : ''} by <strong>{existingDecision.actor_label}</strong> on {new Date(existingDecision.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(existingDecision.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}).
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        To evaluate new pricing, click <strong>Generate Recommendation</strong> above.
                      </span>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                    <button
                      id="btn-reject-recommendation"
                      className="btn btn-danger"
                      onClick={() => setDecisionModalType('REJECTED')}
                    >
                      <X size={16} />
                      <span>Reject</span>
                    </button>

                    <button
                      id="btn-override-recommendation"
                      className="btn btn-secondary"
                      onClick={() => setDecisionModalType('OVERRIDDEN')}
                    >
                      <SlidersHorizontal size={16} />
                      <span>Manual Override</span>
                    </button>

                    <button
                      id="btn-approve-recommendation"
                      className="btn btn-success"
                      onClick={handleApprove}
                      disabled={approving}
                    >
                      <Check size={16} />
                      <span>{approving ? 'Recording Approval...' : `Approve Suggested Fare (₹${rec.recommended_fare})`}</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          )
        ) : (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Sparkles size={28} style={{ color: '#38bdf8', marginBottom: '8px', opacity: 0.8 }} />
            <div>No pricing recommendation currently active for this trip.</div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Click <strong>Generate Recommendation</strong> above to evaluate real-time demand rules.
            </div>
          </div>
        )}
      </div>

      {/* Operator Decision History for this Trip */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <History size={18} />
            <span>Trip Decision Audit History</span>
          </div>
          <div className="card-subtitle">
            Persisted review log of all approvals, rejections, and manual overrides
          </div>
        </div>

        {trip.decisions && trip.decisions.length > 0 ? (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Decision Type</th>
                  <th>Approved/Override Fare</th>
                  <th>Rationale</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {trip.decisions.map((dec) => (
                  <tr key={dec.decision_id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(dec.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge badge-${dec.decision_type === 'APPROVED' ? 'medium' : dec.decision_type === 'OVERRIDDEN' ? 'low' : 'invalid'}`}>
                        {dec.decision_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {dec.decision_fare ? `₹${dec.decision_fare}` : 'N/A (Rejected)'}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {dec.reason || 'None specified'}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {dec.actor_label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No operator decisions have been recorded for this trip yet.
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {decisionModalType && rec && (
        <DecisionModal
          recommendation={rec}
          decisionType={decisionModalType}
          onClose={() => setDecisionModalType(null)}
          onDecisionSaved={handleDecisionSaved}
        />
      )}
    </div>
  );
};
