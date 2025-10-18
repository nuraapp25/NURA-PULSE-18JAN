import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Target, AlertCircle, TrendingUp, MapPin, Users, Activity, Download } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { API } from "@/App";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
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

const pickupIconCovered = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [15, 25],
  iconAnchor: [7, 25],
  popupAnchor: [1, -20],
  shadowSize: [25, 25]
});

const pickupIconUncovered = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [15, 25],
  iconAnchor: [7, 25],
  popupAnchor: [1, -20],
  shadowSize: [25, 25]
});

const HotspotPlanning = () => {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [mapCenter, setMapCenter] = useState([13.0827, 80.2707]);

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
          timeout: 60000
        }
      );

      if (response.data.success) {
        setResults(response.data);
        
        if (response.data.cluster_stats && response.data.cluster_stats.length > 0) {
          setMapCenter([
            response.data.cluster_stats[0].placement_lat,
            response.data.cluster_stats[0].placement_long
          ]);
        }
        
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
    setMapCenter([13.0827, 80.2707]);
  };

  const copyCoordinates = (lat, lng) => {
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    toast.success("Coordinates copied!");
  };

  const copyAllCoordinates = () => {
    if (!results) return;
    const coordsText = results.cluster_stats
      .map((c, idx) => `Vehicle ${idx + 1}: ${c.placement_lat}, ${c.placement_long}`)
      .join('\n');
    navigator.clipboard.writeText(coordsText);
    toast.success("All coordinates copied!");
  };

  const downloadReport = () => {
    if (!results) return;
    
    const report = `HOTSPOT PLANNING ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}

SUMMARY
=======
Total Rides Analyzed: ${results.summary.total_rides_analyzed}
Rides Within 5 Minutes: ${results.summary.rides_within_5min}
Coverage Percentage: ${results.summary.coverage_percentage}%
Average Distance to Nearest Vehicle: ${results.summary.average_distance_to_nearest_vehicle} km

VEHICLE PLACEMENT COORDINATES
==============================
${results.cluster_stats.map((c, idx) => 
  `Vehicle ${idx + 1}: ${c.placement_lat}, ${c.placement_long} (${c.total_rides_assigned} rides, ${c.coverage_percentage.toFixed(1)}% coverage)`
).join('\n')}

RECOMMENDATIONS
===============
- Deploy vehicles at the coordinates listed above
- Focus on top 5 vehicles with highest ride assignments
- Monitor hourly demand patterns for dynamic adjustments
- Re-run analysis weekly to adapt to demand changes
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hotspot-analysis-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Report downloaded!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🎯 Hotspot Planning</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Strategic vehicle placement optimization for 5-minute pickup coverage
        </p>
      </div>

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
              <Button onClick={handleReset} variant="outline" disabled={!file && !results}>
                Reset
              </Button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Upload CSV with ride request data (pickup/drop coordinates)</li>
                    <li>K-Means algorithm clusters 100sqkm area into 10 optimal vehicle zones</li>
                    <li>Calculates 5-min coverage at 5 km/hr Chennai traffic speed (420m radius)</li>
                    <li>Interactive map shows placement with coverage circles</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {results && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <TrendingUp size={16} className="mr-2" />
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
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <Users size={16} className="mr-2" />
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
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <Activity size={16} className="mr-2" />
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
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <MapPin size={16} className="mr-2" />
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

          <Card className="dark:bg-gray-800 dark:border-gray-700 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-500 dark:border-green-700">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-4">
                <div className="bg-green-500 rounded-full p-3">
                  <TrendingUp size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    📊 Optimization Results
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    With this strategic placement, <span className="font-bold text-green-600 dark:text-green-400">{results.summary.rides_within_5min} out of {results.summary.total_rides_analyzed} rides</span> ({results.summary.coverage_percentage}%) can be picked up within 5 minutes.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Avg Distance</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{results.summary.average_distance_to_nearest_vehicle} km</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Coverage Radius</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">420 meters</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Speed Assumed</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">5 km/hr</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                🗺️ Interactive Chennai Placement Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {results.cluster_stats.map((cluster, idx) => (
                    <React.Fragment key={`cluster-${idx}`}>
                      <Circle
                        center={[cluster.placement_lat, cluster.placement_long]}
                        radius={417}
                        pathOptions={{
                          color: cluster.coverage_percentage > 80 ? 'green' : cluster.coverage_percentage > 60 ? 'orange' : 'red',
                          fillColor: cluster.coverage_percentage > 80 ? 'green' : cluster.coverage_percentage > 60 ? 'orange' : 'red',
                          fillOpacity: 0.15,
                          weight: 2
                        }}
                      />
                      <Marker
                        position={[cluster.placement_lat, cluster.placement_long]}
                        icon={vehicleIcon}
                      >
                        <Popup>
                          <div className="text-sm p-2">
                            <p className="font-bold text-lg mb-2">🚗 Vehicle #{idx + 1}</p>
                            <p className="text-xs text-gray-600"><strong>Coordinates:</strong></p>
                            <p className="font-mono text-xs">{cluster.placement_lat.toFixed(6)}, {cluster.placement_long.toFixed(6)}</p>
                            <hr className="my-2" />
                            <p className="text-xs"><strong>Rides Assigned:</strong> {cluster.total_rides_assigned}</p>
                            <p className="text-xs"><strong>Within 5-min:</strong> {cluster.rides_within_5min}</p>
                            <p className="text-xs"><strong>Coverage:</strong> <span className={cluster.coverage_percentage > 80 ? 'text-green-600' : cluster.coverage_percentage > 60 ? 'text-orange-600' : 'text-red-600'}>{cluster.coverage_percentage.toFixed(1)}%</span></p>
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  ))}

                  {results.pickup_points && results.pickup_points.slice(0, 150).map((point, idx) => (
                    <Marker
                      key={`pickup-${idx}`}
                      position={[point[0], point[1]]}
                      icon={point[2] ? pickupIconCovered : pickupIconUncovered}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">📍 Pickup Request</p>
                          <p className={point[2] ? 'text-green-600' : 'text-red-600'}>
                            {point[2] ? '✓ Within 5 min' : '✗ Outside 5 min'}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              
              <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-gray-700 dark:text-gray-300">Vehicle Placement</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-gray-700 dark:text-gray-300">Covered Pickups</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-gray-700 dark:text-gray-300">Uncovered Pickups</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-green-500 rounded-full mr-2"></div>
                  <span className="text-gray-700 dark:text-gray-300">5-min Coverage (420m)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-gray-900 dark:text-white">
                  📍 Top 10 Vehicle Placement Coordinates
                </CardTitle>
                <div className="flex space-x-2">
                  <Button onClick={copyAllCoordinates} variant="outline" size="sm" className="text-blue-600 border-blue-600 hover:bg-blue-50">
                    Copy All
                  </Button>
                  <Button onClick={downloadReport} variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-50">
                    <Download size={16} className="mr-1" />
                    Download Report
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b-2 border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vehicle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Coordinates</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rides</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Covered</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Coverage</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {results.cluster_stats.map((cluster, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">#{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Vehicle {idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">{cluster.placement_lat.toFixed(6)}, {cluster.placement_long.toFixed(6)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{cluster.total_rides_assigned}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{cluster.rides_within_5min}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                            cluster.coverage_percentage > 80
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : cluster.coverage_percentage > 60
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {cluster.coverage_percentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button onClick={() => copyCoordinates(cluster.placement_lat, cluster.placement_long)} variant="outline" size="sm" className="text-xs">
                            Copy
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {results.time_analysis && Object.keys(results.time_analysis.hourly_demand || {}).length > 0 && (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">⏰ Hourly Demand Pattern & Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(results.time_analysis.hourly_demand)
                    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                    .map(([hour, demand]) => {
                      const coveragePercent = results.time_analysis.hourly_coverage_percentage[hour] || 0;
                      const maxDemand = Math.max(...Object.values(results.time_analysis.hourly_demand));
                      
                      return (
                        <div key={hour} className="flex items-center space-x-4">
                          <div className="w-24 text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {hour}:00 - {parseInt(hour) + 1}:00
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-10 overflow-hidden relative">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full flex items-center justify-end pr-3 text-xs text-white font-bold transition-all"
                                  style={{ width: `${(demand / maxDemand) * 100}%` }}
                                >
                                  {demand > 0 && `${demand} rides`}
                                </div>
                              </div>
                              <div className="w-28 text-right">
                                <span className={`text-sm font-bold ${
                                  coveragePercent > 80 ? 'text-green-600 dark:text-green-400' :
                                  coveragePercent > 60 ? 'text-orange-600 dark:text-orange-400' :
                                  'text-red-600 dark:text-red-400'
                                }`}>
                                  {coveragePercent.toFixed(0)}% covered
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                
                <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    <span className="font-semibold">💡 Insight:</span> Peak demand hours show higher coverage with current placement. Consider dynamic repositioning during off-peak hours for better optimization.
                  </p>
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
