/**
 * NURA PULSE - DRIVER ONBOARDING GOOGLE SHEETS SYNC
 * Updated column mapping as per requirements (Dec 2024)
 * 
 * COLUMN MAPPING:
 * A: ID
 * B: Name  
 * C: Phone Number
 * D: Experience
 * E: Address
 * F: Stage
 * G: Status
 * H: Assigned Telecaller
 * I: Telecaller Notes
 * J: Source
 * K: Import Date
 * L: Last Modified
 */

// ========== CONFIGURATION ==========
var API_BASE_URL = "https://nura-pulse-app.preview.emergentagent.com/api";
var BEARER_TOKEN = "YOUR_TOKEN_HERE"; // Update this with valid token
var LEADS_SHEET_NAME = "Driver Leads";

// Column positions (A=1, B=2, etc.)
var COL = {
  ID: 1,
  NAME: 2,
  PHONE: 3,
  EXPERIENCE: 4,
  ADDRESS: 5,
  STAGE: 6,
  STATUS: 7,
  ASSIGNED_TELECALLER: 8,
  TELECALLER_NOTES: 9,
  SOURCE: 10,
  IMPORT_DATE: 11,
  LAST_MODIFIED: 12
};

// ========== HELPER FUNCTIONS ==========

function makeAPIRequest(endpoint, method, payload) {
  method = method || "GET";
  var url = API_BASE_URL + endpoint;
  
  Logger.log("Making request to: " + url);
  
  var options = {
    method: method,
    headers: {
      "Authorization": "Bearer " + BEARER_TOKEN,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };
  
  if (payload) {
    options.payload = JSON.stringify(payload);
  }
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    Logger.log("Response code: " + responseCode);
    
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else {
      Logger.log("API Error: " + responseCode + " - " + responseText);
      throw new Error("API request failed: " + responseCode);
    }
  } catch (error) {
    Logger.log("Request failed: " + error);
    throw error;
  }
}

function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Set headers according to new mapping
    var headers = [
      "ID",                    // A
      "Name",                  // B
      "Phone Number",          // C
      "Experience",            // D
      "Address",               // E
      "Stage",                 // F
      "Status",                // G
      "Assigned Telecaller",   // H
      "Telecaller Notes",      // I
      "Source",                // J
      "Import Date",           // K
      "Last Modified"          // L
    ];
    
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    
    // Set column widths
    sheet.setColumnWidth(COL.ID, 280);
    sheet.setColumnWidth(COL.NAME, 150);
    sheet.setColumnWidth(COL.PHONE, 120);
    sheet.setColumnWidth(COL.EXPERIENCE, 100);
    sheet.setColumnWidth(COL.ADDRESS, 200);
    sheet.setColumnWidth(COL.STAGE, 120);
    sheet.setColumnWidth(COL.STATUS, 150);
    sheet.setColumnWidth(COL.ASSIGNED_TELECALLER, 150);
    sheet.setColumnWidth(COL.TELECALLER_NOTES, 200);
    sheet.setColumnWidth(COL.SOURCE, 120);
    sheet.setColumnWidth(COL.IMPORT_DATE, 110);
    sheet.setColumnWidth(COL.LAST_MODIFIED, 130);
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

function leadToRow(lead) {
  /**
   * Convert lead object to sheet row according to column mapping
   */
  return [
    lead.id || "",                                // A: ID
    lead.name || "",                              // B: Name
    lead.phone_number || "",                      // C: Phone Number
    lead.experience || "",                        // D: Experience
    lead.current_location || lead.address || "",  // E: Address
    lead.stage || "",                             // F: Stage (e.g., "S1", "S2")
    lead.status || "",                            // G: Status
    lead.assigned_telecaller || "",               // H: Assigned Telecaller
    lead.telecaller_notes || "",                  // I: Telecaller Notes
    lead.source || "",                            // J: Source (e.g., "Facebook", "WhatsApp")
    formatDate(lead.import_date || lead.created_at), // K: Import Date
    formatDate(lead.last_modified)                // L: Last Modified
  ];
}

function formatDate(dateValue) {
  /**
   * Format date to DD-MM-YYYY
   */
  if (!dateValue) return "";
  
  try {
    var date = new Date(dateValue);
    if (isNaN(date.getTime())) return "";
    
    var day = ("0" + date.getDate()).slice(-2);
    var month = ("0" + (date.getMonth() + 1)).slice(-2);
    var year = date.getFullYear();
    
    return day + "-" + month + "-" + year;
  } catch (e) {
    Logger.log("Date format error: " + e);
    return "";
  }
}

