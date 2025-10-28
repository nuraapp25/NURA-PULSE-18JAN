// =============================================================================
// NURA PULSE - DRIVER ONBOARDING TWO-WAY AUTO-SYNC
// Google Apps Script for Google Sheets
// =============================================================================

// ======================== CONFIGURATION ========================
// IMPORTANT: Update these values with your actual URLs
const APP_WEBHOOK_URL = 'https://onboarding-dash.preview.emergentagent.com/api/driver-onboarding/webhook/sync-from-sheets';
const SHEET_NAME = 'Driver Leads'; // Name of the sheet tab with lead data

// Column mapping - adjust if your sheet has different column positions
const COLUMNS = {
  ID: 1,                    // A
  NAME: 2,                  // B
  PHONE_NUMBER: 3,          // C
  VEHICLE: 4,               // D
  DRIVING_LICENSE: 5,       // E
  EXPERIENCE: 6,            // F
  INTERESTED_EV: 7,         // G
  MONTHLY_SALARY: 8,        // H
  CURRENT_LOCATION: 9,      // I
  LEAD_STAGE: 10,           // J
  STATUS: 11,               // K
  DRIVER_READINESS: 12,     // L
  LEAD_SOURCE: 13,          // M
  LEAD_DATE: 14,            // N
  DOCS_COLLECTION: 15,      // O
  CUSTOMER_READINESS: 16,   // P
  ASSIGNED_TELECALLER: 17,  // Q
  TELECALLER_NOTES: 18,     // R
  NOTES: 19,                // S
  IMPORT_DATE: 20,          // T
  CREATED_AT: 21            // U
};

// ======================== MAIN FUNCTIONS ========================

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 Nura Sync')
    .addItem('📤 Push All to App', 'syncAllToApp')
    .addItem('📥 Pull All from App', 'syncAllFromApp')
    .addItem('⚙️ Setup Auto-Sync', 'setupAutoSync')
    .addItem('🔍 Test Connection', 'testConnection')
    .addSeparator()
    .addItem('📊 Sync Status', 'showSyncStatus')
    .addToUi();
  
  // Log that the script is ready
  Logger.log('Nura Pulse Driver Onboarding Sync - Ready');
}

/**
 * AUTO-SYNC TRIGGER: Runs when any cell is edited
 * Syncs changes to the app automatically
 */
function onEdit(e) {
  try {
    // Get the edited range
    const sheet = e.source.getActiveSheet();
    const range = e.range;
    
    // Only sync if edit is in the Driver Leads sheet
    if (sheet.getName() !== SHEET_NAME) {
      return;
    }
    
    // Skip if editing header row
    if (range.getRow() === 1) {
      return;
    }
    
    // Get the entire row that was edited
    const editedRow = range.getRow();
    const rowData = sheet.getRange(editedRow, 1, 1, Object.keys(COLUMNS).length).getValues()[0];
    
    // Convert to lead object
    const lead = rowToLead(rowData);
    
    // Skip empty rows (no phone number)
    if (!lead.phone_number || lead.phone_number === '') {
      return;
    }
    
    Logger.log('Auto-sync triggered for edit in row ' + editedRow);
    
    // Sync this single lead to the app
    syncSingleLeadToApp(lead);
    
  } catch (error) {
    Logger.log('OnEdit error: ' + error.toString());
    // Don't show error to user for auto-sync
  }
}

/**
 * TIME-BASED TRIGGER: Syncs all data every 5 minutes
 * This is a fallback in case onEdit misses some changes
 */
function scheduledSync() {
  try {
    Logger.log('Scheduled sync started at ' + new Date().toISOString());
    syncAllToApp();
  } catch (error) {
    Logger.log('Scheduled sync error: ' + error.toString());
  }
}

/**
 * Webhook receiver for data FROM the app (App → Sheets)
 * Also handles GET requests to trigger sync FROM sheets TO app
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    Logger.log('Received GET request with action: ' + action);
    
    if (action === 'sync_to_app') {
      // Trigger sync from Google Sheets to App (no UI dialogs)
      const success = syncAllToApp(false);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: success,
        message: success ? 'Sync completed from Google Sheets to App' : 'Sync failed'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unknown action. Use ?action=sync_to_app'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('doGet error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log('Received webhook from app: ' + data.action);
    
    if (data.action === 'sync_all') {
      // App is pushing all leads to the sheet
      const leads = data.records || [];
      updateSheetFromApp(leads);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Updated ${leads.length} leads in Google Sheets`
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ======================== SYNC FUNCTIONS ========================

/**
 * MANUAL: Push all leads from Google Sheets to App
 * Can be called manually from menu or programmatically via doGet
 */
