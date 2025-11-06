import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Upload, Users, FileSpreadsheet, RefreshCw, Plus, Calendar as CalendarIcon, Filter, X, CheckSquare, Square, XCircle, Save, ChevronDown, ChevronLeft, ChevronRight, Eye, Download, Trash2, DownloadCloud, UploadCloud, Archive, RotateCcw, Copy } from "lucide-react";
import { format } from "date-fns";
import LeadDetailsDialog from "@/components/LeadDetailsDialog";

// Helper function to format status display
// Removes alphabet codes like "S1-a Not interested" → "S1 - Not interested"
const formatStatusDisplay = (status) => {
  if (!status) return "";
  
  // Pattern: "S1-a Not interested" or "S2-b Docs Upload Pending"
  // Replace "S1-a" with "S1 -", "S2-b" with "S2 -", etc.
  const formatted = status.replace(/^(S[1-4])-[a-z]\s+/i, '$1 - ');
  return formatted;
};

// Define stages
const STAGES = [
  { value: "S1", label: "S1 - Filtering" },
  { value: "S2", label: "S2 - Docs Collection" },
  { value: "S3", label: "S3 - Training" },
  { value: "S4", label: "S4 - Customer Readiness" }
];

// S1 - Filtering Stage
const S1_STATUSES = [
  { value: "New", label: "New", color: "bg-yellow-100 text-yellow-700" },
  { value: "Not Interested", label: "Not Interested", color: "bg-gray-100 text-gray-700" },
  { value: "Interested, No DL", label: "Interested, No DL", color: "bg-gray-100 text-gray-700" },
  { value: "Interested, No Badge", label: "Interested, No Badge", color: "bg-gray-100 text-gray-700" },
  { value: "Highly Interested", label: "Highly Interested", color: "bg-green-100 text-green-700" },  // Green = completion
  { value: "Call back 1D", label: "Call back 1D", color: "bg-blue-100 text-blue-700" },
  { value: "Call back 1W", label: "Call back 1W", color: "bg-blue-100 text-blue-700" },
  { value: "Call back 2W", label: "Call back 2W", color: "bg-blue-100 text-blue-700" },
  { value: "Call back 1M", label: "Call back 1M", color: "bg-blue-100 text-blue-700" },
];

// S2 - Docs Collection Stage
const S2_STATUSES = [
  { value: "Docs Upload Pending", label: "Docs Upload Pending", color: "bg-yellow-100 text-yellow-700" },
  { value: "Verification Pending", label: "Verification Pending", color: "bg-gray-100 text-gray-700" },
  { value: "Duplicate License", label: "Duplicate License", color: "bg-gray-100 text-gray-700" },
  { value: "DL - Amount", label: "DL - Amount", color: "bg-gray-100 text-gray-700" },
  { value: "Verified", label: "Verified", color: "bg-green-100 text-green-700" },  // Green = completion
  { value: "Verification Rejected", label: "Verification Rejected", color: "bg-red-100 text-red-700" },
];

// S3 - Training Stage
const S3_STATUSES = [
  { value: "Schedule Pending", label: "Schedule Pending", color: "bg-yellow-100 text-yellow-700" },
  { value: "Training WIP", label: "Training WIP", color: "bg-gray-100 text-gray-700" },
  { value: "Training Completed", label: "Training Completed", color: "bg-green-100 text-green-700" },
  { value: "Training Rejected", label: "Training Rejected", color: "bg-red-100 text-red-700" },
  { value: "Re-Training", label: "Re-Training", color: "bg-gray-100 text-gray-700" },
  { value: "Absent for training", label: "Absent for training", color: "bg-gray-100 text-gray-700" },
  { value: "Approved", label: "Approved", color: "bg-green-100 text-green-700" },  // Green = completion
];

// S4 - Customer Readiness Stage
const S4_STATUSES = [
  { value: "CT Pending", label: "CT Pending", color: "bg-yellow-100 text-yellow-700" },
  { value: "CT WIP", label: "CT WIP", color: "bg-gray-100 text-gray-700" },
  { value: "Shift Details Pending", label: "Shift Details Pending", color: "bg-gray-100 text-gray-700" },
  { value: "DONE!", label: "DONE!", color: "bg-green-100 text-green-700" },  // Green = completion
  { value: "Training Rejected", label: "Training Rejected", color: "bg-red-100 text-red-700" },
  { value: "Re-Training", label: "Re-Training", color: "bg-gray-100 text-gray-700" },
  { value: "Absent for training", label: "Absent for training", color: "bg-gray-100 text-gray-700" },
  { value: "Terminated", label: "Terminated", color: "bg-red-100 text-red-700" },
];

// Get statuses for a specific stage
const getStatusesForStage = (stage) => {
  switch (stage) {
    case "S1": return S1_STATUSES;
    case "S2": return S2_STATUSES;
    case "S3": return S3_STATUSES;
    case "S4": return S4_STATUSES;
    default: return S1_STATUSES;
  }
};

// Get completion status for each stage (for auto-progression)
const getCompletionStatus = (stage) => {
  switch (stage) {
    case "S1": return "Highly Interested";
    case "S2": return "Verified";
    case "S3": return "Approved";
    case "S4": return "DONE!";
    default: return null;
  }
};

// Legacy options for backward compatibility (if needed)
const STATUS_OPTIONS = [
  ...S1_STATUSES,
  ...S2_STATUSES,
  ...S3_STATUSES,
  ...S4_STATUSES
];

