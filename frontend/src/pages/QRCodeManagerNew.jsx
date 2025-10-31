import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
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
  const [selectedCampaignData, setSelectedCampaignData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  
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
  const [useDefaultLinks, setUseDefaultLinks] = useState(true);
  
  // QR Code color options
  const [useColorQR, setUseColorQR] = useState(false);
  const [qrForegroundColor, setQrForegroundColor] = useState("#000000");
  const [qrBackgroundColor, setQrBackgroundColor] = useState("#FFFFFF");
  
  // Default URLs
  const defaultUrls = {
    ios: "https://apps.apple.com/az/app/nura-mobility/id6749004862",
    android: "https://play.google.com/store/apps/details?id=in.co.nuraemobility.nuraApplication&pli=1",
    web: "https://nuraemobility.co.in/"
  };
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
  const [batchUseDefaultLinks, setBatchUseDefaultLinks] = useState(true);
  
  // Batch QR Code color options
  const [batchUseColorQR, setBatchUseColorQR] = useState(false);
  const [batchQrForegroundColor, setBatchQrForegroundColor] = useState("#000000");
  const [batchQrBackgroundColor, setBatchQrBackgroundColor] = useState("#FFFFFF");
  
  useEffect(() => {
    fetchCampaigns();
  }, []);
  
  // Handle default links toggle for single QR
  const handleUseDefaultLinks = () => {
    setUseDefaultLinks(true);
    if (landingPageType === "single") {
      setSingleUrl(defaultUrls.web);
    } else {
      setIosUrl(defaultUrls.ios);
      setAndroidUrl(defaultUrls.android);
      setWebUrl(defaultUrls.web);
    }
  };

  const handleUseCustomLinks = () => {
    setUseDefaultLinks(false);
    // Clear URLs to let user enter custom ones
    setSingleUrl("");
    setIosUrl("");
    setAndroidUrl("");
    setWebUrl("");
  };

  // Handle default links toggle for batch QR
  const handleBatchUseDefaultLinks = () => {
    setBatchUseDefaultLinks(true);
    if (batchLandingPageType === "single") {
      setSingleUrl(defaultUrls.web);
    } else {
      setIosUrl(defaultUrls.ios);
      setAndroidUrl(defaultUrls.android);
      setWebUrl(defaultUrls.web);
    }
  };

  const handleBatchUseCustomLinks = () => {
    setBatchUseDefaultLinks(false);
    // Clear URLs to let user enter custom ones
    setSingleUrl("");
    setIosUrl("");
    setAndroidUrl("");
    setWebUrl("");
  };

  // Effect to set default URLs when landing page type changes
  useEffect(() => {
    if (useDefaultLinks) {
      if (landingPageType === "single") {
        setSingleUrl(defaultUrls.web);
      } else {
        setIosUrl(defaultUrls.ios);
        setAndroidUrl(defaultUrls.android);
        setWebUrl(defaultUrls.web);
      }
    }
  }, [landingPageType, useDefaultLinks]);

  // Effect for batch landing page type changes
  useEffect(() => {
    if (batchUseDefaultLinks) {
      if (batchLandingPageType === "single") {
        setSingleUrl(defaultUrls.web);
      } else {
        setIosUrl(defaultUrls.ios);
        setAndroidUrl(defaultUrls.android);
        setWebUrl(defaultUrls.web);
      }
    }
  }, [batchLandingPageType, batchUseDefaultLinks]);

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
      
      // Fetch QR codes
      const response = await axios.get(`${API}/qr-codes/campaign/${encodeURIComponent(campaignName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaignQRCodes(response.data.qr_codes || []);
      setSelectedCampaign(campaignName);
      
      // Fetch campaign metadata
      try {
        const campaignResponse = await axios.get(`${API}/qr-codes/campaigns/${encodeURIComponent(campaignName)}/details`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedCampaignData(campaignResponse.data);
      } catch (metaError) {
        // If campaign details endpoint doesn't exist, set default data
        setSelectedCampaignData({ published: false });
      }
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
        try {
          if (batchFile.name.endsWith('.xlsx') || batchFile.name.endsWith('.xls')) {
            // Handle Excel files
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Extract vehicle numbers from first column, skip header row
                qrNamesArray = jsonData
                  .slice(1) // Skip header row
                  .map(row => row[0]) // Get first column
                  .filter(name => name && String(name).trim()) // Filter out empty values
                  .map(name => String(name).trim()); // Convert to string and trim
                
                console.log("Parsed vehicle numbers:", qrNamesArray);
                await createBatch(qrNamesArray);
              } catch (parseError) {
                console.error("Error parsing Excel file:", parseError);
                toast.error("Error parsing Excel file. Please check the format.");
              }
            };
            reader.onerror = () => {
              toast.error("Error reading file. Please try again.");
            };
            reader.readAsArrayBuffer(batchFile);
            return;
          } else if (batchFile.name.endsWith('.csv')) {
            // Handle CSV files
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const text = e.target.result;
                const lines = text.split('\n');
                qrNamesArray = lines
                  .slice(1) // Skip header row
                  .filter(line => line.trim()) // Filter out empty lines
                  .map(line => line.split(',')[0].trim()) // Get first column and trim
                  .filter(name => name); // Filter out empty values
                
                console.log("Parsed vehicle numbers:", qrNamesArray);
                await createBatch(qrNamesArray);
              } catch (parseError) {
                console.error("Error parsing CSV file:", parseError);
                toast.error("Error parsing CSV file. Please check the format.");
              }
            };
            reader.onerror = () => {
              toast.error("Error reading file. Please try again.");
            };
            reader.readAsText(batchFile);
            return;
          } else {
            toast.error("Unsupported file format. Please use .xlsx, .xls, or .csv files.");
            return;
          }
        } catch (error) {
          console.error("Error processing file:", error);
          toast.error("Error processing file. Please try again.");
          return;
        }
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
    setUseDefaultLinks(true);
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
    setBatchUseDefaultLinks(true);
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
        await axios.delete(`${API}/qr-codes/campaigns/${encodeURIComponent(campaignName)}`, {
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
        await axios.delete(`${API}/qr-codes/campaigns/${encodeURIComponent(campaign.campaign_name)}`, {
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

  const handleDeleteIndividualQRCode = async (qrCodeId) => {
    if (!window.confirm("Are you sure you want to delete this QR code?")) {
      return;
    }

    try {
      await axios.delete(`${API}/qr-codes/${qrCodeId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      toast.success("QR code deleted successfully");
      
      // Remove from local state
      setCampaignQRCodes(prev => prev.filter(qr => qr.id !== qrCodeId));
      
      // Also remove from selected if it was selected
      setSelectedQRCodes(prev => prev.filter(id => id !== qrCodeId));
      
      // Refresh campaigns list to update counts
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting QR code:", error);
      toast.error("Failed to delete QR code");
    }
  };

  const handlePublishCampaign = async () => {
    if (!selectedCampaign) {
      toast.error("No campaign selected");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/qr-codes/campaigns/${encodeURIComponent(selectedCampaign)}/publish`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Campaign published successfully!");
      
      // Update the selected campaign data
      setSelectedCampaignData(prev => ({ ...prev, published: true }));
      
      // Refresh campaigns to update status
      fetchCampaigns();
    } catch (error) {
      console.error("Error publishing campaign:", error);
      toast.error(error.response?.data?.detail || "Failed to publish campaign");
    }
  };

  const handleUnpublishCampaign = async () => {
    if (!selectedCampaign) {
      toast.error("No campaign selected");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/qr-codes/campaigns/${encodeURIComponent(selectedCampaign)}/unpublish`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Campaign unpublished successfully!");
      
      // Update the selected campaign data
      setSelectedCampaignData(prev => ({ ...prev, published: false }));
      
      // Refresh campaigns to update status
      fetchCampaigns();
      setUnpublishConfirmOpen(false);
    } catch (error) {
      console.error("Error unpublishing campaign:", error);
      toast.error(error.response?.data?.detail || "Failed to unpublish campaign");
      setUnpublishConfirmOpen(false);
    }
  };

  const handleViewAnalytics = async () => {
    if (!selectedCampaign) {
      toast.error("No campaign selected");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/qr-codes/campaigns/${encodeURIComponent(selectedCampaign)}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAnalyticsData(response.data.analytics || []);
      setAnalyticsDialogOpen(true);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
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
      {campaigns.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectAllCampaigns}
              onCheckedChange={handleSelectAllCampaigns}
              id="select-all-campaigns"
            />
            <Label htmlFor="select-all-campaigns" className="text-sm">
              Select All ({campaigns.length})
            </Label>
          </div>
          {selectedCampaigns.length > 0 && (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelectedCampaigns}
                disabled={selectedCampaigns.some(name => {
                  const campaign = campaigns.find(c => c.campaign_name === name);
                  return campaign?.published;
                })}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedCampaigns.length})
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDeleteAllCampaigns}
            className="border-red-500 text-red-600 hover:bg-red-50"
            disabled={campaigns.some(c => c.published)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All
          </Button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((campaign) => (
          <Card 
            key={campaign.campaign_name}
            className={`hover:shadow-lg transition-shadow border-2 ${
              selectedCampaigns.includes(campaign.campaign_name) 
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
                : 'border-transparent hover:border-teal-500'
            }`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Checkbox
                  checked={selectedCampaigns.includes(campaign.campaign_name)}
                  onCheckedChange={() => handleCampaignCheckbox(campaign.campaign_name)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div 
                  className="flex-1 flex items-center gap-2 cursor-pointer"
                  onClick={() => fetchCampaignQRCodes(campaign.campaign_name)}
                >
                  <FolderOpen className="w-5 h-5 text-teal-600" />
                  {campaign.campaign_name}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent onClick={() => fetchCampaignQRCodes(campaign.campaign_name)} className="cursor-pointer">
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
                onClick={() => {
                  setSelectedCampaign(null);
                  setSelectedQRCodes([]);
                  setSelectAllQRCodes(false);
                }}
              >
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Bulk Actions for QR Codes */}
            {campaignQRCodes.length > 0 && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectAllQRCodes}
                    onCheckedChange={handleSelectAllQRCodes}
                    id="select-all-qrcodes"
                  />
                  <Label htmlFor="select-all-qrcodes" className="text-sm">
                    Select All ({campaignQRCodes.length})
                  </Label>
                </div>
                {selectedQRCodes.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadSelectedQRCodes}
                      className="border-teal-500 text-teal-600 hover:bg-teal-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Selected ({selectedQRCodes.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteSelectedQRCodes}
                      disabled={selectedCampaignData?.published}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected ({selectedQRCodes.length})
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadAllQRCodes}
                  className="border-teal-500 text-teal-600 hover:bg-teal-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeleteAllQRCodes}
                  className="border-red-500 text-red-600 hover:bg-red-50"
                  disabled={selectedCampaignData?.published}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </Button>
              </div>
            )}
              
            {/* Campaign Action Buttons */}
            <div className="flex items-center gap-3 mb-4 flex-wrap border-t pt-4">
              {selectedCampaignData?.published ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUnpublishConfirmOpen(true)}
                  className="border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                  UNPUBLISH
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePublishCampaign}
                  className="border-green-500 text-green-600 hover:bg-green-50"
                  disabled={campaignQRCodes.length === 0}
                >
                  PUBLISH
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleViewAnalytics}
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                VIEW ANALYTICS
              </Button>
              {selectedCampaignData?.published && (
                <div className="flex items-center text-sm text-green-600 font-medium">
                  ✅ Published
                </div>
              )}
            </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaignQRCodes.map((qrCode) => (
                <Card 
                  key={qrCode.id} 
                  className={`border-2 ${
                    selectedQRCodes.includes(qrCode.id)
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : ''
                  }`}
                >
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Checkbox
                          checked={selectedQRCodes.includes(qrCode.id)}
                          onCheckedChange={() => handleQRCodeCheckbox(qrCode.id)}
                        />
                      </div>
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
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleDeleteIndividualQRCode(qrCode.id)} 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={selectedCampaignData?.published}
                        >
                          <Trash2 className="w-4 h-4" />
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
            
            <div>
              <Label>URL Configuration</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={useDefaultLinks ? "default" : "outline"}
                  size="sm"
                  onClick={handleUseDefaultLinks}
                >
                  Use Default Links
                </Button>
                <Button
                  type="button"
                  variant={!useDefaultLinks ? "default" : "outline"}
                  size="sm"
                  onClick={handleUseCustomLinks}
                >
                  Use Custom Links
                </Button>
              </div>
            </div>
            
            {landingPageType === "single" ? (
              <div>
                <Label>Landing Page URL *</Label>
                <Input
                  placeholder={useDefaultLinks ? defaultUrls.web : "https://example.com"}
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  disabled={useDefaultLinks}
                />
                {useDefaultLinks ? (
                  <p className="text-xs text-teal-600 mt-1">Using default: {defaultUrls.web}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Enter your custom landing page URL</p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <Label>iOS App Store URL *</Label>
                  <Input
                    placeholder={useDefaultLinks ? defaultUrls.ios : "https://apps.apple.com/..."}
                    value={iosUrl}
                    onChange={(e) => setIosUrl(e.target.value)}
                    disabled={useDefaultLinks}
                  />
                  {useDefaultLinks && (
                    <p className="text-xs text-teal-600 mt-1">Using default: {defaultUrls.ios}</p>
                  )}
                </div>
                <div>
                  <Label>Android Play Store URL *</Label>
                  <Input
                    placeholder={useDefaultLinks ? defaultUrls.android : "https://play.google.com/store/apps/..."}
                    value={androidUrl}
                    onChange={(e) => setAndroidUrl(e.target.value)}
                    disabled={useDefaultLinks}
                  />
                  {useDefaultLinks && (
                    <p className="text-xs text-teal-600 mt-1">Using default: {defaultUrls.android}</p>
                  )}
                </div>
                <div>
                  <Label>Web App URL *</Label>
                  <Input
                    placeholder={useDefaultLinks ? defaultUrls.web : "https://webapp.example.com"}
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    disabled={useDefaultLinks}
                  />
                  {useDefaultLinks && (
                    <p className="text-xs text-teal-600 mt-1">Using default: {defaultUrls.web}</p>
                  )}
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
              <Label>Or Upload File (.xlsx/.xls/.csv)</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setBatchFile(e.target.files[0])}
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload an Excel or CSV file with vehicle numbers in the first column. First row will be treated as header and skipped.
              </p>
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
            
            <div>
              <Label>URL Configuration</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={batchUseDefaultLinks ? "default" : "outline"}
                  size="sm"
                  onClick={handleBatchUseDefaultLinks}
                >
                  Use Default Links
                </Button>
                <Button
                  type="button"
                  variant={!batchUseDefaultLinks ? "default" : "outline"}
                  size="sm"
                  onClick={handleBatchUseCustomLinks}
                >
                  Use Custom Links
                </Button>
              </div>
            </div>
            
            {batchLandingPageType === "single" ? (
              <div>
                <Label>Landing Page URL *</Label>
                <Input
                  placeholder={batchUseDefaultLinks ? defaultUrls.web : "https://example.com"}
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  disabled={batchUseDefaultLinks}
                />
                {batchUseDefaultLinks ? (
                  <p className="text-xs text-teal-600 mt-1">Using default: {defaultUrls.web}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Enter your custom landing page URL</p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <Label>iOS App Store URL *</Label>
                  <Input
                    placeholder={batchUseDefaultLinks ? defaultUrls.ios : "https://apps.apple.com/..."}
                    value={iosUrl}
                    onChange={(e) => setIosUrl(e.target.value)}
                    disabled={batchUseDefaultLinks}
                  />
                  {batchUseDefaultLinks && (
                    <p className="text-xs text-teal-600 mt-1">Using default: {defaultUrls.ios}</p>
                  )}
                </div>
                <div>
                  <Label>Android Play Store URL *</Label>
                  <Input
                    placeholder={batchUseDefaultLinks ? defaultUrls.android : "https://play.google.com/store/apps/..."}
                    value={androidUrl}
                    onChange={(e) => setAndroidUrl(e.target.value)}
                    disabled={batchUseDefaultLinks}
                  />
                  {batchUseDefaultLinks && (
                    <p className="text-xs text-teal-600 mt-1">Using default: {defaultUrls.android}</p>
                  )}
                </div>
                <div>
                  <Label>Web App URL *</Label>
                  <Input
                    placeholder={batchUseDefaultLinks ? defaultUrls.web : "https://webapp.example.com"}
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    disabled={batchUseDefaultLinks}
                  />
                  {batchUseDefaultLinks && (
                    <p className="text-xs text-teal-600 mt-1">Using default: {defaultUrls.web}</p>
                  )}
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

      {/* Analytics Dialog */}
      <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Analytics - {selectedCampaign}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {analyticsData.length > 0 ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{analyticsData.reduce((sum, item) => sum + item.total_scans, 0)}</div>
                      <p className="text-xs text-muted-foreground">Total Scans</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{analyticsData.reduce((sum, item) => sum + item.ios_scans, 0)}</div>
                      <p className="text-xs text-muted-foreground">iOS Scans</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{analyticsData.reduce((sum, item) => sum + item.android_scans, 0)}</div>
                      <p className="text-xs text-muted-foreground">Android Scans</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{analyticsData.reduce((sum, item) => sum + item.web_scans, 0)}</div>
                      <p className="text-xs text-muted-foreground">Web Scans</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Scan Records */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Detailed Scan Records</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>QR Code</TableHead>
                          <TableHead>Device & Browser</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>IP Address</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyticsData.flatMap(qrData => 
                          qrData.scan_details.map((scan, index) => (
                            <TableRow key={`${qrData.qr_code_id}-${index}`}>
                              <TableCell>
                                {scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : 'Unknown'}
                              </TableCell>
                              <TableCell className="font-medium">
                                {qrData.qr_name}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">
                                    {scan.platform === 'ios' && '📱 iOS'} 
                                    {scan.platform === 'android' && '🤖 Android'}
                                    {scan.platform === 'desktop' && '💻 Desktop'}
                                    {scan.platform === 'mobile_other' && '📱 Mobile'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {scan.os_family} • {scan.browser}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {scan.device}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-sm">Location data not available</div>
                                  <div className="text-xs text-gray-500">GPS coordinates not captured</div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {scan.ip_address || 'Unknown'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No analytics data available</p>
                <p className="text-xs text-gray-400 mt-2">QR codes haven't been scanned yet</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalyticsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unpublish Confirmation Dialog */}
      <Dialog open={unpublishConfirmOpen} onOpenChange={setUnpublishConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpublish Campaign</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-gray-700">
              Are you sure you want to unpublish the campaign "{selectedCampaign}"?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This will allow the campaign and its QR codes to be deleted again, but will not affect any existing scans or analytics data.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnpublishConfirmOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleUnpublishCampaign}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Unpublish Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QRCodeManagerNew;
