/**
 * NURA PULSE - Payment Reconciliation Google AppScript
 * Platform column positioned after Driver Name (before Vehicle Number)
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete existing code and paste this script
 * 4. Save (Ctrl+S)
 * 5. Deploy > New deployment > Web app
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 * 8. Deploy and copy the Web App URL
 * 9. Add URL to backend .env as PAYMENT_SHEETS_APPS_SCRIPT_URL
 * 
 * COLUMN ORDER:
 * A: Record ID
 * B: Driver Name
 * C: Platform (after Driver Name)
 * D: Vehicle Number
 * E: Date
 * F: Time
 * G: Description
 * H: Amount
 * I: Payment Mode
 * J: Distance (km)
 * K: Duration (min)
 * L: Pickup KM
 * M: Drop KM
 * N: Pickup Location
 * O: Drop Location
 * P: Screenshot
 * Q: Status
 * R: Created At
 */

const HEADER_ROW = 1;

const COLUMNS = {
  ID: 1,
  DRIVER: 2,
  PLATFORM: 3,
  VEHICLE: 4,
  DATE: 5,
  TIME: 6,
  DESCRIPTION: 7,
  AMOUNT: 8,
  PAYMENT_MODE: 9,
  DISTANCE: 10,
  DURATION: 11,
  PICKUP_KM: 12,
  DROP_KM: 13,
  PICKUP_LOCATION: 14,
  DROP_LOCATION: 15,
  SCREENSHOT: 16,
  STATUS: 17,
  CREATED_AT: 18
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const records = data.data || [];
    const monthYear = data.month_year || "Unknown";
    
    Logger.log("Received " + records.length + " records for " + monthYear);
    
    const sheet = getOrCreateSheet(monthYear);
    const result = syncRecordsToSheet(sheet, records);
    
    return createResponse(true, "Synced " + result.created + " new records to " + monthYear, result);
    
  } catch (error) {
    Logger.log("Error in doPost: " + error.toString());
    return createResponse(false, error.toString());
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      message: "Payment Reconciliation sync endpoint is active",
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function syncRecordsToSheet(sheet, records) {
  try {
    ensureHeaders(sheet);
    
    var created = 0;
    var updated = 0;
    var errors = [];
    
    records.forEach(function(record) {
      try {
        const existingRow = findRowByID(sheet, record.id);
        
        if (existingRow > 0) {
          updateRow(sheet, existingRow, record);
          updated++;
        } else {
          appendRow(sheet, record);
          created++;
        }
      } catch (err) {
        errors.push("Error processing record " + record.id + ": " + err.toString());
        Logger.log("Error processing record: " + err.toString());
      }
    });
    
    return {
      created: created,
      updated: updated,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    Logger.log("Error in syncRecordsToSheet: " + error.toString());
    throw error;
  }
}

function getOrCreateSheet(monthYear) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(monthYear);
  
  if (!sheet) {
    sheet = ss.insertSheet(monthYear);
    Logger.log("Created new sheet: " + monthYear);
  }
  
  return sheet;
}

function ensureHeaders(sheet) {
  const headers = sheet.getRange(HEADER_ROW, 1, 1, 18).getValues()[0];
  
  if (!headers[0]) {
    const headerRow = [
      "Record ID",
      "Driver Name",
      "Platform",
      "Vehicle Number",
      "Date",
      "Time",
      "Description",
      "Amount",
      "Payment Mode",
      "Distance (km)",
      "Duration (min)",
      "Pickup KM",
      "Drop KM",
      "Pickup Location",
      "Drop Location",
      "Screenshot",
      "Status",
      "Created At"
    ];
    
    sheet.getRange(HEADER_ROW, 1, 1, 18).setValues([headerRow]);
    sheet.getRange(HEADER_ROW, 1, 1, 18).setFontWeight("bold");
    sheet.getRange(HEADER_ROW, 1, 1, 18).setBackground("#4285F4");
    sheet.getRange(HEADER_ROW, 1, 1, 18).setFontColor("#FFFFFF");
    sheet.setFrozenRows(HEADER_ROW);
    
    sheet.autoResizeColumns(1, 18);
    
    Logger.log("Headers created with Platform in column C");
  }
}

function findRowByID(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) return -1;
  
  const idColumn = sheet.getRange(HEADER_ROW + 1, COLUMNS.ID, lastRow - HEADER_ROW, 1).getValues();
  
  for (var i = 0; i < idColumn.length; i++) {
    if (idColumn[i][0] === id) {
      return i + HEADER_ROW + 1;
    }
  }
  
  return -1;
}

function updateRow(sheet, row, record) {
  const values = [
    record.id || "",
    record.driver || "N/A",
    record.platform || "N/A",
    record.vehicle || "N/A",
    record.date || "N/A",
    record.time || "N/A",
    record.description || "Auto",
    record.amount || "0",
    record.payment_mode || "N/A",
    record.distance || "N/A",
    record.duration || "N/A",
    record.pickup_km || "N/A",
    record.drop_km || "N/A",
    record.pickup_location || "N/A",
    record.drop_location || "N/A",
    record.screenshot_filename || "N/A",
    record.status || "pending",
    new Date().toISOString()
  ];
  
  sheet.getRange(row, 1, 1, 18).setValues([values]);
}

function appendRow(sheet, record) {
  const values = [
    record.id || "",
    record.driver || "N/A",
    record.platform || "N/A",
    record.vehicle || "N/A",
    record.date || "N/A",
    record.time || "N/A",
    record.description || "Auto",
    record.amount || "0",
    record.payment_mode || "N/A",
    record.distance || "N/A",
    record.duration || "N/A",
    record.pickup_km || "N/A",
    record.drop_km || "N/A",
    record.pickup_location || "N/A",
    record.drop_location || "N/A",
    record.screenshot_filename || "N/A",
    record.status || "pending",
    new Date().toISOString()
  ];
  
  sheet.appendRow(values);
}

function createResponse(success, message, data) {
  data = data || {};
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  for (var key in data) {
    response[key] = data[key];
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function initializeSheetForMonth() {
  const monthYear = "Nov 2025";
  const sheet = getOrCreateSheet(monthYear);
  ensureHeaders(sheet);
  Logger.log("Sheet initialized successfully for " + monthYear);
}

function testSync() {
  const testRecord = {
    id: "test-" + new Date().getTime(),
    driver: "Test Driver",
    platform: "Rapido",
    vehicle: "TN01AB1234",
    date: "15/11/2025",
    time: "10:30 AM",
    description: "Auto",
    amount: "150",
    payment_mode: "Cash",
    distance: "5.2",
    duration: "25",
    pickup_km: "N/A",
    drop_km: "N/A",
    pickup_location: "Anna Nagar",
    drop_location: "T Nagar",
    screenshot_filename: "test_screenshot.jpg",
    status: "pending"
  };
  
  const sheet = getOrCreateSheet("Nov 2025");
  const result = syncRecordsToSheet(sheet, [testRecord]);
  Logger.log("Test sync result: " + JSON.stringify(result));
}

function clearMonthData() {
  const monthYear = "Nov 2025";
  const sheet = getOrCreateSheet(monthYear);
  const lastRow = sheet.getLastRow();
  
  if (lastRow > HEADER_ROW) {
    sheet.deleteRows(HEADER_ROW + 1, lastRow - HEADER_ROW);
    Logger.log("Cleared " + (lastRow - HEADER_ROW) + " rows from " + monthYear);
  } else {
    Logger.log("No data to clear in " + monthYear);
  }
}
