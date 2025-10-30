/**
 * NURA PULSE - Payment Reconciliation Google AppScript for Nov 2025
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet with the name "Nura Pulse - Payment Reconciliation Nov 2025"
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Save the script (Ctrl+S or Cmd+S)
 * 5. Click on "Deploy" > "New deployment"
 * 6. Choose "Web app" as deployment type
 * 7. Set "Execute as" to "Me"
 * 8. Set "Who has access" to "Anyone"
 * 9. Click "Deploy" and copy the Web App URL
 * 10. Paste the Web App URL in your Nura Pulse backend .env file as GOOGLE_SHEETS_PAYMENT_WEBHOOK_URL
 * 11. In the Google Sheet, create a sheet named "Nov 2025" (this will be the active sheet for data)
 * 
 * SHEET STRUCTURE:
 * The script expects the following columns in your "Nov 2025" sheet:
 * A: Record ID (auto-generated UUID)
 * B: Driver Name
 * C: Vehicle Number
 * D: Platform (Rapido/Uber/Ola/Nura/Adhoc)
 * E: Date
 * F: Invoice Amount
 * G: Cash Collected
 * H: Settlement Amount
 * I: Status (Pending/Approved/Paid)
 * J: Notes
 * K: Created At (timestamp)
 * L: Updated At (timestamp)
 */

// Configuration
const SHEET_NAME = "Nov 2025";
const HEADER_ROW = 1;

// Column mapping (1-based indexing)
const COLUMNS = {
  ID: 1,
  DRIVER_NAME: 2,
  VEHICLE_NUMBER: 3,
  PLATFORM: 4,
  DATE: 5,
  INVOICE_AMOUNT: 6,
  CASH_COLLECTED: 7,
  SETTLEMENT_AMOUNT: 8,
  STATUS: 9,
  NOTES: 10,
  CREATED_AT: 11,
  UPDATED_AT: 12
};

/**
 * doPost - Handles POST requests from Nura Pulse backend
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    Logger.log(`Received action: ${action}`);
    
    switch (action) {
      case 'sync_to_sheets':
        return syncToSheets(data.records);
      case 'get_all_records':
        return getAllRecords();
      case 'delete_records':
        return deleteRecords(data.record_ids);
      case 'update_record':
        return updateRecord(data.record);
      default:
        return createResponse(false, `Unknown action: ${action}`);
    }
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
      message: "Payment Reconciliation Nov 2025 sync endpoint is active",
      sheet: SHEET_NAME,
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Sync records to Google Sheets
 */
function syncToSheets(records) {
  try {
    const sheet = getOrCreateSheet();
    
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
      }
    });
    
    return createResponse(true, `Synced ${created} new and ${updated} updated records`, {
      created,
      updated,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    Logger.log(`Error in syncToSheets: ${error.toString()}`);
    return createResponse(false, error.toString());
  }
}

/**
 * Get all records from Google Sheets
 */
function getAllRecords() {
  try {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= HEADER_ROW) {
      return createResponse(true, "No records found", { records: [], count: 0 });
    }
    
    const dataRange = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, 12);
    const values = dataRange.getValues();
    
    const records = values
      .filter(row => row[0]) // Filter out empty rows
      .map(row => ({
        id: row[0],
        driver_name: row[1] || '',
        vehicle_number: row[2] || '',
        platform: row[3] || '',
        date: row[4] || '',
        invoice_amount: row[5] || 0,
        cash_collected: row[6] || 0,
        settlement_amount: row[7] || 0,
        status: row[8] || 'Pending',
        notes: row[9] || '',
        created_at: row[10] || '',
        updated_at: row[11] || ''
      }));
    
    return createResponse(true, `Retrieved ${records.length} records`, {
      records,
      count: records.length
    });
    
  } catch (error) {
    Logger.log(`Error in getAllRecords: ${error.toString()}`);
    return createResponse(false, error.toString());
  }
}

/**
 * Delete records by IDs
 */
function deleteRecords(recordIds) {
  try {
    const sheet = getOrCreateSheet();
    let deleted = 0;
    
    // Sort in descending order to delete from bottom to top
    recordIds.sort((a, b) => {
      const rowA = findRowByID(sheet, a);
      const rowB = findRowByID(sheet, b);
      return rowB - rowA;
    });
    
    recordIds.forEach(id => {
      const row = findRowByID(sheet, id);
      if (row > 0) {
        sheet.deleteRow(row);
        deleted++;
      }
    });
    
    return createResponse(true, `Deleted ${deleted} records`, { deleted });
    
  } catch (error) {
    Logger.log(`Error in deleteRecords: ${error.toString()}`);
    return createResponse(false, error.toString());
  }
}

