import React from 'react';
import { 
  LayoutDashboard, 
  Bus, 
  Sparkles, 
  BarChart3, 
  History, 
  FileText, 
  Settings as SettingsIcon,
  ShieldCheck,
  TrendingUp,
  Award
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedTripId: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, selectedTripId }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'trips', label: 'Trips Inventory', icon: Bus },
    { 
      id: 'recommendations', 
      label: selectedTripId ? `Pricing: ${selectedTripId.replace('TRIP-', '')}` : 'Recommendations', 
      icon: Sparkles 
    },
    { id: 'performance', label: 'Performance Tracking', icon: Award },
    { id: 'baseline', label: 'Baseline Comparison', icon: BarChart3 },
    { id: 'audit', label: 'Audit Log', icon: History },
    { id: 'assumptions', label: 'Data & Assumptions', icon: FileText },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="brand-header">
        <div className="brand-icon">
          <Bus size={22} />
        </div>
        <div>
          <div className="brand-title">FleetYield AI</div>
          <div className="brand-subtitle">AVGBUS &bull; TBS FleetOS</div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="nav-menu">
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 12px 4px 12px' }}>
          Operations &amp; Yield
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer with Provenance Pill */}
      <div className="sidebar-footer">
        <div className="synthetic-pill" title="All initial records in this prototype are synthetic demonstration data">
          <ShieldCheck size={14} />
          <span>SYNTHETIC DEMO DATA</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={12} style={{ color: '#38bdf8' }} />
          <span>Deterministic Yield Engine v1.0</span>
        </div>
      </div>
    </aside>
  );
};
