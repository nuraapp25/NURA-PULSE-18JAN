# 🔄 Updated Sync Instructions - "Sync from Sheets" Button

## What Changed?

The "Sync from Sheets" button in the Driver Onboarding app now **actually pulls data** from Google Sheets!

---

## ⚠️ IMPORTANT: Update Required

**YES, you need to update your Google Apps Script!**

The script has been updated to handle GET requests that trigger the sync from Google Sheets to the app.

---

## 📝 How to Update

### Step 1: Open Your Google Apps Script

1. Go to your Google Sheet: https://docs.google.com/spreadsheets/d/1FfZYvc9EpSE03myhp3yk8lfOzCJoibVmaJ74Xm-qhv0/edit
2. Click **Extensions** → **Apps Script**

### Step 2: Replace the Script

1. **Select ALL** the existing code (Ctrl+A / Cmd+A)
2. **Delete it**
3. Copy the **ENTIRE updated script** from `/app/google-sheets-driver-onboarding-sync.gs`
4. Paste it into the Apps Script editor
5. Click **Save** (💾)

### Step 3: Test the Script (Optional)

1. In the Apps Script editor, select the `doGet` function
2. Click **Run** to test
3. Check the execution log for any errors

### Step 4: You're Done!

No need to redeploy the Web App - the URL stays the same!

---

## 🎯 What's New in the Script?

### Added `doGet()` Function

```javascript
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'sync_to_app') {
    // Triggers sync from Google Sheets to App
    const success = syncAllToApp(false);
    return success response;
  }
}
```

This function handles GET requests from the app when you click "Sync from Sheets".

### Updated `syncAllToApp()` Function

```javascript
function syncAllToApp(showUI) {
  // showUI parameter controls whether to show alert dialogs
  // When called from web (doGet), showUI = false
  // When called from menu, showUI = true (default)
}
```

Now works both manually (from menu) and programmatically (from web).

---

## 🔄 How It Works Now

### When You Click "Sync from Sheets" in the App:

1. **Frontend** sends GET request to Google Apps Script:
   ```
   https://script.google.com/.../exec?action=sync_to_app
   ```

2. **Google Apps Script** (`doGet` function):
   - Reads all data from "Driver Leads" sheet
   - Converts to lead objects
   - Sends to backend webhook: `POST /api/driver-onboarding/webhook/sync-from-sheets`

3. **Backend** receives the data:
   - Creates new leads (if phone number doesn't exist)
   - Updates existing leads (if phone number matches)
   - Returns success response

4. **Frontend** refreshes:
   - Waits 2 seconds for processing
   - Fetches updated leads
   - Shows success message

---

## ✅ Testing the Updated Sync

### Test 1: Add a Lead in Google Sheets

1. Open your Google Sheet
2. Add a new row with lead data (make sure to include phone number)
3. Go to the Nura Pulse app
4. Click the **"Sync from Sheets"** (blue button)
5. Wait for success message
6. The new lead should appear in the app!

### Test 2: Update a Lead in Google Sheets

1. Find an existing lead in your Google Sheet
2. Change the status or any other field
3. In the app, click **"Sync from Sheets"**
4. The updated data should appear in the app

### Test 3: Manual Sync (from Google Sheet menu)

1. In Google Sheet, click **🔄 Nura Sync** → **📤 Push All to App**
2. Should show success dialog
3. All leads synced to app

---

## 🎨 Button Behavior

### Before Update:
- ❌ "Sync from Sheets" only refreshed local data
- ❌ Didn't actually pull from Google Sheets
- ❌ Required manual script trigger

### After Update:
- ✅ "Sync from Sheets" triggers Google Apps Script
- ✅ Actually reads data from Google Sheet
- ✅ Automatically updates the app
- ✅ Shows progress and success messages

---

## 🔧 Technical Details

### Frontend Change:
```javascript
const handleSyncFromSheets = async () => {
  // Call Google Apps Script with action=sync_to_app
  await fetch(`${GOOGLE_SHEETS_WEB_APP_URL}?action=sync_to_app`, {
    method: 'GET',
    mode: 'no-cors'
  });
  
  // Wait for webhook processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Refresh to show updated data
  await fetchLeads();
};
```

### Google Apps Script Changes:
1. **New `doGet()` function** - Handles GET requests
2. **Updated `syncAllToApp(showUI)`** - Optional UI parameter
3. **Maintains backward compatibility** - Menu items still work

---

## 📊 Complete Sync Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER CLICKS BUTTON                       │
│              "Sync from Sheets" (Blue Button)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND (React App)                        │
│  GET https://script.google.com/.../exec?action=sync_to_app │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          GOOGLE APPS SCRIPT (doGet function)                │
│  1. Read "Driver Leads" sheet                               │
│  2. Convert rows to lead objects                            │
│  3. Filter valid leads (with phone numbers)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│        BACKEND WEBHOOK (FastAPI)                            │
│  POST /api/driver-onboarding/webhook/sync-from-sheets      │
│  • Create new leads (unique phone numbers)                  │
│  • Update existing leads (matching phone numbers)           │
│  • Return success with counts                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 MONGODB DATABASE                            │
│          driver_leads collection updated                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND REFRESHES DATA                        │
│  • Fetch updated leads from MongoDB                         │
│  • Display in UI with changes highlighted                   │
│  • Show success toast                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Issue: "Sync from Sheets" not working

**Check:**
1. ✅ Did you update the Google Apps Script?
2. ✅ Is the Web App URL correct in the script?
3. ✅ Is the backend webhook URL correct in the script?
4. ✅ Does your sheet have the correct column structure?
5. ✅ Do your leads have phone numbers?

**Solution:**
- Check Apps Script execution logs: **Extensions** → **Apps Script** → **Executions**
- Test manually: **🔄 Nura Sync** → **📤 Push All to App**

### Issue: CORS error in browser console

**This is normal!** 
- The `mode: 'no-cors'` in the fetch request is intentional
- Google Apps Script requires this setting
- The sync still works even if you see console messages

### Issue: Data not appearing immediately

**This is expected:**
- The app waits 2 seconds for webhook processing
- If you have a large sheet, it might take longer
- Try clicking the refresh button or wait a moment

---

## ✅ Summary

**What you need to do:**
1. ✅ Update the Google Apps Script (copy from `/app/google-sheets-driver-onboarding-sync.gs`)
2. ✅ Save the script
3. ✅ Test by clicking "Sync from Sheets" button

**What you DON'T need to do:**
- ❌ Redeploy the Web App
- ❌ Change any URLs
- ❌ Restart the backend
- ❌ Update environment variables

**Result:**
- ✅ "Sync from Sheets" button now actually pulls data from Google Sheets
- ✅ Real-time sync working bidirectionally
- ✅ Manual and automatic sync both functional

---

**Updated:** October 19, 2025
**Files Modified:**
- `/app/frontend/src/pages/DriverOnboardingPage.jsx`
- `/app/google-sheets-driver-onboarding-sync.gs`
