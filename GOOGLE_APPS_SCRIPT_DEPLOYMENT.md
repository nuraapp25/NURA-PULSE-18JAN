# Google Apps Script Deployment Guide for Nura Pulse

## Step 1: Open Your Google Sheet

1. Go to your Google Sheet: https://docs.google.com/spreadsheets/d/1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY/edit
2. Note your Spreadsheet ID from the URL (the part between `/d/` and `/edit`)
   - In your case: `1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY`

## Step 2: Open Apps Script Editor

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. This will open the Apps Script editor in a new tab

## Step 3: Replace the Code

1. Delete any existing code in the editor
2. Copy the ENTIRE contents of `COMPLETE_GOOGLE_APPS_SCRIPT.js`
3. Paste it into the Apps Script editor
4. **IMPORTANT**: Find line 10 and replace `YOUR_SPREADSHEET_ID` with your actual ID:

```javascript
// BEFORE:
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';

// AFTER:
const SPREADSHEET_ID = '1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY';
```

5. Save the project (File → Save or Ctrl+S)
6. Give it a name like "Nura Pulse Sync"

## Step 4: Test the Setup (Optional but Recommended)

1. In the Apps Script editor, select the function dropdown at the top
2. Select **testSetup** from the dropdown
3. Click the **Run** button (▶️)
4. You may be prompted to authorize the script:
   - Click **Review permissions**
   - Choose your Google account
   - Click **Advanced** → **Go to [Project Name] (unsafe)**
   - Click **Allow**
5. Check the **Execution log** - you should see messages like:
   - "Spreadsheet Name: [Your Sheet Name]"
   - "Sheet exists: Users"
   - "Sheet exists: Leads"
   - etc.

## Step 5: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Select **Web app**
4. Configure the deployment:
   - **Description**: "Nura Pulse API v1"
   - **Execute as**: **Me** (your email)
   - **Who has access**: **Anyone**
5. Click **Deploy**
6. You may need to authorize again - follow the same steps as before
7. **IMPORTANT**: Copy the **Web app URL** that appears
   - It will look like: `https://script.google.com/macros/s/XXXXXXX/exec`

## Step 6: Update Backend Configuration

1. Go to your Nura Pulse backend `.env` file
2. Update the `GOOGLE_SHEETS_WEB_APP_URL` with your new URL:

```env
GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/XXXXXXX/exec
```

3. Restart your backend server

## Step 7: Verify the Setup

### Test 1: Check Sheet Creation
1. Go to your Google Sheet
2. You should see these tabs (they'll be created automatically on first sync):
   - Users
   - Leads (with 12 columns including Status in Column L)
   - Payment Reconciliation
   - Driver Onboarding
   - Telecaller Queue
   - Montra Vehicle Insights

### Test 2: Test from Nura Pulse App
1. Login to Nura Pulse
2. Go to Driver Onboarding
3. Select a lead and change its status to "Rejected"
4. Check your Google Sheet → Leads tab → Column L
5. You should see "Rejected" in Column L for that lead

### Test 3: Check Last Sync Time
1. After changing the status, look at the Driver Onboarding header
2. You should see: "Last synced: [timestamp]"

## What's New in This Script

### ✅ Leads Tab - 12 Columns Including Status

The Leads tab now has proper mapping for ALL fields:

| Column | Field | Example |
|--------|-------|---------|
| A | S. No. | 1 |
| B | Name | Guna sekar |
| C | Phone Number | 9962164683 |
| D | Vehicle | Auto |
| E | Driving License | Yes |
| F | Experience | 5 years |
| G | Interested in EV | Yes |
| H | Monthly Salary | 25000 |
| I | Residing Chennai | - |
| J | Current Location | Chennai |
| K | Import Date | 10/10/2025 12:12:42 |
| **L** | **Status** | **Rejected** ✅ |

### ✅ All Status Values Supported

- New
- Contacted
- Interested
- Documents Pending
- Scheduled
- Onboarded
- Rejected
- Not Interested

### ✅ Automatic Sheet Creation

The script automatically creates all required sheets with proper headers on first use.

### ✅ Auto-Resize Columns

For better visibility, the Leads sheet automatically resizes columns after sync.

### ✅ Date Formatting

All dates are formatted as: `MM/DD/YYYY HH:MM:SS`

## Troubleshooting

### Issue: "Script not authorized"
**Solution**: Follow Step 4 to authorize the script with your Google account

### Issue: "Sheet not found"
**Solution**: Make sure you replaced `YOUR_SPREADSHEET_ID` with your actual Sheet ID

### Issue: Status not showing in Column L
**Solution**: 
1. Check that the Leads sheet has a header "Status" in Column L
2. Try manually syncing from the app using "Sync to Sheets" button
3. Check the Apps Script execution logs for errors

### Issue: Web App URL not working
**Solution**:
1. Make sure you deployed it as "Anyone" can access
2. Copy the EXACT URL including `/exec` at the end
3. Don't use the test URL - use the deployment URL

## Updating the Script

If you need to make changes:
1. Edit the code in the Apps Script editor
2. Save the changes
3. Click **Deploy** → **Manage deployments**
4. Click the pencil icon ✏️ next to your deployment
5. Under "Version", select **New version**
6. Click **Deploy**

The Web App URL stays the same, so you don't need to update the backend .env file.

## Support

If you encounter issues:
1. Check the Apps Script execution log (View → Logs)
2. Check your backend logs for sync errors
3. Verify the GOOGLE_SHEETS_WEB_APP_URL in your .env file
4. Make sure GOOGLE_SHEETS_ENABLED=true in your .env file

## Security Notes

- The script runs as YOU, so it has access to your Google Sheet
- "Anyone" can access means anyone with the URL can call it
- The URL acts as the security key - don't share it publicly
- All data is only written to YOUR Google Sheet
- The Nura Pulse backend is the only system that should know this URL
