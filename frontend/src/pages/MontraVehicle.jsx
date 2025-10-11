import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart3, Upload, FileUp, CheckCircle, XCircle, Battery, TrendingUp, Gauge, Clock, Activity, Zap } from "lucide-react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const MontraVehicle = () => {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (fileExtension === 'csv' || fileExtension === 'xlsx') {
        setSelectedFile(file);
      } else {
        toast.error("Please select a CSV or XLSX file");
        event.target.value = null;
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to import");
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/montra-vehicle/import-feed`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success(
        <div>
          <p className="font-semibold">Import Successful!</p>
          <p className="text-sm mt-1">{response.data.message}</p>
        </div>,
        { duration: 5000 }
      );

      setImportDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import Montra feed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="montra-vehicle-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Montra Vehicle Insights</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track and analyze vehicle performance data</p>
        </div>
        <Button
          onClick={() => setImportDialogOpen(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Upload size={18} className="mr-2" />
          Import Montra Feed
        </Button>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <BarChart3 size={20} className="mr-2" />
            Vehicle Feed Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileUp size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Import Montra vehicle feed data to sync with Google Sheets
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Supported formats: CSV, XLSX
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Import Montra Feed</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Upload a CSV or XLSX file with vehicle feed data. The data will be synced to Google Sheets tab "Montra Feed Data".
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
                id="montra-file-input"
              />
              <label
                htmlFor="montra-file-input"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload size={32} className="text-gray-400 dark:text-gray-500 mb-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Click to select a file
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  CSV or XLSX files only
                </span>
              </label>
            </div>

            {selectedFile && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                    <span className="text-sm text-gray-900 dark:text-white font-medium">
                      {selectedFile.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <strong>File naming format:</strong> VEHICLE_ID - DD MMM YYYY.csv<br />
                <strong>Example:</strong> P60G2512500002032 - 01 Sep 2025.csv
              </p>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setImportDialogOpen(false);
                  setSelectedFile(null);
                }}
                variant="outline"
                className="flex-1 dark:border-gray-600"
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!selectedFile || importing}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {importing ? (
                  <>
                    <Upload size={18} className="mr-2 animate-pulse" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={18} className="mr-2" />
                    Import Feed
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MontraVehicle;