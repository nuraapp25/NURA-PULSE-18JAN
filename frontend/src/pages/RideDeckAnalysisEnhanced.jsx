import React, { useState, useEffect } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, Loader2, Database, TrendingUp, Eye, FileDown, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const RideDeckAnalysisEnhanced = () => {
  const { user } = useAuth();
  
  // Distance calculation state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Data import state
  const [customerFile, setCustomerFile] = useState(null);
  const [rideFile, setRideFile] = useState(null);
  const [importingCustomers, setImportingCustomers] = useState(false);
  const [importingRides, setImportingRides] = useState(false);
  const [customerImportStats, setCustomerImportStats] = useState(null);
  const [rideImportStats, setRideImportStats] = useState(null);
  const [stats, setStats] = useState(null);
  const [importError, setImportError] = useState(null);
  
  // View data state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewDataType, setViewDataType] = useState(null); // 'customers' or 'rides'
  const [viewData, setViewData] = useState([]);
  const [loadingViewData, setLoadingViewData] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize] = useState(100); // Records per page
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDataType, setDeleteDataType] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Calculate total pages
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Fetch stats on component mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/ride-deck/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Distance Analysis handlers
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        setError('Please upload an Excel file (.xlsx or .xls)');
        return;
      }
      
      setSelectedFile(file);
      setError(null);
      setSuccess(false);
      setDownloadUrl(null);
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = localStorage.getItem('token');

      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 200);

      const response = await fetch(`${API}/ride-deck/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        let errorMessage = 'Failed to process file';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          } catch (e2) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      setProgress(100);
      setDownloadUrl(url);
      setSuccess(true);
      setUploading(false);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to process file');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'ride_deck_analyzed.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setDownloadUrl(null);
    setError(null);
    setSuccess(false);
    setProgress(0);
    setUploading(false);
    
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Import handlers
  const handleCustomerFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) {
      setCustomerFile(file);
      setImportError(null);
    } else {
      setImportError('Please select a CSV file');
    }
  };

  const handleRideFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) {
      setRideFile(file);
      setImportError(null);
    } else {
      setImportError('Please select a CSV file');
    }
  };

  const handleCustomerImport = async () => {
    if (!customerFile) return;

    setImportingCustomers(true);
    setImportError(null);
    setCustomerImportStats(null);

    const formData = new FormData();
    formData.append('file', customerFile);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/ride-deck/import-customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Import failed');
      }

      const stats = await response.json();
      setCustomerImportStats(stats);
      fetchStats(); // Refresh stats
      setCustomerFile(null);
      document.getElementById('customer-file-upload').value = '';

    } catch (err) {
      console.error('Customer import error:', err);
      setImportError(err.message || 'Failed to import customers');
    } finally {
      setImportingCustomers(false);
    }
  };

  const handleRideImport = async () => {
    if (!rideFile) return;

    setImportingRides(true);
    setImportError(null);
    setRideImportStats(null);

    const formData = new FormData();
    formData.append('file', rideFile);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/ride-deck/import-rides`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Import failed');
      }

      const stats = await response.json();
      setRideImportStats(stats);
      fetchStats(); // Refresh stats
      setRideFile(null);
      document.getElementById('ride-file-upload').value = '';

    } catch (err) {
      console.error('Ride import error:', err);
      setImportError(err.message || 'Failed to import rides');
    } finally {
      setImportingRides(false);
    }
  };

  // View data handlers
  const handleViewData = async (dataType) => {
    setViewDataType(dataType);
    setViewDialogOpen(true);
    setLoadingViewData(true);
    
    try {
      const token = localStorage.getItem('token');
      const endpoint = dataType === 'customers' ? 'customers' : 'rides';
      const response = await fetch(`${API}/ride-deck/${endpoint}?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result = await response.json();
      setViewData(result.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error(`Failed to load ${dataType} data`);
      setViewData([]);
    } finally {
      setLoadingViewData(false);
    }
  };

  const handleDownloadExcel = async (dataType) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = dataType === 'customers' ? 'export-customers' : 'export-rides';
      const response = await fetch(`${API}/ride-deck/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataType}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`${dataType} data exported successfully`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error(`Failed to export ${dataType} data`);
    }
  };

  const handleDeleteConfirm = (dataType) => {
    setDeleteDataType(dataType);
    setDeleteDialogOpen(true);
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    
    try {
      const token = localStorage.getItem('token');
      const endpoint = deleteDataType === 'customers' ? 'delete-customers' : 'delete-rides';
      const response = await fetch(`${API}/ride-deck/${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }

      const result = await response.json();
      toast.success(result.message);
      setDeleteDialogOpen(false);
      fetchStats(); // Refresh stats
      
      // Reset import stats
      if (deleteDataType === 'customers') {
        setCustomerImportStats(null);
      } else {
        setRideImportStats(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.message || `Failed to delete ${deleteDataType} data`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ride Deck Data Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Analyze distances, import customer and ride data
        </p>
      </div>

      <Tabs defaultValue="distance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="distance">Distance Analysis</TabsTrigger>
          <TabsTrigger value="import">Data Import</TabsTrigger>
        </TabsList>

        {/* Distance Analysis Tab */}
        <TabsContent value="distance">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Excel File
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Calculate distances and times for pickup and drop locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                  
                  {!selectedFile ? (
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Excel files (.xlsx, .xls) only
                      </p>
                    </label>
                  ) : (
                    <div className="flex flex-col items-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={uploading}
                      >
                        Change File
                      </Button>
                    </div>
                  )}
                </div>

                {selectedFile && !success && (
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Process File
                      </>
                    )}
                  </Button>
                )}

                {uploading && (
                  <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                      Calculating distances... {progress}%
                    </p>
                  </div>
                )}

                {success && downloadUrl && (
                  <>
                    <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        File processed successfully!
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-3">
                      <Button
                        onClick={handleDownload}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="lg"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Analyzed File
                      </Button>
                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className="w-full"
                      >
                        Process Another File
                      </Button>
                    </div>
                  </>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Import Tab */}
        <TabsContent value="import">
          <div className="space-y-6">
            {/* Stats Card */}
            {stats && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Database Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Customers</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.customers_count}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Rides</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {stats.rides_count}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer Import */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Import Customer Data
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Upload customer CSV file. Duplicates (based on ID) will be skipped.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      id="customer-file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleCustomerFileSelect}
                      className="flex-1"
                      disabled={importingCustomers}
                    />
                    <Button
                      onClick={handleCustomerImport}
                      disabled={!customerFile || importingCustomers}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {importingCustomers ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Import Customers
                        </>
                      )}
                    </Button>
                  </div>

                  {customerImportStats && (
                    <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        <div className="space-y-1">
                          <p><strong>Import Complete!</strong></p>
                          <p>Total Rows: {customerImportStats.total_rows}</p>
                          <p>New Records: {customerImportStats.new_records}</p>
                          <p>Duplicates Skipped: {customerImportStats.duplicate_records}</p>
                          {customerImportStats.errors > 0 && (
                            <p className="text-orange-600">Errors: {customerImportStats.errors}</p>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  {stats && stats.customers_count > 0 && (
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        onClick={() => handleViewData('customers')}
                        variant="outline"
                        className="flex-1"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Data
                      </Button>
                      <Button
                        onClick={() => handleDownloadExcel('customers')}
                        variant="outline"
                        className="flex-1"
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        Download Excel
                      </Button>
                      {user?.role === 'master_admin' && (
                        <Button
                          onClick={() => handleDeleteConfirm('customers')}
                          variant="destructive"
                          className="flex-1"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete All
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Ride Import */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Import Ride Data
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Upload ride CSV file. New rides will have computed fields added automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      id="ride-file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleRideFileSelect}
                      className="flex-1"
                      disabled={importingRides}
                    />
                    <Button
                      onClick={handleRideImport}
                      disabled={!rideFile || importingRides}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {importingRides ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Import Rides
                        </>
                      )}
                    </Button>
                  </div>

                  {importingRides && (
                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        Processing rides... This may take a few minutes as we compute distances and localities.
                      </AlertDescription>
                    </Alert>
                  )}

                  {rideImportStats && (
                    <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        <div className="space-y-1">
                          <p><strong>Import Complete!</strong></p>
                          <p>Total Rows: {rideImportStats.total_rows}</p>
                          <p>New Records: {rideImportStats.new_records}</p>
                          <p>Duplicates Skipped: {rideImportStats.duplicate_records}</p>
                          {rideImportStats.errors > 0 && (
                            <p className="text-orange-600">Errors: {rideImportStats.errors}</p>
                          )}
                          <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                            New rides have been processed with computed fields (localities, distances, etc.)
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  {stats && stats.rides_count > 0 && (
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        onClick={() => handleViewData('rides')}
                        variant="outline"
                        className="flex-1"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Data
                      </Button>
                      <Button
                        onClick={() => handleDownloadExcel('rides')}
                        variant="outline"
                        className="flex-1"
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        Download Excel
                      </Button>
                      {user?.role === 'master_admin' && (
                        <Button
                          onClick={() => handleDeleteConfirm('rides')}
                          variant="destructive"
                          className="flex-1"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete All
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            {/* Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                📋 Computed Fields for New Rides:
              </h4>
              <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li><strong>Pickup Locality</strong> - Extracted from pickup address</li>
                <li><strong>Drop Locality</strong> - Extracted from drop address</li>
                <li><strong>Pickup Distance from Depot</strong> - Distance from VR Mall to pickup</li>
                <li><strong>Drop Distance from Depot</strong> - Distance from VR Mall to drop</li>
                <li><strong>Most Common Pickup Point</strong> - Customer's most frequent pickup location</li>
                <li><strong>Most Common Pickup Locality</strong> - Locality of most common pickup</li>
                <li><strong>Status Reason</strong> - Empty by default (editable)</li>
                <li><strong>Status Detail</strong> - Username who updated status</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* View Data Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="dark:bg-gray-800 max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              {viewDataType === 'customers' ? 'Customer Data' : 'Ride Data'}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Viewing first 100 records
            </DialogDescription>
          </DialogHeader>
          
          {loadingViewData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : viewData.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {Object.keys(viewData[0] || {}).map((key) => (
                      <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewData.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      {Object.values(row).map((value, vidx) => (
                        <td key={vidx} className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                          {value !== null && value !== undefined ? String(value) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Confirm Delete</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Are you sure you want to delete all {deleteDataType} data? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This will permanently delete all {deleteDataType} records from the database.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteData}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All {deleteDataType}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RideDeckAnalysisEnhanced;
