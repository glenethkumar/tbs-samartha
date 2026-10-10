import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  ShieldCheck, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  Sliders, 
  Database 
} from 'lucide-react';
import type { AssumptionsSummary } from '../types';
import { api } from '../api';

export const Settings: React.FC = () => {
  const [assumptions, setAssumptions] = useState<AssumptionsSummary | null>(null);
  const [staleHours, setStaleHours] = useState('24');
  const [lowOcc, setLowOcc] = useState('30');
  const [highOcc, setHighOcc] = useState('70');
  const [lowAdj, setLowAdj] = useState('-10');
  const [highAdj, setHighAdj] = useState('15');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.getAssumptions().then((data) => {
      setAssumptions(data);
      setStaleHours(String(data.stale_data_threshold_hours));
      setLowOcc(String(data.demand_thresholds.low_occupancy_max));
      setHighOcc(String(data.demand_thresholds.high_occupancy_min));
      setLowAdj(String(data.pricing_rules.low_demand_adjustment_pct));
      setHighAdj(String(data.pricing_rules.high_demand_adjustment_pct));
    }).catch(console.error);
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('Settings preferences saved for current session.');
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleResetDb = async () => {
    if (!window.confirm('Reset SQLite database to default 11 synthetic demonstration records?')) return;
    setResetting(true);
    try {
      const res = await api.resetDatabase();
      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(`Reset error: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <SettingsIcon size={20} style={{ color: 'var(--primary)' }} />
              <span>System &amp; Algorithmic Settings</span>
            </div>
            <div className="card-subtitle">
              Manage operational parameters, freshness thresholds, and decision-support defaults
            </div>
          </div>
        </div>

        {feedback && (
          <div className="notice-box notice-info" style={{ marginTop: '10px' }}>
            <CheckCircle2 size={16} />
            <div>{feedback}</div>
          </div>
        )}
      </div>

      <div className="grid-cols-2">
        {/* Card 1: Rule Configuration */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Sliders size={18} style={{ color: 'var(--primary)' }} />
              <span>Rule Engine Thresholds</span>
            </div>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label className="form-label">Data Freshness Expiry Window (Hours)</label>
              <input
                id="settings-stale-hours"
                className="input"
                type="number"
                min="1"
                max="168"
                value={staleHours}
                onChange={(e) => setStaleHours(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Trips not refreshed within this window receive Stale warnings and pricing recommendations are withheld.
              </span>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Low Demand Upper Limit (%)</label>
                <input
                  id="settings-low-occ"
                  className="input"
                  type="number"
                  min="5"
                  max="45"
                  value={lowOcc}
                  onChange={(e) => setLowOcc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">High Demand Lower Limit (%)</label>
                <input
                  id="settings-high-occ"
                  className="input"
                  type="number"
                  min="55"
                  max="95"
                  value={highOcc}
                  onChange={(e) => setHighOcc(e.target.value)}
                />
              </div>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label">Low Demand Adjustment (%)</label>
                <input
                  id="settings-low-adj"
                  className="input"
                  type="number"
                  min="-30"
                  max="0"
                  value={lowAdj}
                  onChange={(e) => setLowAdj(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">High Demand Markup (%)</label>
                <input
                  id="settings-high-adj"
                  className="input"
                  type="number"
                  min="0"
                  max="50"
                  value={highAdj}
                  onChange={(e) => setHighAdj(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button id="btn-save-settings" type="submit" className="btn btn-primary btn-sm">
                <Save size={14} />
                <span>Save Preferences</span>
              </button>
            </div>
          </form>
        </div>

        {/* Card 2: Environment & Maintenance */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Database size={18} style={{ color: 'var(--primary)' }} />
              <span>Database &amp; Environment</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem' }}>
            <div style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              <div><strong>Storage Engine:</strong> SQLite 3 (<code>backend/data/fleetyield.db</code>)</div>
              <div><strong>Active Policy:</strong> {assumptions?.policy_version || 'v1.0-deterministic-rule'}</div>
              <div><strong>Provenance Label:</strong> Synthetic demo data</div>
            </div>

            <div>
              <strong>Database Re-seed:</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Reverts all trips, snapshots, and audit events back to the initial 11 synthetic demo test fixtures.
              </div>
              <button
                id="btn-settings-reset-db"
                className="btn btn-secondary btn-sm"
                onClick={handleResetDb}
                disabled={resetting}
              >
                <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
                <span>{resetting ? 'Resetting Database...' : 'Re-seed Demo Database'}</span>
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              FleetYield AI operates strictly in local decision-support mode. No real-world passenger fares or OTA feeds are modified.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
