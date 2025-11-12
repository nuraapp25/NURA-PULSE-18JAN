import React, { createContext, useContext, useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import Dashboard from "@/pages/Dashboard";
import HomePage from "@/pages/HomePage";
import UserManagement from "@/pages/UserManagement";
import PaymentReconciliation from "@/pages/PaymentReconciliation";
import DriverOnboarding from "@/pages/DriverOnboardingPage";
import TelecallerQueue from "@/pages/TelecallerQueue";
import TelecallerDesk from "@/pages/TelecallerDesk";
import TelecallerDeskMobile from "@/pages/TelecallerDeskMobile";
import MontraVehicle from "@/pages/MontraVehicle";
import VehicleServiceRequest from "@/pages/VehicleServiceRequest";
import Files from "@/pages/Files";
import PaymentScreenshots from "@/pages/PaymentScreenshots";
import BatteryConsumption from "@/pages/BatteryConsumption";
import BatteryMilestones from "@/pages/BatteryMilestones";
import BatteryAudit from "@/pages/BatteryAudit";
import MorningChargeAudit from "@/pages/MorningChargeAudit";
import ExpenseTracker from "@/pages/ExpenseTracker";
import Analytics from "@/pages/Analytics";
import HotspotPlanning from "@/pages/HotspotPlanning";
import QRCodeManager from "@/pages/QRCodeManager";
import QRCodeManagerNew from "@/pages/QRCodeManagerNew";
import QRAnalytics from "@/pages/QRAnalytics";
import QRAnalyticsDashboard from "@/pages/QRAnalyticsDashboard";
import RideDeckAnalysis from "@/pages/RideDeckAnalysisEnhanced";
import RCAManagement from "@/pages/RCAManagement";
import AnalyticsDashboards from "@/pages/AnalyticsDashboards";
import AppSettings from "@/pages/AppSettings";
import UserActivityAnalytics from "@/pages/UserActivityAnalytics";
import RidePayExtractV2 from "@/pages/RidePayExtractV2";
import ManageDB from "@/pages/ManagePage";
import SettingsPage from "@/pages/SettingsPage";
import MaintenancePage from "@/pages/MaintenancePage";
import ServerHealthMonitor from "@/components/ServerHealthMonitor";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Theme Context
const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light"; // Default light mode
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };
  
  // Check maintenance mode on app load and when user changes
  useEffect(() => {
    const checkMaintenanceMode = async () => {
      // Only check maintenance mode if user is logged in
      if (!user) {
        setMaintenanceMode(false);
        setCheckingMaintenance(false);
        return;
      }
      
      try {
        const response = await axios.get(`${API}/maintenance-status`);
        setMaintenanceMode(response.data.maintenance_mode || false);
      } catch (error) {
        console.error("Failed to check maintenance mode:", error);
        setMaintenanceMode(false);
      } finally {
        setCheckingMaintenance(false);
      }
    };
    
    checkMaintenanceMode();
    
    // Check every 30 seconds if maintenance mode changed (only when logged in)
    if (user) {
      const interval = setInterval(checkMaintenanceMode, 30000);
      return () => clearInterval(interval);
    }
  }, [user]); // Depend on user so it re-checks when user logs in/out

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (token) {
      // Verify token and get user info
      axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(response => {
        setUser(response.data);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  if (checkingMaintenance && user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show maintenance page ONLY for logged-in non-master-admins when maintenance mode is active
  if (maintenanceMode && user && user.account_type !== "master_admin") {
    return <MaintenancePage />;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <div className="App">
          {/* Server Health Monitor - Always visible */}
          <ServerHealthMonitor />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" />} />
              <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/dashboard" />} />
              <Route path="/forgot-password" element={!user ? <ForgotPasswordPage /> : <Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />}>
                <Route index element={<HomePage />} />
                {(user?.account_type === "master_admin" || user?.account_type === "admin") && (
                  <Route path="users" element={<UserManagement />} />
                )}
                <Route path="payment-reconciliation" element={<PaymentReconciliation />} />
                <Route path="ride-pay-extract-v2" element={<RidePayExtractV2 />} />
                <Route path="driver-onboarding" element={<DriverOnboarding />} />
                <Route path="telecaller-queue" element={<TelecallerQueue />} />
                <Route path="telecaller-desk" element={<TelecallerDeskMobile />} />
                <Route path="montra-vehicle" element={<MontraVehicle />} />
                <Route path="montra-vehicle/battery-consumption" element={<BatteryConsumption />} />
                <Route path="montra-vehicle/battery-milestones" element={<BatteryMilestones />} />
                <Route path="montra-vehicle/battery-audit" element={<BatteryAudit />} />
                <Route path="montra-vehicle/morning-charge-audit" element={<MorningChargeAudit />} />
                <Route path="expense-tracker" element={<ExpenseTracker />} />
                <Route path="hotspot-planning" element={<HotspotPlanning />} />
                <Route path="qr-codes" element={<QRCodeManager />} />
                <Route path="qr-codes-new" element={<QRCodeManagerNew />} />
                <Route path="qr-analytics-dashboard" element={<QRAnalyticsDashboard />} />
                <Route path="qr-codes/:qrId/analytics" element={<QRAnalytics />} />
                <Route path="ride-deck-analysis" element={<RideDeckAnalysis />} />
                <Route path="rca-management" element={<RCAManagement />} />
                <Route path="analytics-dashboards" element={<AnalyticsDashboards />} />
                <Route path="app-settings" element={<AppSettings />} />
                <Route path="user-activity" element={<UserActivityAnalytics />} />
                <Route path="admin/analytics" element={<Analytics />} />
                <Route path="admin/files" element={<Files />} />
                <Route path="admin/payment-screenshots" element={<PaymentScreenshots />} />
                <Route path="manage" element={<ManageDB />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
            </Routes>
          </BrowserRouter>
        </div>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;