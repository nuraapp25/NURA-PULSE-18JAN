import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Eye, Activity, RefreshCw, TrendingUp } from "lucide-react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";

const Analytics = () => {
  const [activeUsers, setActiveUsers] = useState([]);
  const [pageViews, setPageViews] = useState([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    
    // Auto-refresh every 10 seconds if enabled
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchAnalytics();
      }, 10000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem("token");
      
      // Fetch active users
      const usersResponse = await axios.get(`${API}/analytics/active-users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch page views
      const viewsResponse = await axios.get(`${API}/analytics/page-views`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setActiveUsers(usersResponse.data.active_users || []);
      setPageViews(viewsResponse.data.page_views || []);
      setTotalViews(viewsResponse.data.total_views || 0);
      
    } catch (error) {
      console.error("Error fetching analytics:", error);
      if (error.response?.status !== 403) {
        toast.error("Failed to load analytics data");
      }
    } finally {
      setLoading(false);
    }
  };

  const getAccountTypeBadgeColor = (accountType) => {
    switch (accountType) {
      case "master_admin":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "admin":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "ops_team":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const formatAccountType = (accountType) => {
    const types = {
      "master_admin": "Master Admin",
      "admin": "Admin",
      "ops_team": "Ops Team",
      "standard": "Standard"
    };
    return types[accountType] || accountType;
  };

  const formatPageName = (page) => {
    // Convert route paths to readable names
    const pageNames = {
      "/dashboard": "Dashboard",
      "/dashboard/payment-data-extractor": "Payment Data Extractor",
      "/dashboard/driver-onboarding": "Driver Onboarding",
      "/dashboard/telecaller-desk": "Telecaller's Desk",
      "/dashboard/montra-vehicle": "Montra Vehicle Insights",
      "/dashboard/expense-tracker": "Expense Tracker",
      "/dashboard/admin/users": "User Management",
      "/dashboard/admin/files": "Files",
      "/dashboard/admin/payment-screenshots": "Payment Screenshots",
      "/dashboard/admin/analytics": "Analytics",
      "/dashboard/battery-consumption": "Battery Consumption",
      "/dashboard/battery-milestones": "Battery Milestones",
      "/dashboard/battery-audit": "Battery Audit",
      "/dashboard/morning-charge-audit": "Morning Charge Audit"
    };
    return pageNames[page] || page;
  };

  const getTimeSince = (lastSeenStr) => {
    const lastSeen = new Date(lastSeenStr);
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return "Just now";
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} min ago`;
    return `${Math.floor(diffSecs / 3600)} hr ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📊 Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time user activity and page view statistics</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            <Activity size={16} className={autoRefresh ? "mr-2 animate-pulse" : "mr-2"} />
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </Button>
          <Button
            onClick={fetchAnalytics}
            variant="outline"
            size="sm"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">
              Active Users
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{activeUsers.length}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Currently online
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">
              Total Page Views
            </CardTitle>
            <Eye className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalViews}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Since app startup
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">
              Popular Pages
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{pageViews.length}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Pages tracked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Users Table */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">👥 Active Users</CardTitle>
        </CardHeader>
        <CardContent>
          {activeUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No users currently active
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Current Page</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {activeUsers.map((user, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {user.username || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAccountTypeBadgeColor(user.account_type)}`}>
                          {formatAccountType(user.account_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {formatPageName(user.current_page)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {getTimeSince(user.last_seen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Page Views Statistics */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">📈 Page View Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {pageViews.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No page views recorded yet
            </div>
          ) : (
            <div className="space-y-4">
              {pageViews.map((pageView, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatPageName(pageView.page)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {pageView.page}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {pageView.views}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">views</p>
                    </div>
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all"
                        style={{
                          width: `${(pageView.views / totalViews) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
