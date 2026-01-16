import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  ArrowLeft, Phone, PhoneCall, PhoneOff, UserCheck, Users, TrendingUp, 
  Calendar, Download, RefreshCw, BarChart3, Clock, Target, AlertCircle,
  ThumbsUp, PhoneMissed, Bell
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, subDays, startOfDay, endOfDay } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from "recharts";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const TelecallerStatistics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.account_type === "master_admin" || user?.account_type === "admin";
  
  // Date range state
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 7).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Data states
  const [callStatistics, setCallStatistics] = useState([]);
  const [dailySummary, setDailySummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTelecaller, setSelectedTelecaller] = useState("all");
  const [telecallers, setTelecallers] = useState([]);
  
  // Summary stats
  const [overallStats, setOverallStats] = useState({
    totalCalls: 0,
    totalLeads: 0,
    noResponse: 0,
    interested: 0,
    notInterested: 0,
    callbacks: 0
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCallStatistics(),
        fetchDailySummary(),
        fetchTelecallers()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTelecallers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/users/telecallers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTelecallers(response.data || []);
    } catch (error) {
      console.error("Error fetching telecallers:", error);
    }
  };

  const fetchCallStatistics = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/telecaller-desk/call-statistics`, {
        params: {
          start_date: dateRange.start,
          end_date: dateRange.end
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCallStatistics(response.data.statistics || []);
      }
    } catch (error) {
      console.error("Error fetching call statistics:", error);
      toast.error("Failed to load call statistics");
    }
  };

  const fetchDailySummary = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/telecaller-desk/daily-summary`, {
        params: {
          start_date: dateRange.start,
          end_date: dateRange.end
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setDailySummary(response.data.summaries || []);
        
        // Calculate overall stats
        const totals = response.data.summaries.reduce((acc, summary) => ({
          totalCalls: acc.totalCalls + (summary.calls_done || 0),
          totalLeads: acc.totalLeads + (summary.total_leads || 0),
          noResponse: acc.noResponse + (summary.no_response || 0),
          interested: acc.interested + (summary.highly_interested || 0),
          notInterested: acc.notInterested + (summary.not_interested || 0),
          callbacks: acc.callbacks + (summary.callbacks || 0)
        }), {
          totalCalls: 0,
          totalLeads: 0,
          noResponse: 0,
          interested: 0,
          notInterested: 0,
          callbacks: 0
        });
        
        setOverallStats(totals);
      }
    } catch (error) {
      console.error("Error fetching daily summary:", error);
    }
  };

  const handleSendSlackReport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/telecaller-desk/send-slack-report`, {
        date: new Date().toISOString().split('T')[0]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success("Daily report sent to Slack!");
      } else {
        toast.error(response.data.message || "Failed to send report");
      }
    } catch (error) {
      console.error("Error sending Slack report:", error);
      toast.error(error.response?.data?.detail || "Failed to send Slack report");
    }
  };

  // Prepare chart data
  const getCallsPerDayData = () => {
    const dailyData = {};
    
    callStatistics.forEach(telecaller => {
      telecaller.daily_stats?.forEach(day => {
        if (!dailyData[day.date]) {
          dailyData[day.date] = { date: day.date, totalCalls: 0 };
        }
        dailyData[day.date].totalCalls += day.call_count;
        dailyData[day.date][telecaller.telecaller_name] = day.call_count;
      });
    });
    
    return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
  };

  const getTelecallerComparisonData = () => {
    return callStatistics.map(tc => ({
      name: tc.telecaller_name?.split('@')[0] || tc.telecaller_email?.split('@')[0] || 'Unknown',
      calls: tc.total_calls,
      email: tc.telecaller_email
    })).sort((a, b) => b.calls - a.calls);
  };

  const getStatusDistributionData = () => {
    const statusCounts = dailySummary.reduce((acc, summary) => {
      acc.noResponse += summary.no_response || 0;
      acc.interested += summary.highly_interested || 0;
      acc.notInterested += summary.not_interested || 0;
      acc.callbacks += summary.callbacks || 0;
      return acc;
    }, { noResponse: 0, interested: 0, notInterested: 0, callbacks: 0 });
    
    return [
      { name: 'No Response', value: statusCounts.noResponse, color: '#EF4444' },
      { name: 'Highly Interested', value: statusCounts.interested, color: '#10B981' },
      { name: 'Not Interested', value: statusCounts.notInterested, color: '#F59E0B' },
      { name: 'Callbacks', value: statusCounts.callbacks, color: '#3B82F6' }
    ].filter(item => item.value > 0);
  };

  const filteredSummary = selectedTelecaller === "all" 
    ? dailySummary 
    : dailySummary.filter(s => s.telecaller_email === selectedTelecaller);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" data-testid="telecaller-statistics-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/telecaller-desk')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Desk
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              Telecaller Statistics
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Detailed performance insights and analytics</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-36"
            />
            <span className="text-gray-500">to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-36"
            />
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {/* Send Slack Report Button */}
          {isAdmin && (
            <Button 
              onClick={handleSendSlackReport}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Bell className="w-4 h-4 mr-2" />
              Send Daily Report
            </Button>
          )}
        </div>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Calls</p>
                <p className="text-3xl font-bold">{overallStats.totalCalls}</p>
              </div>
              <PhoneCall className="w-10 h-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Total Leads</p>
                <p className="text-3xl font-bold">{overallStats.totalLeads}</p>
              </div>
              <Users className="w-10 h-10 text-green-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm">Highly Interested</p>
                <p className="text-3xl font-bold">{overallStats.interested}</p>
              </div>
              <ThumbsUp className="w-10 h-10 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">No Response</p>
                <p className="text-3xl font-bold">{overallStats.noResponse}</p>
              </div>
              <PhoneMissed className="w-10 h-10 text-red-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Not Interested</p>
                <p className="text-3xl font-bold">{overallStats.notInterested}</p>
              </div>
              <PhoneOff className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Callbacks</p>
                <p className="text-3xl font-bold">{overallStats.callbacks}</p>
              </div>
              <Clock className="w-10 h-10 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Calls Per Day Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Calls Per Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={getCallsPerDayData()}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => format(parseISO(value), 'MMMM dd, yyyy')}
                />
                <Area 
                  type="monotone" 
                  dataKey="totalCalls" 
                  stroke="#3B82F6" 
                  fillOpacity={1} 
                  fill="url(#colorCalls)" 
                  name="Total Calls"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Telecaller Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Telecaller Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getTelecallerComparisonData()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="calls" fill="#10B981" radius={[0, 4, 4, 0]} name="Total Calls" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution & Telecaller Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={getStatusDistributionData()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {getStatusDistributionData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Summary Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Daily Summary by Telecaller
            </CardTitle>
            <Select value={selectedTelecaller} onValueChange={setSelectedTelecaller}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by telecaller" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Telecallers</SelectItem>
                {telecallers.map(tc => (
                  <SelectItem key={tc.email} value={tc.email}>
                    {tc.first_name || tc.email?.split('@')[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Telecaller</th>
                    <th className="text-center py-3 px-2 font-semibold">Total Leads</th>
                    <th className="text-center py-3 px-2 font-semibold">Calls Done</th>
                    <th className="text-center py-3 px-2 font-semibold">No Response</th>
                    <th className="text-center py-3 px-2 font-semibold">Highly Interested</th>
                    <th className="text-center py-3 px-2 font-semibold">Not Interested</th>
                    <th className="text-center py-3 px-2 font-semibold">Callbacks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.length > 0 ? (
                    filteredSummary.map((summary, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{summary.telecaller_name}</p>
                            <p className="text-xs text-gray-500">{summary.telecaller_email}</p>
                          </div>
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {summary.total_leads || 0}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {summary.calls_done || 0}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {summary.no_response || 0}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                            {summary.highly_interested || 0}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge variant="outline" className="bg-amber-50 text-amber-700">
                            {summary.not_interested || 0}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            {summary.callbacks || 0}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No data available for the selected date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Telecaller Cards */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          Individual Telecaller Reports
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {callStatistics.map((telecaller, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {(telecaller.telecaller_name || telecaller.telecaller_email || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {telecaller.telecaller_name?.split('@')[0] || telecaller.telecaller_email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500">{telecaller.telecaller_email}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800 text-lg px-3">
                    {telecaller.total_calls} calls
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {telecaller.daily_stats?.slice(0, 5).map((day, dayIndex) => (
                    <div key={dayIndex} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {format(parseISO(day.date), 'EEE, MMM dd')}
                        </span>
                      </div>
                      <Badge variant="outline">
                        {day.call_count} calls
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TelecallerStatistics;
