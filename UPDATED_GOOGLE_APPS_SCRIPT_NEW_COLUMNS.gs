// =============================================================================
// NURA PULSE - DRIVER ONBOARDING TWO-WAY AUTO-SYNC (UPDATED STRUCTURE)
// Google Apps Script for Google Sheets
// =============================================================================

// ======================== CONFIGURATION ========================
const APP_WEBHOOK_URL = 'https://qr-campaign-fix.preview.emergentagent.com/api/driver-onboarding/webhook/sync-from-sheets';
const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzQ140LA9tY1iUtiaj0mlNfNna2hiLe5sVZNZ_yfeQhjQVheJqOCc6aciRpF3JQKQ/exec';
const SHEET_NAME = 'Driver Leads';

// NEW Column mapping - Updated structure
const COLUMNS = {
  ID: 1,                      // A - ID
  NAME: 2,                    // B - Name
  PHONE_NUMBER: 3,            // C - Phone Number
  VEHICLE: 4,                 // D - Vehicle
  DRIVING_LICENSE: 5,         // E - Driving License
  EXPERIENCE: 6,              // F - Experience
  INTERESTED_EV: 7,           // G - Interested EV
  MONTHLY_SALARY: 8,          // H - Monthly Salary
  CURRENT_LOCATION: 9,        // I - Current Location
  LEAD_SOURCE: 10,            // J - Lead Source (moved from column 13)
  STAGE: 11,                  // K - Stage (renamed from Lead Stage)
  STATUS: 12,                 // L - Status
  ASSIGNED_TELECALLER: 13,    // M - Assigned Telecaller
  TELECALLER_NOTES: 14,       // N - Telecaller Notes
  NOTES: 15,                  // O - Notes
  IMPORT_DATE: 16,            // P - Import Date
  CREATED_AT: 17,             // Q - Created At
  DL_NO: 18,                  // R - DL No.
  BADGE_NO: 19,               // S - Badge No.
  AADHAR_CARD: 20,            // T - Aadhar card
  PAN_CARD: 21,               // U - Pan card
  GAS_BILL: 22,               // V - Gas bill
  BANK_PASSBOOK: 23,          // W - Bank passbook
  PREFERRED_SHIFT: 24,        // X - preferred shift
  ALLOTTED_SHIFT: 25,         // Y - alotted shift
  DEFAULT_VEHICLE: 26,        // Z - Default Vehicle
  END_DATE: 28,               // AB - End Date (skipping duplicate columns)
};

// ======================== MAIN FUNCTIONS ========================

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
  
  Logger.log('Nura Pulse Driver Onboarding Sync - Ready (Updated Structure)');
}

function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    const range = e.range;
    
    if (sheet.getName() !== SHEET_NAME) {
      return;
    }
    
    if (range.getRow() === 1) {
      return;
    }
    
    const editedRow = range.getRow();
    const lastCol = Math.max(...Object.values(COLUMNS));
    const rowData = sheet.getRange(editedRow, 1, 1, lastCol).getValues()[0];
    const lead = rowToLead(rowData);
    
    if (!lead.phone_number || lead.phone_number === '') {
      return;
    }
    
    Logger.log('Auto-sync triggered for edit in row ' + editedRow);
    syncSingleLeadToApp(lead);
    
  } catch (error) {
    Logger.log('OnEdit error: ' + error.toString());
  }
}

function scheduledSync() {
  try {
    Logger.log('Scheduled sync started at ' + new Date().toISOString());
    syncAllToApp(false);
  } catch (error) {
    Logger.log('Scheduled sync error: ' + error.toString());
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    Logger.log('Received GET request with action: ' + action);
    
    if (action === 'sync_to_app') {
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

function syncAllToApp(showUI) {
  if (showUI === undefined) showUI = true;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    if (showUI) SpreadsheetApp.getUi().alert('Error: Sheet "' + SHEET_NAME + '" not found!');
    Logger.log('Error: Sheet not found');
    return false;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    if (showUI) SpreadsheetApp.getUi().alert('No data to sync. Sheet is empty.');
    Logger.log('No data to sync - sheet is empty');
    return false;
  }
  
  const lastCol = Math.max(...Object.values(COLUMNS));
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const data = dataRange.getValues();
  
  const leads = data.map(row => rowToLead(row)).filter(lead => lead.phone_number && lead.phone_number !== '');
  
  if (leads.length === 0) {
    if (showUI) SpreadsheetApp.getUi().alert('No valid leads found (phone number required)');
    Logger.log('No valid leads found');
    return false;
  }
  
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

function syncAllFromApp() {
  try {
    const baseUrl = APP_WEBHOOK_URL.replace('/webhook/sync-from-sheets', '');
    const leadsUrl = baseUrl + '/leads';
    
    const response = UrlFetchApp.fetch(leadsUrl, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error('Failed to fetch leads from app. Status: ' + response.getResponseCode());
    }
    
    const leads = JSON.parse(response.getContentText());
    updateSheetFromApp(leads);
    
    SpreadsheetApp.getUi().alert('✅ Pulled ' + leads.length + ' leads from app!');
    
    const props = PropertiesService.getDocumentProperties();
    props.setProperty('lastSyncFromApp', new Date().toISOString());
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Pull Failed!\n\n' + error.toString());
    Logger.log('Pull error: ' + error.toString());
  }
}

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

function updateSheetFromApp(leads) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    
    const headers = [
      'ID', 'Name', 'Phone Number', 'Vehicle', 'Driving License', 
      'Experience', 'Interested EV', 'Monthly Salary', 'Current Location',
      'Lead Source', 'Stage', 'Status', 'Assigned Telecaller', 
      'Telecaller Notes', 'Notes', 'Import Date', 'Created At',
      'DL No.', 'Badge No.', 'Aadhar card', 'Pan card', 'Gas bill', 
      'Bank passbook', 'preferred shift', 'alotted shift', 'Default Vehicle',
      'Default Vehicle', 'End Date', 'Status'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(...Object.values(COLUMNS));
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
  
  const rows = leads.map(lead => leadToRow(lead));
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, lastCol).setValues(rows);
  }
  
  Logger.log('Updated sheet with ' + leads.length + ' leads');
}

// ======================== HELPER FUNCTIONS ========================

function rowToLead(row) {
  let leadId = row[COLUMNS.ID - 1] || '';
  
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
    lead_source: row[COLUMNS.LEAD_SOURCE - 1] || null,
    stage: row[COLUMNS.STAGE - 1] || 'New',
    status: row[COLUMNS.STATUS - 1] || 'New',
    assigned_telecaller: row[COLUMNS.ASSIGNED_TELECALLER - 1] || null,
    telecaller_notes: row[COLUMNS.TELECALLER_NOTES - 1] || null,
    notes: row[COLUMNS.NOTES - 1] || null,
    import_date: row[COLUMNS.IMPORT_DATE - 1] || '',
    created_at: row[COLUMNS.CREATED_AT - 1] || '',
    dl_no: row[COLUMNS.DL_NO - 1] || null,
    badge_no: row[COLUMNS.BADGE_NO - 1] || null,
    aadhar_card: row[COLUMNS.AADHAR_CARD - 1] || null,
    pan_card: row[COLUMNS.PAN_CARD - 1] || null,
    gas_bill: row[COLUMNS.GAS_BILL - 1] || null,
    bank_passbook: row[COLUMNS.BANK_PASSBOOK - 1] || null,
    preferred_shift: row[COLUMNS.PREFERRED_SHIFT - 1] || null,
    allotted_shift: row[COLUMNS.ALLOTTED_SHIFT - 1] || null,
    default_vehicle: row[COLUMNS.DEFAULT_VEHICLE - 1] || null,
    end_date: row[COLUMNS.END_DATE - 1] || null
  };
}

function leadToRow(lead) {
  const row = new Array(Math.max(...Object.values(COLUMNS))).fill('');
  
  row[COLUMNS.ID - 1] = lead.id || '';
  row[COLUMNS.NAME - 1] = lead.name || '';
  row[COLUMNS.PHONE_NUMBER - 1] = lead.phone_number || '';
  row[COLUMNS.VEHICLE - 1] = lead.vehicle || '';
  row[COLUMNS.DRIVING_LICENSE - 1] = lead.driving_license || '';
  row[COLUMNS.EXPERIENCE - 1] = lead.experience || '';
  row[COLUMNS.INTERESTED_EV - 1] = lead.interested_ev || '';
  row[COLUMNS.MONTHLY_SALARY - 1] = lead.monthly_salary || '';
  row[COLUMNS.CURRENT_LOCATION - 1] = lead.current_location || '';
  row[COLUMNS.LEAD_SOURCE - 1] = lead.lead_source || '';
  row[COLUMNS.STAGE - 1] = lead.stage || 'New';
  row[COLUMNS.STATUS - 1] = lead.status || 'New';
  row[COLUMNS.ASSIGNED_TELECALLER - 1] = lead.assigned_telecaller || '';
  row[COLUMNS.TELECALLER_NOTES - 1] = lead.telecaller_notes || '';
  row[COLUMNS.NOTES - 1] = lead.notes || '';
  row[COLUMNS.IMPORT_DATE - 1] = lead.import_date || '';
  row[COLUMNS.CREATED_AT - 1] = lead.created_at || '';
  row[COLUMNS.DL_NO - 1] = lead.dl_no || '';
  row[COLUMNS.BADGE_NO - 1] = lead.badge_no || '';
  row[COLUMNS.AADHAR_CARD - 1] = lead.aadhar_card || '';
  row[COLUMNS.PAN_CARD - 1] = lead.pan_card || '';
  row[COLUMNS.GAS_BILL - 1] = lead.gas_bill || '';
  row[COLUMNS.BANK_PASSBOOK - 1] = lead.bank_passbook || '';
  row[COLUMNS.PREFERRED_SHIFT - 1] = lead.preferred_shift || '';
  row[COLUMNS.ALLOTTED_SHIFT - 1] = lead.allotted_shift || '';
  row[COLUMNS.DEFAULT_VEHICLE - 1] = lead.default_vehicle || '';
  row[COLUMNS.END_DATE - 1] = lead.end_date || '';
  
  return row;
}

// ======================== SETUP & TESTING ========================

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
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'scheduledSync') {
          ScriptApp.deleteTrigger(trigger);
        }
      });
      
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

function showSyncStatus() {
  const props = PropertiesService.getDocumentProperties();
  const lastSyncToApp = props.getProperty('lastSyncToApp') || 'Never';
  const lastSyncFromApp = props.getProperty('lastSyncFromApp') || 'Never';
  
  const triggers = ScriptApp.getProjectTriggers();
  const hasScheduledTrigger = triggers.some(t => t.getHandlerFunction() === 'scheduledSync');
  
  SpreadsheetApp.getUi().alert(
    '📊 Sync Status (Updated Structure)\n\n' +
    'Last sync TO app: ' + lastSyncToApp + '\n' +
    'Last sync FROM app: ' + lastSyncFromApp + '\n\n' +
    'Auto-sync (scheduled): ' + (hasScheduledTrigger ? '✅ Active' : '❌ Inactive') + '\n' +
    'Auto-sync (onEdit): ✅ Always Active\n\n' +
    'App Webhook: ' + APP_WEBHOOK_URL + '\n' +
    'Google Sheets Web App: ' + GOOGLE_SHEETS_WEB_APP_URL
  );
}
