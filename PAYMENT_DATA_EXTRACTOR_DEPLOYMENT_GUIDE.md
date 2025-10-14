# Payment Data Extractor - Google Apps Script Deployment Guide

## Step 1: Open Your Google Sheet
Go to: https://docs.google.com/spreadsheets/d/1CLhARhllhqZuDzkzNRqFcOGqjrSDzPgmC6gd3-AWOTs/edit?usp=sharing

## Step 2: Open Apps Script Editor
1. In your Google Sheet, click **Extensions** → **Apps Script**
2. This will open the Apps Script editor in a new tab

## Step 3: Clear Existing Code (if any)
1. Delete any existing code in the editor
2. The editor should be empty

## Step 4: Copy and Paste the New Script
1. Copy the entire contents of `/app/PAYMENT_DATA_EXTRACTOR_APPS_SCRIPT.js`
2. Paste it into the Apps Script editor

## Step 5: Save the Script
1. Click the **Save** icon (💾) or press `Ctrl+S` / `Cmd+S`
2. You may be prompted to name the project - name it "Payment Data Extractor Sync"

## Step 6: Test the Script (Optional)
1. In the function dropdown, select `testSync`
2. Click the **Run** button (▶️)
3. First time: You'll need to authorize the script
   - Click "Review Permissions"
   - Choose your Google account
   - Click "Advanced" → "Go to Payment Data Extractor Sync (unsafe)"
   - Click "Allow"
4. Check your spreadsheet - a new tab "Test Oct 2025" should appear with 2 sample records
5. You can delete this test tab after verification

## Step 7: Deploy as Web App
1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Select **Web app**
4. Configure:
   - **Description**: Payment Data Extractor Sync
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
5. Click **Deploy**
6. **Copy the Web App URL** - it will look like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

## Step 8: Update Backend with Web App URL
The backend already has a placeholder URL. You need to update it with your actual Apps Script URL.

**File to update**: `/app/backend/.env`

Add or update this line:
```
PAYMENT_SHEETS_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ACTUAL_SCRIPT_ID/exec
```

Replace `YOUR_ACTUAL_SCRIPT_ID` with the actual URL you copied in Step 7.

## Step 9: Restart Backend
```bash
sudo supervisorctl restart backend
```

## How It Works

### Automatic Tab Creation
- When you sync data for "Sep 2025", the script automatically creates a "Sep 2025" tab if it doesn't exist
- Same for "Oct 2025", "Nov 2025", "Dec 2025", etc.
- No manual tab creation needed!

### Data Structure
Each tab will have these columns:
1. Driver
2. Vehicle
3. Description
4. Date
5. Time
6. Amount
7. Payment Mode
8. Distance (km)
9. Duration (min)
10. Pickup KM
11. Drop KM
12. Pickup Location
13. Drop Location
14. Screenshot Filename
15. Synced At

### Sync Behavior
- **Replaces all data** in the tab each time you sync (keeps headers)
- This ensures the tab always has the latest data from the app
- Headers remain bold and frozen for easy scrolling

## Troubleshooting

### Issue: "Authorization required"
**Solution**: Run the `testSync` function first and complete the authorization process

### Issue: "Script not found" error when syncing from app
**Solution**: 
1. Make sure you deployed the script as a Web App (Step 7)
2. Verify the URL in backend `.env` file is correct
3. Restart the backend

### Issue: Data not appearing in the correct tab
**Solution**: 
1. Check that the folder name in the app matches exactly (e.g., "Sep 2025" not "sep 2025")
2. The script is case-sensitive for tab names

### Issue: Need to update the script
**Solution**:
1. Make changes in Apps Script editor
2. Save the script
3. Click **Deploy** → **Manage deployments**
4. Click the pencil icon ✏️ to edit
5. Change version to "New version"
6. Click **Deploy**
7. The URL remains the same, no need to update backend

## Monthly Workflow

### Creating New Month Folder (e.g., Nov 2025)
1. In Payment Data Extractor app, create new folder "Nov 2025"
2. Upload and process screenshots
3. Click "Sync to Google Sheets"
4. Script automatically creates "Nov 2025" tab in Google Sheet
5. Done! ✅

**No Google Sheet manual work required** - the script handles everything!

## Testing the Sync

1. Go to Payment Data Extractor in the app
2. Select "Sep 2025" folder
3. Add some test records (upload screenshots or add manually)
4. Click "Sync to Google Sheets"
5. Check your Google Sheet - "Sep 2025" tab should have the data
6. Repeat for "Oct 2025" to verify it goes to the correct tab

## Support
If you encounter any issues:
1. Check the Apps Script execution logs: **View** → **Logs**
2. Check backend logs: `tail -f /var/log/supervisor/backend.*.log`
3. Verify authorization and deployment status
