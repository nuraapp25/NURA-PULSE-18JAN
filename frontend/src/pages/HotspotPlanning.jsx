import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Upload, MapPin, Clock, TrendingUp, Users, Download, Library, Copy } from 'lucide-react';
import { GoogleMap, LoadScript, Marker, Circle, InfoWindow } from '@react-google-maps/api';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBSkRVGAnQUQY6NFklYVQQfqUBxWX1CU2c';

// Time slot definitions matching backend
const TIME_SLOTS = [
  { name: "Morning Rush", label: "6AM-9AM", color: "bg-green-500" },
  { name: "Mid-Morning", label: "9AM-12PM", color: "bg-teal-400" },
  { name: "Afternoon", label: "12PM-4PM", color: "bg-teal-400" },
  { name: "Evening Rush", label: "4PM-7PM", color: "bg-green-400" },
  { name: "Night", label: "7PM-10PM", color: "bg-teal-400" },
  { name: "Late Night", label: "10PM-1AM", color: "bg-teal-400" }
];

const mapContainerStyle = {
  width: '100%',
  height: '600px',
  borderRadius: '0.5rem'
};

function HotspotPlanning() {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [library, setLibrary] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 13.0827, lng: 80.2707 }); // Chennai
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  const selectedSlotData = analysisResult?.time_slots?.[selectedSlot];

  useEffect(() => {
    fetchLibrary();
  }, []);

  // Update map center when new analysis is loaded
  useEffect(() => {
    if (selectedSlotData?.hotspots?.length > 0) {
      const firstHotspot = selectedSlotData.hotspots[0];
      setMapCenter({ lat: firstHotspot.lat, lng: firstHotspot.lon });
    }
  }, [selectedSlotData]);

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
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setAnalysisResult(null);
    setSelectedSlot(null);
    setSelectedHotspot(null);
  };

  const loadFromLibrary = (analysis) => {
    setAnalysisResult(analysis);
    setShowLibrary(false);
    const firstSlotWithData = TIME_SLOTS.find(slot => 
      analysis.time_slots[slot.name]?.status === 'success'
    );
    if (firstSlotWithData) {
      setSelectedSlot(firstSlotWithData.name);
    }
    toast.success('Analysis loaded from library');
  };

  const copyCoordinates = (lat, lon) => {
    navigator.clipboard.writeText(`${lat}, ${lon}`);
    toast.success('Coordinates copied to clipboard');
  };

  const downloadReport = () => {
    if (!selectedSlotData) return;
    
    const report = {
      time_slot: selectedSlot,
      analysis_date: analysisResult.created_at,
      metrics: {
        total_rides: selectedSlotData.rides_count,
        covered_rides: selectedSlotData.covered_rides,
        coverage_percentage: selectedSlotData.coverage_percentage
      },
      hotspots: selectedSlotData.hotspots
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hotspot-report-${selectedSlot.replace(/\s+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Report downloaded');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <MapPin className="w-8 h-8 text-orange-500" />
              Hotspot Planning
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Optimize charging station locations with AI-powered analysis
            </p>
          </div>
          <button
            onClick={() => setShowLibrary(true)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <Library className="w-5 h-5" />
            Library ({library.length})
          </button>
        </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Ride Data
        </h2>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <Upload className="w-12 h-12 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {file ? file.name : 'Click to upload CSV file'}
              </span>
              <span className="text-xs text-gray-500 mt-1">
                CSV with pickup coordinates and timestamps
              </span>
            </label>
          </div>
          
          <div className="flex gap-3">
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
            <li><strong>Displays ALL pickup points on Google Maps</strong></li>
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

          {/* Google Map */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Coverage Map - {selectedSlot}
            </h2>
            
            <div className="rounded-lg overflow-hidden">
              <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={12}
                  options={{
                    styles: [
                      {
                        featureType: "poi",
                        elementType: "labels",
                        stylers: [{ visibility: "off" }]
                      }
                    ]
                  }}
                >
                  {/* Hotspot Markers and Circles */}
                  {selectedSlotData.hotspots?.map((hotspot, idx) => (
                    <React.Fragment key={`hotspot-${idx}`}>
                      {/* Hotspot Circle (1km radius) */}
                      <Circle
                        center={{ lat: hotspot.lat, lng: hotspot.lon }}
                        radius={1000}
                        options={{
                          fillColor: '#10b981',
                          fillOpacity: 0.15,
                          strokeColor: '#10b981',
                          strokeWeight: 2
                        }}
                      />
                      
                      {/* Hotspot Marker */}
                      <Marker
                        position={{ lat: hotspot.lat, lng: hotspot.lon }}
                        icon={{
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 15,
                          fillColor: '#f97316',
                          fillOpacity: 1,
                          strokeColor: '#ffffff',
                          strokeWeight: 3
                        }}
                        label={{
                          text: `${hotspot.rank}`,
                          color: '#ffffff',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}
                        onClick={() => setSelectedHotspot(hotspot)}
                      />
                      
                      {/* InfoWindow for selected hotspot */}
                      {selectedHotspot?.rank === hotspot.rank && (
                        <InfoWindow
                          position={{ lat: hotspot.lat, lng: hotspot.lon }}
                          onCloseClick={() => setSelectedHotspot(null)}
                        >
                          <div className="p-2">
                            <h3 className="font-bold text-base">Hotspot #{hotspot.rank}</h3>
                            <p className="text-sm">{hotspot.locality || 'Unknown'}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              Covers {hotspot.covered_count} rides
                            </p>
                          </div>
                        </InfoWindow>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* ALL Pickup Points - NO LIMIT */}
                  {selectedSlotData.geojson?.features
                    .filter(f => f.properties.type === 'pickup')
                    .map((feature, idx) => {
                      const isCovered = feature.properties.assigned_rank > 0;
                      return (
                        <Marker
                          key={`pickup-${idx}`}
                          position={{
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0]
                          }}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 4,
                            fillColor: isCovered ? '#3b82f6' : '#ef4444',
                            fillOpacity: isCovered ? 0.6 : 0.5,
                            strokeColor: 'transparent'
                          }}
                        />
                      );
                    })
                  }
                </GoogleMap>
              </LoadScript>
            </div>
            
            <div className="flex gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Hotspot Locations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Covered Pickups ({selectedSlotData.covered_rides})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Uncovered Pickups ({selectedSlotData.rides_count - selectedSlotData.covered_rides})</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analysis Library</h2>
                <button
                  onClick={() => setShowLibrary(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              
              {library.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No saved analyses yet</p>
              ) : (
                <div className="space-y-3">
                  {library.map((analysis, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => loadFromLibrary(analysis)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{analysis.filename}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(analysis.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                          {Object.keys(analysis.time_slots).length} time slots
                        </span>
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
    </div>
  );
}

export default HotspotPlanning;
