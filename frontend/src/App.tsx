import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Overview } from './components/Overview';
import { Trips } from './components/Trips';
import { TripDetail } from './components/TripDetail';
import { BaselineComparison } from './components/BaselineComparison';
import { AuditLog } from './components/AuditLog';
import { Assumptions } from './components/Assumptions';
import { About } from './components/About';
import { Settings } from './components/Settings';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedTripId, setSelectedTripId] = useState<string | null>('TRIP-BLR-HYD-101');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [dateRange, setDateRange] = useState<string>('All Scheduled Services');

  const handleSelectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    setActiveTab('recommendations');
  };

  const handleGlobalRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Operations Dashboard';
      case 'trips':
        return 'Trip & Seat Inventory';
      case 'recommendations':
        return selectedTripId ? `Pricing Engine — ${selectedTripId}` : 'Pricing Recommendation Engine';
      case 'baseline':
        return 'Fixed-Fare Baseline Comparison';
      case 'audit':
        return 'Persistent Audit Log';
      case 'assumptions':
        return 'Rules & Assumptions';
      case 'settings':
        return 'System & Algorithmic Settings';
      case 'about':
        return 'About & Resources';
      default:
        return 'FleetYield AI';
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedTripId={selectedTripId}
      />

      <div className="main-content">
        <Navbar
          title={getPageTitle()}
          onRefresh={handleGlobalRefresh}
          dateRange={dateRange}
          setDateRange={setDateRange}
        />

        <main className="content-body" key={refreshTrigger}>
          {activeTab === 'overview' && (
            <Overview
              onSelectTrip={handleSelectTrip}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'trips' && (
            <Trips
              onSelectTrip={handleSelectTrip}
            />
          )}

          {activeTab === 'recommendations' && selectedTripId && (
            <TripDetail
              tripId={selectedTripId}
              onBack={() => setActiveTab('trips')}
              onRefreshList={handleGlobalRefresh}
            />
          )}

          {activeTab === 'baseline' && (
            <BaselineComparison />
          )}

          {activeTab === 'audit' && (
            <AuditLog />
          )}

          {activeTab === 'assumptions' && (
            <Assumptions />
          )}

          {activeTab === 'settings' && (
            <Settings />
          )}

          {activeTab === 'about' && (
            <About />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
