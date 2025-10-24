import React, { useState, useEffect } from 'react';
import { API, useAuth } from '@/App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Activity, Users, Loader2, RefreshCw, Calendar, Eye, TrendingUp } from 'lucide-react';

const UserActivityAnalytics = () => {
  const { user } = useAuth();
  
  // Activity logs state
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [totalLogs, setTotalLogs] = useState(0);
  
  // Active users state
  const [activeUsers, setActiveUsers] = useState([]);
  const [loadingActiveUsers, setLoadingActiveUsers] = useState(false);

  useEffect(() => {
    // Set default date range (last 7 days)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
    
    fetchLogs();
    fetchActiveUsers();
    
    // Auto-refresh active users every 30 seconds
    const interval = setInterval(fetchActiveUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/analytics/user-activity?limit=100&skip=0`;
      
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;
      if (filterUser) url += `&user_email=${filterUser}`;
      if (filterModule) url += `&module=${filterModule}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchActiveUsers = async () => {
    setLoadingActiveUsers(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/analytics/active-users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active users');
      }

      const data = await response.json();
      setActiveUsers(data.active_users || []);
    } catch (error) {
      console.error('Error fetching active users:', error);
    } finally {
      setLoadingActiveUsers(false);
    }
  };

  const getActionColor = (action) => {
    const colors = {
      'login': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'logout': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      'create': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'update': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'delete': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'view': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'import': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'export': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
    };
    
    for (const [key, color] of Object.entries(colors)) {
      if (action.toLowerCase().includes(key)) {
        return color;
      }
    }
    
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const getModuleColor = (module) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-teal-500'
    ];
    
    if (!module) return colors[0];
    
    const hash = module.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getRelativeTime = (timestamp) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now - activityTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return activityTime.toLocaleDateString();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Activity className="h-8 w-8" />
          User Activity Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Monitor user activities and track live app usage
        </p>
      </div>

      {/* Live Active Users */}
      <Card className="dark:bg-gray-800 dark:border-gray-700 mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Live Active Users
                <Badge variant="success" className="ml-2 bg-green-600 text-white">
                  {activeUsers.length} Online
                </Badge>
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Users active in the last 5 minutes
              </CardDescription>
            </div>
            <Button
              onClick={fetchActiveUsers}
              variant="outline"
              size="sm"
              disabled={loadingActiveUsers}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingActiveUsers ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingActiveUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : activeUsers.length === 0 ? (
            <Alert>
              <AlertDescription>No users currently active</AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeUsers.map((activeUser, idx) => (
                <div
                  key={idx}
                  className="p-4 border rounded-lg dark:border-gray-700 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-3 h-3 rounded-full ${getModuleColor(activeUser.current_module)} animate-pulse`}></div>
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {activeUser.user_email}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-3 w-3" />
                      <span className="font-medium">{activeUser.current_module || 'Unknown'}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Last activity: {getRelativeTime(activeUser.last_activity)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Actions: {activeUser.activity_count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Logs */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Activity History
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            View and filter user activity logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div>
              <Label className="text-sm dark:text-gray-300">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <Label className="text-sm dark:text-gray-300">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <Label className="text-sm dark:text-gray-300">User Email</Label>
              <Input
                placeholder="Filter by user..."
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="mt-1 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <Label className="text-sm dark:text-gray-300">Module</Label>
              <Input
                placeholder="Filter by module..."
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="mt-1 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={fetchLogs}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={loadingLogs}
              >
                {loadingLogs ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Apply Filters
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Logs Table */}
          {loadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : logs.length === 0 ? (
            <Alert>
              <AlertDescription>No activity logs found for the selected filters</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Showing {logs.length} of {totalLogs} activities
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                      User
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                      Module
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={log.id || idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                        {log.user_email}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${getModuleColor(log.module)} text-white`}>
                          {log.module || 'N/A'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {log.details || '-'}
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
};

export default UserActivityAnalytics;
