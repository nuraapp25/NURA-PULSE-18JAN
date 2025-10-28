import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, RefreshCw, Download, ArrowUpDown, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";

const BatteryAudit = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  
  // Sorting state
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  
  // Filter state
  const [filterText, setFilterText] = useState("");
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/montra-vehicle/battery-audit`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setAuditData(response.data.audit_results || []);
        setFilteredData(response.data.audit_results || []);
        setTotalCount(response.data.count || 0);
        setCriticalCount(response.data.critical_count || 0);
        toast.success(response.data.message || "Audit data loaded successfully");
      }
    } catch (error) {
      console.error("Error fetching audit data:", error);
      toast.error(error.response?.data?.detail || "Failed to fetch audit data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  // Apply filtering and sorting
  useEffect(() => {
    let filtered = [...auditData];
    
    // Apply text filter
    if (filterText) {
      filtered = filtered.filter(row =>
        row.vehicle_name.toLowerCase().includes(filterText.toLowerCase()) ||
        row.date.toLowerCase().includes(filterText.toLowerCase())
      );
    }
    
    // Apply critical filter
    if (showCriticalOnly) {
      filtered = filtered.filter(row => row.is_critical);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Convert to numbers if numeric field
      if (typeof aVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // String comparison
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
    
    setFilteredData(filtered);
  }, [auditData, filterText, showCriticalOnly, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const downloadCSV = () => {
    if (filteredData.length === 0) {
      toast.error("No data to download");
      return;
    }

    const headers = [
      "Date", 
      "Vehicle Name", 
      "Charge at 6AM (%)", 
      "Charge at 12PM (%)", 
      "Charge at 5PM (%)",
      "KM Driven 6AM-12PM",
      "KM Driven 6AM-5PM",
      "Mileage 6AM-12PM (km/% charge)",
      "Mileage 6AM-5PM (km/% charge)",
      "Critical"
    ];
    
    const rows = filteredData.map(row => [
      row.date,
      row.vehicle_name,
      row.charge_6am,
      row.charge_12pm,
      row.charge_5pm,
      row.km_6am_12pm,
      row.km_6am_5pm,
      row.mileage_6am_12pm,
      row.mileage_6am_5pm,
      row.is_critical ? "YES" : "NO"
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `battery_audit_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("CSV downloaded successfully");
  };

  const SortableHeader = ({ field, children }) => (
    <TableHead 
      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        <ArrowUpDown className="w-3 h-3" />
        {sortField === field && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/dashboard/montra-vehicle")}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Battery Audit Analysis</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Steep charge drop analysis with 6AM, 12PM, and 5PM checkpoints
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAuditData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={downloadCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
              </div>
              <div className="text-blue-600 dark:text-blue-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Critical Drops</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  12PM &lt; 60% AND 5PM &lt; 20%
                </p>
              </div>
              <div className="text-red-600 dark:text-red-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Filtered Results</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredData.length}</p>
              </div>
              <div className="text-green-600 dark:text-green-400">
                <Search className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by vehicle name or date..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <Button
              variant={showCriticalOnly ? "default" : "outline"}
              onClick={() => setShowCriticalOnly(!showCriticalOnly)}
              className={showCriticalOnly ? "bg-red-600 hover:bg-red-700" : ""}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {showCriticalOnly ? "Showing Critical Only" : "Show Critical Only"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Results Table */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Audit Results ({filteredData.length} entries)</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Critical rows (12PM &lt; 60% AND 5PM &lt; 20%) are highlighted in red
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Analyzing battery data...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No audit data found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="date">Date</SortableHeader>
                    <SortableHeader field="vehicle_name">Vehicle</SortableHeader>
                    <SortableHeader field="charge_6am">6AM (%)</SortableHeader>
                    <SortableHeader field="charge_12pm">12PM (%)</SortableHeader>
                    <SortableHeader field="charge_5pm">5PM (%)</SortableHeader>
                    <SortableHeader field="km_6am_12pm">KM 6AM-12PM</SortableHeader>
                    <SortableHeader field="km_6am_5pm">KM 6AM-5PM</SortableHeader>
                    <SortableHeader field="mileage_6am_12pm">Mileage 6AM-12PM</SortableHeader>
                    <SortableHeader field="mileage_6am_5pm">Mileage 6AM-5PM</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row, index) => (
                    <TableRow 
                      key={index}
                      className={row.is_critical ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' : ''}
                    >
                      <TableCell className="font-medium">{row.date}</TableCell>
                      <TableCell className="font-mono">{row.vehicle_name}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 dark:text-green-400 font-semibold">
                          {row.charge_6am}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold ${row.charge_12pm < 60 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                          {row.charge_12pm}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold ${row.charge_5pm < 20 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {row.charge_5pm}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{row.km_6am_12pm}</TableCell>
                      <TableCell className="text-center">{row.km_6am_5pm}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-purple-600 dark:text-purple-400">
                          {row.mileage_6am_12pm}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-purple-600 dark:text-purple-400">
                          {row.mileage_6am_5pm}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BatteryAudit;
