import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Upload, Users, FileSpreadsheet, RefreshCw, Plus, Calendar as CalendarIcon, Filter, X, CheckSquare, Square, XCircle, Save, ChevronDown } from "lucide-react";
import { format } from "date-fns";

// Stage 1: Filtering
const FILTERING_OPTIONS = [
  { value: "Not interested", label: "S1-a Not interested", category: "Stage 1: Filtering", color: "bg-gray-100 text-gray-700" },
  { value: "Interested, No Driving License", label: "S1-b Interested, No DL", category: "Stage 1: Filtering", color: "bg-yellow-100 text-yellow-700" },
  { value: "Highly Interested", label: "S1-c Highly Interested", category: "Stage 1: Filtering", color: "bg-green-100 text-green-700" },
  { value: "Call back 1D", label: "S1-d Call back 1D", category: "Stage 1: Filtering", color: "bg-blue-100 text-blue-700" },
  { value: "Call back 1W", label: "S1-e Call back 1W", category: "Stage 1: Filtering", color: "bg-blue-100 text-blue-700" },
  { value: "Call back 2W", label: "S1-f Call back 2W", category: "Stage 1: Filtering", color: "bg-blue-100 text-blue-700" },
  { value: "Call back 1M", label: "S1-g Call back 1M", category: "Stage 1: Filtering", color: "bg-blue-100 text-blue-700" },
];

// Stage 2: Docs Collection
const DOCS_COLLECTION_OPTIONS = [
  { value: "Docs Upload Pending", label: "S2-a Docs Upload Pending", category: "Stage 2: Docs Collection", color: "bg-orange-100 text-orange-700" },
  { value: "Verification Pending", label: "S2-b Verification Pending", category: "Stage 2: Docs Collection", color: "bg-yellow-100 text-yellow-700" },
  { value: "Duplicate License", label: "S2-c Duplicate License", category: "Stage 2: Docs Collection", color: "bg-red-100 text-red-700" },
  { value: "DL - Amount", label: "S2-d DL - Amount", category: "Stage 2: Docs Collection", color: "bg-purple-100 text-purple-700" },
  { value: "Verified", label: "S2-e Verified", category: "Stage 2: Docs Collection", color: "bg-green-100 text-green-700" },
];

// Stage 3: Driver Readiness
const DRIVER_READINESS_OPTIONS = [
  { value: "Schedule_Pending", label: "S3-a Schedule Pending", category: "Stage 3: Driver Readiness", color: "bg-orange-100 text-orange-700" },
  { value: "Training WIP", label: "S3-b Training WIP", category: "Stage 3: Driver Readiness", color: "bg-blue-100 text-blue-700" },
  { value: "Training Completed", label: "S3-c Training Completed", category: "Stage 3: Driver Readiness", color: "bg-green-100 text-green-700" },
  { value: "Training Rejected", label: "S3-d Training Rejected", category: "Stage 3: Driver Readiness", color: "bg-red-100 text-red-700" },
  { value: "Re-Training", label: "S3-e Re-Training", category: "Stage 3: Driver Readiness", color: "bg-yellow-100 text-yellow-700" },
  { value: "Absent for training", label: "S3-f Absent for training", category: "Stage 3: Driver Readiness", color: "bg-gray-100 text-gray-700" },
  { value: "Approved", label: "S3-g Approved", category: "Stage 3: Driver Readiness", color: "bg-green-100 text-green-700" },
];

// Stage 4: Customer Readiness
const CUSTOMER_READINESS_OPTIONS = [
  { value: "CT_Pending", label: "S4-a CT Pending", category: "Stage 4: Customer Readiness", color: "bg-orange-100 text-orange-700" },
  { value: "CT_WIP", label: "S4-b CT WIP", category: "Stage 4: Customer Readiness", color: "bg-blue-100 text-blue-700" },
  { value: "Shift details pending", label: "S4-c Shift Details Pending", category: "Stage 4: Customer Readiness", color: "bg-yellow-100 text-yellow-700" },
  { value: "DONE!", label: "S4-d DONE!", category: "Stage 4: Customer Readiness", color: "bg-green-100 text-green-700" },
  { value: "Training Rejected", label: "S4-e Training Rejected", category: "Stage 4: Customer Readiness", color: "bg-red-100 text-red-700" },
  { value: "Re-Training", label: "S4-f Re-Training", category: "Stage 4: Customer Readiness", color: "bg-yellow-100 text-yellow-700" },
  { value: "Absent for training", label: "S4-g Absent for training", category: "Stage 4: Customer Readiness", color: "bg-gray-100 text-gray-700" },
  { value: "Terminated", label: "S4-h Terminated", category: "Stage 4: Customer Readiness", color: "bg-red-100 text-red-700" },
];

// Combined status options (for backward compatibility)
const STATUS_OPTIONS = [
  ...FILTERING_OPTIONS,
  ...DOCS_COLLECTION_OPTIONS,
  ...DRIVER_READINESS_OPTIONS,
  ...CUSTOMER_READINESS_OPTIONS
];

const LEAD_STAGE_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "filtering", label: "Filtering Stage" },
  { value: "docs_collection", label: "Docs Collection" },
  { value: "driver_readiness", label: "Driver Readiness" },
  { value: "customer_readiness", label: "Customer Readiness" },
];

