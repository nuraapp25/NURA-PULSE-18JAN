# Google Sheets Integration Setup Guide

This guide will help you integrate Nura Pulse with Google Sheets for automatic user data synchronization.

## Step 1: Create Google Cloud Project & Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Name it: "nura-pulse-sheets-sync"
   - Click "Create and Continue"
   - Skip role assignment (click "Continue")
   - Click "Done"

5. Create Service Account Key:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Select "JSON" format
   - Click "Create"
   - **Save the downloaded JSON file securely**

## Step 2: Share Google Sheet with Service Account

1. Open the downloaded JSON file
2. Find the `client_email` field (looks like: `xxxxx@xxxxx.iam.gserviceaccount.com`)
3. Copy this email address
4. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY/
5. Click "Share" button
6. Paste the service account email
7. Grant "Editor" permission
8. Uncheck "Notify people"
9. Click "Share"

## Step 3: Setup Google Sheet Structure

1. Open your Google Sheet
2. Create/rename a tab called "Users" (if not exists)
3. In the first row, add these headers in order:
   - A1: `S. No.`
   - B1: `Date Created`
   - C1: `Mail ID`
   - D1: `Account Type`
   - E1: `Status`

## Step 4: Add Apps Script to Google Sheets (Optional - for manual sync from Sheets)

1. In Google Sheets, click "Extensions" > "Apps Script"
2. Delete any existing code
3. Paste the following code:

```javascript
/**
 * Nura Pulse - Google Sheets Sync Script
 * This script allows manual triggering of data sync and webhooks
 */

const BACKEND_URL = "YOUR_BACKEND_URL";  // Replace with your backend URL
const API_KEY = "YOUR_API_KEY";  // Optional: Add if you implement API key auth

/**
 * Adds a custom menu to Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Nura Pulse')
    .addItem('Sync to Backend', 'syncToBackend')
    .addItem('Force Refresh from Backend', 'forceRefreshFromBackend')
    .addToUi();
}

/**
 * Syncs data from Google Sheets to Backend
 * (Currently read-only from backend, but this can be extended)
 */
function syncToBackend() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Info', 'Data sync is managed by the backend. Use "Force Refresh from Backend" to pull latest data.', ui.ButtonSet.OK);
}

/**
 * Refreshes data from backend to Google Sheets
 */
function forceRefreshFromBackend() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Confirm Refresh',
    'This will replace all data in the Users tab with data from the backend. Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      // Call backend API to trigger sync
      const options = {
        'method': 'post',
        'headers': {
          'Authorization': 'Bearer ' + API_KEY,
          'Content-Type': 'application/json'
        },
        'muteHttpExceptions': true
      };
      
      const apiResponse = UrlFetchApp.fetch(BACKEND_URL + '/api/users/sync-to-sheets', options);
      
      if (apiResponse.getResponseCode() === 200) {
        ui.alert('Success', 'Data refreshed successfully!', ui.ButtonSet.OK);
      } else {
        ui.alert('Error', 'Failed to refresh data: ' + apiResponse.getContentText(), ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('Error', 'Failed to connect to backend: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Formats the Users sheet
 */
function formatUsersSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error', 'Users sheet not found!', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  // Format header row
  const headerRange = sheet.getRange('A1:E1');
  headerRange.setBackground('#0066FF');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  
  // Set column widths
  sheet.setColumnWidth(1, 80);  // S. No.
  sheet.setColumnWidth(2, 150); // Date Created
  sheet.setColumnWidth(3, 200); // Mail ID
  sheet.setColumnWidth(4, 120); // Account Type
  sheet.setColumnWidth(5, 100); // Status
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  SpreadsheetApp.getUi().alert('Success', 'Sheet formatted successfully!', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Creates a trigger for automatic data validation
 */
function createValidationTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger
  ScriptApp.newTrigger('validateEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  
  SpreadsheetApp.getUi().alert('Success', 'Validation trigger created!', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Validates edits made to the sheet
 */
function validateEdit(e) {
  const sheet = e.source.getActiveSheet();
  
  // Only validate Users sheet
  if (sheet.getName() !== 'Users') return;
  
  const row = e.range.getRow();
  
  // Don't validate header row
  if (row === 1) return;
  
  // Validate Status column (E)
  if (e.range.getColumn() === 5) {
    const validStatuses = ['Pending', 'Active', 'Rejected', 'Deleted'];
    const value = e.value;
    
    if (value && !validStatuses.includes(value)) {
      SpreadsheetApp.getUi().alert('Invalid Status', 'Status must be one of: ' + validStatuses.join(', '), SpreadsheetApp.getUi().ButtonSet.OK);
      e.range.setValue('Pending');
    }
  }
}
```

4. Save the script (Ctrl+S or Cmd+S)
5. Close the Apps Script editor
6. Refresh your Google Sheet
7. You'll see a new "Nura Pulse" menu in the menu bar
8. Click "Nura Pulse" > Format Users Sheet to apply styling

## Step 5: Configure Backend Environment Variables

1. Open the JSON key file you downloaded in Step 1
2. Copy the **entire contents** of the file
3. Add to your backend `.env` file:

```bash
# Google Sheets Integration
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**Important**: The credentials must be on a single line, wrapped in single quotes.

4. Restart the backend server:
```bash
sudo supervisorctl restart backend
```

## Step 6: Test the Integration

1. Log in to Nura Pulse as Master Admin
2. Go to User Management
3. Create a new user or register a new user
4. Check your Google Sheet - the new user should appear automatically!

## Step 7: Manual Sync (if needed)

If automatic sync is not working, you can manually trigger a full sync:

1. Log in as Master Admin
2. Go to User Management
3. Look for "Sync to Google Sheets" button (or use the API endpoint)
4. Click to sync all users

Alternatively, use the Google Sheets menu:
- Open your Google Sheet
- Click "Nura Pulse" > "Force Refresh from Backend"

## Troubleshooting

### Issue: Users not syncing automatically

**Solution**:
1. Check if `GOOGLE_SHEETS_ENABLED=true` in backend `.env`
2. Verify service account email has Editor access to the sheet
3. Check backend logs for errors: `tail -f /var/log/supervisor/backend.err.log`

### Issue: "Permission denied" errors

**Solution**:
1. Ensure Google Sheets API is enabled in Google Cloud Console
2. Verify the service account email is correctly shared with the sheet
3. Check that the service account has "Editor" permissions

### Issue: Invalid credentials error

**Solution**:
1. Verify the JSON credentials are correctly formatted in `.env`
2. Ensure there are no line breaks in the credentials string
3. Make sure credentials are wrapped in single quotes

## Data Flow

```
User Registration/Update in Nura Pulse
          ↓
    Save to MongoDB
          ↓
Automatically sync to Google Sheets
          ↓
    Data appears in "Users" tab
```

## Column Descriptions

- **S. No.**: Sequential number (auto-generated)
- **Date Created**: When the user account was created (YYYY-MM-DD HH:MM:SS)
- **Mail ID**: User's email address
- **Account Type**: Master Admin / Admin / Standard
- **Status**: Pending / Active / Rejected / Deleted

## Notes

- Data flows primarily from Nura Pulse (backend) → Google Sheets
- Manual edits in Google Sheets will NOT sync back to the database (read-only from Sheets perspective)
- To maintain data integrity, always make changes through Nura Pulse dashboard
- The sheet is updated in real-time when users are created, approved, rejected, or deleted

## Security Best Practices

1. **Never commit** the service account JSON file to version control
2. Store credentials securely in environment variables
3. Limit service account permissions to only what's needed
4. Regularly rotate service account keys
5. Monitor API usage in Google Cloud Console

---

For additional support or issues, contact your system administrator or refer to:
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
