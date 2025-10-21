import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileDown, QrCode as QrCodeIcon } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function QRAnalytics() {
  const { qrId } = useParams();
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState(null);

  useEffect(() => {
    fetchAnalytics();
    fetchScans();
  }, [qrId, selectedFilter]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      let url = `${API}/qr-codes/${qrId}/analytics?filter_type=${selectedFilter}`;
      if (selectedFilter === 'custom' && customStartDate && customEndDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setQrCode(response.data.qr_code);
      setAnalytics(response.data.analytics);
      
      // Fetch QR image
      try {
        const imgResponse = await axios.get(`${API}/qr-codes/${qrId}/download`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        const imageUrl = URL.createObjectURL(imgResponse.data);
        setQrImageUrl(imageUrl);
      } catch (imgError) {
        console.error('Failed to load QR image:', imgError);
      }
      
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchScans = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/qr-codes/${qrId}/scans?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScans(response.data.scans || []);
    } catch (error) {
      console.error('Failed to fetch scans:', error);
    }
  };

  const handleDownloadQR = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/qr-codes/${qrId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${qrCode.name}_QR.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('QR code downloaded!');
    } catch (error) {
      console.error('Failed to download QR code:', error);
      toast.error('Failed to download QR code');
    }
  };

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/qr-codes/${qrId}/export-csv`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${qrCode.name}_scans.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Scan data exported!');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Failed to export scan data');
    }
  };

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
  };

  const applyCustomFilter = () => {
    if (!customStartDate || !customEndDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    setSelectedFilter('custom');
    fetchAnalytics();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Prepare chart data
  const chartData = {
    labels: analytics?.graph_data?.map(d => d.date) || [],
    datasets: [
      {
        label: 'Scans',
        data: analytics?.graph_data?.map(d => d.scans) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  if (loading && !qrCode) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard/qr-codes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{qrCode?.name}</h1>
            <p className="text-gray-600 mt-1">Created: {qrCode && formatDate(qrCode.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadQR}>
            <Download className="w-4 h-4 mr-2" />
            Download QR
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <FileDown className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* QR Code Display */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              {qrImageUrl ? (
                <img 
                  src={qrImageUrl}
                  alt="QR Code"
                  className="h-32 w-32 object-contain"
                />
              ) : (
                <QrCodeIcon className="h-32 w-32 text-gray-400" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <span className="text-sm text-gray-600">Type:</span>
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                  {qrCode?.landing_page_type === 'single' ? 'Single URL' : 'Multiple URLs'}
                </span>
              </div>
              {qrCode?.landing_page_type === 'single' && (
                <div className="text-sm">
                  <span className="text-gray-600">Landing Page:</span>
                  <a href={qrCode.landing_page_single} target="_blank" rel="noopener noreferrer" 
                     className="ml-2 text-blue-600 hover:underline">
                    {qrCode.landing_page_single}
                  </a>
                </div>
              )}
              {qrCode?.landing_page_type === 'multiple' && (
                <div className="text-sm space-y-1">
                  {qrCode.landing_page_ios && (
                    <div><span className="text-gray-600">iOS:</span> 
                    <a href={qrCode.landing_page_ios} target="_blank" rel="noopener noreferrer" 
                       className="ml-2 text-blue-600 hover:underline">{qrCode.landing_page_ios}</a></div>
                  )}
                  {qrCode.landing_page_android && (
                    <div><span className="text-gray-600">Android:</span> 
                    <a href={qrCode.landing_page_android} target="_blank" rel="noopener noreferrer" 
                       className="ml-2 text-blue-600 hover:underline">{qrCode.landing_page_android}</a></div>
                  )}
                  {qrCode.landing_page_mobile && (
                    <div><span className="text-gray-600">Mobile:</span> 
                    <a href={qrCode.landing_page_mobile} target="_blank" rel="noopener noreferrer" 
                       className="ml-2 text-blue-600 hover:underline">{qrCode.landing_page_mobile}</a></div>
                  )}
                  {qrCode.landing_page_desktop && (
                    <div><span className="text-gray-600">Desktop:</span> 
                    <a href={qrCode.landing_page_desktop} target="_blank" rel="noopener noreferrer" 
                       className="ml-2 text-blue-600 hover:underline">{qrCode.landing_page_desktop}</a></div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedFilter === 'all' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('all')}
              size="sm"
            >
              All Time
            </Button>
            <Button
              variant={selectedFilter === 'today' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('today')}
              size="sm"
            >
              Today
            </Button>
            <Button
              variant={selectedFilter === 'yesterday' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('yesterday')}
              size="sm"
            >
              Yesterday
            </Button>
            <Button
              variant={selectedFilter === 'last_7_days' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('last_7_days')}
              size="sm"
            >
              Last 7 Days
            </Button>
            <Button
              variant={selectedFilter === 'last_30_days' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('last_30_days')}
              size="sm"
            >
              Last 30 Days
            </Button>
            <Button
              variant={selectedFilter === 'last_3_months' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('last_3_months')}
              size="sm"
            >
              Last 3 Months
            </Button>
            
            {/* Custom Date Range */}
            <div className="flex gap-2 items-center ml-auto">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <Button onClick={applyCustomFilter} size="sm">
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{analytics?.total_scans || 0}</div>
          </CardContent>
        </Card>

        {Object.entries(analytics?.device_breakdown || {}).slice(0, 3).map(([device, count]) => (
          <Card key={device}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 capitalize">{device}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Scan Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {analytics?.graph_data?.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No scan data available for the selected period
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Locations */}
      {analytics?.top_locations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.top_locations.map((location, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">{location.country}</span>
                  <span className="text-gray-600">{location.scans} scans</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No scans yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device & Browser</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detailed Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coordinates</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div>{scan.scan_date}</div>
                        <div className="text-xs text-gray-500">{scan.scan_time}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs capitalize w-fit">
                            {scan.device_type}
                          </span>
                          <span className="text-xs text-gray-600">
                            {scan.browser} on {scan.os}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {scan.city || scan.region || scan.country ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">
                              {scan.city || 'Unknown City'}
                            </span>
                            {scan.region && (
                              <span className="text-xs text-gray-600">{scan.region}</span>
                            )}
                            <span className="text-xs text-gray-600">
                              {scan.country || 'Unknown Country'}
                            </span>
                            {scan.timezone && (
                              <span className="text-xs text-gray-500 italic">{scan.timezone}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {scan.latitude && scan.longitude ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs">Lat: {scan.latitude.toFixed(6)}</span>
                            <span className="text-xs">Lng: {scan.longitude.toFixed(6)}</span>
                            <span className="text-xs text-gray-400">
                              ({scan.location_source?.toUpperCase()})
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs">{scan.ip_address}</span>
                          {scan.isp && (
                            <span className="text-xs text-gray-500">{scan.isp}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
