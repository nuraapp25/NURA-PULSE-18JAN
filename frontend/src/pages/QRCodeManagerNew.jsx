import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { QrCode, Plus, FolderOpen, Download, Trash2, BarChart3, Upload, Copy, Eye } from "lucide-react";

const QRCodeManagerNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // State management
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignQRCodes, setCampaignQRCodes] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Selection states
  const [selectedCampaigns, setSelectedCampaigns] = useState([]);
  const [selectedQRCodes, setSelectedQRCodes] = useState([]);
  const [selectAllCampaigns, setSelectAllCampaigns] = useState(false);
  const [selectAllQRCodes, setSelectAllQRCodes] = useState(false);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  
  // Form states for Create QR Code
  const [campaignName, setCampaignName] = useState("");
  const [landingPageType, setLandingPageType] = useState("single");
  const [singleUrl, setSingleUrl] = useState("");
  const [iosUrl, setIosUrl] = useState("");
  const [androidUrl, setAndroidUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("qrscan");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");
  
  // Batch form states
  const [batchCampaignName, setBatchCampaignName] = useState("");
  const [batchQrCount, setBatchQrCount] = useState(10);
  const [batchQrNames, setBatchQrNames] = useState("");
  const [batchFile, setBatchFile] = useState(null);
  const [autoFillUtm, setAutoFillUtm] = useState(true);
  const [batchLandingPageType, setBatchLandingPageType] = useState("single");
  
  useEffect(() => {
    fetchCampaigns();
  }, []);
  
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/qr-codes/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCampaignQRCodes = async (campaignName) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/qr-codes/campaign/${encodeURIComponent(campaignName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaignQRCodes(response.data.qr_codes || []);
      setSelectedCampaign(campaignName);
    } catch (error) {
      console.error("Error fetching campaign QR codes:", error);
      toast.error("Failed to load QR codes");
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateQRCode = async () => {
    if (!campaignName) {
      toast.error("Please enter a campaign name");
      return;
    }
    
    if (landingPageType === "single" && !singleUrl) {
      toast.error("Please enter a URL");
      return;
    }
    
    if (landingPageType === "multiple" && (!iosUrl || !androidUrl || !webUrl)) {
      toast.error("Please enter all platform URLs");
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      const payload = {
        campaign_name: campaignName,
        landing_page_type: landingPageType,
        single_url: singleUrl || null,
        ios_url: iosUrl || null,
        android_url: androidUrl || null,
        web_url: webUrl || null,
        utm_source: utmSource || campaignName,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign || campaignName,
        utm_term: utmTerm || null,
        utm_content: utmContent || null
      };
      
      const response = await axios.post(`${API}/qr-codes/create`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("QR Code created successfully!");
      setCreateDialogOpen(false);
      resetCreateForm();
      fetchCampaigns();
    } catch (error) {
      console.error("Error creating QR code:", error);
      toast.error(error.response?.data?.detail || "Failed to create QR code");
    }
  };
  
  const handleCreateBatchQRCodes = async () => {
    if (!batchCampaignName) {
      toast.error("Please enter a campaign name");
      return;
    }
    
    if (batchQrCount < 1 || batchQrCount > 100) {
      toast.error("QR count must be between 1 and 100");
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      
      // Parse QR names
      let qrNamesArray = [];
      if (batchFile) {
        // Handle file upload
        const formData = new FormData();
        formData.append("file", batchFile);
        
        // For now, we'll parse it client-side
        // In production, you'd want to send this to backend
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target.result;
          const lines = text.split('\n');
          qrNamesArray = lines.slice(1).filter(line => line.trim()).map(line => line.split(',')[0].trim());
          await createBatch(qrNamesArray);
        };
        reader.readAsText(batchFile);
        return;
      } else if (batchQrNames) {
        qrNamesArray = batchQrNames.split(',').map(name => name.trim()).filter(name => name);
      }
      
      await createBatch(qrNamesArray);
      
    } catch (error) {
      console.error("Error creating batch QR codes:", error);
      toast.error(error.response?.data?.detail || "Failed to create batch QR codes");
    }
  };
  
  const createBatch = async (qrNamesArray) => {
    const token = localStorage.getItem("token");
    const payload = {
      campaign_name: batchCampaignName,
      landing_page_type: batchLandingPageType,
      single_url: singleUrl || null,
      ios_url: iosUrl || null,
      android_url: androidUrl || null,
      web_url: webUrl || null,
      qr_count: batchQrCount,
      qr_names: qrNamesArray.length > 0 ? qrNamesArray : null,
      auto_fill_utm: autoFillUtm,
      utm_medium: utmMedium,
      utm_campaign: batchCampaignName
    };
    
    const response = await axios.post(`${API}/qr-codes/create-batch`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    toast.success(`Created ${response.data.count} QR codes successfully!`);
    setBatchDialogOpen(false);
    resetBatchForm();
    fetchCampaigns();
  };
  
  const resetCreateForm = () => {
    setCampaignName("");
    setLandingPageType("single");
    setSingleUrl("");
    setIosUrl("");
    setAndroidUrl("");
    setWebUrl("");
    setUtmSource("");
    setUtmMedium("qrscan");
    setUtmCampaign("");
    setUtmTerm("");
    setUtmContent("");
  };
  
  const resetBatchForm = () => {
    setBatchCampaignName("");
    setBatchQrCount(10);
    setBatchQrNames("");
    setBatchFile(null);
    setAutoFillUtm(true);
    setBatchLandingPageType("single");
  };
  
  const downloadQRCode = (qrCode) => {
    const link = document.createElement('a');
    link.href = qrCode.qr_image;
    link.download = `${qrCode.qr_name || qrCode.utm_source || 'qr-code'}.png`;
    link.click();
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };
  
  // Checkbox handlers for campaigns
  const handleSelectAllCampaigns = () => {
    if (selectAllCampaigns) {
      setSelectedCampaigns([]);
    } else {
      setSelectedCampaigns(campaigns.map(c => c.campaign_name));
    }
    setSelectAllCampaigns(!selectAllCampaigns);
  };
  
  const handleCampaignCheckbox = (campaignName) => {
    if (selectedCampaigns.includes(campaignName)) {
      setSelectedCampaigns(selectedCampaigns.filter(c => c !== campaignName));
      setSelectAllCampaigns(false);
    } else {
      const newSelected = [...selectedCampaigns, campaignName];
      setSelectedCampaigns(newSelected);
      if (newSelected.length === campaigns.length) {
        setSelectAllCampaigns(true);
      }
    }
  };
  
  // Checkbox handlers for QR codes
  const handleSelectAllQRCodes = () => {
    if (selectAllQRCodes) {
      setSelectedQRCodes([]);
    } else {
      setSelectedQRCodes(campaignQRCodes.map(qr => qr.id));
    }
    setSelectAllQRCodes(!selectAllQRCodes);
  };
  
  const handleQRCodeCheckbox = (qrId) => {
    if (selectedQRCodes.includes(qrId)) {
      setSelectedQRCodes(selectedQRCodes.filter(id => id !== qrId));
      setSelectAllQRCodes(false);
    } else {
      const newSelected = [...selectedQRCodes, qrId];
      setSelectedQRCodes(newSelected);
      if (newSelected.length === campaignQRCodes.length) {
        setSelectAllQRCodes(true);
      }
    }
  };
  
  // Bulk operations for campaigns
  const handleDeleteSelectedCampaigns = async () => {
    if (selectedCampaigns.length === 0) {
      toast.error("No campaigns selected");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete ${selectedCampaigns.length} campaign(s)?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      // Delete each campaign
      for (const campaignName of selectedCampaigns) {
        await axios.delete(`${API}/qr-codes/campaign/${encodeURIComponent(campaignName)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      toast.success(`Deleted ${selectedCampaigns.length} campaign(s)`);
      setSelectedCampaigns([]);
      setSelectAllCampaigns(false);
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting campaigns:", error);
      toast.error("Failed to delete campaigns");
    }
  };
  
  const handleDeleteAllCampaigns = async () => {
    if (campaigns.length === 0) {
      toast.error("No campaigns to delete");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete ALL ${campaigns.length} campaigns?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      // Delete all campaigns
      for (const campaign of campaigns) {
        await axios.delete(`${API}/qr-codes/campaign/${encodeURIComponent(campaign.campaign_name)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      toast.success(`Deleted all ${campaigns.length} campaigns`);
      setSelectedCampaigns([]);
      setSelectAllCampaigns(false);
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting all campaigns:", error);
      toast.error("Failed to delete all campaigns");
    }
  };
  
  // Bulk operations for QR codes
  const handleDeleteSelectedQRCodes = async () => {
    if (selectedQRCodes.length === 0) {
      toast.error("No QR codes selected");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete ${selectedQRCodes.length} QR code(s)?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      // Delete each QR code
      for (const qrId of selectedQRCodes) {
        await axios.delete(`${API}/qr-codes/${qrId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      toast.success(`Deleted ${selectedQRCodes.length} QR code(s)`);
      setSelectedQRCodes([]);
      setSelectAllQRCodes(false);
      fetchCampaignQRCodes(selectedCampaign);
    } catch (error) {
      console.error("Error deleting QR codes:", error);
      toast.error("Failed to delete QR codes");
    }
  };
  
  const handleDownloadSelectedQRCodes = () => {
    if (selectedQRCodes.length === 0) {
      toast.error("No QR codes selected");
      return;
    }
    
    selectedQRCodes.forEach(qrId => {
      const qrCode = campaignQRCodes.find(qr => qr.id === qrId);
      if (qrCode) {
        downloadQRCode(qrCode);
      }
    });
    
    toast.success(`Downloading ${selectedQRCodes.length} QR code(s)`);
  };
  
  const handleDownloadAllQRCodes = () => {
    if (campaignQRCodes.length === 0) {
      toast.error("No QR codes to download");
      return;
    }
    
    campaignQRCodes.forEach(qrCode => {
      downloadQRCode(qrCode);
    });
    
    toast.success(`Downloading all ${campaignQRCodes.length} QR codes`);
  };
  
  const handleDeleteAllQRCodes = async () => {
    if (campaignQRCodes.length === 0) {
      toast.error("No QR codes to delete");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete ALL ${campaignQRCodes.length} QR codes in this campaign?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      // Delete all QR codes
      for (const qrCode of campaignQRCodes) {
        await axios.delete(`${API}/qr-codes/${qrCode.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      toast.success(`Deleted all ${campaignQRCodes.length} QR codes`);
      setSelectedQRCodes([]);
      setSelectAllQRCodes(false);
      fetchCampaignQRCodes(selectedCampaign);
    } catch (error) {
      console.error("Error deleting all QR codes:", error);
      toast.error("Failed to delete all QR codes");
    }
  };
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-8 h-8 text-teal-600" />
            QR Code Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage QR codes with smart device detection</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => navigate('/qr-analytics-dashboard')}
            variant="outline"
            className="border-teal-600 text-teal-600 hover:bg-teal-50"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            View Analytics
          </Button>
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create QR Code
          </Button>
          <Button 
            onClick={() => setBatchDialogOpen(true)}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Create Batch QR Codes
          </Button>
        </div>
      </div>
      
      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((campaign) => (
          <Card 
            key={campaign.campaign_name}
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-teal-500"
            onClick={() => fetchCampaignQRCodes(campaign.campaign_name)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-teal-600" />
                {campaign.campaign_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">QR Codes:</span>
                  <span className="font-semibold">{campaign.qr_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Scans:</span>
                  <span className="font-semibold text-teal-600">{campaign.total_scans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="text-xs">{new Date(campaign.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Campaign QR Codes */}
      {selectedCampaign && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>QR Codes - {selectedCampaign}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedCampaign(null)}
              >
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaignQRCodes.map((qrCode) => (
                <Card key={qrCode.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <img src={qrCode.qr_image} alt="QR Code" className="w-48 h-48 mx-auto mb-4" />
                      <p className="font-semibold text-lg mb-2">{qrCode.qr_name || qrCode.utm_source}</p>
                      <p className="text-xs text-gray-500 mb-2">Scans: {qrCode.scan_count}</p>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" onClick={() => downloadQRCode(qrCode)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(qrCode.tracking_url)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Create QR Code Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New QR Code</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>QR Code Name *</Label>
              <Input
                placeholder="e.g., Product Launch Campaign"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Landing Page Type *</Label>
              <Select value={landingPageType} onValueChange={setLandingPageType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single URL (same for all devices)</SelectItem>
                  <SelectItem value="multiple">Multiple URLs (device-specific)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {landingPageType === "single" ? (
              <div>
                <Label>Landing Page URL *</Label>
                <Input
                  placeholder="https://example.com"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>iOS App Store URL *</Label>
                  <Input
                    placeholder="https://apps.apple.com/..."
                    value={iosUrl}
                    onChange={(e) => setIosUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Android Play Store URL *</Label>
                  <Input
                    placeholder="https://play.google.com/..."
                    value={androidUrl}
                    onChange={(e) => setAndroidUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Web App URL *</Label>
                  <Input
                    placeholder="https://example.com/download"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                  />
                </div>
              </>
            )}
            
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">UTM Parameters (Optional)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Source</Label>
                  <Input
                    placeholder="e.g., qr_code"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Medium</Label>
                  <Input
                    placeholder="e.g., qr_scan"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Campaign</Label>
                  <Input
                    placeholder="e.g., product_launch"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Term</Label>
                  <Input
                    placeholder="e.g., keywords"
                    value={utmTerm}
                    onChange={(e) => setUtmTerm(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Content</Label>
                  <Input
                    placeholder="e.g., banner_ad"
                    value={utmContent}
                    onChange={(e) => setUtmContent(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateQRCode} className="bg-teal-600 hover:bg-teal-700">
              Create QR Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Batch QR Codes Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Batch QR Codes</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input
                placeholder="e.g., Summer 2025"
                value={batchCampaignName}
                onChange={(e) => setBatchCampaignName(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Group multiple QR codes under a campaign</p>
            </div>
            
            <div>
              <Label>Number of QR Codes *</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={batchQrCount}
                onChange={(e) => setBatchQrCount(parseInt(e.target.value) || 10)}
              />
            </div>
            
            <div>
              <Label>QR Code Names (Optional)</Label>
              <Input
                placeholder="TN55S7283, TN55S8122, TN55T3321"
                value={batchQrNames}
                onChange={(e) => setBatchQrNames(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated names or upload a file</p>
            </div>
            
            <div>
              <Label>Or Upload File (.csv/.xlsx)</Label>
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setBatchFile(e.target.files[0])}
              />
              <p className="text-xs text-gray-500 mt-1">Names should be in column A, starting from row 2</p>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoFillUtm"
                checked={autoFillUtm}
                onChange={(e) => setAutoFillUtm(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="autoFillUtm">Auto-fill UTM from Campaign Name</Label>
            </div>
            
            {/* Same URL fields as single QR code */}
            <div>
              <Label>Landing Page Type *</Label>
              <Select value={batchLandingPageType} onValueChange={setBatchLandingPageType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single URL (same for all devices)</SelectItem>
                  <SelectItem value="multiple">Multiple URLs (device-specific)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {batchLandingPageType === "single" ? (
              <div>
                <Label>Landing Page URL *</Label>
                <Input
                  placeholder="https://example.com"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>iOS App Store URL *</Label>
                  <Input
                    placeholder="https://apps.apple.com/..."
                    value={iosUrl}
                    onChange={(e) => setIosUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Android Play Store URL *</Label>
                  <Input
                    placeholder="https://play.google.com/..."
                    value={androidUrl}
                    onChange={(e) => setAndroidUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Web App URL *</Label>
                  <Input
                    placeholder="https://example.com/download"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBatchQRCodes} className="bg-yellow-600 hover:bg-yellow-700">
              Create QR Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QRCodeManagerNew;
