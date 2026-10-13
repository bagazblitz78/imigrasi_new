"""Single-use, short-lived tickets for authenticating browser SSE connections.

The native ``EventSource`` API cannot send custom headers, so instead of putting
the JWT in the query string (which leaks into access logs and browser history)
we exchange it for a ticket that is valid for ~30 seconds, usable once and only
for the notification stream (requirement 47).
"""
from __future__ import annotations

import secrets
import time
from typing import Dict, Optional, Tuple

_TICKET_TTL_SECONDS = 30
_tickets: Dict[str, Tuple[int, float]] = {}


def _prune(now: float) -> None:
    for ticket in [t for t, (_, exp) in _tickets.items() if exp < now]:
        _tickets.pop(ticket, None)


def issue_ticket(user_id: int) -> str:
    now = time.time()
    _prune(now)
    ticket = secrets.token_urlsafe(32)
    _tickets[ticket] = (user_id, now + _TICKET_TTL_SECONDS)
    return ticket


def consume_ticket(ticket: str) -> Optional[int]:
    now = time.time()
    _prune(now)
    entry = _tickets.pop(ticket, None)
    if not entry:
        return None
    user_id, expires_at = entry
    if expires_at < now:
        return None
    return user_id
