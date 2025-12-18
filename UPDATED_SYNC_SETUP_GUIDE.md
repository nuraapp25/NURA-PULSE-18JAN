# Updated Google Sheets Sync Setup Guide

## Column Structure (Based on Your Excel)

Your Google Sheets should have these columns in Row 1:

| Column | Header |
|--------|--------|
| A | ID |
| B | Name |
| C | Phone Number |
| D | Vehicle |
| E | Driving License |
| F | Experience |
| G | Interested EV |
| H | Monthly Salary |
| I | Current Location |
| J | Lead Source |
| K | Stage |
| L | Status |
| M | Assigned Telecaller |
| N | Telecaller Notes |
| O | Notes |
| P | Import Date |
| Q | Created At |
| R | DL No. |
| S | Badge No. |
| T | Aadhar card |
| U | Pan card |
| V | Gas bill |
| W | Bank passbook |
| X | preferred shift |
| Y | alotted shift |
| Z | Default Vehicle |
| AA | Default Vehicle End Date |
| AB | Status |

## Setup Instructions

### Step 1: Prepare Your Google Sheet

1. **Open your Google Sheet** for Driver Onboarding
2. **Rename the sheet tab** to "Driver Leads" (exactly as written)
3. **Set up headers** in Row 1 exactly as shown in the table above
4. Make sure Row 1 has all 28 column headers from A to AB

### Step 2: Install the Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. **Delete any existing code** in the editor
3. **Copy the entire script** from `google-sheets-driver-onboarding-sync-updated.gs`
4. **Paste it** into the Apps Script editor
5. **Update the BACKEND_URL** in the CONFIG section:
   ```javascript
   BACKEND_URL: "https://fleetflow-8.preview.emergentagent.com/api"
   ```
6. **Save** the script (File → Save or Ctrl+S)
7. **Name your project** (e.g., "Nura Driver Sync")

### Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure:
   - **Description**: "Driver Onboarding Sync"
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
5. Click **Deploy**
6. **Authorize** the script (click "Authorize access")
7. **Copy the Web App URL** (it will look like: `https://script.google.com/macros/s/...`)

### Step 4: Update Backend Configuration

1. Go to your backend `.env` file at `/app/backend/.env`
2. Update or add the `GOOGLE_SHEETS_WEB_APP_URL`:
   ```
   GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/.../exec
   ```
3. **Restart your backend** to load the new configuration

### Step 5: Test the Sync

1. In your Google Sheet, go to the menu: **🔄 Nura Pulse Sync** → **📤 Sync to Backend**
2. The first time you run it, you'll need to authorize the script
3. Check the sync status in the notification at the bottom of the sheet

## How It Works

### Two-Way Sync

**From App to Sheets (Automatic):**
- When you create/update leads in the Driver Onboarding app
- The backend automatically sends updates to Google Sheets via the Web App URL
- New leads are added, existing leads are updated by ID

**From Sheets to App (Manual):**
- Use the menu: **🔄 Nura Pulse Sync** → **📤 Sync to Backend**
- All leads are sent to the backend
- Backend updates its database with the latest data

### ID-Based Sync

- The **ID** column (A) is the primary key
- Both systems use this ID to identify and update the same lead
- Never manually change IDs - they're automatically generated

## Troubleshooting

### Script Not Running?
- Check the Apps Script execution log (View → Executions)
- Make sure the BACKEND_URL is correct and includes `/api` at the end

### Sync Failing?
- Verify the Web App URL in your backend .env file
- Check that the deployment is set to "Anyone" for access
- Make sure the sheet name is exactly "Driver Leads"

### Headers Don't Match?
- Row 1 must have exactly 28 columns (A to AB)
- Column headers must be in the correct positions
- Check for extra spaces or typos

## New Columns Explained

**Document Fields (R-W):**
- DL No. - Driver License Number
- Badge No. - Badge Number
- Aadhar card - Aadhar Card Number
- Pan card - PAN Card Number
- Gas bill - Gas Bill Reference
- Bank passbook - Bank Account Number

**Shift & Vehicle (X-AA):**
- preferred shift - Driver's preferred working shift
- allotted shift - Assigned working shift
- Default Vehicle - Assigned vehicle ID
- Default Vehicle End Date - Vehicle assignment end date

**Status Fields:**
- Status (L) - Current onboarding status
- Status (AB) - Final status (appears to be duplicate, can be used for different purpose)

## Additional Notes

- The script automatically creates a menu in your Google Sheet
- You can manually trigger sync anytime from the menu
- All timestamps are in IST (Indian Standard Time)
- The sync preserves all data - it never deletes, only adds or updates
