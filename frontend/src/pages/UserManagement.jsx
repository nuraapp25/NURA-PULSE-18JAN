import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, Key, RefreshCw } from "lucide-react";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [passwordResets, setPasswordResets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: "",
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
      setNewUser({ first_name: "", email: "", password: "", account_type: "" });
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

  const handleApproveReset = async (requestId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/password-reset/approve`,
        { request_id: requestId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(
        <div>
          <p className="font-semibold">Password reset approved!</p>
          <p className="text-sm mt-1">Temporary password: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{response.data.temporary_password}</span></p>
          <p className="text-xs mt-1 text-gray-600">Share this with {response.data.user_email}</p>
        </div>,
        { duration: 10000 }
      );
      
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve reset");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage users and password resets</p>
        </div>
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
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Resets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending_password_resets}</p>
            </CardContent>
          </Card>
        </div>
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Account Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Created At</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{user.first_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`
                        inline-block px-2 py-1 text-xs font-medium rounded-full capitalize
                        ${user.account_type === 'master_admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : ''}
                        ${user.account_type === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                        ${user.account_type === 'standard' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : ''}
                      `}>
                        {user.account_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {user.account_type !== 'master_admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id, user.first_name)}
                          data-testid={`delete-user-${user.id}`}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
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