import React, { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const RideDeckAnalysis = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if it's an Excel file
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

      // Simulate progress during upload
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
          // If JSON parse fails, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
          } catch (e2) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Get the blob from response
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
    
    // Reset file input
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ride Deck Data Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Calculate driving distances from VR Mall to pickup and pickup to drop locations
        </p>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Excel File
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            Upload your Excel file with pickup and drop location coordinates (columns F, G, H, I, J, K)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* File Upload Section */}
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

            {/* Process Button */}
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

            {/* Progress Bar */}
            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                  Calculating distances... {progress}%
                </p>
                <p className="text-xs text-center text-gray-500 dark:text-gray-500">
                  This may take a few minutes depending on the number of rows
                </p>
              </div>
            )}

            {/* Success Message and Download Button */}
            {success && downloadUrl && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <div className="flex items-center justify-between">
                    <span>File processed successfully! Click below to download.</span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {success && downloadUrl && (
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
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              📋 File Requirements:
            </h4>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>Excel file (.xlsx or .xls format)</li>
              <li>Must contain columns: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">pickupLat, pickupLong, dropLat, dropLong</code></li>
              <li>Coordinates should be in decimal format (e.g., 13.0795762)</li>
              <li>Results will be added to columns <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">VR_to_Pickup_Distance_KM</code> and <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">Pickup_to_Drop_Distance_KM</code></li>
            </ul>
          </div>

          {/* Starting Point Info */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              📍 Starting Point:
            </h4>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              VR Mall, Chennai - 13.0795762°N, 80.1956368°E
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              All distances are calculated as driving distances using Google Maps.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RideDeckAnalysis;
