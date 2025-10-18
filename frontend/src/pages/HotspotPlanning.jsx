import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, MapPin, TrendingUp, Clock, Target, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { API } from "@/App";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom icons
const vehicleIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [15, 25],
  iconAnchor: [7, 25],
  popupAnchor: [1, -20],
  shadowSize: [25, 25]
});

// Component to fit map to bounds
function MapBounds({ bounds }) {
  const map = useMap();
  React.useEffect(() => {
    if (bounds && bounds.length === 2) {
      map.fitBounds(bounds);
    }
  }, [bounds, map]);
  return null;
}

const HotspotPlanning = () => {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error("Please upload a CSV file");
        return;
      }
      setFile(selectedFile);
      toast.success(`File selected: ${selectedFile.name}`);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Please select a CSV file first");
      return;
    }

    setAnalyzing(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(
        `${API}/hotspot-planning/analyze`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 60000 // 60 seconds
        }
      );

      if (response.data.success) {
        setResults(response.data);
        toast.success(
          <div>
            <p className="font-semibold">Analysis Complete!</p>
            <p className="text-sm mt-1">{response.data.message}</p>
          </div>,
          { duration: 5000 }
        );
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error.response?.data?.detail || "Failed to analyze data");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResults(null);
  };

  // Calculate map bounds if results exist
  const getMapBounds = () => {
    if (!results || !results.cluster_stats || results.cluster_stats.length === 0) {
      return [[13.0827, 80.2707], [13.0827, 80.2707]]; // Default Chennai center
    }

    const lats = results.cluster_stats.map(c => c.placement_lat);
    const lngs = results.cluster_stats.map(c => c.placement_long);

    return [
      [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
      [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05]
    ];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🎯 Hotspot Planning</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Strategic vehicle placement optimization for 5-minute pickup coverage
        </p>
      </div>

      {/* Upload Section */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">📤 Upload Ride Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload size={48} className="mx-auto text-blue-500 dark:text-blue-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {file ? file.name : "Click to upload CSV file"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  CSV file with pickupLat, pickupLong, dropLat, dropLong columns
                </p>
              </label>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleAnalyze}
                disabled={!file || analyzing}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {analyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Target size={18} className="mr-2" />
                    Analyze & Optimize
                  </>
                )}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                disabled={!file && !results}
              >
                Reset
              </Button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Upload CSV with ride request data (pickup/drop coordinates)</li>
                    <li>Algorithm clusters 100sqkm area into 10 optimal vehicle zones</li>
                    <li>Calculates 5-min coverage at 5 km/hr Chennai traffic speed</li>
                    <li>Shows placement recommendations on interactive Chennai map</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Coverage Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {results.summary.coverage_percentage}%
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Trips within 5 minutes
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Rides
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {results.summary.total_rides_analyzed}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Analyzed from CSV
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Covered Rides
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {results.summary.rides_within_5min}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Within 420m radius
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Avg Distance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {results.summary.average_distance_to_nearest_vehicle}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  km to nearest vehicle
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Map */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                🗺️ Chennai Placement Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                <MapContainer
                  center={[13.0827, 80.2707]}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapBounds bounds={getMapBounds()} />
                  
                  {/* Vehicle Placement Points with Coverage Circles */}
                  {results.cluster_stats.map((cluster, idx) => (
                    <React.Fragment key={idx}>
                      <Circle
                        center={[cluster.placement_lat, cluster.placement_long]}
                        radius={417} // 5 min at 5 km/hr = 0.417 km = 417 meters
                        pathOptions={{
                          color: cluster.coverage_percentage > 80 ? 'green' : cluster.coverage_percentage > 60 ? 'orange' : 'red',
                          fillColor: cluster.coverage_percentage > 80 ? 'green' : cluster.coverage_percentage > 60 ? 'orange' : 'red',
                          fillOpacity: 0.1
                        }}
                      />
                      <Marker
                        position={[cluster.placement_lat, cluster.placement_long]}
                        icon={vehicleIcon}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-bold">Vehicle #{idx + 1}</p>
                            <p>Lat: {cluster.placement_lat.toFixed(6)}</p>
                            <p>Long: {cluster.placement_long.toFixed(6)}</p>
                            <p className="mt-2">Assigned: {cluster.total_rides_assigned} rides</p>
                            <p>Coverage: {cluster.coverage_percentage.toFixed(1)}%</p>
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  ))}

                  {/* Pickup Points (sample) */}
                  {results.pickup_points && results.pickup_points.slice(0, 200).map((point, idx) => (
                    <Marker
                      key={`pickup-${idx}`}
                      position={[point[0], point[1]]}
                      icon={pickupIcon}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">Pickup Request</p>
                          <p>{point[2] ? '✓ Within 5 min' : '✗ Outside 5 min'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              <div className="mt-4 flex items-center space-x-6 text-sm">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                  <span>Vehicle Placement</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span>Pickup Requests</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-green-500 rounded-full mr-2"></div>
                  <span>5-min Coverage (420m)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Placement Recommendations */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                📍 Top Vehicle Placement Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vehicle #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Latitude</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Longitude</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rides Assigned</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Within 5-min</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Coverage %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {results.cluster_stats.map((cluster, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {cluster.placement_lat.toFixed(6)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {cluster.placement_long.toFixed(6)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {cluster.total_rides_assigned}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {cluster.rides_within_5min}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            cluster.coverage_percentage > 80
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : cluster.coverage_percentage > 60
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {cluster.coverage_percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Time-based Analysis */}
          {results.time_analysis && Object.keys(results.time_analysis.hourly_demand || {}).length > 0 && (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">
                  ⏰ Hourly Demand Pattern
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(results.time_analysis.hourly_demand).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([hour, demand]) => {
                    const coverage = results.time_analysis.hourly_coverage[hour] || 0;
                    const coveragePercent = results.time_analysis.hourly_coverage_percentage[hour] || 0;
                    
                    return (
                      <div key={hour} className="flex items-center space-x-4">
                        <div className="w-16 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {hour}:00
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-8 overflow-hidden">
                              <div
                                className="bg-blue-500 h-full flex items-center justify-end pr-2 text-xs text-white font-medium"
                                style={{ width: `${(demand / Math.max(...Object.values(results.time_analysis.hourly_demand))) * 100}%` }}
                              >
                                {demand > 0 && demand}
                              </div>
                            </div>
                            <div className="w-20 text-right text-sm text-gray-600 dark:text-gray-400">
                              {coveragePercent.toFixed(0)}% covered
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default HotspotPlanning;
