/**
 * Nura Pulse - Complete Google Sheets Apps Script
 * Handles all tabs with bidirectional sync
 * 
 * IMPORTANT: Replace 'YOUR_SPREADSHEET_ID' with your actual Google Sheet ID
 * Deploy this as a Web App with "Execute as: Me" and "Access: Anyone"
 */

// Configuration - REPLACE WITH YOUR SHEET ID
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Get this from your sheet URL

/**
 * Main POST handler for all incoming requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const tab = data.tab;
    
    Logger.log('Received request - Action: ' + action + ', Tab: ' + tab);
    
    // Route to appropriate handler
    if (tab === 'users') {
      return handleUsersTab(action, data);
    } else if (tab === 'leads') {
      return handleLeadsTab(action, data);
    } else if (tab === 'payment_reconciliation') {
      return handlePaymentReconciliationTab(action, data);
    } else if (tab === 'driver_onboarding') {
      return handleDriverOnboardingTab(action, data);
    } else if (tab === 'telecaller_queue') {
      return handleTelecallerQueueTab(action, data);
    } else if (tab === 'montra_vehicle_insights' || tab === 'Montra Feed Data') {
      return handleMontraVehicleTab(action, data);
    }
    
    return createResponse(false, 'Unknown tab: ' + tab);
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

/**
 * GET handler for fetching data
 */
function doGet(e) {
  try {
    const tab = e.parameter.tab;
    
    if (!tab) {
      return createResponse(false, 'Tab parameter required');
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(getSheetName(tab));
    
    if (!sheet) {
      return createResponse(false, 'Sheet not found: ' + tab);
    }
    
    // Get all data except header row
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return createResponse(true, 'No data found', []);
    }
    
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Convert to array of objects
    const records = data.map(row => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });
    
    return createResponse(true, 'Fetched ' + records.length + ' records', records);
    
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

// ==================== TAB HANDLERS ====================

/**
 * Handle Users tab operations
 */
function handleUsersTab(action, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Users');
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.getRange(1, 1, 1, 5).setValues([['S. No.', 'Date Created', 'Mail ID', 'Account Type', 'Status']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  
  if (action === 'sync_all') {
    const records = data.records;
    
    // Clear existing data (except headers)
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    // Add all records
    const rows = records.map((record, index) => [
      index + 1,
      record.created_at || '',
      record.email || '',
      record.account_type || '',
      record.status || ''
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    }
    
    return createResponse(true, 'Synced ' + records.length + ' users');
  }
  
  if (action === 'sync_single') {
    const record = data.record;
    
    // Find existing row by email
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 5);
    const values = dataRange.getValues();
    
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][2] === record.email) {
        rowIndex = i + 2;
        break;
      }
    }
    
    const rowData = [
      rowIndex > 0 ? values[rowIndex - 2][0] : sheet.getLastRow(),
      record.created_at || '',
      record.email || '',
      record.account_type || '',
      record.status || ''
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 5).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return createResponse(true, 'Updated user');
  }
  
  if (action === 'delete_record') {
    const email = data.id;
    
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 5);
    const values = dataRange.getValues();
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][2] === email) {
        sheet.deleteRow(i + 2);
        return createResponse(true, 'Deleted user');
      }
    }
    
    return createResponse(false, 'User not found');
  }
  
  return createResponse(false, 'Unknown action: ' + action);
}

/**
 * Handle Leads tab operations
 * IMPORTANT: This includes Column L for Status field
 */
