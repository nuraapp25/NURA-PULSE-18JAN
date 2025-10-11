# Google Apps Script Deployment Guide for Nura Pulse

## 📋 Complete Updated Script

The complete Google Apps Script is available in `/app/COMPLETE_GOOGLE_APPS_SCRIPT.js`

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Get Your Google Sheet ID

1. Open your Google Sheet
2. Look at the URL in your browser:
   ```
   https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit
                                          ^^^^^^^^^^^^^^^^^^
                                          This is your Sheet ID
   ```
3. Copy the Sheet ID (the long string between `/d/` and `/edit`)

### Step 2: Open Apps Script Editor

1. In your Google Sheet, go to **Extensions** → **Apps Script**
2. This will open the Apps Script editor in a new tab

### Step 3: Replace the Script

1. Delete all existing code in the editor
2. Copy the entire script from `/app/COMPLETE_GOOGLE_APPS_SCRIPT.js`
3. Paste it into the Apps Script editor
4. **IMPORTANT**: On line 10, replace `'YOUR_SPREADSHEET_ID'` with your actual Sheet ID:
   ```javascript
   const SPREADSHEET_ID = '1a2b3c4d5e6f7g8h9i0j'; // Your actual Sheet ID
   ```

### Step 4: Save the Script

1. Click the **Save** icon (💾) or press `Ctrl+S` (Windows) / `Cmd+S` (Mac)
2. Give your project a name (e.g., "Nura Pulse Sync")

### Step 5: Deploy as Web App

1. Click **Deploy** button (top right) → Select **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure the deployment:
   - **Description**: `Nura Pulse - Montra Feed Import` (or any description)
   - **Execute as**: Select **Me (your-email@gmail.com)**
   - **Who has access**: Select **Anyone**
5. Click **Deploy**

### Step 6: Authorize the Script

1. A popup will appear asking for authorization
2. Click **Authorize access**
3. Select your Google account
4. You may see a warning "Google hasn't verified this app"
   - Click **Advanced**
   - Click **Go to [Your Project Name] (unsafe)**
5. Click **Allow** to grant permissions

### Step 7: Copy the Web App URL

1. After deployment, you'll see a **Web app URL** like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```
2. **Copy this entire URL**

### Step 8: Update Backend Configuration

1. Open `/app/backend/.env` file
2. Update the `GOOGLE_SHEETS_WEB_APP_URL` with your new URL:
   ```
   GOOGLE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/AKfycby.../exec
   ```
3. Save the file
4. Restart the backend:
   ```bash
   sudo supervisorctl restart backend
   ```

## ✅ Verify the Setup

### Test the Script Manually

1. In Apps Script editor, click **Run** → Select `testSetup`
2. Check the **Execution log** (View → Logs)
3. You should see:
   ```
   Spreadsheet Name: [Your Sheet Name]
   Script is working correctly!
   Sheet exists: Users
   Sheet exists: Leads
   ...
   Setup complete!
   ```

### Test from the App

1. Navigate to **Montra Vehicle Insights** in your Nura Pulse app
2. Click **Import Montra Feed**
3. Upload the sample CSV file
4. Check if:
   - Import succeeds with success message
   - "Montra Feed Data" tab is created in your Google Sheet
   - Data appears in columns D to AB starting from row 2

## 📊 What Gets Created

After successful import, your Google Sheet will have a new tab **"Montra Feed Data"** with:

### Column Structure:
- **Columns A, B, C**: Empty (reserved for future use)
- **Columns D to X**: CSV data (21 columns from the uploaded file)
- **Column Y**: Vehicle ID (extracted from filename)
- **Column Z**: Separator (`-`)
- **Column AA**: Day (e.g., `01`)
- **Column AB**: Month (e.g., `Sep`)

### Row Structure:
- **Row 1**: Headers (bold, in columns D to AB)
- **Row 2+**: Data rows (imported from CSV, appended for each import)

## 🔧 Troubleshooting

### Issue: "Unknown tab: Montra Feed Data"
**Solution**: Make sure you deployed the NEW version of the script (not the old one)

### Issue: "Authorization required"
**Solution**: 
1. Go back to Apps Script editor
2. Click Deploy → Manage deployments
3. Click ✏️ Edit on your deployment
4. Click Deploy again
5. Re-authorize if prompted

### Issue: Import succeeds but no data in sheet
**Solution**:
1. Check the Apps Script execution logs (View → Executions)
2. Look for any error messages
3. Verify your Sheet ID is correct in line 10

### Issue: "Failed to sync to Google Sheets"
**Solution**:
1. Verify GOOGLE_SHEETS_WEB_APP_URL is correctly set in backend/.env
2. Restart backend: `sudo supervisorctl restart backend`
3. Make sure the Web App URL is the full URL including `/exec`

## 🎯 Key Features of Updated Script

✅ **Montra Feed Data Import**: New action `import_montra_feed`
✅ **Automatic Tab Creation**: Creates "Montra Feed Data" if doesn't exist
✅ **Column Mapping**: Maps CSV columns A-U to Sheet columns D-X
✅ **Filename Extraction**: Extracts Vehicle ID, Day, Month from filename
✅ **Append Mode**: New imports append to existing data
✅ **Headers Management**: Sets up headers on first import

## 📞 Support

If you encounter issues:
1. Check Apps Script execution logs
2. Verify backend logs: `tail -f /var/log/supervisor/backend.err.log`
3. Ensure Google Sheets API is enabled for your account
4. Make sure the Web App is deployed with "Anyone" access

## 🔄 Updating the Script Later

If you need to update the script:
1. Make changes in Apps Script editor
2. Save the script
3. **Deploy → Manage deployments**
4. Click ✏️ **Edit** on existing deployment
5. **Version**: Select "New version"
6. Click **Deploy**
7. The Web App URL remains the same (no need to update backend)
