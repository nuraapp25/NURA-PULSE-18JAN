// ========== CONFIGURATION ==========
var API_BASE_URL = "https://fleetflow-8.preview.emergentagent.com";
var BEARER_TOKEN = "YOUR_TOKEN_HERE";

// ========== MAIN FUNCTIONS ==========

function syncFromAPI() {
  try {
    var url = API_BASE_URL + "/api/driver-onboarding/leads";
    
    var options = {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + BEARER_TOKEN
      },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var leads = JSON.parse(response.getContentText());
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Driver Leads");
    
    if (!sheet) {
      sheet = ss.insertSheet("Driver Leads");
      var headers = ["ID", "Name", "Phone Number", "Experience", "Address", "Lead Stage", "Status", "Assigned Telecaller", "Telecaller Notes", "Notes", "Import Date", "Last Modified"];
      sheet.getRange(1, 1, 1, 12).setValues([headers]);
      sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#4285f4").setFontColor("#ffffff");
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 12).clearContent();
    }
    
    var rows = [];
    for (var i = 0; i < leads.length; i++) {
      var lead = leads[i];
      rows.push([
        lead.id || "",
        lead.name || "",
        lead.phone_number || "",
        lead.experience || "",
        lead.current_location || "",
        lead.stage || "",
        lead.status || "",
        lead.assigned_telecaller || "",
        lead.telecaller_notes || "",
        lead.notes || "",
        lead.import_date || "",
        lead.last_modified || ""
      ]);
    }
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 12).setValues(rows);
    }
    
    SpreadsheetApp.getActiveSpreadsheet().toast("Synced " + leads.length + " leads!", "Success", 5);
    
  } catch (error) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Error: " + error, "Failed", 5);
  }
}

function onEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() !== "Driver Leads") return;
    if (e.range.getRow() === 1) return;
    
    var row = e.range.getRow();
    var rowData = sheet.getRange(row, 1, 1, 12).getValues()[0];
    var leadId = rowData[0];
    if (!leadId) return;
    
    var data = {
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
    
    var url = API_BASE_URL + "/api/driver-onboarding/leads/" + leadId;
    var options = {
      method: "PATCH",
      headers: {
        "Authorization": "Bearer " + BEARER_TOKEN,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };
    
    UrlFetchApp.fetch(url, options);
    sheet.getRange(row, 12).setValue(new Date().toISOString());
    
  } catch (error) {
    Logger.log("Edit sync error: " + error);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Driver Sync')
    .addItem('Sync from API', 'syncFromAPI')
    .addItem('Setup Auto Sync', 'setupTriggers')
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
  
  SpreadsheetApp.getActiveSpreadsheet().toast("Auto-sync enabled!", "Done", 3);
}
