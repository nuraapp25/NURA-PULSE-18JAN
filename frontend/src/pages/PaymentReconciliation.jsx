import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Search, RefreshCw, Edit, DollarSign, CreditCard } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { API } from "@/App";
import { format } from "date-fns";

const PaymentReconciliation = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [newPayment, setNewPayment] = useState({
    transaction_id: "",
    amount: "",
    payment_method: "",
    status: "Pending",
    customer_name: "",
    notes: ""
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/payment-reconciliation`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayments(response.data || []);
    } catch (error) {
      toast.error("Failed to fetch payment records");
      console.error("Fetch payments error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.transaction_id || !newPayment.amount || !newPayment.payment_method) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/payment-reconciliation`, {
        ...newPayment,
        amount: parseFloat(newPayment.amount)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Payment record created successfully");
      setShowAddDialog(false);
      setNewPayment({
        transaction_id: "",
        amount: "",
        payment_method: "",
        status: "Pending",
        customer_name: "",
        notes: ""
      });
      fetchPayments();
    } catch (error) {
      toast.error("Failed to create payment record");
      console.error("Add payment error:", error);
    }
  };

  const handleUpdatePayment = async (paymentId, updatedData) => {
    try {
      const token = localStorage.getItem("token");
      // Note: We'll need to add update endpoint later
      // For now, we'll just update locally and sync
      const updatedPayments = payments.map(payment => 
        payment.id === paymentId 
          ? { ...payment, ...updatedData }
          : payment
      );
      setPayments(updatedPayments);
      toast.success("Payment status updated");
      setShowEditDialog(false);
    } catch (error) {
      toast.error("Failed to update payment");
      console.error("Update payment error:", error);
    }
  };

  const handleSyncToSheets = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/payment-reconciliation/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Payments synced to Google Sheets successfully");
    } catch (error) {
      toast.error("Failed to sync payments to Google Sheets");
      console.error("Sync error:", error);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Completed": return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "Reconciled": return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "Failed": return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "Pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.payment_method?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" data-testid="payment-reconciliation-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <DollarSign className="mr-2 sm:mr-3 text-green-600" size={28} />
            <span className="hidden sm:inline">Payment Reconciliation</span>
            <span className="sm:hidden">Payments</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and reconcile payment transactions
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button 
            onClick={handleSyncToSheets}
            disabled={syncing}
            variant="outline"
            className="flex items-center text-sm"
            size="sm"
          >
            <RefreshCw size={16} className={`mr-1 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-sm" size="sm">
                <Plus size={16} className="mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Add Payment</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="dark:bg-gray-800">
              <DialogHeader>
                <DialogTitle className="dark:text-white">Add New Payment Record</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="dark:text-gray-300">Transaction ID *</Label>
                  <Input
                    value={newPayment.transaction_id}
                    onChange={(e) => setNewPayment({...newPayment, transaction_id: e.target.value})}
                    placeholder="TXN123456"
                    className="dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <Label className="dark:text-gray-300">Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                    placeholder="1000.00"
                    className="dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <Label className="dark:text-gray-300">Payment Method *</Label>
                  <Select 
                    value={newPayment.payment_method} 
                    onValueChange={(value) => setNewPayment({...newPayment, payment_method: value})}
                  >
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800">
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Credit/Debit Card</SelectItem>
                      <SelectItem value="Net Banking">Net Banking</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="dark:text-gray-300">Status</Label>
                  <Select 
                    value={newPayment.status} 
                    onValueChange={(value) => setNewPayment({...newPayment, status: value})}
                  >
                    <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800">
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                      <SelectItem value="Reconciled">Reconciled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="dark:text-gray-300">Customer Name</Label>
                  <Input
                    value={newPayment.customer_name}
                    onChange={(e) => setNewPayment({...newPayment, customer_name: e.target.value})}
                    placeholder="Customer name"
                    className="dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="dark:text-gray-300">Notes</Label>
                  <Textarea
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                    placeholder="Additional notes..."
                    rows={3}
                    className="dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPayment}>Add Payment</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by transaction ID, customer name, or payment method..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                  <SelectItem value="Reconciled">Reconciled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Records Table */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between dark:text-white">
            <span className="flex items-center">
              <CreditCard size={20} className="mr-2" />
              Payment Records ({filteredPayments.length})
            </span>
            <Button variant="outline" onClick={fetchPayments} disabled={loading}>
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== "all" ? "No payments found matching your filters" : "No payment records found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Transaction ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Method</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-3 px-4 font-mono text-sm">{payment.transaction_id}</td>
                      <td className="py-3 px-4 text-sm">
                        {payment.date ? format(new Date(payment.date), 'dd MMM yyyy') : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold">₹{payment.amount?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm">{payment.payment_method}</td>
                      <td className="py-3 px-4 text-sm">{payment.customer_name || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowEditDialog(true);
                          }}
                        >
                          <Edit size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Payment Dialog */}
      {selectedPayment && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle className="dark:text-white">Update Payment Status</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="dark:text-gray-300">Transaction ID</Label>
                <Input value={selectedPayment.transaction_id} disabled className="dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div>
                <Label className="dark:text-gray-300">Amount</Label>
                <Input value={`₹${selectedPayment.amount?.toFixed(2)}`} disabled className="dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div>
                <Label className="dark:text-gray-300">Status</Label>
                <Select 
                  value={selectedPayment.status} 
                  onValueChange={(value) => setSelectedPayment({...selectedPayment, status: value})}
                >
                  <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800">
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                    <SelectItem value="Reconciled">Reconciled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleUpdatePayment(selectedPayment.id, { status: selectedPayment.status })}>
                Update Status
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default PaymentReconciliation;