function handleLeadsTab(action, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Leads');
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet('Leads');
    sheet.getRange(1, 1, 1, 12).setValues([[
      'S. No.', 'Name', 'Phone Number', 'Vehicle', 'Driving License', 
      'Experience', 'Interested in EV', 'Monthly Salary', 'Residing Chennai',
      'Current Location', 'Import Date', 'Status'
    ]]);
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  if (action === 'sync_all') {
    const records = data.records;
    
    // Clear existing data (except headers)
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    // Add all records
    const rows = records.map((record, index) => [
      index + 1,                                    // A: S.No.
      record.name || '',                            // B: Name
      record.phone_number || '',                    // C: Phone Number
      record.vehicle || '',                         // D: Vehicle
      record.driving_license || '',                 // E: Driving License
      record.experience || '',                      // F: Experience
      record.interested_ev || '',                   // G: Interested in EV
      record.monthly_salary || '',                  // H: Monthly Salary
      record.residing_chennai || '',                // I: Residing Chennai
      record.current_location || '',                // J: Current Location
      formatDate(record.import_date),               // K: Import Date
      record.status || 'New'                        // L: Status ← COLUMN L
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 12).setValues(rows);
      
      // Auto-resize columns for better visibility
      sheet.autoResizeColumns(1, 12);
    }
    
    return createResponse(true, 'Synced ' + records.length + ' leads');
  }
  
  if (action === 'sync_single') {
    const record = data.record;
    
    // Find existing row by phone number (unique identifier)
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 12);
    const values = dataRange.getValues();
    
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][2] === record.phone_number) { // Column C is phone number
        rowIndex = i + 2;
        break;
      }
    }
    
    const rowData = [
      rowIndex > 0 ? values[rowIndex - 2][0] : sheet.getLastRow(),  // S.No.
      record.name || '',
      record.phone_number || '',
      record.vehicle || '',
      record.driving_license || '',
      record.experience || '',
      record.interested_ev || '',
      record.monthly_salary || '',
      record.residing_chennai || '',
      record.current_location || '',
      formatDate(record.import_date),
      record.status || 'New'                        // L: Status ← COLUMN L
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 12).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return createResponse(true, 'Updated lead');
  }
  
  if (action === 'delete_record') {
    const phone = data.id;
    
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 12);
    const values = dataRange.getValues();
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][2] === phone) {
        sheet.deleteRow(i + 2);
        return createResponse(true, 'Deleted lead');
      }
    }
    
    return createResponse(false, 'Lead not found');
  }
  
  return createResponse(false, 'Unknown action: ' + action);
}

/**
 * Handle Payment Reconciliation tab operations
 */
function handlePaymentReconciliationTab(action, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Payment Reconciliation');
  
  if (!sheet) {
    sheet = ss.insertSheet('Payment Reconciliation');
    sheet.getRange(1, 1, 1, 8).setValues([[
      'S. No.', 'Transaction ID', 'Date', 'Customer Name', 'Amount', 
      'Payment Method', 'Status', 'Notes'
    ]]);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }
  
  if (action === 'sync_all') {
    const records = data.records;
    
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    const rows = records.map((record, index) => [
      index + 1,
      record.transaction_id || '',
      formatDate(record.date),
      record.customer_name || '',
      record.amount || '',
      record.payment_method || '',
      record.status || '',
      record.notes || ''
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    }
    
    return createResponse(true, 'Synced ' + records.length + ' payment records');
  }
  
  if (action === 'sync_single') {
    const record = data.record;
    
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 8);
    const values = dataRange.getValues();
    
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][1] === record.transaction_id) {
        rowIndex = i + 2;
        break;
      }
    }
    
    const rowData = [
      rowIndex > 0 ? values[rowIndex - 2][0] : sheet.getLastRow(),
      record.transaction_id || '',
      formatDate(record.date),
      record.customer_name || '',
      record.amount || '',
      record.payment_method || '',
      record.status || '',
      record.notes || ''
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 8).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return createResponse(true, 'Updated payment record');
  }
  
  return createResponse(false, 'Unknown action: ' + action);
}

/**
 * Handle Driver Onboarding tab operations
 */
function handleDriverOnboardingTab(action, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Driver Onboarding');
  
  if (!sheet) {
    sheet = ss.insertSheet('Driver Onboarding');
    sheet.getRange(1, 1, 1, 6).setValues([[
      'S. No.', 'Driver Name', 'Phone Number', 'License Number', 
      'Onboarding Date', 'Status'
    ]]);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  
  if (action === 'sync_all') {
    const records = data.records;
    
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    const rows = records.map((record, index) => [
      index + 1,
      record.driver_name || '',
      record.phone_number || '',
      record.license_number || '',
      formatDate(record.onboarding_date),
      record.status || ''
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }
    
    return createResponse(true, 'Synced ' + records.length + ' driver records');
  }
  
  if (action === 'sync_single') {
    const record = data.record;
    
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 6);
    const values = dataRange.getValues();
    
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][2] === record.phone_number) {
        rowIndex = i + 2;
        break;
      }
    }
    
    const rowData = [
      rowIndex > 0 ? values[rowIndex - 2][0] : sheet.getLastRow(),
      record.driver_name || '',
      record.phone_number || '',
      record.license_number || '',
      formatDate(record.onboarding_date),
      record.status || ''
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 6).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return createResponse(true, 'Updated driver record');
  }
  
  return createResponse(false, 'Unknown action: ' + action);
}

/**
 * Handle Telecaller Queue tab operations
 */
function handleTelecallerQueueTab(action, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Telecaller Queue');
  
  if (!sheet) {
    sheet = ss.insertSheet('Telecaller Queue');
    sheet.getRange(1, 1, 1, 7).setValues([[
      'S. No.', 'Lead Name', 'Phone Number', 'Assigned To', 
      'Call Date', 'Status', 'Notes'
    ]]);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }
  
  if (action === 'sync_all') {
    const records = data.records;
    
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    const rows = records.map((record, index) => [
      index + 1,
      record.lead_name || '',
      record.phone_number || '',
      record.assigned_to || '',
      formatDate(record.call_date),
      record.status || '',
      record.notes || ''
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 7).setValues(rows);
    }
    
    return createResponse(true, 'Synced ' + records.length + ' telecaller tasks');
  }
  
  if (action === 'sync_single') {
    const record = data.record;
    
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 7);
    const values = dataRange.getValues();
    
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][2] === record.phone_number && values[i][4] === formatDate(record.call_date)) {
        rowIndex = i + 2;
        break;
      }
    }
    
    const rowData = [
      rowIndex > 0 ? values[rowIndex - 2][0] : sheet.getLastRow(),
      record.lead_name || '',
      record.phone_number || '',
      record.assigned_to || '',
      formatDate(record.call_date),
      record.status || '',
      record.notes || ''
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 7).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return createResponse(true, 'Updated telecaller task');
  }
  
  return createResponse(false, 'Unknown action: ' + action);
}

/**
 * Handle Montra Vehicle Insights tab operations
 */
