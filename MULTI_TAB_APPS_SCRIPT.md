# Multi-Tab Apps Script for Nura Pulse

This Apps Script handles multiple tabs for different apps with bidirectional sync.

## Tabs Created:
1. **Users** - User management data
2. **Payment Reconciliation** - Payment transactions and reconciliation
3. **Driver Onboarding** - Driver registration and onboarding status
4. **Telecaller Queue** - Call queue and telecaller assignments
5. **Montra Vehicle Insights** - Vehicle data and analytics

---

## Complete Apps Script Code

**Replace ALL code in Apps Script editor with this:**

```javascript
/**
 * ========================================
 * NURA PULSE - MULTI-TAB SYNC SYSTEM
 * ========================================
 * Handles bidirectional sync for all apps
 */

// Tab configurations
const TABS = {
  users: {
    name: 'Users',
    headers: ['S. No.', 'Date Created', 'Mail ID', 'Account Type', 'Status']
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

/**
 * ========================================
 * MAIN REQUEST HANDLER
 * ========================================
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log('Received: ' + JSON.stringify(data));
    
    const action = data.action;
    const tab = data.tab || 'users';
    
    // Route to appropriate handler
    if (action === 'sync_all') {
      return syncAll(tab, data.records);
    } else if (action === 'sync_single') {
      return syncSingle(tab, data.record);
    } else if (action === 'delete_record') {
      return deleteRecord(tab, data.id);
    } else if (action === 'get_all') {
      return getAll(tab);
    } else if (action === 'get_single') {
      return getSingle(tab, data.id);
    } else if (action === 'search') {
      return searchRecords(tab, data.query);
    } else if (action === 'update_field') {
      return updateField(tab, data.id, data.field, data.value);
    }
    
    return createResponse(false, 'Unknown action: ' + action);
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * ========================================
 * SYNC OPERATIONS (WRITE TO SHEETS)
 * ========================================
 */

/**
 * Sync all records - replaces all data
 */
function syncAll(tabKey, records) {
  try {
    const sheet = getOrCreateSheet(tabKey);
    
    // Clear existing data (keep headers)
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
    
    if (!records || records.length === 0) {
      return createResponse(true, 'No records to sync');
    }
    
    // Prepare rows based on tab type
    const rows = records.map((record, index) => formatRecordForSheet(tabKey, record, index + 1));
    
    // Write all rows
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    formatSheet(sheet, tabKey);
    
    return createResponse(true, `Synced ${records.length} records to ${TABS[tabKey].name}`);
  } catch (error) {
    Logger.log('Error in syncAll: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * Sync single record - add or update
 */
function syncSingle(tabKey, record) {
  try {
    const sheet = getOrCreateSheet(tabKey);
    const id = record.id || record.email; // Use appropriate ID field
    
    // Find existing record
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    const idColumn = getIdColumn(tabKey);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumn] === id) {
        rowIndex = i + 1;
        break;
      }
    }
    
    const rowData = formatRecordForSheet(tabKey, record, rowIndex > 0 ? data[rowIndex - 1][0] : data.length);
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    formatSheet(sheet, tabKey);
    
    return createResponse(true, 'Record synced');
  } catch (error) {
    Logger.log('Error in syncSingle: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * Delete record
 */
function deleteRecord(tabKey, id) {
  try {
    const sheet = getOrCreateSheet(tabKey);
    const data = sheet.getDataRange().getValues();
    const idColumn = getIdColumn(tabKey);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumn] === id) {
        sheet.deleteRow(i + 1);
        renumberSerialNumbers(sheet);
        return createResponse(true, 'Record deleted');
      }
    }
    
    return createResponse(true, 'Record not found');
  } catch (error) {
    Logger.log('Error in deleteRecord: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * ========================================
 * READ OPERATIONS (READ FROM SHEETS)
 * ========================================
 */

/**
 * Get all records from a tab
 */
function getAll(tabKey) {
  try {
    const sheet = getOrCreateSheet(tabKey);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return createResponse(true, 'No records found', []);
    }
    
    const headers = data[0];
    const records = [];
    
    for (let i = 1; i < data.length; i++) {
      const record = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = data[i][j];
      }
      records.push(record);
    }
    
    return createResponse(true, `Found ${records.length} records`, records);
  } catch (error) {
    Logger.log('Error in getAll: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * Get single record by ID
 */
function getSingle(tabKey, id) {
  try {
    const sheet = getOrCreateSheet(tabKey);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumn = getIdColumn(tabKey);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumn] === id) {
        const record = {};
        for (let j = 0; j < headers.length; j++) {
          record[headers[j]] = data[i][j];
        }
        return createResponse(true, 'Record found', record);
      }
    }
    
    return createResponse(false, 'Record not found', null);
  } catch (error) {
    Logger.log('Error in getSingle: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * Search records
 */
function searchRecords(tabKey, query) {
  try {
    const sheet = getOrCreateSheet(tabKey);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const rowText = data[i].join(' ').toLowerCase();
      if (rowText.includes(query.toLowerCase())) {
        const record = {};
        for (let j = 0; j < headers.length; j++) {
          record[headers[j]] = data[i][j];
        }
        results.push(record);
      }
    }
    
    return createResponse(true, `Found ${results.length} records`, results);
  } catch (error) {
    Logger.log('Error in searchRecords: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * Update single field
 */
function updateField(tabKey, id, field, value) {
  try {
    const sheet = getOrCreateSheet(tabKey);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumn = getIdColumn(tabKey);
    const fieldColumn = headers.indexOf(field);
    
    if (fieldColumn === -1) {
      return createResponse(false, 'Field not found: ' + field);
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumn] === id) {
        sheet.getRange(i + 1, fieldColumn + 1).setValue(value);
        return createResponse(true, 'Field updated');
      }
    }
    
    return createResponse(false, 'Record not found');
  } catch (error) {
    Logger.log('Error in updateField: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * ========================================
 * HELPER FUNCTIONS
 * ========================================
 */

/**
 * Get or create sheet for a tab
 */
function getOrCreateSheet(tabKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tabName = TABS[tabKey].name;
  let sheet = ss.getSheetByName(tabName);
  
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    const headers = TABS[tabKey].headers;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeaders(sheet, headers.length);
  }
  
  return sheet;
}

/**
 * Format record based on tab type
 */
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
      
    case 'driver_onboarding':
      return [
        serialNo,
        formatDate(record.date || record.created_at),
        record.driver_name || '',
        record.license_number || '',
        record.phone || '',
        record.status || '',
        record.assigned_vehicle || '',
        record.notes || ''
      ];
      
    case 'telecaller_queue':
      return [
        serialNo,
        formatDate(record.date || record.created_at),
        record.customer_name || '',
        record.phone || '',
        record.purpose || '',
        record.assigned_to || '',
        record.status || '',
        record.priority || 'Medium',
        record.notes || ''
      ];
      
    case 'montra_vehicle_insights':
      return [
        serialNo,
        formatDate(record.date || record.created_at),
        record.vehicle_id || '',
        record.model || '',
        record.status || '',
        formatDate(record.last_service),
        record.mileage || 0,
        record.driver_assigned || '',
        record.location || ''
      ];
      
    default:
      return [];
  }
}

/**
 * Get ID column index for each tab
 */
function getIdColumn(tabKey) {
  switch(tabKey) {
    case 'users': return 2; // Mail ID
    case 'payment_reconciliation': return 2; // Transaction ID
    case 'driver_onboarding': return 3; // License Number
    case 'telecaller_queue': return 3; // Phone
    case 'montra_vehicle_insights': return 2; // Vehicle ID
    default: return 2;
  }
}

/**
 * Format sheet with styling
 */
function formatSheet(sheet, tabKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  formatHeaders(sheet, TABS[tabKey].headers.length);
  
  // Set column widths (can be customized per tab)
  sheet.setColumnWidth(1, 80); // S. No.
  
  // Center align S. No. column
  sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment('center');
  
  // Format status column if exists
  const statusColIndex = TABS[tabKey].headers.indexOf('Status');
  if (statusColIndex !== -1 && lastRow > 1) {
    formatStatusColumn(sheet, lastRow, statusColIndex + 1);
  }
}

/**
 * Format headers
 */
function formatHeaders(sheet, numColumns) {
  const headerRange = sheet.getRange(1, 1, 1, numColumns);
  headerRange.setBackground('#0066FF');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

/**
 * Format status column
 */
function formatStatusColumn(sheet, lastRow, column) {
  const statusRange = sheet.getRange(2, column, lastRow - 1, 1);
  const values = statusRange.getValues();
  
  for (let i = 0; i < values.length; i++) {
    const status = values[i][0].toString().toLowerCase();
    const cell = sheet.getRange(i + 2, column);
    
    if (status.includes('active') || status.includes('completed') || status.includes('done')) {
      cell.setBackground('#D1FAE5');
      cell.setFontColor('#065F46');
    } else if (status.includes('pending') || status.includes('queue')) {
      cell.setBackground('#FEF3C7');
      cell.setFontColor('#92400E');
    } else if (status.includes('rejected') || status.includes('failed')) {
      cell.setBackground('#FEE2E2');
      cell.setFontColor('#991B1B');
    } else if (status.includes('progress') || status.includes('assigned')) {
      cell.setBackground('#DBEAFE');
      cell.setFontColor('#1E40AF');
    }
  }
}

/**
 * Renumber serial numbers
 */
function renumberSerialNumbers(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const range = sheet.getRange(2, 1, lastRow - 1, 1);
  const values = range.getValues().map((row, index) => [index + 1]);
  range.setValues(values);
}

/**
 * Date formatter
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format account type
 */
function formatAccountType(type) {
  if (!type) return '';
  return type.replace(/_/g, ' ').split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Format status
 */
function formatStatus(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Create response
 */
function createResponse(success, message, data) {
  const response = {
    success: success,
    message: message,
    data: data || null,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ========================================
 * INITIALIZATION & TESTING
 * ========================================
 */

/**
 * Initialize all tabs
 */
function initializeAllTabs() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    Object.keys(TABS).forEach(tabKey => {
      getOrCreateSheet(tabKey);
    });
    
    ui.alert('✅ Success', 'All tabs created successfully!', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ Error', error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Test sync
 */
function testSync() {
  const testData = {
    users: [
      {
        email: 'admin',
        account_type: 'master_admin',
        status: 'active',
        created_at: new Date().toISOString()
      }
    ]
  };
  
  const result = syncAll('users', testData.users);
  Logger.log(result.getContent());
  
  SpreadsheetApp.getUi().alert('Test Complete', 'Check the Users tab!', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Create custom menu
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔵 Nura Pulse')
    .addItem('📋 Initialize All Tabs', 'initializeAllTabs')
    .addItem('🧪 Test Sync', 'testSync')
    .addSeparator()
    .addItem('ℹ️ About', 'showAbout')
    .addToUi();
}

/**
 * Show about
 */
function showAbout() {
  const ui = SpreadsheetApp.getUi();
  const message = `🔵 NURA PULSE - Multi-Tab Sync System\n\n` +
                 `Tabs:\n` +
                 `• Users\n` +
                 `• Payment Reconciliation\n` +
                 `• Driver Onboarding\n` +
                 `• Telecaller Queue\n` +
                 `• Montra Vehicle Insights\n\n` +
                 `Features:\n` +
                 `• Bidirectional sync (read & write)\n` +
                 `• Automatic formatting\n` +
                 `• Search & filter\n` +
                 `• Real-time updates`;
  
  ui.alert('About Nura Pulse', message, ui.ButtonSet.OK);
}
```

---

## Setup Instructions:

1. **Paste the code** in your Apps Script editor
2. **Save** the project
3. **Run `initializeAllTabs`** function to create all tabs
4. **Refresh** your Google Sheet

All 5 tabs will be created automatically with proper headers! 🎉
