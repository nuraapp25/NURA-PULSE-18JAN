# Google Sheets Integration Deployment Guide

## Step 1: Prepare Your Google Sheet

1. **Create a new Google Sheet** or use an existing one
2. **Copy the Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
   ```
3. The script will automatically create tabs for each month/year (e.g., "Sep 2025", "Oct 2025")

## Step 2: Deploy the Google Apps Script

### A. Open Apps Script Editor

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Delete any existing code in the editor
3. Copy the entire contents of `/app/PAYMENT_RECONCILIATION_APPS_SCRIPT_V2.js`
4. Paste it into the Apps Script editor

### B. Configure the Script

Find these lines at the top and update them:

```javascript
const CONFIG = {
  SHEET_ID: 'YOUR_SHEET_ID_HERE', // Replace with your Sheet ID from Step 1
  BACKEND_URL: 'YOUR_BACKEND_URL_HERE' // Replace with: https://driver-onboard-4.preview.emergentagent.com/api
};
```

**Update to:**
```javascript
const CONFIG = {
  SHEET_ID: '1CLhARhllhqZuDzkzNRqFcOGqjrSDzPgmC6gd3-AWOTs', // Your actual Sheet ID
  BACKEND_URL: 'https://driver-onboard-4.preview.emergentagent.com/api'
};
```

### C. Save and Deploy

1. Click **Save** (disk icon)
2. Name your project (e.g., "Payment Reconciliation Sync")
3. Click **Deploy > New deployment**
4. Click the gear icon ⚙️ next to "Select type"
5. Choose **Web app**

### D. Configure Deployment Settings

Set the following:
- **Description**: "Payment Reconciliation Sync"
- **Execute as**: Me (your email)
- **Who has access**: Anyone
  
Click **Deploy**

### E. Authorize the Script

1. Click **Authorize access**
2. Choose your Google account
3. Click **Advanced** if you see a warning
4. Click **Go to [Project Name] (unsafe)**
5. Click **Allow**

### F. Copy the Web App URL

After authorization, you'll see:
```
Web app URL: https://script.google.com/macros/s/XXXXX/exec
```

**Copy this entire URL** - you'll need to provide it to update the backend.

## Step 3: Update Backend Configuration

Once you have the Web App URL (e.g., `https://script.google.com/macros/s/XXXXX/exec`), provide it to me and I'll add it to the backend environment variables.

The URL will be stored in: `/app/backend/.env` as `PAYMENT_SHEETS_APPS_SCRIPT_URL`

## Step 4: Test the Integration

### Test from Apps Script Editor:

1. In Apps Script editor, select **testSyncFromBackend** from the function dropdown
2. Click **Run**
3. Check the **Execution log** for results
4. Verify a new tab "Sep 2025" was created with test data

### Test from the App:

1. Navigate to Payment Reconciliation
2. Create/Select a folder
3. Upload screenshots and process
4. Wait 10 seconds - data should auto-sync to Google Sheets
5. Check your Google Sheet for the new data

## Features of the Updated Script

### ✅ Automatic Tab Creation
- Creates a new tab for each month/year automatically
- Tab name format: "Sep 2025", "Oct 2025", etc.

### ✅ Complete Data Structure
All fields are synced:
- Driver Name, Vehicle Number
- Description (with surge/cancelled indicators)
- Date, Time, Amount
- Payment Mode
- Distance (km), Duration (min)
- Pickup/Drop KM and Locations
- Screenshot filename
- Record ID (hidden column)
- Status

### ✅ Formatting
- Bold header row with blue background
- Frozen header row
- Auto-resized columns
- Alternating row colors
- Amount formatted as ₹ currency
- Hidden Record ID column
- Center-aligned date/time/metrics

### ✅ Bidirectional Sync
- **From Backend to Sheets**: Automatic after file processing
- **From Sheets to Backend**: Manual sync button (future enhancement)

## Troubleshooting

### Issue: Authorization Error
**Solution**: Make sure "Who has access" is set to "Anyone"

### Issue: Sheet Not Found
**Solution**: Verify SHEET_ID is correct in CONFIG

### Issue: No Data Appearing
**Solution**: 
1. Check Apps Script execution logs
2. Verify backend URL is correct
3. Test using `testSyncFromBackend()` function

### Issue: Permission Denied
**Solution**: Re-authorize the script (Deploy > Manage deployments > Edit > Authorize)

## Data Structure

### MongoDB Record → Google Sheet Row

```
{
  id: "uuid",
  driver: "Abdul",
  vehicle: "TN07CE2222",
  description: "Auto (Surge)",
  date: "29/09/2024",
  time: "8:48 PM",
  amount: "92.44",
  payment_mode: "Cash",
  distance: "3.57",
  duration: "16",
  pickup_km: "N/A",
  drop_km: "N/A",
  pickup_location: "N/A",
  drop_location: "N/A",
  screenshot_filename: "IMG-20251003-WA0039.jpg",
  status: "pending"
}
```

Maps to columns A-P in Google Sheets.

## Next Steps

After deployment, provide me with:
1. ✅ Your Google Sheet ID
2. ✅ The Web App URL from Step 2F

I'll update the backend configuration to complete the integration!
