/**
 * NURA PULSE - Payment Reconciliation Google AppScript V3
 * Platform column positioned after Driver Name (before Vehicle Number)
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet or use existing "Nura Pulse - Payment Reconciliation"
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Save the script (Ctrl+S or Cmd+S)
 * 5. Click on "Deploy" > "New deployment"
 * 6. Choose "Web app" as deployment type
 * 7. Set "Execute as" to "Me"
 * 8. Set "Who has access" to "Anyone"
 * 9. Click "Deploy" and copy the Web App URL
 * 10. Paste the Web App URL in your Nura Pulse backend .env file as PAYMENT_SHEETS_APPS_SCRIPT_URL
 * 11. The script will auto-create sheets for each month (e.g., "Sep 2025", "Oct 2025", "Nov 2025")
 * 
 * SHEET STRUCTURE (Auto-created):
 * Column Order:
 * A: Record ID
 * B: Driver Name
 * C: Platform (Rapido/Uber/Ola/Nura/Adhoc) - **AFTER DRIVER NAME**
 * D: Vehicle Number
 * E: Date
 * F: Time
 * G: Description
 * H: Amount
 * I: Payment Mode (Mode)
 * J: Distance (km)
 * K: Duration (min)
 * L: Pickup KM
 * M: Drop KM
 * N: Pickup Location
 * O: Drop Location
 * P: Screenshot Filename
 * Q: Status
 * R: Created At
 */

// Configuration
const HEADER_ROW = 1;

// Column mapping (1-based indexing) - Platform after Driver Name
const COLUMNS = {
  ID: 1,              // A
  DRIVER: 2,          // B
  PLATFORM: 3,        // C - **AFTER DRIVER NAME**
  VEHICLE: 4,         // D
  DATE: 5,            // E
  TIME: 6,            // F
  DESCRIPTION: 7,     // G
  AMOUNT: 8,          // H
  PAYMENT_MODE: 9,    // I (Mode)
  DISTANCE: 10,       // J
  DURATION: 11,       // K
  PICKUP_KM: 12,      // L
  DROP_KM: 13,        // M
  PICKUP_LOCATION: 14,// N
  DROP_LOCATION: 15,  // O
  SCREENSHOT: 16,     // P
  STATUS: 17,         // Q
  CREATED_AT: 18      // R
};

/**
 * doPost - Handles POST requests from Nura Pulse backend
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const records = data.data || [];
    const monthYear = data.month_year || "Unknown";
    
    Logger.log(`Received ${records.length} records for ${monthYear}`);
    
    // Get or create sheet for this month
    const sheet = getOrCreateSheet(monthYear);
    
    // Sync records
    const result = syncRecordsToSheet(sheet, records);
    
    return createResponse(true, `Synced ${result.created} new records to ${monthYear}`, result);
    
  } catch (error) {
    Logger.log(`Error in doPost: ${error.toString()}`);
    return createResponse(false, error.toString());
  }
}

/**
 * doGet - Handles GET requests (health check)
 */
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      message: "Payment Reconciliation V3 sync endpoint is active (Platform after Driver Name)",
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Sync records to Google Sheets
 */
function syncRecordsToSheet(sheet, records) {
  try {
    // Ensure headers exist
    ensureHeaders(sheet);
    
    let created = 0;
    let updated = 0;
    let errors = [];
    
    records.forEach(record => {
      try {
        const existingRow = findRowByID(sheet, record.id);
        
        if (existingRow > 0) {
          // Update existing record
          updateRow(sheet, existingRow, record);
          updated++;
        } else {
          // Create new record
          appendRow(sheet, record);
          created++;
        }
      } catch (err) {
        errors.push(`Error processing record ${record.id}: ${err.toString()}`);
        Logger.log(`Error processing record: ${err.toString()}`);
      }
    });
    
    return {
      created: created,
      updated: updated,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    Logger.log(`Error in syncRecordsToSheet: ${error.toString()}`);
    throw error;
  }
}

/**
 * Helper: Get or create the sheet for a specific month
 */
function getOrCreateSheet(monthYear) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(monthYear);
  
  if (!sheet) {
    sheet = ss.insertSheet(monthYear);
    Logger.log(`Created new sheet: ${monthYear}`);
  }
  
  return sheet;
}

/**
 * Helper: Ensure headers exist (Platform after Driver Name)
 */
function ensureHeaders(sheet) {
  const headers = sheet.getRange(HEADER_ROW, 1, 1, 18).getValues()[0];
  
  if (!headers[0]) {
    const headerRow = [
      'Record ID',        // A
      'Driver Name',      // B
      'Platform',         // C - **AFTER DRIVER NAME**
      'Vehicle Number',   // D
      'Date',             // E
      'Time',             // F
      'Description',      // G
      'Amount',           // H
      'Payment Mode',     // I (Mode)
      'Distance (km)',    // J
      'Duration (min)',   // K
      'Pickup KM',        // L
      'Drop KM',          // M
      'Pickup Location',  // N
      'Drop Location',    // O
      'Screenshot',       // P
      'Status',           // Q
      'Created At'        // R
    ];
    
    sheet.getRange(HEADER_ROW, 1, 1, 18).setValues([headerRow]);
    sheet.getRange(HEADER_ROW, 1, 1, 18).setFontWeight('bold');
    sheet.getRange(HEADER_ROW, 1, 1, 18).setBackground('#4285F4');
    sheet.getRange(HEADER_ROW, 1, 1, 18).setFontColor('#FFFFFF');
    sheet.setFrozenRows(HEADER_ROW);
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, 18);
    
    Logger.log('Headers created with Platform in column C (after Driver Name)');
  }
}

