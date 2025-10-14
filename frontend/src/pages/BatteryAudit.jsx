import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, RefreshCw, Download, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";

const BatteryAudit = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

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
        setTotalCount(response.data.count || 0);
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

  const downloadCSV = () => {
    if (auditData.length === 0) {
      toast.error("No data to download");
      return;
    }

    const headers = ["Date", "Vehicle Name", "Timestamp", "Battery %", "KM Driven (from start of day)"];
    const csvContent = [
      headers.join(","),
      ...auditData.map(item => [
        item.date,
        item.vehicle_name,
        item.timestamp,
        item.battery_percentage,
        item.km_driven_upto_point
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `battery_audit_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV downloaded successfully");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/montra-vehicle")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                Battery Charge Audit
              </h1>
              <p className="text-gray-600 mt-1">
                Low charge instances (&lt;20%) between 7 AM - 7 PM
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchAuditData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={downloadCSV}
              disabled={auditData.length === 0}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </Button>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              Audit Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Instances</p>
                <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Time Window</p>
                <p className="text-xl font-semibold text-orange-600">7 AM - 7 PM</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Threshold</p>
                <p className="text-xl font-semibold text-red-600">&lt; 20%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Results</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600">Loading audit data...</span>
              </div>
            ) : auditData.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">No low charge instances found</p>
                <p className="text-gray-500 text-sm">
                  {totalCount === 0 
                    ? "No Montra feed data available. Import vehicle data to generate audit reports."
                    : "All vehicles maintained charge above 20% during operational hours."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Vehicle Name</TableHead>
                      <TableHead className="font-semibold">Charge at 7 AM</TableHead>
                      <TableHead className="font-semibold">Timestamp</TableHead>
                      <TableHead className="font-semibold">Battery %</TableHead>
                      <TableHead className="font-semibold">KM Driven (from start of day)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.map((item, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{item.date}</TableCell>
                        <TableCell>{item.vehicle_name}</TableCell>
                        <TableCell>
                          {item.charge_at_7am === "N/A" ? (
                            <span className="text-gray-400">N/A</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {item.charge_at_7am}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{item.timestamp}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {item.battery_percentage}%
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.km_driven_upto_point === "N/A" ? (
                            <span className="text-gray-400">N/A</span>
                          ) : (
                            <span>{item.km_driven_upto_point} km</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">About This Audit</h3>
                <p className="text-sm text-blue-800">
                  This report shows the <strong>first instance each day</strong> when a vehicle's battery charge dropped below 20% during operational hours (7 AM to 7 PM). 
                  The KM driven is calculated from the start of the day (00:00) to the timestamp when the low charge was detected.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BatteryAudit;
