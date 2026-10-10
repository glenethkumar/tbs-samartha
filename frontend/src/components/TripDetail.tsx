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
  TrendingDown,
  Minus,
  CheckCircle2, 
  Info, 
  Calendar, 
  MapPin, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Building2,
  Upload,
  FileSpreadsheet,
  RotateCcw,
  Star
} from 'lucide-react';
import type { Trip, CompetitorPriceSummary, CompetitorCsvImportResult } from '../types';
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
  const [whyExpanded, setWhyExpanded] = useState(true);

  // Competitor pricing state
  const [competitorSummary, setCompetitorSummary] = useState<CompetitorPriceSummary | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvResult, setCsvResult] = useState<CompetitorCsvImportResult | null>(null);
  const [resettingSample, setResettingSample] = useState(false);

  // Decision modal state
  const [decisionModalType, setDecisionModalType] = useState<'REJECTED' | 'OVERRIDDEN' | null>(null);

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getTrip(tripId);
      setTrip(data);

      try {
        const comp = await api.getTripCompetitors(tripId);
        setCompetitorSummary(comp);
      } catch {
        if (data.latest_recommendation?.competitor_summary) {
          setCompetitorSummary(data.latest_recommendation.competitor_summary);
        }
      }
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
        const actionStr = rec.recommended_action ? ` [${rec.recommended_action.toUpperCase()}]` : '';
        setFeedback({
          type: 'success',
          message: `Generated rule-based recommendation${actionStr}: ₹${rec.recommended_fare}`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to generate recommendation' });
    } finally {
      setGenerating(false);
    }
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      setFeedback({ type: 'error', message: 'Please provide CSV content to import' });
      return;
    }
    setImportingCsv(true);
    setCsvResult(null);
    try {
      const res = await api.importCompetitorCsv(csvText);
      setCsvResult(res);
      setFeedback({
        type: 'success',
        message: `Successfully imported ${res.records_imported} competitor listings (${res.records_rejected} skipped).`
      });
      await fetchTripDetails();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to import CSV' });
    } finally {
      setImportingCsv(false);
    }
  };

  const handleResetSampleCompetitors = async () => {
    setResettingSample(true);
    try {
      const res = await api.resetCompetitorSample();
      setFeedback({
        type: 'success',
        message: `Reset competitor catalog: ${res.count} verified Indian fleet listings seeded.`
      });
      await fetchTripDetails();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reset competitor sample data' });
    } finally {
      setResettingSample(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) setCsvText(text);
    };
    reader.readAsText(file);
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

      {/* Competitor Market Intelligence (RedBus & AbhiBus) Card */}
      <div className="card" style={{ border: '1px solid rgba(245, 158, 11, 0.35)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="card-title" style={{ fontSize: '1.15rem' }}>
                <Building2 size={20} style={{ color: '#f59e0b' }} />
                <span>Competitor Market Price Intelligence</span>
              </div>
              <span 
                className="badge badge-medium" 
                style={{ 
                  fontSize: '0.72rem', 
                  backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                  color: '#f59e0b', 
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontWeight: 700 
                }}
              >
                RedBus &amp; AbhiBus Corridors
              </span>
            </div>
            <div className="card-subtitle">
              Live corridor rates for {trip.origin} &rarr; {trip.destination} within &plusmn;3h departure window and compatible {trip.bus_type} fleet.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              id="btn-import-competitor-csv"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsCsvModalOpen(true)}
              title="Upload custom market rate sheet CSV"
            >
              <Upload size={14} />
              <span>Import Rate Sheet</span>
            </button>

            <button
              id="btn-reset-sample-competitors"
              className="btn btn-secondary btn-sm"
              onClick={handleResetSampleCompetitors}
              disabled={resettingSample}
              title="Reset to 55 seeded RedBus & AbhiBus listings across 11 routes"
            >
              <RotateCcw size={14} className={resettingSample ? 'animate-spin' : ''} />
              <span>{resettingSample ? 'Resetting...' : 'Reset Sample'}</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        {competitorSummary && competitorSummary.sample_size > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Prominent Market Price Comparison Conclusion Box */}
            {(() => {
              const conclusionAction = competitorSummary.conclusion_action || (
                (competitorSummary.current_fare_diff_vs_median_pct ?? 0) < -5.0 ? 'Increase fare' :
                (competitorSummary.current_fare_diff_vs_median_pct ?? 0) > 8.0 ? 'Decrease fare' :
                'Maintain fare'
              );
              const isInc = conclusionAction === 'Increase fare';
              const isDec = conclusionAction === 'Decrease fare';
              const actionColor = isInc ? '#10b981' : isDec ? '#f43f5e' : '#38bdf8';
              const bgGradient = isInc
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(6, 78, 59, 0.28))'
                : isDec
                ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.16), rgba(136, 19, 55, 0.28))'
                : 'linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(30, 58, 138, 0.28))';

              return (
                <div 
                  id="competitor-price-conclusion-card"
                  style={{
                    background: bgGradient,
                    border: `2px solid ${actionColor}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '20px 24px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <span 
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 800,
                          padding: '6px 18px',
                          borderRadius: '9999px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: actionColor,
                          color: '#ffffff',
                          boxShadow: '0 3px 10px rgba(0,0,0,0.35)'
                        }}
                      >
                        {isInc && <TrendingUp size={20} />}
                        {isDec && <TrendingDown size={20} />}
                        {!isInc && !isDec && <Minus size={20} />}
                        <span>CONCLUSION: {conclusionAction.toUpperCase()}</span>
                      </span>

                      <span style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {competitorSummary.conclusion_headline || (
                          isInc ? `Price Should Be INCREASED (Our fare is lower than market median)` :
                          isDec ? `Price Should Be DECREASED (Our fare is higher than competitor median)` :
                          `Price Should Be MAINTAINED (Our fare matches market parity)`
                        )}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        Evaluated across {competitorSummary.sample_size} listings on {competitorSummary.platforms_represented.join(' & ') || 'RedBus & AbhiBus'}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '10px' }}>
                    <strong>Market Analysis &amp; Action Rationale: </strong>
                    {competitorSummary.conclusion_reason || (
                      `Comparing our operating fare (₹${trip.current_fare}) against competitor rates on RedBus and AbhiBus (Market Median: ₹${competitorSummary.median_fare}, range ₹${competitorSummary.min_fare}–₹${competitorSummary.max_fare}) ` +
                      `proves that our tickets are ${competitorSummary.current_fare_diff_vs_median !== undefined && competitorSummary.current_fare_diff_vs_median !== null ? `${Math.abs(competitorSummary.current_fare_diff_vs_median_pct || 0)}% ${competitorSummary.current_fare_diff_vs_median < 0 ? 'below' : 'above'}` : 'at'} market parity. ` +
                      `Consequently, the algorithm concludes that the ticket price should be ${conclusionAction.toLowerCase()}.`
                    )}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {/* Metric 1: Median Fare */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  MARKET MEDIAN FARE
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                  ₹{competitorSummary.median_fare}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Market Spread: <strong>₹{competitorSummary.min_fare} &ndash; ₹{competitorSummary.max_fare}</strong> ({competitorSummary.sample_size} listings)
                </div>
              </div>

              {/* Metric 2: Our Market Position */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  OUR POSITION VS MEDIAN
                </div>
                <div 
                  style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 800, 
                    marginTop: '4px', 
                    color: (competitorSummary.current_fare_diff_vs_median ?? 0) < 0 
                      ? '#34d399' 
                      : (competitorSummary.current_fare_diff_vs_median ?? 0) > 0 
                      ? '#fb7185' 
                      : '#38bdf8' 
                  }}
                >
                  {competitorSummary.current_fare_diff_vs_median !== undefined && competitorSummary.current_fare_diff_vs_median !== null ? (
                    `${competitorSummary.current_fare_diff_vs_median >= 0 ? '+' : ''}₹${competitorSummary.current_fare_diff_vs_median} (${competitorSummary.current_fare_diff_vs_median_pct}%)`
                  ) : '₹0'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginTop: '4px' }}>
                  Status: <span style={{ fontWeight: 600 }}>{competitorSummary.market_position}</span>
                </div>
              </div>

              {/* Metric 3: Lowest Listed */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  LOWEST MARKET FARE
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                  ₹{competitorSummary.cheapest_fare ?? 'N/A'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {competitorSummary.cheapest_operator || 'Operator'} &bull; <span style={{ color: '#fb7185' }}>{competitorSummary.cheapest_platform || 'RedBus'}</span>
                </div>
              </div>

              {/* Metric 4: Premium Listed */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  PREMIUM MARKET FARE
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>
                  ₹{competitorSummary.premium_fare ?? 'N/A'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {competitorSummary.premium_operator || 'Operator'} &bull; <span style={{ color: '#fbbf24' }}>{competitorSummary.premium_platform || 'AbhiBus'}</span>
                </div>
              </div>
            </div>

            {/* Comparable Competitor Listings Table */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span>Comparable RedBus &amp; AbhiBus Listings on this Route</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                  Platforms represented: {competitorSummary.platforms_represented.join(', ') || 'RedBus, AbhiBus'}
                </span>
              </div>

              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th>Operator</th>
                      <th>Platform</th>
                      <th>Bus Type</th>
                      <th>Departure Time</th>
                      <th>Available Seats</th>
                      <th>Rating</th>
                      <th>Fare (₹)</th>
                      <th>Vs Our Fare (₹{trip.current_fare})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorSummary.comparable_competitors.map((item) => {
                      const fareDiff = item.fare - trip.current_fare;
                      return (
                        <tr key={item.competitor_fare_id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.operator_name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{item.origin} &rarr; {item.destination}</div>
                          </td>
                          <td>
                            <span 
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: 700,
                                backgroundColor: item.platform === 'RedBus' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: item.platform === 'RedBus' ? '#f87171' : '#fbbf24',
                                border: `1px solid ${item.platform === 'RedBus' ? '#ef4444' : '#f59e0b'}40`
                              }}
                            >
                              {item.platform}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{item.bus_type}</td>
                          <td>
                            <div>{new Date(item.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                              {new Date(item.departure_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: item.available_seats < 10 ? '#fb7185' : '#34d399' }}>
                              {item.available_seats} seats
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Star size={13} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
                              <span style={{ fontWeight: 600 }}>{item.rating}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>({item.review_count})</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f59e0b' }}>
                            ₹{item.fare}
                          </td>
                          <td style={{ fontWeight: 600, color: fareDiff > 0 ? '#34d399' : fareDiff < 0 ? '#fb7185' : 'var(--text-muted)' }}>
                            {fareDiff > 0 ? `+₹${fareDiff}` : fareDiff < 0 ? `-₹${Math.abs(fareDiff)}` : 'Parity (₹0)'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Synthetic Demo Labeling / Data Privacy Policy Notice */}
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f59e0b', fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              <strong>Compliance &amp; Data Transparency:</strong> RedBus (SeatSeller) and AbhiBus are closed partner APIs requiring NDA contracts. In strict accordance with platform policies, the above competitor records reflect verified Indian private operator route structures (VRL, SRS, Orange, Parveen, Kallada) tagged as <code>is_simulated = true</code> for demonstrative benchmarking. Operators may upload proprietary live market rate sheets via the "Import Rate Sheet" button above.
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Building2 size={28} style={{ color: '#f59e0b', marginBottom: '8px', opacity: 0.6 }} />
            <div>No comparable RedBus or AbhiBus competitor fares found for this departure window (&plusmn;3h).</div>
            <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>
              Click <strong>Reset Sample</strong> above to seed realistic operator listings, or upload a custom rate sheet CSV.
            </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. Evidence-Quality Status Badge & Integrity Header */}
            {(() => {
              const details = rec.evidence_quality_details || rec.contributing_factors?.evidence_details;
              const evidenceStatus = rec.evidence_quality_status || details?.status || (
                rec.validation_status === 'BLOCKED'
                  ? 'Insufficient data'
                  : (trip.snapshots && trip.snapshots.length >= 2 ? 'Strong data' : 'Limited data')
              );

              const isStrong = evidenceStatus === 'Strong data';
              const isLimited = evidenceStatus === 'Limited data';
              const isInsufficient = evidenceStatus === 'Insufficient data' || rec.validation_status === 'BLOCKED';

              const badgeColor = isStrong ? '#10b981' : isLimited ? '#f59e0b' : '#ef4444';
              const bgGradient = isStrong
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 78, 59, 0.08))'
                : isLimited
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(120, 53, 15, 0.08))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(127, 29, 29, 0.08))';

              return (
                <div 
                  style={{
                    background: bgGradient,
                    border: `1px solid ${badgeColor}40`,
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span 
                        className={`badge ${isStrong ? 'badge-valid' : isLimited ? 'badge-stale' : 'badge-invalid'}`}
                        style={{ fontSize: '0.85rem', padding: '6px 12px', fontWeight: 700 }}
                      >
                        {isStrong && <ShieldCheck size={16} />}
                        {isLimited && <Info size={16} />}
                        {isInsufficient && <ShieldAlert size={16} />}
                        <span>Evidence Quality: {evidenceStatus}</span>
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {isStrong && 'Verified fresh inputs (≤24h) & multi-point booking pace observed.'}
                        {isLimited && 'Verified fresh core inputs (≤24h); optional historical booking pace snapshots missing.'}
                        {isInsufficient && 'Required inputs missing, invalid, or stale (>24h). Recommendation blocked.'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      Deterministic rule-based evidence verification (no arbitrary AI confidence % or ML guessing)
                    </div>
                  </div>

                  <div style={{ fontSize: '0.83rem', color: 'var(--text-main)', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    <strong>Evidence Status Assessment:</strong> {rec.evidence_quality_explanation || details?.explanation || rec.explanation}
                  </div>
                </div>
              );
            })()}

            {rec.validation_status === 'BLOCKED' ? (
              <div className="notice-box notice-danger">
                <ShieldAlert size={20} />
                <div>
                  <strong>Recommendation Blocked by Safety Policy:</strong> {rec.explanation}
                </div>
              </div>
            ) : (
              <>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        SUGGESTED SEAT FARE
                      </div>
                      {/* Strategic Recommended Action Pill */}
                      {rec.recommended_action && (
                        <span 
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            padding: '4px 14px',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: rec.recommended_action === 'Increase fare' 
                              ? '#10b981' 
                              : rec.recommended_action === 'Decrease fare' 
                              ? '#f43f5e' 
                              : '#0284c7',
                            color: '#ffffff',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                          }}
                        >
                          {rec.recommended_action === 'Increase fare' && <TrendingUp size={15} />}
                          {rec.recommended_action === 'Decrease fare' && <TrendingDown size={15} />}
                          {rec.recommended_action === 'Maintain fare' && <Minus size={15} />}
                          <span>CONCLUSION: {rec.recommended_action.toUpperCase()}</span>
                        </span>
                      )}
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
              </>
            )}

            {/* Expandable "Why this recommendation?" Section */}
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <button
                id="btn-toggle-why-recommendation"
                type="button"
                onClick={() => setWhyExpanded(!whyExpanded)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.92rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={18} style={{ color: '#38bdf8' }} />
                  <span>Why this recommendation?</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                    8-Point Evidence, Competitor &amp; Policy Audit
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.82rem' }}>
                  <span>{whyExpanded ? 'Hide Details' : 'Expand Explanation'}</span>
                  {whyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {whyExpanded && (() => {
                const details = rec.evidence_quality_details || rec.contributing_factors?.evidence_details;
                const evidenceStatus = rec.evidence_quality_status || details?.status || (
                  rec.validation_status === 'BLOCKED'
                    ? 'Insufficient data'
                    : (trip.snapshots && trip.snapshots.length >= 2 ? 'Strong data' : 'Limited data')
                );
                return (
                  <div style={{ padding: '20px', backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Primary narrative summary */}
                    <div style={{ padding: '14px 18px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', lineHeight: 1.6, fontSize: '0.88rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        EXPLANATION NARRATIVE
                      </div>
                      {rec.explanation}
                    </div>

                    {/* 6 Structured Dimension Cards */}
                    <div className="grid-cols-2" style={{ gap: '14px' }}>
                      {/* Dimension 1: Occupancy & Threshold */}
                      <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          1. OCCUPANCY &amp; THRESHOLD
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                          {trip.occupancy_percent}% Occupancy
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '4px' }}>
                          Threshold Used: <strong>{details?.occupancy?.threshold_used || (trip.occupancy_percent < 30 ? '< 30.0% (Low Demand tier)' : trip.occupancy_percent > 70 ? '> 70.0% (High Demand tier)' : '30.0% - 70.0% (Medium Demand tier)')}</strong>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                          Classified Tier: <strong>{rec.demand_category} Demand</strong> ({trip.booked_seats} of {trip.total_seats} seats booked)
                        </div>
                      </div>

                      {/* Dimension 2: Booking Pace & Observation Window */}
                      <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          2. BOOKING PACE &amp; OBSERVATION WINDOW
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: details?.booking_pace?.available ? '#34d399' : '#fbbf24', marginTop: '4px' }}>
                          {details?.booking_pace?.available ? `${details.booking_pace.pace_per_hour} seats/hr` : 'Pace Not Available'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '4px' }}>
                          Observation Window: <strong>{details?.booking_pace?.observation_window || details?.booking_pace?.description || rec.booking_pace_info}</strong>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                          Snapshots Evaluated: <strong>{details?.booking_pace?.snapshots_evaluated ?? (trip.snapshots?.length || 0)} timestamped records</strong> (Min 2 required)
                        </div>
                      </div>

                      {/* Dimension 3: Departure Horizon */}
                      <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          3. TIME UNTIL DEPARTURE
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                          {details?.departure?.label || `${new Date(trip.departure_time).toLocaleDateString()}`}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '4px' }}>
                          Scheduled Departure: <strong>{new Date(trip.departure_time).toLocaleString()}</strong>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                          Hours Remaining: <strong>{details?.departure?.hours_remaining !== undefined && details?.departure?.hours_remaining !== null ? `${details.departure.hours_remaining} hours` : 'Scheduled'}</strong>
                        </div>
                      </div>

                      {/* Dimension 4: Last Data Update & Freshness */}
                      <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          4. DATA FRESHNESS &amp; LAST UPDATE
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: trip.is_stale ? '#ef4444' : '#34d399', marginTop: '4px' }}>
                          {trip.is_stale ? 'Data Stale (>24h)' : 'Fresh (Within 24h SLA)'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '4px' }}>
                          Last Successful Update: <strong>{new Date(trip.data_updated_at).toLocaleString()}</strong>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                          Age: <strong>{details?.data_freshness?.age_hours !== undefined ? `${details.data_freshness.age_hours}h ago` : 'Verified'}</strong> (Configured Freshness SLA: 24.0h)
                        </div>
                      </div>

                      {/* Dimension 5: Missing / Stale / Invalid Inputs */}
                      <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          5. INPUT VALIDATION &amp; INTEGRITY
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: trip.validation_issues.length === 0 ? '#34d399' : '#ef4444', marginTop: '4px' }}>
                          {trip.validation_issues.length === 0 ? 'All 8 Schema Fields Valid' : `${trip.validation_issues.length} Issue(s) Detected`}
                        </div>
                        {trip.validation_issues.length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: '#34d399', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Check size={14} /> Zero missing, stale, or contradictory inputs.
                          </div>
                        ) : (
                          <ul style={{ paddingLeft: '16px', margin: '4px 0 0 0', fontSize: '0.78rem', color: '#fb7185' }}>
                            {trip.validation_issues.map((issue, idx) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        )}
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                          Data Source: <strong>{trip.data_source_label}</strong>
                        </div>
                      </div>

                      {/* Dimension 6: Fare Constraints & Clamping */}
                      <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          6. FARE CONSTRAINTS &amp; CLAMPING
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: rec.is_clamped ? '#fbbf24' : '#38bdf8', marginTop: '4px' }}>
                          ₹{trip.min_fare} (Min) &ndash; ₹{trip.max_fare} (Max)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '4px' }}>
                          Proposed Fare: <strong>₹{rec.recommended_fare}</strong> (Base: ₹{rec.base_fare_at_generation})
                        </div>
                        <div style={{ fontSize: '0.74rem', color: rec.is_clamped ? '#fbbf24' : 'var(--text-dim)', marginTop: '4px' }}>
                          {rec.is_clamped ? `Clamped: ${rec.clamped_reason}` : 'Within permitted bounds (no clamping required)'}
                        </div>
                      </div>
                    </div>

                    {/* Dimension 7: Applied Rules Breakdown */}
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                        7. POLICY RULES AFFECTING RECOMMENDATION
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#38bdf8' }}>&bull;</span>
                          <span><strong>Demand Classification:</strong> {rec.demand_category} Demand tier derived from {trip.occupancy_percent}% occupancy.</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#38bdf8' }}>&bull;</span>
                          <span><strong>Pricing Policy Rule:</strong> {rec.rule_applied}.</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#38bdf8' }}>&bull;</span>
                          <span><strong>Currency Rounding:</strong> Bounded raw fare rounded to the nearest ₹10 increment.</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#38bdf8' }}>&bull;</span>
                          <span><strong>Evidence Quality:</strong> Status evaluated as <strong>{evidenceStatus}</strong> without heuristic ML probabilities.</span>
                        </div>
                      </div>
                    </div>

                    {/* Dimension 8: Competitor Market Benchmark */}
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.74rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={14} />
                        <span>8. COMPETITOR MARKET BENCHMARK (REDBUS &amp; ABHIBUS)</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.82rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Market Median: </span>
                          <strong style={{ color: '#f59e0b' }}>
                            {rec.contributing_factors?.competitor_benchmark?.median_fare !== undefined && rec.contributing_factors?.competitor_benchmark?.median_fare !== null
                              ? `₹${rec.contributing_factors.competitor_benchmark.median_fare}`
                              : competitorSummary?.median_fare ? `₹${competitorSummary.median_fare}` : 'No listings'}
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginLeft: '6px' }}>
                            (Range: ₹{rec.contributing_factors?.competitor_benchmark?.min_fare ?? competitorSummary?.min_fare ?? 0} &ndash; ₹{rec.contributing_factors?.competitor_benchmark?.max_fare ?? competitorSummary?.max_fare ?? 0})
                          </span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Operator Position: </span>
                          <strong style={{ color: '#38bdf8' }}>
                            {rec.contributing_factors?.competitor_benchmark?.market_position || competitorSummary?.market_position || 'Benchmark active'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Strategic Action: </span>
                          <strong style={{ color: rec.recommended_action === 'Increase fare' ? '#34d399' : rec.recommended_action === 'Decrease fare' ? '#fb7185' : '#38bdf8' }}>
                            {rec.recommended_action || 'Maintain fare'}
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginLeft: '6px' }}>
                            (Synthesis of Occupancy &amp; Competitor Median)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Decision Support Notice */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              {rec.notice}
            </div>

            {/* Operator Decision Actions / Status */}
            {rec.validation_status !== 'BLOCKED' && (() => {
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

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
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
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setIsCsvModalOpen(false)}
        >
          <div 
            className="card" 
            style={{ 
              maxWidth: '640px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={20} style={{ color: '#f59e0b' }} />
                <div className="card-title" style={{ fontSize: '1.2rem' }}>Import Competitor Rate Sheet (CSV)</div>
              </div>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setIsCsvModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
              Upload or paste market fares from RedBus, AbhiBus, or private GDS feeds. Imported fares will immediately calibrate competitor medians and market positioning for matching routes and departure windows.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                  Select CSV File:
                </label>
                <input 
                  type="file" 
                  accept=".csv,text/csv" 
                  onChange={handleFileUpload}
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    width: '100%',
                    backgroundColor: 'var(--bg-input)'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Or Paste CSV Content:
                  </label>
                  <button 
                    type="button"
                    style={{ fontSize: '0.72rem', color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      setCsvText(`origin,destination,departure_time,bus_type,operator_name,platform,fare,available_seats,rating
${trip.origin},${trip.destination},${trip.departure_time},${trip.bus_type},SRS Travels,RedBus,${Math.round(trip.current_fare * 1.05)},14,4.3
${trip.origin},${trip.destination},${trip.departure_time},${trip.bus_type},Orange Tours,AbhiBus,${Math.round(trip.current_fare * 1.1)},18,4.5
${trip.origin},${trip.destination},${trip.departure_time},${trip.bus_type},VRL Travels,RedBus,${Math.round(trip.current_fare * 0.95)},10,4.6`);
                    }}
                  >
                    Insert Example Template
                  </button>
                </div>
                <textarea 
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="origin,destination,departure_time,bus_type,operator_name,platform,fare,available_seats,rating..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              {csvResult && (
                <div className={`notice-box notice-${csvResult.success ? 'info' : 'danger'}`}>
                  {csvResult.success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <div>
                    <div>{csvResult.message}</div>
                    {csvResult.errors && csvResult.errors.length > 0 && (
                      <div style={{ marginTop: '6px', fontSize: '0.75rem' }}>
                        <strong>Skipped row notes:</strong>
                        <ul style={{ paddingLeft: '14px', margin: '4px 0 0 0' }}>
                          {csvResult.errors.slice(0, 3).map((err: string, i: number) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button 
                  className="btn btn-secondary"
                  onClick={() => setIsCsvModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleImportCsv}
                  disabled={importingCsv || !csvText.trim()}
                  style={{ backgroundColor: '#f59e0b', borderColor: '#d97706', color: '#111827' }}
                >
                  <Upload size={16} className={importingCsv ? 'animate-spin' : ''} />
                  <span>{importingCsv ? 'Importing Rows...' : 'Import Rate Sheet'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
