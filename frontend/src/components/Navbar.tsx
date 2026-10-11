import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Bell, 
  RotateCcw, 
  CheckCircle2, 
  ChevronDown, 
  FileText
} from 'lucide-react';
import { api } from '../api';
import { AlertsCenterModal } from './AlertsCenterModal';
import { DailyReportModal } from './DailyReportModal';

interface NavbarProps {
  title: string;
  onRefresh: () => void;
  dateRange: string;
  setDateRange: (range: string) => void;
  onSelectTrip?: (tripId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  title, 
  onRefresh, 
  dateRange, 
  setDateRange,
  onSelectTrip
}) => {
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState(false);
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);

  const refreshAlertsCount = async () => {
    try {
      const activeAlerts = await api.getAlerts({ status: 'ACTIVE', trigger_scan: false });
      setActiveAlertsCount(activeAlerts.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshAlertsCount();
  }, []);

  const handleReset = async () => {
    if (!window.confirm('Reset local SQLite database to initial synthetic seed records? Any custom edits will be reverted.')) {
      return;
    }
    setResetting(true);
    try {
      const res = await api.resetDatabase();
      setFeedback(res.message);
      onRefresh();
      refreshAlertsCount();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

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
        {/* Daily Operations Report Button */}
        <button
          id="btn-daily-report"
          className="btn btn-secondary btn-sm"
          onClick={() => setIsDailyReportModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Open Daily Operations & Reconciliation Report"
        >
          <FileText size={14} style={{ color: '#38bdf8' }} />
          <span>Daily Report</span>
        </button>

        {/* Date Range Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            id="btn-date-range-selector"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShowDatePicker(!showDatePicker);
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

        {/* Operational Alerts Bell with Active Count Badge */}
        <div style={{ position: 'relative' }}>
          <button
            id="btn-notifications-toggle"
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', position: 'relative' }}
            onClick={() => setIsAlertsModalOpen(true)}
            title="Operational Alerts & Risk Center"
          >
            <Bell size={16} />
            {activeAlertsCount > 0 && (
              <span 
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '9999px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px'
                }}
              >
                {activeAlertsCount}
              </span>
            )}
          </button>
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
            padding: '4px 12px 4px 6px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
          }}
          title="Logged in as Demo Operations Manager"
        >
          <div 
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
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

      {/* Alerts Center Modal */}
      <AlertsCenterModal
        isOpen={isAlertsModalOpen}
        onClose={() => {
          setIsAlertsModalOpen(false);
          refreshAlertsCount();
        }}
        onSelectTrip={onSelectTrip}
      />

      {/* Daily Operations Report Modal */}
      <DailyReportModal
        isOpen={isDailyReportModalOpen}
        onClose={() => setIsDailyReportModalOpen(false)}
      />
    </header>
  );
};
