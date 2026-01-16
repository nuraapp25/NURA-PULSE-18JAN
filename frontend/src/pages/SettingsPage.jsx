import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, Key, AlertCircle, Bell, Save, ExternalLink } from "lucide-react";

const SettingsPage = () => {
  const { user } = useAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [resetRequestDialogOpen, setResetRequestDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: ""
  });

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/auth/change-password`,
        {
          old_password: passwordData.old_password,
          new_password: passwordData.new_password
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Password changed successfully");
      setPasswordDialogOpen(false);
      setPasswordData({ old_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to change password");
    }
  };

  const handleRequestPasswordReset = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/password-reset/request`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Password reset request submitted. Please wait for admin approval.");
      setResetRequestDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit reset request");
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Account Information */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600 dark:text-gray-400">Name</Label>
              <p className="text-gray-900 dark:text-white font-medium mt-1">{user?.first_name}</p>
            </div>
            <div>
              <Label className="text-gray-600 dark:text-gray-400">Email</Label>
              <p className="text-gray-900 dark:text-white font-medium mt-1">{user?.email}</p>
            </div>
            <div>
              <Label className="text-gray-600 dark:text-gray-400">Account Type</Label>
              <p className="text-gray-900 dark:text-white font-medium mt-1 capitalize">
                {user?.account_type?.replace('_', ' ')}
              </p>
            </div>
            <div>
              <Label className="text-gray-600 dark:text-gray-400">Account Created</Label>
              <p className="text-gray-900 dark:text-white font-medium mt-1">
                {new Date(user?.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <Key size={20} className="mr-2" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">Change Password</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Update your password to keep your account secure
              </p>
            </div>
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="change-password-button" variant="outline" className="ml-4">
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent className="dark:bg-gray-800">
                <DialogHeader>
                  <DialogTitle className="dark:text-white">Change Password</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="old_password">Current Password</Label>
                    <Input
                      id="old_password"
                      type="password"
                      data-testid="old-password-input"
                      value={passwordData.old_password}
                      onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                      className="dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_password">New Password</Label>
                    <Input
                      id="new_password"
                      type="password"
                      data-testid="new-password-input"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className="dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      data-testid="confirm-password-input"
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      className="dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                  </div>
                  <Button type="submit" data-testid="submit-password-change" className="w-full bg-blue-600 hover:bg-blue-700">
                    Update Password
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">Forgot Password?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Request a password reset from the admin
              </p>
            </div>
            <Dialog open={resetRequestDialogOpen} onOpenChange={setResetRequestDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="request-reset-button" variant="outline" className="ml-4">
                  Request Reset
                </Button>
              </DialogTrigger>
              <DialogContent className="dark:bg-gray-800">
                <DialogHeader>
                  <DialogTitle className="dark:text-white">Request Password Reset</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">
                        Your request will be sent to an admin for approval. Once approved, you'll receive a temporary password to reset your account.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleRequestPasswordReset}
                    data-testid="submit-reset-request"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Submit Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;