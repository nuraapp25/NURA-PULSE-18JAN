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
  
  // State for LeadDetailsDialog
  const [editedLead, setEditedLead] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Document management state
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [scanningDoc, setScanningDoc] = useState(null);

  useEffect(() => {
    fetchLeads();
  }, []);

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

  const openLeadDetails = (lead) => {
    setSelectedLead(lead);
    setEditedLead({...lead});
    setIsEditMode(false);
    setDetailsDialogOpen(true);
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
      setIsEditMode(false);
      fetchLeads(); // Refresh leads list
      setDetailsDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update lead");
    } finally {
      setUpdating(false);
    }
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

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No leads assigned yet</h2>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
          You don't have any leads assigned. Please contact your admin.
        </p>
        <Button onClick={fetchLeads} variant="outline">
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Leads</h1>
          <Button onClick={fetchLeads} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{leads.length} leads assigned</p>
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
          }
        }}
        lead={selectedLead}
        editedLead={editedLead}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        onFieldChange={handleFieldChange}
        onSave={handleSaveLeadDetails}
        onStageSync={() => {}}
        uploadedDocs={{}}
        onDocumentUpload={() => {}}
        onViewDocument={() => {}}
        onDownloadDocument={() => {}}
        onDeleteDocument={() => {}}
        onDocumentScan={() => {}}
        uploadingDoc={null}
        scanningDoc={null}
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
