/**
 * NURA PULSE - DRIVER ONBOARDING SYNC
 * WORKING VERSION - DNS Error Fixed
 */

// ========== CONFIGURATION ==========
var API_BASE_URL = "https://driver-onboard-4.preview.emergentagent.com";
var BEARER_TOKEN = "YOUR_TOKEN_HERE";
var LEADS_SHEET_NAME = "Driver Leads";

var COLUMNS = {
  ID: 1, NAME: 2, PHONE: 3, EXPERIENCE: 4, ADDRESS: 5,
  STAGE: 6, STATUS: 7, TELECALLER: 8, TELECALLER_NOTES: 9,
  NOTES: 10, IMPORT_DATE: 11, LAST_MODIFIED: 12
};

// ========== API FUNCTION (FIXED) ==========

function makeAPIRequest(endpoint, method, payload) {
  // Validate inputs
  if (!endpoint || endpoint === "undefined") {
    throw new Error("Endpoint is required and cannot be undefined");
  }
  
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is not configured");
  }
  
  if (!BEARER_TOKEN || BEARER_TOKEN === "YOUR_TOKEN_HERE") {
    throw new Error("BEARER_TOKEN is not configured. Please update it in the script.");
  }
  
  method = method || "GET";
  
  // Build URL properly
  var url = API_BASE_URL + endpoint;
  
  Logger.log("=== API Request ===");
  Logger.log("URL: " + url);
  Logger.log("Method: " + method);
  
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
    
    Logger.log("Response Code: " + responseCode);
    
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else {
      Logger.log("Error Response: " + responseText);
      throw new Error("API Error " + responseCode + ": " + responseText);
    }
  } catch (error) {
    Logger.log("Request Exception: " + error.toString());
    throw error;
  }
}

// ========== SHEET SETUP ==========

function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    var headers = [
      "ID", "Name", "Phone Number", "Experience", "Address",
      "Lead Stage", "Status", "Assigned Telecaller", "Telecaller Notes",
      "Notes", "Import Date", "Last Modified"
    ];
    
    sheet.getRange(1, 1, 1, 12).setValues([headers]);
    sheet.getRange(1, 1, 1, 12).setFontWeight("bold");
    sheet.getRange(1, 1, 1, 12).setBackground("#4285f4");
    sheet.getRange(1, 1, 1, 12).setFontColor("#ffffff");
    
    sheet.setColumnWidth(1, 250);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 100);
    sheet.setColumnWidth(5, 200);
    sheet.setColumnWidth(6, 80);
    sheet.setColumnWidth(7, 150);
    sheet.setColumnWidth(8, 120);
    sheet.setColumnWidth(9, 200);
    sheet.setColumnWidth(10, 200);
    sheet.setColumnWidth(11, 100);
    sheet.setColumnWidth(12, 120);
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

function leadToRow(lead) {
  return [
    lead.id || "",
    lead.name || "",
    lead.phone_number || "",
    lead.experience || "",
    lead.current_location || lead.address || "",
    lead.stage || "",
    lead.status || "",
    lead.assigned_telecaller || "",
    lead.telecaller_notes || "",
    lead.notes || "",
    lead.import_date || "",
    lead.last_modified || lead.created_at || ""
  ];
}

// ========== MAIN SYNC ==========

