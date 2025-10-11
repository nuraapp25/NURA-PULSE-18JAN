import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Calendar as CalendarIcon, Eye, Battery } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const BatteryConsumption = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/montra-vehicle/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data.vehicles);
    } catch (error) {
      toast.error("Failed to fetch vehicles");
    }
  };

  const handleViewData = async () => {
    if (!selectedVehicle) {
      toast.error("Please select a vehicle");
      return;
    }
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    setLoading(true);
    setShowChart(false);

    try {
      // Format date as "DD MMM" (e.g., "01 Sep")
      const formattedDate = format(selectedDate, "dd MMM");
      
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/montra-vehicle/analytics/battery-data`,
        {
          params: {
            vehicle_id: selectedVehicle,
            date: formattedDate
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success && response.data.data.length > 0) {
        // Process data for chart
        const processedData = processChartData(response.data.data);
        setChartData(processedData);
        setShowChart(true);
        toast.success(`Loaded ${response.data.count} data points`);
      } else {
        toast.error("No data found for selected vehicle and date");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to fetch battery data");
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (rawData) => {
    // First pass: get all odometer values
    const odometerValues = rawData.map(row => 
      parseFloat(row['Odometer (km)'] || 0)
    ).filter(val => val > 0);
    
    // Find starting odometer value (minimum)
    const startingOdometer = Math.min(...odometerValues);
    
    // Process data and calculate charge changes from Battery Soc(%)
    const processedData = rawData.map((row, index) => {
      // Extract hour from Portal Received Time (Column C)
      const timeStr = row['Portal Received Time'] || "";
      let hour = "N/A";
      
      if (timeStr) {
        try {
          // Time format might be "2025-09-01 13:45:30" or "13:45:30"
          const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const hourNum = parseInt(timeMatch[1]);
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const displayHour = hourNum > 12 ? hourNum - 12 : (hourNum === 0 ? 12 : hourNum);
            hour = `${displayHour} ${ampm}`;
          }
        } catch (e) {
          hour = index.toString();
        }
      }

      const absoluteDistance = parseFloat(row['Odometer (km)'] || 0);
      // Normalize distance - subtract starting odometer to get relative distance
      const normalizedDistance = absoluteDistance - startingOdometer;

      const currentBattery = parseFloat(row['Battery Soc(%)'] || row['Battery SOC (%)'] || 0);
      
      // Calculate battery change from previous reading
      let batteryChange = 0;
      if (index > 0) {
        const prevBattery = parseFloat(rawData[index - 1]['Battery Soc(%)'] || rawData[index - 1]['Battery SOC (%)'] || 0);
        batteryChange = currentBattery - prevBattery;
      }

      return {
        time: hour,
        battery: currentBattery,
        distance: normalizedDistance,
        batteryChange: batteryChange, // Positive = charging, Negative = discharging
        rawIndex: index
      };
    });
    
    return processedData;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/dashboard/montra-vehicle")}
            variant="outline"
            size="sm"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Battery className="mr-3 text-green-600" size={32} />
              Battery Consumption Analysis
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Analyze battery usage patterns over time
            </p>
          </div>
        </div>
      </div>

      {/* Input Controls */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="dark:text-white">Select Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {/* Vehicle Selection */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Vehicle No.</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                      {vehicle.registration_number} ({vehicle.vehicle_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal dark:bg-gray-700 dark:border-gray-600"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* View Button */}
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">&nbsp;</Label>
              <Button
                onClick={handleViewData}
                disabled={loading || !selectedVehicle || !selectedDate}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye size={18} className="mr-2" />
                    View
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart Display */}
      {showChart && chartData.length > 0 && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="dark:text-white">
              Battery Consumption for {vehicles.find(v => v.vehicle_id === selectedVehicle)?.registration_number}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-3">
                on {selectedDate ? format(selectedDate, "PPP") : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9CA3AF"
                    label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#10B981"
                    label={{ value: 'Battery %', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#3B82F6"
                    label={{ value: 'Distance (km)', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="battery"
                    stroke="#10B981"
                    strokeWidth={3}
                    name="Battery %"
                    dot={{ fill: '#10B981', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="distance"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    name="Distance (km)"
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Charge Drop %</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {(() => {
                    // Sum all negative battery changes (discharge periods)
                    const totalDrop = chartData
                      .filter(d => d.batteryChange < 0)
                      .reduce((sum, d) => sum + Math.abs(d.batteryChange), 0);
                    return totalDrop.toFixed(1);
                  })()}%
                </p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Charge %</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {(() => {
                    // Sum all positive battery changes (charging periods)
                    const totalCharge = chartData
                      .filter(d => d.batteryChange > 0)
                      .reduce((sum, d) => sum + d.batteryChange, 0);
                    return totalCharge.toFixed(1);
                  })()}%
                </p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Distance Traveled</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.max(...chartData.map(d => d.distance)).toFixed(2)} km
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BatteryConsumption;
