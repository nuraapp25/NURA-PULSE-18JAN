import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart3, Upload, FileUp, CheckCircle, XCircle, Battery, TrendingUp, Gauge, Clock, Activity, Zap, Database, Trash2 } from "lucide-react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const MontraVehicle = () => {
  const navigate = useNavigate();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [feedFiles, setFeedFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [loadingDatabase, setLoadingDatabase] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const widgets = [
    {
      id: "battery-consumption",
      title: "Battery Consumption",
      icon: Battery,
      color: "bg-green-500",
      description: "Analyze battery usage patterns",
      route: "/dashboard/montra-vehicle/battery-consumption"
    },
    {
      id: "performance",
      title: "Performance Metrics",
      icon: TrendingUp,
      color: "bg-blue-500",
      description: "Vehicle performance analysis",
      route: "/dashboard/montra-vehicle/performance"
    },
    {
      id: "speed-analysis",
      title: "Speed Analysis",
      icon: Gauge,
      color: "bg-purple-500",
      description: "Speed trends and patterns",
      route: "/dashboard/montra-vehicle/speed"
    },
    {
      id: "usage-time",
      title: "Usage Time",
      icon: Clock,
      color: "bg-orange-500",
      description: "Vehicle usage duration",
      route: "/dashboard/montra-vehicle/usage"
    },
    {
      id: "health-status",
      title: "Health Status",
      icon: Activity,
      color: "bg-red-500",
      description: "Overall health monitoring",
      route: "/dashboard/montra-vehicle/health"
    },
    {
      id: "charging-stats",
      title: "Charging Statistics",
      icon: Zap,
      color: "bg-yellow-500",
      description: "Charging patterns and efficiency",
      route: "/dashboard/montra-vehicle/charging"
    }
  ];

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = [];
    const invalidFiles = [];

    files.forEach(file => {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (fileExtension === 'csv' || fileExtension === 'xlsx') {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      toast.error(`Invalid file types: ${invalidFiles.join(', ')}. Only CSV and XLSX files are allowed.`);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      toast.success(`Selected ${validFiles.length} file(s) for import`);
    }

    event.target.value = null;
  };

  const handleImport = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error("Please select files to import");
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failedFiles = [];

    try {
      const token = localStorage.getItem("token");
      
      // Process files one by one to handle individual results
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        try {
          const formData = new FormData();
          formData.append('file', file);

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
          
          successCount++;
          console.log(`✅ ${file.name}: ${response.data.message}`);
          
        } catch (fileError) {
          failedFiles.push({
            name: file.name,
            error: fileError.response?.data?.detail || "Unknown error"
          });
          console.error(`❌ ${file.name}: ${fileError.response?.data?.detail}`);
        }
      }

      // Show results
      if (successCount > 0) {
        toast.success(
          <div>
            <p className="font-semibold">Bulk Import Results</p>
            <p className="text-sm mt-1">Successfully imported {successCount} out of {selectedFiles.length} files</p>
            {failedFiles.length > 0 && (
              <p className="text-xs text-red-600 mt-1">
                Failed: {failedFiles.map(f => f.name).join(', ')}
              </p>
            )}
          </div>,
          { duration: 7000 }
        );
      }

      if (failedFiles.length > 0 && successCount === 0) {
        toast.error(
          <div>
            <p className="font-semibold">Import Failed</p>
            <p className="text-sm mt-1">All {failedFiles.length} files failed to import</p>
          </div>
        );
      }

      setImportDialogOpen(false);
      setSelectedFiles([]);
    } catch (error) {
      toast.error("Failed to process bulk import");
    } finally {
      setImporting(false);
    }
  };

  const fetchFeedDatabase = async () => {
    setLoadingDatabase(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/montra-vehicle/feed-database`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setFeedFiles(response.data.files || []);
      }
    } catch (error) {
      toast.error("Failed to load feed database");
      console.error("Fetch feed database error:", error);
    } finally {
      setLoadingDatabase(false);
    }
  };

  const handleOpenDatabase = () => {
    setDatabaseDialogOpen(true);
    fetchFeedDatabase();
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = feedFiles.map((file, index) => index);
      setSelectedFileIds(allIds);
    } else {
      setSelectedFileIds([]);
    }
  };

  const handleSelectFile = (index, checked) => {
    if (checked) {
      setSelectedFileIds(prev => [...prev, index]);
    } else {
      setSelectedFileIds(prev => prev.filter(id => id !== index));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFileIds.length === 0) {
      toast.error("No files selected for deletion");
      return;
    }

    const selectedFiles = selectedFileIds.map(index => feedFiles[index]);
    
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const fileIdentifiers = selectedFiles.map(file => ({
        vehicle_id: file.vehicle_id,
        date: file.date,
        filename: file.filename
      }));

      const response = await axios.delete(`${API}/montra-vehicle/feed-database`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { file_identifiers: fileIdentifiers }
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setSelectedFileIds([]);
        fetchFeedDatabase(); // Refresh the list
      } else {
        toast.error(response.data.message || "Failed to delete some files");
      }
    } catch (error) {
      toast.error("Failed to delete selected files");
      console.error("Delete files error:", error);
    } finally {
      setDeleting(false);
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
          Bulk Import Feeds
        </Button>
      </div>

      {/* Analytics Widgets */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <BarChart3 size={20} className="mr-2" />
            Analytics Widgets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {widgets.map((widget) => {
              const IconComponent = widget.icon;
              return (
                <button
                  key={widget.id}
                  onClick={() => navigate(widget.route)}
                  className="group relative overflow-hidden rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-xl"
                >
                  <div className="p-6 text-center">
                    <div className={`${widget.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent size={32} className="text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {widget.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {widget.description}
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feed Import Section */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <FileUp size={20} className="mr-2" />
            Import Vehicle Feed Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Import multiple Montra vehicle feed files to sync with Google Sheets
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Supported formats: CSV, XLSX • Bulk import supported
            </p>
            <Button
              onClick={() => setImportDialogOpen(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Upload size={18} className="mr-2" />
              Bulk Import Feeds
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Import Montra Feed (Bulk)</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Upload multiple CSV or XLSX files with vehicle feed data. All files will be processed and synced to Google Sheets tab "Montra Feed Data".
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv,.xlsx"
                multiple
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
                  Click to select files (bulk import supported)
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  CSV or XLSX files only • Multiple files supported
                </span>
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Selected Files ({selectedFiles.length})
                  </h4>
                  <Button
                    onClick={() => setSelectedFiles([])}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <XCircle size={16} className="mr-1" />
                    Clear All
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-sm text-gray-900 dark:text-white font-medium truncate">
                            {file.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {(file.size / 1024).toFixed(2)} KB
                          </span>
                          <Button
                            onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== index))}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <XCircle size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
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
                  setSelectedFiles([]);
                }}
                variant="outline"
                className="flex-1 dark:border-gray-600"
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedFiles.length === 0 || importing}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {importing ? (
                  <>
                    <Upload size={18} className="mr-2 animate-pulse" />
                    Importing {selectedFiles.length} file(s)...
                  </>
                ) : (
                  <>
                    <Upload size={18} className="mr-2" />
                    Import {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Feed{selectedFiles.length > 1 ? 's' : ''}
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