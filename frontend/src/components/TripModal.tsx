import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import type { Trip } from '../types';
import { api } from '../api';

interface TripModalProps {
  trip?: Trip | null; // null for Create, Trip object for Edit
  onClose: () => void;
  onSaved: (trip: Trip) => void;
}

export const TripModal: React.FC<TripModalProps> = ({ trip, onClose, onSaved }) => {
  const isEditing = !!trip;

  const [tripId, setTripId] = useState(trip?.trip_id || `TRIP-${Math.floor(100 + Math.random() * 900)}`);
  const [routeName, setRouteName] = useState(trip?.route_name || '');
  const [origin, setOrigin] = useState(trip?.origin || '');
  const [destination, setDestination] = useState(trip?.destination || '');
  const [departureTime, setDepartureTime] = useState(
    trip?.departure_time ? trip.departure_time.slice(0, 16) : new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [totalSeats, setTotalSeats] = useState(trip?.total_seats ? String(trip.total_seats) : '40');
  const [bookedSeats, setBookedSeats] = useState(trip?.booked_seats !== undefined ? String(trip.booked_seats) : '10');
  const [baseFare, setBaseFare] = useState(trip?.base_fare ? String(trip.base_fare) : '750');
  const [currentFare, setCurrentFare] = useState(trip?.current_fare ? String(trip.current_fare) : '750');
  const [minFare, setMinFare] = useState(trip?.min_fare ? String(trip.min_fare) : '600');
  const [maxFare, setMaxFare] = useState(trip?.max_fare ? String(trip.max_fare) : '1100');
  const [busType, setBusType] = useState(trip?.bus_type || 'AC Seater 2+2');
  const [operatorNotes, setOperatorNotes] = useState(trip?.operator_notes || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    const tSeats = parseInt(totalSeats, 10);
    const bSeats = parseInt(bookedSeats, 10);
    const bFare = parseFloat(baseFare);
    const cFare = parseFloat(currentFare);
    const mnFare = parseFloat(minFare);
    const mxFare = parseFloat(maxFare);

    if (!tripId.trim()) return setError('Trip ID is required');
    if (!routeName.trim()) return setError('Route name is required');
    if (!origin.trim()) return setError('Origin city is required');
    if (!destination.trim()) return setError('Destination city is required');
    if (isNaN(tSeats) || tSeats <= 0) return setError('Total seats must be a positive integer');
    if (isNaN(bSeats) || bSeats < 0) return setError('Booked seats cannot be negative');
    if (bSeats > tSeats) return setError(`Booked seats (${bSeats}) cannot exceed total seats (${tSeats})`);
    if (isNaN(bFare) || bFare <= 0) return setError('Base fare must be greater than zero');
    if (isNaN(cFare) || cFare <= 0) return setError('Current fare must be greater than zero');
    if (isNaN(mnFare) || mnFare <= 0) return setError('Minimum fare must be greater than zero');
    if (isNaN(mxFare) || mxFare < mnFare) return setError('Maximum fare must be greater than or equal to minimum fare');

    // Format departure time to ISO 8601 with Z
    const isoDep = new Date(departureTime).toISOString();

    const payload = {
      trip_id: tripId.trim(),
      route_name: routeName.trim(),
      origin: origin.trim(),
      destination: destination.trim(),
      departure_time: isoDep,
      total_seats: tSeats,
      booked_seats: bSeats,
      base_fare: bFare,
      current_fare: cFare,
      min_fare: mnFare,
      max_fare: mxFare,
      bus_type: busType,
      operator_notes: operatorNotes.trim() || undefined,
      data_source_label: 'Synthetic demo data',
      data_updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      let saved: Trip;
      if (isEditing) {
        saved = await api.updateTrip(trip.trip_id, payload);
      } else {
        saved = await api.createTrip(payload);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save trip record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title">{isEditing ? `Edit Trip: ${trip.trip_id}` : 'Create New Trip Record'}</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && (
          <div className="notice-box notice-danger">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Trip ID</label>
              <input
                id="modal-trip-id"
                className="input"
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
                disabled={isEditing}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Route Display Name</label>
              <input
                id="modal-route-name"
                className="input"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g. Bengaluru to Hyderabad Express"
                required
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Origin City</label>
              <input
                id="modal-origin"
                className="input"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Destination City</label>
              <input
                id="modal-destination"
                className="input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Departure Date & Time</label>
              <input
                id="modal-departure-time"
                className="input"
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bus Vehicle Type</label>
              <select
                id="modal-bus-type"
                className="select"
                value={busType}
                onChange={(e) => setBusType(e.target.value)}
              >
                <option value="AC Seater 2+2">AC Seater 2+2</option>
                <option value="Multi-Axle AC Sleeper">Multi-Axle AC Sleeper</option>
                <option value="Volvo AC Semi-Sleeper">Volvo AC Semi-Sleeper</option>
                <option value="Non-AC Deluxe">Non-AC Deluxe</option>
                <option value="Mercedes AC 2+2">Mercedes AC 2+2</option>
              </select>
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Total Bus Seats</label>
              <input
                id="modal-total-seats"
                className="input"
                type="number"
                min="1"
                value={totalSeats}
                onChange={(e) => setTotalSeats(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Booked Seats</label>
              <input
                id="modal-booked-seats"
                className="input"
                type="number"
                min="0"
                value={bookedSeats}
                onChange={(e) => setBookedSeats(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-cols-4">
            <div className="form-group">
              <label className="form-label">Base Fare (₹)</label>
              <input
                id="modal-base-fare"
                className="input"
                type="number"
                step="10"
                min="10"
                value={baseFare}
                onChange={(e) => setBaseFare(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Current Fare (₹)</label>
              <input
                id="modal-current-fare"
                className="input"
                type="number"
                step="10"
                min="10"
                value={currentFare}
                onChange={(e) => setCurrentFare(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Min Fare (₹)</label>
              <input
                id="modal-min-fare"
                className="input"
                type="number"
                step="10"
                min="10"
                value={minFare}
                onChange={(e) => setMinFare(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Max Fare (₹)</label>
              <input
                id="modal-max-fare"
                className="input"
                type="number"
                step="10"
                min="10"
                value={maxFare}
                onChange={(e) => setMaxFare(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Operator Notes (Optional)</label>
            <input
              id="modal-operator-notes"
              className="input"
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="e.g. Weekend holiday corridor or commuter rush service"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button id="btn-save-trip-modal" type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Trip'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
