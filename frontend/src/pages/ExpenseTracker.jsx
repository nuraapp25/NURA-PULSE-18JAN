import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Calendar as CalendarIcon, Upload, Eye, Download, Edit, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import axios from "axios";
import { API, useAuth } from "@/App";
import { toast } from "sonner";

const ExpenseTracker = () => {
  const { user } = useAuth();
  const isMasterAdmin = user?.account_type === "master_admin";
  const isAdmin = user?.account_type === "admin";
  const canApprove = isMasterAdmin || isAdmin;
  const canDelete = isMasterAdmin;

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptFiles, setReceiptFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(response.data.expenses || []);
    } catch (error) {
      toast.error("Failed to load expenses");
      console.error("Fetch expenses error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => file.size <= 10 * 1024 * 1024); // 10MB limit
    
    if (validFiles.length !== files.length) {
      toast.error("Some files exceed 10MB limit and were not added");
    }
    
    setReceiptFiles(prev => [...prev, ...validFiles]);
  };

  const handleSubmitExpense = async () => {
    if (!description || !amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("date", format(selectedDate, "yyyy-MM-dd"));
      formData.append("description", description);
      formData.append("amount", amount);
      
      if (editingExpense) {
        formData.append("expense_id", editingExpense.id);
      }

      receiptFiles.forEach(file => {
        formData.append("receipts", file);
      });

      const endpoint = editingExpense ? "/expenses/update" : "/expenses/add";
      const response = await axios.post(`${API}${endpoint}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      toast.success(response.data.message);
      setAddDialogOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedDate(new Date());
    setDescription("");
    setAmount("");
    setReceiptFiles([]);
    setEditingExpense(null);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setSelectedDate(new Date(expense.date));
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setAddDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedExpenses.length === 0) {
      toast.error("Please select expenses to delete");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedExpenses.length} expense(s)?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/expenses/delete`,
        { expense_ids: selectedExpenses },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Expenses deleted successfully");
      setSelectedExpenses([]);
      fetchExpenses();
    } catch (error) {
      toast.error("Failed to delete expenses");
    }
  };

  const handleApprovalChange = async (expenseId, status) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/expenses/approve`,
        { expense_id: expenseId, status },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Expense ${status.toLowerCase()}`);
      fetchExpenses();
    } catch (error) {
      toast.error("Failed to update approval status");
    }
  };

  const handleViewReceipt = async (expenseId, filename) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/expenses/${expenseId}/receipt/${filename}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes');
    } catch (error) {
      toast.error("Failed to view receipt");
    }
  };

  const handleDownloadReceipt = async (expenseId, filename) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/expenses/${expenseId}/receipt/${filename}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Receipt downloaded");
    } catch (error) {
      toast.error("Failed to download receipt");
    }
  };

  const toggleExpenseSelection = (expenseId) => {
    setSelectedExpenses(prev =>
      prev.includes(expenseId)
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  const getApprovalBadgeColor = (status) => {
    if (status === "Approved") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (status === "Rejected") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  };

  return (
    <div className="space-y-6">
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-gray-900 dark:text-white">💰 Expense Tracker</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  resetForm();
                  setAddDialogOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus size={18} className="mr-2" />
                ADD
              </Button>
              <Button
                onClick={fetchExpenses}
                variant="outline"
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedExpenses.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedExpenses.length} expense(s) selected
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const expense = expenses.find(e => e.id === selectedExpenses[0]);
                    if (expense && selectedExpenses.length === 1) {
                      handleEdit(expense);
                    } else {
                      toast.error("Please select only one expense to edit");
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  <Edit size={16} className="mr-1" />
                  Edit
                </Button>
                {canDelete && (
                  <Button
                    onClick={handleDelete}
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} className="mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No expenses found. Click ADD to create one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      <Checkbox
                        checked={selectedExpenses.length === expenses.length}
                        onCheckedChange={(checked) => {
                          setSelectedExpenses(checked ? expenses.map(e => e.id) : []);
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">S.No.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Receipt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Approval Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense, index) => (
                    <tr key={expense.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedExpenses.includes(expense.id)}
                          onCheckedChange={() => toggleExpenseSelection(expense.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{expense.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{expense.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">₹{expense.amount}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {expense.receipt_filenames && expense.receipt_filenames.length > 0 ? (
                            expense.receipt_filenames.map((filename, idx) => (
                              <div key={idx} className="flex gap-1">
                                <Button
                                  onClick={() => handleViewReceipt(expense.id, filename)}
                                  variant="outline"
                                  size="sm"
                                  title="View"
                                >
                                  <Eye size={14} />
                                </Button>
                                <Button
                                  onClick={() => handleDownloadReceipt(expense.id, filename)}
                                  variant="outline"
                                  size="sm"
                                  title="Download"
                                >
                                  <Download size={14} />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">No receipt</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {canApprove ? (
                          <Select
                            value={expense.approval_status || "Pending"}
                            onValueChange={(value) => handleApprovalChange(expense.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Approved">Approved</SelectItem>
                              <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getApprovalBadgeColor(expense.approval_status || "Pending")}`}>
                            {expense.approval_status || "Pending"}
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

      {/* Add/Edit Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Description *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter expense description"
              />
            </div>

            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div>
              <Label>Receipt (Max 10MB per file)</Label>
              <Input
                type="file"
                multiple
                accept="*/*"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {receiptFiles.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {receiptFiles.length} file(s) selected
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                onClick={() => {
                  setAddDialogOpen(false);
                  resetForm();
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitExpense}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingExpense ? "Update" : "Add Expense"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseTracker;
