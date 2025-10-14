import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Key, ArrowLeft } from "lucide-react";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    temp_password: "",
    new_password: "",
    confirm_password: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.new_password !== formData.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }

    if (formData.new_password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/reset-with-temp-password`, {
        email: formData.email,
        temp_password: formData.temp_password,
        new_password: formData.new_password
      });
      
      toast.success(response.data.message || "Password reset successful!");
      
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src="/nura-black.png" 
              alt="Nura Pulse Logo" 
              className="h-16 w-auto dark:hidden"
            />
            <img 
              src="/nura-white.png" 
              alt="Nura Pulse Logo" 
              className="h-16 w-auto hidden dark:block"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Nura Pulse</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Reset Your Password</p>
        </div>

        {/* Reset Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Key className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Forgot Password</h2>
          </div>

          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Enter the temporary password provided by your admin and create a new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email Address *</Label>
              <Input
                id="email"
                type="email"
                data-testid="reset-email-input"
                placeholder="Enter your email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            <div>
              <Label htmlFor="temp_password" className="text-gray-700 dark:text-gray-300">Temporary Password *</Label>
              <Input
                id="temp_password"
                type="text"
                data-testid="temp-password-input"
                placeholder="Enter temporary password from admin"
                value={formData.temp_password}
                onChange={(e) => setFormData({ ...formData, temp_password: e.target.value })}
                className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            <div>
              <Label htmlFor="new_password" className="text-gray-700 dark:text-gray-300">New Password *</Label>
              <Input
                id="new_password"
                type="password"
                data-testid="new-password-input"
                placeholder="Enter new password (min 6 characters)"
                value={formData.new_password}
                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            <div>
              <Label htmlFor="confirm_password" className="text-gray-700 dark:text-gray-300">Confirm New Password *</Label>
              <Input
                id="confirm_password"
                type="password"
                data-testid="confirm-new-password-input"
                placeholder="Re-enter new password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            <Button
              type="submit"
              data-testid="reset-password-submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              <ArrowLeft size={16} className="mr-1" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;