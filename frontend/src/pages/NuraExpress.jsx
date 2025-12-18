import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Image as ImageIcon, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NuraExpress = () => {
  const [selectedImages, setSelectedImages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [generating, setGenerating] = useState(false);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 10) {
      toast.error("Maximum 10 images allowed");
      return;
    }
    
    setSelectedImages(files);
    setExtractedData([]);
    toast.success(`${files.length} image(s) selected`);
  };

  const handleProcessImages = async () => {
    if (selectedImages.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    try {
      setProcessing(true);
      const token = localStorage.getItem("token");
      
      const formData = new FormData();
      selectedImages.forEach((file) => {
        formData.append('files', file);
      });

      const response = await axios.post(
        `${API}/nura-express/process-images`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setExtractedData(response.data.extracted_data);
        toast.success(`Extracted ${response.data.extracted_data.length} delivery records`);
      }
    } catch (error) {
      console.error("Error processing images:", error);
      toast.error(error.response?.data?.detail || "Failed to process images");
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateField = (index, field, value) => {
    const updated = [...extractedData];
    updated[index][field] = value;
    setExtractedData(updated);
  };

  const handleDownloadExcel = async () => {
    if (extractedData.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      setGenerating(true);
      const token = localStorage.getItem("token");

      const response = await axios.post(
        `${API}/nura-express/generate-excel`,
        { deliveries: extractedData },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nura_express_deliveries_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Excel file downloaded successfully with geocoded addresses!");
    } catch (error) {
      console.error("Error downloading Excel:", error);
      toast.error("Failed to generate Excel file");
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveImage = (index) => {
    const updated = [...selectedImages];
    updated.splice(index, 1);
    setSelectedImages(updated);
    
    // Also remove extracted data for this image
    const updatedData = extractedData.filter(d => d.image_index !== index + 1);
    setExtractedData(updatedData);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            📦 Nura Express
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Extract delivery information from screenshots using AI
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Delivery Screenshots
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="image-upload" className="text-sm font-medium mb-2 block">
              Select Images (Max 10)
            </Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="cursor-pointer"
            />
          </div>

          {selectedImages.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Images ({selectedImages.length}/10)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {selectedImages.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <p className="text-xs text-center mt-1 truncate">{file.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleProcessImages}
              disabled={selectedImages.length === 0 || processing}
              className="flex-1 sm:flex-none"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Extract Data
                </>
              )}
            </Button>

            {extractedData.length > 0 && (
              <Button
                onClick={handleDownloadExcel}
                disabled={generating}
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extracted Data Section */}
      {extractedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Extracted Delivery Data ({extractedData.length} records)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {extractedData.map((data, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">Delivery #{index + 1}</h3>
                    <span className="text-xs text-gray-500">Image {data.image_index}</span>
                  </div>

                  {data.error ? (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{data.error}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Order No.</Label>
                        <Input
                          value={data.order_no}
                          onChange={(e) => handleUpdateField(index, 'order_no', e.target.value)}
                          placeholder="Enter order number"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Customer Name</Label>
                        <Input
                          value={data.customer_name}
                          onChange={(e) => handleUpdateField(index, 'customer_name', e.target.value)}
                          placeholder="Enter customer name"
                          className="mt-1"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label className="text-xs">Address</Label>
                        <Input
                          value={data.address}
                          onChange={(e) => handleUpdateField(index, 'address', e.target.value)}
                          placeholder="Enter complete address"
                          className="mt-1"
                        />
                      </div>

                      {data.raw_response && (
                        <div className="md:col-span-2">
                          <details className="text-xs">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                              View AI Response
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                              {data.raw_response}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> The Excel file will include geocoded latitude and longitude for all addresses using Google Maps API.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            How to Use
          </h3>
          <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-decimal list-inside">
            <li>Upload up to 10 delivery screenshot images</li>
            <li>Click "Extract Data" to process images with AI</li>
            <li>Review and edit the extracted information if needed</li>
            <li>Click "Download Excel" to get a formatted spreadsheet with:
              <ul className="ml-6 mt-1 space-y-1 list-disc list-inside text-xs">
                <li>All extracted delivery details</li>
                <li>Geocoded latitude & longitude for each address</li>
                <li>Area information</li>
                <li>Columns for Driver Name, Vehicle No., Timing, Status, COD</li>
              </ul>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default NuraExpress;