function rowToLead(row, rowIndex) {
  /**
   * Convert sheet row to lead object
   */
  return {
    id: row[COL.ID - 1] || "",
    name: row[COL.NAME - 1] || "",
    phone_number: row[COL.PHONE - 1] || "",
    experience: row[COL.EXPERIENCE - 1] || "",
    current_location: row[COL.ADDRESS - 1] || "",
    stage: row[COL.STAGE - 1] || "",
    status: row[COL.STATUS - 1] || "",
    assigned_telecaller: row[COL.ASSIGNED_TELECALLER - 1] || "",
    telecaller_notes: row[COL.TELECALLER_NOTES - 1] || "",
    source: row[COL.SOURCE - 1] || "",
    row_index: rowIndex
  };
}

// ========== SYNC FROM APP TO SHEETS ==========

function doPost(e) {
  /**
   * Webhook endpoint - receives data from backend
   */
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    Logger.log("Received action: " + action);
    
    if (action === "sync_from_app") {
      return syncFromApp(data.leads);
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "Unknown action: " + action })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log("Error in doPost: " + error);
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function syncFromApp(leads) {
  /**
   * Sync leads from app to Google Sheets
   */
  try {
    var sheet = getOrCreateSheet(LEADS_SHEET_NAME);
    
    // Get existing data
    var lastRow = sheet.getLastRow();
    var existingData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, COL.LAST_MODIFIED).getValues() : [];
    
    // Create ID map of existing leads
    var existingIds = {};
    for (var i = 0; i < existingData.length; i++) {
      var id = existingData[i][COL.ID - 1];
      if (id) {
        existingIds[id] = i + 2; // Row number (1-indexed, +1 for header)
      }
    }
    
    var updatedCount = 0;
    var createdCount = 0;
    
    // Process each lead
    for (var i = 0; i < leads.length; i++) {
      var lead = leads[i];
      var rowData = leadToRow(lead);
      var rowNumber = existingIds[lead.id];
      
      if (rowNumber) {
        // Update existing row
        sheet.getRange(rowNumber, 1, 1, rowData.length).setValues([rowData]);
        updatedCount++;
      } else {
        // Append new row
        sheet.appendRow(rowData);
        createdCount++;
      }
    }
    
    Logger.log("Sync complete: " + createdCount + " created, " + updatedCount + " updated");
    
    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        message: "Synced " + leads.length + " leads",
        created: createdCount,
        updated: updatedCount
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log("Sync error: " + error);
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== SYNC FROM SHEETS TO APP ==========

function syncToBackend() {
  /**
   * Manual function: Sync changes from Google Sheets back to app
   * Run this from the script editor or add a button
   */
  try {
    var sheet = getOrCreateSheet(LEADS_SHEET_NAME);
    var lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      Logger.log("No data to sync");
      return;
    }
    
    // Get all data rows
    var data = sheet.getRange(2, 1, lastRow - 1, COL.LAST_MODIFIED).getValues();
    
    var updatedCount = 0;
    var errors = 0;
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var leadId = row[COL.ID - 1];
      
      if (!leadId) continue;
      
      // Prepare update payload (only fields that can be edited in sheets)
      var updateData = {
        stage: row[COL.STAGE - 1] || "",
        status: row[COL.STATUS - 1] || "",
        assigned_telecaller: row[COL.ASSIGNED_TELECALLER - 1] || "",
        telecaller_notes: row[COL.TELECALLER_NOTES - 1] || "",
        source: row[COL.SOURCE - 1] || ""
      };
      
      try {
        var result = makeAPIRequest(
          "/driver-onboarding/leads/" + leadId,
          "PATCH",
          updateData
        );
        updatedCount++;
      } catch (error) {
        Logger.log("Failed to update lead " + leadId + ": " + error);
        errors++;
      }
    }
    
    Logger.log("Sync to backend complete: " + updatedCount + " updated, " + errors + " errors");
    Browser.msgBox("Sync complete: " + updatedCount + " leads updated" + (errors > 0 ? ", " + errors + " errors" : ""));
    
  } catch (error) {
    Logger.log("Error syncing to backend: " + error);
    Browser.msgBox("Error: " + error.toString());
  }
}

// ========== MENU FUNCTIONS ==========

function onOpen() {
  /**
   * Add custom menu when spreadsheet opens
   */
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Nura Pulse')
    .addItem('Sync to Backend', 'syncToBackend')
    .addItem('Setup Sheet', 'setupSheet')
    .addToUi();
}

function setupSheet() {
  /**
   * Initialize the sheet with proper headers and formatting
   */
  getOrCreateSheet(LEADS_SHEET_NAME);
  Browser.msgBox("Sheet setup complete!");
}
