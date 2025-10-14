import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, Upload, FileText, Copy, Download, FileSpreadsheet, Trash2, Clock, Edit, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { API } from "@/App";
import { cn } from "@/lib/utils";
import { useAuth } from "@/App";

const PaymentReconciliation = () => {
  const { user } = useAuth();
  
  // New workflow states
  const [currentView, setCurrentView] = useState("folder-selection"); // "folder-selection" | "main-interface"
  const [selectedPeriod, setSelectedPeriod] = useState(""); // e.g., "Sep 2025"
  const [existingFolders, setExistingFolders] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(""); // For dropdown selection
  const [selectedYear, setSelectedYear] = useState(""); // For dropdown selection

  // Load folders from backend on mount
  useEffect(() => {
    loadExistingFolders();
  }, []);
  
  // Driver profile (now shown during processing)
  const [showDriverDialog, setShowDriverDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  
  // Data lists
  const [driversList, setDriversList] = useState([]);
  const [vehiclesList, setVehiclesList] = useState([]);
  
  // Main interface state
  const [extractedData, setExtractedData] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [editingAmount, setEditingAmount] = useState(null);
  const [editValue, setEditValue] = useState("");
  
  // New states for enhanced features
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Edit dialog states
  const [editingRecord, setEditingRecord] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // Popover states for searchable dropdowns
  const [driverPopoverOpen, setDriverPopoverOpen] = useState(false);
  const [vehiclePopoverOpen, setVehiclePopoverOpen] = useState(false);

  const months = [
    { value: "01", label: "Jan", fullName: "January" },
    { value: "02", label: "Feb", fullName: "February" },
    { value: "03", label: "Mar", fullName: "March" },
    { value: "04", label: "Apr", fullName: "April" },
    { value: "05", label: "May", fullName: "May" },
    { value: "06", label: "Jun", fullName: "June" },
    { value: "07", label: "Jul", fullName: "July" },
    { value: "08", label: "Aug", fullName: "August" },
    { value: "09", label: "Sep", fullName: "September" },
    { value: "10", label: "Oct", fullName: "October" },
    { value: "11", label: "Nov", fullName: "November" },
    { value: "12", label: "Dec", fullName: "December" }
  ];

  const years = Array.from({ length: 10 }, (_, i) => {
    const year = 2025 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const platforms = ["Rapido", "Uber", "Ola", "Nura", "Adhoc"];

  useEffect(() => {
    loadExistingFolders();
  }, []);

  useEffect(() => {
    if (currentView === "main-interface") {
      fetchSyncStatus();
    }
  }, [currentView]);

  const fetchStoredRecords = async (monthYear) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/payment-reconciliation/records`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month_year: monthYear }
      });
      
      if (response.data.success) {
        // Map records to match frontend format
        const records = response.data.records.map(record => ({
          id: record.id,
          driver: record.driver,
          vehicle: record.vehicle,
          description: record.description,
          date: record.date,
          time: record.time,
          amount: record.amount,
          paymentMode: record.payment_mode,
          distance: record.distance,
          duration: record.duration,
          pickupKm: record.pickup_km,
          dropKm: record.drop_km,
          pickupLocation: record.pickup_location,
          dropLocation: record.drop_location,
          screenshotFilename: record.screenshot_filename,
          hasAmountError: record.amount === "N/A" || !record.amount || record.amount === "",
          status: record.status
        }));
        
        setExtractedData(records);
        if (records.length > 0) {
          toast.success(`Loaded ${records.length} existing record(s) for ${monthYear}`);
        }
      }
    } catch (error) {
      console.error("Error fetching stored records:", error);
      // Don't show error toast - just start fresh if no records exist
    }
  };

  const fetchDriversAndVehicles = async (month, year) => {
    try {
      const token = localStorage.getItem("token");
      
      // Convert month number to month name for API call
      const monthNames = {
        "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
        "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
      };
      
      const monthName = monthNames[month] || month;
      
      const response = await axios.get(`${API}/admin/files/get-drivers-vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: monthName, year: year }
      });
      
      if (response.data.success) {
        setDriversList(response.data.drivers || []);
        setVehiclesList(response.data.vehicles || []);
        
        if (response.data.using_mock_data) {
          toast.warning(`No data found for ${monthName} ${year}. Using sample data. Please ensure "Drivers List.xlsx" and "Vehicles List.xlsx" are uploaded in Files section with tabs named "${monthName} ${year}"`);
        } else {
          toast.success(`Loaded ${response.data.drivers.length} drivers and ${response.data.vehicles.length} vehicles for ${monthName} ${year}`);
        }
      }
      
    } catch (error) {
      console.error("Error fetching drivers and vehicles:", error);
      toast.error("Failed to load driver and vehicle data. Using sample data.");
      // Use fallback data
      setDriversList(["Abdul", "Samantha", "Samuel", "Sareena", "Ravi", "John", "Mike"]);
      setVehiclesList(["TN07CE2222", "TN01AB1234", "KA05CD5678", "AP09EF9012"]);
    }
  };

  const handleCreateNewFolder = async (monthValue, year) => {
    const monthObj = months.find(m => m.value === monthValue);
    const folderName = `${monthObj.label} ${year}`;
    
    setLoadingData(true);
    try {
      // Fetch drivers and vehicles for the selected month/year
      await fetchDriversAndVehicles(monthValue, year);
      
      // Add to existing folders if not already present
      const existsAlready = existingFolders.some(f => f.name === folderName);
      if (!existsAlready) {
        const newFolder = {
          name: folderName,
          month: monthValue,
          year: year,
          monthLabel: monthObj.label,
          fullName: monthObj.fullName,
          createdAt: new Date().toISOString()
        };
        
        // Save to backend
        try {
          const token = localStorage.getItem("token");
          await axios.post(`${API}/payment-reconciliation/folders`, newFolder, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setExistingFolders(prev => [...prev, newFolder]);
          toast.success(`Created folder: ${folderName}`);
        } catch (error) {
          console.error("Error creating folder:", error);
          toast.error("Failed to create folder");
          return;
        }
      }
      
      setSelectedPeriod(folderName);
      
      // Fetch existing records for this period
      await fetchStoredRecords(folderName);
      
      setCurrentView("main-interface");
      
    } finally {
      setLoadingData(false);
    }
  };

  const handleSelectExistingFolder = async (folder) => {
    setLoadingData(true);
    try {
      await fetchDriversAndVehicles(folder.month, folder.year);
      setSelectedPeriod(folder.name);
      
      // Clear any existing data when switching folders
      setExtractedData([]);
      setUploadedFiles([]);
      
      setCurrentView("main-interface");
    } finally {
      setLoadingData(false);
    }
  };

  const loadExistingFolders = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/payment-reconciliation/folders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setExistingFolders(response.data.folders);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const fileType = file.type;
      return fileType.includes('image/');
    });
    
    if (validFiles.length !== files.length) {
      toast.error("Please select only image files (PNG, JPG, JPEG)");
    }
    
    setUploadedFiles(prev => [...prev, ...validFiles].slice(0, 10)); // Max 10 files
  };

  const removeFile = (index) => {
    setUploadedFiles(files => files.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("Please select files to process");
      return;
    }

    // Show driver profile dialog first
    setShowDriverDialog(true);
  };

  const handleDriverProfileSubmitAndProcess = async () => {
    if (!selectedDriver || !selectedVehicle || !selectedPlatform) {
      toast.error("Please fill in all driver profile fields");
      return;
    }

    setShowDriverDialog(false);
    setProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      
      // Add all files to form data
      uploadedFiles.forEach(file => {
        formData.append("files", file);
      });
      
      // Add month_year and driver profile for storage
      formData.append("month_year", selectedPeriod);
      formData.append("driver_name", selectedDriver);
      formData.append("vehicle_number", selectedVehicle);
      formData.append("platform", selectedPlatform);
      
      const response = await axios.post(
        `${API}/payment-reconciliation/process-screenshots`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 120000 // 2 minutes timeout for processing
        }
      );
      
      if (response.data.success) {
        // Map the extracted data to our table format
        const processedData = response.data.extracted_data.map(item => ({
          id: item.id,
          driver: item.driver === "N/A" ? selectedDriver : item.driver,
          vehicle: item.vehicle === "N/A" ? selectedVehicle : item.vehicle,
          description: item.description,
          date: item.date,
          time: item.time,
          amount: item.amount,
          paymentMode: item.payment_mode,
          distance: item.distance,
          duration: item.duration,
          pickupKm: item.pickup_km,
          dropKm: item.drop_km,
          pickupLocation: item.pickup_location,
          dropLocation: item.drop_location,
          screenshotFilename: item.screenshot_filename,
          hasAmountError: item.amount === "N/A" || !item.amount || item.amount === ""
        }));
        
        // Append to existing data instead of replacing
        setExtractedData(prev => [...prev, ...processedData]);
        setUploadedFiles([]); // Clear uploaded files after successful processing
        
        toast.success(`Successfully processed all ${response.data.processed_files} screenshots!`);
      } else {
        toast.error("Failed to process screenshots");
      }
    } catch (error) {
      console.error("Processing error:", error);
      
      // Check if it's a batch failure
      if (error.response?.status === 422 && error.response?.data?.failed_batch) {
        toast.error(
          <div>
            <p className="font-semibold">Batch Processing Failed</p>
            <p className="text-sm mt-1">{error.response.data.message}</p>
            <p className="text-xs mt-1 text-gray-600">Please retry with all 10 files.</p>
          </div>,
          { duration: 7000 }
        );
      } else {
        toast.error("Failed to process screenshots. Please try again.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const copyAllData = () => {
    const csvData = extractedData.map(row => 
      Object.values(row).join(',')
    ).join('\n');
    navigator.clipboard.writeText(csvData);
    toast.success("Data copied to clipboard");
  };

  // exportToExcelBackend function removed

  const downloadCSV = () => {
    const headers = [
      "Driver", "Vehicle", "Description", "Date", "Time", "Amount", 
      "Payment Mode", "Distance (km)", "Duration (min)", "Pickup KM", 
      "Drop KM", "Pickup Location", "Drop Location", "Screenshot Filename"
    ];
    const csvData = [
      headers.join(','),
      ...extractedData.map(row => 
        [
          row.driver, row.vehicle, row.description, row.date, row.time, 
          row.amount, row.paymentMode, row.distance, row.duration, 
          row.pickupKm, row.dropKm, row.pickupLocation, row.dropLocation, 
          row.screenshotFilename
        ].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment_reconciliation_${selectedPeriod.replace(' ', '_')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setExtractedData([]);
    setUploadedFiles([]);
  };

  const handleEditAmount = (rowId) => {
    const row = extractedData.find(r => r.id === rowId);
    setEditingAmount(rowId);
    setEditValue(row.amount === "N/A" ? "" : row.amount);
  };

  const handleSaveAmount = async (rowId) => {
    try {
      // Since we don't store records in MongoDB anymore, just update the frontend state
      // No backend call needed - data is temporary until synced to Google Sheets
      
      setExtractedData(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, amount: editValue, hasAmountError: false }
          : row
      ));
      setEditingAmount(null);
      setEditValue("");
      toast.success("Amount updated successfully");
    } catch (error) {
      console.error("Error updating amount:", error);
      toast.error("Failed to update amount");
    }
  };
  
  const handleOpenEditDialog = (record) => {
    setEditingRecord({ ...record });
    setShowEditDialog(true);
  };
  
  const handleSaveFullEdit = async () => {
    try {
      // Since we don't store records in MongoDB anymore, just update the frontend state
      // No backend call needed - data is temporary until synced to Google Sheets
      
      // Update local state
      setExtractedData(prev => prev.map(row => 
        row.id === editingRecord.id ? {
          ...row,
          ...editingRecord,
          hasAmountError: editingRecord.amount === "N/A" || !editingRecord.amount
        } : row
      ));
      
      setShowEditDialog(false);
      setEditingRecord(null);
      toast.success("Record updated successfully");
    } catch (error) {
      console.error("Error updating record:", error);
      toast.error("Failed to update record");
    }
  };

  const handleCancelEdit = () => {
    setEditingAmount(null);
    setEditValue("");
  };

  const handleSelectRecord = (recordId, checked) => {
    if (checked) {
      setSelectedRecords(prev => [...prev, recordId]);
    } else {
      setSelectedRecords(prev => prev.filter(id => id !== recordId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRecords(extractedData.map(row => row.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRecords.length === 0) {
      toast.error("No records selected for deletion");
      return;
    }

    if (!user || !["master_admin"].includes(user.account_type)) {
      toast.error("Insufficient permissions. Only Master Admin can delete records.");
      return;
    }

    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/payment-reconciliation/delete-records`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { record_ids: selectedRecords }
      });

      // Remove deleted records from local state
      setExtractedData(prev => prev.filter(row => !selectedRecords.includes(row.id)));
      setSelectedRecords([]);
      toast.success(`Successfully deleted ${selectedRecords.length} records`);
    } catch (error) {
      toast.error("Failed to delete records");
      console.error("Delete error:", error);
    } finally {
      setDeleting(false);
    }
  };

  const syncToGoogleSheets = async () => {
    if (extractedData.length === 0) {
      toast.error("No data to sync");
      return;
    }

    // Validate that no Amount or Date is N/A
    const invalidRecords = extractedData.filter(record => 
      record.amount === "N/A" || record.amount === "" || !record.amount ||
      record.date === "N/A" || record.date === "" || !record.date
    );

    if (invalidRecords.length > 0) {
      toast.error("Please Check & Fill required values manually", {
        description: `${invalidRecords.length} record(s) have missing Amount or Date values. Please fill all required fields before syncing.`,
        duration: 5000
      });
      return;
    }

    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      
      await axios.post(`${API}/payment-reconciliation/sync-to-sheets`, {
        data: extractedData,
        month_year: selectedPeriod
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Clear frontend data after successful sync
      setExtractedData([]);
      setUploadedFiles([]);
      setLastSync(new Date().toISOString());
      
      toast.success("Successfully synced to Google Sheets and cleared local data");
    } catch (error) {
      toast.error("Failed to sync to Google Sheets");
      console.error("Sync error:", error);
    } finally {
      setSyncing(false);
    }
  };

  const openGoogleSheets = () => {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1CLhARhllhqZuDzkzNRqFcOGqjrSDzPgmC6gd3-AWOTs/edit?usp=sharing";
    window.open(sheetUrl, '_blank');
  };

  const fetchSyncStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/payment-reconciliation/sync-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLastSync(response.data.last_sync);
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  };

  // Folder Selection View
  if (currentView === "folder-selection") {
    return (
      <div className="space-y-6" data-testid="payment-reconciliation-page">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Payment Data Extractor</h1>
        </div>

        {/* Existing Folders - Grid View */}
        {existingFolders.length > 0 && (
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Your Folders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {existingFolders.map((folder, index) => (
                  <Button
                    key={index}
                    onClick={() => handleSelectExistingFolder(folder)}
                    disabled={loadingData}
                    className="h-24 flex-col bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:border-blue-800 dark:text-blue-200"
                    variant="outline"
                  >
                    <FileText size={24} className="mb-2" />
                    <span className="text-sm font-semibold">{folder.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {loadingData && (
          <div className="text-center py-8">
            <div className="inline-flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-600 dark:text-gray-400">Loading data...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Step 3: Main Interface (similar to the uploaded image)
  return (
    <div className="space-y-6" data-testid="payment-reconciliation-page">
      {/* Header with session info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => setCurrentView("folder-selection")}
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-800 p-1"
            >
              ← Back to Folders
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {selectedPeriod}
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Upload screenshots and extract payment data
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={openGoogleSheets}
            variant="outline"
            className="text-blue-600 border-blue-600 hover:bg-blue-50"
            size="sm"
          >
            <ExternalLink size={16} className="mr-1" />
            Open Sheets
          </Button>
        </div>
      </div>

      {/* Upload Receipt Screenshots */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center dark:text-white">
            <Upload size={20} className="mr-2" />
            Upload Receipt Screenshots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="receipt-upload"
            />
            <label htmlFor="receipt-upload" className="cursor-pointer">
              <Upload size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                Drag & drop images here
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                or click to select files • Max 10 files • PNG, JPG, JPEG supported
              </p>
            </label>
          </div>
          
          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Selected Files ({uploadedFiles.length}/10):
              </h4>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {uploadedFiles.length > 0 && (
            <div className="mt-6 text-center">
              <Button
                onClick={processFiles}
                disabled={processing}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-8 py-3"
              >
                {processing ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Processing {uploadedFiles.length} File(s)...
                  </>
                ) : (
                  <>
                    Process {uploadedFiles.length} File(s)
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Payment Data */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center justify-between dark:text-white">
              <div className="flex items-center">
                <FileText size={20} className="mr-2" />
                Extracted Payment Data ({extractedData.length} records)
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={copyAllData}>
                  <Copy size={16} className="mr-1" />
                  Copy All
                </Button>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                  <Download size={16} className="mr-1" />
                  Download CSV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={syncToGoogleSheets}
                  disabled={syncing}
                  className="text-green-600 border-green-600"
                >
                  <RefreshCw size={16} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? "Syncing..." : "Sync to Sheets"}
                </Button>
                {user && user.account_type === "master_admin" && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDeleteSelected}
                    disabled={selectedRecords.length === 0 || deleting}
                    className="text-red-600 border-red-600"
                  >
                    <Trash2 size={16} className="mr-1" />
                    {deleting ? "Deleting..." : `Delete Selected (${selectedRecords.length})`}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={clearAll} className="text-orange-600 border-orange-600">
                  <Trash2 size={16} className="mr-1" />
                  Clear All
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-auto max-h-[600px] relative">
              <table className="w-full">
                <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">
                      <input 
                        type="checkbox" 
                        className="rounded"
                        checked={selectedRecords.length === extractedData.length && extractedData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Driver</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Vehicle</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Time</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Description</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Payment Mode</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Distance (km)</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Duration (min)</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Pickup KM</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Drop KM</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Pickup Location</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Drop Location</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Screenshot</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedData.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-3 px-2">
                        <input 
                          type="checkbox" 
                          className="rounded"
                          checked={selectedRecords.includes(row.id)}
                          onChange={(e) => handleSelectRecord(row.id, e.target.checked)}
                        />
                      </td>
                      <td className="py-3 px-2 text-sm">{row.driver}</td>
                      <td className="py-3 px-2 text-sm">{row.vehicle}</td>
                      <td className="py-3 px-2 text-sm">{row.date}</td>
                      <td className="py-3 px-2 text-sm">{row.time}</td>
                      <td className="py-3 px-2 text-sm font-medium text-blue-600 dark:text-blue-400">{row.description}</td>
                      <td className="py-3 px-2 text-sm">
                        {editingAmount === row.id ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-20 h-8 text-sm"
                              placeholder="Amount"
                              type="number"
                            />
                            <Button onClick={() => handleSaveAmount(row.id)} size="sm" className="h-6 px-2">
                              <Check size={12} />
                            </Button>
                            <Button onClick={handleCancelEdit} variant="ghost" size="sm" className="h-6 px-2">
                              ×
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`font-semibold ${row.hasAmountError ? 'text-red-600' : 'text-green-600'}`}>
                              {row.amount === "N/A" ? "N/A" : `₹${row.amount}`}
                            </span>
                            {row.hasAmountError && (
                              <Button
                                onClick={() => handleEditAmount(row.id)}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                              >
                                <Edit size={12} />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-600">{row.paymentMode}</td>
                      <td className="py-3 px-2 text-sm text-gray-600">{row.distance}</td>
                      <td className="py-3 px-2 text-sm text-gray-600">{row.duration}</td>
                      <td className="py-3 px-2 text-sm text-gray-600">{row.pickupKm}</td>
                      <td className="py-3 px-2 text-sm text-gray-600">{row.dropKm}</td>
                      <td className="py-3 px-2 text-sm text-gray-600 max-w-32 truncate" title={row.pickupLocation}>
                        {row.pickupLocation}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-600 max-w-32 truncate" title={row.dropLocation}>
                        {row.dropLocation}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-500 max-w-24 truncate" title={row.screenshotFilename}>
                        {row.screenshotFilename}
                      </td>
                      <td className="py-3 px-2">
                        <Button
                          onClick={() => handleOpenEditDialog(row)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Edit size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {extractedData.length === 0 && (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-lg">No payment records found for {selectedPeriod}</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Upload and process screenshots to extract payment data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Full Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Payment Record</DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Driver Name</Label>
                <Input
                  value={editingRecord.driver}
                  onChange={(e) => setEditingRecord({...editingRecord, driver: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                <Input
                  value={editingRecord.vehicle}
                  onChange={(e) => setEditingRecord({...editingRecord, vehicle: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingRecord.description}
                  onChange={(e) => setEditingRecord({...editingRecord, description: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Date (DD/MM/YYYY)</Label>
                <Input
                  value={editingRecord.date}
                  onChange={(e) => setEditingRecord({...editingRecord, date: e.target.value})}
                  placeholder="DD/MM/YYYY"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  value={editingRecord.time}
                  onChange={(e) => setEditingRecord({...editingRecord, time: e.target.value})}
                  placeholder="HH:MM AM/PM"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  value={editingRecord.amount}
                  onChange={(e) => setEditingRecord({...editingRecord, amount: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Input
                  value={editingRecord.paymentMode}
                  onChange={(e) => setEditingRecord({...editingRecord, paymentMode: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Distance (km)</Label>
                <Input
                  value={editingRecord.distance}
                  onChange={(e) => setEditingRecord({...editingRecord, distance: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  value={editingRecord.duration}
                  onChange={(e) => setEditingRecord({...editingRecord, duration: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Pickup KM</Label>
                <Input
                  value={editingRecord.pickupKm}
                  onChange={(e) => setEditingRecord({...editingRecord, pickupKm: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Drop KM</Label>
                <Input
                  value={editingRecord.dropKm}
                  onChange={(e) => setEditingRecord({...editingRecord, dropKm: e.target.value})}
                />
              </div>
              
              <div className="space-y-2 col-span-2">
                <Label>Pickup Location</Label>
                <Input
                  value={editingRecord.pickupLocation}
                  onChange={(e) => setEditingRecord({...editingRecord, pickupLocation: e.target.value})}
                />
              </div>
              
              <div className="space-y-2 col-span-2">
                <Label>Drop Location</Label>
                <Input
                  value={editingRecord.dropLocation}
                  onChange={(e) => setEditingRecord({...editingRecord, dropLocation: e.target.value})}
                />
              </div>
              
              <div className="col-span-2 flex gap-2 justify-end pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveFullEdit}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
          </DialogContent>
        </Dialog>

        {/* Driver Profile Dialog */}
        <Dialog open={showDriverDialog} onOpenChange={setShowDriverDialog}>
          <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Driver Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="driver-name">Driver Name *</Label>
              <Popover open={driverPopoverOpen} onOpenChange={setDriverPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={driverPopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedDriver || "Select driver..."}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search driver..." />
                    <CommandEmpty>No driver found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {driversList.map((driver) => (
                        <CommandItem
                          key={driver}
                          value={driver}
                          onSelect={(currentValue) => {
                            setSelectedDriver(currentValue);
                            setDriverPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedDriver === driver ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {driver}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle-number">Vehicle Number *</Label>
              <Popover open={vehiclePopoverOpen} onOpenChange={setVehiclePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={vehiclePopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedVehicle || "Select vehicle..."}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search vehicle..." />
                    <CommandEmpty>No vehicle found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {vehiclesList.map((vehicle) => (
                        <CommandItem
                          key={vehicle}
                          value={vehicle}
                          onSelect={(currentValue) => {
                            setSelectedVehicle(currentValue);
                            setVehiclePopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedVehicle === vehicle ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {vehicle}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Platform *</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select platform..." />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleDriverProfileSubmitAndProcess}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={!selectedDriver || !selectedVehicle || !selectedPlatform}
            >
              Submit and Process Files
            </Button>
          </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

export default PaymentReconciliation;