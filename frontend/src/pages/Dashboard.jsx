import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth, useTheme } from "@/App";
import { Button } from "@/components/ui/button";
import { Home, FileText, Car, Phone, BarChart3, FolderOpen, Settings, Users, Moon, Sun, Menu, X, ChevronDown, Folder } from "lucide-react";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appsExpanded, setAppsExpanded] = useState(true);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const menuItems = [
    { name: "Home", icon: Home, path: "/dashboard", exact: true },
  ];

  const apps = [
    { name: "Payment Reconciliation", icon: FileText, path: "/dashboard/payment-reconciliation" },
    { name: "Driver Onboarding", icon: Car, path: "/dashboard/driver-onboarding" },
    { name: "Telecaller's Desk", icon: Phone, path: "/dashboard/telecaller-queue" },
    { name: "Montra Vehicle Insights", icon: BarChart3, path: "/dashboard/montra-vehicle" },
  ];

  const manageItems = [
    { name: "Manage", icon: FolderOpen, path: "/dashboard/manage" },
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
        w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src="https://nuraemobility.co.in/assets/Asset%205@4x-DaHkW2HF.png" 
                  alt="Nura Logo" 
                  className="h-10 w-auto"
                />
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Navigation */}
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
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium
                    ${isActive(item.path, item.exact)
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>

            {/* Apps Section */}
            <div>
              <button
                onClick={() => setAppsExpanded(!appsExpanded)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                <span>Apps</span>
                <ChevronDown size={16} className={`transform transition-transform ${appsExpanded ? 'rotate-180' : ''}`} />
              </button>
              {appsExpanded && (
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
                        w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm
                        ${isActive(item.path)
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }
                      `}
                    >
                      <item.icon size={18} />
                      <span className="text-left leading-tight">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Master Admin - User Management */}
            {user?.account_type === "master_admin" && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Admin
                </div>
                <button
                  data-testid="sidebar-user-management"
                  onClick={() => {
                    navigate("/dashboard/users");
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium
                    ${isActive("/dashboard/users")
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Users size={20} />
                  <span>User Management</span>
                </button>
                <button
                  data-testid="sidebar-files"
                  onClick={() => {
                    navigate("/dashboard/admin/files");
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium
                    ${isActive("/dashboard/admin/files")
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Folder size={20} />
                  <span>Files</span>
                </button>
                <button
                  data-testid="sidebar-payment-screenshots"
                  onClick={() => {
                    navigate("/dashboard/admin/payment-screenshots");
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium
                    ${isActive("/dashboard/admin/payment-screenshots")
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <FileText size={20} />
                  <span>Payment Screenshots</span>
                </button>
              </div>
            )}

            {/* Manage */}
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Manage
              </div>
              {manageItems.map((item) => (
                <button
                  key={item.name}
                  data-testid={`sidebar-${item.name.toLowerCase()}`}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium
                    ${isActive(item.path)
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>

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
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium
                    ${isActive(item.path)
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
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
        <main className="flex-1 p-4 lg:p-8">
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