import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, Users, Plus, Download, Upload, RefreshCw, Trash2, Edit } from "lucide-react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

const ManageDatabase = () => {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingDriver, setEditingDriver] = useState(null);

  // Vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    vehicle_type: "",
    register_number: "",
    vin_number: "",
    model: ""
  });

  // Driver form state
  const [driverForm, setDriverForm] = useState({
    name: "",
    phone_number: "",
    dl_number: "",
    status: "Active"
  });

  useEffect(() => {
    fetchVehicles();
    fetchDrivers();
  }, []);

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/manage-db/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data.vehicles || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/manage-db/drivers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  // Vehicle Functions
  const handleAddVehicle = async () => {
    if (!vehicleForm.vehicle_type || !vehicleForm.register_number || !vehicleForm.vin_number) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (editingVehicle) {
        await axios.put(
          `${API}/manage-db/vehicles/${editingVehicle.id}`,
          vehicleForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Vehicle updated successfully");
      } else {
        await axios.post(
          `${API}/manage-db/vehicles`,
          vehicleForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Vehicle added successfully");
      }
      setVehicleDialogOpen(false);
      setVehicleForm({ vehicle_type: "", register_number: "", vin_number: "", model: "" });
      setEditingVehicle(null);
      fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save vehicle");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm("Are you sure you want to delete this vehicle?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/manage-db/vehicles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Vehicle deleted successfully");
      fetchVehicles();
    } catch (error) {
      toast.error("Failed to delete vehicle");
    }
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      vehicle_type: vehicle.vehicle_type,
      register_number: vehicle.register_number,
      vin_number: vehicle.vin_number,
      model: vehicle.model || ""
    });
    setVehicleDialogOpen(true);
  };

  const handleVehicleBulkExport = () => {
    if (vehicles.length === 0) {
      toast.error("No vehicles to export");
      return;
    }

    const exportData = vehicles.map((v, index) => ({
      "S.No.": index + 1,
      "Vehicle Type": v.vehicle_type,
      "Register No.": v.register_number,
      "VIN No.": v.vin_number,
      "Model": v.model || ""
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
    XLSX.writeFile(wb, "vehicles_export.xlsx");
    toast.success("Vehicles exported successfully");
  };

  const handleVehicleBulkImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const vehiclesToImport = jsonData.map(row => ({
          vehicle_type: row["Vehicle Type"] || row["vehicle_type"],
          register_number: row["Register No."] || row["register_number"],
          vin_number: row["VIN No."] || row["vin_number"],
          model: row["Model"] || row["model"] || ""
        }));

        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${API}/manage-db/vehicles/bulk-import`,
          { vehicles: vehiclesToImport },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.success(`${response.data.imported_count} vehicles imported successfully`);
        fetchVehicles();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Failed to import vehicles");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  // Driver Functions
  const handleAddDriver = async () => {
    if (!driverForm.name || !driverForm.phone_number) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (editingDriver) {
        await axios.put(
          `${API}/manage-db/drivers/${editingDriver.id}`,
          driverForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Driver updated successfully");
      } else {
        await axios.post(
          `${API}/manage-db/drivers`,
          driverForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Driver added successfully");
      }
      setDriverDialogOpen(false);
      setDriverForm({ name: "", phone_number: "", dl_number: "", status: "Active" });
      setEditingDriver(null);
      fetchDrivers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save driver");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDriver = async (id) => {
    if (!window.confirm("Are you sure you want to delete this driver?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/manage-db/drivers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Driver deleted successfully");
      fetchDrivers();
    } catch (error) {
      toast.error("Failed to delete driver");
    }
  };

  const handleEditDriver = (driver) => {
    setEditingDriver(driver);
    setDriverForm({
      name: driver.name,
      phone_number: driver.phone_number,
      dl_number: driver.dl_number || "",
      status: driver.status || "Active"
    });
    setDriverDialogOpen(true);
  };

  const handleDriverBulkExport = () => {
    if (drivers.length === 0) {
      toast.error("No drivers to export");
      return;
    }

    const exportData = drivers.map((d, index) => ({
      "S.No.": index + 1,
      "Name": d.name,
      "Phone Number": d.phone_number,
      "DL Number": d.dl_number || "",
      "Status": d.status || "Active"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Drivers");
    XLSX.writeFile(wb, "drivers_export.xlsx");
    toast.success("Drivers exported successfully");
  };

  const handleDriverBulkImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const driversToImport = jsonData.map(row => ({
          name: row["Name"] || row["name"],
          phone_number: String(row["Phone Number"] || row["phone_number"] || ""),
          dl_number: row["DL Number"] || row["dl_number"] || "",
          status: row["Status"] || row["status"] || "Active"
        }));

        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${API}/manage-db/drivers/bulk-import`,
          { drivers: driversToImport },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.success(`${response.data.imported_count} drivers imported successfully`);
        fetchDrivers();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Failed to import drivers");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  const handleSyncFromOnboarding = async () => {
    if (!window.confirm("This will sync all DONE! and Terminated leads from Driver Onboarding. Continue?")) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/manage-db/drivers/sync-from-onboarding`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Synced ${response.data.synced_count} drivers from onboarding`);
      fetchDrivers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to sync drivers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Database</h1>
      </div>

      {/* Vehicles Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Vehicles List ({vehicles.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={handleVehicleBulkExport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleVehicleBulkImport}
                  className="hidden"
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </span>
                </Button>
              </label>
              <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => {
                    setEditingVehicle(null);
                    setVehicleForm({ vehicle_type: "", register_number: "", vin_number: "", model: "" });
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vehicle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Vehicle Type *</Label>
                      <Select
                        value={vehicleForm.vehicle_type}
                        onValueChange={(value) => setVehicleForm({ ...vehicleForm, vehicle_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Electric Car">Electric Car</SelectItem>
                          <SelectItem value="Electric Auto">Electric Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Register Number *</Label>
                      <Input
                        placeholder="TN 07 CE 2389"
                        value={vehicleForm.register_number}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, register_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>VIN Number *</Label>
                      <Input
                        placeholder="P60G2512500002033"
                        value={vehicleForm.vin_number}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, vin_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input
                        placeholder="Model name"
                        value={vehicleForm.model}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddVehicle} disabled={loading} className="w-full">
                      {loading ? "Saving..." : editingVehicle ? "Update Vehicle" : "Add Vehicle"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No.</TableHead>
                <TableHead>Vehicle Type</TableHead>
                <TableHead>Register No.</TableHead>
                <TableHead>VIN No.</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle, index) => (
                <TableRow key={vehicle.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{vehicle.vehicle_type}</TableCell>
                  <TableCell>{vehicle.register_number}</TableCell>
                  <TableCell>{vehicle.vin_number}</TableCell>
                  <TableCell>{vehicle.model || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditVehicle(vehicle)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No vehicles added yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drivers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Drivers List ({drivers.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={handleSyncFromOnboarding} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync from Onboarding
              </Button>
              <Button onClick={handleDriverBulkExport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleDriverBulkImport}
                  className="hidden"
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </span>
                </Button>
              </label>
              <Dialog open={driverDialogOpen} onOpenChange={setDriverDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => {
                    setEditingDriver(null);
                    setDriverForm({ name: "", phone_number: "", dl_number: "", status: "Active" });
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Driver
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingDriver ? "Edit Driver" : "Add New Driver"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        placeholder="Driver name"
                        value={driverForm.name}
                        onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Phone Number *</Label>
                      <Input
                        placeholder="9876543210"
                        value={driverForm.phone_number}
                        onChange={(e) => setDriverForm({ ...driverForm, phone_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>DL Number</Label>
                      <Input
                        placeholder="DL number"
                        value={driverForm.dl_number}
                        onChange={(e) => setDriverForm({ ...driverForm, dl_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={driverForm.status}
                        onValueChange={(value) => setDriverForm({ ...driverForm, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddDriver} disabled={loading} className="w-full">
                      {loading ? "Saving..." : editingDriver ? "Update Driver" : "Add Driver"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>DL Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver, index) => (
                <TableRow key={driver.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{driver.name}</TableCell>
                  <TableCell>{driver.phone_number}</TableCell>
                  <TableCell>{driver.dl_number || "-"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      driver.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {driver.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditDriver(driver)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDriver(driver.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {drivers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No drivers added yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageDatabase;
