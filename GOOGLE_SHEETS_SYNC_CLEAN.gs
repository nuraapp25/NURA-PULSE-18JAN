/**
 * NURA PULSE - DRIVER ONBOARDING SYNC
 * Google Apps Script for Two-Way Sync
 * 
 * Column Mapping:
 * A: ID | B: Name | C: Phone | D: Experience | E: Address
 * F: Stage | G: Status | H: Telecaller | I: Telecaller Notes
 * J: Notes | K: Import Date | L: Last Modified
 */

// ========== CONFIGURATION ==========
var API_BASE_URL = "https://telemanager-2.preview.emergentagent.com";
var BEARER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTczNTg5MDQwMH0.abc123xyz...";
var LEADS_SHEET_NAME = "Driver Leads";

// Column positions (1-indexed)
var COLUMNS = {
  ID: 1,
  NAME: 2,
  PHONE: 3,
  EXPERIENCE: 4,
  ADDRESS: 5,
  STAGE: 6,
  STATUS: 7,
  TELECALLER: 8,
  TELECALLER_NOTES: 9,
  NOTES: 10,
  IMPORT_DATE: 11,
  LAST_MODIFIED: 12
};

// ========== HELPER FUNCTIONS ==========

function makeAPIRequest(endpoint, method, payload) {
  method = method || "GET";
  var url = API_BASE_URL + "/api" + endpoint;
  
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
    
    var headers = [
      "ID", "Name", "Phone Number", "Experience", "Address",
      "Lead Stage", "Status", "Assigned Telecaller", "Telecaller Notes",
      "Notes", "Import Date", "Last Modified"
    ];
    
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    
    sheet.setColumnWidth(COLUMNS.ID, 250);
    sheet.setColumnWidth(COLUMNS.NAME, 150);
    sheet.setColumnWidth(COLUMNS.PHONE, 120);
    sheet.setColumnWidth(COLUMNS.EXPERIENCE, 100);
    sheet.setColumnWidth(COLUMNS.ADDRESS, 200);
    sheet.setColumnWidth(COLUMNS.STAGE, 80);
    sheet.setColumnWidth(COLUMNS.STATUS, 150);
    sheet.setColumnWidth(COLUMNS.TELECALLER, 120);
    sheet.setColumnWidth(COLUMNS.TELECALLER_NOTES, 200);
    sheet.setColumnWidth(COLUMNS.NOTES, 200);
    sheet.setColumnWidth(COLUMNS.IMPORT_DATE, 100);
    sheet.setColumnWidth(COLUMNS.LAST_MODIFIED, 120);
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

function findRowById(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  
  var idColumn = sheet.getRange(2, COLUMNS.ID, lastRow - 1, 1).getValues();
  
  for (var i = 0; i < idColumn.length; i++) {
    if (idColumn[i][0] === id) {
      return i + 2;
    }
  }
  
  return -1;
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

// ========== MAIN SYNC FUNCTIONS ==========

function syncFromAPI() {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Starting sync from API...", "Driver Leads Sync", 3);
    
    var response = makeAPIRequest("/driver-onboarding/leads");
    var leads = response;
    
    if (!Array.isArray(leads) || leads.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast("No leads found in API", "Sync Complete", 3);
      return;
    }
    
    var sheet = getOrCreateSheet(LEADS_SHEET_NAME);
    
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 12).clearContent();
    }
    
    var rows = [];
    for (var i = 0; i < leads.length; i++) {
      rows.push(leadToRow(leads[i]));
    }
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    applyConditionalFormatting(sheet);
    
    SpreadsheetApp.getActiveSpreadsheet().toast("Synced " + leads.length + " leads from API", "Sync Complete", 5);
    
  } catch (error) {
    Logger.log("Sync from API failed: " + error);
    SpreadsheetApp.getActiveSpreadsheet().toast("Sync failed: " + error, "Error", 5);
  }
}

function onEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    var range = e.range;
    
    if (sheet.getName() !== LEADS_SHEET_NAME) return;
    if (range.getRow() === 1) return;
    
    var row = range.getRow();
    var rowData = sheet.getRange(row, 1, 1, 12).getValues()[0];
    
    var leadId = rowData[COLUMNS.ID - 1];
    if (!leadId) return;
    
    var updatedData = {
      name: rowData[COLUMNS.NAME - 1] || "",
      phone_number: rowData[COLUMNS.PHONE - 1] || "",
      experience: rowData[COLUMNS.EXPERIENCE - 1] || "",
      current_location: rowData[COLUMNS.ADDRESS - 1] || "",
      stage: rowData[COLUMNS.STAGE - 1] || "",
      status: rowData[COLUMNS.STATUS - 1] || "",
      assigned_telecaller: rowData[COLUMNS.TELECALLER - 1] || "",
      telecaller_notes: rowData[COLUMNS.TELECALLER_NOTES - 1] || "",
      notes: rowData[COLUMNS.NOTES - 1] || ""
    };
    
    makeAPIRequest("/driver-onboarding/leads/" + leadId, "PATCH", updatedData);
    
    sheet.getRange(row, COLUMNS.LAST_MODIFIED).setValue(new Date().toISOString());
    
  } catch (error) {
    Logger.log("onEdit sync failed: " + error);
  }
}

function applyConditionalFormatting(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  var statusRange = sheet.getRange(2, COLUMNS.STATUS, lastRow - 1, 1);
  
  sheet.clearConditionalFormatRules();
  
  var rules = [];
  
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("New")
    .setBackground("#fff3cd")
    .setRanges([statusRange])
    .build());
  
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Highly Interested")
    .setBackground("#d4edda")
    .setRanges([statusRange])
    .build());
  
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Not Interested")
    .setBackground("#f8d7da")
    .setRanges([statusRange])
    .build());
  
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("DONE!")
    .setBackground("#28a745")
    .setFontColor("#ffffff")
    .setRanges([statusRange])
    .build());
  
  sheet.setConditionalFormatRules(rules);
}

// ========== MENU & TRIGGERS ==========

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Driver Sync')
    .addItem('Sync from API', 'syncFromAPI')
    .addItem('Setup Auto Sync', 'setupTriggers')
    .addSeparator()
    .addItem('Help', 'showHelp')
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
  
  SpreadsheetApp.getActiveSpreadsheet().toast("Auto-sync enabled! Edits will sync to API automatically.", "Setup Complete", 5);
}

function showHelp() {
  var htmlContent = '<div style="font-family: Arial, sans-serif; padding: 20px;">' +
    '<h2>Nura Pulse Driver Onboarding Sync</h2>' +
    '<h3>Column Mapping:</h3>' +
    '<ul>' +
    '<li><b>A:</b> ID (Auto-generated)</li>' +
    '<li><b>B:</b> Name</li>' +
    '<li><b>C:</b> Phone Number</li>' +
    '<li><b>D:</b> Experience</li>' +
    '<li><b>E:</b> Address</li>' +
    '<li><b>F:</b> Lead Stage (S1/S2/S3/S4)</li>' +
    '<li><b>G:</b> Status</li>' +
    '<li><b>H:</b> Assigned Telecaller</li>' +
    '<li><b>I:</b> Telecaller Notes</li>' +
    '<li><b>J:</b> Notes</li>' +
    '<li><b>K:</b> Import Date</li>' +
    '<li><b>L:</b> Last Modified (Auto-updated)</li>' +
    '</ul>' +
    '<h3>How to Use:</h3>' +
    '<ol>' +
    '<li>Update API_BASE_URL and BEARER_TOKEN in the script</li>' +
    '<li>Run "Setup Auto Sync" from menu</li>' +
    '<li>Run "Sync from API" to pull latest data</li>' +
    '<li>Edit any cell - changes sync automatically!</li>' +
    '</ol>' +
    '</div>';
  
  var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(500)
    .setHeight(400);
  
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Driver Sync Help");
}
