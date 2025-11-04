/**
 * Payment Reconciliation Google Apps Script - V2
 * Handles bidirectional sync between MongoDB and Google Sheets
 * Supports multiple month/year tabs with detailed ride data
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  SHEET_ID: '1CLhARhllhqZuDzkzNRqFcOGqjrSDzPgmC6gd3-AWOTs',
  BACKEND_URL: 'https://qr-campaign-fix.preview.emergentagent.com/api'
};

// Column mapping for payment records
const COLUMNS = {
  DRIVER: 0,
  VEHICLE: 1,
  DATE: 2,
  TIME: 3,
  DESCRIPTION: 4,
  AMOUNT: 5,
  PAYMENT_MODE: 6,
  DISTANCE: 7,
  DURATION: 8,
  PICKUP_KM: 9,
  DROP_KM: 10,
  PICKUP_LOCATION: 11,
  DROP_LOCATION: 12,
  SCREENSHOT: 13,
  RECORD_ID: 14, // Hidden column for MongoDB record ID
  STATUS: 15
};

const HEADERS = [
  'Driver Name',
  'Vehicle Number',
  'Date',
  'Time',
  'Description',
  'Amount (₹)',
  'Payment Mode',
  'Distance (km)',
  'Duration (min)',
  'Pickup KM',
  'Drop KM',
  'Pickup Location',
  'Drop Location',
  'Screenshot',
  'Record ID',
  'Status'
];

// ============================================
// MAIN API ENDPOINT
// ============================================

function doPost(e) {
  try {
    // Log the entire request for debugging
    Logger.log('Received doPost request');
    
    // Check if e exists
    if (!e) {
      Logger.log('Error: e parameter is undefined');
      return createResponse(false, 'No request data received');
    }
    
    // Check if postData exists
    if (!e.postData) {
      Logger.log('Error: e.postData is undefined');
      Logger.log('e object: ' + JSON.stringify(e));
      return createResponse(false, 'No POST data in request');
    }
    
    // Parse the request data
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    Logger.log('Received request - Action: ' + action);
    Logger.log('Request data: ' + JSON.stringify(data).substring(0, 200)); // Log first 200 chars
    
    switch(action) {
      case 'sync_from_backend':
        return syncFromBackend(data);
      case 'sync_to_backend':
        return syncToBackend(data);
      case 'get_sheet_data':
        return getSheetData(data);
      default:
        return createResponse(false, 'Unknown action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return createResponse(false, 'Error: ' + error.toString());
  }
}

// Add a doGet function for testing
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Payment Reconciliation Apps Script is running',
    timestamp: new Date().toISOString(),
    config: {
      sheet_id: CONFIG.SHEET_ID,
      backend_url: CONFIG.BACKEND_URL
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// SYNC FROM BACKEND TO SHEETS
// ============================================

function syncFromBackend(data) {
  try {
    const monthYear = data.month_year; // e.g., "Sep 2025"
    const records = data.records || [];
    
    if (!monthYear) {
      return createResponse(false, 'month_year is required');
    }
    
    Logger.log('Syncing ' + records.length + ' records for ' + monthYear);
    
    // Get or create sheet for this month/year
    const sheet = getOrCreateSheet(monthYear);
    
    // Clear existing data (except headers)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
    }
    
    // Add headers if needed
    ensureHeaders(sheet);
    
    // Write records to sheet
    if (records.length > 0) {
      const sheetData = records.map(record => [
        record.driver || 'N/A',
        record.vehicle || 'N/A',
        record.date || 'N/A',
        record.time || 'N/A',
        record.description || 'Auto',
        record.amount || '0',
        record.payment_mode || 'N/A',
        record.distance || 'N/A',
        record.duration || 'N/A',
        record.pickup_km || 'N/A',
        record.drop_km || 'N/A',
        record.pickup_location || 'N/A',
        record.drop_location || 'N/A',
        record.screenshot_filename || 'N/A',
        record.id || '', // Record ID (hidden)
        record.status || 'pending'
      ]);
      
      sheet.getRange(2, 1, sheetData.length, HEADERS.length).setValues(sheetData);
      
      // Format the sheet
      formatSheet(sheet);
    }
    
    return createResponse(true, 'Successfully synced ' + records.length + ' records to ' + monthYear);
    
  } catch (error) {
    Logger.log('Error in syncFromBackend: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

// ============================================
// SYNC TO BACKEND FROM SHEETS
// ============================================

function syncToBackend(data) {
  try {
    const monthYear = data.month_year;
    
    if (!monthYear) {
      return createResponse(false, 'month_year is required');
    }
    
    const sheet = getOrCreateSheet(monthYear);
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return createResponse(true, 'No data to sync from ' + monthYear);
    }
    
    // Read all data from sheet
    const range = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);
    const values = range.getValues();
    
    const records = values.map(row => ({
      driver: row[COLUMNS.DRIVER] || 'N/A',
      vehicle: row[COLUMNS.VEHICLE] || 'N/A',
      date: row[COLUMNS.DATE] || 'N/A',
      time: row[COLUMNS.TIME] || 'N/A',
      description: row[COLUMNS.DESCRIPTION] || 'Auto',
      amount: row[COLUMNS.AMOUNT] || '0',
      payment_mode: row[COLUMNS.PAYMENT_MODE] || 'N/A',
      distance: row[COLUMNS.DISTANCE] || 'N/A',
      duration: row[COLUMNS.DURATION] || 'N/A',
      pickup_km: row[COLUMNS.PICKUP_KM] || 'N/A',
      drop_km: row[COLUMNS.DROP_KM] || 'N/A',
      pickup_location: row[COLUMNS.PICKUP_LOCATION] || 'N/A',
      drop_location: row[COLUMNS.DROP_LOCATION] || 'N/A',
      screenshot_filename: row[COLUMNS.SCREENSHOT] || 'N/A',
      id: row[COLUMNS.RECORD_ID] || '',
      status: row[COLUMNS.STATUS] || 'pending'
    })).filter(record => record.id); // Only sync records with IDs
    
    return createResponse(true, 'Read ' + records.length + ' records from ' + monthYear, { records: records });
    
  } catch (error) {
    Logger.log('Error in syncToBackend: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

// ============================================
// GET SHEET DATA
// ============================================

function getSheetData(data) {
  try {
    const monthYear = data.month_year;
    
    if (!monthYear) {
      return createResponse(false, 'month_year is required');
    }
    
    const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(monthYear);
    
    if (!sheet) {
      return createResponse(false, 'Sheet not found: ' + monthYear);
    }
    
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return createResponse(true, 'No data in ' + monthYear, { records: [] });
    }
    
    const range = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);
    const values = range.getValues();
    
    const records = values.map(row => ({
      driver: row[COLUMNS.DRIVER],
      vehicle: row[COLUMNS.VEHICLE],
      date: row[COLUMNS.DATE],
      time: row[COLUMNS.TIME],
      description: row[COLUMNS.DESCRIPTION],
      amount: row[COLUMNS.AMOUNT],
      payment_mode: row[COLUMNS.PAYMENT_MODE],
      distance: row[COLUMNS.DISTANCE],
      duration: row[COLUMNS.DURATION],
      pickup_km: row[COLUMNS.PICKUP_KM],
      drop_km: row[COLUMNS.DROP_KM],
      pickup_location: row[COLUMNS.PICKUP_LOCATION],
      drop_location: row[COLUMNS.DROP_LOCATION],
      screenshot_filename: row[COLUMNS.SCREENSHOT],
      id: row[COLUMNS.RECORD_ID],
      status: row[COLUMNS.STATUS]
    }));
    
    return createResponse(true, 'Retrieved ' + records.length + ' records', { records: records });
    
  } catch (error) {
    Logger.log('Error in getSheetData: ' + error.toString());
    return createResponse(false, 'Error: ' + error.toString());
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('Created new sheet: ' + sheetName);
  }
  
  return sheet;
}

function ensureHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = firstRow[0] === HEADERS[0];
  
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    
    // Format headers
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
  }
}

function formatSheet(sheet) {
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return;
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Auto-resize columns
  for (let i = 1; i <= HEADERS.length; i++) {
    sheet.autoResizeColumn(i);
  }
  
  // Set alternating row colors
  const dataRange = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);
  dataRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  
  // Hide Record ID column (column O, index 15)
  sheet.hideColumns(COLUMNS.RECORD_ID + 1);
  
  // Format amount column as currency
  const amountRange = sheet.getRange(2, COLUMNS.AMOUNT + 1, lastRow - 1, 1);
  amountRange.setNumberFormat('₹#,##0.00');
  
  // Center align specific columns
  const centerColumns = [COLUMNS.DATE + 1, COLUMNS.TIME + 1, COLUMNS.DESCRIPTION + 1, COLUMNS.DISTANCE + 1, COLUMNS.DURATION + 1];
  centerColumns.forEach(col => {
    sheet.getRange(2, col, lastRow - 1, 1).setHorizontalAlignment('center');
  });
}

function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message
  };
  
  if (data) {
    response.data = data;
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// TEST FUNCTIONS (for manual testing)
// ============================================

function testSyncFromBackend() {
  const testData = {
    action: 'sync_from_backend',
    month_year: 'Sep 2025',
    records: [
      {
        id: 'test-id-1',
        driver: 'Abdul',
        vehicle: 'TN07CE2222',
        date: '29/09/2024',
        time: '8:48 PM',
        description: 'Auto (Surge)',
        amount: '92.44',
        payment_mode: 'Cash',
        distance: '3.57',
        duration: '16',
        pickup_km: 'N/A',
        drop_km: 'N/A',
        pickup_location: 'N/A',
        drop_location: 'N/A',
        screenshot_filename: 'IMG-20251003-WA0039.jpg',
        status: 'pending'
      }
    ]
  };
  
  const result = syncFromBackend(testData);
  Logger.log(result.getContent());
}

function testGetSheetData() {
  const testData = {
    action: 'get_sheet_data',
    month_year: 'Sep 2025'
  };
  
  const result = getSheetData(testData);
  Logger.log(result.getContent());
}

function testConfiguration() {
  Logger.log('Testing Payment Reconciliation Apps Script Configuration');
  Logger.log('===============================================');
  Logger.log('Sheet ID: ' + CONFIG.SHEET_ID);
  Logger.log('Backend URL: ' + CONFIG.BACKEND_URL);
  
  // Test sheet access
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    Logger.log('✅ Successfully opened spreadsheet: ' + ss.getName());
    
    // List existing sheets
    const sheets = ss.getSheets();
    Logger.log('Found ' + sheets.length + ' sheets:');
    sheets.forEach(function(sheet) {
      Logger.log('  - ' + sheet.getName());
    });
    
    return 'Configuration test PASSED';
  } catch (error) {
    Logger.log('❌ Error accessing spreadsheet: ' + error.toString());
    return 'Configuration test FAILED: ' + error.toString();
  }
}
