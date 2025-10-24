import React, { useState, useEffect } from 'react';
import { API, useAuth } from '@/App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, Loader2, RefreshCw, Settings, Info } from 'lucide-react';

const AnalyticsDashboards = () => {
  const { user } = useAuth();
  
  // Ride Status Pivot State
  const [rideStatusData, setRideStatusData] = useState([]);
  const [rideStatusColumns, setRideStatusColumns] = useState([]);
  const [loadingRideStatus, setLoadingRideStatus] = useState(false);
  const [rideStatusConfig, setRideStatusConfig] = useState({
    rowField: 'date',
    columnField: 'rideStatus',
    valueOperation: 'count',
    filterField: 'source',
    filterValue: 'all'
  });
  const [rideStatusFilterOptions, setRideStatusFilterOptions] = useState([]);
  const [rideStatusEditorOpen, setRideStatusEditorOpen] = useState(false);
  
  // SignUps Pivot State
  const [signupsData, setSignupsData] = useState([]);
  const [signupsColumns, setSignupsColumns] = useState([]);
  const [loadingSignups, setLoadingSignups] = useState(false);
  const [signupsConfig, setSignupsConfig] = useState({
    rowField: 'date',
    columnField: 'source',
    valueOperation: 'count',
    filterField: 'source',
    filterValue: 'all'
  });
  const [signupsFilterOptions, setSignupsFilterOptions] = useState([]);
  const [signupsEditorOpen, setSignupsEditorOpen] = useState(false);

  // Field options for pivot customization
  const rideFields = [
    { value: 'date', label: 'Date' },
    { value: 'rideStatus', label: 'Ride Status' },
    { value: 'rideType', label: 'Ride Type' },
    { value: 'source', label: 'Source' },
    { value: 'pickupLocality', label: 'Pickup Locality' },
    { value: 'dropLocality', label: 'Drop Locality' }
  ];

  const customerFields = [
    { value: 'date', label: 'Date' },
    { value: 'source', label: 'Source' },
    { value: 'Channel', label: 'Channel' },
    { value: 'gender', label: 'Gender' }
  ];

  const valueOperations = [
    { value: 'count', label: 'Count' },
    { value: 'sum', label: 'Sum' },
    { value: 'average', label: 'Average' }
  ];

  useEffect(() => {
    fetchRideStatusPivot();
    fetchSignupsPivot();
  }, []);

  const fetchRideStatusPivot = async () => {
    setLoadingRideStatus(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        row_field: rideStatusConfig.rowField,
        column_field: rideStatusConfig.columnField,
        value_operation: rideStatusConfig.valueOperation,
        filter_field: rideStatusConfig.filterField,
        filter_value: rideStatusConfig.filterValue
      });

      const response = await fetch(`${API}/analytics/ride-status-pivot?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ride status pivot');
      }

      const result = await response.json();
      setRideStatusData(result.data || []);
      setRideStatusColumns(result.columns || []);
      setRideStatusFilterOptions(result.filter_options || []);
    } catch (error) {
      console.error('Error fetching ride status pivot:', error);
      toast.error('Failed to load ride status data');
    } finally {
      setLoadingRideStatus(false);
    }
  };

  const fetchSignupsPivot = async () => {
    setLoadingSignups(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        row_field: signupsConfig.rowField,
        column_field: signupsConfig.columnField,
        value_operation: signupsConfig.valueOperation,
        filter_field: signupsConfig.filterField,
        filter_value: signupsConfig.filterValue
      });

      const response = await fetch(`${API}/analytics/signups-pivot?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch signups pivot');
      }

      const result = await response.json();
      setSignupsData(result.data || []);
      setSignupsColumns(result.columns || []);
      setSignupsFilterOptions(result.filter_options || []);
    } catch (error) {
      console.error('Error fetching signups pivot:', error);
      toast.error('Failed to load signups data');
    } finally {
      setLoadingSignups(false);
    }
  };

  const applyRideStatusConfig = () => {
    setRideStatusEditorOpen(false);
    fetchRideStatusPivot();
  };

  const applySignupsConfig = () => {
    setSignupsEditorOpen(false);
    fetchSignupsPivot();
  };

  const calculateRowTotal = (row, columns) => {
    return columns.reduce((sum, col) => sum + (row[col] || 0), 0);
  };

  const calculateColumnTotal = (data, column) => {
    return data.reduce((sum, row) => sum + (row[column] || 0), 0);
  };

  return (
    <div className="container mx-auto p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboards</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Interactive pivot tables for ride status and customer signups analysis
        </p>
        <Alert className="mt-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> All timestamps are automatically converted from UTC to IST (Indian Standard Time).
            New ride entries include computed fields: Pickup Locality, Drop Locality, Pickup Distance from Depot, Drop Distance from Depot.
          </AlertDescription>
        </Alert>
      </div>

      <Tabs defaultValue="rides" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rides" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Ride Status Analysis
          </TabsTrigger>
          <TabsTrigger value="signups" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Customer SignUps Analysis
          </TabsTrigger>
        </TabsList>

        {/* Ride Status Pivot Tab */}
        <TabsContent value="rides">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Ride Status Pivot Table
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">
                    Analyze ride data by status, date, and other dimensions
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setRideStatusEditorOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Pivot Editor
                  </Button>
                  <Button
                    onClick={fetchRideStatusPivot}
                    variant="outline"
                    size="sm"
                    disabled={loadingRideStatus}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingRideStatus ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter Section */}
              {rideStatusConfig.filterField && (
                <div className="mb-4 flex items-center gap-4">
                  <Label className="text-sm font-medium">Filter by {rideStatusConfig.filterField}:</Label>
                  <Select
                    value={rideStatusConfig.filterValue}
                    onValueChange={(value) => {
                      setRideStatusConfig({...rideStatusConfig, filterValue: value});
                      // Auto-refresh when filter changes
                      setTimeout(fetchRideStatusPivot, 100);
                    }}
                  >
                    <SelectTrigger className="w-48 dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800">
                      <SelectItem value="all">All</SelectItem>
                      {rideStatusFilterOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {loadingRideStatus ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : rideStatusData.length === 0 ? (
                <Alert>
                  <AlertDescription>No data available. Try adjusting your filters or pivot configuration.</AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                          {rideStatusConfig.rowField}
                        </th>
                        {rideStatusColumns.map(col => (
                          <th key={col} className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                            {col}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rideStatusData.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {row.rowLabel}
                          </td>
                          {rideStatusColumns.map(col => (
                            <td key={col} className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                              {row[col] || 0}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-center font-semibold text-blue-600 dark:text-blue-400">
                            {calculateRowTotal(row, rideStatusColumns)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 font-semibold">
                        <td className="px-4 py-3 text-gray-900 dark:text-white">Total</td>
                        {rideStatusColumns.map(col => (
                          <td key={col} className="px-4 py-3 text-center text-gray-900 dark:text-white">
                            {calculateColumnTotal(rideStatusData, col)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">
                          {rideStatusColumns.reduce((sum, col) => sum + calculateColumnTotal(rideStatusData, col), 0)}
                          </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SignUps Pivot Tab */}
        <TabsContent value="signups">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Customer SignUps Pivot Table
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">
                    Analyze customer signups by source, date, and other dimensions
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setSignupsEditorOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Pivot Editor
                  </Button>
                  <Button
                    onClick={fetchSignupsPivot}
                    variant="outline"
                    size="sm"
                    disabled={loadingSignups}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingSignups ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter Section */}
              {signupsConfig.filterField && (
                <div className="mb-4 flex items-center gap-4">
                  <Label className="text-sm font-medium">Filter by {signupsConfig.filterField}:</Label>
                  <Select
                    value={signupsConfig.filterValue}
                    onValueChange={(value) => {
                      setSignupsConfig({...signupsConfig, filterValue: value});
                      // Auto-refresh when filter changes
                      setTimeout(fetchSignupsPivot, 100);
                    }}
                  >
                    <SelectTrigger className="w-48 dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800">
                      <SelectItem value="all">All</SelectItem>
                      {signupsFilterOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {loadingSignups ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : signupsData.length === 0 ? (
                <Alert>
                  <AlertDescription>No data available. Try adjusting your filters or pivot configuration.</AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                          {signupsConfig.rowField}
                        </th>
                        {signupsColumns.map(col => (
                          <th key={col} className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                            {col}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 bg-green-50 dark:bg-green-900/20">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {signupsData.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {row.rowLabel}
                          </td>
                          {signupsColumns.map(col => (
                            <td key={col} className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                              {row[col] || 0}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-center font-semibold text-green-600 dark:text-green-400">
                            {calculateRowTotal(row, signupsColumns)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 font-semibold">
                        <td className="px-4 py-3 text-gray-900 dark:text-white">Total</td>
                        {signupsColumns.map(col => (
                          <td key={col} className="px-4 py-3 text-center text-gray-900 dark:text-white">
                            {calculateColumnTotal(signupsData, col)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">
                          {signupsColumns.reduce((sum, col) => sum + calculateColumnTotal(signupsData, col), 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ride Status Pivot Editor Dialog */}
      <Dialog open={rideStatusEditorOpen} onOpenChange={setRideStatusEditorOpen}>
        <DialogContent className="dark:bg-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Ride Status Pivot Editor</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Customize your pivot table by selecting row, column, and filter fields
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium dark:text-gray-300">Row Field</Label>
                <Select
                  value={rideStatusConfig.rowField}
                  onValueChange={(value) => setRideStatusConfig({...rideStatusConfig, rowField: value})}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {rideFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium dark:text-gray-300">Column Field</Label>
                <Select
                  value={rideStatusConfig.columnField}
                  onValueChange={(value) => setRideStatusConfig({...rideStatusConfig, columnField: value})}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {rideFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium dark:text-gray-300">Value Operation</Label>
                <Select
                  value={rideStatusConfig.valueOperation}
                  onValueChange={(value) => setRideStatusConfig({...rideStatusConfig, valueOperation: value})}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {valueOperations.map(op => (
                      <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium dark:text-gray-300">Filter Field</Label>
                <Select
                  value={rideStatusConfig.filterField}
                  onValueChange={(value) => setRideStatusConfig({...rideStatusConfig, filterField: value})}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {rideFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => setRideStatusEditorOpen(false)}
                variant="outline"
                className="dark:border-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={applyRideStatusConfig}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Apply Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SignUps Pivot Editor Dialog */}
      <Dialog open={signupsEditorOpen} onOpenChange={setSignupsEditorOpen}>
        <DialogContent className="dark:bg-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Customer SignUps Pivot Editor</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Customize your pivot table by selecting row, column, and filter fields
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium dark:text-gray-300">Row Field</Label>
                <Select
                  value={signupsConfig.rowField}
                  onValueChange={(value) => setSignupsConfig({...signupsConfig, rowField: value})}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {customerFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium dark:text-gray-300">Column Field</Label>
                <Select
                  value={signupsConfig.columnField}
                  onValueChange={(value) => setSignupsConfig({...signupsConfig, columnField: value})}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {customerFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium dark:text-gray-300">Value Operation</Label>
                <Select
                  value={signupsConfig.valueOperation}
                  onValueChange={(value) => setSignupsConfig({...signupsConfig, valueOperation: value})}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {valueOperations.map(op => (
                      <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium dark:text-gray-300">Filter Field</Label>
                <Select
                  value={signupsConfig.filterField}
                  onValueChange={(value) => setSignupsConfig({...signupsConfig, filterField: value})}
                >
                  <SelectTrigger className="mt-1 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    {customerFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => setSignupsEditorOpen(false)}
                variant="outline"
                className="dark:border-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={applySignupsConfig}
                className="bg-green-600 hover:bg-green-700"
              >
                Apply Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnalyticsDashboards;
