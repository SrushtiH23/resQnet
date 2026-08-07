from typing import List, Dict, Any
from fastapi import WebSocket

class LiveTrackingWebSocketManager:
    """
    Module 11: Real-Time Live Location & Telemetry WebSockets Manager
    Streams location, speed, status, and ETA updates every 5 seconds to family & hospital dashboards.
    """
    def __init__(self):
        # Maps emergency_id -> List[WebSocket]
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, emergency_id: int):
        await websocket.accept()
        if emergency_id not in self.active_connections:
            self.active_connections[emergency_id] = []
        self.active_connections[emergency_id].append(websocket)

    def disconnect(self, websocket: WebSocket, emergency_id: int):
        if emergency_id in self.active_connections:
            if websocket in self.active_connections[emergency_id]:
                self.active_connections[emergency_id].remove(websocket)

    async def broadcast_location(self, emergency_id: int, telemetry_data: Dict[str, Any]):
        if emergency_id in self.active_connections:
            to_remove = []
            for connection in self.active_connections[emergency_id]:
                try:
                    await connection.send_json(telemetry_data)
                except Exception:
                    to_remove.append(connection)
            for conn in to_remove:
                self.active_connections[emergency_id].remove(conn)

ws_manager = LiveTrackingWebSocketManager()
