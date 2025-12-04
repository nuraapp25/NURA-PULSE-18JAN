import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, Save, Trash2, Eye, Download, Upload, X, History } from "lucide-react";

// Stage definitions
const STAGES = [
  { value: "S1", label: "S1 - Filtering" },
  { value: "S2", label: "S2 - Docs Collection" },
  { value: "S3", label: "S3 - Training" },
  { value: "S4", label: "S4 - Customer Readiness" }
];

const S1_STATUSES = [
  { value: "New", label: "New", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" },
  { value: "Not Interested", label: "Not Interested", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Interested, No DL", label: "Interested, No DL", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Highly Interested", label: "Highly Interested", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  { value: "Call back 1D", label: "Call back 1D", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  { value: "Call back 1W", label: "Call back 1W", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  { value: "Call back 2W", label: "Call back 2W", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  { value: "Call back 1M", label: "Call back 1M", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
];

const S2_STATUSES = [
  { value: "Docs Upload Pending", label: "Docs Upload Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" },
  { value: "Verification Pending", label: "Verification Pending", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Duplicate License", label: "Duplicate License", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "DL - Amount", label: "DL - Amount", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Verified", label: "Verified", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  { value: "Verification Rejected", label: "Verification Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
];

const S3_STATUSES = [
  { value: "Schedule Pending", label: "Schedule Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" },
  { value: "Training WIP", label: "Training WIP", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Training Completed", label: "Training Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  { value: "Training Rejected", label: "Training Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  { value: "Re-Training", label: "Re-Training", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Absent for training", label: "Absent for training", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Approved", label: "Approved", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
];

const S4_STATUSES = [
  { value: "CT Pending", label: "CT Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" },
  { value: "CT WIP", label: "CT WIP", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Shift Details Pending", label: "Shift Details Pending", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "DONE!", label: "DONE!", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  { value: "Training Rejected", label: "Training Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  { value: "Re-Training", label: "Re-Training", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Absent for training", label: "Absent for training", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
  { value: "Terminated", label: "Terminated", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
];

const getStatusesForStage = (stage) => {
  switch (stage) {
    case "S1": return S1_STATUSES;
    case "S2": return S2_STATUSES;
    case "S3": return S3_STATUSES;
    case "S4": return S4_STATUSES;
    default: return S1_STATUSES;
  }
};

const getCompletionStatus = (stage) => {
  switch (stage) {
    case "S1": return "Highly Interested";
    case "S2": return "Verified";
    case "S3": return "Approved";
    case "S4": return "DONE!";
    default: return null;
  }
};

const LeadDetailsDialog = ({
  open,
  onOpenChange,
  lead,
  editedLead,
  isEditMode,
  setIsEditMode,
  onFieldChange,
  onSave,
  onStageSync,
  uploadedDocs = {},
  onDocumentUpload,
  onViewDocument,
  onDownloadDocument,
  onDeleteDocument,
  onDocumentScan,
  uploadingDoc,
  scanningDoc,
  updating,
  showDeleteButton = false,
  onDelete,
  hasUnsavedChanges = false,
  onShowStatusHistory,  // New prop for showing status history
  availableSources = []  // List of available sources from parent
}) => {
  const [showChangeSourceDialog, setShowChangeSourceDialog] = useState(false);
  const [showAddNewSource, setShowAddNewSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [tempSource, setTempSource] = useState('');

  // Debug: log available sources
  React.useEffect(() => {
    if (showChangeSourceDialog) {
      console.log('Available sources in dialog:', availableSources);
    }
  }, [showChangeSourceDialog, availableSources]);

  if (!lead || !editedLead) return null;

  const DocumentSection = ({ docType, label, fieldName }) => {
    const [value, setValue] = React.useState(editedLead[fieldName] || '');
    const timeoutRef = React.useRef(null);

    // Sync when editedLead changes
    React.useEffect(() => {
      setValue(editedLead[fieldName] || '');
    }, [editedLead[fieldName]]);

    const handleChange = (e) => {
      const newValue = e.target.value;
      setValue(newValue);
      
      // Debounce update to parent (300ms after last keystroke)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onFieldChange(fieldName, newValue);
      }, 300);
    };

    return (
      <div className="border-b border-blue-200 dark:border-blue-800 pb-4">
        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">{label}</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            {isEditMode ? (
              <Input
                value={value}
                onChange={handleChange}
                className="dark:bg-gray-700 dark:border-gray-600"
                placeholder={`${label} Number`}
              />
            ) : (
              <p className="text-base text-gray-900 dark:text-white">
                {lead[fieldName] || 'Not provided'}
              </p>
            )}
          </div>
          {uploadedDocs[docType] && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onViewDocument(docType)}
                className="flex-1"
                title="View document"
              >
                <Eye className="w-3 h-3 mr-1" />
                View
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDownloadDocument(docType)}
                className="flex-1"
                title="Download document"
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
            {isEditMode && (
              <div className="flex gap-1">
                {onDocumentScan && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => onDocumentScan(docType)}
                    disabled={scanningDoc === docType}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {scanningDoc === docType ? 'Scanning...' : 'Scan'}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onDeleteDocument(docType)}
                  className="flex-1"
                  title="Delete document"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>
          )}
          {isEditMode && !uploadedDocs[docType] && (
          <div className="flex flex-col gap-2">
            <label className="flex-1">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => onDocumentUpload(docType, e.target.files[0])}
                className="hidden"
                id={`${docType}-upload`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={uploadingDoc === docType}
                onClick={() => document.getElementById(`${docType}-upload`).click()}
              >
                <Upload className="w-3 h-3 mr-2" />
                {uploadingDoc === docType ? 'Uploading...' : 'Upload'}
              </Button>
            </label>
          </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="dark:text-white flex items-center justify-between">
            Lead Details
            <div className="flex gap-2">
              <Button
                onClick={() => setIsEditMode(!isEditMode)}
                variant="outline"
                size="sm"
                disabled={updating}
              >
                {isEditMode ? "Cancel Edit" : "Edit Details"}
              </Button>
              {isEditMode && (
                <Button
                  onClick={onSave}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={updating}
                >
                  {updating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            {isEditMode ? "Edit lead information and click Save Changes" : "View lead information"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Stage and Status Management */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Stage & Status Management
              </Label>
              {lead.stage && lead.status && onStageSync && (
                <Button
                  onClick={() => onStageSync(lead.id)}
                  variant="outline"
                  size="sm"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                  disabled={updating}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  SYNC to Next Stage
                </Button>
              )}
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Current Stage</Label>
              {isEditMode ? (
                <Select
                  value={(() => {
                    // Normalize stage value: extract "S1", "S2", etc. from "S1 - Filtering" format
                    const stage = editedLead.stage || "S1";
                    const normalized = stage.split(' ')[0]; // Get just "S1", "S2", "S3", or "S4"
                    return normalized;
                  })()}
                  onValueChange={(value) => {
                    onFieldChange('stage', value);
                    const newStatuses = getStatusesForStage(value);
                    if (newStatuses.length > 0) {
                      onFieldChange('status', newStatuses[0].value);
                    }
                  }}
                  disabled={updating}
                >
                  <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                    {STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                  {STAGES.find(s => s.value === lead.stage)?.label || lead.stage || "S1 - Filtering"}
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Status within Stage</Label>
              {isEditMode ? (
                <Select
                  value={editedLead.status || "New"}
                  onValueChange={(value) => onFieldChange('status', value)}
                  disabled={updating}
                >
                  <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-700 max-h-[300px]">
                    {getStatusesForStage((() => {
                      // Normalize stage value for status filtering
                      const stage = editedLead.stage || "S1";
                      return stage.split(' ')[0]; // Extract just "S1", "S2", etc.
                    })()).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                  {lead.status || "New"}
                </p>
              )}
            </div>

            {/* Remarks Field */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Remarks</Label>
              {isEditMode ? (
                <Textarea
                  value={(() => {
                    if (!editedLead.remarks) return '';
                    if (typeof editedLead.remarks === 'string') return editedLead.remarks;
                    if (Array.isArray(editedLead.remarks) && editedLead.remarks.length > 0) {
                      return editedLead.remarks.map(remark => remark.text || remark).join('\n');
                    }
                    if (typeof editedLead.remarks === 'object') {
                      return editedLead.remarks.text || '';
                    }
                    return '';
                  })()}
                  onChange={(e) => onFieldChange('remarks', e.target.value)}
                  placeholder="Enter remarks about this lead..."
                  className="w-full min-h-[80px] dark:bg-gray-700 dark:border-gray-600 text-sm"
                  disabled={updating}
                />
              ) : (
                <p className="text-base text-gray-900 dark:text-white mt-1 whitespace-pre-wrap min-h-[80px] p-2 border border-gray-200 dark:border-gray-700 rounded">
                  {(() => {
                    if (!lead.remarks) return 'No remarks';
                    if (typeof lead.remarks === 'string') return lead.remarks;
                    if (Array.isArray(lead.remarks) && lead.remarks.length > 0) {
                      // Handle old format - array of remark objects
                      return lead.remarks.map(remark => remark.text || remark).join('\n');
                    }
                    if (typeof lead.remarks === 'object') {
                      // Handle single remark object
                      return lead.remarks.text || 'Invalid remark format';
                    }
                    return 'No remarks';
                  })()}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Optional: Add any notes or remarks about this lead
              </p>
            </div>

            {lead.stage && lead.status === getCompletionStatus(lead.stage) && lead.stage !== "S4" && (
              <div className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                ✓ Completion status reached! Click "SYNC to Next Stage" to auto-progress.
              </div>
            )}
          </div>

          {/* Lead Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Name</Label>
              {isEditMode ? (
                <Input
                  value={editedLead.name || ''}
                  onChange={(e) => onFieldChange('name', e.target.value)}
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                  {lead.name}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Phone Number</Label>
              {isEditMode ? (
                <Input
                  value={editedLead.phone_number || ''}
                  onChange={(e) => onFieldChange('phone_number', e.target.value)}
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                  {lead.phone_number}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Email</Label>
              {isEditMode ? (
                <Input
                  value={editedLead.email || ''}
                  onChange={(e) => onFieldChange('email', e.target.value)}
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {lead.email || '-'}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Import Source</Label>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-base text-gray-900 dark:text-white flex-1">
                  {editedLead.source || lead.source || '-'}
                </p>
                {isEditMode && (
                  <Button
                    type="button"
                    onClick={() => setShowChangeSourceDialog(true)}
                    variant="outline"
                    size="sm"
                    className="text-xs border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                  >
                    Change Source
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Vehicle</Label>
              {isEditMode ? (
                <Input
                  value={editedLead.vehicle || ''}
                  onChange={(e) => onFieldChange('vehicle', e.target.value)}
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {lead.vehicle || '-'}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Experience</Label>
              {isEditMode ? (
                <Input
                  value={editedLead.experience || ''}
                  onChange={(e) => onFieldChange('experience', e.target.value)}
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {lead.experience || '-'}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Current Location</Label>
              {isEditMode ? (
                <Input
                  value={editedLead.current_location || ''}
                  onChange={(e) => onFieldChange('current_location', e.target.value)}
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                />
              ) : (
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {lead.current_location || '-'}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Preferred Shift</Label>
              {isEditMode ? (
                <Select
                  value={editedLead.preferred_shift || ''}
                  onValueChange={(value) => onFieldChange('preferred_shift', value)}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                    <SelectItem value="Night">Night</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {lead.preferred_shift || '-'}
                </p>
              )}
            </div>
          </div>

          {/* Documents Section */}
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Documents</h3>
            
            <DocumentSection docType="dl" label="Driver License" fieldName="driver_license" />
            <DocumentSection docType="aadhar" label="Aadhar Card" fieldName="aadhar_card" />
            <DocumentSection docType="pan" label="PAN Card" fieldName="pan_card" />
            <DocumentSection docType="gas_bill" label="Gas Bill" fieldName="gas_bill" />
            <DocumentSection docType="bank_passbook" label="Bank Passbook" fieldName="bank_passbook" />
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">Telecaller Notes</Label>
              {isEditMode ? (
                <Textarea
                  value={editedLead.telecaller_notes || ''}
                  onChange={(e) => onFieldChange('telecaller_notes', e.target.value)}
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                  rows={3}
                  placeholder="Add notes..."
                />
              ) : (
                <p className="text-base text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">
                  {lead.telecaller_notes || 'No notes'}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-400">General Notes</Label>
              {isEditMode ? (
                <Textarea
                  value={editedLead.notes || ''}
                  onChange={(e) => onFieldChange('notes', e.target.value)}
                  className="mt-1 dark:bg-gray-700 dark:border-gray-600"
                  rows={3}
                  placeholder="Add notes..."
                />
              ) : (
                <p className="text-base text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">
                  {lead.notes || 'No notes'}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            {onShowStatusHistory && (
              <Button
                variant="outline"
                onClick={() => onShowStatusHistory(lead.id)}
                className="border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                disabled={updating}
              >
                <History className="w-4 h-4 mr-2" />
                Show Status History
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="dark:border-gray-600 ml-auto"
              disabled={updating}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Change Source Dialog */}
      <Dialog open={showChangeSourceDialog} onOpenChange={setShowChangeSourceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Import Source</DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Select from existing sources or add a new one
            </p>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {!showAddNewSource ? (
              <>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400 mb-2">Select Source</Label>
                  <Select 
                    value={tempSource || editedLead.source || lead.source || ''} 
                    onValueChange={(value) => setTempSource(value)}
                  >
                    <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto dark:bg-gray-800 scrollbar-thin">
                      {availableSources && availableSources.length > 0 ? (
                        availableSources.map((source) => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="Excel Import">Excel Import</SelectItem>
                          <SelectItem value="Manual Entry">Manual Entry</SelectItem>
                          <SelectItem value="Job Hai">Job Hai</SelectItem>
                          <SelectItem value="HireVox">HireVox</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  type="button"
                  onClick={() => setShowAddNewSource(true)}
                  variant="outline"
                  className="w-full text-sm border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
                >
                  + Add New Source
                </Button>

                <div className="flex gap-2 pt-4 border-t dark:border-gray-700">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowChangeSourceDialog(false);
                      setTempSource('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (tempSource) {
                        onFieldChange('source', tempSource);
                      }
                      setShowChangeSourceDialog(false);
                      setTempSource('');
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Save & Apply
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-sm text-gray-600 dark:text-gray-400 mb-2">Enter New Source</Label>
                  <Input
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="Enter new source name..."
                    className="w-full dark:bg-gray-700 dark:border-gray-600"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-4 border-t dark:border-gray-700">
                  <Button
                    type="button"
                    onClick={() => {
                      setNewSourceName('');
                      setShowAddNewSource(false);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (newSourceName.trim()) {
                        onFieldChange('source', newSourceName.trim());
                        setTempSource(newSourceName.trim());
                        setNewSourceName('');
                        setShowAddNewSource(false);
                        setShowChangeSourceDialog(false);
                      }
                    }}
                    disabled={!newSourceName.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Add & Apply
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default LeadDetailsDialog;
