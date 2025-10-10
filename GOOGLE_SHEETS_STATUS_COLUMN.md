# Google Sheets Status Column Configuration

## Issue
The status field needs to be synced to **Column L** in the "Leads" tab of your Google Sheet.

## Current Backend Implementation ✅

The backend is already sending the `status` field with every lead record:

```json
{
  "id": "...",
  "name": "Guna sekar",
  "phone_number": "9962164683",
  "vehicle": "Auto",
  "driving_license": "Yes",
  "experience": "5 years",
  "interested_ev": "Yes",
  "monthly_salary": "25000",
  "residing_chennai": null,
  "current_location": "Chennai",
  "import_date": "2025-10-10T12:12:42.762957+00:00",
  "status": "Rejected"  ← This field is being sent
}
```

## Google Apps Script Configuration Needed

Your Google Apps Script Web App needs to properly map the `status` field to Column L.

### Expected Column Structure in "Leads" Tab:

| Column | Field | Example |
|--------|-------|---------|
| A | S.No. | 1 |
| B | Name | Guna sekar |
| C | Phone Number | 9962164683 |
| D | Vehicle | Auto |
| E | Driving License | Yes |
| F | Experience | 5 years |
| G | Interested in EV | Yes |
| H | Monthly Salary | 25000 |
| I | Residing Chennai | (optional) |
| J | Current Location | Chennai |
| K | Import Date | 10/10/2025 |
| **L** | **Status** | **Rejected** |

### Apps Script Mapping Example

In your `doPost(e)` function in Google Apps Script, ensure the Leads tab mapping includes the status field:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  const tab = data.tab;
  
  if (tab === 'leads') {
    const ss = SpreadsheetApp.openById('YOUR_SHEET_ID');
    const sheet = ss.getSheetByName('Leads');
    
    if (action === 'sync_all') {
      const records = data.records;
      
      // Clear existing data (except headers)
      if (sheet.getLastRow() > 1) {
        sheet.deleteRows(2, sheet.getLastRow() - 1);
      }
      
      // Add all records
      const rows = records.map((record, index) => [
        index + 1,                          // A: S.No.
        record.name || '',                  // B: Name
        record.phone_number || '',          // C: Phone
        record.vehicle || '',               // D: Vehicle
        record.driving_license || '',       // E: License
        record.experience || '',            // F: Experience
        record.interested_ev || '',         // G: EV Interest
        record.monthly_salary || '',        // H: Salary
        record.residing_chennai || '',      // I: Residing
        record.current_location || '',      // J: Location
        record.import_date || '',           // K: Import Date
        record.status || 'New'              // L: Status ← ADD THIS
      ]);
      
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 12).setValues(rows);  // 12 columns now
      }
      
      return ContentService.createTextOutput(
        JSON.stringify({success: true, message: 'Synced ' + records.length + ' leads'})
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'sync_single') {
      const record = data.record;
      
      // Find existing row by ID or add new
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12);
      const values = dataRange.getValues();
      
      let rowIndex = -1;
      for (let i = 0; i < values.length; i++) {
        if (values[i][1] === record.name && values[i][2] === record.phone_number) {
          rowIndex = i + 2; // +2 because row 1 is header and array is 0-indexed
          break;
        }
      }
      
      const rowData = [
        rowIndex > 0 ? values[rowIndex - 2][0] : sheet.getLastRow(),  // S.No.
        record.name || '',
        record.phone_number || '',
        record.vehicle || '',
        record.driving_license || '',
        record.experience || '',
        record.interested_ev || '',
        record.monthly_salary || '',
        record.residing_chennai || '',
        record.current_location || '',
        record.import_date || '',
        record.status || 'New'  // L: Status ← ADD THIS
      ];
      
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, 12).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
      
      return ContentService.createTextOutput(
        JSON.stringify({success: true, message: 'Updated lead'})
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // ... other tabs handling
}
```

## Important Notes

1. **Column Count**: Make sure you're writing to 12 columns (A-L), not 11
2. **Default Value**: Use `record.status || 'New'` to provide a default if status is missing
3. **Header Row**: Ensure Row 1 has "Status" in Column L
4. **Sync Order**: Status should be the LAST column in the row array

## Testing the Configuration

After updating your Apps Script:

1. Go to Driver Onboarding in the app
2. Select any lead and change its status to "Rejected"
3. Click "Sync to Sheets" button
4. Check Column L in your Google Sheet - it should show "Rejected"

## Automatic Sync

The app now automatically syncs after:
- ✅ Importing new leads
- ✅ Editing lead details
- ✅ Changing individual lead status
- ✅ Bulk status updates
- ✅ Manual sync button click

The last sync time is displayed in the header as: **"Last synced: 10/10/2025, 1:41:20 PM"**

## Status Values

The app uses these status values:
- New
- Contacted
- Interested
- Documents Pending
- Scheduled
- Onboarded
- Rejected
- Not Interested

All these will be synced to Column L in Google Sheets.
