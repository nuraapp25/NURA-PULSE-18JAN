/**
 * Payment Data Extractor - Google Apps Script
 * Syncs payment data to appropriate monthly tabs
 * Spreadsheet URL: https://docs.google.com/spreadsheets/d/1CLhARhllhqZuDzkzNRqFcOGqjrSDzPgmC6gd3-AWOTs/edit
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var records = data.data || [];
    var monthYear = data.month_year || "";
    
    if (!monthYear) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "month_year is required"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (!records || records.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "No data provided"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get or create the sheet for this month
    var sheet = ss.getSheetByName(monthYear);
    if (!sheet) {
      // Create new sheet if it does not exist
      sheet = ss.insertSheet(monthYear);
      
      // Add headers
      var headers = [
        "Driver", "Vehicle", "Description", "Date", "Time", "Amount",
        "Payment Mode", "Distance (km)", "Duration (min)", "Pickup KM",
        "Drop KM", "Pickup Location", "Drop Location", "Screenshot Filename",
        "Synced At"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    
    // Clear existing data (keep headers)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
    
    // Prepare data for insertion
    var timestamp = new Date().toISOString();
    var rowsData = [];
    
    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      rowsData.push([
        record.driver || "",
        record.vehicle || "",
        record.description || "",
        record.date || "",
        record.time || "",
        record.amount || "",
        record.payment_mode || record.paymentMode || "",
        record.distance || "",
        record.duration || "",
        record.pickup_km || record.pickupKm || "",
        record.drop_km || record.dropKm || "",
        record.pickup_location || record.pickupLocation || "",
        record.drop_location || record.dropLocation || "",
        record.screenshot_filename || record.screenshotFilename || "",
        timestamp
      ]);
    }
    
    // Insert data starting from row 2 (after headers)
    if (rowsData.length > 0) {
      sheet.getRange(2, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Successfully synced " + records.length + " records to " + monthYear + " tab",
      recordCount: records.length,
      sheetName: monthYear,
      timestamp: timestamp
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test function - Run this to test the script
 * This creates a test tab and adds sample data
 */
function testSync() {
  var testData = {
    data: [
      {
        driver: "John Doe",
        vehicle: "TN01AB1234",
        description: "Payment for ride",
        date: "2025-10-14",
        time: "10:30:00",
        amount: "500",
        paymentMode: "UPI",
        distance: "25.5",
        duration: "45",
        pickupKm: "1200",
        dropKm: "1225.5",
        pickupLocation: "Location A",
        dropLocation: "Location B",
        screenshotFilename: "screenshot1.jpg"
      },
      {
        driver: "Jane Smith",
        vehicle: "TN02CD5678",
        description: "Daily payment",
        date: "2025-10-14",
        time: "14:20:00",
        amount: "750",
        paymentMode: "Cash",
        distance: "30.2",
        duration: "60",
        pickupKm: "5000",
        dropKm: "5030.2",
        pickupLocation: "Location X",
        dropLocation: "Location Y",
        screenshotFilename: "screenshot2.jpg"
      }
    ],
    month_year: "Test Oct 2025"
  };
  
  var e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  var response = doPost(e);
  Logger.log(response.getContent());
}
