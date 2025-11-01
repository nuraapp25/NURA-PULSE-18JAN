import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Phone, MessageCircle, CheckCircle, RefreshCw, AlertCircle, User } from "lucide-react";
import LeadDetailsDialog from "@/components/LeadDetailsDialog";

// Status options grouped by stage
const S1_STATUSES = [
  { value: "New", label: "New" },
  { value: "Not Interested", label: "Not Interested" },
  { value: "Interested, No DL", label: "Interested, No DL" },
  { value: "Interested, No Badge", label: "Interested, No Badge" },
  { value: "Highly Interested", label: "Highly Interested" },
  { value: "Call back 1D", label: "Call back 1D" },
  { value: "Call back 1W", label: "Call back 1W" },
  { value: "Call back 2W", label: "Call back 2W" },
  { value: "Call back 1M", label: "Call back 1M" },
];

const S2_STATUSES = [
  { value: "Docs Upload Pending", label: "Docs Upload Pending" },
  { value: "Verification Pending", label: "Verification Pending" },
  { value: "Duplicate License", label: "Duplicate License" },
  { value: "DL - Amount", label: "DL - Amount" },
  { value: "Verified", label: "Verified" },
  { value: "Verification Rejected", label: "Verification Rejected" },
];

const S3_STATUSES = [
  { value: "Schedule Pending", label: "Schedule Pending" },
  { value: "Training WIP", label: "Training WIP" },
  { value: "Training Completed", label: "Training Completed" },
  { value: "Training Rejected", label: "Training Rejected" },
  { value: "Re-Training", label: "Re-Training" },
  { value: "Absent for training", label: "Absent for training" },
  { value: "Approved", label: "Approved" },
];

const S4_STATUSES = [
  { value: "CT Pending", label: "CT Pending" },
  { value: "CT WIP", label: "CT WIP" },
  { value: "Shift Details Pending", label: "Shift Details Pending" },
  { value: "DONE!", label: "DONE!" },
  { value: "Training Rejected", label: "Training Rejected" },
  { value: "Re-Training", label: "Re-Training" },
  { value: "Absent for training", label: "Absent for training" },
  { value: "Terminated", label: "Terminated" },
];

const ALL_STATUSES = [...S1_STATUSES, ...S2_STATUSES, ...S3_STATUSES, ...S4_STATUSES];