function handleMontraVehicleTab(action, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Handle Montra Feed Data import
  if (action === 'import_montra_feed') {
    let feedSheet = ss.getSheetByName('Montra Feed Data');
    
    // Create sheet if it doesn't exist
    if (!feedSheet) {
      feedSheet = ss.insertSheet('Montra Feed Data');
      Logger.log('Created new sheet: Montra Feed Data');
    }
    
    // Set up headers in row 1 (columns D to AB)
    // Headers from CSV (columns A-U) go to D-X
    // Additional: Y=Vehicle ID, Z=Separator, AA=Day, AB=Month
    const headers = data.headers || [];
    const startCol = 4; // Column D
    
    if (feedSheet.getLastRow() === 0) {
      // First time setup - add headers
      const headerRow = new Array(startCol - 1).fill(''); // Empty A, B, C
      headerRow.push(...headers);
      feedSheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
      feedSheet.getRange(1, startCol, 1, headers.length).setFontWeight('bold');
      Logger.log('Set up headers in row 1');
    }
    
    // Import data starting from row 2, column D
    const feedData = data.data || [];
    
    if (feedData.length > 0) {
      const startRow = feedSheet.getLastRow() + 1; // Append after existing data
      
      // Prepare rows with empty columns A, B, C
      const rowsToInsert = feedData.map(row => {
        const emptyColumns = new Array(startCol - 1).fill('');
        return [...emptyColumns, ...row];
      });
      
      feedSheet.getRange(startRow, 1, rowsToInsert.length, rowsToInsert[0].length)
        .setValues(rowsToInsert);
      
      Logger.log('Imported ' + feedData.length + ' rows to Montra Feed Data starting at row ' + startRow);
      
      return createResponse(true, 'Imported ' + feedData.length + ' rows to Montra Feed Data (Vehicle: ' + data.vehicle_id + ', Date: ' + data.day + ' ' + data.month + ')');
    }
    
    return createResponse(false, 'No data to import');
  }
  
  // Handle regular Montra Vehicle Insights tab
  let sheet = ss.getSheetByName('Montra Vehicle Insights');
  
  if (!sheet) {
    sheet = ss.insertSheet('Montra Vehicle Insights');
    sheet.getRange(1, 1, 1, 8).setValues([[
      'S. No.', 'Vehicle ID', 'Registration Number', 'Model', 
      'Last Service Date', 'Mileage', 'Status', 'Notes'
    ]]);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }
  
  if (action === 'sync_all') {
    const records = data.records;
    
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    
    const rows = records.map((record, index) => [
      index + 1,
      record.vehicle_id || '',
      record.registration_number || '',
      record.model || '',
      formatDate(record.last_service_date),
      record.mileage || '',
      record.status || '',
      record.notes || ''
    ]);
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    }
    
    return createResponse(true, 'Synced ' + records.length + ' vehicle records');
  }
  
  if (action === 'sync_single') {
    const record = data.record;
    
    const dataRange = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 8);
    const values = dataRange.getValues();
    
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][1] === record.vehicle_id) {
        rowIndex = i + 2;
        break;
      }
    }
    
    const rowData = [
      rowIndex > 0 ? values[rowIndex - 2][0] : sheet.getLastRow(),
      record.vehicle_id || '',
      record.registration_number || '',
      record.model || '',
      formatDate(record.last_service_date),
      record.mileage || '',
      record.status || '',
      record.notes || ''
    ];
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, 8).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return createResponse(true, 'Updated vehicle record');
  }
  
  return createResponse(false, 'Unknown action: ' + action);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Create standardized JSON response
 */
function createResponse(success, message, data) {
  const response = {
    success: success,
    message: message
  };
  
  if (data !== undefined) {
    response.data = data;
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Format date for display in sheet
 */
function formatDate(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm:ss');
  } catch (e) {
    return dateString;
  }
}

/**
 * Get sheet name from tab identifier
 */
function getSheetName(tab) {
  const mapping = {
    'users': 'Users',
    'leads': 'Leads',
    'payment_reconciliation': 'Payment Reconciliation',
    'driver_onboarding': 'Driver Onboarding',
    'telecaller_queue': 'Telecaller Queue',
    'montra_vehicle_insights': 'Montra Vehicle Insights'
  };
  
  return mapping[tab] || tab;
}

/**
 * Test function - Run this to verify setup
 */
function testSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Spreadsheet Name: ' + ss.getName());
  Logger.log('Script is working correctly!');
  
  // Create all sheets if they don't exist
  const sheets = ['Users', 'Leads', 'Payment Reconciliation', 'Driver Onboarding', 
                  'Telecaller Queue', 'Montra Vehicle Insights'];
  
  sheets.forEach(function(sheetName) {
    if (!ss.getSheetByName(sheetName)) {
      Logger.log('Creating sheet: ' + sheetName);
      ss.insertSheet(sheetName);
    } else {
      Logger.log('Sheet exists: ' + sheetName);
    }
  });
  
  Logger.log('Setup complete!');
}
