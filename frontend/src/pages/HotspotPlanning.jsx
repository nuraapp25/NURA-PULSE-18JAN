import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, MapPin, Clock, TrendingUp, Users, Download, Library, Copy } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Time slot definitions matching backend
const TIME_SLOTS = [
  { name: "Morning Rush", label: "6AM-9AM", color: "bg-green-500" },
  { name: "Mid-Morning", label: "9AM-12PM", color: "bg-teal-400" },
  { name: "Afternoon", label: "12PM-4PM", color: "bg-teal-400" },
  { name: "Evening Rush", label: "4PM-7PM", color: "bg-green-400" },
  { name: "Night", label: "7PM-10PM", color: "bg-teal-400" },
  { name: "Late Night", label: "10PM-1AM", color: "bg-teal-400" }
];

// Map center updater component
function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 12);
    }
  }, [center, map]);
  return null;
}

function HotspotPlanning() {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [library, setLibrary] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/hotspot-planning/library`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setLibrary(response.data.analyses);
      }
    } catch (error) {
      console.error('Failed to fetch library:', error);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        toast.success(`File selected: ${selectedFile.name}`);
      } else {
        toast.error('Please select a CSV file');
      }
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/api/hotspot-planning/analyze-and-save`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setAnalysisResult(response.data.analysis);
        toast.success('Analysis complete!');
        fetchLibrary();
        
        // Auto-select first slot with data
        const firstSlotWithData = TIME_SLOTS.find(slot => 
          response.data.analysis.time_slots[slot.name]?.status === 'success'
        );
        if (firstSlotWithData) {
          setSelectedSlot(firstSlotWithData.name);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setAnalysisResult(null);
    setSelectedSlot(null);
  };

  const copyCoordinates = (lat, lon) => {
    navigator.clipboard.writeText(`${lat}, ${lon}`);
    toast.success('Coordinates copied!');
  };

  const downloadReport = () => {
    if (!selectedSlot || !analysisResult) return;
    
    const slotData = analysisResult.time_slots[selectedSlot];
    if (!slotData.hotspots) return;

    const csv = [
      ['Rank', 'Latitude', 'Longitude', 'Covered Count', 'Covered Weight'],
      ...slotData.hotspots.map(h => [h.rank, h.lat, h.lon, h.covered_count, h.covered_weight])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hotspots_${selectedSlot.replace(/\s+/g, '_')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const selectedSlotData = selectedSlot && analysisResult ? 
    analysisResult.time_slots[selectedSlot] : null;

  // Calculate map center from hotspots
  const mapCenter = selectedSlotData?.hotspots && selectedSlotData.hotspots.length > 0 ?
    [selectedSlotData.hotspots[0].lat, selectedSlotData.hotspots[0].lon] :
    [13.0827, 80.2707]; // Chennai default

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="text-blue-600" />
            Hotspot Planning
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Time slot-based optimal location placement for 5-minute pickup coverage (IST)
          </p>
        </div>
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
        >
          <Library className="w-4 h-4" />
          View Library
        </button>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Ride Data
        </h2>
        
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto text-blue-500 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {file ? file.name : 'Click to upload or drag and drop'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              CSV with pickupLat, pickupLong, dropLat, dropLong, time (UTC)
            </p>
          </label>
        </div>

        <div className="flex gap-4 mt-4">
          <button
            onClick={handleAnalyze}
            disabled={!file || analyzing}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            <TrendingUp className="w-5 h-5" />
            {analyzing ? 'Analyzing...' : 'Analyze & Optimize'}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Reset
          </button>
        </div>

        {/* How it works */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            How it works:
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-6 list-disc">
            <li>Converts UTC time to IST automatically</li>
            <li>Analyzes 6 time slots: Morning Rush, Mid-Morning, Afternoon, Evening Rush, Night, Late Night</li>
            <li>Finds up to 5 optimal hotspot locations per time slot using CELF + 1-Swap algorithm</li>
            <li>Shows 1km coverage radius for each hotspot (≈5-min pickup at urban speeds)</li>
          </ul>
        </div>
      </div>

      {/* Time Slots */}
      {analysisResult && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Select Time Slot
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TIME_SLOTS.map((slot) => {
              const data = analysisResult.time_slots[slot.name];
              const isSuccess = data?.status === 'success';
              const isSelected = selectedSlot === slot.name;
              
              return (
                <button
                  key={slot.name}
                  onClick={() => isSuccess && setSelectedSlot(slot.name)}
                  disabled={!isSuccess}
                  className={`p-4 rounded-lg text-left transition-all ${
                    isSelected 
                      ? slot.color + ' text-white shadow-lg scale-105'
                      : isSuccess
                      ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="font-semibold text-lg">{slot.name} ({slot.label})</div>
                  {isSuccess && (
                    <div className="text-sm mt-1">
                      {data.rides_count} rides • {data.coverage_percentage}% coverage
                    </div>
                  )}
                  {!isSuccess && (
                    <div className="text-xs mt-1">
                      {data?.message || 'Insufficient data'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Slot Details */}
      {selectedSlotData && selectedSlotData.status === 'success' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                Coverage Rate
              </div>
              <div className="text-3xl font-bold text-green-600">
                {selectedSlotData.coverage_percentage}%
              </div>
              <div className="text-xs text-gray-500">Trips within 1km</div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                <Users className="w-4 h-4" />
                Total Rides
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {selectedSlotData.rides_count}
              </div>
              <div className="text-xs text-gray-500">In this time slot</div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                Covered Rides
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {selectedSlotData.covered_rides}
              </div>
              <div className="text-xs text-gray-500">Within 1km radius</div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                <MapPin className="w-4 h-4" />
                Hotspots
              </div>
              <div className="text-3xl font-bold text-orange-600">
                {selectedSlotData.hotspots?.length || 0}
              </div>
              <div className="text-xs text-gray-500">Optimal locations</div>
            </div>
          </div>

          {/* Map */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Hotspot Map for {selectedSlot}
              </h2>
            </div>
            
            <div className="h-96 rounded-lg overflow-hidden">
              <MapContainer
                center={mapCenter}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
              >
                <MapCenterUpdater center={mapCenter} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                
                {/* Hotspots */}
                {selectedSlotData.hotspots?.map((hotspot, idx) => (
                  <React.Fragment key={idx}>
                    {/* Hotspot marker */}
                    <CircleMarker
                      center={[hotspot.lat, hotspot.lon]}
                      radius={10}
                      fillColor="#f59e0b"
                      color="#fff"
                      weight={2}
                      fillOpacity={0.9}
                    >
                      <Popup>
                        <div>
                          <strong>Hotspot #{hotspot.rank}</strong><br />
                          Lat: {hotspot.lat.toFixed(6)}<br />
                          Lon: {hotspot.lon.toFixed(6)}<br />
                          Covered: {hotspot.covered_count} rides
                        </div>
                      </Popup>
                    </CircleMarker>
                    
                    {/* Coverage circle */}
                    <Circle
                      center={[hotspot.lat, hotspot.lon]}
                      radius={1000}
                      fillColor="#10b981"
                      color="#10b981"
                      weight={2}
                      fillOpacity={0.1}
                    />
                  </React.Fragment>
                ))}
                
                {/* Pickup points */}
                {selectedSlotData.geojson?.features
                  .filter(f => f.properties.type === 'pickup')
                  .slice(0, 200) // Limit for performance
                  .map((feature, idx) => (
                    <CircleMarker
                      key={`pickup-${idx}`}
                      center={[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]}
                      radius={3}
                      fillColor={feature.properties.assigned_rank > 0 ? '#3b82f6' : '#ef4444'}
                      color="transparent"
                      fillOpacity={0.5}
                    />
                  ))
                }
              </MapContainer>
            </div>
            
            <div className="flex gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Hotspot Locations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Covered Pickups</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Uncovered Pickups</span>
              </div>
            </div>
          </div>

          {/* Hotspot Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Hotspot Locations for {selectedSlot}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadReport}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Locality</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Coordinates (Lat, Long)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Covered Rides</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedSlotData.hotspots?.map((hotspot) => (
                    <tr key={hotspot.rank} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        #{hotspot.rank}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {hotspot.locality || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 font-mono">
                        {hotspot.lat.toFixed(6)}, {hotspot.lon.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {hotspot.covered_count}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => copyCoordinates(hotspot.lat, hotspot.lon)}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Library className="w-6 h-6" />
                  Analysis Library
                </h2>
                <button
                  onClick={() => setShowLibrary(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {library.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400">No saved analyses yet</p>
              ) : (
                <div className="space-y-4">
                  {library.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        // Load this analysis
                        setShowLibrary(false);
                        toast.info('Loading analysis...');
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{item.filename}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(item.uploaded_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.total_rides} rides
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {item.time_slots_count} slots
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HotspotPlanning;
