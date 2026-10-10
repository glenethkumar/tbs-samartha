import React, { useState } from 'react';
import { 
  Calendar, 
  Bell, 
  RotateCcw, 
  CheckCircle2, 
  ChevronDown, 
  AlertTriangle 
} from 'lucide-react';
import { api } from '../api';

interface NavbarProps {
  title: string;
  onRefresh: () => void;
  dateRange: string;
  setDateRange: (range: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  title, 
  onRefresh, 
  dateRange, 
  setDateRange 
}) => {
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleReset = async () => {
    if (!window.confirm('Reset local SQLite database to initial synthetic seed records? Any custom edits will be reverted.')) {
      return;
    }
    setResetting(true);
    try {
      const res = await api.resetDatabase();
      setFeedback(res.message);
      onRefresh();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const notifications = [
    { id: 1, title: 'Data Freshness Warning', text: 'TRIP-STALE-901 has not been updated in 38h (>24h limit). Pricing blocked.', time: '10m ago', type: 'warning' },
    { id: 2, title: 'Capacity Validation Block', text: 'TRIP-INVALID-902 booked seats (48) exceed total capacity (40).', time: '1h ago', type: 'danger' },
    { id: 3, title: 'High Demand Surge', text: 'TRIP-MAA-BLR-303 reached 85% occupancy (+15% premium suggested).', time: '2h ago', type: 'info' },
  ];

  const dateOptions = [
    'Today (Oct 10, 2026)',
    'Next 24 Hours',
    'Next 7 Days',
    'Next 30 Days',
    'All Scheduled Services'
  ];

  return (
    <header className="top-navbar">
      <div className="page-title-wrap">
        <div>
          <h1 className="page-title">{title}</h1>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            AVGBUS Yield Intelligence &bull; Decision Support Mode
          </div>
        </div>
        {feedback && (
          <span style={{ fontSize: '0.8rem', color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #a7f3d0' }}>
            <CheckCircle2 size={14} /> {feedback}
          </span>
        )}
      </div>

      <div className="top-actions">
        {/* Date Range Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            id="btn-date-range-selector"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShowDatePicker(!showDatePicker);
              setShowNotifications(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Calendar size={14} style={{ color: 'var(--primary)' }} />
            <span>{dateRange}</span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          {showDatePicker && (
            <div 
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '210px',
                background: '#ffffff',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              {dateOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setDateRange(opt);
                    setShowDatePicker(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    color: dateRange === opt ? 'var(--primary)' : 'var(--text-body)',
                    background: dateRange === opt ? 'var(--primary-light)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: dateRange === opt ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Bell Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            id="btn-notifications-toggle"
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', position: 'relative' }}
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowDatePicker(false);
            }}
            title="System notifications and alerts"
          >
            <Bell size={16} />
            <span 
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ef4444'
              }}
            />
          </button>

          {showNotifications && (
            <div 
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '320px',
                background: '#ffffff',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '14px',
                zIndex: 60,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-heading)' }}>System Alerts</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                  {notifications.length} unread
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.map((n) => (
                  <div 
                    key={n.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: n.type === 'danger' ? '#fef2f2' : n.type === 'warning' ? '#fffbeb' : '#eff6ff',
                      border: `1px solid ${n.type === 'danger' ? '#fecaca' : n.type === 'warning' ? '#fde68a' : '#bfdbfe'}`,
                      fontSize: '0.78rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: n.type === 'danger' ? '#b91c1c' : n.type === 'warning' ? '#b45309' : '#1d4ed8' }}>
                      <AlertTriangle size={12} />
                      <span>{n.title}</span>
                    </div>
                    <div style={{ color: 'var(--text-body)', marginTop: '2px', lineHeight: 1.35 }}>
                      {n.text}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {n.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reset Demo Seed Button */}
        <button
          id="btn-reset-seed-data"
          className="btn btn-secondary btn-sm"
          onClick={handleReset}
          disabled={resetting}
          title="Reset database to default synthetic seed trips"
        >
          <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
          <span>{resetting ? 'Resetting...' : 'Reset Seed'}</span>
        </button>

        {/* Operator Profile Avatar */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px 4px 6px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: '#f8fafc',
            border: '1px solid var(--border-light)'
          }}
          title="Logged in as Demo Operations Manager"
        >
          <div 
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            DO
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            Demo Operator
          </div>
        </div>
      </div>
    </header>
  );
};
