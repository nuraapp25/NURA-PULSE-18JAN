import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Image as ImageIcon, ChevronRight, Download, Trash2, ArrowLeft, X, ChevronLeft as PrevIcon, ChevronRight as NextIcon, Eye } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const PaymentScreenshots = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMasterAdmin = user?.account_type === "master_admin";
  
  const [currentPath, setCurrentPath] = useState([]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);

  // Cleanup blob URLs when modal closes
  const handleCloseViewer = () => {
    imageUrls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    setImageUrls([]);
    setViewerOpen(false);
  };

  useEffect(() => {
    fetchContents();
  }, [currentPath]);

  const fetchContents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const path = currentPath.join('/');
      
      const response = await axios.get(`${API}/admin/payment-screenshots/browse`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: path || '' }
      });

      setFolders(response.data.folders || []);
      setFiles(response.data.files || []);
    } catch (error) {
      console.error('Error fetching contents:', error);
      toast.error('Failed to load contents');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderName) => {
    setCurrentPath([...currentPath, folderName]);
  };

  const handleBackClick = () => {
    setCurrentPath(currentPath.slice(0, -1));
  };

  const handleViewImages = async (startIndex = 0) => {
    if (files.length === 0) {
      toast.error('No images to view');
      return;
    }
    
    const token = localStorage.getItem('token');
    const path = currentPath.join('/');
    
    // Fetch and create blob URLs for all image files
    const urlPromises = files.map(async (file) => {
      try {
        const filePath = path ? `${path}/${file.name}` : file.name;
        const response = await axios.get(`${API}/admin/payment-screenshots/download`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { path: filePath },
          responseType: 'blob'
        });
        
        return URL.createObjectURL(response.data);
      } catch (error) {
        console.error(`Error loading image ${file.name}:`, error);
        return null;
      }
    });
    
    const urls = await Promise.all(urlPromises);
    const validUrls = urls.filter(url => url !== null);
    
    if (validUrls.length === 0) {
      toast.error('Failed to load images');
      return;
    }
    
    setImageUrls(validUrls);
    setCurrentImageIndex(startIndex);
    setViewerOpen(true);
  };

  const handleViewSingleImage = async (fileIndex) => {
    await handleViewImages(fileIndex);
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  const handleDeleteFile = async (fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const path = currentPath.join('/');
      const filePath = path ? `${path}/${fileName}` : fileName;

      await axios.delete(`${API}/admin/payment-screenshots/delete`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { path: filePath }
      });

      toast.success('File deleted successfully');
      fetchContents();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleDownload = async (fileName) => {
    try {
      const token = localStorage.getItem('token');
      const path = currentPath.join('/');
      const filePath = path ? `${path}/${fileName}` : fileName;

      const response = await axios.get(`${API}/admin/payment-screenshots/download`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path: filePath },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Screenshots</h1>
          <p className="text-gray-600 mt-2">Browse and manage uploaded payment screenshots organized by Month Year / Driver Name</p>
        </div>

        {/* Breadcrumb */}
        {currentPath.length > 0 && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <button onClick={() => setCurrentPath([])} className="text-blue-600 hover:underline">
              Home
            </button>
            {currentPath.map((folder, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                  className="text-blue-600 hover:underline"
                >
                  {folder}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* View Images Button - Show when in a folder with files */}
        {files.length > 0 && (
          <div className="mb-4">
            <Button onClick={handleViewImages} className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              View All Images ({files.length})
            </Button>
          </div>
        )}

        {/* Content Grid */}
        <div className="bg-white rounded-lg shadow p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Folders */}
              {folders.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3 text-gray-700">Folders</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {folders.map((folder, index) => (
                      <div
                        key={index}
                        onClick={() => handleFolderClick(folder.name)}
                        className="flex items-center gap-3 p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <Folder className="w-8 h-8 text-blue-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{folder.name}</p>
                          <p className="text-sm text-gray-500">
                            {folder.file_count} file{folder.file_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {files.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 text-gray-700">Files</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <ImageIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium break-all">{file.name}</p>
                            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSingleImage(index)}
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file.name)}
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(file.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {folders.length === 0 && files.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No screenshots found</p>
                  <p className="text-sm mt-2">Upload screenshots via Payment Data Extractor and sync to Google Sheets</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      <Dialog open={viewerOpen} onOpenChange={(open) => !open && handleCloseViewer()}>
        <DialogContent className="max-w-5xl w-full h-[90vh] p-0">
          <div className="relative w-full h-full flex flex-col bg-black">
            {/* Close Button */}
            <button
              onClick={handleCloseViewer}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Image Counter */}
            <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/50 text-white rounded-full text-sm">
              {currentImageIndex + 1} / {imageUrls.length}
            </div>

            {/* Main Image */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              {imageUrls.length > 0 && (
                <img
                  src={imageUrls[currentImageIndex]}
                  alt={`Screenshot ${currentImageIndex + 1}`}
                  className="max-w-full max-h-full w-auto h-auto object-contain"
                  style={{ maxHeight: 'calc(90vh - 100px)' }}
                />
              )}
            </div>

            {/* Navigation Buttons */}
            {imageUrls.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <PrevIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <NextIcon className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentScreenshots;
