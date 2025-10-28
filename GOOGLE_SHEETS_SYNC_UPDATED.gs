/**
 * ========================================
 * NURA PULSE - DRIVER ONBOARDING SYNC
 * Updated Google Apps Script
 * ========================================
 * 
 * Column Mapping:
 * Column A: ID
 * Column B: Name
 * Column C: Phone Number
 * Column D: Experience
 * Column E: Address (Current Location)
 * Column F: Lead Stage (Stage: S1, S2, S3, S4)
 * Column G: Status
 * Column H: Assigned Telecaller
 * Column I: Telecaller Notes
 * Column J: Notes
 * Column K: Import Date
 * Column L: Last Modified
 */

// ========== CONFIGURATION (UPDATE THESE) ==========
const API_BASE_URL = "YOUR_BACKEND_URL_HERE"; // e.g., "https://your-app.emergentagent.com"
const BEARER_TOKEN = "YOUR_TOKEN_HERE"; // Get from browser localStorage after login

// Sheet names
const LEADS_SHEET_NAME = "Driver Leads";

// Column positions (1-indexed)
const COLUMNS = {
  ID: 1,             // A
  NAME: 2,           // B
  PHONE: 3,          // C
  EXPERIENCE: 4,     // D
  ADDRESS: 5,        // E
  STAGE: 6,          // F
  STATUS: 7,         // G
  TELECALLER: 8,     // H
  TELECALLER_NOTES: 9, // I
  NOTES: 10,         // J
  IMPORT_DATE: 11,   // K
  LAST_MODIFIED: 12  // L
};

// ========== HELPER FUNCTIONS ==========

/**
 * Make authenticated API request
 */
function makeAPIRequest(endpoint, method = "GET", payload = null) {
  const url = `${API_BASE_URL}/api${endpoint}`;
  
  const options = {
    method: method,
    headers: {
      "Authorization": `Bearer ${BEARER_TOKEN}`,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };
  
  if (payload) {
    options.payload = JSON.stringify(payload);
  }
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else {
      Logger.log(`API Error: ${responseCode} - ${responseText}`);
      throw new Error(`API request failed: ${responseCode}`);
    }
  } catch (error) {
    Logger.log(`Request failed: ${error}`);
    throw error;
  }
}

/**
 * Get or create sheet with headers
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Set up headers with proper styling
    const headers = [
      "ID", "Name", "Phone Number", "Experience", "Address",
      "Lead Stage", "Status", "Assigned Telecaller", "Telecaller Notes",
      "Notes", "Import Date", "Last Modified"
    ];
    
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    
    // Set column widths
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
    
    // Freeze header row
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Find row by ID
 */
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  
  const idColumn = sheet.getRange(2, COLUMNS.ID, lastRow - 1, 1).getValues();
  
  for (let i = 0; i < idColumn.length; i++) {
    if (idColumn[i][0] === id) {
      return i + 2; // +2 because array is 0-indexed and we start from row 2
    }
  }
  
  return -1;
}

/**
 * Convert lead object to row array
 */
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

/**
 * Full sync from API to Sheets
 */
function syncFromAPI() {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Starting sync from API...", "Driver Leads Sync", 3);
    
    // Fetch all leads from API
    const response = makeAPIRequest("/driver-onboarding/leads");
    const leads = response;
    
    if (!Array.isArray(leads) || leads.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast("No leads found in API", "Sync Complete", 3);
      return;
    }
    
    // Get or create sheet
    const sheet = getOrCreateSheet(LEADS_SHEET_NAME);
    
    // Clear existing data (except headers)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, Object.keys(COLUMNS).length).clearContent();
    }
    
    // Write all leads
    const rows = leads.map(lead => leadToRow(lead));
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    // Apply conditional formatting for status
    applyConditionalFormatting(sheet);
    
    SpreadsheetApp.getActiveSpreadsheet().toast(`Synced ${leads.length} leads from API`, "Sync Complete", 5);
    
  } catch (error) {
    Logger.log(`Sync from API failed: ${error}`);
    SpreadsheetApp.getActiveSpreadsheet().toast(`Sync failed: ${error}`, "Error", 5);
  }
}

