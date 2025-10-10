import React from "react";
import { useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BarChart3, TrendingUp, Activity } from "lucide-react";

const HomePage = () => {
  const { user } = useAuth();

  const stats = [
    { title: "Total Users", value: "0", icon: Users, color: "text-blue-600" },
    { title: "Active Sessions", value: "0", icon: Activity, color: "text-green-600" },
    { title: "Data Points", value: "0", icon: BarChart3, color: "text-purple-600" },
    { title: "Growth", value: "0%", icon: TrendingUp, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-8" data-testid="home-page">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome to Nura Pulse!</h1>
        <p className="text-blue-100 text-lg">
          Your comprehensive data management and insights dashboard system
        </p>
        <div className="mt-6 inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg">
          <p className="text-sm font-medium">
            Account Type: <span className="font-bold capitalize">{user?.account_type?.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Info */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">1</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Explore Apps</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Access various data management apps from the sidebar to manage payments, drivers, and more.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">2</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Manage Settings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize your preferences and account settings from the Settings page.
              </p>
            </div>
          </div>

          {user?.account_type === "master_admin" && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">User Management</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  As a master admin, you have access to comprehensive user management tools.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HomePage;