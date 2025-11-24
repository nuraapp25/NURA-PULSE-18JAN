import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Phone, MessageCircle, CheckCircle, RefreshCw, AlertCircle, User, History, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, Search, X } from "lucide-react";
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
  
  // Summary Dashboard state
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  // Status History Dialog state
  const [statusHistoryDialogOpen, setStatusHistoryDialogOpen] = useState(false);
  const [historyLead, setHistoryLead] = useState(null);
  const [showScheduledLeads, setShowScheduledLeads] = useState(true); // For collapsible section
  const [showActiveLeads, setShowActiveLeads] = useState(true); // For collapsible active leads
  const [showPendingLeads, setShowPendingLeads] = useState(true); // For pending from previous days
  
  // NEW: Calendar and Search state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Default to today's date
  const [searchQuery, setSearchQuery] = useState("");
  
  // NEW: Summary card filter state
  const [summaryFilter, setSummaryFilter] = useState(null); // null, 'total', 'calls_done', 'calls_pending', 'callbacks'
  
  // Generate date range (7 days before to 14 days after today)
  const generateDateRange = () => {
    const dates = [];
    const today = new Date();
    
    // 7 days before to 14 days after = 22 days total
    for (let i = -7; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  };
  
  const dateRange = generateDateRange();
  
  // Calculate initial scroll index to center on today (index 7 in the array)
  const getInitialScrollIndex = () => {
    const todayIndex = 7; // Today is at index 7 (after 7 days before)
    // Center it by positioning it at index 2 of the visible 5 dates
    return Math.max(0, todayIndex - 2);
  };
  
  // Date selector scroll state - start with today centered
  const [dateScrollIndex, setDateScrollIndex] = useState(getInitialScrollIndex());
  
  // Count leads for each date
  const getLeadCountForDate = (dateStr) => {
    return leads.filter(lead => {
      const leadAssignedDate = lead.assigned_date ? lead.assigned_date.split('T')[0] : null;
      const leadCallbackDate = lead.callback_date ? lead.callback_date.split('T')[0] : null;
      
      // Count lead if assigned on this date OR has callback on this date
      return leadAssignedDate === dateStr || leadCallbackDate === dateStr;
    }).length;
  };
  
  // Navigate dates
  const scrollDatesLeft = () => {
    setDateScrollIndex(Math.max(0, dateScrollIndex - 1));
  };
  
  const scrollDatesRight = () => {
    setDateScrollIndex(Math.min(dateRange.length - 5, dateScrollIndex + 1));
  };
  
  // Filter leads based on date, search query, and summary card filter
  const getFilteredLeads = (leadsArray) => {
    console.log("🔎 Filtering", leadsArray.length, "leads. Selected date:", selectedDate);
    let filtered = [...leadsArray];
    
    // Filter by selected date - show leads assigned on that date + callback leads scheduled for that date
    if (selectedDate) {
      filtered = filtered.filter(lead => {
        const leadAssignedDate = lead.assigned_date ? lead.assigned_date.split('T')[0] : null;
        const leadCallbackDate = lead.callback_date ? lead.callback_date.split('T')[0] : null;
        
        console.log(`  Lead "${lead.name}": assigned_date=${leadAssignedDate}, callback_date=${leadCallbackDate}, selected=${selectedDate}`);
        
        // Show lead if:
        // 1. It was assigned on the selected date, OR
        // 2. It has a callback scheduled for the selected date
        return leadAssignedDate === selectedDate || leadCallbackDate === selectedDate;
      });
      console.log("✅ After date filter:", filtered.length, "leads");
    }
    
    // Filter by search query (phone number or name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(lead => {
        const name = (lead.name || "").toLowerCase();
        const phone = String(lead.phone_number || "").toLowerCase();
        return name.includes(query) || phone.includes(query);
      });
    }
    
    // Filter by summary card selection
    if (summaryFilter === 'calls_done') {
      // Show leads that have been called today
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(lead => {
        const lastCalled = lead.last_called ? lead.last_called.split('T')[0] : null;
        return lastCalled === today;
      });
    } else if (summaryFilter === 'calls_pending') {
      // Show leads that need to be called (not called and not callbacks)
      filtered = filtered.filter(lead => {
        const isCallback = lead.status?.startsWith("Call back");
        return !lead.last_called && !isCallback;
      });
    } else if (summaryFilter === 'callbacks') {
      // Show only callback leads
      filtered = filtered.filter(lead => lead.status?.startsWith("Call back"));
    }
    // summaryFilter === 'total' or null shows all leads (no additional filtering)
    
    return filtered;
  };
  
  // Get pending leads from previous days (unfinished leads assigned before selected date)
  const getPendingFromPreviousDays = () => {
    if (!selectedDate) return [];
    
    return leads.filter(lead => {
      const leadAssignedDate = lead.assigned_date ? lead.assigned_date.split('T')[0] : null;
      const leadCallbackDate = lead.callback_date ? lead.callback_date.split('T')[0] : null;
      
      // Show if:
      // 1. Assigned before selected date AND
      // 2. Not a completed lead (status not "Converted" or "Not interested") AND
      // 3. Not showing up in current date's callbacks
      const isAssignedBeforeSelectedDate = leadAssignedDate && leadAssignedDate < selectedDate;
      const isNotCompleted = !["S4 - Converted", "S1 - Not interested"].includes(lead.status);
      const isNotScheduledForToday = leadCallbackDate !== selectedDate;
      
      return isAssignedBeforeSelectedDate && isNotCompleted && isNotScheduledForToday;
    });
  };
  
  // Apply filters to active and scheduled leads
  const filteredActiveLeads = getFilteredLeads(leads.filter(lead => !lead.status?.startsWith("Call back")));
  const filteredScheduledLeads = getFilteredLeads(leads.filter(lead => lead.status?.startsWith("Call back")));
  
  // Separate leads into active and scheduled (using filtered leads now)
  const activeLeads = filteredActiveLeads;
  const scheduledLeads = filteredScheduledLeads;
  
  // Group scheduled leads by callback date
  const groupedScheduledLeads = () => {
    const today = new Date().toISOString().split('T')[0];
    const groups = {
      dueToday: [],
      upcoming: {}
    };
    
    scheduledLeads.forEach(lead => {
      if (lead.callback_date) {
        const callbackDate = new Date(lead.callback_date).toISOString().split('T')[0];
        if (callbackDate === today) {
          groups.dueToday.push(lead);
        } else {
          if (!groups.upcoming[callbackDate]) {
            groups.upcoming[callbackDate] = [];
          }
          groups.upcoming[callbackDate].push(lead);
        }
      }
    });
    
    return groups;
  };

  useEffect(() => {
    if (isAdmin) {
      fetchTelecallers();
    } else {
      fetchLeads();
      // Fetch summary after a short delay to prioritize leads loading
      setTimeout(() => fetchSummary(), 100);
    }
  }, []);
  
  // Fetch summary dashboard data with optimization
  const fetchSummary = async (telecallerEmail = null) => {
    try {
      setLoadingSummary(true);
      const token = localStorage.getItem("token");
      const email = telecallerEmail || (isAdmin ? selectedTelecaller : user.email);
      
      if (!email) {
        setLoadingSummary(false);
        return;
      }
      
      const response = await axios.get(
        `${API}/driver-onboarding/telecaller-summary?telecaller=${email}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000 // 10 second timeout
        }
      );
      setSummaryData(response.data);
    } catch (error) {
      console.error("Failed to fetch summary:", error);
      // Don't show error toast to avoid annoying users
      setSummaryData(null);
    } finally {
      setLoadingSummary(false);
    }
  };
  
  // Fetch telecallers for admin dropdown
  const fetchTelecallers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/users/telecallers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTelecallers(response.data || []);
      // Do NOT auto-select - let admin choose
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
      console.log("🔍 Fetching leads for telecaller:", telecallerEmail);
      const response = await axios.get(`${API}/driver-onboarding/leads?telecaller=${telecallerEmail}&skip_pagination=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const leadsData = response.data.leads || response.data || [];
      console.log("📦 Received leads from API:", leadsData.length, "leads");
      console.log("📋 First lead (if any):", leadsData[0]);
      setLeads(leadsData);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle telecaller selection change (just update state, don't fetch yet)
  const handleTelecallerChange = (telecallerEmail) => {
    setSelectedTelecaller(telecallerEmail);
  };
  
  // Handle "View Desk" button click
  const handleViewDesk = () => {
    if (!selectedTelecaller) {
      toast.error("Please select a telecaller first");
      return;
    }
    fetchLeadsForTelecaller(selectedTelecaller);
    setTimeout(() => fetchSummary(selectedTelecaller), 100);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/driver-onboarding/leads?telecaller=${user.email}&skip_pagination=true`, {
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
      
      // Refresh leads and summary
      if (isAdmin && selectedTelecaller) {
        await fetchLeadsForTelecaller(selectedTelecaller);
        setTimeout(() => fetchSummary(selectedTelecaller), 100);
      } else {
        await fetchLeads();
        setTimeout(() => fetchSummary(), 100);
      }
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

  // Handle "Calling Done" button
  const handleCallDone = async (leadId, event) => {
    event?.stopPropagation(); // Prevent card click event
    
    // Show confirmation dialog
    const confirmed = window.confirm("Are you sure you want to mark this call as done?");
    if (!confirmed) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/driver-onboarding/leads/${leadId}/call-done`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("✓ Call marked as done!");
      
      // IMMEDIATELY update the summary display (optimistic UI update)
      if (summaryData) {
        setSummaryData(prev => ({
          ...prev,
          calls_made_today: (prev.calls_made_today || 0) + 1,
          calls_pending: Math.max(0, (prev.calls_pending || 0) - 1)
        }));
      }
      
      // Refresh leads and summary (background update)
      if (isAdmin && selectedTelecaller) {
        await fetchLeadsForTelecaller(selectedTelecaller);
        setTimeout(() => fetchSummary(selectedTelecaller), 100);
      } else {
        await fetchLeads();
        setTimeout(() => fetchSummary(), 100);
      }
    } catch (error) {
      console.error("Error marking call done:", error);
      toast.error("Failed to mark call as done");
      // Revert optimistic update on error
      if (isAdmin && selectedTelecaller) {
        fetchSummary(selectedTelecaller);
      } else {
        fetchSummary();
      }
    }
  };
  
  // Show Status History Dialog
  const showStatusHistory = async (leadId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/driver-onboarding/leads/${leadId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistoryLead(response.data);
      setStatusHistoryDialogOpen(true);
      setDetailsDialogOpen(false);  // Close details dialog when opening history
    } catch (error) {
      console.error("Failed to load status history:", error);
      toast.error("Failed to load status history");
    }
  };
  
  // Format relative time for last_called
  const formatRelativeTime = (lastCalled) => {
    if (!lastCalled) return null;
    
    const now = new Date();
    const callTime = new Date(lastCalled);
    const diffMs = now - callTime;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    // Show relative time for first 10 hours
    if (diffHours < 10) {
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
      }
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // After 10 hours, show timestamp
    return callTime.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: '2-digit'
    });
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
      
      // Refresh leads and summary to reflect changes
      if (isAdmin && selectedTelecaller) {
        await fetchLeadsForTelecaller(selectedTelecaller);
        setTimeout(() => fetchSummary(selectedTelecaller), 100);
      } else {
        await fetchLeads();
        setTimeout(() => fetchSummary(), 100);
      }
      
      // Fetch fresh lead data after save
      const freshResponse = await axios.get(
        `${API}/driver-onboarding/leads/${editedLead.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const updatedLead = freshResponse.data;
      
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
                  <SelectItem key={telecaller.email} value={telecaller.email}>
                    {telecaller.first_name} {telecaller.last_name} ({telecaller.email})
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
  
  // Check if there are filtered leads
  const hasFilteredLeads = activeLeads.length > 0 || scheduledLeads.length > 0;
  
  if (!hasFilteredLeads && !loading && leads.length > 0) {
    // Leads exist but filters exclude all of them
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-20">
        {/* Header with filters */}
        <div className="mb-4 sticky top-0 bg-gray-50 dark:bg-gray-900 z-10 py-2">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isAdmin ? "Telecaller's Desk" : "My Leads"}
            </h1>
            <Button 
              onClick={() => {
                if (isAdmin && selectedTelecaller) {
                  fetchLeadsForTelecaller(selectedTelecaller);
                  setTimeout(() => fetchSummary(selectedTelecaller), 100);
                } else {
                  fetchLeads();
                  setTimeout(() => fetchSummary(), 100);
                }
              }} 
              variant="outline" 
              size="sm"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Telecaller Selector for Admins */}
          {isAdmin && telecallers.length > 0 && (
            <div className="mb-3">
              <div className="flex gap-2">
                <Select value={selectedTelecaller || ""} onValueChange={handleTelecallerChange}>
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
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
          
          {/* Horizontal Scrollable Date Selector */}
          <div className="mb-4">
            <div className="flex items-center gap-2">
              {/* Left Arrow */}
              <Button
                onClick={scrollDatesLeft}
                disabled={dateScrollIndex === 0}
                variant="outline"
                size="sm"
                className="p-2 dark:bg-gray-800 dark:border-gray-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              {/* Date Cards Container */}
              <div className="flex-1 overflow-hidden">
                <div className="flex gap-2">
                  {dateRange.slice(dateScrollIndex, dateScrollIndex + 5).map((dateStr) => {
                    const date = new Date(dateStr);
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    const leadCount = getLeadCountForDate(dateStr);
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    
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
                        <div className={`text-xs mt-1 px-1.5 py-0.5 rounded ${
                          isSelected 
                            ? 'bg-white/20 text-white' 
                            : leadCount > 0 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {leadCount} {leadCount === 1 ? 'lead' : 'leads'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Right Arrow */}
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
            
            {/* Clear Filter Button */}
            {selectedDate && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Showing leads for {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone number..."
                className="pl-10 pr-10 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* No results message */}
        <div className="flex flex-col items-center justify-center mt-20">
          <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No leads found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
            {summaryFilter && selectedDate && searchQuery 
              ? `No leads match the filter, date, and search`
              : summaryFilter && selectedDate 
              ? `No leads match the filter and date`
              : summaryFilter && searchQuery
              ? `No leads match the filter and search`
              : summaryFilter
              ? `No ${summaryFilter === 'calls_done' ? 'calls done today' : summaryFilter === 'calls_pending' ? 'pending calls' : summaryFilter === 'callbacks' ? 'call backs scheduled' : 'leads'}`
              : selectedDate && searchQuery 
              ? `No leads match the date "${new Date(selectedDate).toLocaleDateString('en-GB')}" and search "${searchQuery}"`
              : selectedDate 
              ? `No leads found for date "${new Date(selectedDate).toLocaleDateString('en-GB')}"`
              : `No leads match the search "${searchQuery}"`
            }
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            {summaryFilter && (
              <Button onClick={() => setSummaryFilter(null)} variant="outline" className="border-blue-500 text-blue-600">
                Clear Summary Filter
              </Button>
            )}
            {selectedDate && (
              <Button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} variant="outline">
                Reset to Today
              </Button>
            )}
            {searchQuery && (
              <Button onClick={() => setSearchQuery("")} variant="outline">
                Clear Search
              </Button>
            )}
          </div>
        </div>
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
            onClick={() => {
              if (isAdmin && selectedTelecaller) {
                fetchLeadsForTelecaller(selectedTelecaller);
                setTimeout(() => fetchSummary(selectedTelecaller), 100);
              } else {
                fetchLeads();
                setTimeout(() => fetchSummary(), 100);
              }
            }} 
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
                  <SelectItem key={telecaller.email} value={telecaller.email}>
                    {telecaller.first_name} {telecaller.last_name} ({telecaller.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Date Filter (Calendar) */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
              <Input
                type="date"
                value={selectedDate || ""}
                onChange={(e) => setSelectedDate(e.target.value || null)}
                className="pl-10 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Filter by date"
              />
            </div>
            {selectedDate && (
              <Button
                onClick={() => setSelectedDate(null)}
                variant="outline"
                size="sm"
                className="dark:bg-gray-800 dark:border-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {selectedDate && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Showing leads assigned on {new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        
        {/* Search Bar */}
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone number..."
              className="pl-10 pr-10 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Found {activeLeads.length + scheduledLeads.length} matching leads
            </p>
          )}
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {activeLeads.length + scheduledLeads.length} leads {summaryFilter ? 'filtered' : (selectedDate || searchQuery ? 'matched' : 'assigned')}
          {summaryFilter && (
            <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">
              • {summaryFilter === 'total' ? 'All Leads' : 
                 summaryFilter === 'calls_done' ? 'Called Today' :
                 summaryFilter === 'calls_pending' ? 'Pending Calls' :
                 'Call Backs'}
            </span>
          )}
          {isAdmin && selectedTelecaller && telecallers.length > 0 && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              • Viewing: {telecallers.find(t => t.email === selectedTelecaller)?.first_name} {telecallers.find(t => t.email === selectedTelecaller)?.last_name}'s desk
            </span>
          )}
        </p>
      </div>

      {/* Summary Dashboard */}
      {loadingSummary ? (
        <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-2" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading summary...</span>
          </div>
        </div>
      ) : summaryData ? (
        <div className="mb-4 space-y-3">
          {/* Show All Button (when filter is active) */}
          {summaryFilter && (
            <div className="flex justify-center">
              <Button
                onClick={() => setSummaryFilter(null)}
                variant="outline"
                size="sm"
                className="bg-white dark:bg-gray-800 border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Show All Assigned Leads ({summaryData.total_leads})
              </Button>
            </div>
          )}
          
          {/* Top 4 Summary Cards - 2x2 grid on mobile, 4 columns on larger screens - NOW CLICKABLE */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Total Leads Card - Clickable */}
            <Card 
              onClick={() => setSummaryFilter(summaryFilter === 'total' ? null : 'total')}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                summaryFilter === 'total' 
                  ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 border-2 ring-2 ring-blue-400' 
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {summaryData.total_leads}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Total Leads</div>
                {summaryFilter === 'total' && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">
                    ✓ Filtered
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Calls Done Today Card - Clickable */}
            <Card 
              onClick={() => setSummaryFilter(summaryFilter === 'calls_done' ? null : 'calls_done')}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                summaryFilter === 'calls_done' 
                  ? 'bg-green-100 dark:bg-green-900/40 border-green-500 border-2 ring-2 ring-green-400' 
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              }`}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {summaryData.calls_made_today}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Calls Done Today</div>
                {summaryFilter === 'calls_done' && (
                  <div className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1">
                    ✓ Filtered
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Calls Pending Card - Clickable */}
            <Card 
              onClick={() => setSummaryFilter(summaryFilter === 'calls_pending' ? null : 'calls_pending')}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                summaryFilter === 'calls_pending' 
                  ? 'bg-orange-100 dark:bg-orange-900/40 border-orange-500 border-2 ring-2 ring-orange-400' 
                  : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              }`}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {/* Calculate pending calls excluding callback leads */}
                  {(() => {
                    const callbackStatuses = ['Call back 1D', 'Call back 1W', 'Call back 2W', 'Call back 1M'];
                    let callbackCount = 0;
                    Object.entries(summaryData.stage_breakdown || {}).forEach(([stage, data]) => {
                      Object.entries(data.statuses || {}).forEach(([status, count]) => {
                        if (callbackStatuses.includes(status)) {
                          callbackCount += count;
                        }
                      });
                    });
                    return Math.max(0, (summaryData.calls_pending || 0) - callbackCount);
                  })()}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Calls Pending</div>
                {summaryFilter === 'calls_pending' && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-1">
                    ✓ Filtered
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Call Backs Scheduled Card - Clickable */}
            <Card 
              onClick={() => setSummaryFilter(summaryFilter === 'callbacks' ? null : 'callbacks')}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                summaryFilter === 'callbacks' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-500 border-2 ring-2 ring-purple-400' 
                  : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
              }`}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {/* Count callback leads from stage breakdown */}
                  {(() => {
                    const callbackStatuses = ['Call back 1D', 'Call back 1W', 'Call back 2W', 'Call back 1M'];
                    let callbackCount = 0;
                    Object.entries(summaryData.stage_breakdown || {}).forEach(([stage, data]) => {
                      Object.entries(data.statuses || {}).forEach(([status, count]) => {
                        if (callbackStatuses.includes(status)) {
                          callbackCount += count;
                        }
                      });
                    });
                    return callbackCount;
                  })()}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Call Backs Scheduled</div>
                {summaryFilter === 'callbacks' && (
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-1">
                    ✓ Filtered
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Stage Breakdown */}
          <div className="space-y-2">
            {Object.entries(summaryData.stage_breakdown || {}).map(([stage, data]) => (
              <Card key={stage} className="bg-white dark:bg-gray-800">
                <CardContent className="p-3">
                  <div className="font-bold text-base mb-2 text-gray-900 dark:text-white border-b pb-2">
                    {stage} <span className="text-blue-600 dark:text-blue-400">({data.total})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.statuses || {}).map(([status, count]) => (
                      <div key={status} className="text-xs flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                        <span className="text-gray-700 dark:text-gray-300">{status}</span>
                        <Badge variant="secondary" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* Pending from Previous Days - Only shown when date is selected */}
      {selectedDate && getPendingFromPreviousDays().length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowPendingLeads(!showPendingLeads)}
            className="w-full flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-lg mb-3"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pending from Previous Days ({getPendingFromPreviousDays().length})
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Unfinished leads from before {new Date(selectedDate).toLocaleDateString()}
              </p>
            </div>
            {showPendingLeads ? (
              <ChevronUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            )}
          </button>

          {showPendingLeads && (
            <div className="space-y-3">
              {getPendingFromPreviousDays().map((lead, index) => (
                <Card
                  key={lead.id}
                  className="relative overflow-hidden border-2 border-orange-200 dark:border-orange-800 hover:shadow-md transition-shadow"
                >
                  {/* Overdue Tag */}
                  <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                    Pending
                  </div>

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
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Assigned: {lead.assigned_date ? new Date(lead.assigned_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      {/* Current Status Badge */}
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Current Status:</span>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {lead.status || "New"}
                        </Badge>
                      </div>
                      
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
                          Update Status
                        </Button>
                      </div>

                      {/* View Details Button */}
                      <Button
                        onClick={() => openLeadDetails(lead)}
                        variant="ghost"
                        className="w-full"
                        size="sm"
                      >
                        View Full Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Leads List - Collapsible */}
      {activeLeads.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowActiveLeads(!showActiveLeads)}
            className="w-full flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg mb-3"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active Leads ({activeLeads.length})
            </h2>
            {showActiveLeads ? (
              <ChevronUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-green-600 dark:text-green-400" />
            )}
          </button>

          {showActiveLeads && (
            <div className="space-y-3">
              {activeLeads.map((lead, index) => (
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
                    <div className="space-y-2">
                      {/* Current Status Badge */}
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Current Status:</span>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {lead.status || "New"}
                        </Badge>
                      </div>
                      
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
                        
                        {/* Calling Done Button */}
                        <Button
                          onClick={(e) => handleCallDone(lead.id, e)}
                          size="sm"
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Calling Done
                        </Button>
                      </div>
                      
                      {/* Show Last Called Time if available */}
                      {lead.last_called && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center bg-purple-50 dark:bg-purple-900/20 py-1 px-2 rounded">
                          Last Called: {formatRelativeTime(lead.last_called)}
                        </div>
                      )}
                    </div>

                    {/* View Details and Status History Links */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openLeadDetails(lead)}
                        className="flex-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-center py-1 border border-blue-300 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        View Full Details →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showStatusHistory(lead.id);
                        }}
                        className="flex-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-center py-1 border border-indigo-300 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                      >
                        <History className="w-3 h-3 inline mr-1" />
                        Status History
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Call Back Scheduled Section - Collapsible */}
      {scheduledLeads.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowScheduledLeads(!showScheduledLeads)}
            className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg mb-3"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Call Back Scheduled ({scheduledLeads.length})
            </h2>
            {showScheduledLeads ? (
              <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </button>

          {showScheduledLeads && (
            <div className="space-y-4">
              {/* Due Today Section */}
              {(() => {
                const groups = groupedScheduledLeads();
                return (
                  <>
                    {groups.dueToday.length > 0 && (
                      <div className="mb-4">
                        <div className="mb-2 px-2 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
                            Due Today ({groups.dueToday.length})
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {groups.dueToday.map((lead, index) => (
                            <Card
                              key={lead.id}
                              className="relative overflow-hidden border-2 border-red-200 dark:border-red-800"
                            >
                              <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                                Due Today
                              </div>

                              <CardContent className="p-4">
                                <div className="mb-3">
                                  <h3 className="text-lg font-bold text-gray-900 dark:text-white pr-20">
                                    {lead.name}
                                  </h3>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    {lead.phone_number}
                                  </p>
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    {lead.status}
                                  </Badge>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      onClick={() => handleCall(lead)}
                                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                                      size="sm"
                                    >
                                      <Phone className="w-4 h-4 mr-1" />
                                      Call
                                    </Button>
                                    <Button
                                      onClick={() => openStatusDialog(lead)}
                                      variant="outline"
                                      className="flex-1 border-blue-500 text-blue-600"
                                      size="sm"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Status
                                    </Button>
                                  </div>

                                  {lead.last_called && (
                                    <div className="text-xs text-gray-600 dark:text-gray-400 text-center bg-purple-50 dark:bg-purple-900/20 py-1 px-2 rounded">
                                      Last Called: {formatRelativeTime(lead.last_called)}
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => openLeadDetails(lead)}
                                    className="flex-1 text-sm text-blue-600 hover:text-blue-800 text-center py-1 border border-blue-300 rounded"
                                  >
                                    View Details →
                                  </button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upcoming Callbacks Grouped by Date */}
                    {Object.keys(groups.upcoming).length > 0 && (
                      Object.entries(groups.upcoming)
                        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                        .map(([date, leadsForDate]) => (
                          <div key={date} className="mb-4">
                            <div className="mb-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                {new Date(date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })} ({leadsForDate.length})
                              </h3>
                            </div>
                            <div className="space-y-3">
                              {leadsForDate.map((lead) => (
                                <Card
                                  key={lead.id}
                                  className="relative overflow-hidden border-2"
                                >
                                  <CardContent className="p-4">
                                    <div className="mb-3">
                                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                        {lead.name}
                                      </h3>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        {lead.phone_number}
                                      </p>
                                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        {lead.status}
                                      </Badge>
                                    </div>

                                    <div className="space-y-2">
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => handleCall(lead)}
                                          className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                                          size="sm"
                                        >
                                          <Phone className="w-4 h-4 mr-1" />
                                          Call
                                        </Button>
                                        <Button
                                          onClick={() => openStatusDialog(lead)}
                                          variant="outline"
                                          className="flex-1 border-blue-500 text-blue-600"
                                          size="sm"
                                        >
                                          Status
                                        </Button>
                                      </div>

                                      {lead.last_called && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 text-center bg-purple-50 dark:bg-purple-900/20 py-1 px-2 rounded">
                                          Last Called: {formatRelativeTime(lead.last_called)}
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => openLeadDetails(lead)}
                                      className="w-full mt-3 text-sm text-blue-600 hover:text-blue-800 text-center py-1 border border-blue-300 rounded"
                                    >
                                      View Details →
                                    </button>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

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
        onShowStatusHistory={showStatusHistory}
      />
      
      {/* Status History Dialog */}
      <Dialog open={statusHistoryDialogOpen} onOpenChange={setStatusHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Status History - {historyLead?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2 py-4">
            {/* Lead Import Date */}
            <div className="flex items-start space-x-3 py-2">
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Imported
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {historyLead?.import_date ? 
                    new Date(historyLead.import_date).toLocaleString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric'
                    }) : 
                   historyLead?.created_at ? 
                    new Date(historyLead.created_at).toLocaleString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric'
                    }) : 'N/A'}
                </div>
              </div>
            </div>
            
            {/* Combined Timeline - Calling History and Status History merged and sorted */}
            {(() => {
              const timeline = [];
              
              // Add calling history
              if (historyLead?.calling_history && historyLead.calling_history.length > 0) {
                historyLead.calling_history.forEach(call => {
                  timeline.push({
                    timestamp: call.timestamp,
                    type: 'call',
                    label: 'Calling Done',
                    data: call
                  });
                });
              }
              
              // Add status history
              if (historyLead?.status_history && historyLead.status_history.length > 0) {
                historyLead.status_history.forEach(entry => {
                  if (entry.action === 'call_made') {
                    // Skip call_made entries from status_history as we already have them in calling_history
                    return;
                  }
                  timeline.push({
                    timestamp: entry.timestamp,
                    type: entry.field === 'status' ? 'status' : 'stage',
                    label: entry.new_value,
                    data: entry
                  });
                });
              }
              
              // Sort by timestamp
              timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              
              // Render timeline
              return timeline.length > 0 ? (
                timeline.map((item, idx) => (
                  <div key={idx} className="flex items-start space-x-3 py-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {new Date(item.timestamp).toLocaleString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true,
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No activity yet
                </div>
              );
            })()}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setStatusHistoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TelecallerDeskMobile;