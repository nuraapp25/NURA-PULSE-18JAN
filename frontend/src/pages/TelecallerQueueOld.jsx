import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone } from "lucide-react";

const TelecallerQueue = () => {
  return (
    <div className="space-y-6" data-testid="telecaller-queue-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Telecaller Queue Manager</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage telecaller queues and call operations</p>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <Phone size={20} className="mr-2" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            Telecaller queue management features will be available here. This module will help you manage call queues, assign calls to telecallers, and track call performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelecallerQueue;