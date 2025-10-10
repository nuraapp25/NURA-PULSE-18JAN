# Simple Google Sheets Integration - No API Keys Required!

This is a much simpler approach using Google Apps Script Web App.

## Step 1: Setup Google Apps Script Web App

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY/
2. Click **Extensions** → **Apps Script**
3. Delete any existing code
4. Paste the code below
5. Click **Save** (disk icon)
6. Click **Deploy** → **New deployment**
7. Click gear icon ⚙️ next to "Select type"
8. Select **Web app**
9. Fill in:
   - Description: "Nura Pulse Sync"
   - Execute as: **Me**
   - Who has access: **Anyone**
10. Click **Deploy**
11. Click **Authorize access** → Select your Google account → **Allow**
12. **Copy the Web App URL** (looks like: https://script.google.com/macros/s/xxxx/exec)

---

## Apps Script Code (Paste in Apps Script Editor)

```javascript
/**
 * NURA PULSE - SIMPLE SYNC WEB APP
 * This receives POST requests from Nura Pulse backend and syncs data
 */

const SHEET_NAME = 'Users';

/**
 * Handle POST requests from backend
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'sync_all_users') {
      return syncAllUsers(data.users);
    } else if (data.action === 'sync_single_user') {
      return syncSingleUser(data.user);
    } else if (data.action === 'delete_user') {
      return deleteUser(data.email);
    }
    
    return createResponse(false, 'Unknown action');
  } catch (error) {
    Logger.log('Error: ' + error);
    return createResponse(false, error.toString());
  }
}

/**
 * Sync all users to the sheet
 */
function syncAllUsers(users) {
  const sheet = getSheet();
  
  // Clear existing data (keep header row 1)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
  }
  
  // Add users starting from row 2
  if (users && users.length > 0) {
    const rows = users.map((user, index) => [
      index + 1,  // S. No.
      formatDate(user.created_at),
      user.email || '',
      formatAccountType(user.account_type),
      formatStatus(user.status)
    ]);
    
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    formatSheet(sheet, rows.length + 1);
  }
  
  return createResponse(true, `Synced ${users.length} users`);
}

/**
 * Sync or update a single user
 */
function syncSingleUser(user) {
  const sheet = getSheet();
  const email = user.email;
  
  // Find existing user by email
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email) {  // Column C (index 2) is email
      rowIndex = i + 1;  // Sheet rows are 1-indexed
      break;
    }
  }
  
  const userData = [
    rowIndex > 0 ? data[rowIndex - 1][0] : data.length,  // Keep existing S.No. or new
    formatDate(user.created_at),
    user.email || '',
    formatAccountType(user.account_type),
    formatStatus(user.status)
  ];
  
  if (rowIndex > 0) {
    // Update existing row
    sheet.getRange(rowIndex, 1, 1, 5).setValues([userData]);
  } else {
    // Add new row
    userData[0] = data.length;  // New S. No.
    sheet.appendRow(userData);
  }
  
  formatSheet(sheet, sheet.getLastRow());
  
  return createResponse(true, 'User synced');
}

/**
 * Delete user from sheet
 */
function deleteUser(email) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email) {  // Column C is email
      sheet.deleteRow(i + 1);
      
      // Re-number S. No. column
      renumberSerialNumbers(sheet);
      
      return createResponse(true, 'User deleted');
    }
  }
  
  return createResponse(true, 'User not found');
}

/**
 * Get or create Users sheet
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add headers
    sheet.getRange('A1:E1').setValues([['S. No.', 'Date Created', 'Mail ID', 'Account Type', 'Status']]);
    formatHeaders(sheet);
  }
  
  return sheet;
}

/**
 * Format the sheet
 */
function formatSheet(sheet, lastRow) {
  if (lastRow <= 1) return;
  
  // Set column widths
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 250);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 120);
  
  // Format header
  formatHeaders(sheet);
  
  // Center align S. No.
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment('center');
  }
  
  // Format status column
  if (lastRow > 1) {
    formatStatusColumn(sheet, lastRow);
  }
}

/**
 * Format header row
 */
function formatHeaders(sheet) {
  const headerRange = sheet.getRange('A1:E1');
  headerRange.setBackground('#0066FF');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

/**
 * Format status column with colors
 */
function formatStatusColumn(sheet, lastRow) {
  const statusRange = sheet.getRange(2, 5, lastRow - 1, 1);
  const values = statusRange.getValues();
  
  for (let i = 0; i < values.length; i++) {
    const status = values[i][0].toString().toLowerCase();
    const cell = sheet.getRange(i + 2, 5);
    
    if (status === 'active') {
      cell.setBackground('#D1FAE5');
      cell.setFontColor('#065F46');
    } else if (status === 'pending') {
      cell.setBackground('#FEF3C7');
      cell.setFontColor('#92400E');
    } else if (status === 'rejected') {
      cell.setBackground('#FEE2E2');
      cell.setFontColor('#991B1B');
    }
  }
}

/**
 * Renumber serial numbers after deletion
 */
function renumberSerialNumbers(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  
  const range = sheet.getRange(2, 1, lastRow - 1, 1);
  const values = range.getValues().map((row, index) => [index + 1]);
  range.setValues(values);
}

/**
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format account type
 */
function formatAccountType(type) {
  if (!type) return '';
  return type.replace(/_/g, ' ').split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Format status
 */
function formatStatus(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Create JSON response
 */
function createResponse(success, message) {
  const response = {
    success: success,
    message: message
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - run this to test manually
 */
function testSync() {
  const testData = {
    action: 'sync_all_users',
    users: [
      {
        email: 'admin',
        first_name: 'Master Admin',
        account_type: 'master_admin',
        status: 'active',
        created_at: new Date().toISOString()
      }
    ]
  };
  
  const result = syncAllUsers(testData.users);
  Logger.log(result.getContent());
}
```

---

## Step 2: Get Your Web App URL

After deploying, you'll get a URL like:
```
https://script.google.com/macros/s/AKfycbxxx.../exec
```

**Copy this URL!**

---

## Step 3: Update Nura Pulse Backend

Add this to `/app/backend/.env`:

```bash
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

Replace `YOUR_SCRIPT_ID` with your actual Web App URL.

Then restart backend:
```bash
sudo supervisorctl restart backend
```

---

## Step 4: Update Backend Sync Function

The backend will use this simple HTTP POST approach instead of the complex service account method.

---

## How It Works

1. **Nura Pulse Backend** → Makes HTTP POST to your Web App URL
2. **Google Apps Script** → Receives data and updates the sheet
3. **Google Sheet** → Updates automatically with user data

### Sync Happens Automatically When:
- User is created
- User is approved/rejected
- User status changes
- User is deleted

### Manual Sync:
Click "Sync to Google Sheets" button in User Management

---

## Testing

1. After deploying the Web App, run the `testSync` function in Apps Script
2. Check if a test row appears in your sheet
3. If it works, configure the backend URL
4. Try the "Sync to Google Sheets" button in Nura Pulse

---

## Advantages of This Approach

✅ **No API keys needed**
✅ **No service account setup**
✅ **Works immediately**
✅ **Simple to debug**
✅ **Free forever**

This is much simpler than the service account method!
