import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, Users, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "Contacted", label: "Contacted", icon: Phone, color: "bg-yellow-100 text-yellow-700" },
  { value: "Interested", label: "Interested", icon: CheckCircle, color: "bg-purple-100 text-purple-700" },
  { value: "Not Interested", label: "Not Interested", icon: XCircle, color: "bg-gray-100 text-gray-700" },
  { value: "Scheduled", label: "Scheduled", icon: Clock, color: "bg-indigo-100 text-indigo-700" },
  { value: "Documents Pending", label: "Documents Pending", icon: AlertCircle, color: "bg-orange-100 text-orange-700" },
];

const TelecallerQueuePage = () => {
  const [assignments, setAssignments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedTelecaller, setSelectedTelecaller] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/telecaller-queue/daily-assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssignments(response.data);
    } catch (error) {
      toast.error("Failed to fetch assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleCallClick = (phoneNumber) => {
    // Open phone's calling app
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleWhatsAppClick = (phoneNumber) => {
    // Open WhatsApp chat
    // Format: Remove any spaces or special characters
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/91${cleanPhone}`, '_blank');
  };

  const handleOpenStatusDialog = (lead, telecaller) => {
    setSelectedLead(lead);
    setSelectedTelecaller(telecaller);
    setNewStatus(lead.status || "");
    setNotes("");
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) {
      toast.error("Please select a status");
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/telecaller-queue/update-call-status`,
        null,
        {
          params: {
            lead_id: selectedLead.id,
            call_outcome: newStatus,
            notes: notes
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success("Status updated successfully!");
      setStatusDialogOpen(false);
      
      // Refresh assignments
      await fetchAssignments();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const getPriorityBadge = (status) => {
    const highPriority = ["New", "Interested", "Scheduled"];
    const mediumPriority = ["Contacted", "Documents Pending"];
    
    if (highPriority.includes(status)) {
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30">High Priority</Badge>;
    } else if (mediumPriority.includes(status)) {
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30">Medium Priority</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30">Low Priority</Badge>;
  };

  const getStatusColor = (status) => {
    const statusMap = {
      "New": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      "Contacted": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      "Interested": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      "Documents Pending": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      "Scheduled": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
      "Not Interested": "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return statusMap[status] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="telecaller-queue-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Telecaller's Desk</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Daily lead assignments and call management</p>
        </div>
        <Button
          onClick={fetchAssignments}
          variant="outline"
          className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          <RefreshCw size={18} className="mr-2" />
          Refresh
        </Button>
      </div>

      {/* Assignment Info */}
      {assignments && (
        <Card className="dark:bg-gray-800 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Users className="text-blue-600" size={32} />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Leads Assigned Today</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{assignments.total_assigned}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Assignment Date</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(assignments.assignment_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calling Framework Info */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">📞 Calling Framework</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Badge className="bg-red-100 text-red-700 mt-1">High Priority</Badge>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">New, Interested, Scheduled</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Call immediately - Hot leads or appointments</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Badge className="bg-yellow-100 text-yellow-700 mt-1">Medium Priority</Badge>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Contacted, Documents Pending</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Follow-up calls and reminders</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Badge className="bg-blue-100 text-blue-700 mt-1">Low Priority</Badge>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Not Interested</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Revisit after some time</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telecaller Assignments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telecaller 1 */}
        {assignments?.telecaller1 && (
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
                <div className="flex items-center">
                  <Phone className="mr-2 text-blue-600" size={20} />
                  {assignments.telecaller1.name}
                </div>
                <Badge className="bg-blue-600 text-white">{assignments.telecaller1.count} Leads</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {assignments.telecaller1.leads.map((lead, index) => (
                  <div
                    key={lead.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {index + 1}. {lead.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{lead.phone_number}</p>
                        {lead.current_location && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            📍 {lead.current_location}
                          </p>
                        )}
                      </div>
                      {getPriorityBadge(lead.status)}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(lead.status)}`}>
                        {lead.status || "New"}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => handleCallClick(lead.phone_number)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Phone size={14} className="mr-1" />
                        Call
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleWhatsAppClick(lead.phone_number)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Phone size={14} className="mr-1" />
                        WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenStatusDialog(lead, "Telecaller 1")}
                        variant="outline"
                        className="border-blue-500 text-blue-600"
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Status
                      </Button>
                    </div>
                  </div>
                ))}
                {assignments.telecaller1.leads.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No leads assigned for today
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Telecaller 2 */}
        {assignments?.telecaller2 && (
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
                <div className="flex items-center">
                  <Phone className="mr-2 text-green-600" size={20} />
                  {assignments.telecaller2.name}
                </div>
                <Badge className="bg-green-600 text-white">{assignments.telecaller2.count} Leads</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {assignments.telecaller2.leads.map((lead, index) => (
                  <div
                    key={lead.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {index + 1}. {lead.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{lead.phone_number}</p>
                        {lead.current_location && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            📍 {lead.current_location}
                          </p>
                        )}
                      </div>
                      {getPriorityBadge(lead.status)}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(lead.status)}`}>
                        {lead.status || "New"}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => handleCallClick(lead.phone_number)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Phone size={14} className="mr-1" />
                        Call
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleWhatsAppClick(lead.phone_number)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Phone size={14} className="mr-1" />
                        WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenStatusDialog(lead, "Telecaller 2")}
                        variant="outline"
                        className="border-green-500 text-green-600"
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Status
                      </Button>
                    </div>
                  </div>
                ))}
                {assignments.telecaller2.leads.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No leads assigned for today
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Call Status Update Dialog */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Update Call Status</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {selectedTelecaller} calling {selectedLead?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Lead Details</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedLead.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedLead.phone_number}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Current Status: <span className={`px-2 py-1 rounded ${getStatusColor(selectedLead.status)}`}>
                    {selectedLead.status}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Select Call Outcome
                </label>
                <Select value={callOutcome} onValueChange={setCallOutcome}>
                  <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Choose outcome..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    {STATUS_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center">
                            <Icon size={16} className="mr-2" />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  onClick={() => setCallDialogOpen(false)}
                  variant="outline"
                  className="dark:border-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateCallStatus}
                  disabled={!callOutcome || updating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {updating ? (
                    <>
                      <RefreshCw size={18} className="mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Status"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TelecallerQueuePage;
