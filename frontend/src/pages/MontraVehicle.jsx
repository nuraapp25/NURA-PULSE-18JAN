import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart3, Upload, FileUp, CheckCircle, XCircle, Battery, TrendingUp, Gauge, Clock, Activity, Zap, Database, Trash2, FolderOpen, Folder, ChevronDown, ChevronRight, Download, Eye } from "lucide-react";
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
  const [expandedFolders, setExpandedFolders] = useState({});
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingFileData, setViewingFileData] = useState(null);
  const [loadingFileData, setLoadingFileData] = useState(false);

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
      id: "battery-milestones",
      title: "Battery Milestones",
      icon: Zap,
      color: "bg-indigo-500",
      description: "Track charge milestones & derived mileage",
      route: "/dashboard/montra-vehicle/battery-milestones"
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
        // Group files by month_year for folder structure
        const files = response.data.files || [];
        const groupedFiles = files.reduce((acc, file) => {
          const monthYear = file.month_year || `${file.month || 'Unknown'} ${file.year || '2025'}`;
          if (!acc[monthYear]) {
            acc[monthYear] = [];
          }
          acc[monthYear].push(file);
          return acc;
        }, {});
        
        setFeedFiles(groupedFiles);
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

  const getAllFiles = () => {
    const allFiles = [];
    Object.values(feedFiles).forEach(folderFiles => {
      folderFiles.forEach(file => allFiles.push(file));
    });
    return allFiles;
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allFiles = getAllFiles();
      const allIds = allFiles.map((file, index) => `${file.vehicle_id}-${file.date}-${file.filename}`);
      setSelectedFileIds(allIds);
    } else {
      setSelectedFileIds([]);
    }
  };

  const handleSelectFile = (file, checked) => {
    const fileId = `${file.vehicle_id}-${file.date}-${file.filename}`;
    if (checked) {
      setSelectedFileIds(prev => [...prev, fileId]);
    } else {
      setSelectedFileIds(prev => prev.filter(id => id !== fileId));
    }
  };

  const toggleFolder = (monthYear) => {
    setExpandedFolders(prev => ({
      ...prev,
      [monthYear]: !prev[monthYear]
    }));
  };

  const handleDeleteSelected = async () => {
    if (selectedFileIds.length === 0) {
      toast.error("No files selected for deletion");
      return;
    }

    // Convert selected IDs back to file objects
    const allFiles = getAllFiles();
    const selectedFiles = allFiles.filter(file => 
      selectedFileIds.includes(`${file.vehicle_id}-${file.date}-${file.filename}`)
    );
    
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const fileIdentifiers = selectedFiles.map(file => ({
        vehicle_id: file.vehicle_id,
        date: file.date,
        filename: file.filename
      }));

      const response = await axios.delete(`${API}/montra-vehicle/feed-database`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: fileIdentifiers
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

  const handleViewFile = async (file) => {
    setLoadingFileData(true);
    setViewDialogOpen(true);
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/montra-vehicle/view-file-data`,
        {
          vehicle_id: file.vehicle_id,
          date: file.date,
          filename: file.filename
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setViewingFileData({
          file: file,
          data: response.data.data,
          columns: response.data.columns
        });
      }
    } catch (error) {
      toast.error("Failed to load file data");
      console.error("View file error:", error);
      setViewDialogOpen(false);
    } finally {
      setLoadingFileData(false);
    }
  };

  const handleDownloadMapping = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/montra-vehicle/download-mode-mapping`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Mode Details.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Mode mapping file downloaded successfully");
    } catch (error) {
      toast.error("Failed to download mode mapping file");
      console.error("Download mapping error:", error);
    }
  };

  const handleMappingUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (fileExtension !== 'xlsx') {
      toast.error("Please select an XLSX file");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/montra-vehicle/upload-mode-mapping`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        toast.success(response.data.message || "Mode mapping file uploaded successfully");
      } else {
        toast.error(response.data.message || "Failed to upload mode mapping file");
      }
    } catch (error) {
      toast.error("Failed to upload mode mapping file");
      console.error("Upload mapping error:", error);
    }

    // Clear the input
    event.target.value = null;
  };

  return (
    <div className="space-y-6" data-testid="montra-vehicle-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Montra Vehicle Insights</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track and analyze vehicle performance data</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button
            onClick={() => handleDownloadMapping()}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 text-sm"
            size="sm"
          >
            <Download size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Download Mapping</span>
            <span className="sm:hidden">Mapping</span>
          </Button>
          <Button
            onClick={() => document.getElementById('mapping-upload').click()}
            variant="outline"
            className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:border-orange-400 dark:text-orange-400 text-sm"
            size="sm"
          >
            <Upload size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Upload Mapping</span>
            <span className="sm:hidden">Update</span>
          </Button>
          <input
            id="mapping-upload"
            type="file"
            accept=".xlsx"
            onChange={handleMappingUpload}
            style={{ display: 'none' }}
          />
          <Button
            onClick={handleOpenDatabase}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 text-sm"
            size="sm"
          >
            <Database size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Feed Database</span>
            <span className="sm:hidden">Database</span>
          </Button>
          <Button
            onClick={() => setImportDialogOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-sm"
            size="sm"
          >
            <Upload size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Bulk Import Feeds</span>
            <span className="sm:hidden">Import</span>
          </Button>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {widgets.map((widget) => {
              const IconComponent = widget.icon;
              return (
                <button
                  key={widget.id}
                  onClick={() => navigate(widget.route)}
                  className="group relative overflow-hidden rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-xl"
                >
                  <div className="p-4 sm:p-6 text-center">
                    <div className={`${widget.color} w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent size={24} className="text-white sm:hidden" />
                      <IconComponent size={32} className="text-white hidden sm:block" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {widget.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
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
              Import multiple Montra vehicle feed files to backend database
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
              Upload multiple CSV or XLSX files with vehicle feed data. All files will be processed and stored in the backend database.
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

      {/* Feed Database Dialog */}
      <Dialog open={databaseDialogOpen} onOpenChange={setDatabaseDialogOpen}>
        <DialogContent className="max-w-4xl dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center">
              <Database size={20} className="mr-2" />
              Montra Feed Database
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Manage uploaded CSV files and their data records. Select files to delete them from the database.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Control Bar */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedFileIds.length === getAllFiles().length && getAllFiles().length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Select All ({getAllFiles().length} files)
                  </span>
                </label>
                {selectedFileIds.length > 0 && (
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {selectedFileIds.length} selected
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={fetchFeedDatabase}
                  variant="outline"
                  size="sm"
                  disabled={loadingDatabase}
                >
                  {loadingDatabase ? "Loading..." : "Refresh"}
                </Button>
                <Button
                  onClick={handleDeleteSelected}
                  disabled={selectedFileIds.length === 0 || deleting}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 size={16} className="mr-1" />
                  {deleting ? "Deleting..." : `Delete Selected (${selectedFileIds.length})`}
                </Button>
              </div>
            </div>

            {/* Files List */}
            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
              {loadingDatabase ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : Object.keys(feedFiles).length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No feed files found in database
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.entries(feedFiles).map(([monthYear, files]) => (
                    <div key={monthYear}>
                      {/* Folder Header */}
                      <div 
                        className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer flex items-center justify-between"
                        onClick={() => toggleFolder(monthYear)}
                      >
                        <div className="flex items-center space-x-2">
                          {expandedFolders[monthYear] ? (
                            <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                          )}
                          {expandedFolders[monthYear] ? (
                            <FolderOpen size={18} className="text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Folder size={18} className="text-blue-600 dark:text-blue-400" />
                          )}
                          <span className="font-medium text-gray-900 dark:text-white">
                            {monthYear}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {files.length} file{files.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {/* Files in Folder */}
                      {expandedFolders[monthYear] && (
                        <div className="divide-y divide-gray-100 dark:divide-gray-600">
                          {files.map((file, index) => {
                            const fileId = `${file.vehicle_id}-${file.date}-${file.filename}`;
                            return (
                              <div
                                key={`${monthYear}-${index}`}
                                className={`p-4 pl-12 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                  selectedFileIds.includes(fileId) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedFileIds.includes(fileId)}
                                    onChange={(e) => handleSelectFile(file, e.target.checked)}
                                    className="rounded"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h4 className="font-medium text-gray-900 dark:text-white">
                                          {file.filename}
                                        </h4>
                                        <div className="flex items-center space-x-4 mt-1">
                                          <span className="text-sm text-gray-600 dark:text-gray-400">
                                            Vehicle: {file.vehicle_id}
                                          </span>
                                          <span className="text-sm text-gray-600 dark:text-gray-400">
                                            Date: {file.date}
                                          </span>
                                          <span className="text-sm text-gray-600 dark:text-gray-400">
                                            Records: {file.record_count}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                          {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : 'N/A'}
                                        </div>
                                        {file.file_size && (
                                          <div className="text-xs text-gray-400">
                                            {(file.file_size / 1024).toFixed(2)} KB
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            {Object.keys(feedFiles).length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Database Summary:</strong> {getAllFiles().length} files across {Object.keys(feedFiles).length} months, {' '}
                  {getAllFiles().reduce((sum, file) => sum + file.record_count, 0)} total records
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                onClick={() => {
                  setDatabaseDialogOpen(false);
                  setSelectedFileIds([]);
                }}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MontraVehicle;