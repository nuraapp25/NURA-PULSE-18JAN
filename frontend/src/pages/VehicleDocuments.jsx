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
import { Plus, Search, Eye, Edit, Trash2, Upload, X, Calendar, FileText, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const VehicleDocuments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMasterAdmin = user?.account_type === "master_admin";
  const isAdmin = user?.account_type === "admin";
  
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // File upload states
  const [rcBookFile, setRcBookFile] = useState(null);
  const [insuranceDocFile, setInsuranceDocFile] = useState(null);
  const [salesInvoiceFile, setSalesInvoiceFile] = useState(null);
  const [purchaseOrderFile, setPurchaseOrderFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    vin: "",
    vehicle_number: "",
    vehicle_name: "",
    rc_book: "",
    insurance_doc: "",
    sales_invoice: "",
    purchase_order: "",
    registration_number: "",
    registration_expiry_date: "",
    insurance_start_date: "",
    insurance_expiry_date: "",
    vehicle_model_number: "",
    vehicle_description: "",
    vehicle_cost: "",
    vehicle_manufacturer: "",
    manufacturer_details: "",
    purchase_date: "",
    comments: ""
  });

  // Fetch vehicle documents
  const fetchVehicleDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/vehicle-documents`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1000 }
      });

      if (response.data.success) {
        setDocuments(response.data.documents);
        setFilteredDocuments(response.data.documents);
      }
    } catch (error) {
      console.error("Error fetching vehicle documents:", error);
      toast.error("Failed to fetch vehicle documents");
    } finally {
      setLoading(false);
    }
  };

  // Fetch vehicles from Vehicles List.xlsx
  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/montra-vehicle/vins`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setVehicles(response.data.vehicles || []);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast.error("Failed to fetch vehicles list");
    }
  };

  useEffect(() => {
    fetchVehicleDocuments();
    fetchVehicles();
  }, []);

  // Search filter
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter(doc =>
        doc.vin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vehicle_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDocuments(filtered);
    }
  }, [searchTerm, documents]);

  // Handle file upload
  const handleFileUpload = async (file, fileType) => {
    if (!file) return null;

    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await axios.post(
        `${API}/vehicle-documents/upload-file`,
        formDataUpload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          }
        }
      );

      if (response.data.success) {
        toast.success(`${fileType} uploaded successfully`);
        return response.data.file_path;
      }
    } catch (error) {
      console.error(`Error uploading ${fileType}:`, error);
      toast.error(`Failed to upload ${fileType}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Handle create/update
  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.vin || !formData.vehicle_number || !formData.vehicle_name) {
      toast.error("Please fill in VIN, Vehicle Number, and Vehicle Name");
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      
      // Upload files if new ones were selected
      const updatedFormData = { ...formData };
      
      if (rcBookFile) {
        const filePath = await handleFileUpload(rcBookFile, "RC Book");
        if (filePath) updatedFormData.rc_book = filePath;
      }
      
      if (insuranceDocFile) {
        const filePath = await handleFileUpload(insuranceDocFile, "Insurance Document");
        if (filePath) updatedFormData.insurance_doc = filePath;
      }
      
      if (salesInvoiceFile) {
        const filePath = await handleFileUpload(salesInvoiceFile, "Sales Invoice");
        if (filePath) updatedFormData.sales_invoice = filePath;
      }
      
      if (purchaseOrderFile) {
        const filePath = await handleFileUpload(purchaseOrderFile, "Purchase Order");
        if (filePath) updatedFormData.purchase_order = filePath;
      }

      // Convert empty strings to null for optional fields
      Object.keys(updatedFormData).forEach(key => {
        if (updatedFormData[key] === "") {
          updatedFormData[key] = null;
        }
      });

      // Parse numeric fields
      if (updatedFormData.vehicle_cost) {
        updatedFormData.vehicle_cost = parseFloat(updatedFormData.vehicle_cost);
      }

      let response;
      if (isEditMode && selectedDocument) {
        // Update existing document
        response = await axios.put(
          `${API}/vehicle-documents/${selectedDocument.id}`,
          updatedFormData,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        toast.success("Vehicle document updated successfully");
      } else {
        // Create new document
        response = await axios.post(
          `${API}/vehicle-documents`,
          updatedFormData,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        toast.success("Vehicle document created successfully");
      }

      // Reset form and close dialog
      resetForm();
      setCreateDialogOpen(false);
      fetchVehicleDocuments();
    } catch (error) {
      console.error("Error saving vehicle document:", error);
      toast.error(error.response?.data?.detail || "Failed to save vehicle document");
    } finally {
      setUploading(false);
    }
  };

  // Handle view/edit
  const handleViewEdit = (doc) => {
    setSelectedDocument(doc);
    setFormData({
      vin: doc.vin || "",
      vehicle_number: doc.vehicle_number || "",
      vehicle_name: doc.vehicle_name || "",
      rc_book: doc.rc_book || "",
      insurance_doc: doc.insurance_doc || "",
      sales_invoice: doc.sales_invoice || "",
      purchase_order: doc.purchase_order || "",
      registration_number: doc.registration_number || "",
      registration_expiry_date: doc.registration_expiry_date ? doc.registration_expiry_date.split('T')[0] : "",
      insurance_start_date: doc.insurance_start_date ? doc.insurance_start_date.split('T')[0] : "",
      insurance_expiry_date: doc.insurance_expiry_date ? doc.insurance_expiry_date.split('T')[0] : "",
      vehicle_model_number: doc.vehicle_model_number || "",
      vehicle_description: doc.vehicle_description || "",
      vehicle_cost: doc.vehicle_cost || "",
      vehicle_manufacturer: doc.vehicle_manufacturer || "",
      manufacturer_details: doc.manufacturer_details || "",
      purchase_date: doc.purchase_date ? doc.purchase_date.split('T')[0] : "",
      comments: doc.comments || ""
    });
    setIsEditMode(false);
    setViewDialogOpen(true);
  };

  // Handle edit mode
  const handleEditMode = () => {
    setIsEditMode(true);
    setViewDialogOpen(false);
    setCreateDialogOpen(true);
  };

  // Handle delete
  const handleDelete = async (documentId) => {
    if (!window.confirm("Are you sure you want to delete this vehicle document?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/vehicle-documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Vehicle document deleted successfully");
      fetchVehicleDocuments();
      setViewDialogOpen(false);
    } catch (error) {
      console.error("Error deleting vehicle document:", error);
      toast.error(error.response?.data?.detail || "Failed to delete vehicle document");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      vin: "",
      vehicle_number: "",
      vehicle_name: "",
      rc_book: "",
      insurance_doc: "",
      sales_invoice: "",
      purchase_order: "",
      registration_number: "",
      registration_expiry_date: "",
      insurance_expiry_date: "",
      vehicle_model_number: "",
      vehicle_description: "",
      vehicle_cost: "",
      vehicle_manufacturer: "",
      manufacturer_details: "",
      purchase_date: "",
      comments: ""
    });
    setRcBookFile(null);
    setInsuranceDocFile(null);
    setSalesInvoiceFile(null);
    setPurchaseOrderFile(null);
    setSelectedDocument(null);
    setIsEditMode(false);
  };

  // Handle vehicle selection
  const handleVehicleSelect = (vin) => {
    const selectedVehicle = vehicles.find(v => v.vin === vin);
    if (selectedVehicle) {
      // Both VIN and vehicle_number are the same from the Excel file
      setFormData({
        ...formData,
        vin: selectedVehicle.vin,
        vehicle_name: selectedVehicle.vehicle_name,
        vehicle_number: selectedVehicle.vin // Auto-fill vehicle number same as VIN
      });
    }
  };

  // Handle file download/view
  const handleFileView = async (filePath) => {
    if (!filePath) {
      toast.error("No file available");
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/vehicle-documents/file/${filePath}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create blob URL and open in new tab
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up the URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Error viewing file:", error);
      toast.error("Failed to open file");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard/montra-vehicle")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Vehicle Documents
            </h1>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add New Vehicle
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by VIN, Vehicle Name, or Vehicle Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Documents ({filteredDocuments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No vehicle documents found. Add your first vehicle document.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">ID</th>
                      <th className="text-left p-3">Vehicle Name</th>
                      <th className="text-left p-3">VIN</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc, index) => (
                      <tr key={doc.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-3">{index + 1}</td>
                        <td className="p-3">{doc.vehicle_name}</td>
                        <td className="p-3">{doc.vin}</td>
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewEdit(doc)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View/Edit
                          </Button>
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
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Vehicle Document" : "Add New Vehicle Document"}
              </DialogTitle>
              <DialogDescription>
                Fill in the vehicle document details below
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Vehicle Selection - Single Dropdown */}
              <div>
                <Label>Vehicle Number *</Label>
                <Select value={formData.vin} onValueChange={handleVehicleSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.vin} value={vehicle.vin}>
                        {vehicle.vin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Document Uploads */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Document Uploads</h3>
                
                {/* RC Book */}
                <div>
                  <Label>RC Book (PDF/PNG)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setRcBookFile(e.target.files[0])}
                    />
                    {formData.rc_book && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileView(formData.rc_book)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Insurance Document */}
                <div>
                  <Label>Insurance Document (PDF/PNG)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setInsuranceDocFile(e.target.files[0])}
                    />
                    {formData.insurance_doc && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileView(formData.insurance_doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sales Invoice */}
                <div>
                  <Label>Sales Invoice (PDF/Word)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setSalesInvoiceFile(e.target.files[0])}
                    />
                    {formData.sales_invoice && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileView(formData.sales_invoice)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Purchase Order */}
                <div>
                  <Label>Purchase Order (PDF/Word)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setPurchaseOrderFile(e.target.files[0])}
                    />
                    {formData.purchase_order && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileView(formData.purchase_order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Registration & Insurance Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Registration & Insurance</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Registration Number</Label>
                    <Input
                      value={formData.registration_number}
                      onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                      placeholder="Enter registration number"
                    />
                  </div>

                  <div>
                    <Label>Registration Expiry Date</Label>
                    <Input
                      type="date"
                      value={formData.registration_expiry_date}
                      onChange={(e) => setFormData({ ...formData, registration_expiry_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Insurance Start Date</Label>
                    <Input
                      type="date"
                      value={formData.insurance_start_date}
                      onChange={(e) => setFormData({ ...formData, insurance_start_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Insurance Expiry Date</Label>
                    <Input
                      type="date"
                      value={formData.insurance_expiry_date}
                      onChange={(e) => setFormData({ ...formData, insurance_expiry_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Vehicle Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Vehicle Model Number</Label>
                    <Input
                      value={formData.vehicle_model_number}
                      onChange={(e) => setFormData({ ...formData, vehicle_model_number: e.target.value })}
                      placeholder="Enter model number"
                    />
                  </div>

                  <div>
                    <Label>Vehicle Cost</Label>
                    <Input
                      type="number"
                      value={formData.vehicle_cost}
                      onChange={(e) => setFormData({ ...formData, vehicle_cost: e.target.value })}
                      placeholder="Enter vehicle cost"
                    />
                  </div>

                  <div>
                    <Label>Vehicle Manufacturer</Label>
                    <Input
                      value={formData.vehicle_manufacturer}
                      onChange={(e) => setFormData({ ...formData, vehicle_manufacturer: e.target.value })}
                      placeholder="Enter manufacturer"
                    />
                  </div>

                  <div>
                    <Label>Purchase Date</Label>
                    <Input
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Vehicle Description</Label>
                  <Textarea
                    value={formData.vehicle_description}
                    onChange={(e) => setFormData({ ...formData, vehicle_description: e.target.value })}
                    placeholder="Enter vehicle description"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Manufacturer Details</Label>
                  <Textarea
                    value={formData.manufacturer_details}
                    onChange={(e) => setFormData({ ...formData, manufacturer_details: e.target.value })}
                    placeholder="Enter manufacturer details"
                    rows={3}
                  />
                </div>
              </div>

              {/* Comments */}
              <div>
                <Label>Comments</Label>
                <Textarea
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder="Additional comments"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={uploading}>
                {uploading ? "Uploading..." : isEditMode ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vehicle Document Details</DialogTitle>
            </DialogHeader>

            {selectedDocument && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">VIN</Label>
                    <p className="font-medium">{selectedDocument.vin}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Vehicle Number</Label>
                    <p className="font-medium">{selectedDocument.vehicle_number}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Vehicle Name</Label>
                    <p className="font-medium">{selectedDocument.vehicle_name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Registration Number</Label>
                    <p className="font-medium">{selectedDocument.registration_number || "N/A"}</p>
                  </div>
                </div>

                {/* Documents */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Documents</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedDocument.rc_book && (
                      <Button
                        variant="outline"
                        onClick={() => handleFileView(selectedDocument.rc_book)}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View RC Book
                      </Button>
                    )}
                    {selectedDocument.insurance_doc && (
                      <Button
                        variant="outline"
                        onClick={() => handleFileView(selectedDocument.insurance_doc)}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View Insurance Doc
                      </Button>
                    )}
                    {selectedDocument.sales_invoice && (
                      <Button
                        variant="outline"
                        onClick={() => handleFileView(selectedDocument.sales_invoice)}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View Sales Invoice
                      </Button>
                    )}
                    {selectedDocument.purchase_order && (
                      <Button
                        variant="outline"
                        onClick={() => handleFileView(selectedDocument.purchase_order)}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View Purchase Order
                      </Button>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedDocument.registration_expiry_date && (
                    <div>
                      <Label className="text-gray-500">Registration Expiry</Label>
                      <p className="font-medium">
                        {format(new Date(selectedDocument.registration_expiry_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                  )}
                  {selectedDocument.insurance_start_date && (
                    <div>
                      <Label className="text-gray-500">Insurance Start</Label>
                      <p className="font-medium">
                        {format(new Date(selectedDocument.insurance_start_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                  )}
                  {selectedDocument.insurance_expiry_date && (
                    <div>
                      <Label className="text-gray-500">Insurance Expiry</Label>
                      <p className="font-medium">
                        {format(new Date(selectedDocument.insurance_expiry_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                  )}
                  {selectedDocument.purchase_date && (
                    <div>
                      <Label className="text-gray-500">Purchase Date</Label>
                      <p className="font-medium">
                        {format(new Date(selectedDocument.purchase_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Vehicle Details */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Vehicle Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedDocument.vehicle_model_number && (
                      <div>
                        <Label className="text-gray-500">Model Number</Label>
                        <p className="font-medium">{selectedDocument.vehicle_model_number}</p>
                      </div>
                    )}
                    {selectedDocument.vehicle_cost && (
                      <div>
                        <Label className="text-gray-500">Cost</Label>
                        <p className="font-medium">₹{selectedDocument.vehicle_cost}</p>
                      </div>
                    )}
                    {selectedDocument.vehicle_manufacturer && (
                      <div>
                        <Label className="text-gray-500">Manufacturer</Label>
                        <p className="font-medium">{selectedDocument.vehicle_manufacturer}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Descriptions */}
                {selectedDocument.vehicle_description && (
                  <div>
                    <Label className="text-gray-500">Description</Label>
                    <p className="mt-1">{selectedDocument.vehicle_description}</p>
                  </div>
                )}

                {selectedDocument.manufacturer_details && (
                  <div>
                    <Label className="text-gray-500">Manufacturer Details</Label>
                    <p className="mt-1">{selectedDocument.manufacturer_details}</p>
                  </div>
                )}

                {selectedDocument.comments && (
                  <div>
                    <Label className="text-gray-500">Comments</Label>
                    <p className="mt-1">{selectedDocument.comments}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex justify-between">
              <div>
                {(isMasterAdmin || isAdmin) && (
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(selectedDocument.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={handleEditMode}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default VehicleDocuments;
