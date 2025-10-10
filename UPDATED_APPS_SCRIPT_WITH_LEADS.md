# Updated Apps Script with Leads Tab Support

Add this to your existing Apps Script. This adds support for the "Leads" tab.

## Update the TABS constant:

Find the `TABS` object at the top and add the `leads` entry:

```javascript
const TABS = {
  users: {
    name: 'Users',
    headers: ['S. No.', 'Date Created', 'Mail ID', 'Account Type', 'Status']
  },
  leads: {
    name: 'Leads',
    headers: ['S. No.', 'Name', 'Phone Number', 'Vehicle', 'Driving License', 'Experience', 'Interested to Drive Electric Auto', 'Current Monthly Salary', 'Are you residing in Chennai Currently?', 'Current Location in Chennai', 'Date of Import']
  },
  payment_reconciliation: {
    name: 'Payment Reconciliation',
    headers: ['S. No.', 'Date', 'Transaction ID', 'Amount', 'Payment Method', 'Status', 'Reconciled By']
  },
  driver_onboarding: {
    name: 'Driver Onboarding',
    headers: ['S. No.', 'Date', 'Driver Name', 'License Number', 'Phone', 'Status', 'Assigned Vehicle', 'Notes']
  },
  telecaller_queue: {
    name: 'Telecaller Queue',
    headers: ['S. No.', 'Date', 'Customer Name', 'Phone', 'Purpose', 'Assigned To', 'Status', 'Priority', 'Notes']
  },
  montra_vehicle_insights: {
    name: 'Montra Vehicle Insights',
    headers: ['S. No.', 'Date', 'Vehicle ID', 'Model', 'Status', 'Last Service', 'Mileage', 'Driver Assigned', 'Location']
  }
};
```

## Add the Leads formatting function:

Find the `formatRecordForSheet` function and add this case:

```javascript
function formatRecordForSheet(tabKey, record, serialNo) {
  switch(tabKey) {
    case 'users':
      return [
        serialNo,
        formatDate(record.created_at),
        record.email || '',
        formatAccountType(record.account_type),
        formatStatus(record.status)
      ];
    
    case 'leads':
      return [
        serialNo,
        record.name || '',
        record.phone_number || '',
        record.vehicle || '',
        record.driving_license || '',
        record.experience || '',
        record.interested_ev || '',
        record.monthly_salary || '',
        record.residing_chennai || '',
        record.current_location || '',
        formatDate(record.import_date)
      ];
      
    case 'payment_reconciliation':
      return [
        serialNo,
        formatDate(record.date || record.created_at),
        record.transaction_id || '',
        record.amount || 0,
        record.payment_method || '',
        record.status || '',
        record.reconciled_by || ''
      ];
      
    // ... rest of the cases remain the same
  }
}
```

## Update getIdColumn function:

```javascript
function getIdColumn(tabKey) {
  switch(tabKey) {
    case 'users': return 2; // Mail ID
    case 'leads': return 2; // Phone Number
    case 'payment_reconciliation': return 2; // Transaction ID
    case 'driver_onboarding': return 3; // License Number
    case 'telecaller_queue': return 3; // Phone
    case 'montra_vehicle_insights': return 2; // Vehicle ID
    default: return 2;
  }
}
```

## That's it!

After adding these changes:
1. Save the script
2. Deploy new version
3. Run `initializeAllTabs` to create the Leads tab

The Leads tab will be created automatically with all 11 columns (A-K)!
