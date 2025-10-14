# Google Apps Script - Deployment Instructions

## Step 1: Open Your Google Sheet
URL: https://docs.google.com/spreadsheets/d/1CLhARhllhqZuDzkzNRqFcOGqjrSDzPgmC6gd3-AWOTs/edit

## Step 2: Open Apps Script Editor
1. Click **Extensions** → **Apps Script**
2. A new tab will open with the script editor

## Step 3: Delete Old Code
1. Select ALL existing code in the editor
2. Press Delete or Backspace to clear it
3. The editor should be completely empty

## Step 4: Copy New Script
1. Open the file: `/app/FINAL_GOOGLE_APPS_SCRIPT.js`
2. Copy ALL the code (from first line to last line)
3. Paste it into the empty Apps Script editor

## Step 5: Save the Script
1. Click the **Save** icon (💾) or press `Ctrl+S` (Windows) / `Cmd+S` (Mac)
2. Give it a name: "Payment Data Extractor Sync"

## Step 6: Test the Script (Optional but Recommended)
1. In the function dropdown at the top, select: **testSync**
2. Click the **Run** button (▶️)
3. **First time only**: You'll need to authorize:
   - Click "Review Permissions"
   - Choose your Google account
   - Click "Advanced"
   - Click "Go to Payment Data Extractor Sync (unsafe)"
   - Click "Allow"
4. After authorization, check your spreadsheet:
   - A new tab "Test Oct 2025" should appear
   - It should have 2 test records
5. You can delete this test tab after verification

## Step 7: Deploy as Web App
1. Click **Deploy** → **New deployment**
2. Click the gear icon (⚙️) next to "Select type"
3. Select **Web app**
4. Configure settings:
   - **Description**: Payment Data Extractor Sync V2
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
5. Click **Deploy**
6. **IMPORTANT**: Copy the "Web app URL" that appears
   - It will look like: `https://script.google.com/macros/s/AKfycby.../exec`
   - You'll need this for the next step

## Step 8: Update Backend with New URL
After deployment, send me the new URL and I'll update the backend.

## Step 9: Test the Sync
1. Go to Payment Data Extractor in your app
2. Select "Sep 2025" folder
3. Upload a test screenshot
4. Click "Process"
5. Fill in any N/A values
6. Click "Sync to Google Sheets"
7. Check your Google Sheet - "Sep 2025" tab should have the data
