import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  ArrowUpDown, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RotateCw,
  Info 
} from 'lucide-react';
import type { Trip } from '../types';
import { api } from '../api';
import { TripModal } from './TripModal';

interface TripsProps {
  onSelectTrip: (tripId: string) => void;
}

export const Trips: React.FC<TripsProps> = ({ onSelectTrip }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [demandFilter, setDemandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('departure_time');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listTrips({
        q: searchQuery,
        demand: demandFilter,
        data_status: statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setTrips(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [searchQuery, demandFilter, statusFilter, sortBy, sortOrder]);

  const handleCreateNew = () => {
    setEditingTrip(null);
    setIsModalOpen(true);
  };

  const handleEdit = (trip: Trip, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTrip(trip);
    setIsModalOpen(true);
  };

  const handleTripSaved = () => {
    fetchTrips();
  };

  const occClass = (pct: number) => {
    if (pct < 30) return 'low';
    if (pct > 70) return 'high';
    return 'medium';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Controls: Search, Filters, New Trip Button */}
      <div className="card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
            <Search 
              size={18} 
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} 
            />
            <input
              id="trips-search-input"
              className="input"
              style={{ width: '100%', paddingLeft: '38px' }}
              placeholder="Search by Trip ID, origin, destination, or route..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Demand Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              id="trips-demand-filter"
              className="select"
              value={demandFilter}
              onChange={(e) => setDemandFilter(e.target.value)}
            >
              <option value="all">All Demand Levels</option>
              <option value="Low">Low (&lt;30%)</option>
              <option value="Medium">Medium (30-70%)</option>
              <option value="High">High (&gt;70%)</option>
            </select>
          </div>

          {/* Data Status Filter */}
          <div>
            <select
              id="trips-status-filter"
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Data Quality</option>
              <option value="valid">Fresh & Valid</option>
              <option value="stale">Stale Warning (&gt;24h)</option>
              <option value="invalid">Invalid Fixtures</option>
            </select>
          </div>

          {/* Sort Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpDown size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              id="trips-sort-by"
              className="select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="departure_time">Departure Time</option>
              <option value="occupancy">Occupancy %</option>
              <option value="trip_id">Trip ID</option>
            </select>
            <button
              id="trips-sort-order-toggle"
              className="btn btn-secondary btn-sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`Toggle sort order (Current: ${sortOrder.toUpperCase()})`}
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>

          {/* Create Trip Button */}
          <button id="btn-create-trip" className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={16} />
            <span>Add New Trip</span>
          </button>
        </div>
      </div>

      {/* Trips Table */}
      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="card-title">Active Bus Services ({trips.length})</div>
            <div className="card-subtitle">Showing persisted trips with real-time occupancy calculations</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={fetchTrips} disabled={loading}>
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading trip inventory...
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <div className="notice-box notice-danger">
              <AlertTriangle size={18} />
              <div>{error}</div>
            </div>
          </div>
        ) : trips.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>No matching trips found</div>
            <div style={{ fontSize: '0.85rem' }}>Try clearing search criteria or resetting filters.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Trip ID & Route</th>
                  <th>Departure Window</th>
                  <th>Seat Inventory</th>
                  <th>Occupancy</th>
                  <th>Current / Base Fare</th>
                  <th>Fare Bounds [Min-Max]</th>
                  <th>Demand</th>
                  <th>Data Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => {
                  return (
                    <tr 
                      key={trip.trip_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectTrip(trip.trip_id)}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{trip.route_name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                          {trip.trip_id} &bull; {trip.bus_type || 'AC'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.88rem' }}>
                          {new Date(trip.departure_time).toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                          {new Date(trip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {trip.origin} &rarr; {trip.destination}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {trip.booked_seats} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {trip.total_seats}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#34d399' }}>
                          {trip.available_seats} vacant
                        </div>
                      </td>
                      <td style={{ minWidth: '130px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{trip.occupancy_percent}%</span>
                        </div>
                        <div className="progress-container">
                          <div 
                            className={`progress-fill ${occClass(trip.occupancy_percent)}`}
                            style={{ width: `${Math.min(100, trip.occupancy_percent)}%` }}
                          />
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          ₹{trip.current_fare}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Base: ₹{trip.base_fare}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          ₹{trip.min_fare} - ₹{trip.max_fare}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${trip.demand_category?.toLowerCase() || 'medium'}`}>
                          {trip.demand_category}
                        </span>
                      </td>
                      <td>
                        {trip.is_stale ? (
                          <span className="badge badge-stale" title={trip.validation_issues.join('; ')}>
                            <AlertTriangle size={12} /> Stale (Insufficient)
                          </span>
                        ) : !trip.is_valid ? (
                          <span className="badge badge-invalid" title={trip.validation_issues.join('; ')}>
                            <XCircle size={12} /> Invalid (Insufficient)
                          </span>
                        ) : (trip.snapshot_count && trip.snapshot_count >= 2) ? (
                          <span className="badge badge-valid" title="Strong data quality: Verified fresh & multi-point snapshots">
                            <CheckCircle2 size={12} /> Strong Data
                          </span>
                        ) : (
                          <span className="badge badge-stale" title="Limited data quality: Core valid; snapshot history missing">
                            <Info size={12} /> Limited Data
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            id={`btn-edit-${trip.trip_id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => handleEdit(trip, e)}
                            title="Edit trip attributes"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            id={`btn-recommend-${trip.trip_id}`}
                            className="btn btn-primary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTrip(trip.trip_id);
                            }}
                          >
                            <Sparkles size={14} />
                            <span>Pricing</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trip Create / Edit Modal */}
      {isModalOpen && (
        <TripModal
          trip={editingTrip}
          onClose={() => setIsModalOpen(false)}
          onSaved={handleTripSaved}
        />
      )}
    </div>
  );
};
