"""FleetYield AI - Persistent Audit Logging Service (FR-06).

Provides chronological tracking of system recommendations, operator decisions, and validation blocks.
"""

from typing import List, Dict, Any, Optional
from app.db import get_connection


class AuditService:
    @staticmethod
    def get_events(
        trip_id: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Retrieves audit events newest-first, supporting trip and event type filters.
        """
        query = "SELECT * FROM audit_events WHERE 1=1"
        params: List[Any] = []

        if trip_id and trip_id.lower() != "all":
            query += " AND trip_id = ?"
            params.append(trip_id)

        if event_type and event_type.lower() != "all":
            query += " AND event_type = ?"
            params.append(event_type)

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_event_types() -> List[str]:
        """Returns list of distinct event types in the audit log."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT event_type FROM audit_events ORDER BY event_type ASC")
            return [r[0] for r in cursor.fetchall()]
