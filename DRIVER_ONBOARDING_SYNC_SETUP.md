# 🔄 Driver Onboarding Two-Way Auto-Sync Setup Guide

## Overview
This setup enables **automatic two-way synchronization** between Google Sheets and the Nura Pulse Driver Onboarding app.

### Sync Directions:
- **Google Sheets → App**: Real-time (onEdit) + Every 5 minutes (scheduled)
- **App → Google Sheets**: Automatic after every change in the app

---

## 📋 Prerequisites

1. Access to the Google Sheet: https://docs.google.com/spreadsheets/d/1FfZYvc9EpSE03myhp3yk8lfOzCJoibVmaJ74Xm-qhv0/edit
2. Backend URL: `https://leadmanager-15.preview.emergentagent.com/api`
3. The backend webhook endpoint is already deployed and ready

---

## 🚀 Setup Instructions

### Step 1: Open Your Google Sheet

1. Open the Google Sheet: https://docs.google.com/spreadsheets/d/1FfZYvc9EpSE03myhp3yk8lfOzCJoibVmaJ74Xm-qhv0/edit
2. Make sure you have a sheet tab named **"Driver Leads"** (or update the SHEET_NAME in the script)

### Step 2: Create Required Headers

Ensure your sheet has the following columns (in order):

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ID | Name | Phone Number | Vehicle | Driving License | Experience | Interested EV | Monthly Salary | Current Location | Lead Stage | Status | Driver Readiness | Docs Collection | Customer Readiness | Assigned Telecaller | Telecaller Notes | Notes | Import Date | Created At |

### Step 3: Install the Google Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code in the editor
3. Copy the ENTIRE content from `google-sheets-driver-onboarding-sync.gs` file
4. Paste it into the Apps Script editor
5. **IMPORTANT**: Update the configuration at the top of the script:
   ```javascript
   const APP_WEBHOOK_URL = 'https://leadmanager-15.preview.emergentagent.com/api/driver-onboarding/webhook/sync-from-sheets';
   const SHEET_NAME = 'Driver Leads'; // Your sheet tab name
   ```
6. Click the **Save** icon (💾) and name your project "Nura Pulse Sync"

### Step 4: Authorize the Script

1. Click **Run** → Select `onOpen` function
2. Click the **Run** button (▶️)
3. You'll see a permission dialog - click **Review Permissions**
4. Select your Google account
5. Click **Advanced** → **Go to Nura Pulse Sync (unsafe)**
6. Click **Allow**

### Step 5: Deploy as Web App (for App → Sheets sync)

1. In the Apps Script editor, click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Select **Web app**
4. Configure:
   - **Description**: "Nura Pulse Driver Onboarding Webhook"
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Click **Deploy**
6. Copy the **Web App URL** - you'll need this for the backend configuration

### Step 6: Update Backend Configuration (Optional)

The backend is already configured to receive data from Google Sheets. However, if you want the app to push data back to Google Sheets, you need to update the `.env` file:

```bash
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_WEB_APP_URL=<paste the Web App URL from Step 5>
```

Then restart the backend:
```bash
sudo supervisorctl restart backend
```

### Step 7: Setup Auto-Sync Triggers

1. Go back to your Google Sheet
2. You should now see a new menu: **🔄 Nura Sync**
3. Click **🔄 Nura Sync** → **⚙️ Setup Auto-Sync**
4. Click **Yes** to confirm
5. This will create a time-based trigger to sync every 5 minutes

### Step 8: Test the Connection

1. Click **🔄 Nura Sync** → **🔍 Test Connection**
2. You should see: "✅ Connection Test Successful!"
3. If you see an error, check your APP_WEBHOOK_URL in the script

---

## 🎯 How to Use

### Manual Sync Options

From the **🔄 Nura Sync** menu:

- **📤 Push All to App**: Manually sync all sheet data to the app
- **📥 Pull All from App**: Manually pull all app data to the sheet
- **📊 Sync Status**: View last sync times and trigger status