const TelecallerDeskMobile = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Admin/Master Admin telecaller selection
  const isAdmin = user?.account_type === "master_admin" || user?.account_type === "admin";
  const [telecallers, setTelecallers] = useState([]);
  const [selectedTelecaller, setSelectedTelecaller] = useState(null);
  
  // State for LeadDetailsDialog
  const [editedLead, setEditedLead] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Document management state
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [scanningDoc, setScanningDoc] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      fetchTelecallers();
    } else {
      fetchLeads();
    }
  }, []);
  
  // Fetch telecallers for admin dropdown
  const fetchTelecallers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/telecallers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTelecallers(response.data || []);
      
      // Auto-select first telecaller if available
      if (response.data && response.data.length > 0) {
        setSelectedTelecaller(response.data[0].email); // Use email instead of id
        fetchLeadsForTelecaller(response.data[0].email);
      }
    } catch (error) {
      console.error("Error fetching telecallers:", error);
      toast.error("Failed to load telecallers");
    }
  };
  
  // Fetch leads for a specific telecaller (admin view)
  const fetchLeadsForTelecaller = async (telecallerEmail) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/driver-onboarding/leads?telecaller=${telecallerEmail}&skip_pagination=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const leadsData = response.data.leads || response.data || [];
      setLeads(leadsData);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle telecaller selection change
  const handleTelecallerChange = (telecallerEmail) => {
    setSelectedTelecaller(telecallerEmail);
    fetchLeadsForTelecaller(telecallerEmail);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/driver-onboarding/leads?telecaller=${user.id}&skip_pagination=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Handle both response formats
      const leadsData = response.data.leads || response.data || [];
      setLeads(leadsData);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (lead) => {
    const phoneNumber = lead.phone_number.replace(/\D/g, '');
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleWhatsApp = (lead) => {
    const phoneNumber = lead.phone_number.replace(/\D/g, '');
    const message = encodeURIComponent(`Hi ${lead.name}, I'm calling from Nura regarding your driver application.`);
    window.open(`https://wa.me/91${phoneNumber}?text=${message}`, '_blank');
  };

  const openStatusDialog = (lead) => {
    setSelectedLead(lead);
    setSelectedStatus(lead.status || "New");
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedLead || !selectedStatus) return;

    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API}/driver-onboarding/leads/${selectedLead.id}`,
        { status: selectedStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Status updated successfully!");
      setStatusDialogOpen(false);
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update status");
    }
  };

  const openLeadDetails = async (lead) => {
    try {
      // Always fetch fresh lead data to ensure we have latest remarks
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/driver-onboarding/leads/${lead.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const freshLead = response.data;
      setSelectedLead(freshLead);
      setEditedLead({...freshLead}); // Create a copy for editing with fresh data
    } catch (error) {
      // If fetch fails, use the lead from array as fallback
      console.error("Failed to fetch fresh lead data:", error);
      setSelectedLead(lead);
      setEditedLead({...lead});
    }
    
    setIsEditMode(false);
    setDetailsDialogOpen(true);
    // Fetch document status for the lead
    await fetchDocumentsStatus(lead.id);
  };
  
  const handleFieldChange = (fieldName, value) => {
    setEditedLead(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };
  
  const handleSaveLeadDetails = async () => {
    if (!editedLead) return;
    
    setUpdating(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.patch(
        `${API}/driver-onboarding/leads/${editedLead.id}`,
        {
          name: editedLead.name,
          phone_number: editedLead.phone_number,
          vehicle: editedLead.vehicle,
          driving_license: editedLead.driving_license,
          experience: editedLead.experience,
          interested_ev: editedLead.interested_ev,
          monthly_salary: editedLead.monthly_salary,
          current_location: editedLead.current_location,
          status: editedLead.status,
          stage: editedLead.stage,
          remarks: editedLead.remarks,
          dl_no: editedLead.dl_no,
          badge_no: editedLead.badge_no,
          aadhar_card: editedLead.aadhar_card,
          pan_card: editedLead.pan_card,
          gas_bill: editedLead.gas_bill,
          bank_passbook: editedLead.bank_passbook
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Lead details updated successfully!");
      
      // Update local state with fresh data from response
      const updatedLead = response.data.lead;
      
      // Update the leads array immediately with the fresh data
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === updatedLead.id ? updatedLead : lead
        )
      );
      
      // Update selected lead and edited lead with fresh data
      setSelectedLead(updatedLead);
      setEditedLead({...updatedLead});
      setIsEditMode(false);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update lead");
    } finally {
      setUpdating(false);
    }
  };
  
  // Fetch documents status for a lead
  const fetchDocumentsStatus = async (leadId = null) => {
    const idToUse = leadId || selectedLead?.id;
    if (!idToUse) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/driver-onboarding/documents/status/${idToUse}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        const docsStatus = {};
        Object.keys(response.data.documents).forEach(docType => {
          docsStatus[docType] = response.data.documents[docType].uploaded;
        });
        setUploadedDocs(docsStatus);
      }
    } catch (error) {
      console.error("Failed to fetch documents status:", error);
    }
  };
  
  // Handle document upload
  const handleDocumentUpload = async (documentType, file) => {
    if (!file) return;
    
    setUploadingDoc(documentType);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(
        `${API}/driver-onboarding/upload-document/${selectedLead.id}?document_type=${documentType}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success) {
        toast.success(`${documentType.toUpperCase()} uploaded successfully!`);
        setUploadedDocs(prev => ({ ...prev, [documentType]: true }));
        // Refresh document status
        await fetchDocumentsStatus();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to upload ${documentType}`);
    } finally {
      setUploadingDoc(null);
    }
  };
  
  // View document
  const handleViewDocument = async (documentType) => {
    try {
      const token = localStorage.getItem("token");
      const url = `${API}/driver-onboarding/document/${selectedLead.id}/${documentType}`;
      
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create a blob URL and open in new tab
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      
      // Clean up the blob URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to view ${documentType}`);
    }
  };
  
  // Download document
  const handleDownloadDocument = async (documentType) => {
    try {
      const token = localStorage.getItem("token");
      const url = `${API}/driver-onboarding/document/${selectedLead.id}/${documentType}`;
      
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${selectedLead.name || 'lead'}_${documentType}.${getFileExtension(response)}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success(`${documentType.toUpperCase()} downloaded successfully!`);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to download ${documentType}`);
    }
  };
  
  // Delete document
  const handleDeleteDocument = async (documentType) => {
    if (!window.confirm(`Are you sure you want to delete the ${documentType.toUpperCase()} document?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `${API}/driver-onboarding/document/${selectedLead.id}/${documentType}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        toast.success(`${documentType.toUpperCase()} deleted successfully!`);
        setUploadedDocs(prev => ({ ...prev, [documentType]: false }));
        // Refresh document status
        await fetchDocumentsStatus();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to delete ${documentType}`);
    }
  };
  
  // Helper to get file extension from response
  const getFileExtension = (response) => {
    const contentType = response.headers['content-type'];
    if (contentType?.includes('pdf')) return 'pdf';
    if (contentType?.includes('png')) return 'png';
    if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
    return 'file';
  };

  const isHighPriority = (lead) => {
    return lead.status === "Highly Interested" || lead.status === "Call back 1D";
  };

  const isNewLead = (lead) => {
    return lead.status === "New";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading leads...</p>
        </div>
      </div>
    );
  }

  if (leads.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {isAdmin ? "No leads assigned to this telecaller" : "No leads assigned yet"}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
          {isAdmin 
            ? "This telecaller doesn't have any leads assigned. Try selecting a different telecaller."
            : "You don't have any leads assigned. Please contact your admin."
          }
        </p>
        {isAdmin && telecallers.length > 0 && (
          <div className="w-full max-w-md mb-4">
            <Select value={selectedTelecaller} onValueChange={handleTelecallerChange}>
              <SelectTrigger className="w-full dark:bg-gray-800 dark:border-gray-700">
                <SelectValue placeholder="Select a telecaller" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {telecallers.map((telecaller) => (
                  <SelectItem key={telecaller.id} value={telecaller.id}>
                    {telecaller.name} ({telecaller.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button 
          onClick={isAdmin ? () => fetchLeadsForTelecaller(selectedTelecaller) : fetchLeads} 
          variant="outline"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-20">
      {/* Header */}
      <div className="mb-4 sticky top-0 bg-gray-50 dark:bg-gray-900 z-10 py-2">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAdmin ? "Telecaller's Desk" : "My Leads"}
          </h1>
          <Button 
            onClick={isAdmin ? () => fetchLeadsForTelecaller(selectedTelecaller) : fetchLeads} 
            variant="outline" 
            size="sm"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Telecaller Selector for Admins */}
        {isAdmin && telecallers.length > 0 && (
          <div className="mb-3">
            <Select value={selectedTelecaller} onValueChange={handleTelecallerChange}>
              <SelectTrigger className="w-full dark:bg-gray-800 dark:border-gray-700">
                <SelectValue placeholder="Select a telecaller" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {telecallers.map((telecaller) => (
                  <SelectItem key={telecaller.id} value={telecaller.id}>
                    {telecaller.name} ({telecaller.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {leads.length} leads assigned
          {isAdmin && selectedTelecaller && telecallers.length > 0 && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              • Viewing: {telecallers.find(t => t.id === selectedTelecaller)?.name}'s desk
            </span>
          )}
        </p>
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {leads.map((lead, index) => (
          <Card
            key={lead.id}
            className="relative overflow-hidden border-2 hover:shadow-md transition-shadow"
          >
            {/* High Priority Tag */}
            {isHighPriority(lead) && (
              <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                High Priority
              </div>
            )}

            <CardContent className="p-4">
              {/* Lead Info */}
              <div className="mb-3">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white pr-20">
                    {index + 1}. {lead.name}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {lead.phone_number}
                </p>
                {isNewLead(lead) && (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                    New
                  </Badge>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleCall(lead)}
                  className="flex-1 min-w-[100px] bg-green-500 hover:bg-green-600 text-white"
                  size="sm"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Call
                </Button>
                <Button
                  onClick={() => handleWhatsApp(lead)}
                  className="flex-1 min-w-[100px] bg-green-500 hover:bg-green-600 text-white"
                  size="sm"
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  WhatsApp
                </Button>
                <Button
                  onClick={() => openStatusDialog(lead)}
                  variant="outline"
                  className="flex-1 min-w-[100px] border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  size="sm"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Status
                </Button>
              </div>

              {/* View Details Link */}
              <button
                onClick={() => openLeadDetails(lead)}
                className="w-full mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-center"
              >
                View Full Details →
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {selectedLead?.name}
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900">
                    S1 - Filtering
                  </div>
                  {S1_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                    S2 - Docs Collection
                  </div>
                  {S2_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                    S3 - Training
                  </div>
                  {S3_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                    S4 - Customer Readiness
                  </div>
                  {S4_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} className="bg-blue-600 hover:bg-blue-700">
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Details Dialog */}
      <LeadDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={(open) => {
          setDetailsDialogOpen(open);
          if (!open) {
            setIsEditMode(false);
            setUploadedDocs({});
          }
        }}
        lead={selectedLead}
        editedLead={editedLead}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        onFieldChange={handleFieldChange}
        onSave={handleSaveLeadDetails}
        onStageSync={() => {}}
        uploadedDocs={uploadedDocs}
        onDocumentUpload={handleDocumentUpload}
        onViewDocument={handleViewDocument}
        onDownloadDocument={handleDownloadDocument}
        onDeleteDocument={handleDeleteDocument}
        onDocumentScan={null}
        uploadingDoc={uploadingDoc}
        scanningDoc={scanningDoc}
        updating={updating}
        showDeleteButton={false}
        onDelete={() => {}}
        hasUnsavedChanges={false}
        onLeadUpdate={fetchLeads}
      />
    </div>
  );
};

export default TelecallerDeskMobile;
