import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, Calendar as CalendarIcon, Eye, Download, TrendingUp, 
  Car, Gauge, AlertTriangle, ChevronUp, ChevronDown, Filter
} from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, subMonths } from "date-fns";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const MonthlyRideTracking = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rideData, setRideData] = useState(null);
  const [showData, setShowData] = useState(false);
  const [kmLimit, setKmLimit] = useState(100); // Alert threshold
  const [filterMode, setFilterMode] = useState("month"); // "month" or "range"

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    // Set default date range to current month
    if (filterMode === "month" && selectedMonth) {
      setStartDate(startOfMonth(selectedMonth));
      setEndDate(endOfMonth(selectedMonth));
    }
  }, [selectedMonth, filterMode]);

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

  const handleSelectAllVehicles = (checked) => {
    if (checked) {
      setSelectedVehicles(vehicles.map(v => v.vehicle_id));
    } else {
      setSelectedVehicles([]);
    }
  };

  const handleVehicleToggle = (vehicleId) => {
    setSelectedVehicles(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  const handleViewData = async () => {
    if (selectedVehicles.length === 0) {
      toast.error("Please select at least one vehicle");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please select date range");
      return;
    }

    setLoading(true);
    setShowData(false);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/montra-vehicle/analytics/monthly-ride-tracking`,
        {
          vehicle_ids: selectedVehicles,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd")
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRideData(response.data);
      setShowData(true);
      toast.success("Data loaded successfully");
    } catch (error) {
      console.error("Error fetching ride data:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch ride data");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!rideData) return;

    // Create CSV content
    const headers = ["Vehicle", "Registration No", "Total KM", "Days Active", "Avg KM/Day", "Max Daily KM", "Min Daily KM"];
    const rows = rideData.vehicle_summary.map(v => [
      v.vehicle_id,
      v.registration_number,
      v.total_km.toFixed(2),
      v.days_active,
      v.avg_km_per_day.toFixed(2),
      v.max_daily_km.toFixed(2),
      v.min_daily_km.toFixed(2)
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `monthly_ride_tracking_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Data exported successfully");
  };

  const handleExportDaily = () => {
    if (!rideData) return;

    // Create detailed daily CSV
    const headers = ["Date", "Vehicle ID", "Registration No", "Start Odometer", "End Odometer", "KM Traveled"];
    const rows = [];
    
    rideData.daily_data.forEach(day => {
      day.vehicles.forEach(v => {
        rows.push([
          day.date,
          v.vehicle_id,
          v.registration_number,
          v.start_odometer,
          v.end_odometer,
          v.km_traveled.toFixed(2)
        ]);
      });
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `daily_ride_details_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Daily data exported successfully");
  };

  // Previous month comparison
  const previousMonthData = useMemo(() => {
    if (!rideData?.comparison) return null;
    return rideData.comparison;
  }, [rideData]);

  // Vehicles exceeding KM limit
  const vehiclesExceedingLimit = useMemo(() => {
    if (!rideData?.vehicle_summary) return [];
    return rideData.vehicle_summary.filter(v => v.avg_km_per_day > kmLimit);
  }, [rideData, kmLimit]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/montra-vehicle")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monthly Ride Tracking</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track total KMs traveled by vehicles</p>
          </div>
        </div>
        {showData && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export Summary
            </Button>
            <Button variant="outline" onClick={handleExportDaily}>
              <Download className="h-4 w-4 mr-2" /> Export Daily
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filter Mode */}
            <div className="space-y-2">
              <Label>Filter Mode</Label>
              <Select value={filterMode} onValueChange={setFilterMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">By Month</SelectItem>
                  <SelectItem value="range">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Month Picker or Date Range */}
            {filterMode === "month" ? (
              <div className="space-y-2">
                <Label>Select Month</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedMonth ? format(selectedMonth, "MMMM yyyy") : "Select month"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(date) => date && setSelectedMonth(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd MMM yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd MMM yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {/* KM Alert Threshold */}
            <div className="space-y-2">
              <Label>Daily KM Alert Threshold</Label>
              <Input 
                type="number" 
                value={kmLimit} 
                onChange={(e) => setKmLimit(Number(e.target.value))}
                placeholder="100"
              />
            </div>
          </div>

          {/* Vehicle Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Vehicles ({selectedVehicles.length} selected)</Label>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedVehicles.length === vehicles.length && vehicles.length > 0}
                  onCheckedChange={handleSelectAllVehicles}
                />
                <span className="text-sm">Select All</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
              {vehicles.map(vehicle => (
                <div key={vehicle.vehicle_id} className="flex items-center gap-2">
                  <Checkbox 
                    checked={selectedVehicles.includes(vehicle.vehicle_id)}
                    onCheckedChange={() => handleVehicleToggle(vehicle.vehicle_id)}
                  />
                  <span className="text-sm truncate">{vehicle.registration_number}</span>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleViewData} disabled={loading} className="w-full md:w-auto">
            {loading ? "Loading..." : <><Eye className="h-4 w-4 mr-2" /> View Data</>}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {showData && rideData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">Total KM (All Vehicles)</p>
                    <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                      {rideData.total_km.toFixed(2)}
                    </p>
                  </div>
                  <Gauge className="h-10 w-10 text-emerald-500" />
                </div>
                {previousMonthData && (
                  <div className={`flex items-center mt-2 text-sm ${previousMonthData.km_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {previousMonthData.km_change >= 0 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {Math.abs(previousMonthData.km_change_percent).toFixed(1)}% vs last month
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Vehicles Tracked</p>
                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                      {rideData.vehicles_count}
                    </p>
                  </div>
                  <Car className="h-10 w-10 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">Avg KM/Vehicle/Day</p>
                    <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                      {rideData.avg_km_per_vehicle_per_day.toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 dark:text-orange-400">Days in Period</p>
                    <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                      {rideData.days_count}
                    </p>
                  </div>
                  <CalendarIcon className="h-10 w-10 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts - Vehicles exceeding limit */}
          {vehiclesExceedingLimit.length > 0 && (
            <Card className="border-orange-300 bg-orange-50 dark:bg-orange-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="h-5 w-5" /> 
                  Vehicles Exceeding {kmLimit} KM/Day Average
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {vehiclesExceedingLimit.map(v => (
                    <div key={v.vehicle_id} className="p-2 bg-white dark:bg-gray-800 rounded-lg flex justify-between items-center">
                      <span className="font-medium">{v.registration_number}</span>
                      <span className="text-orange-600 font-bold">{v.avg_km_per_day.toFixed(1)} km/day</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily KM Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Total KM Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={rideData.daily_totals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total_km" stroke="#10b981" strokeWidth={2} name="Total KM" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* KM by Vehicle */}
            <Card>
              <CardHeader>
                <CardTitle>Total KM by Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={rideData.vehicle_summary.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="registration_number" type="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="total_km" fill="#3b82f6" name="Total KM" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Vehicle Distribution Pie */}
            <Card>
              <CardHeader>
                <CardTitle>KM Distribution by Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={rideData.vehicle_summary.slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ registration_number, percent }) => `${registration_number} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="total_km"
                      nameKey="registration_number"
                    >
                      {rideData.vehicle_summary.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Previous Month Comparison */}
            {previousMonthData && (
              <Card>
                <CardHeader>
                  <CardTitle>Month-over-Month Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { name: 'Previous Month', km: previousMonthData.previous_month_km },
                      { name: 'Current Period', km: rideData.total_km }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="km" fill="#8b5cf6" name="Total KM" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Vehicle Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle-wise Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800">
                      <th className="p-3 text-left">Registration No</th>
                      <th className="p-3 text-right">Total KM</th>
                      <th className="p-3 text-right">Days Active</th>
                      <th className="p-3 text-right">Avg KM/Day</th>
                      <th className="p-3 text-right">Max Daily KM</th>
                      <th className="p-3 text-right">Min Daily KM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rideData.vehicle_summary.map((vehicle, idx) => (
                      <tr key={vehicle.vehicle_id} className={`border-b ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}`}>
                        <td className="p-3 font-medium">{vehicle.registration_number}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{vehicle.total_km.toFixed(2)}</td>
                        <td className="p-3 text-right">{vehicle.days_active}</td>
                        <td className={`p-3 text-right ${vehicle.avg_km_per_day > kmLimit ? 'text-orange-600 font-bold' : ''}`}>
                          {vehicle.avg_km_per_day.toFixed(2)}
                        </td>
                        <td className="p-3 text-right">{vehicle.max_daily_km.toFixed(2)}</td>
                        <td className="p-3 text-right">{vehicle.min_daily_km.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="border-b">
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Vehicle</th>
                      <th className="p-3 text-right">Start Odometer</th>
                      <th className="p-3 text-right">End Odometer</th>
                      <th className="p-3 text-right">KM Traveled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rideData.daily_data.flatMap((day, dayIdx) => 
                      day.vehicles.map((v, vIdx) => (
                        <tr key={`${day.date}-${v.vehicle_id}`} className={`border-b ${dayIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}`}>
                          {vIdx === 0 && (
                            <td className="p-3 font-medium" rowSpan={day.vehicles.length}>{day.date}</td>
                          )}
                          <td className="p-3">{v.registration_number}</td>
                          <td className="p-3 text-right">{v.start_odometer}</td>
                          <td className="p-3 text-right">{v.end_odometer}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">{v.km_traveled.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MonthlyRideTracking;
