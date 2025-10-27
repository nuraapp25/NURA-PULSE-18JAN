import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Target, AlertCircle, TrendingUp, MapPin, Users, Activity, Download, Clock, Library, Save, Eye, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { API, useAuth } from "@/App";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Input } from "@/components/ui/input";

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom icons
const hotspotIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const pickupIconCovered = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [10, 16],
  iconAnchor: [5, 16],
  popupAnchor: [1, -12],
  shadowSize: [16, 16]
});

const pickupIconUncovered = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [10, 16],
  iconAnchor: [5, 16],
  popupAnchor: [1, -12],
  shadowSize: [16, 16]
});

const HotspotPlanning = () => {
  const { user } = useAuth();
  const [view, setView] = useState('upload'); // 'upload' or 'library' or 'view-saved'
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [mapCenter, setMapCenter] = useState([13.0827, 80.2707]);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const timeSlots = [
    'Morning Rush (6AM-9AM)',
    'Mid-Morning (9AM-12PM)',
    'Afternoon (12PM-4PM)',
    'Evening Rush (4PM-7PM)',
    'Night (7PM-10PM)',
    'Late Night (10PM-1AM)'
  ];

  // Load library when switching to library view
  useEffect(() => {
    if (view === 'library') {
      fetchLibrary();
    }
  }, [view]);

  const fetchLibrary = async () => {
    try {
      setLoadingLibrary(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/hotspot-planning/library`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSavedAnalyses(response.data.analyses);
      }
    } catch (error) {
      console.error("Failed to fetch library:", error);
      toast.error("Failed to load saved analyses");
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleViewSavedAnalysis = async (analysisId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/hotspot-planning/library/${analysisId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        const analysis = response.data.analysis;
        setResults(analysis.analysis_result);
        setCurrentAnalysisId(analysisId);
        setView('view-saved');
        
        // Auto-select first slot with data
        const firstSlotWithData = timeSlots.find(
          slot => analysis.analysis_result.time_slots[slot]?.status === 'success'
        );
        
        if (firstSlotWithData) {
          setSelectedSlot(firstSlotWithData);
          const slotData = analysis.analysis_result.time_slots[firstSlotWithData];
          if (slotData.hotspot_locations && slotData.hotspot_locations.length > 0) {
            setMapCenter([slotData.hotspot_locations[0].lat, slotData.hotspot_locations[0].long]);
          }
        }
        
        toast.success("Analysis loaded successfully");
      }
    } catch (error) {
      console.error("Failed to load analysis:", error);
      toast.error("Failed to load analysis");
    }
  };

  const handleDeleteAnalysis = async (analysisId) => {
    if (!window.confirm("Are you sure you want to delete this analysis?")) {
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API}/hotspot-planning/library/${analysisId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Analysis deleted successfully");
      fetchLibrary(); // Refresh library
    } catch (error) {
      console.error("Failed to delete analysis:", error);
      toast.error(error.response?.data?.detail || "Failed to delete analysis");
    }
  };

  const handleSaveAnalysis = async () => {
    if (!results) return;
    
    try {
      toast.info("Saving analysis...");
      // Analysis is already saved when we use analyze-and-save endpoint
      // This is just for UX feedback
      toast.success("Analysis saved to library!");
      setView('library');
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save analysis");
    }
  };

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
        `${API}/hotspot-planning/analyze-and-save`,
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
        setResults(response.data.analysis);
        setCurrentAnalysisId(response.data.analysis_id);
        
        // Auto-select first slot with data
        const firstSlotWithData = timeSlots.find(
          slot => response.data.analysis.time_slots[slot]?.status === 'success'
        );
        
        if (firstSlotWithData) {
          setSelectedSlot(firstSlotWithData);
          const slotData = response.data.analysis.time_slots[firstSlotWithData];
          if (slotData.hotspot_locations && slotData.hotspot_locations.length > 0) {
            setMapCenter([slotData.hotspot_locations[0].lat, slotData.hotspot_locations[0].long]);
          }
        }
        
        toast.success(
          <div>
            <p className="font-semibold">Analysis Complete & Saved!</p>
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
    setSelectedSlot(null);
    setMapCenter([13.0827, 80.2707]);
    setCurrentAnalysisId(null);
    setView('upload');
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    const slotData = results.time_slots[slot];
    if (slotData?.status === 'success' && slotData.hotspot_locations?.length > 0) {
      setMapCenter([slotData.hotspot_locations[0].lat, slotData.hotspot_locations[0].long]);
    }
  };

  const copyCoordinates = (lat, lng) => {
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    toast.success("Coordinates copied!");
  };

  const copyAllCoordinates = (slotData) => {
    if (!slotData?.hotspot_locations) return;
    const coordsText = slotData.hotspot_locations
      .map((loc, idx) => `Location ${idx + 1}: ${loc.lat}, ${loc.long}`)
      .join('\n');
    navigator.clipboard.writeText(coordsText);
    toast.success("All coordinates copied!");
  };

  const downloadReport = () => {
    if (!results) return;
    
    let report = `HOTSPOT PLANNING ANALYSIS REPORT (TIME SLOT-BASED)\nGenerated: ${new Date().toLocaleString()}\nTimezone: IST (Indian Standard Time)\n\n`;
    report += `TOTAL RIDES ANALYZED: ${results.total_rides_analyzed}\n`;
    report += `ANALYSIS PARAMETERS:\n- Coverage Radius: 420 meters\n- Pickup Time: 5 minutes\n- Speed: 5 km/hr\n\n`;
    report += `=`.repeat(80) + '\n';
    
    timeSlots.forEach(slot => {
      const slotData = results.time_slots[slot];
      report += `\n${slot.toUpperCase()}\n${'='.repeat(slot.length)}\n`;
      
      if (slotData.status === 'no_data') {
        report += 'Status: No rides in this time slot\n';
      } else if (slotData.status === 'insufficient_data') {
        report += `Status: Insufficient data (${slotData.rides_count} rides only)\n`;
      } else if (slotData.status === 'success') {
        report += `Rides: ${slotData.rides_count}\n`;
        report += `Covered: ${slotData.covered_rides} (${slotData.coverage_percentage}%)\n`;
        report += `Locations: ${slotData.num_locations}\n`;
        if (slotData.warning) report += `Warning: ${slotData.warning}\n`;
        report += '\nHOTSPOT LOCATIONS:\n';
        slotData.hotspot_locations.forEach((loc, idx) => {
          report += `  ${idx + 1}. ${loc.lat.toFixed(6)}, ${loc.long.toFixed(6)} - ${loc.rides_assigned} rides, ${loc.coverage_percentage.toFixed(1)}% coverage\n`;
        });
      }
    });
    
    report += `\n${'='.repeat(80)}\n`;
    report += `\nRECOMMENDATIONS:\n`;
    report += `- Deploy vehicles at hotspot locations for each time slot\n`;
    report += `- Reposition vehicles based on time of day for optimal coverage\n`;
    report += `- Focus on time slots with highest demand\n`;
    report += `- Re-run analysis weekly to adapt to demand changes\n`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hotspot-timeslot-analysis-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Report downloaded!");
  };

  const getSlotButtonColor = (slot) => {
    if (!results) return 'bg-gray-200 text-gray-600';
    const slotData = results.time_slots[slot];
    if (slotData?.status === 'success') {
      return selectedSlot === slot 
        ? 'bg-green-600 text-white' 
        : 'bg-green-100 text-green-700 hover:bg-green-200';
    } else if (slotData?.status === 'insufficient_data') {
      return selectedSlot === slot
        ? 'bg-orange-600 text-white'
        : 'bg-orange-100 text-orange-700 hover:bg-orange-200';
    } else {
      return selectedSlot === slot
        ? 'bg-gray-600 text-white'
        : 'bg-gray-200 text-gray-600 hover:bg-gray-300';
    }
  };

  const currentSlotData = selectedSlot ? results?.time_slots[selectedSlot] : null;

  const filteredAnalyses = savedAnalyses.filter(analysis => 
    analysis.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🎯 Hotspot Planning</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Time slot-based optimal location placement for 5-minute pickup coverage (IST)
          </p>
        </div>
        
        {/* View Toggle Buttons */}
        <div className="flex gap-2">
          {view === 'view-saved' && (
            <Button
              onClick={() => setView('library')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              Back to Library
            </Button>
          )}
          {view !== 'library' && (
            <Button
              onClick={() => setView('library')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Library size={18} />
              View Library
            </Button>
          )}
          {view === 'library' && (
            <Button
              onClick={() => setView('upload')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Upload size={18} />
              New Analysis
            </Button>
          )}
        </div>
      </div>

      {/* Library View */}
      {view === 'library' && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Library size={20} />
                Saved Analyses Library
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search analyses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingLibrary ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading library...</p>
              </div>
            ) : filteredAnalyses.length === 0 ? (
              <div className="text-center py-12">
                <Library size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  {searchQuery ? 'No analyses found' : 'No saved analyses yet'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {searchQuery ? 'Try a different search term' : 'Upload and analyze data to save to library'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAnalyses.map((analysis) => (
                  <Card key={analysis.id} className="border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {analysis.filename}
                          </h3>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Uploaded</p>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {new Date(analysis.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Total Rides</p>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {analysis.total_rides || analysis.summary?.total_rides || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Time Slots</p>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {analysis.time_slots_count || analysis.summary?.time_slots || 0} active
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            onClick={() => handleViewSavedAnalysis(analysis.id)}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Eye size={16} className="mr-1" />
                            View
                          </Button>
                          {user?.account_type === 'master_admin' && (
                            <Button
                              onClick={() => handleDeleteAnalysis(analysis.id)}
                              size="sm"
                              variant="destructive"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload & Results View */}
      {(view === 'upload' || view === 'view-saved') && (
        <>
          {/* Upload Section - Only show in upload mode */}
          {view === 'upload' && (
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
                  CSV with pickupLat, pickupLong, dropLat, dropLong, time (UTC)
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
                    <li>Converts UTC time to IST automatically</li>
                    <li>Analyzes 6 time slots: Morning Rush, Mid-Morning, Afternoon, Evening Rush, Night, Late Night</li>
                    <li>Finds up to 10 optimal parking locations per time slot</li>
                    <li>Shows 5-min coverage at 5 km/hr for each slot</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
          )}

          {/* Time Slot Selector */}
          {results && (
            <>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center">
                <Clock size={20} className="mr-2" />
                Select Time Slot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {timeSlots.map((slot) => {
                  const slotData = results.time_slots[slot];
                  return (
                    <button
                      key={slot}
                      onClick={() => handleSlotSelect(slot)}
                      className={`p-4 rounded-lg font-medium transition-all ${
                        getSlotButtonColor(slot)
                      }`}
                    >
                      <div className="text-left">
                        <p className="font-bold text-sm">{slot}</p>
                        {slotData?.status === 'success' && (
                          <p className="text-xs mt-1">
                            {slotData.rides_count} rides • {slotData.coverage_percentage}% coverage
                          </p>
                        )}
                        {slotData?.status === 'no_data' && (
                          <p className="text-xs mt-1">No data</p>
                        )}
                        {slotData?.status === 'insufficient_data' && (
                          <p className="text-xs mt-1">Low data</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Slot Details */}
          {selectedSlot && currentSlotData && (
            <>
              {currentSlotData.status === 'no_data' && (
                <Card className="dark:bg-gray-800 dark:border-gray-700 border-gray-400">
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
                      <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        No rides in {selectedSlot}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Try another time slot
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentSlotData.status === 'insufficient_data' && (
                <Card className="dark:bg-gray-800 dark:border-gray-700 border-orange-400">
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <AlertCircle size={48} className="mx-auto text-orange-500 mb-4" />
                      <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        Insufficient data for {selectedSlot}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Only {currentSlotData.rides_count} ride(s) found - need at least 3 for clustering
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentSlotData.status === 'success' && (
                <>
                  {/* Summary Cards */}
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
                          {currentSlotData.coverage_percentage}%
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
                          {currentSlotData.rides_count}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          In this time slot
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
                          {currentSlotData.covered_rides}
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
                          Locations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                          {currentSlotData.num_locations}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Hotspot locations
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Warning */}
                  {currentSlotData.warning && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <div className="flex items-center">
                        <AlertCircle size={20} className="text-orange-600 dark:text-orange-400 mr-3" />
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                          <span className="font-semibold">Warning:</span> {currentSlotData.warning}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Interactive Map */}
                  <Card className="dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white">
                        🗺️ Hotspot Locations for {selectedSlot}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[600px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                        <MapContainer
                          center={mapCenter}
                          zoom={12}
                          style={{ height: "100%", width: "100%" }}
                          scrollWheelZoom={true}
                          key={selectedSlot}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          
                          {/* Hotspot Locations with Coverage Circles */}
                          {currentSlotData.hotspot_locations.map((location, idx) => (
                            <React.Fragment key={`location-${idx}`}>
                              <Circle
                                center={[location.lat, location.long]}
                                radius={417}
                                pathOptions={{
                                  color: location.coverage_percentage > 80 ? '#22c55e' : location.coverage_percentage > 60 ? '#f97316' : '#ef4444',
                                  fillColor: location.coverage_percentage > 80 ? '#22c55e' : location.coverage_percentage > 60 ? '#f97316' : '#ef4444',
                                  fillOpacity: 0.15,
                                  weight: 2
                                }}
                              />
                              {/* Minimal dot for hotspot */}
                              <Circle
                                center={[location.lat, location.long]}
                                radius={50}
                                pathOptions={{
                                  color: '#FFD700',
                                  fillColor: '#FFD700',
                                  fillOpacity: 1,
                                  weight: 2
                                }}
                              >
                                <Popup>
                                  <div className="text-sm p-2">
                                    <p className="font-bold text-lg mb-2">📍 Location #{idx + 1}</p>
                                    <p className="text-xs text-purple-600 font-semibold mb-2">
                                      {location.locality || 'Unknown Locality'}
                                    </p>
                                    <p className="text-xs text-gray-600"><strong>Coordinates:</strong></p>
                                    <p className="font-mono text-xs">{location.lat.toFixed(6)}, {location.long.toFixed(6)}</p>
                                    <hr className="my-2" />
                                    <p className="text-xs"><strong>Rides:</strong> {location.rides_assigned}</p>
                                    <p className="text-xs"><strong>Within 5-min:</strong> {location.rides_within_5min}</p>
                                    <p className="text-xs"><strong>Coverage:</strong> <span className={location.coverage_percentage > 80 ? 'text-green-600' : location.coverage_percentage > 60 ? 'text-orange-600' : 'text-red-600'}>{location.coverage_percentage.toFixed(1)}%</span></p>
                                  </div>
                                </Popup>
                              </Circle>
                            </React.Fragment>
                          ))}

                          {/* Pickup Points - Smaller dots */}
                          {currentSlotData.pickup_points && currentSlotData.pickup_points.slice(0, 100).map((point, idx) => (
                            <Circle
                              key={`pickup-${idx}`}
                              center={[point[0], point[1]]}
                              radius={30}
                              pathOptions={{
                                color: point[2] ? '#3b82f6' : '#ef4444',
                                fillColor: point[2] ? '#3b82f6' : '#ef4444',
                                fillOpacity: 0.6,
                                weight: 1
                              }}
                            >
                              <Popup>
                                <div className="text-sm">
                                  <p className="font-bold">📍 Pickup</p>
                                  <p className={point[2] ? 'text-green-600' : 'text-red-600'}>
                                    {point[2] ? '✓ Within 5 min' : '✗ Outside 5 min'}
                                  </p>
                                </div>
                              </Popup>
                            </Circle>
                          ))}
                        </MapContainer>
                      </div>
                      
                      <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-yellow-500 rounded-full mr-2"></div>
                          <span className="text-gray-700 dark:text-gray-300">Hotspot Locations</span>
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

                  {/* Hotspot Locations Table */}
                  <Card className="dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900 dark:text-white">
                          📍 Hotspot Locations for {selectedSlot}
                        </CardTitle>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => copyAllCoordinates(currentSlotData)}
                            variant="outline"
                            size="sm"
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            Copy All
                          </Button>
                          <Button
                            onClick={downloadReport}
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                          >
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
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Locality</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Coordinates (Lat, Long)</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rides</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Covered</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Coverage</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {currentSlotData.hotspot_locations.map((location, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">#{idx + 1}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-purple-600 dark:text-purple-400">
                                  {location.locality || 'Loading...'}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">
                                  {location.lat.toFixed(6)}, {location.long.toFixed(6)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{location.rides_assigned}</td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{location.rides_within_5min}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                    location.coverage_percentage > 80
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                      : location.coverage_percentage > 60
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  }`}>
                                    {location.coverage_percentage.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <Button
                                    onClick={() => copyCoordinates(location.lat, location.long)}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                  >
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
                </>
              )}
            </>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
};

export default HotspotPlanning;
