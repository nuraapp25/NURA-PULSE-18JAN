import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Download, Upload, AlertTriangle, CheckCircle, Loader2, FileDown, FileUp, Info } from "lucide-react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { toast } from "sonner";

const ManageDB = () => {
  const { user } = useAuth();
  const isMasterAdmin = user?.account_type === "master_admin";
  
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [exportStats, setExportStats] = useState(null);
  const [importStats, setImportStats] = useState(null);

  // Database collections to export/import
  const collections = [
    "users",
    "driver_leads",
    "montra_feed_data",
    "payment_records",
    "qr_codes",
    "qr_scans",
    "expenses",
    "customer_data",
    "ride_data",
    "activity_logs"
  ];

  const handleExport = async () => {
    if (!isMasterAdmin) {
      toast.error("Only Master Admin can export database");
      return;
    }

    setExporting(true);
    setExportStats(null);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/admin/database/export`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
          timeout: 300000 // 5 minutes timeout
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      link.setAttribute('download', `nura_pulse_backup_${timestamp}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Get file size
      const fileSizeMB = (response.data.size / (1024 * 1024)).toFixed(2);
      
      setExportStats({
        success: true,
        size: fileSizeMB,
        timestamp: new Date().toLocaleString()
      });

      toast.success(`Database exported successfully! (${fileSizeMB} MB)`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.response?.data?.detail || "Failed to export database");
      setExportStats({
        success: false,
        error: error.response?.data?.detail || "Export failed"
      });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast.error("Please select a valid JSON backup file");
        return;
      }
      setImportFile(file);
      setImportStats(null);
      toast.success(`Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    }
  };

  const handleImport = async () => {
    if (!isMasterAdmin) {
      toast.error("Only Master Admin can import database");
      return;
    }

    if (!importFile) {
      toast.error("Please select a backup file first");
      return;
    }

    const confirmed = window.confirm(
      "⚠️ WARNING: This will REPLACE your current database with the backup data!\n\n" +
      "Are you absolutely sure you want to proceed?"
    );

    if (!confirmed) return;

    setImporting(true);
    setImportStats(null);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await axios.post(
        `${API}/admin/database/import`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 300000 // 5 minutes timeout
        }
      );

      setImportStats({
        success: true,
        imported: response.data.imported_collections || {},
        timestamp: new Date().toLocaleString()
      });

      toast.success("Database imported successfully! Refresh the page to see changes.");
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error.response?.data?.detail || "Failed to import database");
      setImportStats({
        success: false,
        error: error.response?.data?.detail || "Import failed"
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="manage-db-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          <Database className="inline mr-3" size={32} />
          Manage Database
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Export and import your complete application database
        </p>
      </div>

      {!isMasterAdmin && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3 text-red-700 dark:text-red-400">
              <AlertTriangle size={24} />
              <p className="font-semibold">Access Denied: Master Admin Only</p>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              Database management features are restricted to Master Admin users only.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Info size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-semibold mb-2">Purpose: Database Backup & Migration</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300">
                <li>Prevent data loss during deployment migrations</li>
                <li>Transfer data between forked sessions</li>
                <li>Create regular backups for disaster recovery</li>
                <li>Export entire database as a single JSON file</li>
                <li>Import to restore from backup instantly</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Database */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <FileDown size={20} className="mr-2 text-green-600" />
            Export Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Download a complete backup of all collections in your database. This file can be used to restore your data later.
          </p>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Collections to export ({collections.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {collections.map(col => (
                <span
                  key={col}
                  className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting || !isMasterAdmin}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={20} />
                Exporting Database...
              </>
            ) : (
              <>
                <Download className="mr-2" size={20} />
                Export Complete Database
              </>
            )}
          </Button>

          {exportStats && (
            <div className={`p-4 rounded-lg ${exportStats.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center space-x-2">
                {exportStats.success ? (
                  <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                )}
                <p className={`font-semibold ${exportStats.success ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'}`}>
                  {exportStats.success ? 'Export Successful' : 'Export Failed'}
                </p>
              </div>
              {exportStats.success && (
                <div className="mt-2 text-sm text-green-800 dark:text-green-300">
                  <p>File Size: {exportStats.size} MB</p>
                  <p>Timestamp: {exportStats.timestamp}</p>
                </div>
              )}
              {exportStats.error && (
                <p className="mt-2 text-sm text-red-800 dark:text-red-300">{exportStats.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Database */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <FileUp size={20} className="mr-2 text-orange-600" />
            Import Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-start space-x-2">
              <AlertTriangle size={20} className="text-orange-600 dark:text-orange-400 mt-0.5" />
              <div className="text-sm text-orange-900 dark:text-orange-200">
                <p className="font-semibold mb-1">⚠️ Warning: Destructive Operation</p>
                <p>Importing will REPLACE all existing data with the backup data. This action cannot be undone.</p>
              </div>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-400">
            Upload a previously exported database backup file (JSON format) to restore your data.
          </p>

          <div>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              disabled={!isMasterAdmin}
              className="hidden"
              id="backup-file-input"
            />
            <label
              htmlFor="backup-file-input"
              className={`flex items-center justify-center w-full h-32 px-4 border-2 border-dashed rounded-lg cursor-pointer ${
                isMasterAdmin 
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600' 
                  : 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="text-center">
                <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {importFile ? importFile.name : 'Click to select backup file'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  JSON file only
                </p>
              </div>
            </label>
          </div>

          <Button
            onClick={handleImport}
            disabled={importing || !importFile || !isMasterAdmin}
            className="w-full bg-orange-600 hover:bg-orange-700"
            size="lg"
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={20} />
                Importing Database...
              </>
            ) : (
              <>
                <Upload className="mr-2" size={20} />
                Import & Replace Database
              </>
            )}
          </Button>

          {importStats && (
            <div className={`p-4 rounded-lg ${importStats.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center space-x-2">
                {importStats.success ? (
                  <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                )}
                <p className={`font-semibold ${importStats.success ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'}`}>
                  {importStats.success ? 'Import Successful' : 'Import Failed'}
                </p>
              </div>
              {importStats.success && importStats.imported && (
                <div className="mt-2 text-sm text-green-800 dark:text-green-300">
                  <p className="font-medium mb-1">Collections Imported:</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(importStats.imported).map(([col, count]) => (
                      <p key={col}>• {col}: {count} records</p>
                    ))}
                  </div>
                  <p className="mt-2 text-xs">Timestamp: {importStats.timestamp}</p>
                </div>
              )}
              {importStats.error && (
                <p className="mt-2 text-sm text-red-800 dark:text-red-300">{importStats.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageDB;