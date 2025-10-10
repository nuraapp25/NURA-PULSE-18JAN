import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen } from "lucide-react";

const ManagePage = () => {
  return (
    <div className="space-y-6" data-testid="manage-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your data and operations</p>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <FolderOpen size={20} className="mr-2" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            Management features will be available here. This section will provide tools to manage various aspects of your business operations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagePage;