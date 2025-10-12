/**
 * Payment Reconciliation Google Apps Script
 * Handles bi-directional sync with the Payment Reconciliation app
 */

// Configuration
const SPREADSHEET_ID = '1CLhARhllhqZuDzkzNRqFcOGqjrSDzPgmC6gd3-AWOTs';
const WEBHOOK_URL = 'YOUR_BACKEND_URL/api/payment-reconciliation/sheets-webhook'; // Replace with actual URL

/**
 * Main entry point for web app requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    console.log('Received action:', action);
    
    switch (action) {
      case 'sync_payment_data':
        return syncPaymentData(data);
      case 'get_payment_data':
        return getPaymentData(data);
      case 'update_payment_record':
        return updatePaymentRecord(data);
      case 'delete_payment_records':
        return deletePaymentRecords(data);
      default:
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Sync payment data to Google Sheets
 */
function syncPaymentData(data) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const tabName = data.tab || 'Sep 2025';
    let sheet;
    
    // Get or create sheet
    try {
      sheet = spreadsheet.getSheetByName(tabName);
    } catch (e) {
      sheet = spreadsheet.insertSheet(tabName);
    }
    
    // Clear existing data if this is a full sync
    if (data.clear_existing) {
      sheet.clear();
    }
    
    // Add headers if sheet is empty
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      const headers = data.headers || [
        'Driver', 'Vehicle', 'Description', 'Date', 'Time', 'Amount',
        'Payment Mode', 'Distance (km)', 'Duration (min)', 'Pickup KM', 
        'Drop KM', 'Pickup Location', 'Drop Location', 'Screenshot Filename'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('white');
      headerRange.setFontWeight('bold');
    }
    
    // Add data rows
    if (data.data && data.data.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      const range = sheet.getRange(startRow, 1, data.data.length, data.data[0].length);
      range.setValues(data.data);
      
      // Format amount column (column 6) to show currency
      const amountRange = sheet.getRange(startRow, 6, data.data.length, 1);
      amountRange.setNumberFormat('"₹"#,##0.00');
    }
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, sheet.getLastColumn());
    
    // Add timestamp
    const timestampCell = sheet.getRange(sheet.getLastRow() + 2, 1);
    timestampCell.setValue('Last Sync: ' + new Date().toLocaleString());
    timestampCell.setFontStyle('italic');
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        message: `Synced ${data.data.length} records to ${tabName}`,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error syncing payment data:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get payment data from Google Sheets
 */
function getPaymentData(data) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const tabName = data.tab || 'Sep 2025';
    const sheet = spreadsheet.getSheetByName(tabName);
    
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Sheet not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, data: [], count: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Get data
    const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    const values = dataRange.getValues();
    
    // Convert to objects
    const records = values.map((row, index) => {
      const record = { id: `row_${index + 2}` }; // Row number as ID
      headers.forEach((header, colIndex) => {
        record[header] = row[colIndex];
      });
      return record;
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        data: records,
        count: records.length,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error getting payment data:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Update a single payment record
 */
function updatePaymentRecord(data) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const tabName = data.tab || 'Sep 2025';
    const sheet = spreadsheet.getSheetByName(tabName);
    
    if (!sheet) {
      throw new Error('Sheet not found');
    }
    
    const rowNumber = parseInt(data.row_id.replace('row_', ''));
    const updates = data.updates;
    
    // Get headers to map field names to columns
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Update each field
    Object.keys(updates).forEach(fieldName => {
      const colIndex = headers.indexOf(fieldName) + 1;
      if (colIndex > 0) {
        sheet.getRange(rowNumber, colIndex).setValue(updates[fieldName]);
      }
    });
    
    // Notify backend about the change (optional)
    notifyBackendOfChange(data.tab, rowNumber, updates);
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'Record updated successfully',
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error updating payment record:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Delete payment records
 */
function deletePaymentRecords(data) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const tabName = data.tab || 'Sep 2025';
    const sheet = spreadsheet.getSheetByName(tabName);
    
    if (!sheet) {
      throw new Error('Sheet not found');
    }
    
    const rowNumbers = data.row_numbers.map(id => parseInt(id.replace('row_', ''))).sort((a, b) => b - a);
    
    // Delete rows from bottom to top to maintain row numbers
    rowNumbers.forEach(rowNumber => {
      sheet.deleteRow(rowNumber);
    });
    
    // Notify backend about the deletions (optional)
    notifyBackendOfDeletion(data.tab, rowNumbers);
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        deleted_count: rowNumbers.length,
        message: `Deleted ${rowNumbers.length} records`,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error deleting payment records:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Notify backend of changes made in Google Sheets
 */
function notifyBackendOfChange(tabName, rowNumber, updates) {
  try {
    // This would make a POST request to your backend webhook
    // Uncomment and configure when ready to implement bi-directional sync
    /*
    const payload = {
      source: 'google_sheets',
      action: 'update',
      tab: tabName,
      row_number: rowNumber,
      updates: updates,
      timestamp: new Date().toISOString()
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload)
    };
    
    UrlFetchApp.fetch(WEBHOOK_URL, options);
    */
    console.log('Change notification:', { tabName, rowNumber, updates });
  } catch (error) {
    console.error('Error notifying backend:', error);
  }
}

/**
 * Notify backend of deletions made in Google Sheets
 */
function notifyBackendOfDeletion(tabName, rowNumbers) {
  try {
    // This would make a POST request to your backend webhook
    // Uncomment and configure when ready to implement bi-directional sync
    /*
    const payload = {
      source: 'google_sheets',
      action: 'delete',
      tab: tabName,
      deleted_rows: rowNumbers,
      timestamp: new Date().toISOString()
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload)
    };
    
    UrlFetchApp.fetch(WEBHOOK_URL, options);
    */
    console.log('Deletion notification:', { tabName, rowNumbers });
  } catch (error) {
    console.error('Error notifying backend:', error);
  }
}

/**
 * Test function to verify the script is working
 */
function testScript() {
  const testData = {
    action: 'sync_payment_data',
    tab: 'Test Tab',
    headers: ['Driver', 'Vehicle', 'Amount'],
    data: [
      ['John Doe', 'TN01AB1234', '₹100'],
      ['Jane Smith', 'TN02CD5678', '₹150']
    ]
  };
  
  const result = syncPaymentData(testData);
  console.log('Test result:', result.getContent());
}

/**
 * Set up triggers for real-time sync (call this once to set up)
 */
function setupTriggers() {
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Create new trigger for sheet edits
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  ScriptApp.newTrigger('onSheetEdit')
    .timeBased()
    .everyMinutes(5) // Check every 5 minutes
    .create();
}

/**
 * Handle sheet edits for real-time sync
 */
function onSheetEdit(e) {
  try {
    // This would detect changes in the sheet and sync back to the backend
    // Implementation would depend on specific requirements
    console.log('Sheet edited, triggering sync...');
  } catch (error) {
    console.error('Error in onSheetEdit:', error);
  }
}