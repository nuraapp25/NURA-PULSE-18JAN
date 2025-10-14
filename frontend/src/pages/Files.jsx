import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Folder, Upload, Download, Share2, Trash2, CheckCircle, FileIcon, XCircle, Eye } from "lucide-react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { toast } from "sonner";

const Files = () => {
  const { user } = useAuth();
  const isMasterAdmin = user?.account_type === "master_admin";

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/admin/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(response.data.files);
    } catch (error) {
      toast.error("Failed to fetch files");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (100MB limit)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast.error(`File size exceeds 100MB limit. Selected file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        event.target.value = null;
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/admin/files/upload`,
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
          <p className="font-semibold">File Uploaded!</p>
          <p className="text-sm mt-1">{response.data.message}</p>
        </div>,
        { duration: 5000 }
      );

      setUploadDialogOpen(false);
      setSelectedFile(null);
      await fetchFiles();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleViewFile = async (fileId, filename) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/admin/files/${fileId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Determine file type
      const fileExtension = filename.split('.').pop().toLowerCase();
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      // Open in new window with scrolling
      const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes');
      
      if (newWindow) {
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileExtension)) {
          // Image file
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${filename}</title>
              <style>
                body { margin: 0; padding: 20px; background: #f5f5f5; display: flex; flex-direction: column; align-items: center; }
                h1 { color: #333; margin-bottom: 20px; }
                img { max-width: 100%; height: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .download-btn { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
                .download-btn:hover { background: #45a049; }
              </style>
            </head>
            <body>
              <h1>📷 ${filename}</h1>
              <button class="download-btn" onclick="window.location.href='${url}'">⬇️ Download</button>
              <img src="${url}" alt="${filename}" />
            </body>
            </html>
          `);
        } else if (['pdf'].includes(fileExtension)) {
          // PDF file
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${filename}</title>
              <style>
                body { margin: 0; height: 100vh; }
                iframe { width: 100%; height: 100%; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${url}" type="application/pdf"></iframe>
            </body>
            </html>
          `);
        } else if (['txt', 'csv', 'json', 'xml', 'log'].includes(fileExtension)) {
          // Text-based files
          const reader = new FileReader();
          reader.onload = function(e) {
            const text = e.target.result;
            newWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>${filename}</title>
                <style>
                  body { font-family: 'Courier New', monospace; padding: 20px; background: #f5f5f5; }
                  h1 { color: #333; margin-bottom: 20px; }
                  pre { background: white; padding: 20px; border-radius: 8px; overflow-x: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                  .download-btn { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
                  .download-btn:hover { background: #45a049; }
                </style>
              </head>
              <body>
                <h1>📄 ${filename}</h1>
                <button class="download-btn" onclick="window.location.href='${url}'">⬇️ Download</button>
                <pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
              </body>
              </html>
            `);
          };
          reader.readAsText(blob);
        } else {
          // Unsupported type - just offer download
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${filename}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; text-align: center; }
                h1 { color: #333; }
                p { color: #666; margin: 20px 0; }
                .download-btn { background: #4CAF50; color: white; padding: 15px 30px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
                .download-btn:hover { background: #45a049; }
              </style>
            </head>
            <body>
              <h1>📁 ${filename}</h1>
              <p>Preview not available for this file type.</p>
              <button class="download-btn" onclick="window.location.href='${url}'">⬇️ Download File</button>
            </body>
            </html>
          `);
        }
        newWindow.document.close();
      }
    } catch (error) {
      toast.error("Failed to view file");
    }
  };

  const handleDownload = async (fileId, filename) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/admin/files/${fileId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`Downloading ${filename}`);
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  const handleShare = async (fileId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/admin/files/${fileId}/share-link`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setShareLink(response.data.share_link);
      setShareDialogOpen(true);
    } catch (error) {
      toast.error("Failed to generate share link");
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Link copied to clipboard!");
  };

  const handleDelete = async (fileId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API}/admin/files/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success("File deleted successfully");
      await fetchFiles();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete file");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) {
      toast.error("No files selected");
      return;
    }

    if (!window.confirm(`Delete ${selectedFiles.length} selected file(s)?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/admin/files/bulk-delete`,
        selectedFiles,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success(`Deleted ${selectedFiles.length} file(s)`);
      setSelectedFiles([]);
      await fetchFiles();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete files");
    }
  };

  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="files-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Files</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Upload and manage files for data processing</p>
        </div>
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Upload size={18} className="mr-2" />
          Upload File
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedFiles.length > 0 && isMasterAdmin && (
        <Card className="dark:bg-gray-800 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedFiles.length} file(s) selected
              </p>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setSelectedFiles([])}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 dark:border-gray-600"
                >
                  Clear
                </Button>
                {isMasterAdmin && (
                  <Button
                    onClick={handleBulkDelete}
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete Selected
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files List */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
            <div className="flex items-center">
              <Folder size={20} className="mr-2" />
              Uploaded Files ({files.length})
            </div>
            {files.length > 0 && (
              <Button
                onClick={toggleSelectAll}
                variant="outline"
                size="sm"
                className="text-sm"
              >
                {selectedFiles.length === files.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-12">
              <FileIcon size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No files uploaded yet
              </p>
              <Button onClick={() => setUploadDialogOpen(true)} variant="outline">
                <Upload size={18} className="mr-2" />
                Upload Your First File
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedFiles.length === files.length && files.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      S.No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {files.map((file, index) => (
                    <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <FileIcon size={16} className="mr-2 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm text-gray-900 dark:text-white">
                            {file.original_filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {file.size_display}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(file.uploaded_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => handleViewFile(file.id, file.original_filename)}
                            variant="outline"
                            size="sm"
                            className="border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            title="View"
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            onClick={() => handleDownload(file.id, file.original_filename)}
                            variant="outline"
                            size="sm"
                            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title="Download"
                          >
                            <Download size={16} />
                          </Button>
                          <Button
                            onClick={() => handleShare(file.id)}
                            variant="outline"
                            size="sm"
                            className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Share"
                          >
                            <Share2 size={16} />
                          </Button>
                          {isMasterAdmin && (
                            <Button
                              onClick={() => handleDelete(file.id, file.original_filename)}
                              variant="outline"
                              size="sm"
                              className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete (Master Admin only)"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Upload File</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Upload any file format. Maximum file size: 100MB
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload size={32} className="text-gray-400 dark:text-gray-500 mb-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Click to select a file
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Any format, max 100MB
                </span>
              </label>
            </div>

            {selectedFile && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                    <span className="text-sm text-gray-900 dark:text-white font-medium">
                      {selectedFile.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  setUploadDialogOpen(false);
                  setSelectedFile(null);
                }}
                variant="outline"
                className="flex-1 dark:border-gray-600"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? (
                  <>
                    <Upload size={18} className="mr-2 animate-pulse" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={18} className="mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Link Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Share File</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Copy this link to share the file
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-900 dark:text-white break-all">
                {shareLink}
              </p>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={() => setShareDialogOpen(false)}
                variant="outline"
                className="flex-1 dark:border-gray-600"
              >
                Close
              </Button>
              <Button
                onClick={copyShareLink}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Share2 size={18} className="mr-2" />
                Copy Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Files;
