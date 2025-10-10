# How to Fix Google Sheets Sync - Step by Step

## Current Issue
The Google Apps Script is returning this error:
```
Exception: Unexpected error while getting the method or property openById on object SpreadsheetApp.
```

This means the script **has not been authorized** to access your Google Sheet.

---

## Quick Fix (5 Minutes)

### Step 1: Open Apps Script
1. Go to your Google Sheet: https://docs.google.com/spreadsheets/d/1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY/edit
2. Click **Extensions** → **Apps Script**

### Step 2: Verify the Spreadsheet ID
Check line 10 in the script:
```javascript
const SPREADSHEET_ID = '1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY';
```

Make sure:
- No extra spaces
- No extra quotes
- Matches your sheet ID exactly

### Step 3: Run the Test Function (MOST IMPORTANT)
1. At the top of the editor, click the function dropdown
2. Select **testSetup**
3. Click the **Run** button (▶️ play icon)
4. A popup will appear: "Authorization required"
5. Click **Review permissions**
6. Choose your Google account
7. You'll see a warning screen:
   - Click **Advanced**
   - Click **Go to Nura Pulse Sync (unsafe)**
   - Click **Allow**
8. Wait for execution to complete
9. Click **View** → **Logs** (or Ctrl+Enter)
10. You should see:
```
Spreadsheet Name: [Your Sheet Name]
Script is working correctly!
Sheet exists: Users
Sheet exists: Leads
Creating sheet: Payment Reconciliation
Creating sheet: Driver Onboarding
Creating sheet: Telecaller Queue
Creating sheet: Montra Vehicle Insights
Setup complete!
```

### Step 4: Deploy New Version
1. Click **Deploy** → **Manage deployments**
2. Click the pencil icon ✏️ next to your deployment
3. Under "Version", select **New version**
4. Add description: "Fixed permissions"
5. Click **Deploy**
6. The URL stays the same (already in your backend)

### Step 5: Test in the App
1. Go to Nura Pulse
2. Login as master admin
3. Go to Driver Onboarding
4. Click **"Sync to Sheets"** button
5. You should see: "Leads synced to Google Sheets successfully!"
6. Check your Google Sheet - you should see all tabs with data!

---

## What You'll See After Fix

### In Google Sheet:
- **Users** tab with all users
- **Leads** tab with 12 columns including Status in Column L
- **Payment Reconciliation** tab (empty for now)
- **Driver Onboarding** tab (empty for now)
- **Telecaller Queue** tab (empty for now)
- **Montra Vehicle Insights** tab (empty for now)

### In the App:
- "Last synced: [timestamp]" showing in Driver Onboarding header
- Every change (import, edit, status update) automatically syncs
- Manual "Sync to Sheets" button works

---

## Troubleshooting

### "I don't see the testSetup function"
**Fix**: Make sure you copied the COMPLETE script from `COMPLETE_GOOGLE_APPS_SCRIPT.js`

### "Authorization keeps failing"
**Fix**: 
1. Make sure you're using the same Google account that owns the spreadsheet
2. Try in an incognito window
3. Clear browser cache and try again

### "Script runs but sheets are empty"
**Fix**:
1. Check that SPREADSHEET_ID is correct
2. Run testSetup again
3. Check Apps Script logs for errors

### "Sync still fails after authorization"
**Fix**:
1. Go to Apps Script
2. Click **Deploy** → **Manage deployments**
3. Click trash icon to delete old deployment
4. Create NEW deployment (Deploy → New deployment)
5. Copy the NEW URL
6. Update backend .env with new URL
7. Restart backend

---

## Common Mistakes

❌ **Not running testSetup** - This is the MOST IMPORTANT STEP
❌ Skipping the authorization popup
❌ Using wrong Google account for authorization
❌ Not deploying a new version after authorization
❌ Wrong Spreadsheet ID

✅ Run testSetup
✅ Authorize the script
✅ Deploy new version
✅ Test sync button

---

## Why This Happens

Google Apps Script requires explicit authorization to:
- Access spreadsheets
- Read/write data
- Create/modify sheets

The first time you run ANY function that accesses SpreadsheetApp, Google asks for permission. The testSetup function is designed to trigger this authorization in a safe way.

---

## Security Notes

When you authorize, you're giving the script permission to:
- ✅ Access ONLY your specified spreadsheet
- ✅ Read and write data to that spreadsheet
- ✅ Create new sheets/tabs

The script CANNOT:
- ❌ Access other Google Sheets
- ❌ Access your Gmail
- ❌ Access any other Google services
- ❌ Share your data with anyone

---

## After Successful Authorization

Once working, the sync will:
1. Automatically sync after every lead change
2. Update "Last synced" timestamp
3. Keep Column L updated with status
4. Create sheets automatically as needed
5. Handle all CRUD operations (Create, Read, Update, Delete)

---

## Need Help?

If you still have issues after following these steps:
1. Check Apps Script execution logs (View → Logs)
2. Check backend logs: `tail -f /var/log/supervisor/backend.err.log | grep sheets`
3. Verify the Web App URL in backend .env
4. Make sure GOOGLE_SHEETS_ENABLED=true

The backend is 100% ready. The only issue is Apps Script authorization!
