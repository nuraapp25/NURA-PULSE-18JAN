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
import { Upload, Users, FileSpreadsheet, RefreshCw, Plus, Calendar as CalendarIcon, Filter, X, CheckSquare, Square, XCircle } from "lucide-react";
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
  { value: "New", label: "New" },
  { value: "Contacted", label: "Contacted" },
  { value: "Qualified", label: "Qualified" },
  { value: "Assigned to Telecaller", label: "Assigned to Telecaller" },
  { value: "In Progress", label: "In Progress" },
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
  
  // Bulk selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  
  // Date filter states
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // Stage filter states
  const [leadStageFilter, setLeadStageFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [driverReadinessFilter, setDriverReadinessFilter] = useState("All");
  const [docsCollectionFilter, setDocsCollectionFilter] = useState("All");
  const [customerReadinessFilter, setCustomerReadinessFilter] = useState("All");
  const [showStageFilters, setShowStageFilters] = useState(false);
  
  // Edit mode for lead details
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedLead, setEditedLead] = useState(null);
  
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

    // Stage filters
    if (leadStageFilter !== "All") {
      filtered = filtered.filter(lead => (lead.lead_stage || "New") === leadStageFilter);
    }
    if (statusFilter !== "All") {
      filtered = filtered.filter(lead => (lead.status || "New") === statusFilter);
    }
    if (driverReadinessFilter !== "All") {
      filtered = filtered.filter(lead => (lead.driver_readiness || "Not Started") === driverReadinessFilter);
    }
    if (docsCollectionFilter !== "All") {
      filtered = filtered.filter(lead => (lead.docs_collection || "Pending") === docsCollectionFilter);
    }
    if (customerReadinessFilter !== "All") {
      filtered = filtered.filter(lead => (lead.customer_readiness || "Not Ready") === customerReadinessFilter);
    }

    setFilteredLeads(filtered);
  }, [startDate, endDate, leadStageFilter, statusFilter, driverReadinessFilter, docsCollectionFilter, customerReadinessFilter, leads]);

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
    
    if (!leadSource || !leadDate) {
      toast.error("Please enter lead source and date");
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('lead_source', leadSource);
      formData.append('lead_date', leadDate);

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
      
      // Update last sync time after edit
      await fetchLastSyncTime();
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update lead");
    } finally {
      setUpdatingStatus(false);
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
    setLeadStageFilter("All");
    setStatusFilter("All");
    setDriverReadinessFilter("All");
    setDocsCollectionFilter("All");
    setCustomerReadinessFilter("All");
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <div>
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2">Lead Stage</Label>
                <Select value={leadStageFilter} onValueChange={setLeadStageFilter}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    <SelectItem value="All">All</SelectItem>
                    {LEAD_STAGE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    <SelectItem value="All">All</SelectItem>
                    {STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2">Driver Readiness</Label>
                <Select value={driverReadinessFilter} onValueChange={setDriverReadinessFilter}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    <SelectItem value="All">All</SelectItem>
                    {DRIVER_READINESS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2">Docs Collection</Label>
                <Select value={docsCollectionFilter} onValueChange={setDocsCollectionFilter}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    <SelectItem value="All">All</SelectItem>
                    {DOCS_COLLECTION_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2">Customer Readiness</Label>
                <Select value={customerReadinessFilter} onValueChange={setCustomerReadinessFilter}>
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    <SelectItem value="All">All</SelectItem>
                    {CUSTOMER_READINESS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredLeads.length} of {leads.length} leads
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
                        <span className={`px-1 sm:px-2 py-1 rounded text-xs font-medium ${getStatusColor(lead.status || "New")}`}>
                          {lead.status || "New"}
                        </span>
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
              </ul>
            </div>

            <div>
              <Label htmlFor="lead-source" className="text-gray-700 dark:text-gray-300">
                Lead Source *
              </Label>
              <Input
                id="lead-source"
                type="text"
                placeholder="e.g., Facebook Ad, Referral, Walk-in"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="mt-1.5 dark:bg-gray-700 dark:border-gray-600"
              />
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
              disabled={!selectedFile || !leadSource || !leadDate || importing}
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
                  onValueChange={handleStatusUpdate}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
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
                    }}
                    variant="outline"
                    className="dark:border-gray-600"
                  >
                    Close
                  </Button>
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
        <DialogContent className="dark:bg-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center space-x-2">
              <XCircle className="text-orange-600" size={24} />
              <span>Duplicates Found</span>
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              We found leads with duplicate phone numbers in the system
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {duplicateData.duplicate_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">New Leads</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {duplicateData.new_leads_count}
                    </p>
                  </div>
                </div>
              </div>

              {/* Duplicate List */}
              <div className="max-h-60 overflow-y-auto">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Duplicate Leads (showing up to 10):
                </p>
                <div className="space-y-2">
                  {duplicateData.duplicates.map((dup, index) => (
                    <div 
                      key={index} 
                      className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {dup.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {dup.phone_number}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-500">Already exists as:</p>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {dup.existing_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                  Choose an action:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleDuplicateAction('skip')}
                    disabled={importing}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {importing ? (
                      <>
                        <RefreshCw size={18} className="mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle size={18} className="mr-2" />
                        Skip Duplicates
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleDuplicateAction('add_copy')}
                    disabled={importing}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {importing ? (
                      <>
                        <RefreshCw size={18} className="mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus size={18} className="mr-2" />
                        Add Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  <strong>Skip:</strong> Import only {duplicateData.new_leads_count} new lead(s)<br />
                  <strong>Add Copy:</strong> Import all {duplicateData.total_in_file} lead(s), duplicates will be renamed with "-copy" suffix
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverOnboardingPage;