function syncFromAPI() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    ss.toast("Starting sync...", "Driver Sync", 3);
    
    // Call API with explicit endpoint
    var endpoint = "/api/driver-onboarding/leads";
    Logger.log("Calling syncFromAPI with endpoint: " + endpoint);
    
    var leads = makeAPIRequest(endpoint, "GET", null);
    
    if (!leads || !Array.isArray(leads)) {
      ss.toast("Invalid response from API", "Error", 5);
      return;
    }
    
    Logger.log("Received " + leads.length + " leads");
    
    if (leads.length === 0) {
      ss.toast("No leads found", "Sync Complete", 3);
      return;
    }
    
    var sheet = getOrCreateSheet(LEADS_SHEET_NAME);
    
    // Clear existing data
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 12).clearContent();
    }
    
    // Convert leads to rows
    var rows = [];
    for (var i = 0; i < leads.length; i++) {
      rows.push(leadToRow(leads[i]));
    }
    
    // Write to sheet
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 12).setValues(rows);
    }
    
    // Apply formatting
    applyConditionalFormatting(sheet);
    
    ss.toast("Successfully synced " + leads.length + " leads!", "Sync Complete", 5);
    
  } catch (error) {
    Logger.log("Sync Error: " + error.toString());
    ss.toast("Sync failed: " + error.toString(), "Error", 10);
  }
}

// ========== EDIT SYNC ==========

function onEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    
    if (sheet.getName() !== LEADS_SHEET_NAME) return;
    if (e.range.getRow() === 1) return;
    
    var row = e.range.getRow();
    var rowData = sheet.getRange(row, 1, 1, 12).getValues()[0];
    
    var leadId = rowData[0];
    if (!leadId) return;
    
    var updatedData = {
      name: rowData[1] || "",
      phone_number: rowData[2] || "",
      experience: rowData[3] || "",
      current_location: rowData[4] || "",
      stage: rowData[5] || "",
      status: rowData[6] || "",
      assigned_telecaller: rowData[7] || "",
      telecaller_notes: rowData[8] || "",
      notes: rowData[9] || ""
    };
    
    var endpoint = "/api/driver-onboarding/leads/" + leadId;
    makeAPIRequest(endpoint, "PATCH", updatedData);
    
    sheet.getRange(row, 12).setValue(new Date().toISOString());
    
  } catch (error) {
    Logger.log("Edit sync failed: " + error.toString());
  }
}

// ========== FORMATTING ==========

function applyConditionalFormatting(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  var statusRange = sheet.getRange(2, 7, lastRow - 1, 1);
  sheet.clearConditionalFormatRules();
  
  var rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("New")
      .setBackground("#fff3cd")
      .setRanges([statusRange])
      .build(),
    
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Highly Interested")
      .setBackground("#d4edda")
      .setRanges([statusRange])
      .build(),
    
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Not Interested")
      .setBackground("#f8d7da")
      .setRanges([statusRange])
      .build(),
    
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("DONE!")
      .setBackground("#28a745")
      .setFontColor("#ffffff")
      .setRanges([statusRange])
      .build()
  ];
  
  sheet.setConditionalFormatRules(rules);
}

// ========== MENU ==========

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Driver Sync')
    .addItem('Sync from API', 'syncFromAPI')
    .addItem('Setup Auto Sync', 'setupTriggers')
    .addItem('Test Connection', 'testConnection')
    .addItem('View Logs', 'viewLogs')
    .addToUi();
}

function setupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  
  SpreadsheetApp.getActiveSpreadsheet().toast("Auto-sync enabled!", "Setup Complete", 5);
}

function testConnection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    ss.toast("Testing connection...", "Test", 3);
    
    if (!BEARER_TOKEN || BEARER_TOKEN === "YOUR_TOKEN_HERE") {
      ss.toast("Please update BEARER_TOKEN in the script!", "Error", 10);
      return;
    }
    
    var endpoint = "/api/driver-onboarding/leads";
    var leads = makeAPIRequest(endpoint, "GET", null);
    
    if (Array.isArray(leads)) {
      ss.toast("SUCCESS! Found " + leads.length + " leads. Ready to sync.", "Test Passed", 5);
    } else {
      ss.toast("Connection OK but unexpected response", "Warning", 5);
    }
    
  } catch (error) {
    ss.toast("Connection failed: " + error.toString(), "Test Failed", 10);
  }
}

function viewLogs() {
  var logs = Logger.getLog();
  var ui = SpreadsheetApp.getUi();
  ui.alert("Execution Logs", logs || "No logs available", ui.ButtonSet.OK);
}