/**
 * Helper: Find row by Record ID
 */
function findRowByID(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) return -1;
  
  const idColumn = sheet.getRange(HEADER_ROW + 1, COLUMNS.ID, lastRow - HEADER_ROW, 1).getValues();
  
  for (let i = 0; i < idColumn.length; i++) {
    if (idColumn[i][0] === id) {
      return i + HEADER_ROW + 1;
    }
  }
  
  return -1;
}

/**
 * Helper: Update row with record data
 * Column order: ID, Driver, Platform, Vehicle, Date, Time, Description, Amount, Mode, Distance, Duration, Pickup KM, Drop KM, Pickup Loc, Drop Loc, Screenshot, Status, Created At
 */
function updateRow(sheet, row, record) {
  const values = [
    record.id || '',
    record.driver || 'N/A',
    record.platform || 'N/A',        // Column C - **PLATFORM AFTER DRIVER**
    record.vehicle || 'N/A',         // Column D - Vehicle Number
    record.date || 'N/A',
    record.time || 'N/A',
    record.description || 'Auto',
    record.amount || '0',
    record.payment_mode || 'N/A',    // Column I - Mode
    record.distance || 'N/A',
    record.duration || 'N/A',
    record.pickup_km || 'N/A',
    record.drop_km || 'N/A',
    record.pickup_location || 'N/A',
    record.drop_location || 'N/A',
    record.screenshot_filename || 'N/A',
    record.status || 'pending',
    new Date().toISOString()
  ];
  
  sheet.getRange(row, 1, 1, 18).setValues([values]);
}

/**
 * Helper: Append new row with record data
 * Column order: ID, Driver, Platform, Vehicle, Date, Time, Description, Amount, Mode, Distance, Duration, Pickup KM, Drop KM, Pickup Loc, Drop Loc, Screenshot, Status, Created At
 */
function appendRow(sheet, record) {
  const values = [
    record.id || '',
    record.driver || 'N/A',
    record.platform || 'N/A',        // Column C - **PLATFORM AFTER DRIVER**
    record.vehicle || 'N/A',         // Column D - Vehicle Number
    record.date || 'N/A',
    record.time || 'N/A',
    record.description || 'Auto',
    record.amount || '0',
    record.payment_mode || 'N/A',    // Column I - Mode
    record.distance || 'N/A',
    record.duration || 'N/A',
    record.pickup_km || 'N/A',
    record.drop_km || 'N/A',
    record.pickup_location || 'N/A',
    record.drop_location || 'N/A',
    record.screenshot_filename || 'N/A',
    record.status || 'pending',
    new Date().toISOString()
  ];
  
  sheet.appendRow(values);
}

/**
 * Helper: Create JSON response
 */
function createResponse(success, message, data = {}) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Manual trigger: Initialize sheet with headers for a specific month
 * Usage: Edit the monthYear variable below and run this function
 */
function initializeSheetForMonth() {
  const monthYear = "Nov 2025"; // Change this to desired month
  const sheet = getOrCreateSheet(monthYear);
  ensureHeaders(sheet);
  Logger.log(`Sheet initialized successfully for ${monthYear} with Platform after Driver Name`);
}

/**
 * Manual trigger: Test sync with sample data
 */
function testSync() {
  const testRecord = {
    id: 'test-' + new Date().getTime(),
    driver: 'Test Driver',
    platform: 'Rapido',  // Platform field included after driver
    vehicle: 'TN01AB1234',
    date: '15/11/2025',
    time: '10:30 AM',
    description: 'Auto',
    amount: '150',
    payment_mode: 'Cash',
    distance: '5.2',
    duration: '25',
    pickup_km: 'N/A',
    drop_km: 'N/A',
    pickup_location: 'Anna Nagar',
    drop_location: 'T Nagar',
    screenshot_filename: 'test_screenshot.jpg',
    status: 'pending'
  };
  
  const sheet = getOrCreateSheet("Nov 2025");
  const result = syncRecordsToSheet(sheet, [testRecord]);
  Logger.log(`Test sync result: ${JSON.stringify(result)}`);
}

/**
 * Manual trigger: Clear all data from a specific month (keeps headers)
 */
function clearMonthData() {
  const monthYear = "Nov 2025"; // Change this to desired month
  const sheet = getOrCreateSheet(monthYear);
  const lastRow = sheet.getLastRow();
  
  if (lastRow > HEADER_ROW) {
    sheet.deleteRows(HEADER_ROW + 1, lastRow - HEADER_ROW);
    Logger.log(`Cleared ${lastRow - HEADER_ROW} rows from ${monthYear}`);
  } else {
    Logger.log(`No data to clear in ${monthYear}`);
  }
}
