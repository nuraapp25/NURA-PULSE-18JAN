import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, Key, RefreshCw, CheckCircle, XCircle, UserCheck, Copy, Mail, Download, Upload } from "lucide-react";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [passwordResets, setPasswordResets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    account_type: ""
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, statsRes, resetsRes] = await Promise.all([
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/stats`, { headers }),
        axios.get(`${API}/password-reset/requests`, { headers })
      ]);

      setUsers(usersRes.data);
      setStats(statsRes.data);
      setPasswordResets(resetsRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!newUser.account_type) {
      toast.error("Please select an account type");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/create`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("User created successfully");
      setCreateDialogOpen(false);
      setNewUser({ first_name: "", last_name: "", email: "", password: "", account_type: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create user");
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("User deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/users/approve`,
        { user_id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("User approved successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve user");
    }
  };

  const handleRejectUser = async (userId) => {
    if (!window.confirm("Are you sure you want to reject this user?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/users/reject`,
        { user_id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("User rejected");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject user");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select users to approve");
      return;
    }

    const pendingUsers = selectedUsers.filter(userId => {
      const user = users.find(u => u.id === userId);
      return user && user.status === 'pending';
    });

    if (pendingUsers.length === 0) {
      toast.error("No pending users selected");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      await Promise.all(
        pendingUsers.map(userId =>
          axios.post(`${API}/users/approve`, { user_id: userId }, { headers })
        )
      );
      
      toast.success(`${pendingUsers.length} user(s) approved successfully`);
      setSelectedUsers([]);
      fetchData();
    } catch (error) {
      toast.error("Failed to approve some users");
    }
  };

  const handleBulkReject = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select users to reject");
      return;
    }

    const pendingUsers = selectedUsers.filter(userId => {
      const user = users.find(u => u.id === userId);
      return user && user.status === 'pending';
    });

    if (pendingUsers.length === 0) {
      toast.error("No pending users selected");
      return;
    }

    if (!window.confirm(`Are you sure you want to reject ${pendingUsers.length} user(s)?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      await Promise.all(
        pendingUsers.map(userId =>
          axios.post(`${API}/users/reject`, { user_id: userId }, { headers })
        )
      );
      
      toast.success(`${pendingUsers.length} user(s) rejected`);
      setSelectedUsers([]);
      fetchData();
    } catch (error) {
      toast.error("Failed to reject some users");
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard!`);
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  const handleGenerateTempPassword = async (userId, userEmail) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/users/${userId}/generate-temp-password`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const tempPassword = response.data.temporary_password;
      
      toast.success(
        <div>
          <p className="font-semibold">Temporary password generated!</p>
          <div className="flex items-center space-x-2 mt-2">
            <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded flex-1">
              {tempPassword}
            </p>
            <button
              onClick={() => copyToClipboard(tempPassword, "Password")}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
              title="Copy password"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">
              Share with: {userEmail}
            </p>
            <button
              onClick={() => copyToClipboard(userEmail, "Email")}
              className="p-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded"
              title="Copy email"
            >
              <Mail size={14} />
            </button>
          </div>
        </div>,
        { duration: 20000 }
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate temporary password");
    }
  };

  const handleExportUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/users/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Create export file with both encrypted data and key
      const exportData = {
        encrypted_data: response.data.encrypted_data,
        encryption_key: response.data.encryption_key,
        count: response.data.count,
        exported_at: response.data.exported_at
      };

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${response.data.count} users with encrypted passwords`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to export users");
    }
  };

  const handleImportUsers = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const fileContent = await file.text();
      const importData = JSON.parse(fileContent);

      if (!importData.encrypted_data || !importData.encryption_key) {
        toast.error("Invalid import file format");
        return;
      }

      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/users/import`,
        {
          encrypted_data: importData.encrypted_data,
          encryption_key: importData.encryption_key
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success(
        `Successfully imported ${response.data.imported} users. ${response.data.skipped} users skipped (already exist).`
      );
      
      // Refresh user list
      fetchData();
      
      // Reset file input
      event.target.value = null;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import users");
      event.target.value = null;
    }
  };

  const handleApproveReset = async (requestId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/password-reset/approve`,
        { request_id: requestId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const tempPassword = response.data.temporary_password;
      const userEmail = response.data.user_email;
      
      toast.success(
        <div>
          <p className="font-semibold">Password reset approved!</p>
          <div className="flex items-center space-x-2 mt-2">
            <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded flex-1">
              {tempPassword}
            </p>
            <button
              onClick={() => copyToClipboard(tempPassword, "Password")}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
              title="Copy password"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">
              Share with: {userEmail}
            </p>
            <button
              onClick={() => copyToClipboard(userEmail, "Email")}
              className="p-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded"
              title="Copy email"
            >
              <Mail size={14} />
            </button>
          </div>
        </div>,
        { duration: 20000 }
      );
      
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve reset");
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === users.filter(u => u.account_type !== 'master_admin').length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.filter(u => u.account_type !== 'master_admin').map(u => u.id));
    }
  };

  const handleSyncToSheets = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/users/sync-to-sheets`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("All users synced to Google Sheets successfully!");
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Failed to sync to Google Sheets";
      if (errorMsg.includes("not enabled")) {
        toast.error(
          <div>
            <p className="font-semibold">Google Sheets Integration Not Enabled</p>
            <p className="text-xs mt-1">Please configure Google Sheets credentials in backend .env file</p>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      deleted: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
    };

    return (
      <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full capitalize ${styles[status] || styles.pending}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.status === 'pending');
  const selectedPendingCount = selectedUsers.filter(userId => {
    const user = users.find(u => u.id === userId);
    return user && user.status === 'pending';
  }).length;

  return (
    <div className="space-y-6" data-testid="user-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage users and password resets</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={handleExportUsers}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <Download size={18} className="mr-2" />
            Export Users
          </Button>
          
          <label htmlFor="import-users-input">
            <Button
              type="button"
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
              onClick={() => document.getElementById('import-users-input').click()}
            >
              <Upload size={18} className="mr-2" />
              Import Users
            </Button>
          </label>
          <input
            id="import-users-input"
            type="file"
            accept=".json"
            onChange={handleImportUsers}
            className="hidden"
          />
          
          <Button
            onClick={handleSyncToSheets}
            variant="outline"
            data-testid="sync-to-sheets-button"
            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
          >
            <RefreshCw size={18} className="mr-2" />
            Sync to Google Sheets
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-user-button" className="bg-blue-600 hover:bg-blue-700">
              <UserPlus size={18} className="mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle className="dark:text-white">Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create_first_name">First Name</Label>
                  <Input
                    id="create_first_name"
                    data-testid="create-user-firstname"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    className="dark:bg-gray-700 dark:border-gray-600"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create_last_name">Last Name</Label>
                  <Input
                    id="create_last_name"
                    data-testid="create-user-lastname"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    className="dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="create_email">Email</Label>
                <Input
                  id="create_email"
                  type="email"
                  data-testid="create-user-email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <Label htmlFor="create_password">Password</Label>
                <Input
                  id="create_password"
                  type="password"
                  data-testid="create-user-password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <Label htmlFor="create_account_type">Account Type</Label>
                <Select value={newUser.account_type} onValueChange={(value) => setNewUser({ ...newUser, account_type: value })}>
                  <SelectTrigger data-testid="create-user-accounttype" className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="ops_team">Ops Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" data-testid="create-user-submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_users}</p>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Admin Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.admin_users}</p>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Standard Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.standard_users}</p>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Ops Team Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.ops_team_users || 0}</p>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending_users || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Users Section */}
      {pendingUsers.length > 0 && (
        <Card className="dark:bg-gray-800 dark:border-gray-700 border-2 border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-gray-900 dark:text-white">
                <UserCheck size={20} className="mr-2 text-yellow-600" />
                Pending Approval ({pendingUsers.length})
              </CardTitle>
              {selectedPendingCount > 0 && (
                <div className="flex space-x-2">
                  <Button
                    onClick={handleBulkApprove}
                    data-testid="bulk-approve-button"
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <CheckCircle size={16} className="mr-1" />
                    Approve ({selectedPendingCount})
                  </Button>
                  <Button
                    onClick={handleBulkReject}
                    data-testid="bulk-reject-button"
                    variant="destructive"
                    size="sm"
                  >
                    <XCircle size={16} className="mr-1" />
                    Reject ({selectedPendingCount})
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center space-x-4">
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                      data-testid={`checkbox-${user.id}`}
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Registered: {new Date(user.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400 mr-2 capitalize">
                      {user.account_type}
                    </span>
                    <Button
                      onClick={() => handleApproveUser(user.id)}
                      data-testid={`approve-user-${user.id}`}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle size={16} className="mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRejectUser(user.id)}
                      data-testid={`reject-user-${user.id}`}
                      variant="destructive"
                      size="sm"
                    >
                      <XCircle size={16} className="mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Password Reset Requests */}
      {passwordResets.filter(r => r.status === "pending").length > 0 && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <Key size={20} className="mr-2" />
              Pending Password Reset Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {passwordResets
                .filter(r => r.status === "pending")
                .map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{request.user_name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{request.user_email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleApproveReset(request.id)}
                      data-testid={`approve-reset-${request.id}`}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve & Generate Password
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <Users size={20} className="mr-2" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 px-4">
                    <Checkbox
                      checked={selectedUsers.length === users.filter(u => u.account_type !== 'master_admin').length && users.length > 1}
                      onCheckedChange={toggleSelectAll}
                      data-testid="select-all-checkbox"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Account Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Created At</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      {user.account_type !== 'master_admin' && (
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                          data-testid={`checkbox-${user.id}`}
                        />
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`
                        inline-block px-2 py-1 text-xs font-medium rounded-full capitalize
                        ${user.account_type === 'master_admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : ''}
                        ${user.account_type === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                        ${user.account_type === 'standard' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : ''}
                        ${user.account_type === 'ops_team' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                      `}>
                        {user.account_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end space-x-2">
                        {user.account_type !== 'master_admin' && user.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateTempPassword(user.id, user.email)}
                            data-testid={`reset-password-${user.id}`}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Generate Temporary Password"
                          >
                            <Key size={16} />
                          </Button>
                        )}
                        {user.account_type !== 'master_admin' && user.status !== 'deleted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id, `${user.first_name} ${user.last_name}`)}
                            data-testid={`delete-user-${user.id}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;