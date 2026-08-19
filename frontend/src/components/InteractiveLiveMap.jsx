import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, AlertTriangle, ExternalLink, Star } from 'lucide-react';

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
        font-size: 11px;
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
const verifiedHospitalIcon = createCustomIcon('#10b981', '🏥');
const discoveredHospitalIcon = createCustomIcon('#6366f1', '🏢');

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== undefined && center[1] !== undefined) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export const InteractiveLiveMap = ({
  userLat,
  userLon,
  hospitalLat = null,
  hospitalLon = null,
  hospitalName = null,
  etaMinutes = null,
  routePoints = [],
  isEmergency = false,
  hospitalsList = [],
  showHeader = true,
  height = 'h-72'
}) => {
  // Graceful coordinate verification
  const validUserLat = (typeof userLat === 'number' && !isNaN(userLat)) ? userLat : 12.9716; // Default to Bengaluru center
  const validUserLon = (typeof userLon === 'number' && !isNaN(userLon)) ? userLon : 77.5946;

  const userPosition = [validUserLat, validUserLon];
  const hasHospital = (typeof hospitalLat === 'number' && !isNaN(hospitalLat) && typeof hospitalLon === 'number' && !isNaN(hospitalLon));
  const hospitalPosition = hasHospital ? [hospitalLat, hospitalLon] : null;

  // Polyline coordinates if assigned hospital is present during emergency
  const polylineCoordinates = (hasHospital && routePoints && routePoints.length > 0)
    ? routePoints
    : (hasHospital ? [userPosition, hospitalPosition] : []);

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 shadow-2xl relative overflow-hidden">
      {/* Header Overlay */}
      {showHeader && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1 font-mono">
                <Navigation className="w-3 h-3 animate-pulse" /> Live Google/OSM Map Engine
              </span>
              {isEmergency && (
                <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3" /> Emergency Active
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-white mt-1">Real-Time Geolocation & Real Hospitals</h3>
          </div>

          {hasHospital && etaMinutes && (
            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="px-3 py-1.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] block">Calculated ETA</span>
                <span className="font-bold text-emerald-400 text-sm">{etaMinutes} mins</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map Container */}
      <div className={`${height} w-full rounded-2xl overflow-hidden border border-slate-800 shadow-inner relative z-10`}>
        <MapContainer
          center={userPosition}
          zoom={13}
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
              <div className="text-slate-900 font-sans text-xs p-1 space-y-1">
                <strong>{isEmergency ? '🚨 Emergency SOS Position' : '📍 Current Position'}</strong><br />
                <span className="text-[11px] text-slate-600">Lat: {validUserLat.toFixed(5)}, Lon: {validUserLon.toFixed(5)}</span>
              </div>
            </Popup>
          </Marker>

          {/* Assigned Emergency Hospital Marker */}
          {hasHospital && (
            <Marker position={hospitalPosition} icon={verifiedHospitalIcon}>
              <Popup>
                <div className="text-slate-900 font-sans text-xs space-y-1 p-1">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                    Assigned ResQNet Hospital
                  </span>
                  <strong className="block text-sm text-slate-900 mt-1">{hospitalName || 'Emergency Medical Center'}</strong>
                  {etaMinutes && <p className="text-emerald-700 font-bold text-xs">ETA: {etaMinutes} mins</p>}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Real Discovered & Verified Hospitals Markers */}
          {hospitalsList.map((h) => {
            if (!h.latitude || !h.longitude) return null;
            // Skip assigned hospital to avoid duplicate marker
            if (hasHospital && Math.abs(h.latitude - hospitalLat) < 0.0001 && Math.abs(h.longitude - hospitalLon) < 0.0001) {
              return null;
            }

            const isVerified = h.is_registered_resqnet && h.verification_status === 'VERIFIED';
            const pos = [h.latitude, h.longitude];

            return (
              <Marker key={h.id || h.google_place_id} position={pos} icon={isVerified ? verifiedHospitalIcon : discoveredHospitalIcon}>
                <Popup>
                  <div className="text-slate-900 font-sans text-xs p-1 space-y-1.5 max-w-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 font-extrabold text-[9px] rounded uppercase ${
                        isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {isVerified ? 'ResQNet Verified' : 'Google Discovered'}
                      </span>
                      {h.rating && (
                        <span className="flex items-center gap-0.5 text-amber-600 font-bold text-[10px]">
                          <Star className="w-3 h-3 fill-amber-500" /> {h.rating}
                        </span>
                      )}
                    </div>

                    <strong className="block text-sm text-slate-900 leading-tight">{h.name}</strong>
                    <p className="text-[11px] text-slate-600">{h.address}</p>

                    {h.phone && (
                      <p className="text-[11px] font-mono text-slate-700 font-bold">📞 {h.phone}</p>
                    )}

                    {h.distance_km !== undefined && h.distance_km !== null && (
                      <p className="text-[11px] font-mono text-cyan-700 font-bold">
                        Distance: {h.distance_km} km
                      </p>
                    )}

                    <div className="pt-1 flex items-center gap-2">
                      <a
                        href={h.maps_url || `https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-cyan-600 text-white font-bold text-[10px] rounded flex items-center gap-1 hover:bg-cyan-700 transition-colors no-underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Get Directions
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Route Polyline if emergency route active */}
          {hasHospital && polylineCoordinates.length > 0 && (
            <Polyline
              positions={polylineCoordinates}
              pathOptions={{ color: isEmergency ? '#f43f5e' : '#06b6d4', weight: 5, opacity: 0.8, dashArray: '8, 8' }}
            />
          )}
        </MapContainer>
      </div>

      {/* Map Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span className="text-slate-300 font-medium truncate">User Location</span>
        </div>
        <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span className="text-slate-300 font-medium truncate">Verified Hospital</span>
        </div>
        <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
          <span className="text-slate-300 font-medium truncate">Google Discovered</span>
        </div>
        <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span className="text-slate-300 font-medium truncate">Emergency SOS</span>
        </div>
      </div>
    </div>
  );
};