### Automatic Sync

Once set up, synchronization happens automatically:

1. **Real-time (onEdit)**: 
   - Any change in the sheet instantly syncs to the app
   - Works for cell edits, updates, and pastes

2. **Scheduled (Every 5 minutes)**:
   - Backup sync in case onEdit trigger misses something
   - Ensures consistency

3. **From App**:
   - Any change in the Nura Pulse app automatically syncs to Google Sheets
   - Creates/updates leads in the sheet

---

## 📊 Column Details

### Required Fields:
- **Phone Number**: Unique identifier (required for sync)

### Status Fields:
- **Lead Stage**: New, Contacted, Qualified, Assigned to Telecaller, In Progress
- **Status**: New, Contacted, Interested, Documents Pending, Scheduled, Onboarded, Rejected, Not Interested
- **Driver Readiness**: Not Started, Training Pending, In Training, Training Completed
- **Docs Collection**: Pending, Documents Submitted, Documents Verified, Road Test Scheduled, Road Test Passed, Road Test Failed
- **Customer Readiness**: Not Ready, Ready for Onboarding, Onboarded

---

## 🔧 Troubleshooting

### Issue: "Connection Test Failed"
**Solution**: 
- Check if APP_WEBHOOK_URL is correct
- Ensure backend is running
- Check if firewall/network allows the connection

### Issue: "Auth token error" when pulling from app
**Solution**:
- In the `syncAllFromApp` function, you need to add a valid auth token
- Login to Nura Pulse, open browser console, and get the token from localStorage
- Update the script line:
  ```javascript
  'Authorization': 'Bearer YOUR_ACTUAL_TOKEN_HERE'
  ```

### Issue: Changes not syncing automatically
**Solution**:
- Check if triggers are set up: **🔄 Nura Sync** → **📊 Sync Status**
- If "Auto-sync (scheduled): ❌ Inactive", run **⚙️ Setup Auto-Sync** again
- Check Apps Script execution logs: **Extensions** → **Apps Script** → **Executions**

### Issue: Duplicate entries
**Solution**:
- The system uses `phone_number` as the unique identifier
- If a phone number exists, it will UPDATE the record, not create a duplicate
- Ensure phone numbers are unique in your sheet

---

## 🔐 Security Notes

1. **Web App Access**: Set to "Anyone" for webhook functionality
2. **Data Privacy**: Only authorized users with sheet access can view data
3. **Auth Token**: Never commit or share your auth token publicly
4. **Webhook URL**: Keep the webhook URL secure to prevent unauthorized access

---

## 📈 Sync Flow Diagram

```
┌─────────────────┐          ┌─────────────────┐
│  Google Sheets  │          │  Nura Pulse App │
│                 │          │                 │
│  Edit Cell      │──────────▶  onEdit Trigger │
│  (Real-time)    │  Instant │  Updates MongoDB│
└─────────────────┘          └─────────────────┘
        │                            │
        │                            │
        ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│  Scheduled Sync │          │  App Changes    │
│  (Every 5 min)  │──────────▶  Auto Sync      │
│                 │  Batch   │  to Sheets      │
└─────────────────┘          └─────────────────┘
```

---

## 🎉 Success Indicators

✅ **"🔄 Nura Sync" menu** appears in your Google Sheet
✅ **Test Connection** shows "Connection Test Successful"
✅ **Sync Status** shows active triggers
✅ **Editing a cell** in the sheet updates the app immediately
✅ **Changes in the app** appear in the sheet within 5 minutes

---

## 📞 Support

If you encounter issues:
1. Check the **📊 Sync Status** in the Nura Sync menu
2. View execution logs in Apps Script editor
3. Test with a single row first before bulk operations
4. Ensure all required columns are present

---

**Last Updated**: October 18, 2025
**Version**: 1.0