/**
 * Sync single row to API when edited
 */
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    const range = e.range;
    
    // Only process edits in Driver Leads sheet
    if (sheet.getName() !== LEADS_SHEET_NAME) return;
    
    // Ignore header row
    if (range.getRow() === 1) return;
    
    // Get the edited row
    const row = range.getRow();
    const rowData = sheet.getRange(row, 1, 1, Object.keys(COLUMNS).length).getValues()[0];
    
    // Get lead ID
    const leadId = rowData[COLUMNS.ID - 1];
    if (!leadId) return;
    
    // Prepare update payload with only the fields we're syncing
    const updatedData = {
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
    
    // Send update to API
    makeAPIRequest(`/driver-onboarding/leads/${leadId}`, "PATCH", updatedData);
    
    // Update last_modified in sheet
    sheet.getRange(row, COLUMNS.LAST_MODIFIED).setValue(new Date().toISOString());
    
  } catch (error) {
    Logger.log(`onEdit sync failed: ${error}`);
  }
}

/**
 * Apply conditional formatting based on status
 */
function applyConditionalFormatting(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const statusRange = sheet.getRange(2, COLUMNS.STATUS, lastRow - 1, 1);
  
  // Clear existing rules
  sheet.clearConditionalFormatRules();
  
  const rules = [];
  
  // New - Yellow
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("New")
    .setBackground("#fff3cd")
    .setRanges([statusRange])
    .build());
  
  // Highly Interested - Green
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Highly Interested")
    .setBackground("#d4edda")
    .setRanges([statusRange])
    .build());
  
  // Not Interested - Red
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Not Interested")
    .setBackground("#f8d7da")
    .setRanges([statusRange])
    .build());
  
  // DONE! - Dark Green
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("DONE!")
    .setBackground("#28a745")
    .setFontColor("#ffffff")
    .setRanges([statusRange])
    .build());
  
  sheet.setConditionalFormatRules(rules);
}

// ========== MENU & TRIGGERS ==========

/**
 * Create custom menu on open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚗 Driver Sync')
    .addItem('📥 Sync from API', 'syncFromAPI')
    .addItem('⚙️ Setup Auto Sync', 'setupTriggers')
    .addSeparator()
    .addItem('📚 Help', 'showHelp')
    .addToUi();
}

/**
 * Setup automatic sync triggers
 */
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new trigger for onEdit
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  
  SpreadsheetApp.getActiveSpreadsheet().toast("Auto-sync enabled! Edits will sync to API automatically.", "Setup Complete", 5);
}

/**
 * Show help dialog
 */
function showHelp() {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>📋 Nura Pulse Driver Onboarding Sync</h2>
      <h3>Column Mapping:</h3>
      <ul>
        <li><b>A:</b> ID (Auto-generated)</li>
        <li><b>B:</b> Name</li>
        <li><b>C:</b> Phone Number</li>
        <li><b>D:</b> Experience</li>
        <li><b>E:</b> Address</li>
        <li><b>F:</b> Lead Stage (S1/S2/S3/S4)</li>
        <li><b>G:</b> Status</li>
        <li><b>H:</b> Assigned Telecaller</li>
        <li><b>I:</b> Telecaller Notes</li>
        <li><b>J:</b> Notes</li>
        <li><b>K:</b> Import Date</li>
        <li><b>L:</b> Last Modified (Auto-updated)</li>
      </ul>
      <h3>How to Use:</h3>
      <ol>
        <li>Update API_BASE_URL and BEARER_TOKEN in the script</li>
        <li>Run "Setup Auto Sync" from menu</li>
        <li>Run "Sync from API" to pull latest data</li>
        <li>Edit any cell - changes sync automatically!</li>
      </ol>
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(500)
    .setHeight(400);
  
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Driver Sync Help");
}
