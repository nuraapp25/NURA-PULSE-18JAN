import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

const PaymentReconciliation = () => {
  return (
    <div className="space-y-6" data-testid="payment-reconciliation-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payment Reconciliation</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage and reconcile payment transactions</p>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <FileText size={20} className="mr-2" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            Payment reconciliation features will be available here. This module will help you track and reconcile all payment transactions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentReconciliation;