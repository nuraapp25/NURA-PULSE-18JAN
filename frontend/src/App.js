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
import MontraVehicle from "@/pages/MontraVehicle";
import Files from "@/pages/Files";
import PaymentScreenshots from "@/pages/PaymentScreenshots";
import BatteryConsumption from "@/pages/BatteryConsumption";
import ManagePage from "@/pages/ManagePage";
import SettingsPage from "@/pages/SettingsPage";

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
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <div className="App">
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" />} />
              <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/dashboard" />} />
              <Route path="/forgot-password" element={!user ? <ForgotPasswordPage /> : <Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />}>
                <Route index element={<HomePage />} />
                {user?.account_type === "master_admin" && (
                  <Route path="users" element={<UserManagement />} />
                )}
                <Route path="payment-reconciliation" element={<PaymentReconciliation />} />
                <Route path="driver-onboarding" element={<DriverOnboarding />} />
                <Route path="telecaller-queue" element={<TelecallerQueue />} />
                <Route path="montra-vehicle" element={<MontraVehicle />} />
                <Route path="montra-vehicle/battery-consumption" element={<BatteryConsumption />} />
                <Route path="admin/files" element={<Files />} />
                <Route path="admin/payment-screenshots" element={<PaymentScreenshots />} />
                <Route path="manage" element={<ManagePage />} />
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