/**
 * Update a specific record
 */
function updateRecord(record) {
  try {
    const sheet = getOrCreateSheet();
    const row = findRowByID(sheet, record.id);
    
    if (row > 0) {
      updateRow(sheet, row, record);
      return createResponse(true, "Record updated successfully");
    } else {
      // If record doesn't exist, create it
      appendRow(sheet, record);
      return createResponse(true, "Record created successfully");
    }
    
  } catch (error) {
    Logger.log(`Error in updateRecord: ${error.toString()}`);
    return createResponse(false, error.toString());
  }
}

/**
 * Helper: Get or create the sheet
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    Logger.log(`Created new sheet: ${SHEET_NAME}`);
  }
  
  return sheet;
}

/**
 * Helper: Ensure headers exist
 */
function ensureHeaders(sheet) {
  const headers = sheet.getRange(HEADER_ROW, 1, 1, 12).getValues()[0];
  
  if (!headers[0]) {
    const headerRow = [
      'Record ID',
      'Driver Name',
      'Vehicle Number',
      'Platform',
      'Date',
      'Invoice Amount',
      'Cash Collected',
      'Settlement Amount',
      'Status',
      'Notes',
      'Created At',
      'Updated At'
    ];
    
    sheet.getRange(HEADER_ROW, 1, 1, 12).setValues([headerRow]);
    sheet.getRange(HEADER_ROW, 1, 1, 12).setFontWeight('bold');
    sheet.getRange(HEADER_ROW, 1, 1, 12).setBackground('#4285F4');
    sheet.getRange(HEADER_ROW, 1, 1, 12).setFontColor('#FFFFFF');
    sheet.setFrozenRows(HEADER_ROW);
    
    Logger.log('Headers created');
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
 */
function updateRow(sheet, row, record) {
  const values = [
    record.id,
    record.driver_name || '',
    record.vehicle_number || '',
    record.platform || '',
    record.date || '',
    record.invoice_amount || 0,
    record.cash_collected || 0,
    record.settlement_amount || 0,
    record.status || 'Pending',
    record.notes || '',
    record.created_at || '',
    new Date().toISOString() // Updated at
  ];
  
  sheet.getRange(row, 1, 1, 12).setValues([values]);
}

/**
 * Helper: Append new row with record data
 */
function appendRow(sheet, record) {
  const values = [
    record.id,
    record.driver_name || '',
    record.vehicle_number || '',
    record.platform || '',
    record.date || '',
    record.invoice_amount || 0,
    record.cash_collected || 0,
    record.settlement_amount || 0,
    record.status || 'Pending',
    record.notes || '',
    new Date().toISOString(), // Created at
    new Date().toISOString()  // Updated at
  ];
  
  sheet.appendRow(values);
}

/**
 * Helper: Create JSON response
 */
function createResponse(success, message, data = {}) {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Manual trigger: Initialize sheet with headers
 */
function initializeSheet() {
  const sheet = getOrCreateSheet();
  ensureHeaders(sheet);
  Logger.log('Sheet initialized successfully');
}

/**
 * Manual trigger: Clear all data (keeps headers)
 */
function clearAllData() {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow > HEADER_ROW) {
    sheet.deleteRows(HEADER_ROW + 1, lastRow - HEADER_ROW);
    Logger.log(`Cleared ${lastRow - HEADER_ROW} rows`);
  } else {
    Logger.log('No data to clear');
  }
}

/**
 * Manual trigger: Test sync
 */
function testSync() {
  const testRecord = {
    id: 'test-' + new Date().getTime(),
    driver_name: 'Test Driver',
    vehicle_number: 'TN01AB1234',
    platform: 'Rapido',
    date: new Date().toISOString().split('T')[0],
    invoice_amount: 1500,
    cash_collected: 1500,
    settlement_amount: 1350,
    status: 'Pending',
    notes: 'Test record from AppScript',
    created_at: new Date().toISOString()
  };
  
  const result = syncToSheets([testRecord]);
  Logger.log(result.getContent());
}
