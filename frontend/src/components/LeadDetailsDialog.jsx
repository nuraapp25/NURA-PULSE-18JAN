import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, Save, Trash2, Eye, Download, Upload, X } from "lucide-react";

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
  hasUnsavedChanges = false
}) => {
  if (!lead || !editedLead) return null;

  const DocumentSection = ({ docType, label, fieldName }) => (
    <div className="border-b border-blue-200 dark:border-blue-800 pb-4">
      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">{label}</Label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          {isEditMode ? (
            <Input
              value={editedLead[fieldName] || ''}
              onChange={(e) => onFieldChange(fieldName, e.target.value)}
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Select
                value={lead.stage && lead.stage.trim() !== "" ? lead.stage : "S1"}
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
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Status within Stage</Label>
              <Select
                value={lead.status && lead.status.trim() !== "" ? lead.status : "New"}
                onValueChange={(value) => onFieldChange('status', value)}
                disabled={updating}
              >
                <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700 max-h-[300px]">
                  {getStatusesForStage(lead.stage && lead.stage.trim() !== "" ? lead.stage : "S1").map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={`px-2 py-1 rounded text-xs ${option.color}`}>
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Remarks Field */}
            <div>
              <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Remarks</Label>
              <Textarea
                value={editedLead.remarks || ''}
                onChange={(e) => onFieldChange('remarks', e.target.value)}
                placeholder="Enter remarks about this lead..."
                className="w-full min-h-[80px] dark:bg-gray-700 dark:border-gray-600 text-sm"
                disabled={updating}
              />
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
            <div>
              {showDeleteButton && onDelete && (
                <Button
                  variant="destructive"
                  onClick={onDelete}
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Lead
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="dark:border-gray-600"
              >
                Close
              </Button>
              {isEditMode && hasUnsavedChanges && (
                <Button
                  onClick={onSave}
                  className="bg-blue-600 hover:bg-blue-700 animate-pulse"
                  disabled={updating}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailsDialog;
