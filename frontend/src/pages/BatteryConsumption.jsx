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
import { format, eachDayOfInterval, parseISO } from "date-fns";

const BatteryConsumption = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartsData, setChartsData] = useState([]); // Array of {date, chartData, summary}
  const [showCharts, setShowCharts] = useState(false);

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
    if (!startDate || !endDate) {
      toast.error("Please select start and end dates");
      return;
    }

    if (startDate > endDate) {
      toast.error("Start date must be before end date");
      return;
    }

    setLoading(true);
    setShowCharts(false);

    try {
      // Get all dates in the range
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      
      const allChartsData = [];
      let totalDataPoints = 0;
      
      // Fetch data for each date
      for (const date of dateRange) {
        const formattedDate = format(date, "dd MMM");
        
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
          // Process data for this date
          const processedData = processChartData(response.data.data);
          
          // Calculate summary stats
          const summary = calculateSummary(processedData);
          
          allChartsData.push({
            date: format(date, "PPP"),
            formattedDate: formattedDate,
            chartData: processedData,
            summary: summary,
            count: response.data.count
          });
          
          totalDataPoints += response.data.count;
        }
      }

      if (allChartsData.length > 0) {
        setChartsData(allChartsData);
        setShowCharts(true);
        toast.success(`Loaded data for ${allChartsData.length} day(s) with ${totalDataPoints} total data points`);
      } else {
        toast.error("No data found for selected vehicle and date range");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to fetch battery data");
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (data) => {
    let chargeDrop = 0;
    let charge = 0;
    let totalDistance = 0;

    data.forEach((point) => {
      if (point.batteryChange < 0) {
        chargeDrop += Math.abs(point.batteryChange);
      } else if (point.batteryChange > 0) {
        charge += point.batteryChange;
      }
    });

    if (data.length > 0) {
      totalDistance = data[data.length - 1].distance;
    }

    return {
      chargeDrop: chargeDrop.toFixed(2),
      charge: charge.toFixed(2),
      kmTravelled: totalDistance.toFixed(2)
    };
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <Button
            onClick={() => navigate("/dashboard/montra-vehicle")}
            variant="outline"
            size="sm"
            className="self-start"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Battery className="mr-2 sm:mr-3 text-green-600" size={28} />
              <span className="hidden sm:inline">Battery Consumption Analysis</span>
              <span className="sm:hidden">Battery Analysis</span>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="vehicle-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Vehicle No.
              </Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger id="vehicle-select" className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 text-sm">
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800">
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                      <span className="block sm:hidden">{vehicle.vehicle_id}</span>
                      <span className="hidden sm:block">{vehicle.registration_number} ({vehicle.vehicle_id})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="start-date-picker" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="start-date-picker"
                    variant="outline"
                    className="w-full justify-start text-left font-normal mt-1.5 dark:bg-gray-700 dark:border-gray-600 text-sm"
                    size="sm"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd MMM yyyy") : <span>Pick start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-gray-800" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="dark:bg-gray-800"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="end-date-picker" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                End Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="end-date-picker"
                    variant="outline"
                    className="w-full justify-start text-left font-normal mt-1.5 dark:bg-gray-700 dark:border-gray-600 text-sm"
                    size="sm"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd MMM yyyy") : <span>Pick end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-gray-800" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="dark:bg-gray-800"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="flex justify-center pt-4">
            <Button 
              onClick={handleViewData}
              disabled={!selectedVehicle || !startDate || !endDate || loading}
              className="bg-blue-600 hover:bg-blue-700 px-6 sm:px-8 text-sm w-full sm:w-auto"
              size="sm"
            >
              {loading ? "Loading..." : "View Battery Data"}
            </Button>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">Charge Drop %</p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">
                  {(() => {
                    // Sum all negative battery changes (discharge periods)
                    const totalDrop = chartData
                      .filter(d => d.batteryChange < 0)
                      .reduce((sum, d) => sum + Math.abs(d.batteryChange), 0);
                    return totalDrop.toFixed(1);
                  })()}%
                </p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">Charge %</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                  {(() => {
                    // Sum all positive battery changes (charging periods)
                    const totalCharge = chartData
                      .filter(d => d.batteryChange > 0)
                      .reduce((sum, d) => sum + d.batteryChange, 0);
                    return totalCharge.toFixed(1);
                  })()}%
                </p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span className="hidden sm:inline">Total Distance Traveled</span>
                  <span className="sm:hidden">Distance</span>
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
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
