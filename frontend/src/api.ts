import type {
  Trip,
  DashboardSummary,
  Recommendation,
  OperatorDecision,
  AuditEvent,
  SimulationResult,
  AssumptionsSummary,
} from './types';

const API_BASE = '/api';

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorMsg = `API Error ${res.status}: ${res.statusText}`;
    try {
      const errorJson = await res.json();
      if (errorJson.detail) {
        errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  getDashboardSummary: () => fetchApi<DashboardSummary>('/dashboard/summary'),

  listTrips: (params?: { q?: string; demand?: string; data_status?: string; sort_by?: string; sort_order?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.demand) searchParams.set('demand', params.demand);
    if (params?.data_status) searchParams.set('data_status', params.data_status);
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchApi<Trip[]>(`/trips${query}`);
  },

  getTrip: (tripId: string) => fetchApi<Trip>(`/trips/${encodeURIComponent(tripId)}`),

  createTrip: (trip: Partial<Trip>) =>
    fetchApi<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(trip),
    }),

  updateTrip: (tripId: string, updates: Partial<Trip>) =>
    fetchApi<Trip>(`/trips/${encodeURIComponent(tripId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  generateRecommendation: (tripId: string) =>
    fetchApi<Recommendation>('/recommendations/generate', {
      method: 'POST',
      body: JSON.stringify({ trip_id: tripId }),
    }),

  recordDecision: (payload: {
    recommendation_id: string;
    decision_type: string;
    decision_fare?: number;
    reason?: string;
    actor_label?: string;
  }) =>
    fetchApi<OperatorDecision & { feedback: string }>('/decisions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listAuditEvents: (params?: { trip_id?: string; event_type?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.trip_id) searchParams.set('trip_id', params.trip_id);
    if (params?.event_type) searchParams.set('event_type', params.event_type);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchApi<AuditEvent[]>(`/audit-events${query}`);
  },

  listAuditEventTypes: () => fetchApi<string[]>('/audit-events/types'),

  runSimulation: (params: { demand_multiplier: number; price_elasticity: number; trip_ids?: string[] }) =>
    fetchApi<SimulationResult>('/simulation/run', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getAssumptions: () => fetchApi<AssumptionsSummary>('/assumptions'),

  getTripCompetitors: (tripId: string) =>
    fetchApi<import('./types').CompetitorPriceSummary>(`/trips/${encodeURIComponent(tripId)}/competitors`),

  importCompetitorCsv: (csvContent: string, isSimulated: boolean = true) =>
    fetchApi<{ success: boolean; records_imported: number; records_rejected: number; errors: string[]; message: string }>(
      '/competitor-fares/import-csv',
      {
        method: 'POST',
        body: JSON.stringify({ csv_content: csvContent, is_simulated: isSimulated }),
      }
    ),

  resetCompetitorSample: () =>
    fetchApi<{ message: string; count: number }>('/competitor-fares/reset-sample', {
      method: 'POST',
    }),

  resetDatabase: () =>
    fetchApi<{ message: string }>('/database/reset', {
      method: 'POST',
    }),

  getTripSeats: (tripId: string) =>
    fetchApi<import('./types').SeatMapData>(`/trips/${encodeURIComponent(tripId)}/seats`),

  getTripFinancials: (tripId: string) =>
    fetchApi<import('./types').TripFinancials>(`/trips/${encodeURIComponent(tripId)}/financials`),

  generateSeatRecommendations: (tripId: string) =>
    fetchApi<{
      trip_id: string;
      seat_recommendations: import('./types').SeatRecommendation[];
      financials: import('./types').TripFinancials;
      count: number;
    }>(`/trips/${encodeURIComponent(tripId)}/seat-recommendations/generate`, {
      method: 'POST',
    }),

  recordSeatDecisions: (tripId: string, payload: import('./types').SeatDecisionPayload) =>
    fetchApi<{
      success: boolean;
      trip_id: string;
      decision_type: string;
      updated_seats_count: number;
      message: string;
    }>(`/trips/${encodeURIComponent(tripId)}/seat-decisions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Feature 2: What-If Simulator
  simulateWhatIf: (tripId: string, payload: import('./types').WhatIfSimulateRequest) =>
    fetchApi<import('./types').WhatIfSimulateResponse>(`/trips/${encodeURIComponent(tripId)}/what-if-simulate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Feature 3: Competitor Trends Timeline
  getCompetitorTrends: (tripId: string, days: number = 7) =>
    fetchApi<import('./types').CompetitorTrendResponse>(`/trips/${encodeURIComponent(tripId)}/competitor-trends?days=${days}`),

  // Feature 5: Operational Alerts
  getAlerts: (params?: { status?: string; severity?: string; trip_id?: string; trigger_scan?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.trip_id) searchParams.set('trip_id', params.trip_id);
    if (params?.trigger_scan !== undefined) searchParams.set('trigger_scan', String(params.trigger_scan));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchApi<import('./types').OperationalAlert[]>(`/alerts${query}`);
  },

  acknowledgeAlert: (alertId: string, actorLabel: string = 'Operator') =>
    fetchApi<import('./types').OperationalAlert>(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ actor_label: actorLabel }),
    }),

  resolveAlert: (alertId: string, actorLabel: string = 'Operator') =>
    fetchApi<import('./types').OperationalAlert>(`/alerts/${encodeURIComponent(alertId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ actor_label: actorLabel }),
    }),

  // Feature 5: Daily Operations Report
  getDailyReport: (date?: string) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchApi<import('./types').DailyOperationsReport>(`/reports/daily${query}`);
  },

  downloadDailyReportCsvUrl: (date?: string) => {
    return `${API_BASE}/reports/daily/export-csv${date ? `?date=${encodeURIComponent(date)}` : ''}`;
  },

  // Feature 6: Recommendation Performance Tracking
  getPerformanceSummary: () =>
    fetchApi<import('./types').PerformanceSummary>('/performance/summary'),
};
