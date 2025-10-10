import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    account_type: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.account_type) {
      toast.error("Please select an account type");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const { confirm_password, ...registerData } = formData;
      const response = await axios.post(`${API}/auth/register`, registerData);
      
      toast.success(
        <div>
          <p className="font-semibold">Registration Successful!</p>
          <p className="text-sm mt-1">{response.data.message}</p>
        </div>,
        { duration: 8000 }
      );
      
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      const errorMessage = error.response?.data?.detail || "Registration failed";
      toast.error(errorMessage);
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
              src="https://nuraemobility.co.in/assets/Asset%205@4x-DaHkW2HF.png" 
              alt="Nura Logo" 
              className="h-16 w-auto"
            />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Create Your Account</p>
        </div>

        {/* Register Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Register</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name" className="text-gray-700 dark:text-gray-300">First Name *</Label>
                <Input
                  id="first_name"
                  type="text"
                  data-testid="register-firstname-input"
                  placeholder="Enter first name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="last_name" className="text-gray-700 dark:text-gray-300">Last Name</Label>
                <Input
                  id="last_name"
                  type="text"
                  data-testid="register-lastname-input"
                  placeholder="Enter last name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email ID *</Label>
              <Input
                id="email"
                type="email"
                data-testid="register-email-input"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">Password *</Label>
              <Input
                id="password"
                type="password"
                data-testid="register-password-input"
                placeholder="Create a password (min 6 characters)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            <div>
              <Label htmlFor="confirm_password" className="text-gray-700 dark:text-gray-300">Confirm Password *</Label>
              <Input
                id="confirm_password"
                type="password"
                data-testid="register-confirm-password-input"
                placeholder="Re-enter your password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            <div>
              <Label htmlFor="account_type" className="text-gray-700 dark:text-gray-300">Select Account Type *</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
              >
                <SelectTrigger data-testid="register-accounttype-select" className="mt-1.5 h-11 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <SelectValue placeholder="Choose account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              data-testid="register-submit-button"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg mt-2"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Already have an account?{" "}
              <Link
                to="/login"
                data-testid="login-link"
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;