function syncAllToApp(showUI) {
  // Default to showing UI if not specified
  if (showUI === undefined) showUI = true;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    if (showUI) SpreadsheetApp.getUi().alert('Error: Sheet "' + SHEET_NAME + '" not found!');
    Logger.log('Error: Sheet not found');
    return false;
  }
  
  // Get all data (skip header row)
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    if (showUI) SpreadsheetApp.getUi().alert('No data to sync. Sheet is empty.');
    Logger.log('No data to sync - sheet is empty');
    return false;
  }
  
  const dataRange = sheet.getRange(2, 1, lastRow - 1, Object.keys(COLUMNS).length);
  const data = dataRange.getValues();
  
  // Convert to lead objects
  const leads = data.map(row => rowToLead(row)).filter(lead => lead.phone_number && lead.phone_number !== '');
  
  if (leads.length === 0) {
    if (showUI) SpreadsheetApp.getUi().alert('No valid leads found (phone number required)');
    Logger.log('No valid leads found');
    return false;
  }
  
  // Send to app
  const payload = {
    action: 'sync_from_sheets',
    leads: leads
  };
  
  try {
    const response = UrlFetchApp.fetch(APP_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      if (showUI) {
        SpreadsheetApp.getUi().alert(
          '✅ Sync Complete!\n\n' +
          'Created: ' + result.created + '\n' +
          'Updated: ' + result.updated + '\n' +
          'Total: ' + result.total_processed
        );
      }
      
      Logger.log('Sync successful: Created ' + result.created + ', Updated ' + result.updated);
      
      // Update last sync time
      const props = PropertiesService.getDocumentProperties();
      props.setProperty('lastSyncToApp', new Date().toISOString());
      
      return true;
    } else {
      throw new Error(result.message || 'Sync failed');
    }
    
  } catch (error) {
    if (showUI) {
      SpreadsheetApp.getUi().alert('❌ Sync Failed!\n\n' + error.toString());
    }
    Logger.log('Sync error: ' + error.toString());
    return false;
  }
}

/**
 * MANUAL: Pull all leads from App to Google Sheets
 */
function syncAllFromApp() {
  try {
    // Get backend URL (remove webhook path, add /leads)
    const baseUrl = APP_WEBHOOK_URL.replace('/webhook/sync-from-sheets', '');
    const leadsUrl = baseUrl + '/leads';
    
    // Fetch leads from app
    const response = UrlFetchApp.fetch(leadsUrl, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // User needs to add their token
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error('Failed to fetch leads from app. Status: ' + response.getResponseCode());
    }
    
    const leads = JSON.parse(response.getContentText());
    updateSheetFromApp(leads);
    
    SpreadsheetApp.getUi().alert('✅ Pulled ' + leads.length + ' leads from app!');
    
    // Update last sync time
    const props = PropertiesService.getDocumentProperties();
    props.setProperty('lastSyncFromApp', new Date().toISOString());
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Pull Failed!\n\n' + error.toString() + '\n\nNote: You may need to add your auth token in the script.');
    Logger.log('Pull error: ' + error.toString());
  }
}

/**
 * Sync a single lead to the app (used by onEdit trigger)
 */
function syncSingleLeadToApp(lead) {
  const payload = {
    action: 'sync_from_sheets',
    leads: [lead]
  };
  
  try {
    UrlFetchApp.fetch(APP_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    Logger.log('Synced single lead: ' + lead.phone_number);
  } catch (error) {
    Logger.log('Single lead sync error: ' + error.toString());
  }
}

/**
 * Update Google Sheet with leads from the app
 */
function updateSheetFromApp(leads) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    // Create sheet if it doesn't exist
    sheet = ss.insertSheet(SHEET_NAME);
    
    // Add headers
    const headers = [
      'ID', 'Name', 'Phone Number', 'Vehicle', 'Driving License', 
      'Experience', 'Interested EV', 'Monthly Salary', 'Current Location',
      'Lead Stage', 'Status', 'Driver Readiness', 'Lead Source', 'Lead Date',
      'Docs Collection', 'Customer Readiness', 'Assigned Telecaller', 
      'Telecaller Notes', 'Notes', 'Import Date', 'Created At'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  // Clear existing data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Object.keys(COLUMNS).length).clearContent();
  }
  
  // Convert leads to rows
  const rows = leads.map(lead => leadToRow(lead));
  
  // Write to sheet
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, Object.keys(COLUMNS).length).setValues(rows);
  }
  
  Logger.log('Updated sheet with ' + leads.length + ' leads');
}

// ======================== HELPER FUNCTIONS ========================

/**
 * Convert a sheet row to a lead object
 */
function rowToLead(row) {
  // Get ID from sheet, or generate a new one if empty
  let leadId = row[COLUMNS.ID - 1] || '';
  
  // Clean up the ID (remove any whitespace)
  if (leadId) {
    leadId = String(leadId).trim();
  }
  
  return {
    id: leadId,
    name: row[COLUMNS.NAME - 1] || '',
    phone_number: row[COLUMNS.PHONE_NUMBER - 1] || '',
    vehicle: row[COLUMNS.VEHICLE - 1] || null,
    driving_license: row[COLUMNS.DRIVING_LICENSE - 1] || null,
    experience: row[COLUMNS.EXPERIENCE - 1] || null,
    interested_ev: row[COLUMNS.INTERESTED_EV - 1] || null,
    monthly_salary: row[COLUMNS.MONTHLY_SALARY - 1] || null,
    current_location: row[COLUMNS.CURRENT_LOCATION - 1] || null,
    lead_stage: row[COLUMNS.LEAD_STAGE - 1] || 'New',
    status: row[COLUMNS.STATUS - 1] || 'New',
    driver_readiness: row[COLUMNS.DRIVER_READINESS - 1] || 'Not Started',
    lead_source: row[COLUMNS.LEAD_SOURCE - 1] || null,
    lead_date: row[COLUMNS.LEAD_DATE - 1] || null,
    docs_collection: row[COLUMNS.DOCS_COLLECTION - 1] || 'Pending',
    customer_readiness: row[COLUMNS.CUSTOMER_READINESS - 1] || 'Not Ready',
    assigned_telecaller: row[COLUMNS.ASSIGNED_TELECALLER - 1] || null,
    telecaller_notes: row[COLUMNS.TELECALLER_NOTES - 1] || null,
    notes: row[COLUMNS.NOTES - 1] || null,
    import_date: row[COLUMNS.IMPORT_DATE - 1] || '',
    created_at: row[COLUMNS.CREATED_AT - 1] || ''
  };
}

/**
 * Convert a lead object to a sheet row
 */
function leadToRow(lead) {
  return [
    lead.id || '',
    lead.name || '',
    lead.phone_number || '',
    lead.vehicle || '',
    lead.driving_license || '',
    lead.experience || '',
    lead.interested_ev || '',
    lead.monthly_salary || '',
    lead.current_location || '',
    lead.lead_stage || 'New',
    lead.status || 'New',
    lead.driver_readiness || 'Not Started',
    lead.lead_source || '',
    lead.lead_date || '',
    lead.docs_collection || 'Pending',
    lead.customer_readiness || 'Not Ready',
    lead.assigned_telecaller || '',
    lead.telecaller_notes || '',
    lead.notes || '',
    lead.import_date || '',
    lead.created_at || ''
  ];
}

// ======================== SETUP & TESTING ========================

/**
 * Setup automatic sync triggers
 */
function setupAutoSync() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '⚙️ Setup Auto-Sync',
    'This will create a trigger to automatically sync every 5 minutes.\n\n' +
    'The onEdit trigger is already active for real-time sync.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (result === ui.Button.YES) {
    try {
      // Delete existing triggers for this function
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'scheduledSync') {
          ScriptApp.deleteTrigger(trigger);
        }
      });
      
      // Create new time-based trigger (every 5 minutes)
      ScriptApp.newTrigger('scheduledSync')
        .timeBased()
        .everyMinutes(5)
        .create();
      
      ui.alert('✅ Auto-sync setup complete!\n\n' +
               '• Real-time sync: Active (onEdit)\n' +
               '• Scheduled sync: Every 5 minutes\n\n' +
               'Your sheet will now sync automatically!');
    } catch (error) {
      ui.alert('❌ Setup failed: ' + error.toString());
    }
  }
}

/**
 * Test connection to the app
 */
function testConnection() {
  try {
    const testPayload = {
      action: 'sync_from_sheets',
      leads: []
    };
    
    const response = UrlFetchApp.fetch(APP_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      SpreadsheetApp.getUi().alert('✅ Connection Test Successful!\n\nApp is reachable and responding correctly.');
    } else {
      SpreadsheetApp.getUi().alert('⚠️ Connection established but got error:\n\n' + result.message);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Connection Test Failed!\n\n' + error.toString());
  }
}

/**
 * Show sync status
 */
function showSyncStatus() {
  const props = PropertiesService.getDocumentProperties();
  const lastSyncToApp = props.getProperty('lastSyncToApp') || 'Never';
  const lastSyncFromApp = props.getProperty('lastSyncFromApp') || 'Never';
  
  // Check if scheduled trigger is active
  const triggers = ScriptApp.getProjectTriggers();
  const hasScheduledTrigger = triggers.some(t => t.getHandlerFunction() === 'scheduledSync');
  
  SpreadsheetApp.getUi().alert(
    '📊 Sync Status\n\n' +
    'Last sync TO app: ' + lastSyncToApp + '\n' +
    'Last sync FROM app: ' + lastSyncFromApp + '\n\n' +
    'Auto-sync (scheduled): ' + (hasScheduledTrigger ? '✅ Active' : '❌ Inactive') + '\n' +
    'Auto-sync (onEdit): ✅ Always Active\n\n' +
    'App Webhook: ' + APP_WEBHOOK_URL
  );
}
