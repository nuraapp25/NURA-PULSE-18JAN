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
          
          // Calculate summary stats (pass raw data for accurate min/max calculation)
          const summary = calculateSummary(processedData, response.data.data);
          
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

  const calculateSummary = (data, rawData) => {
    // Calculate actual battery percentage changes throughout the day
    const batteryValues = [];
    
    // Extract all battery values from raw data with timestamps
    rawData.forEach((row) => {
      const battery = parseFloat(row['Battery Soc(%)'] || row['Battery SOC(%)'] || 0);
      const time = row['Time'] || '';
      
      if (battery > 0 && time) {
        batteryValues.push({ battery, time });
      }
    });
    
    if (batteryValues.length === 0) {
      return {
        chargeDrop: 0,
        charge: 0,
        totalDistance: 0,
        minBattery: 0,
        maxBattery: 0
      };
    }
    
    // Calculate cumulative charge gained and charge dropped
    let totalChargeDrop = 0;  // Sum of all negative changes (battery going down)
    let totalChargeGain = 0;  // Sum of all positive changes (battery going up)
    
    for (let i = 1; i < batteryValues.length; i++) {
      const prevBattery = batteryValues[i - 1].battery;
      const currBattery = batteryValues[i].battery;
      const change = currBattery - prevBattery;
      
      if (change < 0) {
        // Battery dropped (discharge)
        totalChargeDrop += Math.abs(change);
      } else if (change > 0) {
        // Battery increased (charging)
        totalChargeGain += change;
      }
    }
    
    // Calculate min and max for reference
    const minBattery = Math.min(...batteryValues.map(v => v.battery));
    const maxBattery = Math.max(...batteryValues.map(v => v.battery));
    
    // Total distance
    let totalDistance = 0;
    if (data.length > 0) {
      totalDistance = data[data.length - 1].distance;
    }

    return {
      chargeDrop: Math.max(0, chargeDrop).toFixed(2),
      charge: Math.max(0, charge).toFixed(2),
      kmTravelled: totalDistance.toFixed(2),
      startBattery: startBattery.toFixed(1),
      minBattery: minBattery.toFixed(1),
      endBattery: endBattery.toFixed(1)
    };
  };

  const processChartData = (rawData) => {
    // First pass: get all odometer values
    const odometerValues = rawData.map(row => 
      parseFloat(row['Odometer (km)'] || 0)
    ).filter(val => val > 0);
    
    // Find starting odometer value (minimum)
    const startingOdometer = Math.min(...odometerValues);
    
    // Group data by hour first
    const hourlyData = {};
    
    rawData.forEach((row) => {
      const timeStr = row['Portal Received Time'] || "";
      let hourKey = "N/A";
      
      if (timeStr) {
        try {
          const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const hourNum = parseInt(timeMatch[1]);
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const displayHour = hourNum > 12 ? hourNum - 12 : (hourNum === 0 ? 12 : hourNum);
            hourKey = `${displayHour} ${ampm}`;
          }
        } catch (e) {
          // ignore
        }
      }
      
      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = [];
      }
      hourlyData[hourKey].push(row);
    });
    
    // Process hourly data - take last reading of each hour
    const processedData = [];
    const hourKeys = Object.keys(hourlyData).filter(k => k !== "N/A");
    
    hourKeys.forEach((hourKey, index) => {
      const hourReadings = hourlyData[hourKey];
      const lastReading = hourReadings[hourReadings.length - 1];
      
      const absoluteDistance = parseFloat(lastReading['Odometer (km)'] || 0);
      const normalizedDistance = absoluteDistance - startingOdometer;
      const currentBattery = parseFloat(lastReading['Battery Soc(%)'] || lastReading['Battery SOC(%)'] || 0);
      
      let chargeDrop = 0;
      let distanceTraveled = 0;
      let batteryChange = 0;
      
      // Compare with previous hour
      if (index > 0) {
        const prevHourKey = hourKeys[index - 1];
        const prevHourReadings = hourlyData[prevHourKey];
        const prevLastReading = prevHourReadings[prevHourReadings.length - 1];
        
        const prevBattery = parseFloat(prevLastReading['Battery Soc(%)'] || prevLastReading['Battery SOC(%)'] || 0);
        const prevAbsoluteDistance = parseFloat(prevLastReading['Odometer (km)'] || 0);
        
        batteryChange = currentBattery - prevBattery;
        distanceTraveled = absoluteDistance - prevAbsoluteDistance;
        
        // Charge drop when battery decreases
        if (batteryChange < 0) {
          chargeDrop = Math.abs(batteryChange);
        }
      }
      
      processedData.push({
        time: hourKey,
        battery: currentBattery,
        distance: normalizedDistance,
        chargeDrop: chargeDrop.toFixed(2),
        distanceTraveled: distanceTraveled.toFixed(2),
        batteryChange: batteryChange, // Add this for summary calculation
        rawIndex: index
      });
    });
    
    return processedData;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Calculate efficiency for display (km / charge drop %)
      let efficiencyDisplay = "N/A";
      if (data.chargeDrop && parseFloat(data.chargeDrop) > 0) {
        const eff = parseFloat(data.distanceTraveled) / parseFloat(data.chargeDrop);
        efficiencyDisplay = eff.toFixed(2);
      }
      
      // Calculate the hour range (previous hour to current hour)
      // If label is "11 AM", the range should be "10 AM - 11 AM"
      let hourRangeText = "This Hour:";
      if (label) {
        try {
          const match = label.match(/(\d+)\s+(AM|PM)/);
          if (match) {
            let hour = parseInt(match[1]);
            const ampm = match[2];
            
            // Calculate previous hour
            let prevHour = hour - 1;
            let prevAmPm = ampm;
            
            if (prevHour === 0) {
              prevHour = 12;
              prevAmPm = ampm === "AM" ? "PM" : "AM";
            } else if (prevHour === 11 && ampm === "PM") {
              prevAmPm = "AM";
            } else if (prevHour === 12 && ampm === "AM") {
              prevAmPm = "PM";
            }
            
            hourRangeText = `${prevHour} ${prevAmPm} - ${hour} ${ampm}:`;
          }
        } catch (e) {
          // If parsing fails, use default text
        }
      }
      
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
          <p className="text-gray-300 font-semibold mb-2">{label}</p>
          <p className="text-green-400 text-sm">Battery: {data.battery.toFixed(1)}%</p>
          <p className="text-blue-400 text-sm">Total Distance: {data.distance.toFixed(2)} km</p>
          <div className="border-t border-gray-600 mt-2 pt-2">
            <p className="text-xs text-gray-400 mb-1">{hourRangeText}</p>
            <p className="text-red-400 text-sm">Charge Drop: {data.chargeDrop}%</p>
            <p className="text-blue-300 text-sm">Distance Travelled: {data.distanceTraveled} km</p>
            <p className="text-yellow-400 text-sm font-semibold">
              Efficiency: {efficiencyDisplay}
            </p>
          </div>
        </div>
      );
    }
    return null;
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

      {/* Charts Display - Multiple charts stacked vertically */}
      {showCharts && chartsData.length > 0 && (
        <div className="space-y-6">
          {chartsData.map((dayData, index) => (
            <Card key={index} className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="dark:text-white">
                    Battery Consumption for {vehicles.find(v => v.vehicle_id === selectedVehicle)?.registration_number}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-3">
                      on {dayData.date}
                    </span>
                  </CardTitle>
                </div>
                
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Charge Drop %</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{dayData.summary.chargeDrop}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Charge %</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{dayData.summary.charge}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">KM Travelled</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{dayData.summary.kmTravelled} km</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dayData.chartData}
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
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="battery" 
                        stroke="#10B981" 
                        strokeWidth={3}
                        name="Battery %"
                        dot={false}
                        activeDot={false}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="distance" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        name="Distance (km)"
                        dot={false}
                        activeDot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BatteryConsumption;
