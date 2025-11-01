import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Calendar as CalendarIcon, Eye, Battery, Download } from "lucide-react";
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
      const dateTime = row['Date'] || row['Time'] || '';  // Support both 'Date' and 'Time' columns
      
      if (battery > 0 && dateTime) {
        batteryValues.push({ 
          battery, 
          dateTime,
          timestamp: new Date(dateTime).getTime()  // For sorting
        });
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
    
    // CRITICAL: Sort battery values chronologically by timestamp
    // This ensures we process data in correct time order (12:00 AM to 11:59 PM)
    batteryValues.sort((a, b) => a.timestamp - b.timestamp);
    
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
    
    // Total distance = final cumulative value from last data point WITH valid distance
    let totalDistance = 0;
    // Find the last data point that has a valid distance value
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].distance !== null && data[i].distance !== undefined) {
        totalDistance = data[i].distance;
        break;
      }
    }

    return {
      chargeDrop: totalChargeDrop.toFixed(2),
      charge: totalChargeGain.toFixed(2),
      kmTravelled: totalDistance.toFixed(2),
      minBattery: minBattery.toFixed(1),
      maxBattery: maxBattery.toFixed(1)
    };
  };

  const processChartData = (rawData) => {
    console.log("Processing chart data, total rows:", rawData.length);
    
    // Check for different possible distance column names
    const possibleDistanceColumns = [
      'Odometer (km)',
      'Odometer(km)',
      'Odometer',
      'Distance (km)',
      'Distance(km)',
      'Distance',
      'Total Distance (km)',
      'Total Distance'
    ];
    
    // Find which distance column exists in the data
    let distanceColumn = null;
    for (const col of possibleDistanceColumns) {
      if (rawData[0] && rawData[0][col] !== undefined) {
        distanceColumn = col;
        console.log("Found distance column:", col);
        break;
      }
    }
    
    if (!distanceColumn) {
      console.warn("No distance column found in data. Available columns:", Object.keys(rawData[0] || {}));
      const allColumns = Object.keys(rawData[0] || {});
      distanceColumn = allColumns.find(col => 
        col.toLowerCase().includes('km') || col.toLowerCase().includes('distance')
      );
      if (distanceColumn) {
        console.log("Found distance column by search:", distanceColumn);
      }
    }
    
    // FIRST: Filter out rows with invalid odometer values (-, empty, null)
    const validRows = rawData.filter(row => {
      if (!distanceColumn) return true; // If no distance column, keep all rows
      
      const odometerValue = row[distanceColumn];
      // Keep only rows with valid odometer values (not "-", not empty, not null)
      const isValid = odometerValue && 
                      odometerValue !== "-" && 
                      odometerValue.toString().trim() !== "" &&
                      !isNaN(parseFloat(odometerValue));
      
      return isValid;
    });
    
    console.log(`Filtered data: ${rawData.length} total rows → ${validRows.length} valid rows (${rawData.length - validRows.length} rows with "-" or invalid odometer ignored)`);
    
    // Group VALID data by hour
    const hourlyData = {};
    
    validRows.forEach((row) => {
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
    
    // Create complete 24-hour timeline (12 AM to 11:59 PM)
    const fullTimelineHours = [
      '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', 
      '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
      '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', 
      '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'
    ];
    
    console.log(`Processing complete 24-hour timeline with data for available hours`);
    
    // Track cumulative distance (always increasing)
    let cumulativeDistance = 0;
    let previousOdometer = null;
    let lastValidBattery = null;
    let lastValidDistance = null;
    let previousBattery = null; // Track previous battery for interval calculations
    
    const processedData = fullTimelineHours.map((hourKey, index) => {
      // Check if we have data for this hour
      const hourReadings = hourlyData[hourKey];
      
      if (hourReadings && hourReadings.length > 0) {
        // We have data for this hour
        const lastReading = hourReadings[hourReadings.length - 1];
        
        // Get odometer reading
        const currentOdometer = parseFloat(lastReading[distanceColumn]);
        const currentBattery = parseFloat(lastReading['Battery Soc(%)'] || lastReading['Battery SOC(%)'] || 0);
        
        let distanceTraveled = 0;
        let chargeDrop = 0;
        let efficiency = null;
        
        // Calculate distance traveled
        if (previousOdometer === null) {
          // First data point - baseline, cumulative starts at 0
          cumulativeDistance = 0;
          distanceTraveled = 0;
          previousOdometer = currentOdometer;
          previousBattery = currentBattery;
          console.log(`Hour ${hourKey} - First data point. Baseline Odometer: ${currentOdometer} km, Cumulative: 0 km`);
        } else {
          // Calculate distance traveled this hour = current - previous
          if (currentOdometer >= previousOdometer) {
            distanceTraveled = currentOdometer - previousOdometer;
            cumulativeDistance += distanceTraveled; // ADD to cumulative total
            console.log(`Hour ${hourKey}: Odometer ${currentOdometer} - ${previousOdometer} = ${distanceTraveled} km, Cumulative: ${cumulativeDistance} km`);
          } else {
            // Odometer decreased - data error, don't add to cumulative
            console.warn(`Hour ${hourKey}: Odometer decreased from ${previousOdometer} to ${currentOdometer}, ignoring this increment`);
            distanceTraveled = 0;
          }
          previousOdometer = currentOdometer;
          
          // Calculate charge drop (battery decrease)
          if (previousBattery !== null) {
            chargeDrop = previousBattery - currentBattery; // Positive if battery decreased
          }
          
          // Calculate efficiency (km per % battery)
          if (chargeDrop > 0 && distanceTraveled > 0) {
            efficiency = distanceTraveled / chargeDrop;
          }
          
          previousBattery = currentBattery;
        }
        
        // Store last valid values
        lastValidBattery = currentBattery;
        lastValidDistance = cumulativeDistance;
        
        // Get previous hour for interval label
        const previousHour = index > 0 ? fullTimelineHours[index - 1] : null;
        
        return {
          time: hourKey,
          battery: currentBattery > 0 ? currentBattery : null,
          distance: cumulativeDistance >= 0 ? cumulativeDistance : null,
          intervalDistance: distanceTraveled, // Distance traveled in this hour
          chargeDrop: chargeDrop, // Battery drop in this hour
          efficiency: efficiency, // km per % battery
          previousHour: previousHour,
          hasData: true
        };
      } else {
        // No data for this hour - show null values but keep the timeline
        return {
          time: hourKey,
          battery: null, // Show as blank in graph
          distance: null, // Show as blank in graph
          intervalDistance: 0,
          chargeDrop: 0,
          efficiency: null,
          previousHour: index > 0 ? fullTimelineHours[index - 1] : null,
          hasData: false
        };
      }
    });
    
    console.log(`Processed ${processedData.filter(d => d.hasData).length} hours with data out of 24 total hours`);
    
    return processedData;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Check if this hour has data
      if (!data.hasData) {
        return (
          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Time: {label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">No data available</p>
          </div>
        );
      }
      
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg min-w-[200px]">
          {/* Current Status */}
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Time: {label}</p>
          <div className="space-y-1 mb-3 pb-3 border-b border-gray-200 dark:border-gray-600">
            <p className="text-xs">
              <span className="text-gray-600 dark:text-gray-400">Battery: </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {data.battery !== null ? `${data.battery.toFixed(1)}%` : 'N/A'}
              </span>
            </p>
            <p className="text-xs">
              <span className="text-gray-600 dark:text-gray-400">Total Distance: </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {data.distance !== null ? `${data.distance.toFixed(2)} km` : 'N/A'}
              </span>
            </p>
          </div>
          
          {/* Interval Data (only if there's a previous hour) */}
          {data.previousHour && (
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {data.previousHour} - {label}:
              </p>
              <div className="space-y-1">
                <p className="text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Charge Drop: </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {data.chargeDrop !== null ? `${data.chargeDrop.toFixed(2)}%` : 'N/A'}
                  </span>
                </p>
                <p className="text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Distance Travelled: </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {data.intervalDistance !== null ? `${data.intervalDistance.toFixed(2)} km` : 'N/A'}
                  </span>
                </p>
                <p className="text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Efficiency: </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {data.efficiency !== null ? `${data.efficiency.toFixed(2)} km/%` : 'N/A'}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  const handleViewRawData = async (dayData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/montra-vehicle/analytics/battery-data`,
        {
          params: {
            vehicle_id: selectedVehicle,
            date: dayData.formattedDate
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success && response.data.data.length > 0) {
        // Create a simple table view
        const dataStr = JSON.stringify(response.data.data, null, 2);
        const newWindow = window.open('', '_blank');
        newWindow.document.write(`
          <html>
            <head>
              <title>Raw Feed Data - ${selectedVehicle} - ${dayData.formattedDate}</title>
              <style>
                body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
                pre { white-space: pre-wrap; word-wrap: break-word; }
                h2 { color: #60a5fa; }
              </style>
            </head>
            <body>
              <h2>Raw Feed Data</h2>
              <p><strong>Vehicle:</strong> ${selectedVehicle}</p>
              <p><strong>Date:</strong> ${dayData.formattedDate}</p>
              <p><strong>Total Records:</strong> ${response.data.count}</p>
              <hr>
              <pre>${dataStr}</pre>
            </body>
          </html>
        `);
        toast.success("Raw data opened in new tab");
      }
    } catch (error) {
      toast.error("Failed to fetch raw data");
    }
  };

  const handleDownloadCSV = async (dayData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/montra-vehicle/analytics/battery-data`,
        {
          params: {
            vehicle_id: selectedVehicle,
            date: dayData.formattedDate
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success && response.data.data.length > 0) {
        const data = response.data.data;
        
        // Get all column headers (excluding internal MongoDB fields)
        const headers = Object.keys(data[0]).filter(key => 
          !['_id', 'vehicle_id', 'date', 'day', 'month', 'year', 'registration_number', 
            'filename', 'imported_at', 'mode_name', 'mode_type'].includes(key)
        );
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        data.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in values
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          });
          csvContent += values.join(',') + '\n';
        });
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedVehicle}_${dayData.formattedDate.replace(/ /g, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success(`CSV downloaded: ${selectedVehicle}_${dayData.formattedDate.replace(/ /g, '_')}.csv`);
      }
    } catch (error) {
      toast.error("Failed to download CSV");
    }
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
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <CardTitle className="dark:text-white">
                      Battery Consumption for {vehicles.find(v => v.vehicle_id === selectedVehicle)?.registration_number}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-3">
                        on {dayData.date}
                      </span>
                    </CardTitle>
                    <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mt-2">
                      VIN: <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedVehicle}</span>
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleViewRawData(dayData)}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Data
                    </Button>
                    <Button
                      onClick={() => handleDownloadCSV(dayData)}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download CSV
                    </Button>
                  </div>
                </div>
                
                {/* Summary Stats */}
                <div className="flex justify-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                        label={{ value: 'Total Distance (km)', angle: 90, position: 'insideRight' }}
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
                        connectNulls={true}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="distance" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        name="Total Distance (km)"
                        dot={false}
                        activeDot={false}
                        connectNulls={true}
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
