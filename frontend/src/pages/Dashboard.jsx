import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth, useTheme, API } from "@/App";
import { Button } from "@/components/ui/button";
import { Home, FileText, Car, Phone, BarChart3, FolderOpen, Settings, Users, Moon, Sun, Menu, X, ChevronDown, Folder, Image, Receipt, Activity, MapPin, QrCode, Navigation, ClipboardList, PieChart, Zap, Database } from "lucide-react";
import axios from "axios";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // New: collapsed state
  const [appsExpanded, setAppsExpanded] = useState(true);

  // Track page views
  useEffect(() => {
    const trackPageView = async () => {
      try {
        const token = localStorage.getItem("token");
        if (token && location.pathname) {
          await axios.post(
            `${API}/analytics/track-page-view`,
            { page: location.pathname },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch (error) {
        // Silently fail - analytics shouldn't break the app
        console.debug("Analytics tracking failed:", error);
      }
    };

    trackPageView();
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await axios.post(
          `${API}/analytics/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (error) {
      console.debug("Analytics logout tracking failed:", error);
    }
    logout();
    navigate("/login");
  };

  const menuItems = [
    { name: "Home", icon: Home, path: "/dashboard", exact: true },
  ];

  // Filter apps based on user account type
  const allApps = [
    { name: "Payment Data Extractor", icon: FileText, path: "/dashboard/payment-reconciliation", roles: ["master_admin", "admin", "standard", "ops_team"] },
    // { name: "Ride Pay Extract v2", icon: Zap, path: "/dashboard/ride-pay-extract-v2", roles: ["master_admin", "admin", "standard", "ops_team"] }, // Hidden - moved to App Settings
    { name: "Driver Onboarding", icon: Car, path: "/dashboard/driver-onboarding", roles: ["master_admin", "admin", "standard"] },
    { name: "Telecallers Management", icon: Users, path: "/dashboard/telecallers-management", roles: ["master_admin", "admin"] },
    { name: "Telecaller's Desk", icon: Phone, path: "/dashboard/telecaller-desk", roles: ["master_admin", "admin", "standard", "telecaller"] },
    { name: "Montra Vehicle Insights", icon: BarChart3, path: "/dashboard/montra-vehicle", roles: ["master_admin", "admin", "standard"] },
    { name: "Expense Tracker", icon: Receipt, path: "/dashboard/expense-tracker", roles: ["master_admin", "admin", "standard"] },
    { name: "Hotspot Planning", icon: MapPin, path: "/dashboard/hotspot-planning", roles: ["master_admin", "admin", "standard"] },
    { name: "QR Code Manager", icon: QrCode, path: "/dashboard/qr-codes", roles: ["master_admin"] },
    { name: "Ride Deck Data Analysis", icon: Navigation, path: "/dashboard/ride-deck-analysis", roles: ["master_admin", "admin", "standard"] },
    { name: "RCA Management", icon: ClipboardList, path: "/dashboard/rca-management", roles: ["master_admin", "admin"] },
    { name: "Analytics Dashboards", icon: PieChart, path: "/dashboard/analytics-dashboards", roles: ["master_admin", "admin"] },
  ];

  const apps = allApps.filter(app => 
    app.roles.includes(user?.account_type)
  );

  const manageItems = [
    { name: "Manage DB", icon: Database, path: "/dashboard/manage", roles: ["master_admin"] },
    { name: "Payment Screenshots", icon: Image, path: "/dashboard/admin/payment-screenshots", roles: ["master_admin", "admin"] },
    { name: "App Settings", icon: Settings, path: "/dashboard/app-settings", roles: ["master_admin"] },
  ];

  const analyticsItems = [
    { name: "User Activity", icon: Activity, path: "/dashboard/user-activity", roles: ["master_admin", "admin"] },
  ];

  const settingsItems = [
    { name: "Settings", icon: Settings, path: "/dashboard/settings" },
  ];

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${sidebarCollapsed ? 'w-20' : 'w-64'} 
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col overflow-hidden">
          {/* Logo & Collapse Button */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed ? (
                <div className="flex-1 flex items-center justify-center">
                  <img 
                    src={theme === 'dark' ? '/nura-white.png' : '/nura-black.png'}
                    alt="Nura Pulse Logo" 
                    className="h-16 w-auto"
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <img 
                    src={theme === 'dark' ? '/nura-white.png' : '/nura-black.png'}
                    alt="Nura" 
                    className="h-10 w-10 object-contain"
                  />
                </div>
              )}
              {/* Mobile close button */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 absolute right-6"
              >
                <X size={24} />
              </button>
            </div>
            {/* Collapse toggle button (desktop only) */}
            <div className="hidden lg:flex justify-center mt-4">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          {/* Navigation - with independent scrolling */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Home */}
            <div>
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  data-testid={`sidebar-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg font-medium
                    ${isActive(item.path, item.exact)
                      ? 'bg-[#bceb39] dark:bg-[#bceb39] text-gray-900 dark:text-gray-900'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <item.icon size={20} />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </button>
              ))}
            </div>

            {/* Apps Section */}
            <div>
              {!sidebarCollapsed && (
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Apps
                </div>
              )}
              <div className="mt-2 space-y-1">
                {apps.map((item) => (
                  <button
                    key={item.name}
                    data-testid={`sidebar-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg font-medium text-sm
                      ${isActive(item.path)
                        ? 'bg-[#bceb39] dark:bg-[#bceb39] text-gray-900 dark:text-gray-900'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                    title={sidebarCollapsed ? item.name : ''}
                  >
                    <item.icon size={18} />
                    {!sidebarCollapsed && <span className="text-left leading-tight">{item.name}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin Section - User Management (Master Admin only), Files & Payment Screenshots (All Admins except Ops Team) */}
            {(user?.account_type === "master_admin" || user?.account_type === "admin") && user?.account_type !== "ops_team" && (
              <div>
                {!sidebarCollapsed && (
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Admin
                  </div>
                )}
                {user?.account_type === "master_admin" && (
                  <button
                    data-testid="sidebar-user-management"
                    onClick={() => {
                      navigate("/dashboard/users");
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg font-medium
                      ${isActive("/dashboard/users")
                        ? 'bg-[#bceb39] dark:bg-[#bceb39] text-gray-900 dark:text-gray-900'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                    title={sidebarCollapsed ? "User Management" : ''}
                  >
                    <Users size={20} />
                    {!sidebarCollapsed && <span>User Management</span>}
                  </button>
                )}
                <button
                  data-testid="sidebar-files"
                  onClick={() => {
                    navigate("/dashboard/admin/files");
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg font-medium
                    ${isActive("/dashboard/admin/files")
                      ? 'bg-[#bceb39] dark:bg-[#bceb39] text-gray-900 dark:text-gray-900'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  title={sidebarCollapsed ? "Files" : ''}
                >
                  <Folder size={20} />
                  {!sidebarCollapsed && <span>Files</span>}
                </button>
                {user?.account_type === "master_admin" && (
                  <button
                    data-testid="sidebar-analytics"
                    onClick={() => {
                      navigate("/dashboard/admin/analytics");
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg font-medium
                      ${isActive("/dashboard/admin/analytics")
                        ? 'bg-[#bceb39] dark:bg-[#bceb39] text-gray-900 dark:text-gray-900'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                    title={sidebarCollapsed ? "Analytics" : ''}
                  >
                    <Activity size={20} />
                    {!sidebarCollapsed && <span>Analytics</span>}
                  </button>
                )}
              </div>
            )}

            {/* Manage */}
            <div>
              {!sidebarCollapsed && (
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Manage
                </div>
              )}
              {manageItems
                .filter(item => !item.roles || item.roles.includes(user?.account_type))
                .map((item) => (
                <button
                  key={item.name}
                  data-testid={`sidebar-${item.name.toLowerCase()}`}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg font-medium text-left
                    ${isActive(item.path)
                      ? 'bg-[#bceb39] dark:bg-[#bceb39] text-gray-900 dark:text-gray-900'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <item.icon size={20} />
                  {!sidebarCollapsed && <span className="text-left">{item.name}</span>}
                </button>
              ))}
            </div>

            {/* Analytics */}
            {(user?.account_type === "master_admin" || user?.account_type === "admin") && (
              <div>
                {!sidebarCollapsed && (
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Analytics
                  </div>
                )}
                {analyticsItems
                  .filter(item => !item.roles || item.roles.includes(user?.account_type))
                  .map((item) => (
                  <button
                    key={item.name}
                    data-testid={`sidebar-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg font-medium text-left
                      ${isActive(item.path)
                        ? 'bg-[#bceb39] dark:bg-[#bceb39] text-gray-900 dark:text-gray-900'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                    title={sidebarCollapsed ? item.name : ''}
                  >
                    <item.icon size={20} />
                    {!sidebarCollapsed && <span className="text-left">{item.name}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Settings */}
            <div>
              {settingsItems.map((item) => (
                <button
                  key={item.name}
                  data-testid={`sidebar-${item.name.toLowerCase()}`}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-lg font-medium
                    ${isActive(item.path)
                      ? 'bg-[#bceb39] dark:bg-[#bceb39] text-gray-900 dark:text-gray-900'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <item.icon size={20} />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 flex-shrink-0">
          <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-600 dark:text-gray-300"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">
                Welcome, {user?.first_name}
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="theme-toggle-button"
                className="rounded-lg"
              >
                {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
              </Button>

              {/* Profile & Logout */}
              <div className="flex items-center space-x-3 pl-3 border-l border-gray-200 dark:border-gray-700">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.first_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.account_type?.replace('_', ' ')}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="h-9 px-4 rounded-lg"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;