import React, { useMemo, useEffect, useState } from 'react';
import { Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap, Circle } from 'react-leaflet';
import { cellToBoundary } from 'h3-js';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Helper to recenter map
const RecenterAutomatically = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
};

// SLA color scale
const getSlaColor = (score) => {
  const safeScore = Math.max(0, Math.min(100, score));
  const hue = (safeScore / 100) * 120;
  return `hsl(${hue}, 70%, 45%)`;
};

export const MapVisualizer = ({ clusters, metric, locationType = 'PICKUP', height = '100%' }) => {
  const [isClient, setIsClient] = useState(false);
  const [selectedHexes, setSelectedHexes] = useStateSet(new Set());

  const toggleSelection = (hexId) => {
    setSelectedHexes(prev => {
      const next = new Set(prev);
      if (next.has(hexId)) {
        next.delete(hexId);
      } else {
        next.add(hexId);
      }
      return next;
    });
  };

  const handleOpenNewTab = () => {
    // Save current state to localStorage
    const mapData = {
      clusters,
      metric,
      locationType,
      center: [13.0827, 80.2707] // Default center, or could be dynamic
    };
    localStorage.setItem('rideflow_map_data', JSON.stringify(mapData));

    // Open new tab
    window.open('/map', '_blank');
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Chennai defaults
  const chennaiCenter = [13.0827, 80.2707];

  const chennaiBounds = new L.LatLngBounds(
    [12.75, 79.90],
    [13.40, 80.50]
  );

  // Process clusters & compute center & percentiles
  const { center, validClusters, maxDemand, percentiles } = useMemo(() => {
    if (!clusters || clusters.length === 0) {
      return {
        center: chennaiCenter,
        validClusters: [],
        maxDemand: 0,
        percentiles: { p20: 0, p40: 0, p60: 0, p80: 0 }
      };
    }

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    let maxD = 0;
    const valid = [];
    const demands = [];

    clusters.forEach(c => {
      if (c.lat === 0 && c.lng === 0) return;

      valid.push(c);
      demands.push(c.demand);
      minLat = Math.min(minLat, c.lat);
      maxLat = Math.max(maxLat, c.lat);
      minLng = Math.min(minLng, c.lng);
      maxLng = Math.max(maxLng, c.lng);
      maxD = Math.max(maxD, c.demand);
    });

    if (valid.length === 0) {
      return {
        center: chennaiCenter,
        validClusters: [],
        maxDemand: 0,
        percentiles: { p20: 0, p40: 0, p60: 0, p80: 0 }
      };
    }

    // Calculate Percentiles for demand distribution
    demands.sort((a, b) => a - b);
    const getP = (p) => demands[Math.floor(demands.length * p)] || 0;

    return {
      center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
      validClusters: valid,
      maxDemand: maxD,
      percentiles: {
        p20: getP(0.2),
        p40: getP(0.4),
        p60: getP(0.6),
        p80: getP(0.8)
      }
    };
  }, [clusters]);

  // Dynamic continuous color scale based on demand percentiles
  const getCustomDemandColor = (value) => {
    if (value === 0 || maxDemand === 0) return 'transparent';

    const { p20, p40, p60, p80 } = percentiles;

    // Map demand to a smooth 0–1 scale using piecewise-linear segments between percentiles.
    let t = 0;
    if (value <= p20) {
      t = p20 === 0 ? 0 : (value / p20) * 0.2;
    } else if (value <= p40) {
      t = 0.2 + ((value - p20) / Math.max(1, p40 - p20)) * 0.2;
    } else if (value <= p60) {
      t = 0.4 + ((value - p40) / Math.max(1, p60 - p40)) * 0.2;
    } else if (value <= p80) {
      t = 0.6 + ((value - p60) / Math.max(1, p80 - p60)) * 0.2;
    } else {
      t = 0.8 + ((value - p80) / Math.max(1, maxDemand - p80)) * 0.2;
    }

    // Clamp and convert to a pleasant teal → navy gradient
    const clamped = Math.max(0, Math.min(1, t));
    const hue = 160 - clamped * 40;       // 160 (light teal) → 120 (deeper green)
    const lightness = 80 - clamped * 35;  // 80% → 45%
    return `hsl(${hue}, 65%, ${lightness}%)`;
  };

  // Build polygons
  const polygons = useMemo(() => {
    if (!validClusters.length) return [];

    return validClusters
      .map(cluster => {
        try {
          const boundary = cellToBoundary(cluster.hexId);

          const color =
            metric === 'SLA'
              ? getSlaColor(cluster.slaComplianceScore)
              : getCustomDemandColor(cluster.demand);

          return {
            ...cluster,
            positions: boundary,
            color
          };
        } catch {
          console.error("Invalid hex", cluster.hexId);
          return null;
        }
      })
      .filter(Boolean);
  }, [validClusters, metric, maxDemand]);

  // Stable hook
  const mapInstanceKey = useMemo(() => {
    if (!validClusters.length) return `${metric}-empty`;
    return `${metric}-${validClusters.map(c => c.hexId).join('|')}`;
  }, [metric, validClusters]);

  // FINAL JSX — no early returns anywhere
  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm z-0`} style={{ height }}>
      {/* Only show "Open in New Tab" if NOT already in standalone mode (height check is a proxy, or pass a prop) */}
      {height !== '100vh' && (
        <button
          onClick={handleOpenNewTab}
          className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow-md hover:bg-slate-50 text-slate-600 transition-all"
          title="Open in New Tab"
        >
          <ExternalLink className="w-5 h-5" />
        </button>
      )}

      {/* SHOW LOADING */}
      {!isClient ? (
        <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400 animate-pulse">
          Loading map...
        </div>
      ) : !clusters ? (
        <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
          No map data available
        </div>
      ) : (
        // @ts-ignore - react-leaflet types may not match runtime props
        <MapContainer
          key={mapInstanceKey}
          center={center}
          zoom={11}
          minZoom={10}
          maxBounds={chennaiBounds}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={true}
          preferCanvas={true}
          style={{ height: '100%', width: '100%' }}
        >
          {/* @ts-ignore */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <RecenterAutomatically lat={center[0]} lng={center[1]} />

          <RecenterAutomatically lat={center[0]} lng={center[1]} />

          {polygons.map(poly => {
            const isSelected = selectedHexes.has(poly.hexId);
            return (
              <Polygon
                key={poly.hexId}
                positions={poly.positions}
                eventHandlers={{
                  click: () => toggleSelection(poly.hexId)
                }}
                pathOptions={{
                  color: isSelected ? '#F59E0B' : poly.color, // Amber-500 for selection
                  fillColor: poly.color,
                  fillOpacity: isSelected ? 0.8 : 0.7,
                  weight: isSelected ? 4 : 1,
                  stroke: true,
                  opacity: isSelected ? 1 : 0.5,
                  dashArray: isSelected ? undefined : undefined
                }}
              >
                {/* @ts-ignore */}
                <Tooltip permanent={false} interactive>
                  <div className="text-xs font-sans p-1">
                    <p className="font-bold mb-1 text-indigo-900">
                      Hex: {poly.hexId}
                      {isSelected && <span className="ml-2 text-amber-600">(Selected)</span>}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-slate-500">Demand:</span>
                      <span className="font-medium">{poly.demand}</span>

                      <span className="text-slate-500">Autos Needed:</span>
                      <span className="font-medium">{poly.requiredSupply}</span>

                      <span className="text-slate-500">Allocated:</span>
                      <span className="font-medium">{poly.allocatedSupply}</span>

                      <span className="text-slate-500">Demand Score:</span>
                      <span className="font-medium">{poly.demandScore}</span>

                      <span className="text-slate-500">Score:</span>
                      <span
                        className={`font-medium ${poly.slaComplianceScore > 80 ? 'text-green-600' : 'text-orange-600'
                          }`}
                      >
                        {poly.slaComplianceScore}%
                      </span>

                      <span className="col-span-2 border-t border-slate-100 my-1"></span>

                      <span className="text-slate-500 text-[10px]">Completed:</span>
                      <span className="font-medium text-[10px] text-green-600">{poly.completed || 0}</span>

                      <span className="text-slate-500 text-[10px]">Cancelled:</span>
                      <span className="font-medium text-[10px] text-red-500">{poly.cancelled || 0}</span>

                      <span className="text-slate-500 text-[10px]">No Driver:</span>
                      <span className="font-medium text-[10px] text-orange-500">{poly.driverNotFound || 0}</span>

                      <span className="text-slate-500 text-[10px]">Unknown:</span>
                      <span className="font-medium text-[10px] text-gray-400">{poly.unknown || 0}</span>
                    </div>
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}
        </MapContainer>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 right-4 bg-white/95 backdrop-blur p-3 rounded-lg border border-slate-200 text-xs shadow-lg z-[1000]">
        <div className="font-semibold mb-2 text-slate-700">
          {metric === 'SLA' ? 'SLA Compliance' : 'Demand (Low → High)'}
        </div>

        {metric === 'SLA' ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-[hsl(120,70%,45%)]" />
              <span>High (100%)</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-[hsl(60,70%,45%)]" />
              <span>Medium (50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[hsl(0,70%,45%)]" />
              <span>Low (0%)</span>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-2 rounded bg-[hsl(160,65%,80%)]" />
              <span>Low (&lt;~p20)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-2 rounded bg-[hsl(140,65%,60%)]" />
              <span>Medium (~p40–p60)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-2 rounded bg-[hsl(120,65%,45%)]" />
              <span>High (&gt;~p80)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
