import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car } from "lucide-react";

const DriverOnboarding = () => {
  return (
    <div className="space-y-6" data-testid="driver-onboarding-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Driver Onboarding</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage driver registration and onboarding process</p>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <Car size={20} className="mr-2" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            Driver onboarding features will be available here. This module will help you manage driver registrations, document verification, and onboarding workflows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverOnboarding;