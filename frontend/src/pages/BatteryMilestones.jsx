import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Search, X } from "lucide-react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const BatteryMilestones = () => {
  const navigate = useNavigate();
  
  // State for filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [milestoneData, setMilestoneData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Load available vehicles on mount
  useEffect(() => {
    loadAvailableVehicles();
  }, []);
  
  const loadAvailableVehicles = async () => {
    try {
      const token = localStorage.getItem("token");
      // Get unique vehicles from feed database
      const response = await axios.get(`${API}/montra-vehicle/feed-database`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Extract unique vehicle IDs
        const uniqueVehicles = [...new Set(response.data.files.map(f => f.vehicle_id))];
        setAvailableVehicles(uniqueVehicles);
      }
    } catch (error) {
      console.error("Error loading vehicles:", error);
      toast.error("Failed to load available vehicles");
    }
  };
  
  const toggleVehicleSelection = (vehicleId) => {
    setSelectedVehicles(prev => {
      if (prev.includes(vehicleId)) {
        return prev.filter(v => v !== vehicleId);
      } else {
        return [...prev, vehicleId];
      }
    });
  };
  
  const handleAnalyze = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select start and end dates");
      return;
    }
    
    if (selectedVehicles.length === 0) {
      toast.error("Please select at least one vehicle");
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/montra-vehicle/battery-milestones`,
        {
          vehicle_ids: selectedVehicles,
          start_date: startDate,
          end_date: endDate
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setMilestoneData(response.data.milestones);
        toast.success(`Analyzed ${response.data.count} records`);
      }
    } catch (error) {
      console.error("Error analyzing milestones:", error);
      toast.error("Failed to analyze battery milestones");
    } finally {
      setLoading(false);
    }
  };
  
  const exportToExcel = () => {
    if (milestoneData.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    // Create CSV content
    const headers = [
      "Date",
      "Vehicle",
      "Charge at 6AM",
      "Time at 80%",
      "Km at 80%",
      "Time at 50%",
      "Km at 50%",
      "Time at 30%",
      "Time at 20%",
      "Km at 20%",
      "Derived Mileage",
      "Mid-day Charge%"
    ];
    
    const rows = milestoneData.map(row => [
      row.date,
      row.vehicle,
      row.charge_at_6am || "",
      row.time_at_80 || "",
      row.km_at_80 || "",
      row.time_at_50 || "",
      row.km_at_50 || "",
      row.time_at_30 || "",
      row.time_at_20 || "",
      row.km_at_20 || "",
      row.derived_mileage ? `${row.derived_mileage} km/%` : "",
      row.midday_charge || ""
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `battery_milestones_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success("Exported to CSV");
  };
  
  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Battery Milestones Analysis
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track charge levels, KM readings, and derived mileage
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard/montra-vehicle")}>
          <X size={18} className="mr-2" />
          Back
        </Button>
      </div>

      {/* Filters Card */}
      <Card className="mb-6 dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Analysis Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date (DD MMM format, e.g., "01 Sep")
              </label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="01 Sep"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            
            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date (DD MMM format, e.g., "30 Sep")
              </label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="30 Sep"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            
            {/* Analyze Button */}
            <div className="flex items-end">
              <Button 
                onClick={handleAnalyze} 
                disabled={loading}
                className="w-full"
              >
                <Search size={18} className="mr-2" />
                {loading ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          </div>
          
          {/* Vehicle Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Vehicles ({selectedVehicles.length} selected)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
              {availableVehicles.length === 0 ? (
                <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">
                  No vehicles available. Please import Montra feed data first.
                </p>
              ) : (
                availableVehicles.map(vehicle => (
                  <label
                    key={vehicle}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedVehicles.includes(vehicle)}
                      onChange={() => toggleVehicleSelection(vehicle)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{vehicle}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      {milestoneData.length > 0 && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-white">
                Analysis Results ({milestoneData.length} records)
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download size={16} className="mr-2" />
                Export to CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Vehicle</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Charge at 6AM</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Time at 80%</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Km at 80%</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Time at 50%</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Km at 50%</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Time at 30%</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Time at 20%</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Km at 20%</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Derived Mileage</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Mid-day Charge%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {milestoneData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.date}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.vehicle}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.charge_at_6am || "-"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.time_at_80 || "-"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.km_at_80 || "-"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.time_at_50 || "-"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.km_at_50 || "-"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.time_at_30 || "-"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.time_at_20 || "-"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.km_at_20 || "-"}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white font-semibold">
                        {row.derived_mileage ? `${row.derived_mileage} km/%` : "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{row.midday_charge || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Empty State */}
      {milestoneData.length === 0 && !loading && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="py-12 text-center">
            <Calendar size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Analysis Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Select date range and vehicles, then click "Analyze" to view battery milestones
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BatteryMilestones;
