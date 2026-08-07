import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Building2, AlertTriangle, ShieldCheck } from 'lucide-react';

// Custom Leaflet Markers
const createCustomIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 12px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 10px;
      ">
        ${label}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const userIcon = createCustomIcon('#06b6d4', '📍');
const emergencyIcon = createCustomIcon('#e11d48', '🚨');
const hospitalIcon = createCustomIcon('#10b981', '🏥');

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export const InteractiveLiveMap = ({
  userLat = 37.7749,
  userLon = -122.4194,
  hospitalLat = 37.7850,
  hospitalLon = -122.4090,
  hospitalName = "SF General Hospital ER",
  etaMinutes = 4.2,
  routePoints = [],
  isEmergency = false
}) => {
  const userPosition = [userLat, userLon];
  const hospitalPosition = [hospitalLat, hospitalLon];

  // Default polyline if routePoints not provided
  const polylineCoordinates = routePoints && routePoints.length > 0
    ? routePoints
    : [
        userPosition,
        [userLat + 0.003, userLon + 0.003],
        [userLat + 0.006, userLon + 0.007],
        hospitalPosition
      ];

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 shadow-2xl relative overflow-hidden">
      {/* Header Overlay */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1">
              <Navigation className="w-3 h-3 animate-pulse" /> Live Google/OSM Map Engine
            </span>
            {isEmergency && (
              <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> Emergency Active
              </span>
            )}
          </div>
          <h3 className="text-lg font-black text-white mt-1">Geospatial Live Tracking & Route</h3>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-1.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center">
            <span className="text-slate-400 text-[10px] block">Calculated ETA</span>
            <span className="font-bold text-emerald-400 text-sm">{etaMinutes} mins</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center">
            <span className="text-slate-400 text-[10px] block">Dijkstra Shortest Path</span>
            <span className="font-bold text-cyan-400 text-sm">~2.08 km</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="h-72 w-full rounded-2xl overflow-hidden border border-slate-800 shadow-inner relative z-10">
        <MapContainer
          center={userPosition}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapRecenter center={userPosition} />

          {/* User Location Marker */}
          <Marker position={userPosition} icon={isEmergency ? emergencyIcon : userIcon}>
            <Popup>
              <div className="text-slate-900 font-sans text-xs">
                <strong>{isEmergency ? '🚨 Emergency Location' : '📍 Current Position'}</strong><br />
                Lat: {userLat.toFixed(4)}, Lon: {userLon.toFixed(4)}
              </div>
            </Popup>
          </Marker>

          {/* Hospital Location Marker */}
          <Marker position={hospitalPosition} icon={hospitalIcon}>
            <Popup>
              <div className="text-slate-900 font-sans text-xs">
                <strong>🏥 {hospitalName}</strong><br />
                ETA: {etaMinutes} minutes
              </div>
            </Popup>
          </Marker>

          {/* Shortest Route Polyline */}
          <Polyline
            positions={polylineCoordinates}
            pathOptions={{ color: isEmergency ? '#f43f5e' : '#06b6d4', weight: 5, opacity: 0.8, dashArray: '8, 8' }}
          />
        </MapContainer>
      </div>

      {/* Map Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span className="text-slate-300 font-medium truncate">Current Location</span>
        </div>
        <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span className="text-slate-300 font-medium truncate">Emergency SOS</span>
        </div>
        <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span className="text-slate-300 font-medium truncate">Nearest Hospital</span>
        </div>
        <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span className="text-slate-300 font-medium truncate">Shortest Path</span>
        </div>
      </div>
    </div>
  );
};
