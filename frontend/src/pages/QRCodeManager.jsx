import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Download, Eye, Trash2, QrCode, BarChart3, Plus } from 'lucide-react';

export default function QRCodeManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total_count: 0, total_scans: 0 });
  const [qrImages, setQrImages] = useState({}); // Store QR images as blob URLs
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingQR, setViewingQR] = useState(null);
  
  // Create QR Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    landing_page_type: 'single',
    landing_page_single: '',
    landing_page_ios: '',
    landing_page_android: '',
    landing_page_mobile: '',
    landing_page_desktop: '',
    campaign_name: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: ''
  });
  const [selectedQRs, setSelectedQRs] = useState([]);

  useEffect(() => {
    fetchQRCodes();
  }, []);

  const fetchQRCodes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/qr-codes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const codes = response.data.qr_codes || [];
      setQrCodes(codes);
      setStats({
        total_count: response.data.total_count || 0,
        total_scans: response.data.total_scans || 0
      });
      
      // Fetch QR images for all codes
      const imagePromises = codes.map(async (qr) => {
        try {
          const imgResponse = await axios.get(`${API}/qr-codes/${qr.id}/download`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
          });
          const imageUrl = URL.createObjectURL(imgResponse.data);
          return { id: qr.id, url: imageUrl };
        } catch (error) {
          console.error(`Failed to load QR image for ${qr.id}:`, error);
          return { id: qr.id, url: null };
        }
      });
      
      const images = await Promise.all(imagePromises);
      const imageMap = {};
      images.forEach(img => {
        imageMap[img.id] = img.url;
      });
      setQrImages(imageMap);
      
    } catch (error) {
      console.error('Failed to fetch QR codes:', error);
      toast.error('Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQR = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Please enter a QR code name');
      return;
    }

    if (formData.landing_page_type === 'single' && !formData.landing_page_single.trim()) {
      toast.error('Please enter a landing page URL');
      return;
    }

    if (formData.landing_page_type === 'multiple') {
      if (!formData.landing_page_ios && !formData.landing_page_android && 
          !formData.landing_page_mobile && !formData.landing_page_desktop) {
        toast.error('Please enter at least one landing page URL');
        return;
      }
    }

    try {
      setCreateLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/qr-codes/create`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('QR code created successfully!');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchQRCodes();
    } catch (error) {
      console.error('Failed to create QR code:', error);
      toast.error(error.response?.data?.detail || 'Failed to create QR code');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDownloadQR = async (qrId, qrName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/qr-codes/${qrId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${qrName}_QR.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('QR code downloaded!');
    } catch (error) {
      console.error('Failed to download QR code:', error);
      toast.error('Failed to download QR code');
    }
  };

  const handleDeleteQR = async (qrId, qrName) => {
    if (!window.confirm(`Are you sure you want to delete "${qrName}"? This will also delete all scan data.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/qr-codes/${qrId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('QR code deleted successfully');
      fetchQRCodes();
    } catch (error) {
      console.error('Failed to delete QR code:', error);
      toast.error('Failed to delete QR code');
    }
  };

  const handleViewAnalytics = (qrId) => {
    navigate(`/dashboard/qr-codes/${qrId}/analytics`);
  };

  const handleViewQR = (qr) => {
    setViewingQR(qr);
    setViewModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      landing_page_type: 'single',
      landing_page_single: '',
      landing_page_ios: '',
      landing_page_android: '',
      landing_page_mobile: '',
      landing_page_desktop: '',
      campaign_name: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      utm_term: '',
      utm_content: ''
    });
  };

  const handleBatchDownload = async () => {
    if (selectedQRs.length === 0) {
      toast.error('Please select at least one QR code to download');
      return;
    }

    try {
      toast.info('Preparing download...');
      const token = localStorage.getItem('token');
      
      // Download all selected QRs
      for (const qrId of selectedQRs) {
        const qr = qrCodes.find(q => q.id === qrId);
        if (qr) {
          await handleDownloadQR(qrId, qr.name);
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between downloads
        }
      }
      
      toast.success(`Downloaded ${selectedQRs.length} QR codes!`);
      setSelectedQRs([]);
    } catch (error) {
      console.error('Failed to batch download:', error);
      toast.error('Failed to download some QR codes');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedQRs.length === 0) {
      toast.error('Please select at least one QR code to delete');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${selectedQRs.length} selected QR code(s)? This will also delete all their scan data. This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      toast.info('Deleting selected QR codes...');
      const token = localStorage.getItem('token');
      
      // Delete all selected QRs
      for (const qrId of selectedQRs) {
        await axios.delete(`${API}/qr-codes/${qrId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      toast.success(`Successfully deleted ${selectedQRs.length} QR code(s)!`);
      setSelectedQRs([]);
      fetchQRCodes(); // Refresh the list
    } catch (error) {
      console.error('Failed to batch delete:', error);
      toast.error('Failed to delete some QR codes');
    }
  };

  const toggleQRSelection = (qrId) => {
    setSelectedQRs(prev => 
      prev.includes(qrId) 
        ? prev.filter(id => id !== qrId)
        : [...prev, qrId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedQRs.length === qrCodes.length) {
      setSelectedQRs([]);
    } else {
      setSelectedQRs(qrCodes.map(qr => qr.id));
    }
  };

  const autoFillUTM = () => {
    const campaignSlug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    setFormData(prev => ({
      ...prev,
      utm_source: prev.utm_source || 'qr_code',
      utm_medium: prev.utm_medium || 'qr_scan',
      utm_campaign: prev.utm_campaign || campaignSlug,
      utm_content: prev.utm_content || campaignSlug
    }));
    toast.success('UTM parameters auto-filled!');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">QR Code Manager</h1>
          <p className="text-gray-600 mt-1">Create and manage dynamic QR codes with scan tracking</p>
        </div>
        <div className="flex gap-2">
          {selectedQRs.length > 0 && (
            <Button onClick={handleBatchDownload} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
              <Download className="w-4 h-4 mr-2" />
              Download Selected ({selectedQRs.length})
            </Button>
          )}
          <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Create QR Code
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total QR Codes</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_scans}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active QR Codes</CardTitle>
            <QrCode className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {qrCodes.filter(qr => qr.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QR Codes Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading QR codes...</p>
        </div>
      ) : qrCodes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <QrCode className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No QR Codes Yet</h3>
            <p className="text-gray-600 mb-4">Create your first dynamic QR code to get started</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Create QR Code
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {qrCodes.length > 1 && (
            <div className="flex items-center justify-between mb-4">
              <Button 
                onClick={toggleSelectAll} 
                variant="outline" 
                size="sm"
              >
                {selectedQRs.length === qrCodes.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedQRs.length > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedQRs.length} of {qrCodes.length} selected
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {qrCodes.map((qr) => (
              <Card 
                key={qr.id} 
                className={`hover:shadow-lg transition-shadow ${
                  selectedQRs.includes(qr.id) ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedQRs.includes(qr.id)}
                        onChange={() => toggleQRSelection(qr.id)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                      <div className="flex-1">
                        <CardTitle className="text-lg">{qr.name}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                          Created: {formatDate(qr.created_at)}
                        </p>
                        {qr.campaign_name && (
                          <p className="text-xs text-blue-600 mt-1">
                            Campaign: {qr.campaign_name}
                          </p>
                        )}
                      </div>
                    </div>
                    {qr.is_active && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* QR Code Preview */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-3 flex items-center justify-center">
                    {qrImages[qr.id] ? (
                      <img 
                        src={qrImages[qr.id]}
                        alt={`QR Code for ${qr.name}`}
                        className="h-24 w-24 object-contain"
                      />
                    ) : (
                      <QrCode className="h-24 w-24 text-gray-400" />
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Scans:</span>
                    <span className="font-semibold text-blue-600">{qr.total_scans || 0}</span>
                  </div>

                  {/* Landing Page Type */}
                  <div className="text-sm">
                    <span className="text-gray-600">Type:</span>
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                      {qr.landing_page_type === 'single' ? 'Single URL' : 'Multiple URLs'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <Button
                      onClick={() => handleViewQR(qr)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      onClick={() => handleViewAnalytics(qr.id)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Analytics
                    </Button>
                    <Button
                      onClick={() => handleDownloadQR(qr.id, qr.name)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleDeleteQR(qr.id, qr.name)}
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 hover:bg-red-50 mt-2"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}

      {/* Create QR Code Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New QR Code</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">QR Code Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Product Launch Campaign"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Landing Page Type */}
            <div>
              <Label>Landing Page Type *</Label>
              <RadioGroup
                value={formData.landing_page_type}
                onValueChange={(value) => setFormData({ ...formData, landing_page_type: value })}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single" className="font-normal cursor-pointer">
                    Single URL (same for all devices)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple" id="multiple" />
                  <Label htmlFor="multiple" className="font-normal cursor-pointer">
                    Multiple URLs (device-specific)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Single URL */}
            {formData.landing_page_type === 'single' && (
              <div>
                <Label htmlFor="landing_page_single">Landing Page URL *</Label>
                <Input
                  id="landing_page_single"
                  type="url"
                  placeholder="https://example.com"
                  value={formData.landing_page_single}
                  onChange={(e) => setFormData({ ...formData, landing_page_single: e.target.value })}
                />
              </div>
            )}

            {/* Multiple URLs */}
            {formData.landing_page_type === 'multiple' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="landing_page_ios">iOS Landing Page</Label>
                  <Input
                    id="landing_page_ios"
                    type="url"
                    placeholder="https://apps.apple.com/..."
                    value={formData.landing_page_ios}
                    onChange={(e) => setFormData({ ...formData, landing_page_ios: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="landing_page_android">Android Landing Page</Label>
                  <Input
                    id="landing_page_android"
                    type="url"
                    placeholder="https://play.google.com/..."
                    value={formData.landing_page_android}
                    onChange={(e) => setFormData({ ...formData, landing_page_android: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="landing_page_mobile">Mobile Web Landing Page</Label>
                  <Input
                    id="landing_page_mobile"
                    type="url"
                    placeholder="https://example.com/mobile"
                    value={formData.landing_page_mobile}
                    onChange={(e) => setFormData({ ...formData, landing_page_mobile: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="landing_page_desktop">Desktop Landing Page</Label>
                  <Input
                    id="landing_page_desktop"
                    type="url"
                    placeholder="https://example.com"
                    value={formData.landing_page_desktop}
                    onChange={(e) => setFormData({ ...formData, landing_page_desktop: e.target.value })}
                  />
                </div>
                <p className="text-sm text-gray-500">* At least one landing page URL is required</p>
              </div>
            )}

            {/* Campaign Name */}
            <div>
              <Label htmlFor="campaign_name">Campaign Name (Optional)</Label>
              <Input
                id="campaign_name"
                placeholder="e.g., Summer 2025"
                value={formData.campaign_name}
                onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Group multiple QR codes under a campaign</p>
            </div>

            {/* UTM Parameters Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">UTM Parameters (Optional)</Label>
                {formData.name && (
                  <Button 
                    type="button"
                    onClick={autoFillUTM}
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                  >
                    Auto-fill from Name
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Add UTM parameters to track campaign performance in Google Analytics
              </p>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="utm_source" className="text-sm">Source</Label>
                    <Input
                      id="utm_source"
                      placeholder="e.g., qr_code"
                      value={formData.utm_source}
                      onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="utm_medium" className="text-sm">Medium</Label>
                    <Input
                      id="utm_medium"
                      placeholder="e.g., qr_scan"
                      value={formData.utm_medium}
                      onChange={(e) => setFormData({ ...formData, utm_medium: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="utm_campaign" className="text-sm">Campaign</Label>
                  <Input
                    id="utm_campaign"
                    placeholder="e.g., product_launch"
                    value={formData.utm_campaign}
                    onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="utm_term" className="text-sm">Term (Optional)</Label>
                    <Input
                      id="utm_term"
                      placeholder="e.g., keywords"
                      value={formData.utm_term}
                      onChange={(e) => setFormData({ ...formData, utm_term: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="utm_content" className="text-sm">Content (Optional)</Label>
                    <Input
                      id="utm_content"
                      placeholder="e.g., banner_ad"
                      value={formData.utm_content}
                      onChange={(e) => setFormData({ ...formData, utm_content: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateQR} disabled={createLoading} className="bg-blue-600 hover:bg-blue-700">
              {createLoading ? 'Creating...' : 'Create QR Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View QR Code Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code: {viewingQR?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* QR Code Image */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 flex items-center justify-center">
              {viewingQR && qrImages[viewingQR.id] ? (
                <img 
                  src={qrImages[viewingQR.id]}
                  alt={`QR Code for ${viewingQR.name}`}
                  className="h-48 w-48 object-contain"
                />
              ) : (
                <QrCode className="h-48 w-48 text-gray-400" />
              )}
            </div>

            {/* QR Code Details */}
            {viewingQR && (
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-600">Name:</span>
                  <p className="text-sm">{viewingQR.name}</p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-gray-600">Type:</span>
                  <p className="text-sm">
                    {viewingQR.landing_page_type === 'single' ? 'Single URL' : 'Multiple URLs'}
                  </p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-gray-600">Total Scans:</span>
                  <p className="text-sm font-semibold text-blue-600">{viewingQR.total_scans || 0}</p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-gray-600">Created:</span>
                  <p className="text-sm">{viewingQR.created_at ? formatDate(viewingQR.created_at) : 'N/A'}</p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    viewingQR.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {viewingQR.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Landing Page URLs */}
                <div>
                  <span className="text-sm font-medium text-gray-600">Landing Pages:</span>
                  <div className="mt-1 space-y-1">
                    {viewingQR.landing_page_type === 'single' ? (
                      <p className="text-sm break-all">{viewingQR.landing_page_single}</p>
                    ) : (
                      <div className="space-y-1">
                        {viewingQR.landing_page_ios && (
                          <div>
                            <span className="text-xs text-gray-500">iOS:</span>
                            <p className="text-sm break-all">{viewingQR.landing_page_ios}</p>
                          </div>
                        )}
                        {viewingQR.landing_page_android && (
                          <div>
                            <span className="text-xs text-gray-500">Android:</span>
                            <p className="text-sm break-all">{viewingQR.landing_page_android}</p>
                          </div>
                        )}
                        {viewingQR.landing_page_mobile && (
                          <div>
                            <span className="text-xs text-gray-500">Mobile:</span>
                            <p className="text-sm break-all">{viewingQR.landing_page_mobile}</p>
                          </div>
                        )}
                        {viewingQR.landing_page_desktop && (
                          <div>
                            <span className="text-xs text-gray-500">Desktop:</span>
                            <p className="text-sm break-all">{viewingQR.landing_page_desktop}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
            {viewingQR && (
              <Button 
                onClick={() => handleDownloadQR(viewingQR.id, viewingQR.name)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
