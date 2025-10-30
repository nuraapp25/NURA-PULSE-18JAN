import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Edit, Trash2, RefreshCw, UserPlus, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";

const TelecallersManagement = () => {
  const navigate = useNavigate();
  
  // Telecaller profiles state
  const [telecallers, setTelecallers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // All leads for assignment
  const [allLeads, setAllLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [selectedTelecaller, setSelectedTelecaller] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    email: "",
    notes: "",
    status: "active"
  });

  useEffect(() => {
    fetchTelecallers();
    fetchAllLeads();
  }, []);

  useEffect(() => {
    // Filter leads based on search
    if (searchTerm) {
      const filtered = allLeads.filter(lead =>
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone_number?.includes(searchTerm)
      );
      setFilteredLeads(filtered);
    } else {
      setFilteredLeads(allLeads);
    }
  }, [searchTerm, allLeads]);

  const fetchTelecallers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/telecallers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTelecallers(response.data);
    } catch (error) {
      toast.error("Failed to fetch telecallers");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLeads = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/driver-onboarding/leads?skip_pagination=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Handle both response formats
      const leadsData = response.data.leads || response.data || [];
      setAllLeads(leadsData);
      setFilteredLeads(leadsData);
    } catch (error) {
      toast.error("Failed to fetch leads");
    }
  };

  const handleCreateTelecaller = async () => {
    if (!formData.name || !formData.phone_number || !formData.email) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/telecallers`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Success - refresh telecallers list
      await fetchTelecallers();
      
      toast.success("Telecaller profile created successfully!");
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Create telecaller error:", error);
      // Only show error if the telecaller was NOT created
      if (error.response?.status !== 200) {
        toast.error(error.response?.data?.detail || "Failed to create telecaller profile");
      }
    }
  };

  const handleUpdateTelecaller = async () => {
    if (!selectedTelecaller) return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.patch(
        `${API}/telecallers/${selectedTelecaller.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Success - refresh telecallers list
      await fetchTelecallers();
      
      toast.success("Telecaller profile updated successfully!");
      setIsEditDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Update telecaller error:", error);
      toast.error(error.response?.data?.detail || "Failed to update telecaller");
    }
  };

  const handleDeleteTelecaller = async (telecallerId) => {
    if (!confirm("Are you sure you want to delete this telecaller?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/telecallers/${telecallerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Telecaller deleted successfully!");
      fetchTelecallers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete telecaller");
    }
  };

  const handleAssignLeads = async () => {
    if (selectedLeads.length === 0) {
      toast.error("Please select at least one lead");
      return;
    }

    if (!selectedTelecaller) {
      toast.error("Please select a telecaller");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/telecallers/assign-leads`,
        {
          lead_ids: selectedLeads,
          telecaller_id: selectedTelecaller.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Assigned ${selectedLeads.length} leads to ${selectedTelecaller.name}!`);
      setIsAssignDialogOpen(false);
      setSelectedLeads([]);
      fetchTelecallers();
      fetchAllLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to assign leads");
    }
  };

  const handleReassignLeads = async () => {
    if (selectedLeads.length === 0) {
      toast.error("Please select at least one lead");
      return;
    }

    if (!selectedTelecaller) {
      toast.error("Please select a telecaller");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/telecallers/reassign-leads`,
        {
          lead_ids: selectedLeads,
          to_telecaller_id: selectedTelecaller.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Reassigned ${selectedLeads.length} leads to ${selectedTelecaller.name}!`);
      setIsReassignDialogOpen(false);
      setSelectedLeads([]);
      fetchTelecallers();
      fetchAllLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reassign leads");
    }
  };

  const handleDeassignLeads = async () => {
    if (selectedLeads.length === 0) {
      toast.error("Please select at least one lead");
      return;
    }

    if (!confirm(`Are you sure you want to deassign ${selectedLeads.length} lead(s)? This will remove telecaller assignments.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/telecallers/deassign-leads`,
        {
          lead_ids: selectedLeads
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Deassigned ${selectedLeads.length} leads successfully!`);
      setSelectedLeads([]);
      fetchTelecallers();
      fetchAllLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to deassign leads");
    }
  };

  const handleUnassignAllLeads = async (telecaller) => {
    if (telecaller.total_assigned_leads === 0) {
      toast.error("This telecaller has no assigned leads");
      return;
    }

    if (!confirm(`Are you sure you want to unassign all ${telecaller.total_assigned_leads} leads from ${telecaller.name}? This will remove all lead assignments.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      // First, get all leads assigned to this telecaller
      const leadsResponse = await axios.get(`${API}/driver-onboarding/leads?telecaller=${telecaller.id}&skip_pagination=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle both response formats
      const leadsData = leadsResponse.data.leads || leadsResponse.data || [];
      const assignedLeadIds = leadsData.map(lead => lead.id);
      
      // Then deassign them all
      await axios.post(
        `${API}/telecallers/deassign-leads`,
        {
          lead_ids: assignedLeadIds
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Unassigned all ${assignedLeadIds.length} leads from ${telecaller.name}!`);
      fetchTelecallers();
      fetchAllLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to unassign leads");
    }
  };

  const handleSyncFromSheets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/telecallers/sync-from-sheets`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message);
      fetchTelecallers();
      fetchAllLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to sync from sheets");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (telecaller) => {
    setSelectedTelecaller(telecaller);
    setFormData({
      name: telecaller.name,
      phone_number: telecaller.phone_number,
      email: telecaller.email,
      notes: telecaller.notes || "",
      status: telecaller.status || "active"
    });
    setIsEditDialogOpen(true);
  };

  const openAssignDialog = (telecaller) => {
    setSelectedTelecaller(telecaller);
    setIsAssignDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone_number: "",
      email: "",
      notes: "",
      status: "active"
    });
    setSelectedTelecaller(null);
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeads(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(lead => lead.id));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Telecallers Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage telecaller profiles and assign leads
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchTelecallers} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Telecaller
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{telecallers.length}</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Telecallers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {telecallers.filter(t => t.status === "active").length}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {telecallers.reduce((sum, t) => sum + t.total_assigned_leads, 0)}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Assigned Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {telecallers.reduce((sum, t) => sum + t.converted_leads, 0)}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Converted Leads</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="profiles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profiles">Telecaller Profiles</TabsTrigger>
          <TabsTrigger value="assign">Assign Leads</TabsTrigger>
        </TabsList>

        {/* Profiles Tab */}
        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle>Telecaller Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : telecallers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No telecallers found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned Leads</TableHead>
                        <TableHead>Converted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {telecallers.map((telecaller) => (
                        <TableRow key={telecaller.id}>
                          <TableCell className="font-medium">{telecaller.name}</TableCell>
                          <TableCell>{telecaller.phone_number}</TableCell>
                          <TableCell>{telecaller.email}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              telecaller.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {telecaller.status}
                            </span>
                          </TableCell>
                          <TableCell>{telecaller.total_assigned_leads}</TableCell>
                          <TableCell>{telecaller.converted_leads}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => openAssignDialog(telecaller)}
                                variant="outline"
                                size="sm"
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleUnassignAllLeads(telecaller)}
                                variant="outline"
                                size="sm"
                                className="text-orange-600 border-orange-500 hover:bg-orange-50"
                                disabled={telecaller.total_assigned_leads === 0}
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => openEditDialog(telecaller)}
                                variant="outline"
                                size="sm"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteTelecaller(telecaller.id)}
                                variant="outline"
                                size="sm"
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assign Leads Tab */}
        <TabsContent value="assign">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assign Leads to Telecallers</CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                  {selectedLeads.length > 0 && (
                    <>
                      <Button onClick={() => {
                        const telecaller = telecallers[0];
                        if (telecaller) {
                          setSelectedTelecaller(telecaller);
                          setIsAssignDialogOpen(true);
                        }
                      }}>
                        Assign Selected ({selectedLeads.length})
                      </Button>
                      <Button 
                        onClick={() => {
                          const telecaller = telecallers[0];
                          if (telecaller) {
                            setSelectedTelecaller(telecaller);
                            setIsReassignDialogOpen(true);
                          }
                        }}
                        variant="outline"
                      >
                        Reassign ({selectedLeads.length})
                      </Button>
                      <Button 
                        onClick={handleDeassignLeads}
                        variant="destructive"
                      >
                        Deassign ({selectedLeads.length})
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button onClick={toggleSelectAll} variant="outline" size="sm">
                  {selectedLeads.length === filteredLeads.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.slice(0, 50).map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                          />
                        </TableCell>
                        <TableCell>{lead.name}</TableCell>
                        <TableCell>{lead.phone_number}</TableCell>
                        <TableCell>{lead.status}</TableCell>
                        <TableCell>{lead.assigned_telecaller || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Telecaller Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>
            <div>
              <Label>Phone Number *</Label>
              <Input
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email"
                type="email"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Enter notes (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTelecaller}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Telecaller Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                type="email"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Enter notes (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTelecaller}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Leads to Telecaller</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Telecaller</Label>
              <Select
                value={selectedTelecaller?.id}
                onValueChange={(value) => {
                  const telecaller = telecallers.find(t => t.id === value);
                  setSelectedTelecaller(telecaller);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose telecaller" />
                </SelectTrigger>
                <SelectContent>
                  {telecallers.filter(t => t.status === "active").map((telecaller) => (
                    <SelectItem key={telecaller.id} value={telecaller.id}>
                      {telecaller.name} ({telecaller.total_assigned_leads} leads)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600">
              {selectedLeads.length} lead(s) selected
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignLeads}>Assign Leads</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Leads to Another Telecaller</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select New Telecaller</Label>
              <Select
                value={selectedTelecaller?.id}
                onValueChange={(value) => {
                  const telecaller = telecallers.find(t => t.id === value);
                  setSelectedTelecaller(telecaller);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose telecaller" />
                </SelectTrigger>
                <SelectContent>
                  {telecallers.filter(t => t.status === "active").map((telecaller) => (
                    <SelectItem key={telecaller.id} value={telecaller.id}>
                      {telecaller.name} ({telecaller.total_assigned_leads} leads)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600">
              {selectedLeads.length} lead(s) selected for reassignment
            </div>
            <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded">
              ⚠️ This will move leads from their current telecaller to the selected telecaller
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReassignLeads}>Reassign Leads</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TelecallersManagement;
