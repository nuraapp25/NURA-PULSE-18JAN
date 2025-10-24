import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Upload, Eye, Trash2, RefreshCw, FileText, Clock, CheckCircle, XCircle, Loader } from "lucide-react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { toast } from "sonner";

const RidePayExtractV2 = () => {
  const { user } = useAuth();
  const isMasterAdmin = user?.account_type === "master_admin";

  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [dataDialogOpen, setDataDialogOpen] = useState(false);
  
  // Upload form states
  const [monthYear, setMonthYear] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [platform, setPlatform] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // Selected folder for viewing data
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderData, setFolderData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  
  // Auto-refresh for status updates
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchFolders();
  }, []);

  // Auto-refresh every 5 seconds if enabled
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchFolders();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchFolders = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/ride-pay-v2/folders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFolders(response.data.folders || []);
    } catch (error) {
      console.error("Error fetching folders:", error);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => file.type.includes('image/'));
    
    if (validFiles.length !== files.length) {
      toast.error("Please select only image files");
    }
    
    if (validFiles.length + selectedFiles.length > 10) {
      toast.warning("Maximum 10 files allowed per upload");
      setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 10));
    } else {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!monthYear || !driverName) {
      toast.error("Please fill in Month/Year and Driver Name");
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      
      selectedFiles.forEach(file => {
        formData.append("files", file);
      });
      
      formData.append("month_year", monthYear);
      formData.append("driver_name", driverName);
      formData.append("vehicle_number", vehicleNumber);
      formData.append("platform", platform);
      
      const response = await axios.post(
        `${API}/ride-pay-v2/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success(response.data.message);
      
      // Ask if user wants to start processing
      const shouldProcess = window.confirm("Upload successful! Start processing now?");
      if (shouldProcess) {
        await startProcessing(response.data.folder_id);
      }
      
      setUploadDialogOpen(false);
      resetUploadForm();
      fetchFolders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const startProcessing = async (folderId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/ride-pay-v2/process-folder/${folderId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message);
      fetchFolders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start processing");
    }
  };

  const viewFolderData = async (folder) => {
    setSelectedFolder(folder);
    setDataDialogOpen(true);
    setLoadingData(true);
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/ride-pay-v2/data/${folder.id}?limit=1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setFolderData(response.data.data || []);
    } catch (error) {
      toast.error("Failed to load folder data");
    } finally {
      setLoadingData(false);
    }
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm("Are you sure you want to delete this folder and all its data?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API}/ride-pay-v2/folder/${folderId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Folder deleted successfully");
      fetchFolders();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete folder");
    }
  };

  const resetUploadForm = () => {
    setMonthYear("");
    setDriverName("");
    setVehicleNumber("");
    setPlatform("");
    setSelectedFiles([]);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
      case 'queued':
        return <Clock className="text-yellow-500" size={18} />;
      case 'processing':
        return <Loader className="text-blue-500 animate-spin" size={18} />;
      case 'completed':
        return <CheckCircle className="text-green-500" size={18} />;
      case 'failed':
        return <XCircle className="text-red-500" size={18} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'queued':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'processing':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-gray-900 dark:text-white">
                🚀 Ride Pay Extract v2
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Upload first, process in background - Fast & Reliable
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus size={18} className="mr-2" />
                NEW UPLOAD
              </Button>
              <Button
                onClick={fetchFolders}
                variant="outline"
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="autoRefresh" className="text-sm text-gray-700 dark:text-gray-300">
              Auto-refresh every 5 seconds
            </label>
          </div>

          {/* Folders List */}
          <div className="space-y-4">
            {folders.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>No folders yet. Click "NEW UPLOAD" to get started.</p>
              </div>
            ) : (
              folders.map(folder => (
                <Card key={folder.id} className="dark:bg-gray-700 dark:border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      {/* Folder Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {folder.month_year} - {folder.driver_name}
                          </h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(folder.status)}`}>
                            {folder.status?.toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <div>Vehicle: {folder.vehicle_number || 'N/A'}</div>
                          <div>Platform: {folder.platform || 'N/A'}</div>
                          <div>Images: {folder.total_images || 0}</div>
                          <div>Extracted: {folder.completed_images || 0}</div>
                        </div>

                        {/* Progress Bar */}
                        {folder.status === 'processing' && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>Processing: {folder.completed_images || 0}/{folder.total_images || 0}</span>
                              <span>{folder.progress_percentage || 0}%</span>
                            </div>
                            <Progress value={folder.progress_percentage || 0} className="h-2" />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 ml-4">
                        {folder.status === 'pending' && (
                          <Button
                            onClick={() => startProcessing(folder.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Upload size={16} className="mr-1" />
                            Process
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => viewFolderData(folder)}
                          size="sm"
                          variant="outline"
                        >
                          <Eye size={16} />
                        </Button>
                        
                        {isMasterAdmin && (
                          <Button
                            onClick={() => deleteFolder(folder.id)}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Upload Images</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-300">Month/Year *</Label>
                <Input
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  placeholder="e.g., Sep 2025"
                  className="dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-gray-300">Driver Name *</Label>
                <Input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g., Anandhi"
                  className="dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-300">Vehicle Number</Label>
                <Input
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g., TN01AB1234"
                  className="dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-gray-300">Platform</Label>
                <Input
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder="e.g., Rapido"
                  className="dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <Label className="dark:text-gray-300">Select Images (Max 10)</Label>
              <div className="mt-2">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload-v2"
                />
                <label
                  htmlFor="file-upload-v2"
                  className="flex items-center justify-center w-full h-32 px-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
                >
                  <div className="text-center">
                    <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click to select images or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Max 10 files • PNG, JPG, JPEG
                    </p>
                  </div>
                </label>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Selected Files ({selectedFiles.length}/10):
                  </div>
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded"
                    >
                      <span className="text-sm text-gray-900 dark:text-white truncate">
                        {file.name}
                      </span>
                      <Button
                        onClick={() => removeFile(index)}
                        size="sm"
                        variant="ghost"
                      >
                        <XCircle size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="flex justify-end gap-2 mt-6">
              <Button
                onClick={() => setUploadDialogOpen(false)}
                variant="outline"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? (
                  <>
                    <Loader className="animate-spin mr-2" size={16} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data View Dialog */}
      <Dialog open={dataDialogOpen} onOpenChange={setDataDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              {selectedFolder?.month_year} - {selectedFolder?.driver_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingData ? (
            <div className="text-center py-12">
              <Loader className="animate-spin mx-auto mb-4" size={48} />
              <p className="text-gray-600 dark:text-gray-400">Loading data...</p>
            </div>
          ) : folderData.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No extracted data yet. Processing may still be in progress.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Time</th>
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-right">Amount (₹)</th>
                    <th className="py-2 px-3 text-left">Payment Mode</th>
                    <th className="py-2 px-3 text-right">Distance (km)</th>
                    <th className="py-2 px-3 text-right">Duration (min)</th>
                    <th className="py-2 px-3 text-left">Pickup</th>
                    <th className="py-2 px-3 text-left">Drop</th>
                  </tr>
                </thead>
                <tbody>
                  {folderData.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="py-2 px-3">{row.date}</td>
                      <td className="py-2 px-3">{row.time}</td>
                      <td className="py-2 px-3">{row.description}</td>
                      <td className="py-2 px-3 text-right">{row.amount}</td>
                      <td className="py-2 px-3">{row.payment_mode}</td>
                      <td className="py-2 px-3 text-right">{row.distance}</td>
                      <td className="py-2 px-3 text-right">{row.duration}</td>
                      <td className="py-2 px-3">{row.pickup_location}</td>
                      <td className="py-2 px-3">{row.drop_location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RidePayExtractV2;
