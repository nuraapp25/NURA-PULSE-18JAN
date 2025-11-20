import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Download, Upload, Trash2, Edit, Calendar } from "lucide-react";
import { format, addDays, startOfWeek, subDays, parseISO } from "date-fns";

const SupplyPlan = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedViewDate, setSelectedViewDate] = useState(new Date()); // The date currently being viewed
  const [weekDates, setWeekDates] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);

  // Form state
  const [assignmentForm, setAssignmentForm] = useState({
    driver_name: "",
    shift_start_time: "",
    shift_end_time: "",
    notes: ""
  });

  // Generate time slots (6 AM to 6 AM next day, 30-min intervals)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 30; hour++) {
      for (let min of [0, 30]) {
        if (hour === 29 && min === 30) break; // Stop at 6:00 AM next day
        const displayHour = hour >= 24 ? hour - 24 : hour;
        const period = displayHour < 12 ? "AM" : "PM";
        const displayHour12 = displayHour === 0 ? 12 : displayHour > 12 ? displayHour - 12 : displayHour;
        const timeString = `${displayHour12.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${period}`;
        const value24 = `${displayHour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        slots.push({ label: timeString, value: value24 });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Calculate week dates (7 days with today at center)
  useEffect(() => {
    const calculateWeekDates = () => {
      const dates = [];
      const startDate = subDays(currentDate, 3); // 3 days before
      for (let i = 0; i < 7; i++) {
        dates.push(addDays(startDate, i));
      }
      setWeekDates(dates);
    };
    calculateWeekDates();
  }, [currentDate]);

  // Fetch data
  useEffect(() => {
    fetchDrivers();
    fetchVehicles();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [selectedViewDate]);

  const fetchDrivers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/supply-plan/drivers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast.error("Failed to fetch drivers list");
    }
  };

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/supply-plan/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data.vehicles || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast.error("Failed to fetch vehicles list");
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const dateStr = format(selectedViewDate, 'yyyy-MM-dd');
      
      const response = await axios.get(`${API}/supply-plan/assignments`, {
        params: { start_date: dateStr, end_date: dateStr },
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssignments(response.data.assignments || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("Failed to fetch assignments");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    setCurrentDate(prev => subDays(prev, 7));
    setSelectedViewDate(prev => subDays(prev, 7));
  };

  const handleNextWeek = () => {
    setCurrentDate(prev => addDays(prev, 7));
    setSelectedViewDate(prev => addDays(prev, 7));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedViewDate(today);
  };

  const handleDateClick = (date) => {
    setSelectedViewDate(date);
  };

  const openAssignDialog = (vehicle, date = null) => {
    setSelectedVehicle(vehicle);
    setSelectedDate(date || selectedViewDate);
    setEditingAssignment(null);
    setAssignmentForm({
      driver_name: "",
      shift_start_time: "",
      shift_end_time: "",
      notes: ""
    });
    setAssignDialogOpen(true);
  };

  const openEditDialog = (assignment) => {
    setEditingAssignment(assignment);
    setSelectedVehicle(assignment.vehicle_reg_no);
    setSelectedDate(parseISO(assignment.shift_date));
    setAssignmentForm({
      driver_name: assignment.driver_name,
      shift_start_time: assignment.shift_start_time,
      shift_end_time: assignment.shift_end_time,
      notes: assignment.notes || ""
    });
    setAssignDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!assignmentForm.driver_name || !assignmentForm.shift_start_time || !assignmentForm.shift_end_time) {
      toast.error("Please fill all required fields");
      return;
    }

    // Check for conflicts
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const conflicts = assignments.filter(a => 
      a.driver_name === assignmentForm.driver_name &&
      a.shift_date === dateStr &&
      (!editingAssignment || a.id !== editingAssignment.id) &&
      (
        (assignmentForm.shift_start_time >= a.shift_start_time && assignmentForm.shift_start_time < a.shift_end_time) ||
        (assignmentForm.shift_end_time > a.shift_start_time && assignmentForm.shift_end_time <= a.shift_end_time) ||
        (assignmentForm.shift_start_time <= a.shift_start_time && assignmentForm.shift_end_time >= a.shift_end_time)
      )
    );

    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      if (!window.confirm(`Conflict detected! ${assignmentForm.driver_name} is already assigned to ${conflict.vehicle_reg_no} from ${conflict.shift_start_time} to ${conflict.shift_end_time}. Continue anyway?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const data = {
        vehicle_reg_no: selectedVehicle,
        driver_name: assignmentForm.driver_name,
        shift_date: dateStr,
        shift_start_time: assignmentForm.shift_start_time,
        shift_end_time: assignmentForm.shift_end_time,
        notes: assignmentForm.notes
      };

      if (editingAssignment) {
        await axios.put(
          `${API}/supply-plan/assignments/${editingAssignment.id}`,
          data,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Assignment updated successfully");
      } else {
        await axios.post(
          `${API}/supply-plan/assignments`,
          data,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Assignment created successfully");
      }

      setAssignDialogOpen(false);
      fetchAssignments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save assignment");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to delete this assignment?")) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/supply-plan/assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Assignment deleted successfully");
      fetchAssignments();
    } catch (error) {
      toast.error("Failed to delete assignment");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (weekDates.length === 0) return;

    try {
      const token = localStorage.getItem("token");
      const startDate = format(weekDates[0], 'yyyy-MM-dd');
      const endDate = format(weekDates[6], 'yyyy-MM-dd');

      const response = await axios.get(`${API}/supply-plan/export`, {
        params: { start_date: startDate, end_date: endDate },
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `shift_assignments_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Assignments exported successfully");
    } catch (error) {
      toast.error("Failed to export assignments");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/supply-plan/import`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(response.data.message);
      if (response.data.errors && response.data.errors.length > 0) {
        console.error("Import errors:", response.data.errors);
      }
      fetchAssignments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import assignments");
    } finally {
      setLoading(false);
    }
    e.target.value = null;
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/supply-plan/sample-template`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'shift_assignments_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Template downloaded successfully");
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  // Get assignments for a specific vehicle and date
  const getAssignmentsForVehicleAndDate = (vehicle, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.filter(a => a.vehicle_reg_no === vehicle && a.shift_date === dateStr);
  };

  // Calculate time position (percentage from 6 AM)
  const calculateTimePosition = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = (hours >= 6 ? hours - 6 : hours + 18) * 60 + minutes;
    return (totalMinutes / (24 * 60)) * 100;
  };

  // Calculate driver utilization
  const calculateDriverUtilization = (driverName) => {
    const driverAssignments = assignments.filter(a => a.driver_name === driverName);
    let totalHours = 0;
    
    driverAssignments.forEach(a => {
      const [startH, startM] = a.shift_start_time.split(':').map(Number);
      const [endH, endM] = a.shift_end_time.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const duration = (endMinutes - startMinutes) / 60;
      totalHours += duration;
    });

    return totalHours.toFixed(1);
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Supply Plan</h1>
          <p className="text-gray-600">Manage driver-vehicle shift assignments</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Template
          </Button>
          <label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </span>
            </Button>
          </label>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button onClick={handlePreviousWeek} variant="outline" size="sm">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-2">
              {weekDates.map((date, index) => {
                const isSelected = format(date, 'yyyy-MM-dd') === format(selectedViewDate, 'yyyy-MM-dd');
                const isTodayDate = isToday(date);
                
                return (
                  <Button
                    key={index}
                    onClick={() => handleDateClick(date)}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={`flex flex-col py-2 px-3 ${isSelected ? 'bg-blue-600' : ''} ${isTodayDate && !isSelected ? 'border-blue-400 border-2' : ''}`}
                  >
                    <span className="text-xs">{format(date, 'EEE')}</span>
                    <span className="font-bold">{format(date, 'dd MMM')}</span>
                  </Button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleToday} variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                Today
              </Button>
              <Button onClick={handleNextWeek} variant="outline" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid View */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 p-3 text-left border-r min-w-[150px]">
                    Vehicle
                  </th>
                  {weekDates.map((date, idx) => (
                    <th key={idx} className="p-3 text-center border-r min-w-[800px]">
                      <div className="font-semibold">{format(date, 'EEE, dd MMM')}</div>
                      <div className="text-xs text-gray-500 mt-1">6 AM → 6 AM (Next Day)</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle, vIdx) => (
                  <tr key={vIdx} className="border-b hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white p-3 border-r font-medium">
                      {vehicle}
                    </td>
                    {weekDates.map((date, dIdx) => {
                      const vehicleAssignments = getAssignmentsForVehicleAndDate(vehicle, date);
                      return (
                        <td key={dIdx} className="p-2 border-r relative">
                          <div className="relative h-20 bg-gray-100 rounded">
                            {/* Time blocks */}
                            {vehicleAssignments.map((assignment, aIdx) => {
                              const leftPos = calculateTimePosition(assignment.shift_start_time);
                              const width = calculateTimePosition(assignment.shift_end_time) - leftPos;
                              
                              return (
                                <div
                                  key={aIdx}
                                  className="absolute top-1 bottom-1 rounded px-2 py-1 text-xs font-medium text-white cursor-pointer hover:opacity-90 flex items-center justify-between group"
                                  style={{
                                    left: `${leftPos}%`,
                                    width: `${width}%`,
                                    backgroundColor: assignment.driver_color
                                  }}
                                  onClick={() => openEditDialog(assignment)}
                                >
                                  <div className="flex-1 overflow-hidden">
                                    <div className="truncate">{assignment.driver_name}</div>
                                    <div className="text-[10px] opacity-90">
                                      {assignment.shift_start_time} - {assignment.shift_end_time}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAssignment(assignment.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 ml-1 hover:bg-white/20 rounded p-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                            
                            {/* Add button */}
                            <button
                              onClick={() => openAssignDialog(vehicle, date)}
                              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 bg-blue-500 text-white rounded-full p-1"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Utilization Stats */}
      {assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Driver Utilization (This Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...new Set(assignments.map(a => a.driver_name))].map((driver, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded">
                  <div className="font-medium text-sm">{driver}</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {calculateDriverUtilization(driver)}h
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit' : 'Assign'} Driver to Vehicle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Vehicle</Label>
              <Input value={selectedVehicle} disabled />
            </div>
            <div>
              <Label>Date</Label>
              <Input 
                value={selectedDate ? format(selectedDate, 'dd MMM yyyy') : ''} 
                disabled 
              />
            </div>
            <div>
              <Label>Driver *</Label>
              <Select
                value={assignmentForm.driver_name}
                onValueChange={(value) => setAssignmentForm({ ...assignmentForm, driver_name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver, idx) => (
                    <SelectItem key={idx} value={driver}>
                      {driver}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Time *</Label>
              <Select
                value={assignmentForm.shift_start_time}
                onValueChange={(value) => setAssignmentForm({ ...assignmentForm, shift_start_time: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeSlots.map((slot, idx) => (
                    <SelectItem key={idx} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>End Time *</Label>
              <Select
                value={assignmentForm.shift_end_time}
                onValueChange={(value) => setAssignmentForm({ ...assignmentForm, shift_end_time: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeSlots.map((slot, idx) => (
                    <SelectItem key={idx} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={assignmentForm.notes}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveAssignment} disabled={loading} className="w-full">
              {loading ? "Saving..." : editingAssignment ? "Update Assignment" : "Assign Driver"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplyPlan;
