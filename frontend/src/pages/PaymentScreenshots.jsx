import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FileText, Image, ChevronRight, Download, Trash2, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';

const PaymentScreenshots = () => {
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState([]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleDownload = async (fileName) => {
    try {
      const token = localStorage.getItem('token');
      const path = [...currentPath, fileName].join('/');
      
      const response = await axios.get(`${API}/admin/payment-screenshots/download`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { path },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded ${fileName}`);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (itemName, isFolder) => {
    if (!window.confirm(`Are you sure you want to delete ${itemName}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const path = [...currentPath, itemName].join('/');
      
      await axios.delete(`${API}/admin/payment-screenshots/delete`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { path, is_folder: isFolder }
      });

      toast.success(`Deleted ${itemName}`);
      fetchContents();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const isImage = (fileName) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

  const isExcel = (fileName) => {
    return fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Payment Screenshots
          </h1>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => setCurrentPath([])}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Home
          </button>
          {currentPath.map((folder, index) => (
            <React.Fragment key={index}>
              <ChevronRight size={16} className="text-gray-400" />
              <button
                onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {folder}
              </button>
            </React.Fragment>
          ))}
        </div>

        {currentPath.length > 0 && (
          <button
            onClick={handleBackClick}
            className="mt-4 flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Folders</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {folders.map((folder) => (
                    <button
                      key={folder}
                      onClick={() => handleFolderClick(folder)}
                      className="flex flex-col items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Folder size={48} className="text-blue-500 mb-2" />
                      <span className="text-sm text-center text-gray-700 dark:text-gray-300 truncate w-full">
                        {folder}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {files.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Files</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => (
                    <div
                      key={file}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {isImage(file) ? (
                          <Image size={24} className="text-green-500 flex-shrink-0" />
                        ) : isExcel(file) ? (
                          <FileText size={24} className="text-blue-500 flex-shrink-0" />
                        ) : (
                          <FileText size={24} className="text-gray-500 flex-shrink-0" />
                        )}
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {file}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(file, false)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {folders.length === 0 && files.length === 0 && (
              <div className="text-center py-12">
                <Folder size={64} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  No folders or files found
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                  Screenshots will appear here after processing payment reconciliation
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentScreenshots;
