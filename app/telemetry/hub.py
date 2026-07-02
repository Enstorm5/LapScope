"""Fan-out of parsed telemetry frames to WebSocket subscribers, plus stream stats."""

from __future__ import annotations

import asyncio


class Hub:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        self.packets_total = 0
        self.bad_packets = 0
        self.last_packet_time: float | None = None
        self.last_packet_size: int | None = None

    def subscribe(self, maxsize: int = 120) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=maxsize)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def publish(self, msg: dict) -> None:
        for q in self._subscribers:
            if q.full():  # slow client: drop its oldest frame, never block the listener
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            q.put_nowait(msg)
