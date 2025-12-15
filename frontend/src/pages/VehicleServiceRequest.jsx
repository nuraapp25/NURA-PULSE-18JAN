import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Eye, Edit, Trash2, Folder, Upload, Download, X, Calendar } from "lucide-react";
import { format } from "date-fns";

// Placeholder dropdown values (will be updated later)
const REPAIR_TYPES = [
  "Accident",
  "Parts Replacement",
  "Regular CheckUp",
  "Monthly Service",
  "Parts Damage",
  "Insurance",
  "Battery Issue",
  "Electrical Problem",
  "Mechanical Failure",
  "Other"
];

const REPAIR_SUB_TYPES = [
  "Battery",
  "Charger",
  "Fork Bend",
  "Brake System",
  "Tire Replacement",
  "Engine",
  "Transmission",
  "Suspension",
  "Lights",
  "Body Work",
  "Other"
];

const REPAIR_STATUS_OPTIONS = [
  "Pending",
  "In Progress",
  "Completed",
  "On Hold",
  "Cancelled"
];

const LIABILITY_OPTIONS = [
  "Driver",
  "NURA",
  "Manufacturer",
  "Customer",
  "Third Party",
  "Insurance Company"
];

const VehicleServiceRequest = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [imageFolderDialogOpen, setImageFolderDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    vin: "",
    vehicle_name: "",
    repair_type: "",
    repair_sub_type: "",
    description: "",
    repair_start_date: "",
    repair_end_date: "",
    repair_cost: "",
    repair_status: "Pending",
    liability: "",
    liability_POC: "",
    repair_service_provider: "",
    recovery_amount: "",
    recovery_provider: "",
    comments: "",
    vehicle_images: []
  });

  // Fetch service requests
  const fetchServiceRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/montra-vehicle/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1000 } // Get all for now
      });
      setRequests(response.data.requests);
      setFilteredRequests(response.data.requests);
    } catch (error) {
      toast.error("Failed to fetch service requests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch vehicles list
  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/montra-vehicle/vins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data.vehicles);
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
    }
  };

  useEffect(() => {
    fetchServiceRequests();
    fetchVehicles();
  }, []);

  // Search filter
  useEffect(() => {
    if (searchTerm) {
      const filtered = requests.filter(req =>
        req.vin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.vehicle_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.repair_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRequests(filtered);
    } else {
      setFilteredRequests(requests);
    }
  }, [searchTerm, requests]);

  // Handle form input change
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle vehicle selection
  const handleVehicleSelect = (vin) => {
    const vehicle = vehicles.find(v => v.vin === vin);
    if (vehicle) {
      setFormData(prev => ({
        ...prev,
        vin: vehicle.vin,
        vehicle_name: vehicle.vehicle_name
      }));
    }
  };

  // Handle image upload
  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    setUploading(true);
    
    try {
      const token = localStorage.getItem("token");
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await axios.post(
          `${API}/montra-vehicle/service-requests/upload-image`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data"
            }
          }
        );
        
        return response.data.file_path;
      });
      
      const imagePaths = await Promise.all(uploadPromises);
      setUploadedImages(prev => [...prev, ...imagePaths]);
      toast.success(`${imagePaths.length} image(s) uploaded successfully`);
    } catch (error) {
      toast.error("Failed to upload images");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  // Remove uploaded image
  const removeImage = (imagePath) => {
    setUploadedImages(prev => prev.filter(img => img !== imagePath));
  };

  // Create service request
  const handleCreate = async () => {
    // Validation
    if (!formData.vin || !formData.repair_type || !formData.repair_sub_type || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      
      // Prepare data
      const requestData = {
        ...formData,
        vehicle_images: uploadedImages,
        repair_cost: formData.repair_cost ? parseFloat(formData.repair_cost) : null,
        recovery_amount: formData.recovery_amount ? parseFloat(formData.recovery_amount) : null,
        repair_start_date: formData.repair_start_date ? new Date(formData.repair_start_date).toISOString() : null,
        repair_end_date: formData.repair_end_date ? new Date(formData.repair_end_date).toISOString() : null
      };
      
      await axios.post(`${API}/montra-vehicle/service-requests`, requestData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Service request created successfully");
      setCreateDialogOpen(false);
      resetForm();
      fetchServiceRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create service request");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Update service request
  const handleUpdate = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      
      const updateData = {
        ...formData,
        vehicle_images: uploadedImages,
        repair_cost: formData.repair_cost ? parseFloat(formData.repair_cost) : null,
        recovery_amount: formData.recovery_amount ? parseFloat(formData.recovery_amount) : null,
        repair_start_date: formData.repair_start_date ? new Date(formData.repair_start_date).toISOString() : null,
        repair_end_date: formData.repair_end_date ? new Date(formData.repair_end_date).toISOString() : null
      };
      
      await axios.patch(`${API}/montra-vehicle/service-requests/${selectedRequest.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Service request updated successfully");
      setViewDialogOpen(false);
      fetchServiceRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update service request");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Delete service request
  const handleDelete = async (requestId) => {
    if (!confirm("Are you sure you want to delete this service request?")) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/montra-vehicle/service-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Service request deleted successfully");
      fetchServiceRequests();
    } catch (error) {
      toast.error("Failed to delete service request");
      console.error(error);
    }
  };

  // Bulk Export
  const handleBulkExport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      const response = await axios.post(
        `${API}/montra-vehicle/service-requests/bulk-export`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vehicle_service_requests_export_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Service requests exported successfully");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to export service requests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Bulk Import
  const handleBulkImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${API}/montra-vehicle/service-requests/bulk-import`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      toast.success(response.data.message || "Service requests imported successfully");
      
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn("Import errors:", response.data.errors);
        toast.warning(`${response.data.errors.length} rows had errors. Check console for details.`);
      }
      
      // Refresh the list
      fetchServiceRequests();
      
      // Reset file input
      event.target.value = null;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import service requests");
      console.error(error);
      event.target.value = null;
    } finally {
      setLoading(false);
    }
  };

  // View/Edit request
  const handleViewEdit = (request) => {
    setSelectedRequest(request);
    setFormData({
      vin: request.vin,
      vehicle_name: request.vehicle_name,
      repair_type: request.repair_type,
      repair_sub_type: request.repair_sub_type,
      description: request.description,
      repair_start_date: request.repair_start_date ? format(new Date(request.repair_start_date), "yyyy-MM-dd'T'HH:mm") : "",
      repair_end_date: request.repair_end_date ? format(new Date(request.repair_end_date), "yyyy-MM-dd'T'HH:mm") : "",
      repair_cost: request.repair_cost || "",
      repair_status: request.repair_status,
      liability: request.liability || "",
      liability_POC: request.liability_POC || "",
      repair_service_provider: request.repair_service_provider || "",
      recovery_amount: request.recovery_amount || "",
      recovery_provider: request.recovery_provider || "",
      comments: request.comments || ""
    });
    setUploadedImages(request.vehicle_images || []);
    setViewDialogOpen(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      vin: "",
      vehicle_name: "",
      repair_type: "",
      repair_sub_type: "",
      description: "",
      repair_start_date: "",
      repair_end_date: "",
      repair_cost: "",
      repair_status: "Pending",
      liability: "",
      liability_POC: "",
      repair_service_provider: "",
      recovery_amount: "",
      recovery_provider: "",
      comments: ""
    });
    setUploadedImages([]);
    setSelectedRequest(null);
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicle Service Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage vehicle repair and service requests</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={handleBulkExport}
            variant="outline"
            className="flex items-center space-x-2"
            disabled={loading}
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </Button>
          <Button
            onClick={() => document.getElementById('bulk-import-input').click()}
            variant="outline"
            className="flex items-center space-x-2"
            disabled={loading}
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </Button>
          <input
            id="bulk-import-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleBulkImport}
            style={{ display: 'none' }}
          />
          <Button
            onClick={() => setImageFolderDialogOpen(true)}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Folder className="w-4 h-4" />
            <span>View Image Folders</span>
          </Button>
          <Button
            onClick={openCreateDialog}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Manual SR</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by VIN, vehicle name, or repair type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Requests ({filteredRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No service requests found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Vehicle Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Repair Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Repair Start Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{request.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{request.vehicle_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{request.repair_type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.repair_status === "Completed" ? "bg-green-100 text-green-700" :
                          request.repair_status === "In Progress" ? "bg-blue-100 text-blue-700" :
                          request.repair_status === "Pending" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {request.repair_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                        {request.repair_start_date ? format(new Date(request.repair_start_date), "dd MMM yyyy, HH:mm") : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewEdit(request)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(request.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || viewDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setViewDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewDialogOpen ? "View/Edit Service Request" : "Create Service Request"}</DialogTitle>
            <DialogDescription>
              {viewDialogOpen ? "View and edit service request details" : "Fill in the details to create a new service request"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Vehicle Selection */}
            <div className="col-span-2">
              <Label>Vehicle *</Label>
              <Select value={formData.vin} onValueChange={handleVehicleSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.vin} value={vehicle.vin}>
                      {vehicle.vehicle_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Repair Type */}
            <div>
              <Label>Repair Type *</Label>
              <Select value={formData.repair_type} onValueChange={(value) => handleInputChange("repair_type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select repair type" />
                </SelectTrigger>
                <SelectContent>
                  {REPAIR_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Repair Sub Type */}
            <div>
              <Label>Repair Sub Type *</Label>
              <Select value={formData.repair_sub_type} onValueChange={(value) => handleInputChange("repair_sub_type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select repair sub type" />
                </SelectTrigger>
                <SelectContent>
                  {REPAIR_SUB_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="col-span-2">
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Detailed description of the repair (up to 10000 words)"
                rows={4}
              />
            </div>

            {/* Dates */}
            <div>
              <Label>Repair Start Date</Label>
              <Input
                type="datetime-local"
                value={formData.repair_start_date}
                onChange={(e) => handleInputChange("repair_start_date", e.target.value)}
              />
            </div>

            <div>
              <Label>Repair End Date</Label>
              <Input
                type="datetime-local"
                value={formData.repair_end_date}
                onChange={(e) => handleInputChange("repair_end_date", e.target.value)}
              />
            </div>

            {/* Costs */}
            <div>
              <Label>Repair Cost</Label>
              <Input
                type="number"
                value={formData.repair_cost}
                onChange={(e) => handleInputChange("repair_cost", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Recovery Amount</Label>
              <Input
                type="number"
                value={formData.recovery_amount}
                onChange={(e) => handleInputChange("recovery_amount", e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Status */}
            <div>
              <Label>Repair Status</Label>
              <Select value={formData.repair_status} onValueChange={(value) => handleInputChange("repair_status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPAIR_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Liability */}
            <div>
              <Label>Liability</Label>
              <Select value={formData.liability} onValueChange={(value) => handleInputChange("liability", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select liability" />
                </SelectTrigger>
                <SelectContent>
                  {LIABILITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service Provider & Recovery Provider */}
            <div>
              <Label>Repair Service Provider</Label>
              <Input
                value={formData.repair_service_provider}
                onChange={(e) => handleInputChange("repair_service_provider", e.target.value)}
                placeholder="Service provider name"
              />
            </div>

            <div>
              <Label>Recovery Provider</Label>
              <Input
                value={formData.recovery_provider}
                onChange={(e) => handleInputChange("recovery_provider", e.target.value)}
                placeholder="Recovery provider name"
              />
            </div>

            {/* Liability POC */}
            <div className="col-span-2">
              <Label>Liability POC</Label>
              <Input
                value={formData.liability_POC}
                onChange={(e) => handleInputChange("liability_POC", e.target.value)}
                placeholder="Point of contact for liability"
              />
            </div>

            {/* Comments */}
            <div className="col-span-2">
              <Label>Comments</Label>
              <Textarea
                value={formData.comments}
                onChange={(e) => handleInputChange("comments", e.target.value)}
                placeholder="Additional comments"
                rows={3}
              />
            </div>

            {/* Image Upload */}
            <div className="col-span-2">
              <Label>Vehicle Images</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {uploading && <span className="text-sm text-gray-500">Uploading...</span>}
                </div>
                
                {/* Display uploaded images */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {uploadedImages.map((imagePath, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={`${API.replace('/api', '')}/uploaded_files/${imagePath}`}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <button
                          onClick={() => removeImage(imagePath)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Show calculated fields if editing */}
            {viewDialogOpen && selectedRequest && (
              <>
                <div>
                  <Label>Repair Time (Days)</Label>
                  <Input
                    value={selectedRequest.repair_time_days || "N/A"}
                    disabled
                    className="bg-gray-100 dark:bg-gray-800"
                  />
                </div>
                <div>
                  <Label>Service Downtime (Hours)</Label>
                  <Input
                    value={selectedRequest.service_vehicle_downtime_hours || "N/A"}
                    disabled
                    className="bg-gray-100 dark:bg-gray-800"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              setViewDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={viewDialogOpen ? handleUpdate : handleCreate} disabled={loading}>
              {loading ? "Saving..." : viewDialogOpen ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Folders Dialog */}
      <ImageFoldersDialog
        open={imageFolderDialogOpen}
        onClose={() => setImageFolderDialogOpen(false)}
      />
    </div>
  );
};

// Image Folders Dialog Component
const ImageFoldersDialog = ({ open, onClose }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFiles();
    }
  }, [open]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/montra-vehicle/service-requests/image-folders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(response.data.files);
    } catch (error) {
      toast.error("Failed to fetch image files");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vehicle Service Images</DialogTitle>
          <DialogDescription>
            View all uploaded vehicle service request images
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No images uploaded yet
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center space-x-3">
                    <img
                      src={`${API.replace('/api', '')}/uploaded_files/${file.path}`}
                      alt={file.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)} • {format(new Date(file.modified), "dd MMM yyyy, HH:mm")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`${API.replace('/api', '')}/uploaded_files/${file.path}`, '_blank')}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleServiceRequest;