const DriverOnboardingPage = () => {
  const { user } = useAuth();
  const isMasterAdmin = user?.account_type === "master_admin";
  
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Lead source and date for imports
  const [leadSource, setLeadSource] = useState("");
  const [leadDate, setLeadDate] = useState("");
  const [readSourceFromFile, setReadSourceFromFile] = useState(false);
  
  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState(null);
  
  // Track changes in edit dialog
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Bulk selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  
  // Date filter states
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // Stage filter states
  const [activeStageFilter, setActiveStageFilter] = useState("all"); // "all", "filtering", "docs", "driver", "customer"
  const [activeSubStatus, setActiveSubStatus] = useState(null); // Specific status within a stage
  const [showStageFilters, setShowStageFilters] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState("all"); // Stage category
  const [selectedStatus, setSelectedStatus] = useState("all"); // Specific status within stage
  
  // Edit mode for lead details
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedLead, setEditedLead] = useState(null);
  
  // Document upload states
  const [uploadingDoc, setUploadingDoc] = useState(null); // Which doc is being uploaded
  const [scanningDoc, setScanningDoc] = useState(null); // Which doc is being scanned
  const [uploadedDocs, setUploadedDocs] = useState({
    dl: false,
    aadhar: false,
    pan: false,
    gas_bill: false,
    bank_passbook: false
  });
  
  // Last sync time
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  const fetchLastSyncTime = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/sheets/last-sync-time`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLastSyncTime(response.data.last_sync_time);
    } catch (error) {
      console.error("Failed to fetch last sync time");
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/driver-onboarding/leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeads(response.data);
      setFilteredLeads(response.data);
      
      // Fetch last sync time after fetching leads
      await fetchLastSyncTime();
    } catch (error) {
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Filter leads by date range and stages
  useEffect(() => {
    let filtered = [...leads];

    // Date filter
    if (startDate || endDate) {
      filtered = filtered.filter(lead => {
        if (!lead.import_date) return false;
        
        const leadDate = new Date(lead.import_date);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && end) {
          return leadDate >= start && leadDate <= end;
        } else if (start) {
          return leadDate >= start;
        } else if (end) {
          return leadDate <= end;
        }
        return true;
      });
    }

    // Stage filters - New hierarchical filtering
    if (activeStageFilter !== "all") {
      if (activeStageFilter === "filtering") {
        const filteringStatuses = FILTERING_OPTIONS.map(opt => opt.value);
        filtered = filtered.filter(lead => filteringStatuses.includes(lead.status));
      } else if (activeStageFilter === "docs") {
        const docsStatuses = DOCS_COLLECTION_OPTIONS.map(opt => opt.value);
        filtered = filtered.filter(lead => docsStatuses.includes(lead.status));
      } else if (activeStageFilter === "driver") {
        const driverStatuses = DRIVER_READINESS_OPTIONS.map(opt => opt.value);
        filtered = filtered.filter(lead => driverStatuses.includes(lead.status));
      } else if (activeStageFilter === "customer") {
        const customerStatuses = CUSTOMER_READINESS_OPTIONS.map(opt => opt.value);
        filtered = filtered.filter(lead => customerStatuses.includes(lead.status));
      }
    }
    
    // Sub-status filter (specific status within a stage)
    if (activeSubStatus) {
      filtered = filtered.filter(lead => lead.status === activeSubStatus);
    }

    setFilteredLeads(filtered);
  }, [startDate, endDate, activeStageFilter, activeSubStatus, leads]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (validTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
      } else {
        toast.error("Please select a valid CSV or XLSX file");
        event.target.value = null;
      }
    }
  };

  const handleImport = async (duplicateAction = null) => {
    if (!selectedFile) {
      toast.error("Please select a file to import");
      return;
    }
    
    // Validate inputs based on checkbox state
    if (!readSourceFromFile && !leadSource) {
      toast.error("Please enter lead source or check 'Read Source from file'");
      return;
    }
    
    if (!leadDate) {
      toast.error("Please enter lead date");
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('lead_source', readSourceFromFile ? '' : leadSource);
      formData.append('lead_date', leadDate);
      formData.append('read_source_from_file', readSourceFromFile);

      const token = localStorage.getItem("token");
      
      // Build URL with duplicate action if provided
      let url = `${API}/driver-onboarding/import-leads`;
      if (duplicateAction) {
        url += `?duplicate_action=${duplicateAction}`;
      }
      
      const response = await axios.post(url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Import response:', response.data);

      // Check if duplicates were found
      if (response.data.duplicates_found) {
        console.log('Duplicates found! Opening dialog...');
        setDuplicateData(response.data);
        setDuplicateDialogOpen(true);
        setImporting(false);
        return;
      }

      console.log('No duplicates, proceeding with success message');

      toast.success(
        <div>
          <p className="font-semibold">Import Successful!</p>
          <p className="text-sm mt-1">{response.data.message}</p>
        </div>,
        { duration: 5000 }
      );

      setImportDialogOpen(false);
      setDuplicateDialogOpen(false);
      setSelectedFile(null);
      setDuplicateData(null);
      await fetchLeads(); // This will also update last sync time
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import leads");
    } finally {
      setImporting(false);
    }
  };

  const handleDuplicateAction = async (action) => {
    await handleImport(action);
  };

  const handleSyncToSheets = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/driver-onboarding/sync-leads`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("✅ Leads synced to Google Sheets successfully!");
      
      // Update last sync time
      await fetchLastSyncTime();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to sync to Google Sheets");
    }
  };

  const handleSyncFromSheets = async () => {
    try {
      toast.info("📥 Pulling data from Google Sheets...");
      
      // Call Google Apps Script to trigger sync from sheets to app
      const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx_C6R0XGO1hkLvZhcSS9zGj3TSatH55uXoioYIX9YZa4tm53ubuqWLtC7wKEJCwgbs/exec";
      
      const response = await fetch(`${GOOGLE_SHEETS_WEB_APP_URL}?action=sync_to_app`, {
        method: 'GET',
        mode: 'no-cors' // Required for Google Apps Script
      });
      
      // Wait a moment for the webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh leads to show updated data
      await fetchLeads();
      
      toast.success("✅ Data synced from Google Sheets!");
    } catch (error) {
      console.error("Sync from sheets error:", error);
      toast.error("Failed to sync from Google Sheets. Make sure the script is set up correctly.");
    }
  };

  const handleOpenGoogleSheet = () => {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1FfZYvc9EpSE03myhp3yk8lfOzCJoibVmaJ74Xm-qhv0/edit";
    window.open(sheetUrl, '_blank');
  };

  const handleLeadClick = (lead, e) => {
    // Don't open dialog if clicking on checkbox
    if (e.target.type === 'checkbox' || e.target.closest('label')) {
      return;
    }
    setSelectedLead(lead);
    setEditedLead({...lead}); // Create a copy for editing
    setIsEditMode(false); // Start in view mode
    setDetailDialogOpen(true);
  };

  const handleFieldChange = (field, value) => {
    setEditedLead(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!editedLead) return;

    setUpdatingStatus(true);
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
          lead_stage: editedLead.lead_stage,
          status: editedLead.status,
          driver_readiness: editedLead.driver_readiness,
          docs_collection: editedLead.docs_collection,
          customer_readiness: editedLead.customer_readiness,
          assigned_telecaller: editedLead.assigned_telecaller,
          telecaller_notes: editedLead.telecaller_notes,
          notes: editedLead.notes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Lead details updated successfully!");
      
      // Update local state
      const updatedLeads = leads.map(lead => 
        lead.id === editedLead.id ? response.data.lead : lead
      );
      setLeads(updatedLeads);
      setSelectedLead(response.data.lead);
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      
      // Update last sync time after edit
      await fetchLastSyncTime();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update lead");
    } finally {
      setUpdatingStatus(false);
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
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to upload ${documentType}`);
    } finally {
      setUploadingDoc(null);
    }
  };

  // Handle document scan (OCR)
  const handleDocumentScan = async (documentType) => {
    setScanningDoc(documentType);
    try {
      const token = localStorage.getItem("token");
      
      const response = await axios.post(
        `${API}/driver-onboarding/scan-document/${selectedLead.id}?document_type=${documentType}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        toast.success(`${documentType.toUpperCase()} scanned successfully!`);
        
        // Update the form field with extracted data
        const fieldName = response.data.field_updated;
        const extractedData = response.data.extracted_data;
        
        if (fieldName && extractedData) {
          handleFieldChange(fieldName, extractedData);
          toast.info(`Extracted: ${extractedData}. You can edit if needed.`);
        }
        
        // Refresh the lead data
        const updatedLead = await axios.get(`${API}/driver-onboarding/leads/${selectedLead.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        setSelectedLead(updatedLead.data.lead);
        setEditedLead(updatedLead.data.lead);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to scan ${documentType}`);
    } finally {
      setScanningDoc(null);
    }
  };
  
  // Handle inline status change (directly in table)
  const handleInlineStatusChange = async (leadId, newStatus) => {
    try {
      const token = localStorage.getItem("token");
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) return;
      
      const updatedLead = { ...lead, status: newStatus };
      
      await axios.put(`${API}/driver-onboarding/leads/${leadId}`, updatedLead, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update local state
      setLeads(prevLeads =>
        prevLeads.map(l => (l.id === leadId ? updatedLead : l))
      );
      
      setInlineEditingId(null);
      toast.success("Status updated successfully");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedLead) return;

    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API}/driver-onboarding/leads/${selectedLead.id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Lead status updated successfully!");
      
      // Update local state
      const updatedLeads = leads.map(lead => 
        lead.id === selectedLead.id ? { ...lead, status: newStatus } : lead
      );
      setLeads(updatedLeads);
      setSelectedLead({ ...selectedLead, status: newStatus });
      
      // Update last sync time after status change
      await fetchLastSyncTime();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    setSelectedLeadIds(filteredLeads.map(lead => lead.id));
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
  };

  const handleLeadCheckboxChange = (leadId) => {
    setSelectedLeadIds(prev => {
      if (prev.includes(leadId)) {
        return prev.filter(id => id !== leadId);
      } else {
        return [...prev, leadId];
      }
    });
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus) {
      toast.error("Please select a status");
      return;
    }

    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.patch(
        `${API}/driver-onboarding/leads/bulk-update-status`,
        { lead_ids: selectedLeadIds, status: bulkStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message);
      
      // Update local state
      const updatedLeads = leads.map(lead => 
        selectedLeadIds.includes(lead.id) ? { ...lead, status: bulkStatus } : lead
      );
      setLeads(updatedLeads);
      
      // Clear selection and close dialog
      setSelectedLeadIds([]);
      setBulkStatusDialogOpen(false);
      setBulkStatus("");
      
      // Update last sync time after bulk update
      await fetchLastSyncTime();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteLead = async () => {
    // Check if deleting single lead or bulk
    const isBulkDelete = selectedLeadIds.length > 0 && !selectedLead;
    
    if (!selectedLead && !isBulkDelete) return;

    setDeletingLead(true);
    try {
      const token = localStorage.getItem("token");
      
      if (isBulkDelete) {
        // Bulk delete
        const response = await axios.post(
          `${API}/driver-onboarding/leads/bulk-delete`,
          { lead_ids: selectedLeadIds },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        toast.success(response.data.message);
        
        // Update local state - remove deleted leads
        const updatedLeads = leads.filter(lead => !selectedLeadIds.includes(lead.id));
        setLeads(updatedLeads);
        
        // Clear selection
        setSelectedLeadIds([]);
      } else {
        // Single delete
        await axios.delete(
          `${API}/driver-onboarding/leads/${selectedLead.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.success("Lead deleted successfully!");
        
        // Update local state - remove deleted lead
        const updatedLeads = leads.filter(lead => lead.id !== selectedLead.id);
        setLeads(updatedLeads);
        
        // Close detail dialog
        setDetailDialogOpen(false);
      }
      
      // Close delete dialog
      setDeleteDialogOpen(false);
      
      // Update last sync time
      await fetchLastSyncTime();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete lead(s)");
    } finally {
      setDeletingLead(false);
    }
  };

  const clearDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const clearAllFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setActiveStageFilter("all");
    setActiveSubStatus(null);
  };

  const getStatusColor = (status) => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption ? statusOption.color : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="driver-onboarding-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Driver Onboarding</h1>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-1 gap-1 sm:gap-0">
            <p className="text-gray-600 dark:text-gray-400">Manage driver leads and onboarding</p>
            {lastSyncTime && (
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Last synced: {new Date(lastSyncTime).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button
            onClick={() => setShowDateFilter(!showDateFilter)}
            variant="outline"
            className="border-gray-300 dark:border-gray-600 text-sm"
            size="sm"
          >
            <Filter size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Date Filter</span>
            <span className="sm:hidden">Date</span>
          </Button>
          <Button
            onClick={() => setShowStageFilters(!showStageFilters)}
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm"
            size="sm"
          >
            <Filter size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Stage Filters</span>
            <span className="sm:hidden">Stages</span>
          </Button>
          <Button
            onClick={handleSyncToSheets}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 text-sm"
            size="sm"
            title="Push leads to Google Sheets"
          >
            <RefreshCw size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Sync to Sheets</span>
            <span className="sm:hidden">→ GS</span>
          </Button>
          <Button
            onClick={handleSyncFromSheets}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm"
            size="sm"
            title="Pull leads from Google Sheets"
          >
            <RefreshCw size={16} className="mr-1 sm:mr-2 transform rotate-180" />
            <span className="hidden sm:inline">Sync from Sheets</span>
            <span className="sm:hidden">← GS</span>
          </Button>
          <Button
            onClick={handleOpenGoogleSheet}
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm"
            size="sm"
            title="Open Google Sheets"
          >
            <FileSpreadsheet size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Google Sheets</span>
            <span className="sm:hidden">GS</span>
          </Button>
          <Button
            onClick={() => setImportDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-sm"
            data-testid="import-leads-button"
            size="sm"
          >
            <Plus size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Import Leads</span>
            <span className="sm:hidden">Import</span>
          </Button>
        </div>
      </div>

      {/* Date Filter Panel */}
      {showDateFilter && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal dark:bg-gray-700 dark:border-gray-600 text-sm"
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex-1">
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal dark:bg-gray-700 dark:border-gray-600 text-sm"
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-shrink-0">
                <Button
                  onClick={clearDateFilter}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm w-full sm:w-auto"
                  size="sm"
                >
                  <X size={16} className="mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Clear Filter</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
              </div>
            </div>
            
            {(startDate || endDate) && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                Showing {filteredLeads.length} of {leads.length} leads
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stage Filters Panel */}
      {showStageFilters && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* All Status Button */}
              <Button
                onClick={() => {
                  setActiveStageFilter("all");
                  setActiveSubStatus(null);
                }}
                variant={activeStageFilter === "all" ? "default" : "outline"}
                className={activeStageFilter === "all" ? "bg-blue-600 text-white" : "border-gray-300 dark:border-gray-600"}
                size="sm"
              >
                All Status
              </Button>

              {/* Filtering Stage Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeStageFilter === "filtering" ? "default" : "outline"}
                    className={activeStageFilter === "filtering" ? "bg-green-600 text-white" : "border-green-600 text-green-600"}
                    size="sm"
                  >
                    FILTERING STAGE
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        setActiveStageFilter("filtering");
                        setActiveSubStatus(null);
                      }}
                    >
                      All Filtering Statuses
                    </Button>
                    {FILTERING_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          setActiveStageFilter("filtering");
                          setActiveSubStatus(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Docs Collection Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeStageFilter === "docs" ? "default" : "outline"}
                    className={activeStageFilter === "docs" ? "bg-orange-600 text-white" : "border-orange-600 text-orange-600"}
                    size="sm"
                  >
                    DOCS_COLLECTION
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        setActiveStageFilter("docs");
                        setActiveSubStatus(null);
                      }}
                    >
                      All Docs Statuses
                    </Button>
                    {DOCS_COLLECTION_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          setActiveStageFilter("docs");
                          setActiveSubStatus(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Driver Readiness Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeStageFilter === "driver" ? "default" : "outline"}
                    className={activeStageFilter === "driver" ? "bg-purple-600 text-white" : "border-purple-600 text-purple-600"}
                    size="sm"
                  >
                    DRIVER READINESS
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        setActiveStageFilter("driver");
                        setActiveSubStatus(null);
                      }}
                    >
                      All Driver Statuses
                    </Button>
                    {DRIVER_READINESS_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          setActiveStageFilter("driver");
                          setActiveSubStatus(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Customer Readiness Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeStageFilter === "customer" ? "default" : "outline"}
                    className={activeStageFilter === "customer" ? "bg-pink-600 text-white" : "border-pink-600 text-pink-600"}
                    size="sm"
                  >
                    CUSTOMER READINESS
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        setActiveStageFilter("customer");
                        setActiveSubStatus(null);
                      }}
                    >
                      All Customer Statuses
                    </Button>
                    {CUSTOMER_READINESS_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          setActiveStageFilter("customer");
                          setActiveSubStatus(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredLeads.length} of {leads.length} leads
                {activeSubStatus && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                    • Filtered by: {STATUS_OPTIONS.find(opt => opt.value === activeSubStatus)?.label}
                  </span>
                )}
              </p>
              <Button
                onClick={clearAllFilters}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X size={18} className="mr-2" />
                Clear All Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar */}
      {selectedLeadIds.length > 0 && (
        <Card className="dark:bg-gray-800 dark:border-blue-500 border-2 border-blue-500">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <CheckSquare className="text-blue-600" size={18} />
                <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                  {selectedLeadIds.length} lead(s) selected
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button
                  onClick={() => setBulkStatusDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-sm"
                  size="sm"
                >
                  Update Status
                </Button>
                {isMasterAdmin && (
                  <Button
                    onClick={() => setDeleteDialogOpen(true)}
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                    size="sm"
                  >
                    <XCircle size={16} className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Delete Selected</span>
                    <span className="sm:hidden">Delete</span>
                  </Button>
                )}
                <Button
                  onClick={handleClearSelection}
                  variant="outline"
                  className="border-gray-300 dark:border-gray-600 text-sm"
                  size="sm"
                >
                  <span className="hidden sm:inline">Clear Selection</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredLeads.length}</p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">New</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {filteredLeads.filter(l => l.status === "New").length}
            </p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Onboarded</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {filteredLeads.filter(l => l.status === "Onboarded").length}
            </p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {filteredLeads.filter(l => ["Contacted", "Interested", "Documents Pending", "Scheduled"].includes(l.status)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Selection Controls */}
      {filteredLeads.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size="sm"
            className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm"
          >
            <CheckSquare size={14} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Select All</span>
            <span className="sm:hidden">All</span>
          </Button>
          {selectedLeadIds.length > 0 && (
            <Button
              onClick={handleClearSelection}
              variant="outline"
              size="sm"
              className="border-gray-300 dark:border-gray-600 text-sm"
            >
              <Square size={14} className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Clear</span>
              <span className="sm:hidden">Clear</span>
            </Button>
          )}
        </div>
      )}

      {/* Leads Table */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <Users size={20} className="mr-2" />
            Driver Leads ({filteredLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {leads.length === 0 ? "No leads imported yet" : "No leads match the selected date range"}
              </p>
              {leads.length === 0 && (
                <Button
                  onClick={() => setImportDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus size={18} className="mr-2" />
                  Import Your First Batch
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 w-8 sm:w-12">
                      <Checkbox
                        checked={selectedLeadIds.length === filteredLeads.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleSelectAll();
                          } else {
                            handleClearSelection();
                          }
                        }}
                      />
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">S. No.</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Location</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Imported</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, index) => (
                    <tr 
                      key={lead.id || index} 
                      onClick={(e) => handleLeadClick(lead, e)}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeadIds.includes(lead.id)}
                          onCheckedChange={() => handleLeadCheckboxChange(lead.id)}
                        />
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-white hidden sm:table-cell">{index + 1}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-white font-medium">
                        <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400">#{index + 1}</div>
                        {lead.name}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">{lead.phone_number}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">
                        {inlineEditingId === lead.id ? (
                          <Select
                            value={lead.status || "New"}
                            onValueChange={(value) => handleInlineStatusChange(lead.id, value)}
                          >
                            <SelectTrigger className="w-full h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-gray-800 max-h-[300px]">
                              {/* Stage 1 */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900">
                                Stage 1: Filtering
                              </div>
                              {FILTERING_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                              {/* Stage 2 */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                                Stage 2: Docs Collection
                              </div>
                              {DOCS_COLLECTION_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                              {/* Stage 3 */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                                Stage 3: Driver Readiness
                              </div>
                              {DRIVER_READINESS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                              {/* Stage 4 */}
                              <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-900 mt-1">
                                Stage 4: Customer Readiness
                              </div>
                              {CUSTOMER_READINESS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInlineEditingId(lead.id);
                            }}
                            className="group flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors w-full"
                          >
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(lead.status || "New")}`}>
                              {STATUS_OPTIONS.find(opt => opt.value === lead.status)?.label || lead.status || "New"}
                            </span>
                            <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">{lead.current_location || '-'}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs text-gray-500 dark:text-gray-500 hidden lg:table-cell">
                        {lead.import_date ? new Date(lead.import_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Import Driver Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>Supported Formats:</strong>
              </p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Format 1: S. No., Name, Vehicle, Phone Number</li>
                <li>• Format 2: Full form with Tamil questions (8 columns)</li>
                <li>• Format 3: Comprehensive sheet with Name, Phone No, Address, Stage, Status, etc.</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="lead-source" className="text-gray-700 dark:text-gray-300">
                  Lead Source {!readSourceFromFile && '*'}
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="read-source-from-file"
                    checked={readSourceFromFile}
                    onCheckedChange={setReadSourceFromFile}
                  />
                  <label
                    htmlFor="read-source-from-file"
                    className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
                  >
                    Read Source from file
                  </label>
                </div>
              </div>
              <Input
                id="lead-source"
                type="text"
                placeholder={readSourceFromFile ? "Will be read from file..." : "e.g., Facebook Ad, Referral, Walk-in"}
                value={readSourceFromFile ? "" : leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                disabled={readSourceFromFile}
                className="mt-1.5 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {readSourceFromFile && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  ℹ️ Lead sources will be read from "Lead Source" or "Lead Generator" column in your file
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="lead-date" className="text-gray-700 dark:text-gray-300">
                Lead Date *
              </Label>
              <Input
                id="lead-date"
                type="date"
                value={leadDate}
                onChange={(e) => setLeadDate(e.target.value)}
                className="mt-1.5 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div>
              <Label htmlFor="file-upload" className="text-gray-700 dark:text-gray-300">
                Select CSV or XLSX File *
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="mt-1.5 dark:bg-gray-700 dark:border-gray-600"
              />
              {selectedFile && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={!selectedFile || (!readSourceFromFile && !leadSource) || !leadDate || importing}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {importing ? (
                <>
                  <RefreshCw size={18} className="mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={18} className="mr-2" />
                  Import Leads
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="dark:bg-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center justify-between">
              Lead Details
              <Button
                onClick={() => setIsEditMode(!isEditMode)}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                {isEditMode ? "Cancel Edit" : "Edit Details"}
              </Button>
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {isEditMode ? "Edit lead information" : "View and update lead information"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && editedLead && (
            <div className="space-y-6 mt-4">
              {/* Status Update Section */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 block">
                  Update Status
                </Label>
                <Select
                  value={selectedLead.status || "New"}
                  onValueChange={(value) => {
                    handleStatusUpdate(value);
                    setHasUnsavedChanges(true);
                  }}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700 max-h-[400px]">
                    {/* Stage 1: Filtering */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 sticky top-0">
                      Stage 1: Filtering
                    </div>
                    {FILTERING_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                    
                    {/* Stage 2: Docs Collection */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 sticky top-0 mt-1">
                      Stage 2: Docs Collection
                    </div>
                    {DOCS_COLLECTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                    
                    {/* Stage 3: Driver Readiness */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 sticky top-0 mt-1">
                      Stage 3: Driver Readiness
                    </div>
                    {DRIVER_READINESS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                    
                    {/* Stage 4: Customer Readiness */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 sticky top-0 mt-1">
                      Stage 4: Customer Readiness
                    </div>
                    {CUSTOMER_READINESS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lead Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Name</Label>
                  {isEditMode ? (
                    <Input
                      value={editedLead.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                      {selectedLead.name}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Phone Number</Label>
                  {isEditMode ? (
                    <Input
                      value={editedLead.phone_number}
                      onChange={(e) => handleFieldChange('phone_number', e.target.value)}
                      className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                      {selectedLead.phone_number}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Vehicle</Label>
                  {isEditMode ? (
                    <Input
                      value={editedLead.vehicle || ''}
                      onChange={(e) => handleFieldChange('vehicle', e.target.value)}
                      className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base text-gray-900 dark:text-white mt-1">
                      {selectedLead.vehicle || '-'}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Driving License</Label>
                  {isEditMode ? (
                    <Input
                      value={editedLead.driving_license || ''}
                      onChange={(e) => handleFieldChange('driving_license', e.target.value)}
                      className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base text-gray-900 dark:text-white mt-1">
                      {selectedLead.driving_license || '-'}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Experience</Label>
                  {isEditMode ? (
                    <Input
                      value={editedLead.experience || ''}
                      onChange={(e) => handleFieldChange('experience', e.target.value)}
                      className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base text-gray-900 dark:text-white mt-1">
                      {selectedLead.experience || '-'}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Interested in EV</Label>
                  {isEditMode ? (
                    <Input
                      value={editedLead.interested_ev || ''}
                      onChange={(e) => handleFieldChange('interested_ev', e.target.value)}
                      className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base text-gray-900 dark:text-white mt-1">
                      {selectedLead.interested_ev || '-'}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Monthly Salary</Label>
                  {isEditMode ? (
                    <Input
                      value={editedLead.monthly_salary || ''}
                      onChange={(e) => handleFieldChange('monthly_salary', e.target.value)}
                      className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base text-gray-900 dark:text-white mt-1">
                      {selectedLead.monthly_salary || '-'}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Location in Chennai</Label>
                  {isEditMode ? (
                    <Input
                      value={editedLead.current_location || ''}
                      onChange={(e) => handleFieldChange('current_location', e.target.value)}
                      className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base text-gray-900 dark:text-white mt-1">
                      {selectedLead.current_location || '-'}
                    </p>
                  )}
                </div>
              </div>

              {/* Stage Fields */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Pipeline Stages</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Lead Stage</Label>
                    {isEditMode ? (
                      <Select
                        value={editedLead.lead_stage || "New"}
                        onValueChange={(value) => handleFieldChange('lead_stage', value)}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          {LEAD_STAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.lead_stage || 'New'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Driver Readiness</Label>
                    {isEditMode ? (
                      <Select
                        value={editedLead.driver_readiness || "Not Started"}
                        onValueChange={(value) => handleFieldChange('driver_readiness', value)}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          {DRIVER_READINESS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.driver_readiness || 'Not Started'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Docs Collection</Label>
                    {isEditMode ? (
                      <Select
                        value={editedLead.docs_collection || "Pending"}
                        onValueChange={(value) => handleFieldChange('docs_collection', value)}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          {DOCS_COLLECTION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.docs_collection || 'Pending'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Customer Readiness</Label>
                    {isEditMode ? (
                      <Select
                        value={editedLead.customer_readiness || "Not Ready"}
                        onValueChange={(value) => handleFieldChange('customer_readiness', value)}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          {CUSTOMER_READINESS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.customer_readiness || 'Not Ready'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Assigned Telecaller</Label>
                    {isEditMode ? (
                      <Input
                        value={editedLead.assigned_telecaller || ''}
                        onChange={(e) => handleFieldChange('assigned_telecaller', e.target.value)}
                        className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Enter telecaller name"
                      />
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.assigned_telecaller || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Notes</Label>
                    {isEditMode ? (
                      <Input
                        value={editedLead.notes || ''}
                        onChange={(e) => handleFieldChange('notes', e.target.value)}
                        className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Add notes"
                      />
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.notes || '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Details Section */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Document Details with Upload & OCR</h3>
                <div className="grid grid-cols-1 gap-6">
                  {/* Driver License */}
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-4">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Driver License</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        {isEditMode ? (
                          <Input
                            value={editedLead.dl_no || ''}
                            onChange={(e) => handleFieldChange('dl_no', e.target.value)}
                            className="dark:bg-gray-700 dark:border-gray-600"
                            placeholder="DL Number"
                          />
                        ) : (
                          <p className="text-base text-gray-900 dark:text-white">
                            {selectedLead.dl_no || 'Not provided'}
                          </p>
                        )}
                      </div>
                      {isEditMode && (
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleDocumentUpload('dl', e.target.files[0])}
                              className="hidden"
                              id="dl-upload"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={uploadingDoc === 'dl'}
                              onClick={() => document.getElementById('dl-upload').click()}
                            >
                              {uploadingDoc === 'dl' ? 'Uploading...' : uploadedDocs.dl ? '✓ Uploaded' : 'Upload'}
                            </Button>
                          </label>
                          {uploadedDocs.dl && (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleDocumentScan('dl')}
                              disabled={scanningDoc === 'dl'}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {scanningDoc === 'dl' ? 'Scanning...' : 'Scan'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Aadhar Card */}
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-4">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Aadhar Card</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        {isEditMode ? (
                          <Input
                            value={editedLead.aadhar_card || ''}
                            onChange={(e) => handleFieldChange('aadhar_card', e.target.value)}
                            className="dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Aadhar Number"
                          />
                        ) : (
                          <p className="text-base text-gray-900 dark:text-white">
                            {selectedLead.aadhar_card || 'Not provided'}
                          </p>
                        )}
                      </div>
                      {isEditMode && (
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleDocumentUpload('aadhar', e.target.files[0])}
                              className="hidden"
                              id="aadhar-upload"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={uploadingDoc === 'aadhar'}
                              onClick={() => document.getElementById('aadhar-upload').click()}
                            >
                              {uploadingDoc === 'aadhar' ? 'Uploading...' : uploadedDocs.aadhar ? '✓ Uploaded' : 'Upload'}
                            </Button>
                          </label>
                          {uploadedDocs.aadhar && (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleDocumentScan('aadhar')}
                              disabled={scanningDoc === 'aadhar'}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {scanningDoc === 'aadhar' ? 'Scanning...' : 'Scan'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PAN Card */}
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-4">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">PAN Card</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        {isEditMode ? (
                          <Input
                            value={editedLead.pan_card || ''}
                            onChange={(e) => handleFieldChange('pan_card', e.target.value)}
                            className="dark:bg-gray-700 dark:border-gray-600"
                            placeholder="PAN Number"
                          />
                        ) : (
                          <p className="text-base text-gray-900 dark:text-white">
                            {selectedLead.pan_card || 'Not provided'}
                          </p>
                        )}
                      </div>
                      {isEditMode && (
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleDocumentUpload('pan', e.target.files[0])}
                              className="hidden"
                              id="pan-upload"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={uploadingDoc === 'pan'}
                              onClick={() => document.getElementById('pan-upload').click()}
                            >
                              {uploadingDoc === 'pan' ? 'Uploading...' : uploadedDocs.pan ? '✓ Uploaded' : 'Upload'}
                            </Button>
                          </label>
                          {uploadedDocs.pan && (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleDocumentScan('pan')}
                              disabled={scanningDoc === 'pan'}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {scanningDoc === 'pan' ? 'Scanning...' : 'Scan'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gas Bill */}
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-4">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Gas Bill</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        {isEditMode ? (
                          <Input
                            value={editedLead.gas_bill || ''}
                            onChange={(e) => handleFieldChange('gas_bill', e.target.value)}
                            className="dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Address from gas bill"
                          />
                        ) : (
                          <p className="text-base text-gray-900 dark:text-white">
                            {selectedLead.gas_bill || 'Not provided'}
                          </p>
                        )}
                      </div>
                      {isEditMode && (
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleDocumentUpload('gas_bill', e.target.files[0])}
                              className="hidden"
                              id="gas-bill-upload"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={uploadingDoc === 'gas_bill'}
                              onClick={() => document.getElementById('gas-bill-upload').click()}
                            >
                              {uploadingDoc === 'gas_bill' ? 'Uploading...' : uploadedDocs.gas_bill ? '✓ Uploaded' : 'Upload'}
                            </Button>
                          </label>
                          {uploadedDocs.gas_bill && (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleDocumentScan('gas_bill')}
                              disabled={scanningDoc === 'gas_bill'}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {scanningDoc === 'gas_bill' ? 'Scanning...' : 'Scan'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bank Passbook */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Bank Passbook</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        {isEditMode ? (
                          <Input
                            value={editedLead.bank_passbook || ''}
                            onChange={(e) => handleFieldChange('bank_passbook', e.target.value)}
                            className="dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Bank Account Number"
                          />
                        ) : (
                          <p className="text-base text-gray-900 dark:text-white">
                            {selectedLead.bank_passbook || 'Not provided'}
                          </p>
                        )}
                      </div>
                      {isEditMode && (
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleDocumentUpload('bank_passbook', e.target.files[0])}
                              className="hidden"
                              id="bank-passbook-upload"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={uploadingDoc === 'bank_passbook'}
                              onClick={() => document.getElementById('bank-passbook-upload').click()}
                            >
                              {uploadingDoc === 'bank_passbook' ? 'Uploading...' : uploadedDocs.bank_passbook ? '✓ Uploaded' : 'Upload'}
                            </Button>
                          </label>
                          {uploadedDocs.bank_passbook && (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleDocumentScan('bank_passbook')}
                              disabled={scanningDoc === 'bank_passbook'}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {scanningDoc === 'bank_passbook' ? 'Scanning...' : 'Scan'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badge Number (No upload needed) */}
                  <div className="border-t border-blue-200 dark:border-blue-800 pt-4 mt-2">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Badge Number</Label>
                    {isEditMode ? (
                      <Input
                        value={editedLead.badge_no || ''}
                        onChange={(e) => handleFieldChange('badge_no', e.target.value)}
                        className="dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Enter badge number"
                      />
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white">
                        {selectedLead.badge_no || 'Not provided'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Shift and Vehicle Details Section */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Shift & Vehicle Assignment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Preferred Shift</Label>
                    {isEditMode ? (
                      <Select
                        value={editedLead.preferred_shift || ""}
                        onValueChange={(value) => handleFieldChange('preferred_shift', value)}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="Morning">Morning (6 AM - 2 PM)</SelectItem>
                          <SelectItem value="Afternoon">Afternoon (2 PM - 10 PM)</SelectItem>
                          <SelectItem value="Night">Night (10 PM - 6 AM)</SelectItem>
                          <SelectItem value="Flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.preferred_shift || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Allotted Shift</Label>
                    {isEditMode ? (
                      <Select
                        value={editedLead.allotted_shift || ""}
                        onValueChange={(value) => handleFieldChange('allotted_shift', value)}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="Morning">Morning (6 AM - 2 PM)</SelectItem>
                          <SelectItem value="Afternoon">Afternoon (2 PM - 10 PM)</SelectItem>
                          <SelectItem value="Night">Night (10 PM - 6 AM)</SelectItem>
                          <SelectItem value="Flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.allotted_shift || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">Default Vehicle</Label>
                    {isEditMode ? (
                      <Input
                        value={editedLead.default_vehicle || ''}
                        onChange={(e) => handleFieldChange('default_vehicle', e.target.value)}
                        className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Vehicle number or ID"
                      />
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.default_vehicle || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600 dark:text-gray-400">End Date</Label>
                    {isEditMode ? (
                      <Input
                        type="date"
                        value={editedLead.end_date || ''}
                        onChange={(e) => handleFieldChange('end_date', e.target.value)}
                        className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                      />
                    ) : (
                      <p className="text-base text-gray-900 dark:text-white mt-1">
                        {selectedLead.end_date || '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Import Date</Label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">
                    {selectedLead.import_date ? new Date(selectedLead.import_date).toLocaleString() : '-'}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                {isMasterAdmin && (
                  <Button
                    onClick={() => setDeleteDialogOpen(true)}
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <XCircle size={18} className="mr-2" />
                    Delete Lead
                  </Button>
                )}
                
                <div className={`flex space-x-3 ${!isMasterAdmin ? 'ml-auto' : ''}`}>
                  {isEditMode && (
                    <Button
                      onClick={handleSaveChanges}
                      disabled={updatingStatus}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updatingStatus ? (
                        <>
                          <RefreshCw size={18} className="mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setDetailDialogOpen(false);
                      setIsEditMode(false);
                      setHasUnsavedChanges(false);
                    }}
                    variant="outline"
                    className="dark:border-gray-600"
                  >
                    Close
                  </Button>
                  
                  {isEditMode && hasUnsavedChanges && (
                    <Button
                      onClick={handleSaveChanges}
                      className="bg-blue-600 hover:bg-blue-700 animate-pulse"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Status Update Dialog */}
      <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Bulk Update Status</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Update status for {selectedLeadIds.length} selected lead(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-sm text-gray-700 dark:text-gray-300 mb-3 block">
                Select New Status
              </Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Choose status..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                onClick={() => setBulkStatusDialogOpen(false)}
                variant="outline"
                className="dark:border-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkStatusUpdate}
                disabled={!bulkStatus || updatingStatus}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updatingStatus ? (
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
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              {selectedLeadIds.length > 0 && !selectedLead ? "Delete Multiple Leads" : "Delete Lead"}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {selectedLeadIds.length > 0 && !selectedLead 
                ? `Are you sure you want to delete ${selectedLeadIds.length} selected lead(s)? This action cannot be undone.`
                : "Are you sure you want to delete this lead? This action cannot be undone."
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {selectedLead ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="font-semibold text-gray-900 dark:text-white">{selectedLead.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedLead.phone_number}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Status: <span className={`px-2 py-1 rounded ${getStatusColor(selectedLead.status)}`}>
                    {selectedLead.status || "New"}
                  </span>
                </p>
              </div>
            ) : selectedLeadIds.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center space-x-2">
                  <XCircle className="text-red-600" size={20} />
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedLeadIds.length} lead(s) will be permanently deleted
                  </p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  This includes all their information and cannot be recovered.
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                onClick={() => setDeleteDialogOpen(false)}
                variant="outline"
                className="dark:border-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteLead}
                disabled={deletingLead}
                className="bg-red-600 hover:bg-red-700"
              >
                {deletingLead ? (
                  <>
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <XCircle size={18} className="mr-2" />
                    Delete {selectedLeadIds.length > 0 && !selectedLead ? `${selectedLeadIds.length} Leads` : "Lead"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Detection Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="dark:bg-gray-800 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center space-x-2">
              <XCircle className="text-orange-600" size={24} />
              <span>Duplicates Found - Smart Phone Matching</span>
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Found {duplicateData?.duplicate_count || 0} leads with duplicate phone numbers (matched by last 10 digits)
            </DialogDescription>
          </DialogHeader>
          
          {duplicateData && (
            <div className="space-y-4 mt-4">
              {/* Summary */}
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total in File</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {duplicateData.total_in_file}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates (Skipped)</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {duplicateData.duplicate_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Imported</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {duplicateData.imported_count}
                    </p>
                  </div>
                </div>
              </div>

              {/* Duplicate List - Show ALL */}
              {duplicateData.duplicates && duplicateData.duplicates.length > 0 && (
                <div className="max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Duplicate Leads (all {duplicateData.duplicates.length}):
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Matched by last 10 digits
                    </p>
                  </div>
                  
                  {/* Table view for better readability */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-900/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            #
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            New Lead Name
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            Phone Number
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            Existing Lead
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {duplicateData.duplicates.map((dup, index) => (
                          <tr 
                            key={index}
                            className="hover:bg-gray-50 dark:hover:bg-gray-900/30"
                          >
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {index + 1}
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                              {dup.name}
                            </td>
                            <td className="px-3 py-2">
                              <div className="space-y-1">
                                <p className="text-gray-900 dark:text-white font-mono text-xs">
                                  {dup.phone_number}
                                </p>
                                {dup.normalized_phone && (
                                  <p className="text-xs text-gray-500 dark:text-gray-500">
                                    Normalized: {dup.normalized_phone}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="space-y-1">
                                <p className="text-gray-900 dark:text-white">
                                  {dup.existing_name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                                  {dup.existing_phone}
                                </p>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(dup.existing_status)}`}>
                                {dup.existing_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Quick Phone List for Copy/Paste */}
              {duplicateData.duplicate_phones && duplicateData.duplicate_phones.length > 0 && (
                <div className="p-3 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Duplicate Phone Numbers (for reference):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {duplicateData.duplicate_phones.map((phone, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs font-mono border border-gray-300 dark:border-gray-600"
                      >
                        {phone}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Message */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  ℹ️ <strong>Smart Matching:</strong> Phone numbers are matched by their last 10 digits, so "+91 98765 43210", "9876543210", and "91-9876543210" are all considered the same.
                </p>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => {
                    setDuplicateDialogOpen(false);
                    setDuplicateData(null);
                    fetchLeads(); // Refresh to show imported leads
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ✓ OK, Got it
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverOnboardingPage;
