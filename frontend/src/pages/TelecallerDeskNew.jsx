import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Phone, MessageCircle, CheckCircle, RefreshCw, AlertCircle, User, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Calendar, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
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
  { value: "Terminated", label: "Terminated" },
];

const ALL_STATUSES = [...S1_STATUSES, ...S2_STATUSES, ...S3_STATUSES, ...S4_STATUSES];

const TelecallerDeskNew = () => {
  const { user } = useAuth();
  
  // Core state
  const [assignedLeads, setAssignedLeads] = useState([]);
  const [callbackLeads, setCallbackLeads] = useState([]);
  const [allLeads, setAllLeads] = useState([]); // All leads for counting
  const [loading, setLoading] = useState(false);
  
  // Admin/telecaller selection
  const isAdmin = user?.account_type === "master_admin" || user?.account_type === "admin";
  const [telecallers, setTelecallers] = useState([]);
  const [selectedTelecaller, setSelectedTelecaller] = useState("");
  
  // Date selector state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateScrollIndex, setDateScrollIndex] = useState(0);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Summary statistics
  const [stats, setStats] = useState({
    total: 0,
    callsDone: 0,
    callsPending: 0,
    callbacks: 0
  });
  
  // Collapsible sections
  const [isCallingDoneExpanded, setIsCallingDoneExpanded] = useState(true);
  
  // Lead details dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editedLead, setEditedLead] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Generate date range (7 days before to 14 days after today)
  const generateDateRange = () => {
    const dates = [];
    const today = new Date();
    for (let i = -7; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };
  
  const dateRange = generateDateRange();
  
  // Get initial scroll index to center on today
  const getInitialScrollIndex = () => {
    const todayIndex = 7;
    return Math.max(0, todayIndex - 2);
  };
  
  useEffect(() => {
    setDateScrollIndex(getInitialScrollIndex());
  }, []);
  
  // Scroll date selector
  const scrollDatesLeft = () => {
    setDateScrollIndex(Math.max(0, dateScrollIndex - 1));
  };
  
  const scrollDatesRight = () => {
    setDateScrollIndex(Math.min(dateRange.length - 5, dateScrollIndex + 1));
  };
  
  // Fetch telecallers for admin
  const fetchTelecallers = async () => {
    if (!isAdmin) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/users/telecallers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTelecallers(response.data || []);
    } catch (error) {
      console.error("Error fetching telecallers:", error);
      toast.error("Failed to load telecallers");
    }
  };
  
  // Fetch all leads (for counting by date)
  const fetchAllLeads = async (telecallerEmail) => {
    if (!telecallerEmail) return;
    
    try {
      const token = localStorage.getItem("token");
      console.log("🔍 Fetching all leads for counting:", telecallerEmail);
      const response = await axios.get(`${API}/telecaller-desk/leads`, {
        params: {
          telecaller_email: telecallerEmail
          // No date filter - get all leads
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log("📦 All leads response:", response.data);
      
      if (response.data.success) {
        // When no date filter, backend returns all leads in assigned_leads
        const allLeadsList = response.data.assigned_leads || [];
        console.log("✅ Setting allLeads:", allLeadsList.length, "leads");
        setAllLeads(allLeadsList);
      }
    } catch (error) {
      console.error("❌ Error fetching all leads:", error);
    }
  };
  
  // Fetch leads for selected date
  const fetchLeadsForDate = async (telecallerEmail) => {
    if (!telecallerEmail) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/telecaller-desk/leads`, {
        params: {
          telecaller_email: telecallerEmail,
          date: selectedDate
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setAssignedLeads(response.data.assigned_leads || []);
        setCallbackLeads(response.data.callback_leads || []);
        calculateStats(response.data.assigned_leads || [], response.data.callback_leads || []);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to load leads");
      setAssignedLeads([]);
      setCallbackLeads([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Count leads for a specific date
  const getLeadCountForDate = (dateStr) => {
    const count = allLeads.filter(lead => {
      // Check assigned_date
      if (lead.assigned_date) {
        try {
          const assignedDate = parseISO(lead.assigned_date);
          const formattedDate = format(assignedDate, 'yyyy-MM-dd');
          if (formattedDate === dateStr) {
            return true;
          }
        } catch (e) {
          console.log("Error parsing assigned_date:", lead.assigned_date, e);
        }
      }
      
      // Check callback_date
      if (lead.callback_date) {
        try {
          const callbackDate = parseISO(lead.callback_date);
          const formattedDate = format(callbackDate, 'yyyy-MM-dd');
          if (formattedDate === dateStr) {
            return true;
          }
        } catch (e) {
          console.log("Error parsing callback_date:", lead.callback_date, e);
        }
      }
      
      return false;
    }).length;
    
    if (count > 0) {
      console.log(`📊 Date ${dateStr}: ${count} leads`);
    }
    
    return count;
  };
  
  // Calculate statistics
  const calculateStats = (assigned, callbacks) => {
    const allLeads = [...assigned, ...callbacks];
    const today = new Date().toISOString().split('T')[0];
    
    const callsDone = allLeads.filter(lead => {
      const lastCalled = lead.last_called;
      if (!lastCalled) return false;
      try {
        const callDate = parseISO(lastCalled);
        return format(callDate, 'yyyy-MM-dd') === today;
      } catch {
        return false;
      }
    }).length;
    
    const total = allLeads.length;
    const callsPending = total - callsDone;
    const callbackCount = callbacks.length;
    
    setStats({
      total,
      callsDone,
      callsPending,
      callbacks: callbackCount
    });
  };
  
  // Initial load
  useEffect(() => {
    const loadData = async () => {
      if (isAdmin) {
        await fetchTelecallers();
      } else {
        await fetchAllLeads(user?.email); // Fetch all leads for counting
        await fetchLeadsForDate(user?.email);
      }
    };
    
    loadData();
  }, []);
  
  // Refetch when date changes
  useEffect(() => {
    const email = isAdmin ? selectedTelecaller : user?.email;
    if (email) {
      fetchLeadsForDate(email);
    }
  }, [selectedDate]);
  
  // Handle View Desk button click (admin only)
  const handleViewDesk = async () => {
    if (!selectedTelecaller) {
      toast.error("Please select a telecaller first");
      return;
    }
    
    // Fetch all leads first for counting, then fetch filtered leads
    await fetchAllLeads(selectedTelecaller);
    await fetchLeadsForDate(selectedTelecaller);
  };
  
  // Filter leads by search query
  const filterLeadsBySearch = (leads) => {
    if (!searchQuery.trim()) return leads;
    
    const query = searchQuery.toLowerCase();
    return leads.filter(lead => {
      const name = (lead.name || "").toLowerCase();
      const phone = (lead.phone_number || "").toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  };
  
  // Separate leads into called/not called based on selected date
  const separateLeadsByCalled = (leads) => {
    const notCalled = [];
    const called = [];
    
    leads.forEach(lead => {
      if (lead.last_called) {
        try {
          const callDate = parseISO(lead.last_called);
          const callDateStr = format(callDate, 'yyyy-MM-dd');
          
          // If called on the selected date, move to "calling done"
          if (callDateStr === selectedDate) {
            called.push(lead);
          } else {
            notCalled.push(lead);
          }
        } catch {
          notCalled.push(lead);
        }
      } else {
        notCalled.push(lead);
      }
    });
    
    return { notCalled, called };
  };
  
  const { notCalled: assignedNotCalled, called: assignedCalled } = separateLeadsByCalled(assignedLeads);
  const { notCalled: callbackNotCalled, called: callbackCalled } = separateLeadsByCalled(callbackLeads);
  
  const filteredAssignedLeads = filterLeadsBySearch(assignedNotCalled);
  const filteredCallbackLeads = filterLeadsBySearch(callbackNotCalled);
  const filteredCallingDoneLeads = filterLeadsBySearch([...assignedCalled, ...callbackCalled]);
  
  // Format date to DD-MM-YYYY
  const formatDateDDMMYYYY = (isoDate) => {
    if (!isoDate) return "N/A";
    try {
      const date = parseISO(isoDate);
      return format(date, 'dd-MM-yyyy');
    } catch {
      return "Invalid Date";
    }
  };
  // Lead details dialog handlers
  const handleFieldChange = (field, value) => {
    setEditedLead(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = async () => {
    if (!selectedLead) return;

    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.patch(
        `${API}/driver-onboarding/leads/${selectedLead.id}`,
        editedLead,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Lead updated successfully");
      
      // Close dialog and refresh
      setDetailDialogOpen(false);
      setSelectedLead(null);
      setEditedLead({});
      setIsEditMode(false);
      setUploadedDocs({});
      
      // Refresh leads
      const email = isAdmin ? selectedTelecaller : user?.email;
      fetchLeadsForDate(email);
    } catch (error) {
      console.error("Error updating lead:", error);
      toast.error(error.response?.data?.detail || "Failed to update lead");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDocumentUpload = async (docType, file) => {
    setUploadingDoc(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/driver-onboarding/leads/${selectedLead.id}/documents/${docType}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setUploadedDocs(prev => ({
        ...prev,
        [docType]: response.data.file_url
      }));

      toast.success(`${docType} uploaded successfully`);
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error(`Failed to upload ${docType}`);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleViewDocument = async (docType) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/driver-onboarding/leads/${selectedLead.id}/documents/${docType}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.file_url) {
        window.open(response.data.file_url, '_blank');
      }
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("Failed to view document");
    }
  };

  const handleDownloadDocument = async (docType) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/driver-onboarding/leads/${selectedLead.id}/documents/${docType}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedLead.name}_${docType}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Document downloaded");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Failed to download document");
    }
  };

  const handleDeleteDocument = async (docType) => {
    if (!window.confirm(`Are you sure you want to delete ${docType}?`)) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API}/driver-onboarding/leads/${selectedLead.id}/documents/${docType}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUploadedDocs(prev => {
        const updated = { ...prev };
        delete updated[docType];
        return updated;
      });

      toast.success("Document deleted");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };
  
  // Handle call action
  const handleCall = (lead) => {
    // Ensure phone_number is a string and handle null/undefined cases
    const phoneString = String(lead.phone_number || '');
    const phoneNumber = phoneString.replace(/\D/g, '');
    
    if (!phoneNumber) {
      toast.error("No valid phone number available");
      return;
    }
    
    window.location.href = `tel:${phoneNumber}`;
    
    // Mark as called
    markAsCalled(lead.id);
  };
  
  // Handle WhatsApp action
  const handleWhatsApp = (lead) => {
    // Ensure phone_number is a string and handle null/undefined cases
    const phoneString = String(lead.phone_number || '');
    const phoneNumber = phoneString.replace(/\D/g, '');
    
    if (!phoneNumber) {
      toast.error("No valid phone number available");
      return;
    }
    
    const message = encodeURIComponent(`Hi ${lead.name}, I'm calling from Nura regarding your driver application.`);
    window.open(`https://wa.me/91${phoneNumber}?text=${message}`, '_blank');
  };
  
  // Mark lead as called
  const markAsCalled = async (leadId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/driver-onboarding/leads/${leadId}/mark-called`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error("Error marking as called:", error);
    }
  };
  
  // Mark lead as called now (with UI feedback)
  const markAsCalledNow = async (leadId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/driver-onboarding/leads/${leadId}/mark-called`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Lead marked as called");
      
      // Refresh leads
      const email = isAdmin ? selectedTelecaller : user?.email;
      await fetchAllLeads(email);
      await fetchLeadsForDate(email);
      
      // Smooth scroll to "Calling Done" section after a brief delay
      setTimeout(() => {
        const callingDoneSection = document.getElementById('calling-done-section');
        if (callingDoneSection) {
          callingDoneSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    } catch (error) {
      console.error("Error marking as called:", error);
      toast.error("Failed to mark as called");
    }
  };
  
  // Render lead card
  const renderLeadCard = (leadParam, showCallTimestamp = false) => {
    console.log("renderLeadCard called with:", leadParam);
    return (
    <Card key={leadParam.id} className="mb-3 dark:bg-gray-800">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-lg dark:text-white">{leadParam.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{leadParam.phone_number}</p>
            {showCallTimestamp && leadParam.last_called && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Called at {formatDateDDMMYYYY(leadParam.last_called)} {format(parseISO(leadParam.last_called), 'HH:mm:ss')}
              </p>
            )}
          </div>
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {leadParam.status || "New"}
          </Badge>
        </div>
        
        <div className="flex gap-2 mt-3">
          <Button
            onClick={() => handleCall(leadParam)}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call
          </Button>
          <Button
            onClick={() => handleWhatsApp(leadParam)}
            className="flex-1 bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>
          {!showCallTimestamp && (
            <Button
              onClick={() => markAsCalledNow(leadParam.id)}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              size="sm"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Called
            </Button>
          )}
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("Status button clicked for leadParam:", leadParam);
              setSelectedLead(leadParam);
              setDetailDialogOpen(true);
              console.log("Dialog should open now, detailDialogOpen set to true");
            }}
            variant="outline"
            size="sm"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Status
          </Button>
        </div>
      </CardContent>
    </Card>
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Telecaller's Desk
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isAdmin ? "View and manage telecaller leads" : "Your assigned leads for today"}
          </p>
        </div>
        
        {/* Admin: Telecaller Selector */}
        {isAdmin && telecallers.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-2">
              <Select value={selectedTelecaller || ""} onValueChange={setSelectedTelecaller}>
                <SelectTrigger className="flex-1 dark:bg-gray-800 dark:border-gray-700">
                  <SelectValue placeholder="Select a telecaller" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  {telecallers.map((telecaller) => (
                    <SelectItem key={telecaller.email} value={telecaller.email}>
                      {telecaller.name ? telecaller.name.split(' ')[0] : telecaller.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleViewDesk}
                disabled={!selectedTelecaller}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
              >
                <User className="w-4 h-4 mr-2" />
                View Desk
              </Button>
            </div>
            {selectedTelecaller && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Viewing desk for: {telecallers.find(t => t.email === selectedTelecaller)?.name || selectedTelecaller}
              </p>
            )}
          </div>
        )}
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Card className="dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Leads</div>
              <div className="text-2xl font-bold dark:text-white">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Calls Done</div>
              <div className="text-2xl font-bold text-green-600">{stats.callsDone}</div>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Calls Pending</div>
              <div className="text-2xl font-bold text-orange-600">{stats.callsPending}</div>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Callbacks</div>
              <div className="text-2xl font-bold text-blue-600">{stats.callbacks}</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Date Selector */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={scrollDatesLeft}
              disabled={dateScrollIndex === 0}
              variant="outline"
              size="sm"
              className="p-2 dark:bg-gray-800 dark:border-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex-1 overflow-hidden">
              <div className="flex gap-2">
                {dateRange.slice(dateScrollIndex, dateScrollIndex + 5).map((dateStr) => {
                  const date = new Date(dateStr);
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === new Date().toISOString().split('T')[0];
                  const dayName = format(date, 'EEE');
                  const monthDay = format(date, 'MMM d');
                  
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`flex-1 min-w-[70px] p-2 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : isToday
                          ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                          : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                      }`}
                    >
                      <div className="text-xs font-medium">{dayName}</div>
                      <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {monthDay}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <Button
              onClick={scrollDatesRight}
              disabled={dateScrollIndex >= dateRange.length - 5}
              variant="outline"
              size="sm"
              className="p-2 dark:bg-gray-800 dark:border-gray-700"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          {selectedDate && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Showing leads for {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
              </p>
              <Button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                Reset to Today
              </Button>
            </div>
          )}
        </div>
        
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone number..."
              className="pl-10 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
        </div>
        
        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading leads...</p>
          </div>
        )}
        
        {/* Leads Display */}
        {!loading && (
          <>
            {/* Assigned Leads Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Assigned for {format(new Date(selectedDate), 'MMM d, yyyy')} ({filteredAssignedLeads.length})
              </h2>
              {filteredAssignedLeads.length === 0 ? (
                <Card className="dark:bg-gray-800">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No leads assigned for this date
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredAssignedLeads.map(lead => renderLeadCard(lead, false))
              )}
            </div>
            
            {/* Callback Leads Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Callbacks for {format(new Date(selectedDate), 'MMM d, yyyy')} ({filteredCallbackLeads.length})
              </h2>
              {filteredCallbackLeads.length === 0 ? (
                <Card className="dark:bg-gray-800">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No callbacks scheduled for this date
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredCallbackLeads.map(lead => renderLeadCard(lead, false))
              )}
            </div>
            
            {/* Visual Separator */}
            <div className="my-8 border-t-4 border-green-500 dark:border-green-600"></div>
            
            {/* Calling Done Section */}
            <div id="calling-done-section" className="scroll-mt-4">
              <div 
                className="flex items-center justify-between mb-3 cursor-pointer p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                onClick={() => setIsCallingDoneExpanded(!isCallingDoneExpanded)}
              >
                <h2 className="text-lg font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Calling Done ({filteredCallingDoneLeads.length})
                </h2>
                {isCallingDoneExpanded ? (
                  <ChevronUp className="w-5 h-5 text-green-700 dark:text-green-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-green-700 dark:text-green-400" />
                )}
              </div>
              
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                isCallingDoneExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                {filteredCallingDoneLeads.length === 0 ? (
                  <Card className="dark:bg-gray-800 mt-3">
                    <CardContent className="p-6 text-center">
                      <CheckCircle className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-600 dark:text-gray-400">
                        No calls completed yet for this date
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3 mt-3">
                    {filteredCallingDoneLeads.map(lead => renderLeadCard(lead, true))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        
        {/* Lead Details Dialog */}
        <LeadDetailsDialog
          open={detailDialogOpen}
          onOpenChange={(open) => {
            setDetailDialogOpen(open);
            if (!open) {
              setIsEditMode(false);
              setUploadedDocs({});
              setEditedLead({});
              setSelectedLead(null);
            }
          }}
          lead={selectedLead}
          editedLead={editedLead}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          onFieldChange={handleFieldChange}
          onSave={handleSaveChanges}
          onStageSync={() => {}}
          uploadedDocs={uploadedDocs}
          onDocumentUpload={handleDocumentUpload}
          onViewDocument={handleViewDocument}
          onDownloadDocument={handleDownloadDocument}
          onDeleteDocument={handleDeleteDocument}
          onDocumentScan={null}
          uploadingDoc={uploadingDoc}
          scanningDoc={null}
          updating={updatingStatus}
          showDeleteButton={false}
          onDelete={() => {}}
        />
      </div>
    </div>
  );
};

export default TelecallerDeskNew;
