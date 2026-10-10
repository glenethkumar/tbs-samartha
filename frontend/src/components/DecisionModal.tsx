import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import type { Recommendation } from '../types';
import { api } from '../api';

interface DecisionModalProps {
  recommendation: Recommendation;
  decisionType: 'REJECTED' | 'OVERRIDDEN';
  onClose: () => void;
  onDecisionSaved: (feedback: string) => void;
}

export const DecisionModal: React.FC<DecisionModalProps> = ({
  recommendation,
  decisionType,
  onClose,
  onDecisionSaved,
}) => {
  const isOverride = decisionType === 'OVERRIDDEN';

  const [overrideFare, setOverrideFare] = useState<string>(
    String(recommendation.recommended_fare || recommendation.current_fare_at_generation)
  );
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let parsedFare: number | undefined = undefined;

    if (isOverride) {
      parsedFare = parseFloat(overrideFare);
      if (isNaN(parsedFare)) {
        return setError('Please enter a valid numeric fare amount.');
      }
      if (parsedFare < recommendation.min_fare || parsedFare > recommendation.max_fare) {
        return setError(
          `Override fare (₹${parsedFare}) violates configured bounds [₹${recommendation.min_fare} - ₹${recommendation.max_fare}].`
        );
      }
      if (!reason.trim()) {
        return setError('An override rationale is required for audit compliance.');
      }
    }

    setSaving(true);
    try {
      const res = await api.recordDecision({
        recommendation_id: recommendation.recommendation_id,
        decision_type: decisionType,
        decision_fare: parsedFare,
        reason: reason.trim() || undefined,
        actor_label: 'Demo operator',
      });
      onDecisionSaved(res.feedback);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record decision');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            {isOverride ? 'Manual Fare Override' : 'Reject Recommendation'}
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && (
          <div className="notice-box notice-danger">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Trip: <strong>{recommendation.trip_id}</strong> &bull; Recommended Fare:{' '}
          <strong style={{ color: '#38bdf8' }}>₹{recommendation.recommended_fare}</strong> &bull; Current Fare:{' '}
          <strong>₹{recommendation.current_fare_at_generation}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          {isOverride && (
            <div className="form-group">
              <label className="form-label">
                Custom Fare Amount (₹) &bull; Permitted Range: [₹{recommendation.min_fare} - ₹{recommendation.max_fare}]
              </label>
              <input
                id="modal-override-fare-input"
                className="input"
                type="number"
                step="10"
                min={recommendation.min_fare}
                max={recommendation.max_fare}
                value={overrideFare}
                onChange={(e) => setOverrideFare(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {isOverride ? 'Override Rationale (Required)' : 'Rejection Reason (Optional)'}
            </label>
            <textarea
              id="modal-decision-reason-input"
              className="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isOverride
                  ? 'Explain why configured rule recommendation was overridden (e.g. competitor festival fare match)'
                  : 'Specify why this suggestion was declined'
              }
              required={isOverride}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              id="modal-confirm-decision-btn"
              type="submit"
              className={`btn ${isOverride ? 'btn-primary' : 'btn-danger'}`}
              disabled={saving}
            >
              <Check size={16} />
              <span>{saving ? 'Recording...' : isOverride ? 'Apply Override' : 'Confirm Rejection'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
