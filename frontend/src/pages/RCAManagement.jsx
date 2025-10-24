import React, { useState, useEffect } from 'react';
import { API, useAuth } from '@/App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, FileX, UserX } from 'lucide-react';

// Status reason options for Cancellation RCA
const CANCELLATION_REASONS = [
  { value: 'Ride ETA too high', label: 'Ride ETA too high' },
  { value: 'Just checking', label: 'Just checking' },
  { value: 'Price too high', label: 'Price too high' },
  { value: 'Plan changed', label: 'Plan changed' },
  { value: 'Other', label: 'Other' }
];

// Status reason options for Driver Not Found RCA
const DRIVER_NOT_FOUND_REASONS = [
  { value: 'Tech bug', label: 'Tech bug' },
  { value: 'No Driver Logged in', label: 'No Driver Logged in' }
];

const RCAManagement = () => {
  const { user } = useAuth();
  
  // Cancellation RCA state
  const [cancelledRides, setCancelledRides] = useState([]);
  const [loadingCancelled, setLoadingCancelled] = useState(false);
  const [cancelledEditingId, setCancelledEditingId] = useState(null);
  const [cancelledStatusReason, setCancelledStatusReason] = useState('');
  const [cancelledStatusDetail, setCancelledStatusDetail] = useState('');
  
  // Driver Not Found RCA state
  const [dnfRides, setDnfRides] = useState([]);
  const [loadingDnf, setLoadingDnf] = useState(false);
  const [dnfEditingId, setDnfEditingId] = useState(null);
  const [dnfStatusReason, setDnfStatusReason] = useState('');
  const [dnfStatusDetail, setDnfStatusDetail] = useState('');
  
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchCancelledRides();
    fetchDnfRides();
  }, []);

  const fetchCancelledRides = async () => {
    setLoadingCancelled(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/ride-deck/rca/cancelled`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cancelled rides');
      }

      const data = await response.json();
      setCancelledRides(data.rides || []);
    } catch (error) {
      console.error('Error fetching cancelled rides:', error);
      toast.error('Failed to load cancelled rides');
    } finally {
      setLoadingCancelled(false);
    }
  };

  const fetchDnfRides = async () => {
    setLoadingDnf(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/ride-deck/rca/driver-not-found`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch driver not found rides');
      }

      const data = await response.json();
      setDnfRides(data.rides || []);
    } catch (error) {
      console.error('Error fetching driver not found rides:', error);
      toast.error('Failed to load driver not found rides');
    } finally {
      setLoadingDnf(false);
    }
  };

  const handleCancelledUpdate = async (rideId) => {
    // Validation for Cancellation RCA
    if (!cancelledStatusReason) {
      toast.error('Please select a status reason');
      return;
    }

    if (cancelledStatusReason === 'Other' && !cancelledStatusDetail.trim()) {
      toast.error('Status detail is required for "Other" option');
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/ride-deck/rca/update/${rideId}?statusReason=${encodeURIComponent(cancelledStatusReason)}&statusDetail=${encodeURIComponent(cancelledStatusDetail)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update ride');
      }

      toast.success('Status updated successfully');
      setCancelledEditingId(null);
      setCancelledStatusReason('');
      setCancelledStatusDetail('');
      fetchCancelledRides(); // Refresh the list
    } catch (error) {
      console.error('Error updating ride:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleDnfUpdate = async (rideId) => {
    // Validation for Driver Not Found RCA
    if (!dnfStatusReason) {
      toast.error('Please select a status reason');
      return;
    }

    if (!dnfStatusDetail.trim()) {
      toast.error('Status detail is required for Driver Not Found RCA');
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/ride-deck/rca/update/${rideId}?statusReason=${encodeURIComponent(dnfStatusReason)}&statusDetail=${encodeURIComponent(dnfStatusDetail)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update ride');
      }

      toast.success('Status updated successfully');
      setDnfEditingId(null);
      setDnfStatusReason('');
      setDnfStatusDetail('');
      fetchDnfRides(); // Refresh the list
    } catch (error) {
      console.error('Error updating ride:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const startCancelledEdit = (ride) => {
    setCancelledEditingId(ride.id);
    setCancelledStatusReason('');
    setCancelledStatusDetail('');
  };

  const cancelCancelledEdit = () => {
    setCancelledEditingId(null);
    setCancelledStatusReason('');
    setCancelledStatusDetail('');
  };

  const startDnfEdit = (ride) => {
    setDnfEditingId(ride.id);
    setDnfStatusReason('');
    setDnfStatusDetail('');
  };

  const cancelDnfEdit = () => {
    setDnfEditingId(null);
    setDnfStatusReason('');
    setDnfStatusDetail('');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">RCA Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Root Cause Analysis for Cancelled and Driver Not Found rides
        </p>
      </div>

      <Tabs defaultValue="cancelled" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cancelled" className="flex items-center gap-2">
            <FileX className="h-4 w-4" />
            Cancellation RCA ({cancelledRides.length})
          </TabsTrigger>
          <TabsTrigger value="dnf" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Driver Not Found RCA ({dnfRides.length})
          </TabsTrigger>
        </TabsList>

        {/* Cancellation RCA Tab */}
        <TabsContent value="cancelled">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileX className="h-5 w-5" />
                    Cancellation RCA
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">
                    Analyze cancelled rides that need status reason assignment
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchCancelledRides}
                  variant="outline"
                  size="sm"
                  disabled={loadingCancelled}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingCancelled ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCancelled ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : cancelledRides.length === 0 ? (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    All cancelled rides have been analyzed! No pending RCA items.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status Reason</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ride ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Customer Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Customer ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ride Time</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Pickup Locality</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Drop Locality</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledRides.map((ride) => (
                        <tr key={ride.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3">
                            {cancelledEditingId === ride.id ? (
                              <div className="space-y-2 min-w-[200px]">
                                <Select value={cancelledStatusReason} onValueChange={setCancelledStatusReason}>
                                  <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                                    <SelectValue placeholder="Select reason..." />
                                  </SelectTrigger>
                                  <SelectContent className="dark:bg-gray-800">
                                    {CANCELLATION_REASONS.map((reason) => (
                                      <SelectItem key={reason.value} value={reason.value}>
                                        {reason.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {cancelledStatusReason === 'Other' && (
                                  <Input
                                    placeholder="Enter detail (required)"
                                    value={cancelledStatusDetail}
                                    onChange={(e) => setCancelledStatusDetail(e.target.value)}
                                    className="w-full dark:bg-gray-700 dark:border-gray-600"
                                  />
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleCancelledUpdate(ride.id)}
                                    disabled={updating}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelCancelledEdit}
                                    disabled={updating}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startCancelledEdit(ride)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                Assign Reason
                              </Button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-mono">{ride.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{ride.customerName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">{ride.customerId}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ride.rideStartTime || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ride.pickupLocality}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ride.dropLocality}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-500 italic">
                            {cancelledEditingId === ride.id && cancelledStatusReason !== 'Other' ? (
                              <Input
                                placeholder="Optional detail"
                                value={cancelledStatusDetail}
                                onChange={(e) => setCancelledStatusDetail(e.target.value)}
                                className="w-full dark:bg-gray-700 dark:border-gray-600"
                              />
                            ) : (
                              ride.statusDetail || '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Driver Not Found RCA Tab */}
        <TabsContent value="dnf">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserX className="h-5 w-5" />
                    Driver Not Found RCA
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">
                    Analyze driver not found rides that need status reason assignment
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchDnfRides}
                  variant="outline"
                  size="sm"
                  disabled={loadingDnf}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingDnf ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDnf ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : dnfRides.length === 0 ? (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    All driver not found rides have been analyzed! No pending RCA items.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Alert className="mb-4 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800 dark:text-orange-200">
                      <strong>Note:</strong> Status Detail is mandatory for all Driver Not Found RCA entries.
                    </AlertDescription>
                  </Alert>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status Reason</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ride ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Customer Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Customer ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ride Time</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Pickup Locality</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Drop Locality</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status Detail *</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dnfRides.map((ride) => (
                        <tr key={ride.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3">
                            {dnfEditingId === ride.id ? (
                              <div className="space-y-2 min-w-[200px]">
                                <Select value={dnfStatusReason} onValueChange={setDnfStatusReason}>
                                  <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                                    <SelectValue placeholder="Select reason..." />
                                  </SelectTrigger>
                                  <SelectContent className="dark:bg-gray-800">
                                    {DRIVER_NOT_FOUND_REASONS.map((reason) => (
                                      <SelectItem key={reason.value} value={reason.value}>
                                        {reason.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleDnfUpdate(ride.id)}
                                    disabled={updating}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelDnfEdit}
                                    disabled={updating}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startDnfEdit(ride)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                Assign Reason
                              </Button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-mono">{ride.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{ride.customerName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">{ride.customerId}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ride.rideStartTime || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ride.pickupLocality}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ride.dropLocality}</td>
                          <td className="px-4 py-3">
                            {dnfEditingId === ride.id ? (
                              <Input
                                placeholder="Enter detail (required)"
                                value={dnfStatusDetail}
                                onChange={(e) => setDnfStatusDetail(e.target.value)}
                                className="w-full dark:bg-gray-700 dark:border-gray-600"
                              />
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-500 italic">
                                {ride.statusDetail || '-'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RCAManagement;
