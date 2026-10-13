"""Realtime notifications: in-process SSE broker + persisted history.

The broker remains in-process (a single modular-monolith deployment does not
justify an event bus); each notification is also persisted so the bell can show
history and unread counts, and so nothing is lost if the client is offline when
the event fires.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, List, Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


class NotificationManager:
    def __init__(self) -> None:
        self._subscribers: Dict[int, List[asyncio.Queue]] = {}

    def subscribe(self, user_id: int) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.setdefault(user_id, []).append(queue)
        return queue

    def unsubscribe(self, user_id: int, queue: asyncio.Queue) -> None:
        queues = self._subscribers.get(user_id, [])
        if queue in queues:
            queues.remove(queue)
        if not queues:
            self._subscribers.pop(user_id, None)

    def publish(self, user_id: int, message: dict) -> None:
        for queue in self._subscribers.get(user_id, []):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                pass

    async def notify(
        self,
        db: AsyncSession,
        user_ids: Sequence[int],
        *,
        type: str,
        title: str,
        message: Optional[str] = None,
        severity: str = "info",
        payload: Optional[dict] = None,
        target_type: Optional[str] = None,
        target_id: Optional[int] = None,
    ) -> None:
        """Persist + push a notification to each recipient."""
        for user_id in set(user_ids):
            record = Notification(
                user_id=user_id,
                type=type,
                title=title,
                message=message,
                severity=severity,
                payload=json.dumps(payload, ensure_ascii=False) if payload else None,
                target_type=target_type,
                target_id=target_id,
            )
            db.add(record)
        await db.flush()

        event = {
            "event": type,
            "title": title,
            "message": message,
            "severity": severity,
            "target_type": target_type,
            "target_id": target_id,
            "payload": payload or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        for user_id in set(user_ids):
            self.publish(user_id, event)

    async def event_generator(
        self, user_id: int, queue: asyncio.Queue
    ) -> AsyncGenerator[str, None]:
        try:
            yield "event: ready\ndata: connected\n\n"
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {json.dumps(message, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield "event: heartbeat\ndata: ping\n\n"
        finally:
            self.unsubscribe(user_id, queue)


notification_manager = NotificationManager()
