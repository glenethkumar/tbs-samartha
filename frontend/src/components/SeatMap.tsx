import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  Lock, 
  SlidersHorizontal,
  Coins,
  Star,
  Clock,
  ShieldCheck,
  Compass
} from 'lucide-react';
import type { 
  Trip,
  TripSeat, 
  SeatRecommendation, 
  TripFinancials, 
  SeatMapData,
  TripFinancialScenario
} from '../types';
import { api } from '../api';

interface SeatMapProps {
  tripId: string;
  trip?: Trip | null;
  seatData: SeatMapData;
  financials: TripFinancials | null;
  onRefresh: () => void;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  tripId,
  trip,
  seatData,
  financials,
  onRefresh,
}) => {
  const activeTrip = trip || seatData.trip;
  const [selectedDeck, setSelectedDeck] = useState<string>(seatData.decks_available[0] || 'lower');
  const [selectedSeat, setSelectedSeat] = useState<TripSeat | null>(null);
  const [posFilter, setPosFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [arrFilter, setArrFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedScenario, setSelectedScenario] = useState<string>('Base Case');

  // Override modal state
  const [overrideModalSeat, setOverrideModalSeat] = useState<TripSeat | null>(null);
  const [overrideFare, setOverrideFare] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Map recommendation by seat_id
  const recsBySeatId: Record<string, SeatRecommendation> = {};
  seatData.seat_recommendations.forEach((r) => {
    recsBySeatId[r.seat_id] = r;
  });

  const seatsOnDeck = seatData.seats.filter((s) => s.deck === selectedDeck);

  // Filter seats
  const filteredSeats = seatsOnDeck.filter((s) => {
    if (posFilter !== 'all' && s.position !== posFilter) return false;
    if (typeFilter !== 'all') {
      if (typeFilter === 'lower' && s.berth_type !== 'lower') return false;
      if (typeFilter === 'upper' && s.berth_type !== 'upper') return false;
      if (typeFilter === 'sitting' && s.seat_type !== 'sitting') return false;
      if (typeFilter === 'sleeper' && s.seat_type !== 'sleeper') return false;
    }
    if (arrFilter !== 'all') {
      if (arrFilter === 'single' && s.sleeper_arrangement !== 'single') return false;
      if (arrFilter === 'sharing' && s.sleeper_arrangement !== 'sharing') return false;
      if (arrFilter === 'sitting' && s.seat_type !== 'sitting') return false;
    }
    if (statusFilter !== 'all' && s.booking_status !== statusFilter) return false;
    return true;
  });

  // Calculate deck grid structure (group by row_idx)
  const rowsMap: Record<number, TripSeat[]> = {};
  filteredSeats.forEach((s) => {
    if (!rowsMap[s.row_idx]) rowsMap[s.row_idx] = [];
    rowsMap[s.row_idx].push(s);
  });
  const sortedRowKeys = Object.keys(rowsMap).map(Number).sort((a, b) => a - b);

  // Quick stats
  const pendingRecs = seatData.seat_recommendations.filter(
    (r) => r.decision_status === 'PENDING' && r.recommended_action !== 'Locked (Booked)'
  );

  const handleBulkApprove = async () => {
    if (pendingRecs.length === 0) return;
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      const seatIds = pendingRecs.map((r) => r.seat_id);
      const res = await api.recordSeatDecisions(tripId, {
        seat_ids: seatIds,
        decision_type: 'APPROVED',
        reason: 'Operator approved all pending seat recommendations in bulk',
      });
      setActionFeedback({ type: 'success', message: res.message });
      onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to bulk approve seats' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleApprove = async (seat: TripSeat) => {
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      const res = await api.recordSeatDecisions(tripId, {
        seat_ids: [seat.seat_id],
        decision_type: 'APPROVED',
        reason: `Operator approved recommendation for seat ${seat.seat_number}`,
      });
      setActionFeedback({ type: 'success', message: res.message });
      onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to approve seat' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleReject = async (seat: TripSeat) => {
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      const res = await api.recordSeatDecisions(tripId, {
        seat_ids: [seat.seat_id],
        decision_type: 'REJECTED',
        reason: `Operator rejected dynamic recommendation for seat ${seat.seat_number}`,
      });
      setActionFeedback({ type: 'success', message: res.message });
      onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to reject seat' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenOverride = (seat: TripSeat) => {
    setOverrideModalSeat(seat);
    setOverrideFare(seat.current_fare);
    setOverrideReason('Operator manual corridor alignment');
  };

  const handleConfirmOverride = async () => {
    if (!overrideModalSeat) return;
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      const res = await api.recordSeatDecisions(tripId, {
        seat_ids: [overrideModalSeat.seat_id],
        decision_type: 'OVERRIDDEN',
        decision_fare: overrideFare,
        reason: overrideReason,
      });
      setActionFeedback({ type: 'success', message: res.message });
      setOverrideModalSeat(null);
      onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to override seat fare' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeScenario: TripFinancialScenario | undefined = financials?.scenarios?.find(
    (s) => s.scenario_name === selectedScenario
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner: Confidence & Summary */}
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
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Seat-Level Dynamic Pricing</span>
              <span className={`badge ${seatData.confidence_score === 'Data-backed estimate' ? 'badge-valid' : 'badge-medium'}`}>
                {seatData.confidence_score}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Select any seat on the map to review price recommendations and competitor benchmarks.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {pendingRecs.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '9px 16px' }}
            >
              <CheckCircle2 size={16} />
              Approve All {pendingRecs.length} Seat Changes
            </button>
          )}
        </div>
      </div>

      {/* Executive Journey Timing & Operational Profile */}
      {activeTrip && (
        <div 
          className="card"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            padding: '16px 20px',
            backgroundColor: '#f8fafc'
          }}
        >
          {/* Timing & Schedule */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              <Clock size={14} style={{ color: 'var(--primary)' }} />
              <span>Schedule</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginTop: '4px' }}>
              {activeTrip.estimated_duration_hours ? `${activeTrip.estimated_duration_hours}h duration` : 'Standard Transit'} ({activeTrip.service_category?.toUpperCase() || 'REGULAR'})
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-body)', marginTop: '2px' }}>
              Dep: <strong>{activeTrip.departure_time ? new Date(activeTrip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</strong> &bull; Arr: <strong>{activeTrip.scheduled_arrival_time || 'Next Day'}</strong>
            </div>
          </div>

          {/* Passenger Rating & Quality */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              <Star size={14} style={{ color: '#d97706' }} />
              <span>Rating</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#d97706', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={15} style={{ fill: '#d97706', color: '#d97706' }} />
              <span className="font-mono">{activeTrip.average_rating ? activeTrip.average_rating.toFixed(1) : '4.2'} / 5.0</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                ({activeTrip.review_count?.toLocaleString() || '1,200'} reviews)
              </span>
            </div>
          </div>

          {/* Operational Reliability */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              <ShieldCheck size={14} style={{ color: 'var(--status-emerald-text)' }} />
              <span>Reliability</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--status-emerald-text)', marginTop: '4px' }}>
              {activeTrip.on_time_performance_pct || 92}% On-Time Arrival
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-body)', marginTop: '2px' }}>
              Cancellation rate: {activeTrip.cancellation_rate_pct || 1.5}%
            </div>
          </div>
        </div>
      )}

      {actionFeedback && (
        <div 
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: actionFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionFeedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: actionFeedback.type === 'success' ? '#34d399' : '#f87171',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {actionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Main Grid: Left is Visual Seat Map; Right is Seat Details & Financials */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 480px) 1fr', gap: '24px' }}>
        {/* LEFT COLUMN: Visual Bus Layout */}
        <div className="card" style={{ padding: '20px' }}>
          {/* Deck Switcher (for multi-deck sleeper buses) */}
          {seatData.deck_count > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
              {seatData.decks_available.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDeck(d)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: selectedDeck === d ? 'var(--primary)' : 'transparent',
                    color: selectedDeck === d ? '#ffffff' : '#475569'
                  }}
                >
                  {d === 'lower' ? 'Lower Deck (Lower Berths)' : 'Upper Deck (Upper Berths)'}
                </button>
              ))}
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <select
              value={posFilter}
              onChange={(e) => setPosFilter(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto' }}
            >
              <option value="all">All Positions</option>
              <option value="front">Front Rows</option>
              <option value="middle">Middle Rows</option>
              <option value="back">Back Rows</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto' }}
            >
              <option value="all">All Seat Types</option>
              <option value="lower">Lower Berths</option>
              <option value="upper">Upper Berths</option>
              <option value="sitting">Sitting (Chairs)</option>
            </select>

            <select
              value={arrFilter}
              onChange={(e) => setArrFilter(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto' }}
            >
              <option value="all">All Cabin Arrangements</option>
              <option value="single">Single Private Sleeper (Solo)</option>
              <option value="sharing">Sharing Sleeper (2-Sharing)</option>
              <option value="sitting">Sitting Chairs</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto' }}
            >
              <option value="all">All Statuses</option>
              <option value="available">Available Only</option>
              <option value="booked">Booked Only</option>
            </select>
          </div>

          {/* Accessible Legend */}
          <div 
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '12px', 
              fontSize: '0.72rem', 
              color: '#334155',
              marginBottom: '16px',
              padding: '8px 12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#334155', border: '1px solid #475569' }} />
              <span>Booked (Locked)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ecfdf5', border: '1px solid #059669' }} />
              <span style={{ color: '#047857', fontWeight: 600 }}>Increase (+₹)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fef2f2', border: '1px solid #dc2626' }} />
              <span style={{ color: '#b91c1c', fontWeight: 600 }}>Decrease (-₹)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#eff6ff', border: '1px solid #2563eb' }} />
              <span style={{ color: '#1d4ed8', fontWeight: 600 }}>Maintain (₹)</span>
            </div>
          </div>

          {/* Visual Bus Cabin Frame */}
          <div 
            style={{
              padding: '24px 16px',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              borderRadius: '24px',
              border: '2px solid rgba(51, 65, 85, 0.8)',
              position: 'relative',
              boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.5)'
            }}
          >
            {/* Front of Bus indicator (Steering / Windshield) */}
            <div 
              style={{
                textAlign: 'center',
                paddingBottom: '14px',
                borderBottom: '1px dashed rgba(71, 85, 105, 0.6)',
                marginBottom: '16px',
                fontSize: '0.72rem',
                letterSpacing: '0.1em',
                color: '#94a3b8',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}
            >
              &uarr; Front of Bus &bull; Driver Cabin &uarr;
            </div>

            {/* Rows Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedRowKeys.map((rKey) => {
                const rowSeats = rowsMap[rKey] || [];
                // Sort by col_idx
                rowSeats.sort((a, b) => a.col_idx - b.col_idx);

                return (
                  <div 
                    key={rKey} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '10px'
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', color: '#64748b', width: '24px', textAlign: 'right' }}>
                      R{rKey}
                    </span>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {rowSeats.map((s) => {
                        const rec = recsBySeatId[s.seat_id];
                        const isBooked = s.booking_status === 'booked';
                        const isSelected = selectedSeat?.seat_id === s.seat_id;
                        const action = rec?.recommended_action || 'Maintain fare';

                        // Accessible color scheme based on action and status
                        let bgColor = 'rgba(30, 41, 59, 0.6)';
                        let borderColor = 'rgba(71, 85, 105, 0.6)';
                        let badgeText = '₹' + s.current_fare;

                        if (isBooked) {
                          bgColor = '#1e293b';
                          borderColor = '#334155';
                          badgeText = 'BOOKED';
                        } else if (action === 'Increase fare') {
                          bgColor = 'rgba(16, 185, 129, 0.18)';
                          borderColor = '#10b981';
                          badgeText = `+₹${Math.round(rec.fare_difference)}`;
                        } else if (action === 'Decrease fare') {
                          bgColor = 'rgba(239, 68, 68, 0.18)';
                          borderColor = '#ef4444';
                          badgeText = `-₹${Math.abs(Math.round(rec.fare_difference))}`;
                        } else {
                          bgColor = 'rgba(56, 189, 248, 0.12)';
                          borderColor = '#38bdf8';
                        }

                        if (isSelected) {
                          borderColor = '#f59e0b';
                          bgColor = 'rgba(245, 158, 11, 0.25)';
                        }

                        const isSleeperBerth = s.seat_type === 'sleeper';

                        return (
                          <div
                            key={s.seat_id}
                            onClick={() => setSelectedSeat(s)}
                            style={{
                              width: isSleeperBerth ? '68px' : '54px',
                              height: isSleeperBerth ? '54px' : '48px',
                              borderRadius: '8px',
                              backgroundColor: bgColor,
                              border: `2px solid ${borderColor}`,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              position: 'relative',
                              padding: '2px',
                              transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                              boxShadow: isSelected ? '0 0 10px rgba(245, 158, 11, 0.6)' : 'none'
                            }}
                            title={`Seat ${s.seat_number} - ${s.position} (${s.seat_type})`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 800, color: isBooked ? '#94a3b8' : '#f8fafc' }}>
                              {isBooked && <Lock size={9} style={{ color: '#94a3b8' }} />}
                              <span>{s.seat_number}</span>
                              {s.sleeper_arrangement === 'single' && (
                                <span style={{ fontSize: '0.55rem', padding: '1px 3px', borderRadius: '3px', backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', marginLeft: '2px' }} title="Single Private Sleeper (Solo berth)">
                                  1P
                                </span>
                              )}
                              {s.sleeper_arrangement === 'sharing' && (
                                <span style={{ fontSize: '0.55rem', padding: '1px 3px', borderRadius: '3px', backgroundColor: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1', marginLeft: '2px' }} title="Sharing Sleeper (2 occupants)">
                                  2S
                                </span>
                              )}
                            </div>

                            <div 
                              style={{ 
                                fontSize: '0.62rem', 
                                fontWeight: 700, 
                                color: isBooked ? '#64748b' : (action === 'Increase fare' ? '#34d399' : (action === 'Decrease fare' ? '#f87171' : '#38bdf8')),
                                marginTop: '2px'
                              }}
                            >
                              {badgeText}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rear of bus indicator */}
            <div 
              style={{
                textAlign: 'center',
                paddingTop: '16px',
                borderTop: '1px dashed rgba(71, 85, 105, 0.6)',
                marginTop: '16px',
                fontSize: '0.7rem',
                color: '#64748b',
                fontWeight: 600
              }}
            >
              &darr; Rear of Bus &darr;
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Inspector & Financial Simulator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Seat Inspector Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div>
                <div className="card-title" style={{ fontSize: '1.05rem' }}>
                  {selectedSeat ? `Seat Inspector: ${selectedSeat.seat_number}` : 'Select a Seat to Inspect'}
                </div>
                <div className="card-subtitle">
                  {selectedSeat ? `${selectedSeat.position.toUpperCase()} &bull; ${selectedSeat.seat_type.toUpperCase()} &bull; Deck: ${selectedSeat.deck.toUpperCase()}` : 'Click any seat or berth on the map to review granular pricing signals'}
                </div>
              </div>

              {selectedSeat && recsBySeatId[selectedSeat.seat_id] && (
                <span 
                  className={`badge ${
                    selectedSeat.booking_status === 'booked' 
                      ? 'badge-stale' 
                      : (recsBySeatId[selectedSeat.seat_id].recommended_action === 'Increase fare' 
                          ? 'badge-valid' 
                          : (recsBySeatId[selectedSeat.seat_id].recommended_action === 'Decrease fare' ? 'badge-invalid' : 'badge-medium'))
                  }`}
                >
                  {recsBySeatId[selectedSeat.seat_id].recommended_action}
                </span>
              )}
            </div>

            {selectedSeat ? (
              <div>
                {/* Fare Summary Box */}
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '12px',
                    padding: '14px',
                    backgroundColor: '#f8fafc',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #e2e8f0',
                    marginBottom: '16px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current Fare</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      ₹{selectedSeat.current_fare}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Base: ₹{selectedSeat.base_fare}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Suggested Fare</div>
                    <div 
                      style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: 800, 
                        color: recsBySeatId[selectedSeat.seat_id]?.recommended_action === 'Increase fare' ? '#34d399' : (recsBySeatId[selectedSeat.seat_id]?.recommended_action === 'Decrease fare' ? '#f87171' : '#38bdf8')
                      }}
                    >
                      ₹{recsBySeatId[selectedSeat.seat_id]?.recommended_fare || selectedSeat.current_fare}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                      Limits: ₹{selectedSeat.min_fare}–₹{selectedSeat.max_fare}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Booking Status</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: selectedSeat.booking_status === 'booked' ? '#94a3b8' : '#34d399', marginTop: '4px' }}>
                      {selectedSeat.booking_status === 'booked' ? 'Booked (Locked)' : 'Available'}
                    </div>
                    {selectedSeat.collected_fare && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Collected: ₹{selectedSeat.collected_fare}</div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Selling Probability</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                      {recsBySeatId[selectedSeat.seat_id]?.selling_probability != null 
                        ? `${Math.round((recsBySeatId[selectedSeat.seat_id]?.selling_probability || 0) * 100)}%` 
                        : 'Baseline est.'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                      Exp. Final Occ: {recsBySeatId[selectedSeat.seat_id]?.expected_final_occupancy_pct != null ? `${recsBySeatId[selectedSeat.seat_id]?.expected_final_occupancy_pct}%` : 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Demand Level</div>
                    <div style={{ marginTop: '4px' }}>
                      <span 
                        className={`badge ${
                          (recsBySeatId[selectedSeat.seat_id]?.demand_level || recsBySeatId[selectedSeat.seat_id]?.demand_category) === 'High'
                            ? 'badge-valid'
                            : (recsBySeatId[selectedSeat.seat_id]?.demand_level || recsBySeatId[selectedSeat.seat_id]?.demand_category) === 'Low'
                              ? 'badge-invalid'
                              : (recsBySeatId[selectedSeat.seat_id]?.demand_level || recsBySeatId[selectedSeat.seat_id]?.demand_category) === 'Insufficient Data'
                                ? 'badge-stale'
                                : 'badge-medium'
                        }`}
                        style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                      >
                        {recsBySeatId[selectedSeat.seat_id]?.demand_level || recsBySeatId[selectedSeat.seat_id]?.demand_category || 'Normal'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      Velocity: {recsBySeatId[selectedSeat.seat_id]?.booking_velocity || 0} seats/hr
                    </div>
                  </div>
                </div>

                {/* Seat Specifications & Cabin Privacy Attributes */}
                <div 
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#f8fafc',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #e2e8f0',
                    marginBottom: '16px',
                    fontSize: '0.78rem'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={14} style={{ color: '#0284c7' }} />
                    <span>Seat &amp; Berth Configuration Profile</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', color: '#334155' }}>
                    <div>
                      Arrangement: <strong style={{ color: selectedSeat.sleeper_arrangement === 'single' ? '#b45309' : '#0f172a' }}>
                        {selectedSeat.sleeper_arrangement === 'single' ? 'Single Private Sleeper (Solo)' : (selectedSeat.sleeper_arrangement === 'sharing' ? 'Sharing Sleeper (2-Occupants)' : 'Sitting Chair')}
                      </strong>
                    </div>
                    <div>
                      Occupants &amp; Privacy: <strong style={{ color: '#0f172a' }}>{selectedSeat.max_occupants || 1} passenger ({selectedSeat.privacy_level || 'standard'} privacy)</strong>
                    </div>
                    <div>
                      Deck &amp; Berth: <strong style={{ color: '#0f172a' }}>{selectedSeat.deck?.toUpperCase()} deck &bull; {selectedSeat.berth_type?.toUpperCase()} berth</strong>
                    </div>
                    <div>
                      Position: <strong style={{ color: '#0f172a' }}>{selectedSeat.position?.toUpperCase()} row</strong> ({selectedSeat.bus_category} &bull; {selectedSeat.is_ac ? 'AC' : 'Non-AC'})
                    </div>
                    {selectedSeat.booking_status === 'booked' && (
                      <div style={{ gridColumn: '1 / -1', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                        Booked: {selectedSeat.booked_at ? new Date(selectedSeat.booked_at).toLocaleString() : 'Confirmed passenger ticket'} &bull; Collected Fare: ₹{selectedSeat.collected_fare || selectedSeat.current_fare}
                      </div>
                    )}
                  </div>
                </div>

                {/* Granular Factor Decomposition */}
                {recsBySeatId[selectedSeat.seat_id] && (
                  <div 
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      marginBottom: '16px',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={15} />
                      <span>Dynamic Pricing Factor Breakdown</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 }}>Arrangement Factor</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: (recsBySeatId[selectedSeat.seat_id].arrangement_factor_pct || 0) > 0 ? '#047857' : '#334155' }}>
                          {(recsBySeatId[selectedSeat.seat_id].arrangement_factor_pct || 0) > 0 ? '+' : ''}{recsBySeatId[selectedSeat.seat_id].arrangement_factor_pct || 0}%
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {selectedSeat.sleeper_arrangement === 'single' ? 'Private solo berth valuation' : 'Sharing berth baseline'}
                        </div>
                      </div>

                      <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 }}>Journey Timing Factor</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: (recsBySeatId[selectedSeat.seat_id].timing_factor_pct || 0) > 0 ? '#047857' : ((recsBySeatId[selectedSeat.seat_id].timing_factor_pct || 0) < 0 ? '#b91c1c' : '#334155') }}>
                          {(recsBySeatId[selectedSeat.seat_id].timing_factor_pct || 0) > 0 ? '+' : ''}{recsBySeatId[selectedSeat.seat_id].timing_factor_pct || 0}%
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Speed premium backed by demand
                        </div>
                      </div>

                      <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 }}>Quality &amp; Rating Factor</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: (recsBySeatId[selectedSeat.seat_id].quality_factor_pct || 0) > 0 ? '#047857' : '#334155' }}>
                          {(recsBySeatId[selectedSeat.seat_id].quality_factor_pct || 0) > 0 ? '+' : ''}{recsBySeatId[selectedSeat.seat_id].quality_factor_pct || 0}%
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Secondary willingness-to-pay
                        </div>
                      </div>

                      <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 }}>Competitor Category Median</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0284c7' }}>
                          ₹{recsBySeatId[selectedSeat.seat_id].competitor_median_for_category ? Math.round(recsBySeatId[selectedSeat.seat_id].competitor_median_for_category!) : 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Rival category matching
                        </div>
                      </div>
                    </div>


                  </div>
                )}

                {/* FEATURE 4: Explainable Recommendation in Plain English */}
                {recsBySeatId[selectedSeat.seat_id] && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                        Explainable Recommendation Rationale
                      </span>
                      <span className={`badge ${recsBySeatId[selectedSeat.seat_id].confidence_score?.toLowerCase().includes('high') ? 'badge-valid' : 'badge-medium'}`}>
                        Confidence: {recsBySeatId[selectedSeat.seat_id].confidence_score}
                      </span>
                    </div>

                    <div 
                      style={{ 
                        fontSize: '0.84rem', 
                        color: '#1e3a8a', 
                        padding: '14px 16px', 
                        backgroundColor: '#eff6ff', 
                        borderRadius: 'var(--radius-md)',
                        borderLeft: '4px solid #2563eb',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-line',
                        fontWeight: 500
                      }}
                    >
                      {recsBySeatId[selectedSeat.seat_id].explanation}
                    </div>

                    {/* Observed Facts vs Forecast Assumptions */}
                    {((recsBySeatId[selectedSeat.seat_id].observed_facts && recsBySeatId[selectedSeat.seat_id].observed_facts!.length > 0) ||
                      (recsBySeatId[selectedSeat.seat_id].forecast_assumptions && recsBySeatId[selectedSeat.seat_id].forecast_assumptions!.length > 0)) && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recsBySeatId[selectedSeat.seat_id].observed_facts && recsBySeatId[selectedSeat.seat_id].observed_facts!.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={13} style={{ color: '#047857' }} />
                              <span>Observed Facts (Actual Evidence)</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {recsBySeatId[selectedSeat.seat_id].observed_facts!.map((fact, idx) => (
                                <span 
                                  key={idx}
                                  style={{
                                    fontSize: '0.73rem',
                                    padding: '4px 9px',
                                    backgroundColor: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#047857',
                                    fontWeight: 500
                                  }}
                                >
                                  {fact}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {recsBySeatId[selectedSeat.seat_id].forecast_assumptions && recsBySeatId[selectedSeat.seat_id].forecast_assumptions!.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>ℹ Modeling Assumptions (Predictive)</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {recsBySeatId[selectedSeat.seat_id].forecast_assumptions!.map((assump, idx) => (
                                <span 
                                  key={idx}
                                  style={{
                                    fontSize: '0.73rem',
                                    padding: '4px 9px',
                                    backgroundColor: '#f5f3ff',
                                    border: '1px solid #ddd6fe',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#6d28d9',
                                    fontWeight: 500
                                  }}
                                >
                                  {assump}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Warnings List */}
                {recsBySeatId[selectedSeat.seat_id]?.warnings && recsBySeatId[selectedSeat.seat_id].warnings.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    {recsBySeatId[selectedSeat.seat_id].warnings.map((w, idx) => (
                      <div 
                        key={idx}
                        style={{
                          fontSize: '0.78rem',
                          color: '#b45309',
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde68a',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '4px'
                        }}
                      >
                        <AlertTriangle size={14} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons for Selected Seat */}
                {selectedSeat.booking_status === 'available' ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleSingleApprove(selectedSeat)}
                      disabled={isSubmitting}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                      <CheckCircle2 size={14} /> Approve Fare
                    </button>

                    <button
                      onClick={() => handleSingleReject(selectedSeat)}
                      disabled={isSubmitting}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                      <XCircle size={14} /> Reject
                    </button>

                    <button
                      onClick={() => handleOpenOverride(selectedSeat)}
                      disabled={isSubmitting}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                      <SlidersHorizontal size={14} /> Manual Override
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    This seat is already booked. Passenger ticket contract is confirmed and cannot be altered.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Click on any seat or berth on the cabin map to inspect pricing rationale, demand velocity, and operator approval controls.
              </div>
            )}
          </div>

          {/* COMPETITOR CATEGORY BENCHMARKS & MATCHING */}
          {seatData.competitor_category_benchmarks && (
            <div className="card" style={{ padding: '20px', border: '1px solid #bae6fd' }}>
              <div className="card-header" style={{ marginBottom: '12px' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SlidersHorizontal size={18} style={{ color: 'var(--primary)' }} />
                    <span>Comparable Competitor Fare Matching</span>
                  </div>
                  <div className="card-subtitle">
                    Segmented benchmarks across {seatData.competitor_category_benchmarks.platforms_represented?.join(' & ') || 'RedBus & AbhiBus'} ({seatData.competitor_category_benchmarks.sample_size} listings)
                  </div>
                </div>
              </div>



              {/* Benchmarks Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '8px' }}>
                {seatData.competitor_category_benchmarks.category_benchmarks?.single_sleeper && (
                  <div style={{ padding: '10px 12px', backgroundColor: '#fffbeb', borderRadius: 'var(--radius-sm)', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>Single Private Sleeper</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#78350f', marginTop: '2px' }}>
                      ₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.single_sleeper.median)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#92400e' }}>
                      Range: ₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.single_sleeper.min)}–₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.single_sleeper.max)} ({seatData.competitor_category_benchmarks.category_benchmarks.single_sleeper.count} listings)
                    </div>
                  </div>
                )}

                {seatData.competitor_category_benchmarks.category_benchmarks?.sharing_sleeper && (
                  <div style={{ padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-heading)', fontWeight: 700 }}>Sharing Sleeper Berth</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                      ₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.sharing_sleeper.median)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      Range: ₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.sharing_sleeper.min)}–₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.sharing_sleeper.max)} ({seatData.competitor_category_benchmarks.category_benchmarks.sharing_sleeper.count} listings)
                    </div>
                  </div>
                )}

                {seatData.competitor_category_benchmarks.category_benchmarks?.sitting && (
                  <div style={{ padding: '10px 12px', backgroundColor: '#f0f9ff', borderRadius: 'var(--radius-sm)', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700 }}>Sitting Chair Category</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c4a6e', marginTop: '2px' }}>
                      ₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.sitting.median)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#0369a1' }}>
                      Range: ₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.sitting.min)}–₹{Math.round(seatData.competitor_category_benchmarks.category_benchmarks.sitting.max)} ({seatData.competitor_category_benchmarks.category_benchmarks.sitting.count} listings)
                    </div>
                  </div>
                )}
              </div>

              {/* Comparability Warnings */}
              {seatData.competitor_category_benchmarks.comparability_warnings?.map((cw: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#b45309', marginTop: '4px' }}>
                  <AlertTriangle size={13} />
                  <span>{cw}</span>
                </div>
              ))}
            </div>
          )}

          {/* FINANCIAL PERFORMANCE & EXPENSE BREAKDOWN */}
          {financials && (
            <div className="card" style={{ padding: '20px', border: '1px solid #a7f3d0' }}>
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Coins size={18} style={{ color: '#047857' }} />
                    <span>Trip Financial Performance &amp; Profit Simulation</span>
                  </div>
                  <div className="card-subtitle">
                    Realized cash + forecast remaining revenue vs complete operating expenses.
                  </div>
                </div>

                {/* Scenario Selector */}
                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
                  {['Conservative', 'Base Case', 'Optimistic'].map((sc) => (
                    <button
                      key={sc}
                      onClick={() => setSelectedScenario(sc)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        backgroundColor: selectedScenario === sc ? 'var(--primary)' : 'transparent',
                        color: selectedScenario === sc ? '#fff' : 'var(--text-body)'
                      }}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>

              {/* High-Level Comparison Banner */}
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  padding: '14px',
                  backgroundColor: '#ecfdf5',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #a7f3d0',
                  marginBottom: '16px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Verified Booked Rev</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7' }}>
                    ₹{financials.current_booked_revenue.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {financials.current_booked_seats} of {financials.capacity} seats confirmed
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Trip Expenses</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b91c1c' }}>
                    ₹{Math.round(financials.total_operating_expenses).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Fixed: ₹{Math.round(financials.expenses.total_fixed_expenses)} + 8% Comm
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Expected Net Profit</div>
                  <div 
                    style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: 800, 
                      color: (activeScenario?.net_profit || 0) >= 0 ? '#047857' : '#b91c1c' 
                    }}
                  >
                    ₹{Math.round(activeScenario?.net_profit || financials.proposed_dynamic_plan.expected_net_profit).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Margin: {activeScenario?.profit_margin_pct || financials.proposed_dynamic_plan.profit_margin_pct}%
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Break-Even Occupancy</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309' }}>
                    {financials.break_even_occupancy_pct}%
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Target: ₹{Math.round(financials.break_even_revenue).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Plan Comparison Table: Current vs Proposed Dynamic */}
              <div style={{ marginBottom: '16px' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pricing Plan</th>
                      <th>Forecast Addl. Bookings</th>
                      <th>Total Expected Revenue</th>
                      <th>Expected Net Profit</th>
                      <th>Profit Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Current Fares Plan</td>
                      <td>+{financials.current_pricing_plan.expected_additional_bookings} seats</td>
                      <td>₹{Math.round(financials.current_pricing_plan.expected_total_revenue).toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: financials.current_pricing_plan.expected_net_profit >= 0 ? '#047857' : '#b91c1c' }}>
                        ₹{Math.round(financials.current_pricing_plan.expected_net_profit).toLocaleString()}
                      </td>
                      <td>{financials.current_pricing_plan.profit_margin_pct}%</td>
                    </tr>
                    <tr style={{ backgroundColor: '#ecfdf5', fontWeight: 700 }}>
                      <td style={{ color: '#047857' }}>Proposed Dynamic Plan</td>
                      <td style={{ color: '#047857' }}>+{financials.proposed_dynamic_plan.expected_additional_bookings} seats</td>
                      <td style={{ color: '#0284c7' }}>₹{Math.round(financials.proposed_dynamic_plan.expected_total_revenue).toLocaleString()}</td>
                      <td style={{ color: financials.proposed_dynamic_plan.expected_net_profit >= 0 ? '#047857' : '#b91c1c' }}>
                        ₹{Math.round(financials.proposed_dynamic_plan.expected_net_profit).toLocaleString()}
                      </td>
                      <td style={{ color: '#047857' }}>{financials.proposed_dynamic_plan.profit_margin_pct}%</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <TrendingUp size={14} />
                  <span>
                    Simulated Variance: <strong>+₹{Math.round(financials.proposed_dynamic_plan.revenue_lift)} revenue lift</strong> (&bull; ₹{Math.round(financials.proposed_dynamic_plan.profit_lift)} profit lift)
                  </span>
                </div>
              </div>

              {/* Operating Expenses Breakdown (Summary) */}
              <div 
                style={{ 
                  padding: '12px 14px', 
                  backgroundColor: '#f8fafc', 
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.76rem',
                  color: 'var(--text-body)',
                  border: '1px solid var(--border-light)'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
                  Trip Expense Composition:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                  <div>&bull; Fuel: ₹{financials.expenses.fuel_cost}</div>
                  <div>&bull; Driver Wages: ₹{financials.expenses.driver_wages}</div>
                  <div>&bull; Conductor: ₹{financials.expenses.conductor_wages}</div>
                  <div>&bull; Toll Charges: ₹{financials.expenses.toll_charges}</div>
                  <div>&bull; Maintenance: ₹{financials.expenses.maintenance_allocation}</div>
                  <div>&bull; Permits/Tax: ₹{financials.expenses.permits_and_taxes}</div>
                </div>
              </div>

              {/* Disclaimer Notice */}
              <div style={{ marginTop: '12px', fontSize: '0.68rem', color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center' }}>
                {financials.disclaimer}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Override Modal */}
      {overrideModalSeat && (
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
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Manual Fare Override: Seat {overrideModalSeat.seat_number}
              </div>
              <button 
                onClick={() => setOverrideModalSeat(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Position: {overrideModalSeat.position} &bull; Type: {overrideModalSeat.seat_type} &bull; Deck: {overrideModalSeat.deck}
              <br />
              Permitted Bounds: <strong>₹{overrideModalSeat.min_fare} – ₹{overrideModalSeat.max_fare}</strong>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Target Fare (₹):
              </label>
              <input
                type="number"
                value={overrideFare}
                min={overrideModalSeat.min_fare}
                max={overrideModalSeat.max_fare}
                step={10}
                onChange={(e) => setOverrideFare(Number(e.target.value))}
                className="form-control"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Reason for Manual Override (Mandatory for audit trail):
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. VIP passenger reservation, special group discount, manual corridor alignment..."
                className="form-control"
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                onClick={() => setOverrideModalSeat(null)}
                disabled={isSubmitting}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmOverride}
                disabled={isSubmitting || !overrideReason.trim()}
                className="btn btn-primary"
              >
                Confirm &amp; Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
