import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Phone, RefreshCw, FileText, Save } from "lucide-react";

// Status options grouped by stage
const S1_STATUSES = [
  { value: "New", label: "New" },
  { value: "Not Interested", label: "Not Interested" },
  { value: "Interested, No DL", label: "Interested, No DL" },
  { value: "Highly Interested", label: "Highly Interested" },
  { value: "Call back 1D", label: "Call back 1D" },
  { value: "Call back 1W", label: "Call back 1W" },
  { value: "Call back 2W", label: "Call back 2W" },
  { value: "Call back 1M", label: "Call back 1M" },
  { value: "Interested", label: "Interested" },
  { value: "Not Reachable", label: "Not Reachable" },
  { value: "Wrong Number", label: "Wrong Number" },
  { value: "Duplicate", label: "Duplicate" },
  { value: "Junk", label: "Junk" },
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

const TelecallerDesk = () => {
  const { user } = useAuth();
  const [myLeads, setMyLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [updatingLead, setUpdatingLead] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    status: "",
    telecaller_notes: "",
    notes: ""
  });

  useEffect(() => {
    fetchMyLeads();
  }, []);

  const fetchMyLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/driver-onboarding/leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter only leads assigned to current user (by email)
      const assignedLeads = response.data.filter(
        lead => lead.assigned_telecaller === user?.email
      );
      setMyLeads(assignedLeads);
    } catch (error) {
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
    setFormData({
      status: lead.status || "",
      telecaller_notes: lead.telecaller_notes || "",
      notes: lead.notes || ""
    });
    setDetailDialogOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;

    setUpdatingLead(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API}/driver-onboarding/leads/${selectedLead.id}`,
        {
          status: formData.status,
          telecaller_notes: formData.telecaller_notes,
          notes: formData.notes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Lead updated successfully!");
      setDetailDialogOpen(false);
      fetchMyLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update lead");
    } finally {
      setUpdatingLead(false);
    }
  };

  const getStatusColor = (status) => {
    const statusObj = ALL_STATUSES.find(s => s.value === status);
    if (!statusObj) return "bg-gray-100 text-gray-700";
    
    // Green for completion statuses
    if (["Highly Interested", "Verified", "Approved", "DONE!"].includes(status)) {
      return "bg-green-100 text-green-700";
    }
    // Yellow for pending/new
    if (status.includes("Pending") || status === "New") {
      return "bg-yellow-100 text-yellow-700";
    }
    // Red for rejected/terminated
    if (status.includes("Rejected") || status === "Terminated") {
      return "bg-red-100 text-red-700";
    }
    // Blue for callbacks
    if (status.includes("Call back")) {
      return "bg-blue-100 text-blue-700";
    }
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Telecaller's Desk</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your assigned leads
          </p>
        </div>
        <Button onClick={fetchMyLeads} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{myLeads.length}</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {myLeads.filter(l => l.status === "New" || l.status.includes("Call back")).length}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending Contact</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {myLeads.filter(l => l.status === "Highly Interested" || l.status === "Verified").length}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {myLeads.filter(l => l.status === "DONE!").length}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Leads ({myLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : myLeads.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No leads assigned yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">S. No.</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Last Contact</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myLeads.map((lead, index) => (
                    <tr 
                      key={lead.id} 
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{index + 1}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">{lead.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        <a href={`tel:${lead.phone_number}`} className="flex items-center gap-1 hover:text-blue-600">
                          <Phone className="w-3 h-3" />
                          {lead.phone_number}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(lead.status)}`}>
                          {lead.status || "New"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {lead.last_modified ? new Date(lead.last_modified).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLeadClick(lead)}
                        >
                          Update
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

      {/* Lead Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Lead - {selectedLead?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Lead Info (Read-only) */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded">
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Phone Number</Label>
                <p className="text-sm font-medium">{selectedLead?.phone_number}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Email</Label>
                <p className="text-sm font-medium">{selectedLead?.email || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Experience</Label>
                <p className="text-sm font-medium">{selectedLead?.experience || "-"}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Location</Label>
                <p className="text-sm font-medium">{selectedLead?.current_location || "-"}</p>
              </div>
            </div>

            {/* Editable Fields */}
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {/* S1 - Filtering */}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900">
                    S1 - Filtering
                  </div>
                  {S1_STATUSES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                  {/* S2 - Docs Collection */}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                    S2 - Docs Collection
                  </div>
                  {S2_STATUSES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                  {/* S3 - Training */}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                    S3 - Training
                  </div>
                  {S3_STATUSES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                  {/* S4 - Customer Readiness */}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                    S4 - Customer Readiness
                  </div>
                  {S4_STATUSES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Telecaller Notes</Label>
              <Textarea
                value={formData.telecaller_notes}
                onChange={(e) => setFormData({ ...formData, telecaller_notes: e.target.value })}
                placeholder="Add your notes here..."
                rows={3}
              />
            </div>

            <div>
              <Label>General Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add general notes..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateLead} disabled={updatingLead}>
                <Save className="w-4 h-4 mr-2" />
                {updatingLead ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TelecallerDesk;
