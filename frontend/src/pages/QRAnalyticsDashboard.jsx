import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, Download, Filter, Calendar, Smartphone, MapPin, TrendingUp } from "lucide-react";

const QRAnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedQRName, setSelectedQRName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Stats
  const [stats, setStats] = useState({
    totalScans: 0,
    platformBreakdown: {},
    topQRCodes: [],
    scansOverTime: []
  });
  
  const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];
  
  useEffect(() => {
    fetchCampaigns();
    fetchAnalytics();
  }, []);
  
  const fetchCampaigns = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/qr-codes/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    }
  };
  
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      let url = `${API}/qr-codes/analytics?`;
      if (selectedCampaign) url += `campaign_name=${encodeURIComponent(selectedCampaign)}&`;
      if (selectedQRName) url += `qr_name=${encodeURIComponent(selectedQRName)}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data;
      setAnalytics(data.scans || []);
      processStats(data.scans || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };
  
  const processStats = (scans) => {
    // Total scans
    const totalScans = scans.length;
    
    // Platform breakdown
    const platformBreakdown = {};
    scans.forEach(scan => {
      const platform = scan.platform || 'unknown';
      platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
    });
    
    // Top QR codes
    const qrCodeCounts = {};
    scans.forEach(scan => {
      const qrName = scan.qr_name || 'Unknown';
      qrCodeCounts[qrName] = (qrCodeCounts[qrName] || 0) + 1;
    });
    
    const topQRCodes = Object.entries(qrCodeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Scans over time (group by date)
    const scansByDate = {};
    scans.forEach(scan => {
      const date = new Date(scan.scanned_at).toLocaleDateString();
      scansByDate[date] = (scansByDate[date] || 0) + 1;
    });
    
    const scansOverTime = Object.entries(scansByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    setStats({
      totalScans,
      platformBreakdown,
      topQRCodes,
      scansOverTime
    });
  };
  
  const exportToCSV = () => {
    if (analytics.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    const headers = [
      "Date/Time",
      "QR Code Name",
      "Campaign",
      "Platform",
      "OS",
      "Browser",
      "Device",
      "IP Address"
    ];
    
    const rows = analytics.map(scan => [
      new Date(scan.scanned_at).toLocaleString(),
      scan.qr_name || '-',
      scan.campaign_name || '-',
      scan.platform || '-',
      `${scan.os_family || '-'} ${scan.os_version || ''}`,
      `${scan.browser || '-'} ${scan.browser_version || ''}`,
      scan.device || '-',
      scan.ip_address || '-'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success("Analytics exported successfully!");
  };
  
  const platformData = Object.entries(stats.platformBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-teal-600" />
            QR Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time scan tracking and insights</p>
        </div>
        <Button onClick={exportToCSV} className="bg-teal-600 hover:bg-teal-700">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>
      
      {/* Filters */}
      <Card className="border-2 border-teal-100 dark:border-teal-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Campaign</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Campaigns</SelectItem>
                  {campaigns.map(campaign => (
                    <SelectItem key={campaign.campaign_name} value={campaign.campaign_name}>
                      {campaign.campaign_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>QR Code Name</Label>
              <Input
                placeholder="e.g., TN55S7283"
                value={selectedQRName}
                onChange={(e) => setSelectedQRName(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button onClick={fetchAnalytics} className="bg-teal-600 hover:bg-teal-700">
              Apply Filters
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setSelectedCampaign("");
                setSelectedQRName("");
                setStartDate("");
                setEndDate("");
                fetchAnalytics();
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-teal-600 bg-gradient-to-br from-teal-50 to-white dark:from-teal-900/20 dark:to-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Scans</p>
                <p className="text-3xl font-bold text-teal-600">{stats.totalScans}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-teal-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-yellow-600 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-900/20 dark:to-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Campaigns</p>
                <p className="text-3xl font-bold text-yellow-600">{campaigns.length}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-yellow-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Top Platform</p>
                <p className="text-2xl font-bold text-blue-600">
                  {platformData.length > 0 ? platformData.sort((a, b) => b.value - a.value)[0].name : 'N/A'}
                </p>
              </div>
              <Smartphone className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scans Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Scans Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.scansOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2} name="Scans" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Top QR Codes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Performing QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topQRCodes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#f59e0b" name="Scans" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Analytics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Scan Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>QR Code Name</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.slice(0, 50).map((scan, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs">
                      {new Date(scan.scanned_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{scan.qr_name || '-'}</TableCell>
                    <TableCell>{scan.campaign_name || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        scan.platform === 'ios' ? 'bg-blue-100 text-blue-800' :
                        scan.platform === 'android' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {scan.platform || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{scan.os_family || '-'}</TableCell>
                    <TableCell className="text-xs">{scan.browser || '-'}</TableCell>
                    <TableCell className="text-xs">{scan.device || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{scan.ip_address || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {analytics.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No scan data available. Create QR codes and start tracking!
              </div>
            )}
            
            {analytics.length > 50 && (
              <div className="text-center py-4 text-sm text-gray-500">
                Showing 50 of {analytics.length} scans. Export to CSV for full data.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRAnalyticsDashboard;
