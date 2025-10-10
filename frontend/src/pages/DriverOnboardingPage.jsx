import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
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
import { Upload, Users, FileSpreadsheet, RefreshCw, Plus, Calendar as CalendarIcon, Filter, X, CheckSquare, Square } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "New", label: "New", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "Contacted", label: "Contacted", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { value: "Interested", label: "Interested", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "Documents Pending", label: "Documents Pending", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "Scheduled", label: "Scheduled", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  { value: "Onboarded", label: "Onboarded", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "Rejected", label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "Not Interested", label: "Not Interested", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
];

const DriverOnboardingPage = () => {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Bulk selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  
  // Date filter states
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/driver-onboarding/leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeads(response.data);
      setFilteredLeads(response.data);
    } catch (error) {
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Filter leads by date range
  useEffect(() => {
    if (!startDate && !endDate) {
      setFilteredLeads(leads);
      return;
    }

    const filtered = leads.filter(lead => {
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

    setFilteredLeads(filtered);
  }, [startDate, endDate, leads]);

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

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to import");
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/driver-onboarding/import-leads`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success(
        <div>
          <p className="font-semibold">Import Successful!</p>
          <p className="text-sm mt-1">{response.data.message}</p>
        </div>,
        { duration: 5000 }
      );

      setImportDialogOpen(false);
      setSelectedFile(null);
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import leads");
    } finally {
      setImporting(false);
    }
  };

  const handleSyncToSheets = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/driver-onboarding/sync-leads`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Leads synced to Google Sheets successfully!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to sync to Google Sheets");
    }
  };

  const handleLeadClick = (lead, e) => {
    // Don't open dialog if clicking on checkbox
    if (e.target.type === 'checkbox' || e.target.closest('label')) {
      return;
    }
    setSelectedLead(lead);
    setDetailDialogOpen(true);
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
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const clearDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Driver Onboarding</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage driver leads and onboarding</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setShowDateFilter(!showDateFilter)}
            variant="outline"
            className="border-gray-300 dark:border-gray-600"
          >
            <Filter size={18} className="mr-2" />
            Filter by Date
          </Button>
          <Button
            onClick={handleSyncToSheets}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
          >
            <RefreshCw size={18} className="mr-2" />
            Sync to Sheets
          </Button>
          <Button
            onClick={() => setImportDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="import-leads-button"
          >
            <Plus size={18} className="mr-2" />
            Import Leads
          </Button>
        </div>
      </div>

      {/* Date Filter Panel */}
      {showDateFilter && (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal dark:bg-gray-700 dark:border-gray-600"
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
                <Label className="text-sm text-gray-700 dark:text-gray-300 mb-2">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal dark:bg-gray-700 dark:border-gray-600"
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

              <div className="flex items-end">
                <Button
                  onClick={clearDateFilter}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <X size={18} className="mr-2" />
                  Clear Filter
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

      {/* Bulk Actions Bar */}
      {selectedLeadIds.length > 0 && (
        <Card className="dark:bg-gray-800 dark:border-blue-500 border-2 border-blue-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <CheckSquare className="text-blue-600" size={20} />
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedLeadIds.length} lead(s) selected
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => setBulkStatusDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Update Status
                </Button>
                <Button
                  onClick={handleClearSelection}
                  variant="outline"
                  className="border-gray-300 dark:border-gray-600"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div className="flex items-center space-x-3">
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size="sm"
            className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <CheckSquare size={16} className="mr-2" />
            Select All
          </Button>
          {selectedLeadIds.length > 0 && (
            <Button
              onClick={handleClearSelection}
              variant="outline"
              size="sm"
              className="border-gray-300 dark:border-gray-600"
            >
              <Square size={16} className="mr-2" />
              Clear
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
              <table className="w-full">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4 w-12">
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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">S. No.</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Location</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Imported</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, index) => (
                    <tr 
                      key={lead.id || index} 
                      onClick={(e) => handleLeadClick(lead, e)}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeadIds.includes(lead.id)}
                          onCheckedChange={() => handleLeadCheckboxChange(lead.id)}
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{index + 1}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">{lead.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{lead.phone_number}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(lead.status || "New")}`}>
                          {lead.status || "New"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{lead.current_location || '-'}</td>
                      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-500">
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
              <Label htmlFor="file-upload" className="text-gray-700 dark:text-gray-300">
                Select CSV or XLSX File
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
              disabled={!selectedFile || importing}
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
        <DialogContent className="dark:bg-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Lead Details</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              View and update lead information
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
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
                  <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                    {selectedLead.name}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Phone Number</Label>
                  <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                    {selectedLead.phone_number}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Vehicle</Label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">
                    {selectedLead.vehicle || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Driving License</Label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">
                    {selectedLead.driving_license || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Experience</Label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">
                    {selectedLead.experience || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Interested in EV</Label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">
                    {selectedLead.interested_ev || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Monthly Salary</Label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">
                    {selectedLead.monthly_salary || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Location in Chennai</Label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">
                    {selectedLead.current_location || '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm text-gray-600 dark:text-gray-400">Import Date</Label>
                  <p className="text-base text-gray-900 dark:text-white mt-1">
                    {selectedLead.import_date ? new Date(selectedLead.import_date).toLocaleString() : '-'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => setDetailDialogOpen(false)}
                  variant="outline"
                  className="dark:border-gray-600"
                >
                  Close
                </Button>
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
    </div>
  );
};

export default DriverOnboardingPage;
