import React from "react";
import { useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BarChart3, TrendingUp, Activity } from "lucide-react";

const HomePage = () => {
  const { user } = useAuth();

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
    </div>
  );
};

export default HomePage;