// ==================== CONFIGURATION ====================
const CONFIG = {
  BACKEND_URL: "YOUR_BACKEND_URL_HERE",  // Replace with your actual backend URL (e.g., https://driverhub-9.preview.emergentagent.com/api)
  SHEET_NAME: "Driver Leads",
  COLUMN_MAPPING: {
    ID: "A",
    NAME: "B",
    PHONE_NUMBER: "C",
    VEHICLE: "D",
    DRIVING_LICENSE: "E",
    EXPERIENCE: "F",
    INTERESTED_EV: "G",
    MONTHLY_SALARY: "H",
    CURRENT_LOCATION: "I",
    LEAD_SOURCE: "J",
    STAGE: "K",
    STATUS: "L",
    ASSIGNED_TELECALLER: "M",
    TELECALLER_NOTES: "N",
    NOTES: "O",
    IMPORT_DATE: "P",
    CREATED_AT: "Q",
    DL_NO: "R",
    BADGE_NO: "S",
    AADHAR_CARD: "T",
    PAN_CARD: "U",
    GAS_BILL: "V",
    BANK_PASSBOOK: "W",
    PREFERRED_SHIFT: "X",
    ALLOTTED_SHIFT: "Y",
    DEFAULT_VEHICLE: "Z",
    DEFAULT_VEHICLE_END_DATE: "AA",
    STATUS_FINAL: "AB"
  }
};

// ==================== WEB APP ENDPOINT ====================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log("Received webhook data: " + JSON.stringify(data));
    
    if (data.action === "sync_from_app") {
      return syncFromApp(data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Unknown action"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log("Error in doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== SYNC FROM APP TO SHEETS ====================
function syncFromApp(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    const leads = data.leads || [];
    
    let updatedCount = 0;
    let createdCount = 0;
    
    leads.forEach(lead => {
      const leadId = lead.id;
      const rowIndex = findRowByLeadId(sheet, leadId);
      
      if (rowIndex > 0) {
        // Update existing row
        updateRowData(sheet, rowIndex, lead);
        updatedCount++;
      } else {
        // Create new row
        addNewRow(sheet, lead);
        createdCount++;
      }
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      updated: updatedCount,
      created: createdCount,
      message: `Synced ${updatedCount} updated and ${createdCount} new leads`
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log("Error in syncFromApp: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== SYNC FROM SHEETS TO APP ====================
function syncToBackend() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      Logger.log("No data to sync");
      return;
    }
    
    const leads = [];
    const range = sheet.getRange(2, 1, lastRow - 1, 28); // 28 columns (A to AB)
    const values = range.getValues();
    
    values.forEach((row, index) => {
      const leadId = row[0]; // Column A (ID)
      if (leadId) {
        leads.push({
          id: leadId,
          name: row[1] || "",
          phone_number: row[2] || "",
          vehicle: row[3] || "",
          driving_license: row[4] || "",
          experience: row[5] || "",
          interested_ev: row[6] || "",
          monthly_salary: row[7] || "",
          current_location: row[8] || "",
          lead_source: row[9] || "",
          stage: row[10] || "",
          status: row[11] || "",
          assigned_telecaller: row[12] || "",
          telecaller_notes: row[13] || "",
          notes: row[14] || "",
          import_date: row[15] || "",
          created_at: row[16] || "",
          dl_no: row[17] || "",
          badge_no: row[18] || "",
          aadhar_card: row[19] || "",
          pan_card: row[20] || "",
          gas_bill: row[21] || "",
          bank_passbook: row[22] || "",
          preferred_shift: row[23] || "",
          allotted_shift: row[24] || "",
          default_vehicle: row[25] || "",
          end_date: row[26] || "",
          status_final: row[27] || ""
        });
      }
    });
    
    if (leads.length === 0) {
      Logger.log("No valid leads to sync");
      return;
    }
    
    // Send to backend
    const response = UrlFetchApp.fetch(CONFIG.BACKEND_URL + "/driver-onboarding/sync-from-sheets", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ leads: leads }),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    Logger.log("Sync result: " + JSON.stringify(result));
    
    if (result.success) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Successfully synced ${leads.length} leads to backend`,
        "Sync Complete",
        5
      );
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Sync failed: " + result.message,
        "Sync Error",
        10
      );
    }
    
  } catch (error) {
    Logger.log("Error in syncToBackend: " + error.toString());
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Sync error: " + error.toString(),
      "Error",
      10
    );
  }
}

// ==================== HELPER FUNCTIONS ====================
function findRowByLeadId(sheet, leadId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  
  const idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  
  for (let i = 0; i < idColumn.length; i++) {
    if (idColumn[i][0] == leadId) {
      return i + 2; // +2 because array is 0-indexed and we start from row 2
    }
  }
  
  return -1;
}

function updateRowData(sheet, rowIndex, lead) {
  sheet.getRange(rowIndex, 1, 1, 28).setValues([[
    lead.id || "",
    lead.name || "",
    lead.phone_number || "",
    lead.vehicle || "",
    lead.driving_license || "",
    lead.experience || "",
    lead.interested_ev || "",
    lead.monthly_salary || "",
    lead.current_location || "",
    lead.lead_source || "",
    lead.stage || "",
    lead.status || "",
    lead.assigned_telecaller || "",
    lead.telecaller_notes || "",
    lead.notes || "",
    lead.import_date || "",
    lead.created_at || "",
    lead.dl_no || "",
    lead.badge_no || "",
    lead.aadhar_card || "",
    lead.pan_card || "",
    lead.gas_bill || "",
    lead.bank_passbook || "",
    lead.preferred_shift || "",
    lead.allotted_shift || "",
    lead.default_vehicle || "",
    lead.end_date || "",
    lead.status_final || ""
  ]]);
}

function addNewRow(sheet, lead) {
  sheet.appendRow([
    lead.id || "",
    lead.name || "",
    lead.phone_number || "",
    lead.vehicle || "",
    lead.driving_license || "",
    lead.experience || "",
    lead.interested_ev || "",
    lead.monthly_salary || "",
    lead.current_location || "",
    lead.lead_source || "",
    lead.stage || "",
    lead.status || "",
    lead.assigned_telecaller || "",
    lead.telecaller_notes || "",
    lead.notes || "",
    lead.import_date || "",
    lead.created_at || "",
    lead.dl_no || "",
    lead.badge_no || "",
    lead.aadhar_card || "",
    lead.pan_card || "",
    lead.gas_bill || "",
    lead.bank_passbook || "",
    lead.preferred_shift || "",
    lead.allotted_shift || "",
    lead.default_vehicle || "",
    lead.end_date || "",
    lead.status_final || ""
  ]);
}

// ==================== MENU FUNCTIONS ====================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 Nura Pulse Sync')
    .addItem('📤 Sync to Backend', 'syncToBackend')
    .addItem('ℹ️ Show Web App URL', 'showWebAppUrl')
    .addToUi();
}

function showWebAppUrl() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Web App URL',
    'After deploying as web app, paste the URL in your backend .env file as GOOGLE_SHEETS_WEB_APP_URL',
    ui.ButtonSet.OK
  );
}
