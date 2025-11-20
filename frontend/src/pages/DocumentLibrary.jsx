import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FolderOpen, Download, Trash2, Search, FileText, 
  Image as ImageIcon, FileIcon, Grid3x3, List, X 
} from "lucide-react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";

const DocumentLibrary = () => {
  const [folders, setFolders] = useState([]);
  const [filteredFolders, setFilteredFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [stats, setStats] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    // Filter folders based on search
    if (searchQuery.trim() === "") {
      setFilteredFolders(folders);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = folders.filter(folder => 
        folder.driver_name.toLowerCase().includes(query) ||
        folder.phone_number.toLowerCase().includes(query)
      );
      setFilteredFolders(filtered);
    }
  }, [searchQuery, folders]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/document-library/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setFolders(response.data.folders || []);
        setFilteredFolders(response.data.folders || []);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocument = (leadId, docType, checked) => {
    if (checked) {
      setSelectedDocuments([...selectedDocuments, { lead_id: leadId, document_type: docType }]);
    } else {
      setSelectedDocuments(selectedDocuments.filter(
        doc => !(doc.lead_id === leadId && doc.document_type === docType)
      ));
    }
  };

  const handleSelectAllInFolder = (folder, checked) => {
    if (checked) {
      const folderDocs = folder.documents.map(doc => ({
        lead_id: folder.lead_id,
        document_type: doc.document_type
      }));
      setSelectedDocuments([...selectedDocuments, ...folderDocs]);
    } else {
      setSelectedDocuments(selectedDocuments.filter(
        doc => doc.lead_id !== folder.lead_id
      ));
    }
  };

  const isDocumentSelected = (leadId, docType) => {
    return selectedDocuments.some(
      doc => doc.lead_id === leadId && doc.document_type === docType
    );
  };

  const isFolderSelected = (folder) => {
    return folder.documents.every(doc => 
      isDocumentSelected(folder.lead_id, doc.document_type)
    );
  };

  const handleDownloadSelected = async () => {
    if (selectedDocuments.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/document-library/download-bulk`,
        { selections: selectedDocuments },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `driver_documents_${new Date().getTime()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`Downloaded ${selectedDocuments.length} document(s) as ZIP`);
      setSelectedDocuments([]);
    } catch (error) {
      console.error("Error downloading documents:", error);
      toast.error("Failed to download documents");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedDocuments.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedDocuments.length} document(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/document-library/delete`,
        { selections: selectedDocuments },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setSelectedDocuments([]);
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error deleting documents:", error);
      toast.error("Failed to delete documents");
    }
  };

  const handlePreviewDocument = (folder, document) => {
    setPreviewDoc({
      lead_id: folder.lead_id,
      driver_name: folder.driver_name,
      document_type: document.document_type,
      file_extension: document.file_extension,
      filename: document.filename
    });
    setPreviewOpen(true);
  };

  const handleDownloadSingle = async (leadId, docType, driverName) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/document-library/download/${leadId}/${docType}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${driverName}_${docType}${getFileExtension(response.headers['content-type'])}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Document downloaded");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Failed to download document");
    }
  };

  const getFileExtension = (contentType) => {
    const types = {
      'application/pdf': '.pdf',
      'image/png': '.png',
      'image/jpeg': '.jpg'
    };
    return types[contentType] || '.file';
  };

  const getFileIcon = (extension) => {
    if (extension === '.pdf') return <FileText className="w-8 h-8 text-red-500" />;
    if (['.png', '.jpg', '.jpeg'].includes(extension)) return <ImageIcon className="w-8 h-8 text-blue-500" />;
    return <FileIcon className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDocumentType = (type) => {
    const labels = {
      'dl': 'Driving License',
      'aadhar': 'Aadhar Card',
      'pan': 'PAN Card',
      'gas_bill': 'Gas Bill',
      'bank_passbook': 'Bank Passbook'
    };
    return labels[type] || type;
  };

  const clearSelection = () => {
    setSelectedDocuments([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Document Library</h2>
          <p className="text-gray-600 mt-1">View and manage all driver documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Drivers</p>
                  <p className="text-2xl font-bold">{stats.total_drivers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Documents</p>
                  <p className="text-2xl font-bold">{stats.total_documents}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Download className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Storage</p>
                  <p className="text-2xl font-bold">{stats.total_size_mb} MB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by driver name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              {selectedDocuments.length > 0 && (
                <>
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    {selectedDocuments.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownloadSelected}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Display */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading documents...</p>
          </div>
        </div>
      ) : filteredFolders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">No documents found</p>
              <p className="text-gray-500 text-sm">
                {searchQuery ? "Try adjusting your search" : "Upload documents through Driver Onboarding"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFolders.map((folder) => (
            <Card key={folder.lead_id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      checked={isFolderSelected(folder)}
                      onCheckedChange={(checked) => handleSelectAllInFolder(folder, checked)}
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{folder.driver_name}</CardTitle>
                      <p className="text-sm text-gray-500">{folder.phone_number}</p>
                    </div>
                  </div>
                  <FolderOpen className="w-5 h-5 text-blue-500 flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {folder.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                    >
                      <Checkbox
                        checked={isDocumentSelected(folder.lead_id, doc.document_type)}
                        onCheckedChange={(checked) => 
                          handleSelectDocument(folder.lead_id, doc.document_type, checked)
                        }
                      />
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handlePreviewDocument(folder, doc)}
                      >
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc.file_extension)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {formatDocumentType(doc.document_type)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(doc.file_size)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadSingle(folder.lead_id, doc.document_type, folder.driver_name)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                  {folder.document_count} document(s) • {formatFileSize(folder.total_size)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <Checkbox
                        checked={selectedDocuments.length === filteredFolders.reduce((acc, f) => acc + f.documents.length, 0)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const allDocs = filteredFolders.flatMap(f =>
                              f.documents.map(d => ({ lead_id: f.lead_id, document_type: d.document_type }))
                            );
                            setSelectedDocuments(allDocs);
                          } else {
                            setSelectedDocuments([]);
                          }
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredFolders.flatMap((folder) =>
                    folder.documents.map((doc, idx) => (
                      <tr key={`${folder.lead_id}-${doc.document_type}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isDocumentSelected(folder.lead_id, doc.document_type)}
                            onCheckedChange={(checked) =>
                              handleSelectDocument(folder.lead_id, doc.document_type, checked)
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{folder.driver_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{folder.phone_number}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getFileIcon(doc.file_extension)}
                            <span className="text-sm">{formatDocumentType(doc.document_type)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatFileSize(doc.file_size)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreviewDocument(folder, doc)}
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadSingle(folder.lead_id, doc.document_type, folder.driver_name)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {previewDoc?.driver_name} - {formatDocumentType(previewDoc?.document_type)}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {previewDoc && (
              <>
                {previewDoc.file_extension === '.pdf' ? (
                  <iframe
                    src={`${API}/document-library/preview/${previewDoc.lead_id}/${previewDoc.document_type}#toolbar=0`}
                    className="w-full h-[600px] border rounded"
                    title="Document Preview"
                  />
                ) : (
                  <img
                    src={`${API}/document-library/preview/${previewDoc.lead_id}/${previewDoc.document_type}`}
                    alt="Document Preview"
                    className="w-full h-auto rounded"
                  />
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            {previewDoc && (
              <Button
                onClick={() => {
                  handleDownloadSingle(previewDoc.lead_id, previewDoc.document_type, previewDoc.driver_name);
                  setPreviewOpen(false);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentLibrary;