const LEAD_STAGE_OPTIONS = [
  { value: "all", label: "All Stages" },
  { value: "S1", label: "S1 - Filtering" },
  { value: "S2", label: "S2 - Docs Collection" },
  { value: "S3", label: "S3 - Training" },
  { value: "S4", label: "S4 - Customer Readiness" },
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
  const [syncing, setSyncing] = useState(false); // For Google Sheets sync loading
  const [assigning, setAssigning] = useState(false); // For bulk assign loading
  const [unassigning, setUnassigning] = useState(false); // For unassign loading
  
  // Lead source and date for imports
  const [leadSource, setLeadSource] = useState("");
  const [leadDate, setLeadDate] = useState("");
  const [readSourceFromFile, setReadSourceFromFile] = useState(false);
  
  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState(null);
  
  // Track pending status changes (for manual apply)
  const [pendingStatusChanges, setPendingStatusChanges] = useState({}); // { leadId: { status, stage, originalStatus, originalStage } }
  
  // Track changes in edit dialog
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Bulk selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null); // For shift-click range selection
  
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
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(20);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Bulk Export/Import and Backup Library states
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  
  // Column mapping states
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [excelColumns, setExcelColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [previewData, setPreviewData] = useState([]);
  
  const [backupLibraryOpen, setBackupLibraryOpen] = useState(false);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  
  // Source filter - Fetch unique import sources from backend
  const [sourceFilter, setSourceFilter] = useState(null);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  
  // Extract unique statuses from all leads
  const uniqueStatuses = [...new Set(
    leads
      .map(l => l.status?.trim())
      .filter(Boolean)
  )].sort();
  
  // Telecallers for assignment
  const [telecallers, setTelecallers] = useState([]);
  const [telecallerFilter, setTelecallerFilter] = useState(null);
  
  // Debounced search
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  
  
  // Status filter state
  const [statusFilter, setStatusFilter] = useState(null);
  
  // Bulk lead assignment dialog
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = useState(false);
  const [selectedTelecallerForAssignment, setSelectedTelecallerForAssignment] = useState("");
  const [assignmentDate, setAssignmentDate] = useState("");
  
  // Loading progress state
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Calculate pagination (client-side slicing of all leads)
  const startIndex = (currentPage - 1) * leadsPerPage;
  const endIndex = startIndex + leadsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);
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
  
  // Status Summary Dashboard
  const [statusSummary, setStatusSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryStartDate, setSummaryStartDate] = useState(null);
  const [summaryEndDate, setSummaryEndDate] = useState(null);
  const [summarySourceFilter, setSummarySourceFilter] = useState(null); // New: source filter for summary dashboard

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

  const fetchLeads = async (pageNum = 1) => {
    setLoading(true);
    setLoadingProgress(0);
    
    // Simulate progress bar animation
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        const increment = Math.random() * 15;
        const newProgress = prev + increment;
        return Math.min(newProgress, 90);
      });
    }, 200);
    
    try {
      const token = localStorage.getItem("token");
      
      // Build query params - fetch ALL leads without pagination
      const params = new URLSearchParams();
      params.append('skip_pagination', 'true'); // Get all leads
      if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
        params.append('search', debouncedSearchQuery.trim());
      }
      
      // Add date filter parameters
      if (startDate) {
        params.append('start_date', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        params.append('end_date', format(endDate, 'yyyy-MM-dd'));
      }
      
      const response = await axios.get(`${API}/driver-onboarding/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Jump to 95% when data is received
      setLoadingProgress(95);
      
      // Handle response (all leads)
      const fetchedLeads = response.data.leads || response.data;
      setLeads(fetchedLeads);
      setFilteredLeads(fetchedLeads);
      setTotalLeads(fetchedLeads.length);
      
      // Calculate total pages for client-side pagination
      const calculatedTotalPages = Math.ceil(fetchedLeads.length / leadsPerPage);
      setTotalPages(calculatedTotalPages);
      
      // Fetch last sync time after fetching leads
      await fetchLastSyncTime();
      
      // Fetch status summary
      await fetchStatusSummary();
      
      // Complete progress - cap at exactly 100%
      setLoadingProgress(100);
    } catch (error) {
      toast.error("Failed to fetch leads");
    } finally {
      clearInterval(progressInterval);
      // Small delay to show 100% before hiding
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
      }, 500);
    }
  };
  
  const fetchTelecallers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/users/telecallers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Backend already filters for active telecallers (status !== "deleted")
      setTelecallers(response.data);
    } catch (error) {
      console.error("Failed to fetch telecallers");
    }
  };

  const fetchStatusSummary = async () => {
    setSummaryLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = {};
      
      if (summaryStartDate) {
        params.start_date = format(summaryStartDate, 'yyyy-MM-dd');
      }
      if (summaryEndDate) {
        params.end_date = format(summaryEndDate, 'yyyy-MM-dd');
      }
      if (summarySourceFilter) {
        params.source = summarySourceFilter;
      }
      
      const response = await axios.get(`${API}/driver-onboarding/status-summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setStatusSummary(response.data);
    } catch (error) {
      console.error("Failed to fetch status summary:", error);
      toast.error("Failed to fetch status summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchTelecallers();
  }, []);
  
  // Refresh telecallers when page becomes visible (handles tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTelecallers();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Fetch unique import sources for filter dropdown
  useEffect(() => {
    const fetchSources = async () => {
      setLoadingSources(true);
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API}/driver-onboarding/sources`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setSourceOptions(response.data.sources || []);
        }
      } catch (error) {
        console.error("Failed to fetch sources:", error);
        // Fallback: extract from current leads if API fails
        const fallbackSources = [...new Set(
          leads.map(l => l.source?.trim()).filter(Boolean)
        )].sort().map(source => ({ value: source, label: source }));
        setSourceOptions(fallbackSources);
      } finally {
        setLoadingSources(false);
      }
    };
    
    fetchSources();
  }, [leads.length]); // Refetch when leads count changes
  
  // Debounce search query (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Fetch leads when debounced search changes
  useEffect(() => {
    fetchLeads();
  }, [debouncedSearchQuery]);
  
  // Refetch leads when date filters change
  useEffect(() => {
    if (startDate || endDate) {
      fetchLeads();
    }
  }, [startDate, endDate]);
  
  // Refetch summary when date or source filter changes
  useEffect(() => {
    if (leads.length > 0) {
      fetchStatusSummary();
    }
  }, [summaryStartDate, summaryEndDate, summarySourceFilter]);

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
      if (activeStageFilter === "S1") {
        const s1Statuses = S1_STATUSES.map(opt => opt.value);
        filtered = filtered.filter(lead => s1Statuses.includes(lead.status));
      } else if (activeStageFilter === "S2") {
        const s2Statuses = S2_STATUSES.map(opt => opt.value);
        filtered = filtered.filter(lead => s2Statuses.includes(lead.status));
      } else if (activeStageFilter === "S3") {
        const s3Statuses = S3_STATUSES.map(opt => opt.value);
        filtered = filtered.filter(lead => s3Statuses.includes(lead.status));
      } else if (activeStageFilter === "S4") {
        const s4Statuses = S4_STATUSES.map(opt => opt.value);
        filtered = filtered.filter(lead => s4Statuses.includes(lead.status));
      }
    }
    
    // Sub-status filter (specific status within a stage)
    if (activeSubStatus) {
      filtered = filtered.filter(lead => lead.status === activeSubStatus);
    }
    
    // Source filter (using 'source' field from import)
    if (sourceFilter) {
      filtered = filtered.filter(lead => 
        lead.source && lead.source.toLowerCase() === sourceFilter.toLowerCase()
      );
    }
    
    // Telecaller filter
    if (telecallerFilter) {
      if (telecallerFilter === "UNASSIGNED") {
        // Show only leads that have no telecaller assigned
        filtered = filtered.filter(lead => !lead.assigned_telecaller || lead.assigned_telecaller === "");
      } else {
        // Show leads assigned to specific telecaller
        filtered = filtered.filter(lead => lead.assigned_telecaller === telecallerFilter);
      }
    }
    
    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    setFilteredLeads(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [leads, startDate, endDate, activeStageFilter, activeSubStatus, sourceFilter, telecallerFilter, statusFilter]);

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
    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/driver-onboarding/sync-leads`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`✅ Successfully synced ${response.data.updated || 0} updated and ${response.data.created || 0} new leads to Google Sheets!`);
      
      // Update last sync time
      await fetchLastSyncTime();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to sync to Google Sheets");
    } finally {
      setSyncing(false);
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

  const handleLeadClick = async (lead, e) => {
    // Don't open dialog if clicking on checkbox
    if (e.target.type === 'checkbox' || e.target.closest('label')) {
      return;
    }
    
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
    
    setIsEditMode(false); // Start in view mode
    setDetailDialogOpen(true);
    // Fetch documents status for this lead
    setTimeout(() => {
      fetchDocumentsStatus(lead.id);
    }, 100);
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
          email: editedLead.email,
          vehicle: editedLead.vehicle,
          driving_license: editedLead.driving_license,
          experience: editedLead.experience,
          interested_ev: editedLead.interested_ev,
          monthly_salary: editedLead.monthly_salary,
          current_location: editedLead.current_location,
          preferred_shift: editedLead.preferred_shift,
          stage: editedLead.stage,
          status: editedLead.status,
          assigned_telecaller: editedLead.assigned_telecaller,
          telecaller_notes: editedLead.telecaller_notes,
          notes: editedLead.notes,
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
      
      // Update local state immediately
      const updatedLead = response.data.lead;
      
      // Update main leads array
      const updatedLeads = leads.map(lead => 
        lead.id === editedLead.id ? updatedLead : lead
      );
      setLeads(updatedLeads);
      
      // Update filtered leads array
      const updatedFilteredLeads = filteredLeads.map(lead => 
        lead.id === editedLead.id ? updatedLead : lead
      );
      setFilteredLeads(updatedFilteredLeads);
      
      // Update selected and edited lead states
      setSelectedLead(updatedLead); // Update the selected lead with fresh data
      setEditedLead({...updatedLead}); // Update edited lead copy
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      
      // Refetch leads to update summary (do this in background)
      fetchLeads().catch(err => console.error("Failed to refresh leads:", err));
      
      // Refetch status summary to reflect changes immediately
      fetchStatusSummary().catch(err => console.error("Failed to refresh status summary:", err));
      
      // Update last sync time after edit
      fetchLastSyncTime().catch(err => console.error("Failed to fetch sync time:", err));
      
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
        // Refresh document status
        await fetchDocumentsStatus();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to upload ${documentType}`);
    } finally {
      setUploadingDoc(null);
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
    if (!confirm(`Are you sure you want to delete the ${documentType.toUpperCase()} document?`)) {
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
  
  // Handle inline status change (store pending change, don't call API immediately)
  const handleInlineStatusChange = (leadId, newStatus) => {
    // Find the lead
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    
    // Determine which stage this status belongs to
    let newStage = lead.stage || "S1";
    if (S1_STATUSES.find(s => s.value === newStatus)) {
      newStage = "S1";
    } else if (S2_STATUSES.find(s => s.value === newStatus)) {
      newStage = "S2";
    } else if (S3_STATUSES.find(s => s.value === newStatus)) {
      newStage = "S3";
    } else if (S4_STATUSES.find(s => s.value === newStatus)) {
      newStage = "S4";
    }
    
    // Store the original values if this is the first change for this lead
    const originalStatus = pendingStatusChanges[leadId]?.originalStatus || lead.status;
    const originalStage = pendingStatusChanges[leadId]?.originalStage || lead.stage;
    
    // Update UI immediately (optimistic update)
    setLeads(prevLeads =>
      prevLeads.map(l => (l.id === leadId ? { ...l, status: newStatus, stage: newStage } : l))
    );
    
    // Store pending change
    setPendingStatusChanges(prev => ({
      ...prev,
      [leadId]: {
        status: newStatus,
        stage: newStage,
        originalStatus: originalStatus,
        originalStage: originalStage
      }
    }));
    
    // Keep the dropdown open
    // setInlineEditingId(null); - Don't close it immediately
  };
  
  // Apply the pending status change for a specific lead
  const handleApplyStatusChange = async (leadId) => {
    const pendingChange = pendingStatusChanges[leadId];
    if (!pendingChange) return;
    
    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem("token");
      
      // Single API call with both status and stage
      await axios.patch(
        `${API}/driver-onboarding/leads/${leadId}`,
        { status: pendingChange.status, stage: pendingChange.stage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Status updated successfully");
      
      // Remove from pending changes
      setPendingStatusChanges(prev => {
        const updated = { ...prev };
        delete updated[leadId];
        return updated;
      });
      
      // Close the dropdown
      setInlineEditingId(null);
      
      await fetchLastSyncTime();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
      
      // Revert on error
      const lead = leads.find(l => l.id === leadId);
      if (lead && pendingChange) {
        setLeads(prevLeads =>
          prevLeads.map(l => (l.id === leadId ? { ...l, status: pendingChange.originalStatus, stage: pendingChange.originalStage } : l))
        );
        
        // Remove from pending changes
        setPendingStatusChanges(prev => {
          const updated = { ...prev };
          delete updated[leadId];
          return updated;
        });
      }
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  // Cancel pending status change for a specific lead
  const handleCancelStatusChange = (leadId) => {
    const pendingChange = pendingStatusChanges[leadId];
    if (!pendingChange) return;
    
    // Revert to original values
    setLeads(prevLeads =>
      prevLeads.map(l => (l.id === leadId ? { ...l, status: pendingChange.originalStatus, stage: pendingChange.originalStage } : l))
    );
    
    // Remove from pending changes
    setPendingStatusChanges(prev => {
      const updated = { ...prev };
      delete updated[leadId];
      return updated;
    });
    
    // Close the dropdown
    setInlineEditingId(null);
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

  // Stage sync handler - auto-progress to next stage
  const handleStageSync = async (leadId) => {
    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/driver-onboarding/leads/${leadId}/sync-stage`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        
        // Update local state with new stage and status
        const updatedLeads = leads.map(lead => 
          lead.id === leadId 
            ? { ...lead, stage: response.data.new_stage, status: response.data.new_status } 
            : lead
        );
        setLeads(updatedLeads);
        setSelectedLead({ 
          ...selectedLead, 
          stage: response.data.new_stage, 
          status: response.data.new_status 
        });
        
        // Update last sync time
        await fetchLastSyncTime();
      } else {
        toast.error(response.data.message);
      }
      
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || "Failed to sync stage";
      toast.error(errorMessage);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    setSelectedLeadIds(filteredLeads.map(lead => lead.id));
  };
  
  // NEW: Select all leads in current page only
  const handleSelectAllInPage = () => {
    setSelectedLeadIds(paginatedLeads.map(lead => lead.id));
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
    setLastSelectedIndex(null);
  };

  const handleLeadCheckboxChange = (leadId, index, event) => {
    // Check if shift key is pressed for range selection
    if (event?.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const currentIndex = index;
      const start = Math.min(lastSelectedIndex, currentIndex);
      const end = Math.max(lastSelectedIndex, currentIndex);
      
      // Get IDs of leads in range
      const leadsInRange = paginatedLeads.slice(start, end + 1).map(lead => lead.id);
      
      // Add all leads in range to selection
      setSelectedLeadIds(prev => {
        const newSelection = new Set([...prev, ...leadsInRange]);
        return Array.from(newSelection);
      });
    } else {
      // Normal single selection
      setSelectedLeadIds(prev => {
        if (prev.includes(leadId)) {
          return prev.filter(id => id !== leadId);
        } else {
          return [...prev, leadId];
        }
      });
      setLastSelectedIndex(index);
    }
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
      
      // Refresh status summary dashboard to reflect bulk changes
      await fetchStatusSummary();
      
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
  
  // NEW: Show all leads - clears ALL filters including search
  const handleShowAllLeads = () => {
    setStartDate(null);
    setEndDate(null);
    setActiveStageFilter("all");
    setActiveSubStatus(null);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setTelecallerFilter(null);
    setCurrentPage(1);
    toast.success("All filters cleared. Showing all leads.");
  };
  
  // NEW: Click stage heading to show all leads in that stage
  const handleStageHeadingClick = (stage) => {
    setActiveStageFilter(stage);
    setActiveSubStatus(null); // Clear sub-status to show ALL statuses in stage
    setCurrentPage(1);
    toast.success(`Showing all leads in ${stage}`);
  };

  // Bulk lead assignment
  const handleBulkAssignLeads = async () => {
    if (!selectedTelecallerForAssignment) {
      toast.error("Please select a telecaller");
      return;
    }

    setAssigning(true);
    try {
      const token = localStorage.getItem("token");
      // Always use today's date for assignment
      const todayDate = new Date().toISOString().split('T')[0];
      
      await axios.patch(
        `${API}/driver-onboarding/bulk-assign`,
        {
          lead_ids: selectedLeadIds,
          telecaller_email: selectedTelecallerForAssignment,
          assignment_date: todayDate
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Get telecaller name
      const telecaller = telecallers.find(t => t.email === selectedTelecallerForAssignment);
      const telecallerName = telecaller ? telecaller.name : selectedTelecallerForAssignment.split('@')[0];

      // Update leads in memory instead of refetching all
      const updatedLeads = leads.map(lead => {
        if (selectedLeadIds.includes(lead.id)) {
          return {
            ...lead,
            assigned_telecaller: selectedTelecallerForAssignment,
            assigned_telecaller_name: telecallerName,
            assigned_date: new Date(todayDate).toISOString()
          };
        }
        return lead;
      });
      
      setLeads(updatedLeads);
      setFilteredLeads(updatedLeads);
      
      toast.success(`Successfully assigned ${selectedLeadIds.length} lead(s) to ${telecallerName} for today`);
      setSelectedLeadIds([]);
      setIsAssignDialogOpen(false);
      setSelectedTelecallerForAssignment("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to assign leads");
    } finally {
      setAssigning(false);
    }
  };

  // Bulk lead unassignment
  const handleUnassignLeads = async () => {
    if (selectedLeadIds.length === 0) {
      toast.error("Please select at least one lead");
      return;
    }

    if (!confirm(`Are you sure you want to unassign ${selectedLeadIds.length} lead(s) from their telecallers?`)) {
      return;
    }

    setUnassigning(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/telecallers/deassign-leads`,
        {
          lead_ids: selectedLeadIds
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update leads in memory instead of refetching all
      const updatedLeads = leads.map(lead => {
        if (selectedLeadIds.includes(lead.id)) {
          return {
            ...lead,
            assigned_telecaller: null,
            assigned_telecaller_name: null
          };
        }
        return lead;
      });
      
      setLeads(updatedLeads);
      setFilteredLeads(updatedLeads);

      toast.success(`Successfully unassigned ${selectedLeadIds.length} lead(s) from telecallers`);
      setSelectedLeadIds([]);
      setIsUnassignDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to unassign leads");
    } finally {
      setUnassigning(false);
    }
  };

  // ==================== BULK EXPORT/IMPORT & BACKUP LIBRARY HANDLERS ====================
  
  // Handle Bulk Export
  const handleBulkExport = async () => {
    setBulkExporting(true);
    try {
      const token = localStorage.getItem("token");
      toast.info("📊 Starting bulk export... This may take a few moments for large datasets.");
      
      const response = await axios.post(
        `${API}/driver-onboarding/bulk-export`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob',
          timeout: 300000 // 5 minutes timeout for large exports
        }
      );
      
      // Get total leads from response header
      const totalLeads = response.headers['x-total-leads'] || 'Unknown';
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'driver leads export.xlsx';
      
      if (contentDisposition) {
        // Try to extract filename from Content-Disposition header
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`✅ Successfully exported ${totalLeads} leads to Excel!`);
    } catch (error) {
      console.error("Bulk export error:", error);
      toast.error(error.response?.data?.detail || "Failed to export leads. Please try again.");
    } finally {
      setBulkExporting(false);
    }
  };
  
  // Parse Excel file and show column mapping
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    setBulkImportFile(file);
    
    try {
      // Parse Excel file using XLSX library
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          if (jsonData.length < 2) {
            toast.error("Excel file must have at least a header row and one data row");
            return;
          }
          
          // First row is headers
          const headers = jsonData[0];
          const columns = headers.map((header, index) => ({
            index,
            letter: String.fromCharCode(65 + index), // A, B, C, etc.
            name: header || `Column ${String.fromCharCode(65 + index)}`
          }));
          
          setExcelColumns(columns);
          
          // Preview data (first 3 rows excluding header)
          const preview = jsonData.slice(1, 4).map(row => 
            headers.reduce((obj, header, i) => {
              obj[header || `col_${i}`] = row[i];
              return obj;
            }, {})
          );
          setPreviewData(preview);
          
          // Initialize default mapping (try to auto-match)
          const defaultMapping = {};
          const fieldMap = {
            name: ['name', 'driver name', 'driver_name', 'full name', 'fullname'],
            phone_number: ['phone', 'phone number', 'phone_number', 'mobile', 'contact'],
            email: ['email', 'email address', 'e-mail'],
            vehicle: ['vehicle', 'vehicle type', 'vehicle_type'],
            driving_license: ['license', 'driving license', 'driving_license', 'dl'],
            experience: ['experience', 'years of experience', 'exp'],
            interested_ev: ['ev', 'interested ev', 'interested_ev', 'ev interest'],
            monthly_salary: ['salary', 'monthly salary', 'monthly_salary', 'expected salary'],
            current_location: ['location', 'current location', 'current_location', 'address'],
            status: ['status', 'lead status'],
            stage: ['stage', 'lead stage'],
            assigned_telecaller: ['telecaller', 'assigned telecaller', 'assigned_telecaller'],
            source: ['source', 'import source', 'lead source'],
            dl_no: ['dl no', 'dl_no', 'license number'],
            badge_no: ['badge', 'badge no', 'badge_no'],
            aadhar_card: ['aadhar', 'aadhar card', 'aadhar_card'],
            pan_card: ['pan', 'pan card', 'pan_card'],
            gas_bill: ['gas bill', 'gas_bill'],
            bank_passbook: ['bank', 'passbook', 'bank passbook', 'bank_passbook']
          };
          
          // Try to auto-match columns
          headers.forEach((header, index) => {
            const headerLower = (header || '').toLowerCase().trim();
            for (const [field, patterns] of Object.entries(fieldMap)) {
              if (patterns.some(pattern => headerLower.includes(pattern))) {
                defaultMapping[field] = index;
                break;
              }
            }
          });
          
          setColumnMapping(defaultMapping);
          setShowColumnMapping(true);
          
        } catch (parseError) {
          console.error("Error parsing Excel:", parseError);
          toast.error("Failed to parse Excel file. Please ensure it's a valid .xlsx or .xls file.");
        }
      };
      
      reader.readAsArrayBuffer(file);
      
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read Excel file");
    }
  };
  
  // Handle Bulk Import with Column Mapping
  const handleBulkImport = async () => {
    if (!bulkImportFile) {
      toast.error("Please select an Excel file to import");
      return;
    }
    
    if (!showColumnMapping) {
      toast.error("Please complete column mapping first");
      return;
    }
    
    // Validate required fields are mapped
    const requiredFields = ['name', 'phone_number'];
    const missingFields = requiredFields.filter(field => columnMapping[field] === undefined);
    
    if (missingFields.length > 0) {
      toast.error(`Please map these required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    // Confirmation dialog
    if (!window.confirm(
      "📥 Import New Leads\n\n" +
      "This will ADD new leads to your existing database.\n\n" +
      "• New leads will be added\n" +
      "• Duplicates (same phone number) will be skipped\n" +
      "• A backup will be created automatically\n" +
      "• Existing leads will NOT be deleted\n\n" +
      "Are you sure you want to proceed?"
    )) {
      return;
    }
    
    setBulkImporting(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append('file', bulkImportFile);
      formData.append('column_mapping', JSON.stringify(columnMapping));
      
      toast.info("📥 Starting import... Creating backup and checking for duplicates...");
      
      const response = await axios.post(
        `${API}/driver-onboarding/bulk-import`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 600000 // 10 minutes timeout for large imports
        }
      );
      
      const { 
        backup_created, 
        new_leads_count,
        duplicates_skipped,
        total_leads_now,
        telecaller_assignments 
      } = response.data;
      
      // Show detailed success message
      let successMessage = `✅ Import completed!\n\n` +
        `Backup: ${backup_created || 'N/A'}\n` +
        `New leads added: ${new_leads_count}\n` +
        `Duplicates skipped: ${duplicates_skipped}\n` +
        `Total leads now: ${total_leads_now}`;
      
      if (telecaller_assignments && telecaller_assignments.leads_assigned > 0) {
        successMessage += `\n\n📞 Telecaller Assignments:\n` +
          `Leads assigned: ${telecaller_assignments.leads_assigned}\n` +
          `Telecallers updated: ${telecaller_assignments.telecallers_updated}`;
      }
      
      toast.success(successMessage, { duration: 10000 });
      
      // Reset and refresh
      setBulkImportFile(null);
      setShowColumnMapping(false);
      setExcelColumns([]);
      setColumnMapping({});
      setPreviewData([]);
      setBulkImportDialogOpen(false);
      fetchLeads();
      
    } catch (error) {
      console.error("Bulk import error:", error);
      toast.error(error.response?.data?.detail || "Failed to import leads. Please try again.");
    } finally {
      setBulkImporting(false);
    }
  };
  
  // Fetch Backup Library
  const fetchBackupLibrary = async () => {
    setLoadingBackups(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/driver-onboarding/backup-library`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setBackups(response.data.backups || []);
    } catch (error) {
      console.error("Failed to fetch backups:", error);
      toast.error("Failed to load backup library");
    } finally {
      setLoadingBackups(false);
    }
  };
  
  // Download Backup
  const handleDownloadBackup = async (filename) => {
    try {
      const token = localStorage.getItem("token");
      toast.info(`📥 Downloading ${filename}...`);
      
      const response = await axios.get(
        `${API}/driver-onboarding/backup-library/${filename}/download`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`✅ Downloaded ${filename}`);
    } catch (error) {
      toast.error("Failed to download backup");
    }
  };
  
  // Delete Backup
  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete backup: ${filename}?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API}/driver-onboarding/backup-library/${filename}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success(`🗑️ Deleted ${filename}`);
      fetchBackupLibrary(); // Refresh list
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete backup");
    }
  };
  
  // Rollback to Backup
  const handleRollback = async (filename) => {
    if (!window.confirm(
      `⚠️ CRITICAL ACTION: Rollback to ${filename}\n\n` +
      "This will REPLACE ALL current leads with the data from this backup.\n\n" +
      "A backup of your current data will be created before rollback.\n\n" +
      "Are you absolutely sure you want to proceed?"
    )) {
      return;
    }
    
    setRollingBack(true);
    try {
      const token = localStorage.getItem("token");
      toast.info(`🔄 Rolling back to ${filename}... This may take a few moments.`);
      
      const response = await axios.post(
        `${API}/driver-onboarding/backup-library/${filename}/rollback`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 600000 // 10 minutes timeout
        }
      );
      
      const { pre_rollback_backup, deleted_count, restored_count } = response.data;
      
      toast.success(
        `✅ Rollback completed!\n\n` +
        `Pre-rollback backup: ${pre_rollback_backup || 'N/A'}\n` +
        `Deleted: ${deleted_count} current leads\n` +
        `Restored: ${restored_count} leads from backup`,
        { duration: 8000 }
      );
      
      // Close dialog and refresh
      setBackupLibraryOpen(false);
      fetchLeads();
      fetchBackupLibrary();
      
    } catch (error) {
      console.error("Rollback error:", error);
      toast.error(error.response?.data?.detail || "Failed to rollback. Please try again.");
    } finally {
      setRollingBack(false);
    }
  };
  
  // Open backup library
  const openBackupLibrary = () => {
    setBackupLibraryOpen(true);
    fetchBackupLibrary();
  };
  

  const getStatusColor = (status) => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption ? statusOption.color : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
  };

  // Copy to clipboard function
  const handleCopyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard!`);
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  return (
    <div className="space-y-6" data-testid="driver-onboarding-page">
      {/* Loading Animation Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            {/* Animated Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 border-8 border-blue-200 dark:border-blue-900 rounded-full"></div>
                <div className="w-20 h-20 border-8 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                <Users className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
            
            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Loading Driver Leads
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
              Please wait while we fetch your data...
            </p>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Progress</span>
                <span className="font-semibold text-blue-600">{Math.min(Math.round(loadingProgress), 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${Math.min(loadingProgress, 100)}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                </div>
              </div>
              
              {/* Status messages */}
              <div className="text-center text-xs text-gray-500 dark:text-gray-500 mt-4">
                {loadingProgress < 30 && "Connecting to database..."}
                {loadingProgress >= 30 && loadingProgress < 60 && "Fetching lead records..."}
                {loadingProgress >= 60 && loadingProgress < 90 && "Processing data..."}
                {loadingProgress >= 90 && loadingProgress < 100 && "Almost there..."}
                {loadingProgress >= 100 && "Complete!"}
              </div>
            </div>
          </div>
        </div>
      )}
      
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
            onClick={handleBulkExport}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 text-sm"
            size="sm"
            disabled={bulkExporting}
          >
            <DownloadCloud size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{bulkExporting ? "Exporting..." : "Bulk Export"}</span>
            <span className="sm:hidden">{bulkExporting ? "Exp..." : "Export"}</span>
          </Button>
          <Button
            onClick={() => setBulkImportDialogOpen(true)}
            variant="outline"
            className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-sm"
            size="sm"
          >
            <UploadCloud size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Bulk Import</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button
            onClick={openBackupLibrary}
            variant="outline"
            className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm"
            size="sm"
          >
            <Archive size={16} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Backup Library</span>
            <span className="sm:hidden">Backups</span>
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

      {/* Status Summary Dashboard */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-semibold">Status Summary Dashboard</CardTitle>
              {/* Refresh Button */}
              <Button
                onClick={() => {
                  fetchStatusSummary();
                  fetchLeads();
                  toast.success("Dashboard refreshed!");
                }}
                variant="outline"
                size="sm"
                className="text-xs dark:bg-gray-700 dark:border-gray-600"
                disabled={summaryLoading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${summaryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {/* Show All Leads Button */}
              <Button
                onClick={handleShowAllLeads}
                variant="outline"
                size="sm"
                className="text-xs border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Show All Leads
              </Button>
            </div>
            
            {/* Date Filter and Source Filter for Summary */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Source Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs dark:bg-gray-700 dark:border-gray-600"
                    disabled={loadingSources}
                  >
                    <Filter className="mr-2 h-3 w-3" />
                    {loadingSources ? "Loading..." : summarySourceFilter ? `Source: ${sourceOptions.find(s => s.value === summarySourceFilter)?.label || summarySourceFilter}` : "All Import Sources"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => setSummarySourceFilter(null)}
                    >
                      All Import Sources
                    </Button>
                    {sourceOptions.map((source) => (
                      <Button
                        key={source.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => setSummarySourceFilter(source.value)}
                      >
                        {source.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs dark:bg-gray-700 dark:border-gray-600"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {summaryStartDate ? format(summaryStartDate, "MMM dd, yyyy") : "Start Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700">
                  <Calendar
                    mode="single"
                    selected={summaryStartDate}
                    onSelect={setSummaryStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs dark:bg-gray-700 dark:border-gray-600"
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {summaryEndDate ? format(summaryEndDate, "MMM dd, yyyy") : "End Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700">
                  <Calendar
                    mode="single"
                    selected={summaryEndDate}
                    onSelect={setSummaryEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              {(summaryStartDate || summaryEndDate || summarySourceFilter) && (
                <Button
                  onClick={() => {
                    setSummaryStartDate(null);
                    setSummaryEndDate(null);
                    setSummarySourceFilter(null);
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <X size={14} className="mr-1" />
                  Clear All
                </Button>
              )}
            </div>
          </div>
          
          {statusSummary && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Total Leads: <span className="font-semibold">{statusSummary.total_leads}</span>
              {(summaryStartDate || summaryEndDate || summarySourceFilter) && " (filtered)"}
            </p>
          )}
        </CardHeader>
        
        <CardContent>
          {summaryLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading summary...</p>
            </div>
          ) : statusSummary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* S1 - Filtering */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 
                    className="font-semibold text-blue-700 dark:text-blue-400 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    onClick={() => handleStageHeadingClick("S1")}
                    title="Click to show all S1 leads"
                  >
                    S1 - Filtering
                  </h3>
                  <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                    {statusSummary.stage_totals.S1}
                  </span>
                </div>
                <div className="space-y-2">
                  {Object.entries(statusSummary.summary.S1).map(([status, count]) => (
                    <button
                      key={status}
                      onClick={() => {
                        setActiveStageFilter("S1");
                        setActiveSubStatus(status);
                        setCurrentPage(1);
                      }}
                      className="w-full flex items-center justify-between text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded px-2 py-1 transition-colors cursor-pointer"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate pr-2">{formatStatusDisplay(status)}</span>
                      <span className={`font-semibold ${count > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* S2 - Docs Collection */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-br from-green-50 to-white dark:from-green-900/10 dark:to-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 
                    className="font-semibold text-green-700 dark:text-green-400 cursor-pointer hover:text-green-800 dark:hover:text-green-300 transition-colors"
                    onClick={() => handleStageHeadingClick("S2")}
                    title="Click to show all S2 leads"
                  >
                    S2 - Docs Collection
                  </h3>
                  <span className="text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                    {statusSummary.stage_totals.S2}
                  </span>
                </div>
                <div className="space-y-2">
                  {Object.entries(statusSummary.summary.S2).map(([status, count]) => (
                    <button
                      key={status}
                      onClick={() => {
                        setActiveStageFilter("S2");
                        setActiveSubStatus(status);
                        setCurrentPage(1);
                      }}
                      className="w-full flex items-center justify-between text-sm hover:bg-green-50 dark:hover:bg-green-900/20 rounded px-2 py-1 transition-colors cursor-pointer"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate pr-2">{formatStatusDisplay(status)}</span>
                      <span className={`font-semibold ${count > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* S3 - Training */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 
                    className="font-semibold text-purple-700 dark:text-purple-400 cursor-pointer hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
                    onClick={() => handleStageHeadingClick("S3")}
                    title="Click to show all S3 leads"
                  >
                    S3 - Training
                  </h3>
                  <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded">
                    {statusSummary.stage_totals.S3}
                  </span>
                </div>
                <div className="space-y-2">
                  {Object.entries(statusSummary.summary.S3).map(([status, count]) => (
                    <button
                      key={status}
                      onClick={() => {
                        setActiveStageFilter("S3");
                        setActiveSubStatus(status);
                        setCurrentPage(1);
                      }}
                      className="w-full flex items-center justify-between text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded px-2 py-1 transition-colors cursor-pointer"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate pr-2">{formatStatusDisplay(status)}</span>
                      <span className={`font-semibold ${count > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* S4 - Customer Readiness */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/10 dark:to-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 
                    className="font-semibold text-orange-700 dark:text-orange-400 cursor-pointer hover:text-orange-800 dark:hover:text-orange-300 transition-colors"
                    onClick={() => handleStageHeadingClick("S4")}
                    title="Click to show all S4 leads"
                  >
                    S4 - Customer Readiness
                  </h3>
                  <span className="text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">
                    {statusSummary.stage_totals.S4}
                  </span>
                </div>
                <div className="space-y-2">
                  {Object.entries(statusSummary.summary.S4).map(([status, count]) => (
                    <button
                      key={status}
                      onClick={() => {
                        setActiveStageFilter("S4");
                        setActiveSubStatus(status);
                        setCurrentPage(1);
                      }}
                      className="w-full flex items-center justify-between text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded px-2 py-1 transition-colors cursor-pointer"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate pr-2">{formatStatusDisplay(status)}</span>
                      <span className={`font-semibold ${count > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No data available</p>
            </div>
          )}
        </CardContent>
      </Card>

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

              {/* S1 - Filtering Stage Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeStageFilter === "S1" ? "default" : "outline"}
                    className={activeStageFilter === "S1" ? "bg-green-600 text-white" : "border-green-600 text-green-600"}
                    size="sm"
                  >
                    S1 - FILTERING
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        setActiveStageFilter("S1");
                        setActiveSubStatus(null);
                      }}
                    >
                      All S1 Statuses
                    </Button>
                    {S1_STATUSES.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          setActiveStageFilter("S1");
                          setActiveSubStatus(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* S2 - Docs Collection Stage Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeStageFilter === "S2" ? "default" : "outline"}
                    className={activeStageFilter === "S2" ? "bg-yellow-600 text-white" : "border-yellow-600 text-yellow-600"}
                    size="sm"
                  >
                    S2 - DOCS COLLECTION
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        setActiveStageFilter("S2");
                        setActiveSubStatus(null);
                      }}
                    >
                      All S2 Statuses
                    </Button>
                    {S2_STATUSES.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          setActiveStageFilter("S2");
                          setActiveSubStatus(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* S3 - Training Stage Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeStageFilter === "S3" ? "default" : "outline"}
                    className={activeStageFilter === "S3" ? "bg-purple-600 text-white" : "border-purple-600 text-purple-600"}
                    size="sm"
                  >
                    S3 - TRAINING
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        setActiveStageFilter("S3");
                        setActiveSubStatus(null);
                      }}
                    >
                      All S3 Statuses
                    </Button>
                    {S3_STATUSES.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          setActiveStageFilter("S3");
                          setActiveSubStatus(option.value);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* S4 - Customer Readiness Stage Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={activeStageFilter === "S4" ? "default" : "outline"}
                    className={activeStageFilter === "S4" ? "bg-orange-600 text-white" : "border-orange-600 text-orange-600"}
                    size="sm"
                  >
                    S4 - CUSTOMER READINESS
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => {
                        setActiveStageFilter("S4");
                        setActiveSubStatus(null);
                      }}
                    >
                      All S4 Statuses
                    </Button>
                    {S4_STATUSES.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          setActiveStageFilter("S4");
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
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statusSummary?.total_leads || 0}</p>
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
              {filteredLeads.filter(l => l.status === "DONE!").length}
            </p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {filteredLeads.filter(l => !["New", "Not Interested", "DONE!"].includes(l.status)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar - Moved above selection controls */}
      <Card className="dark:bg-gray-800 dark:border-gray-700 mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name or phone (e.g., Alexander or 9898933220, 8787811221)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder-gray-400 dark:placeholder-gray-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 flex items-start gap-1">
            <span>💡</span>
            <span>Tip: Enter multiple values separated by commas. Names support partial matching, phone numbers require full match.</span>
          </p>
        </CardContent>
      </Card>

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
            <span className="hidden sm:inline">Select All ({filteredLeads.length})</span>
            <span className="sm:hidden">All</span>
          </Button>
          <Button
            onClick={handleSelectAllInPage}
            variant="outline"
            size="sm"
            className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 text-sm"
          >
            <CheckSquare size={14} className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Select All in This Page ({paginatedLeads.length})</span>
            <span className="sm:hidden">Page</span>
          </Button>
          {selectedLeadIds.length > 0 && (
            <>
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
              <Button
                onClick={() => setIsAssignDialogOpen(true)}
                variant="outline"
                size="sm"
                className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 text-sm"
              >
                <Users size={14} className="mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Assign Leads to Telecaller ({selectedLeadIds.length})</span>
                <span className="sm:hidden">Assign ({selectedLeadIds.length})</span>
              </Button>
              <Button
                onClick={() => setIsUnassignDialogOpen(true)}
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-sm"
              >
                <XCircle size={14} className="mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Unassign Telecaller ({selectedLeadIds.length})</span>
                <span className="sm:hidden">Unassign ({selectedLeadIds.length})</span>
              </Button>
            </>
          )}
        </div>
      )}

      {/* Leads Table */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <Users size={20} className="mr-2" />
              Driver Leads ({filteredLeads.length})
            </CardTitle>
            
            {/* Top Pagination & Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Results per page */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-400">Show</span>
                <Select
                  value={String(leadsPerPage)}
                  onValueChange={(value) => {
                    setLeadsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-16 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filter by Source */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Filter className="w-3 h-3 mr-1" />
                    Filter by Import Source
                    {sourceFilter && ` (${sourceOptions.find(s => s.value === sourceFilter)?.label || sourceFilter})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => setSourceFilter(null)}
                    >
                      All Import Sources
                    </Button>
                    {sourceOptions.map((source) => (
                      <Button
                        key={source.value}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => setSourceFilter(source.value)}
                      >
                        {source.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Filter by Telecaller */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Users className="w-3 h-3 mr-1" />
                    Filter by Telecaller
                    {telecallerFilter && (telecallerFilter === "UNASSIGNED" ? " (Unassigned)" : ` (${telecallers.find(t => t.email === telecallerFilter)?.name || telecallerFilter})`)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Telecallers</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={fetchTelecallers}
                        className="h-6 px-2 text-xs"
                        title="Refresh telecaller list"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => setTelecallerFilter(null)}
                    >
                      All Telecallers
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                      onClick={() => setTelecallerFilter("UNASSIGNED")}
                    >
                      Unassigned Leads
                    </Button>
                    {telecallers.map((telecaller) => (
                      <Button
                        key={telecaller.id}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => setTelecallerFilter(telecaller.email)}
                      >
                        {telecaller.name}
                      </Button>
                    ))}
                    {telecallers.length === 0 && (
                      <div className="px-2 py-4 text-xs text-gray-500 text-center">
                        No telecallers found
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Filter by Status */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <CheckSquare className="w-3 h-3 mr-1" />
                    Filter by Status
                    {statusFilter && ` (${statusFilter})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 dark:bg-gray-800 dark:border-gray-700 max-h-96 overflow-y-auto">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => setStatusFilter(null)}
                    >
                      All Statuses
                    </Button>
                    {uniqueStatuses.map((status) => (
                      <Button
                        key={status}
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Page navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-gray-600 dark:text-gray-400 px-2">
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
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
                        checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleSelectAll();
                          } else {
                            handleClearSelection();
                          }
                        }}
                      />
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">S. No.</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Leads ID</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Phone Number</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Assigned Telecaller</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Import Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead, index) => (
                    <tr 
                      key={lead.id || index} 
                      onClick={(e) => handleLeadClick(lead, e)}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      {/* Checkbox */}
                      <td className="py-2 sm:py-3 px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeadIds.includes(lead.id)}
                          onCheckedChange={(checked, event) => handleLeadCheckboxChange(lead.id, index, event?.nativeEvent)}
                        />
                      </td>
                      
                      {/* S. No. */}
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                        {startIndex + index + 1}
                      </td>
                      
                      {/* Leads ID with Copy Button */}
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{lead.id?.substring(0, 8) || '-'}</span>
                          {lead.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyToClipboard(lead.id, 'Leads ID');
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="Copy Leads ID"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      
                      {/* Name with Copy Button */}
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-white font-medium">
                        <div className="flex items-center gap-2">
                          <span>{lead.name}</span>
                          {lead.name && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyToClipboard(lead.name, 'Name');
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="Copy Name"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      
                      {/* Phone Number with Copy Button */}
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <span>{lead.phone_number}</span>
                          {lead.phone_number && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyToClipboard(lead.phone_number, 'Phone Number');
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="Copy Phone Number"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      
                      {/* Assigned Telecaller */}
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs text-gray-600 dark:text-gray-400">
                        {lead.assigned_telecaller_name || lead.assigned_telecaller || '-'}
                      </td>
                      
                      {/* Status */}
                      <td 
                        className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          {inlineEditingId === lead.id ? (
                            <div className="flex items-center gap-1 w-full">
                              <Select
                                value={lead.status || "New"}
                                onValueChange={(value) => handleInlineStatusChange(lead.id, value)}
                              >
                                <SelectTrigger 
                                  data-lead-select={lead.id}
                                  className="w-full h-8 text-xs"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-gray-800 max-h-[300px]">
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
                              {pendingStatusChanges[lead.id] && (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApplyStatusChange(lead.id);
                                    }}
                                    disabled={updatingStatus}
                                    className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <Save className="w-3 h-3 mr-1" />
                                    Apply
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelStatusChange(lead.id);
                                    }}
                                    disabled={updatingStatus}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInlineEditingId(lead.id);
                                // Automatically trigger dropdown opening after state update
                                setTimeout(() => {
                                  const selectTrigger = document.querySelector(`[data-lead-select="${lead.id}"]`);
                                  if (selectTrigger) {
                                    selectTrigger.click();
                                  }
                                }, 50);
                              }}
                              className={`group flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors w-full ${
                                pendingStatusChanges[lead.id] ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''
                              }`}
                            >
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(lead.status || "New")}`}>
                                {formatStatusDisplay(STATUS_OPTIONS.find(opt => opt.value === lead.status)?.label || lead.status || "New")}
                              </span>
                              {pendingStatusChanges[lead.id] && (
                                <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                                  (Pending)
                                </span>
                              )}
                              <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </div>
                      </td>
                      
                      {/* Import Date */}
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs text-gray-500 dark:text-gray-500">
                        {lead.import_date ? new Date(lead.import_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {!loading && filteredLeads.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              {/* Items per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Show</span>
                <Select
                  value={String(leadsPerPage)}
                  onValueChange={(value) => {
                    setLeadsPerPage(Number(value));
                    setCurrentPage(1); // Reset to first page
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  leads per page
                </span>
              </div>
              
              {/* Page info and navigation */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length}
                </span>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
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
      <LeadDetailsDialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) {
            setIsEditMode(false);
            setHasUnsavedChanges(false);
            setUploadedDocs({});
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
        hasUnsavedChanges={hasUnsavedChanges}
        onLeadUpdate={fetchLeads}
      />

      {/* Bulk Status Update Dialog */}
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
                    {formatStatusDisplay(selectedLead.status || "New")}
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
                                {formatStatusDisplay(dup.existing_status)}
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
      
      {/* Sync Loading Dialog */}
      <Dialog open={syncing} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" hideCloseButton>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="relative w-20 h-20">
              {/* Rotating spinner */}
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
              {/* Inner pulsing circle */}
              <div className="absolute inset-4 bg-blue-100 rounded-full animate-pulse"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Syncing to Google Sheets...
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please wait while we sync your leads
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Leads Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="dark:bg-gray-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Assign Leads to Telecaller</DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Assign {selectedLeadIds.length} selected lead(s) to a telecaller for a specific date
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Telecaller Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="telecaller-select" className="dark:text-gray-300">
                  Select Telecaller *
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={fetchTelecallers}
                  className="h-8 px-2 text-xs"
                  title="Refresh telecaller list"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>
              <Select
                value={selectedTelecallerForAssignment}
                onValueChange={setSelectedTelecallerForAssignment}
              >
                <SelectTrigger id="telecaller-select" className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Choose a telecaller..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  {telecallers.map((telecaller) => (
                    <SelectItem key={telecaller.id} value={telecaller.email}>
                      {telecaller.name} ({telecaller.email})
                    </SelectItem>
                  ))}
                  {telecallers.length === 0 && (
                    <div className="px-2 py-4 text-sm text-gray-500 text-center">
                      No telecallers found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignDialogOpen(false);
                setSelectedTelecallerForAssignment("");
                setAssignmentDate("");
              }}
              className="dark:border-gray-600"
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssignLeads}
              disabled={!selectedTelecallerForAssignment || !assignmentDate || assigning}
              className="bg-green-600 hover:bg-green-700"
            >
              {assigning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign ${selectedLeadIds.length} Lead(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Telecaller Dialog */}
      <Dialog open={isUnassignDialogOpen} onOpenChange={setIsUnassignDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Unassign Telecaller</DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Remove telecaller assignment from {selectedLeadIds.length} selected lead(s)
            </p>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ This will remove the telecaller assignment from the selected leads. The leads will become unassigned and available for reassignment.
              </p>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to unassign {selectedLeadIds.length} lead(s)?
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUnassignDialogOpen(false)}
              className="dark:border-gray-600"
              disabled={unassigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnassignLeads}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={unassigning}
            >
              {unassigning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Unassigning...
                </>
              ) : (
                `Unassign ${selectedLeadIds.length} Lead(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportDialogOpen} onOpenChange={(open) => {
        setBulkImportDialogOpen(open);
        if (!open) {
          // Reset when closing
          setBulkImportFile(null);
          setShowColumnMapping(false);
          setExcelColumns([]);
          setColumnMapping({});
          setPreviewData([]);
        }
      }}>
        <DialogContent className="dark:bg-gray-800 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-orange-600" />
              Bulk Import from Excel
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {showColumnMapping ? "Map your Excel columns to database fields" : "Upload an Excel file to add new leads. Duplicates will be skipped."}
            </DialogDescription>
          </DialogHeader>
          
          {!showColumnMapping ? (
            // Step 1: File Upload
            <div className="space-y-4">
              {/* Info */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Import New Leads
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  • New leads will be added to existing leads<br />
                  • Duplicates (same phone number) will be skipped<br />
                  • A backup will be created before import<br />
                  • Existing leads will NOT be deleted
                </p>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="dark:text-gray-300">Select Excel File (.xlsx or .xls)</Label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                           file:bg-orange-50 dark:file:bg-orange-900/20 file:text-orange-700 dark:file:text-orange-300
                           file:cursor-pointer hover:file:bg-orange-100 dark:hover:file:bg-orange-900/30"
                />
                {bulkImportFile && !showColumnMapping && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckSquare className="w-3 h-3" />
                    Selected: {bulkImportFile.name} - Parsing columns...
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>📋 How it works:</strong><br />
                  1. Upload your Excel file<br />
                  2. Map your columns to our database fields<br />
                  3. Preview and confirm import<br />
                  <br />
                  <strong>Note:</strong> First row must be column headers
                </p>
              </div>
            </div>
          ) : (
            // Step 2: Column Mapping
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-semibold">
                  Map Your Excel Columns
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Select which column in your Excel file corresponds to each database field. Required fields are marked with *
                </p>
              </div>

              {/* Column Mapping Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-2">
                {[
                  { field: 'name', label: 'Driver Name', required: true },
                  { field: 'phone_number', label: 'Phone Number', required: true },
                  { field: 'email', label: 'Email' },
                  { field: 'vehicle', label: 'Vehicle Type' },
                  { field: 'driving_license', label: 'Driving License' },
                  { field: 'experience', label: 'Experience (years)' },
                  { field: 'interested_ev', label: 'Interested in EV' },
                  { field: 'monthly_salary', label: 'Expected Salary' },
                  { field: 'current_location', label: 'Current Location' },
                  { field: 'status', label: 'Status' },
                  { field: 'stage', label: 'Stage' },
                  { field: 'assigned_telecaller', label: 'Assigned Telecaller' },
                  { field: 'source', label: 'Source' },
                  { field: 'dl_no', label: 'DL Number' },
                  { field: 'badge_no', label: 'Badge Number' },
                  { field: 'aadhar_card', label: 'Aadhar Card' },
                  { field: 'pan_card', label: 'PAN Card' },
                  { field: 'gas_bill', label: 'Gas Bill' },
                  { field: 'bank_passbook', label: 'Bank Passbook' }
                ].map(({ field, label, required }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs dark:text-gray-300">
                      {label} {required && <span className="text-red-500">*</span>}
                    </Label>
                    <Select 
                      value={columnMapping[field] !== undefined ? columnMapping[field].toString() : "none"} 
                      onValueChange={(value) => setColumnMapping(prev => ({
                        ...prev,
                        [field]: value === "none" ? undefined : parseInt(value)
                      }))}
                    >
                      <SelectTrigger className="h-8 text-xs dark:bg-gray-700">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800">
                        <SelectItem value="none">None</SelectItem>
                        {excelColumns.map(col => (
                          <SelectItem key={col.index} value={col.index.toString()}>
                            Column {col.letter}: {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {previewData.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Preview (first 3 rows):
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-300 dark:border-gray-600">
                          {Object.keys(previewData[0]).slice(0, 5).map((key, i) => (
                            <th key={i} className="text-left p-1 text-gray-600 dark:text-gray-400">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, i) => (
                          <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                            {Object.values(row).slice(0, 5).map((val, j) => (
                              <td key={j} className="p-1 text-gray-700 dark:text-gray-300">{val || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowColumnMapping(false);
                    setBulkImportFile(null);
                    setExcelColumns([]);
                    setColumnMapping({});
                    setPreviewData([]);
                  }}
                  disabled={bulkImporting}
                >
                  Back
                </Button>
                <Button
                  onClick={handleBulkImport}
                  disabled={!Object.keys(columnMapping).length || bulkImporting}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {bulkImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 mr-2" />
                      Import New Leads
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Backup Library Dialog */}
      <Dialog open={backupLibraryOpen} onOpenChange={setBackupLibraryOpen}>
        <DialogContent className="dark:bg-gray-800 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-indigo-600" />
              Backup Library
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              View, download, delete, or rollback to previous backups
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {loadingBackups ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-12">
                <Archive className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No backups found</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Backups are created automatically before imports and rollbacks
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup, index) => (
                  <div
                    key={backup.filename}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg
                             bg-white dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50
                             transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Backup Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {backup.filename}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(backup.created_at).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3" />
                            {backup.size_mb} MB
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadBackup(backup.filename)}
                          className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {isMasterAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteBackup(backup.filename)}
                            className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleRollback(backup.filename)}
                          disabled={rollingBack}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          {rollingBack ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Rollback
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total backups: {backups.length}
            </p>
            <Button
              variant="outline"
              onClick={() => setBackupLibraryOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverOnboardingPage;
