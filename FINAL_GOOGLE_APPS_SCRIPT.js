function doPost(e) {
  try {
    // Check if e is defined and has postData
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Invalid request",
        message: "No data received. Make sure this endpoint is being called via POST with JSON data."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Parse incoming data
    var requestData = JSON.parse(e.postData.contents);
    var records = requestData.data || [];
    var monthYear = requestData.month_year || "";
    
    // Log for debugging
    Logger.log("Received month_year: " + monthYear);
    Logger.log("Number of records: " + records.length);
    
    // Validation
    if (!monthYear || monthYear === "" || monthYear === "undefined") {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "month_year is required",
        message: "Missing or invalid month_year parameter. Received: " + monthYear
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (!records || records.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "No data provided",
        message: "Records array is empty"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get the spreadsheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get or create the sheet for this month
    var sheet = ss.getSheetByName(monthYear);
    
    if (!sheet) {
      // Create new sheet if it doesn't exist
      Logger.log("Creating new sheet: " + monthYear);
      sheet = ss.insertSheet(monthYear);
      
      // Add headers
      var headers = [
        "Driver",
        "Vehicle", 
        "Description",
        "Date",
        "Time",
        "Amount",
        "Payment Mode",
        "Distance (km)",
        "Duration (min)",
        "Pickup KM",
        "Drop KM",
        "Pickup Location",
        "Drop Location",
        "Screenshot Filename",
        "Synced At"
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.getRange(1, 1, 1, headers.length).setBackground("#4285f4");
      sheet.getRange(1, 1, 1, headers.length).setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
    
    // Find the last row with data (don't clear existing data)
    var lastRow = sheet.getLastRow();
    var nextRow = lastRow + 1; // Start from next empty row
    
    // If sheet only has headers (row 1), start from row 2
    if (lastRow === 1) {
      nextRow = 2;
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
    
    // Append data starting from the next empty row
    if (rowsData.length > 0) {
      sheet.getRange(nextRow, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
      Logger.log("Appended " + rowsData.length + " rows starting from row " + nextRow);
    }
    
    // Return success
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Successfully synced " + records.length + " records to " + monthYear + " tab",
      recordCount: records.length,
      sheetName: monthYear,
      timestamp: timestamp
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log("Error: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      message: "An error occurred while processing the sync"
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function - Run this to verify the script works
// IMPORTANT: Select "testSync" from the dropdown and click Run
// DO NOT run "doPost" directly - it will give an error
function testSync() {
  Logger.log("Starting test sync...");
  
  var testData = {
    data: [
      {
        driver: "Test Driver 1",
        vehicle: "TN01AB1234",
        description: "Auto",
        date: "14/10/2025",
        time: "10:30 AM",
        amount: "150",
        payment_mode: "Cash",
        distance: "5.5",
        duration: "20",
        pickup_km: "N/A",
        drop_km: "N/A",
        pickup_location: "Location A",
        drop_location: "Location B",
        screenshot_filename: "test1.jpg"
      },
      {
        driver: "Test Driver 2",
        vehicle: "TN02CD5678",
        description: "Auto",
        date: "14/10/2025",
        time: "02:45 PM",
        amount: "200",
        payment_mode: "UPI",
        distance: "8.2",
        duration: "35",
        pickup_km: "N/A",
        drop_km: "N/A",
        pickup_location: "Location X",
        drop_location: "Location Y",
        screenshot_filename: "test2.jpg"
      }
    ],
    month_year: "Test Oct 2025"
  };
  
  Logger.log("Test data prepared");
  
  var e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  Logger.log("Calling doPost with test data...");
  var response = doPost(e);
  var result = response.getContent();
  
  Logger.log("Response: " + result);
  
  // Parse and display result
  var resultObj = JSON.parse(result);
  if (resultObj.success) {
    Logger.log("✅ TEST PASSED: " + resultObj.message);
    Logger.log("Check your spreadsheet for a new tab: " + resultObj.sheetName);
  } else {
    Logger.log("❌ TEST FAILED: " + resultObj.message);
  }
  
  return result;
}
