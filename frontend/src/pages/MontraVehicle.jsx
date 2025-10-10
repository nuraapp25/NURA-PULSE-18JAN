import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const MontraVehicle = () => {
  return (
    <div className="space-y-6" data-testid="montra-vehicle-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Montra Vehicle Insights</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Track and analyze vehicle performance data</p>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <BarChart3 size={20} className="mr-2" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            Montra vehicle insights features will be available here. This module will provide comprehensive analytics and insights about vehicle performance, maintenance, and utilization.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MontraVehicle;