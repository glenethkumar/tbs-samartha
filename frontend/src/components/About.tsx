import React from 'react';
import { Bus, Layers, ShieldCheck } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Overview Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title" style={{ fontSize: '1.25rem' }}>
              <Bus size={22} style={{ color: '#38bdf8' }} />
              <span>FleetYield AI — Project Overview &amp; Architecture</span>
            </div>
            <div className="card-subtitle">
              SAMARTHA Hackathon &bull; Travel Software Enhancement &bull; TBS FleetOS Integration
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
          <strong>FleetYield AI</strong> addresses Problem 1 of the SAMARTHA Hackathon: <em>Empty seats and weak demand-based pricing</em>.
          It provides bus fleet operators with transparent, bounded seat-fare recommendations, human-in-the-loop review controls,
          strict data validation, an immutable audit log, and fixed-fare baseline simulation.
        </p>
      </div>

      {/* Vertical Slice Architecture */}
      <div className="grid-cols-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: '14px' }}>
            <Layers size={18} style={{ color: '#34d399' }} />
            <span>Architecture &amp; Tech Stack</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div>
              <strong>Frontend UI:</strong>
              <div style={{ color: 'var(--text-muted)' }}>
                React 19 + TypeScript + Vite. Responsive Vanilla CSS design tokens with high-contrast operations dark theme.
              </div>
            </div>
            <div>
              <strong>Backend Application:</strong>
              <div style={{ color: 'var(--text-muted)' }}>
                Python 3.14 + FastAPI + Pydantic. Modular services for validation, classification, pricing, and audit logging.
              </div>
            </div>
            <div>
              <strong>Data Persistence:</strong>
              <div style={{ color: 'var(--text-muted)' }}>
                Local SQLite database (<code>fleetyield.db</code>). Relational schema with foreign keys and foreign constraints.
              </div>
            </div>
            <div>
              <strong>Verification &amp; Tests:</strong>
              <div style={{ color: 'var(--text-muted)' }}>
                Pytest test suite covering all 12 required unit tests and 8 workflow integration tests (20/20 passing).
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '14px' }}>
            <ShieldCheck size={18} style={{ color: '#38bdf8' }} />
            <span>Scope Boundaries &amp; Integrity</span>
          </div>

          <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '8px' }}>
              <strong>In Scope (Fully Implemented &amp; Verified):</strong>
            </p>
            <ul style={{ paddingLeft: '20px', marginBottom: '12px', fontSize: '0.82rem' }}>
              <li>Working data layer with persistent SQLite storage</li>
              <li>Trip inventory dashboard with real-time occupancy calculations</li>
              <li>Rule-based demand classifier with booking-pace detection</li>
              <li>Explainable fare recommendations bounded by operator min/max limits</li>
              <li>Data-quality validation guards (stale detection &amp; invalid fixture blocks)</li>
              <li>Operator approval, rejection, and bounds-checked override workflow</li>
              <li>Persistent chronological audit log</li>
              <li>Fixed-fare baseline simulation scenario comparison</li>
            </ul>

            <p style={{ marginBottom: '8px' }}>
              <strong>Out of Scope (Explicitly Disclosed):</strong>
            </p>
            <ul style={{ paddingLeft: '20px', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
              <li>Passenger ticket sales, payment gateway integration, or refunds</li>
              <li>Publishing fares live to external distribution channels</li>
              <li>Live vehicle GPS or passenger boarding telemetry</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Third Party Resources Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="card-title">Third-Party Resources &amp; Licenses</div>
          <div className="card-subtitle">
            Complete disclosure of third-party libraries and runtime components used in FleetYield AI
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Resource Name</th>
                <th>Type</th>
                <th>Version</th>
                <th>License</th>
                <th>Role in Application</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>FastAPI</strong></td>
                <td>Backend Framework</td>
                <td>0.141.1</td>
                <td>MIT</td>
                <td>REST API routing, request validation, lifespan management</td>
              </tr>
              <tr>
                <td><strong>Pydantic</strong></td>
                <td>Data Validation</td>
                <td>2.13.5</td>
                <td>MIT</td>
                <td>Typed schemas and request/response models</td>
              </tr>
              <tr>
                <td><strong>SQLite3</strong></td>
                <td>Database Engine</td>
                <td>3.50.4</td>
                <td>Public Domain</td>
                <td>Local relational persistence for trips, decisions, and audit events</td>
              </tr>
              <tr>
                <td><strong>Pytest</strong></td>
                <td>Test Framework</td>
                <td>9.1.1</td>
                <td>MIT</td>
                <td>Automated unit and integration test runner</td>
              </tr>
              <tr>
                <td><strong>React</strong></td>
                <td>UI Library</td>
                <td>19.0.0</td>
                <td>MIT</td>
                <td>Component architecture, reactive state, and view rendering</td>
              </tr>
              <tr>
                <td><strong>Vite</strong></td>
                <td>Build Tool</td>
                <td>6.2.0</td>
                <td>MIT</td>
                <td>Frontend bundling, TypeScript compilation, dev server proxy</td>
              </tr>
              <tr>
                <td><strong>Lucide React</strong></td>
                <td>Icon Set</td>
                <td>0.475.0</td>
                <td>ISC / MIT</td>
                <td>Accessible UI icons for navigation and status badges</td>
              </tr>
              <tr>
                <td><strong>Google Fonts (Inter)</strong></td>
                <td>Typography</td>
                <td>Web</td>
                <td>OFL</td>
                <td>Modern accessible dashboard typography</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
