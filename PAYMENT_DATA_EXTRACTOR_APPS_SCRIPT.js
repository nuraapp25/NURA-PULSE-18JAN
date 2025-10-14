/**
 * Payment Data Extractor - Google Apps Script
 * Syncs payment data to appropriate monthly tabs
 * URL: https://docs.google.com/spreadsheets/d/1CLhARhllhqZuDzkzNRqFcOGqjrSDzPgmC6gd3-AWOTs/edit?usp=sharing
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const records = data.data || [];
    const monthYear = data.month_year || ""; // e.g., "Sep 2025", "Oct 2025"
    
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
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get or create the sheet for this month
    let sheet = ss.getSheetByName(monthYear);
    if (!sheet) {
      // Create new sheet if it doesn't exist
      sheet = ss.insertSheet(monthYear);
      
      // Add headers
      const headers = [
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
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
    
    // Prepare data for insertion
    const timestamp = new Date().toISOString();
    const rowsData = records.map(record => [
      record.driver || "",
      record.vehicle || "",
      record.description || "",
      record.date || "",
      record.time || "",
      record.amount || "",
      record.paymentMode || "",
      record.distance || "",
      record.duration || "",
      record.pickupKm || "",
      record.dropKm || "",
      record.pickupLocation || "",
      record.dropLocation || "",
      record.screenshotFilename || "",
      timestamp
    ]);
    
    // Insert data starting from row 2 (after headers)
    if (rowsData.length > 0) {
      sheet.getRange(2, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
    }
    
    // Auto-resize columns for better readability
    sheet.autoResizeColumns(1, sheet.getLastColumn());
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Successfully synced ${records.length} records to ${monthYear} tab`,
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
  const testData = {
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
  
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const response = doPost(e);
  Logger.log(response.getContent());
}
