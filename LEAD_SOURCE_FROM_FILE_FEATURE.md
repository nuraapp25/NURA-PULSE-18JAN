# Lead Source from File Feature

## 🎯 Overview

The Driver Onboarding import now supports reading individual lead sources directly from the uploaded CSV/XLSX file. This allows you to import leads with different sources in a single batch.

---

## ✨ What's New

### 1. **Checkbox Feature**
- Added **"Read Source from file"** checkbox next to the "Lead Source" field
- When checked:
  - Lead Source input field becomes disabled
  - System reads source from the uploaded file
  - Each lead can have a different source

### 2. **File Format Requirements**

When using "Read Source from file", your CSV/XLSX must include a column named:
- `Lead Source` (recommended)
- `lead_source`
- `Source`
- `source`
- `LeadSource`
- `lead source`

The system will automatically detect any of these column names.

---

## 📝 How to Use

### **Option 1: Manual Lead Source (Original)**
1. Open Driver Onboarding page
2. Click "Import Leads"
3. Enter a single Lead Source (e.g., "Facebook Ad")
4. Enter Lead Date
5. Upload your CSV/XLSX file
6. All imported leads will have the same source

### **Option 2: Read Source from File (NEW)**
1. Open Driver Onboarding page
2. Click "Import Leads"
3. **Check the "Read Source from file" checkbox**
4. Lead Source field becomes disabled
5. Enter Lead Date
6. Upload your CSV/XLSX file with a "Lead Source" column
7. Each lead will get its source from the file

---

## 📊 File Format Examples

### **Format 1: Basic (4 columns + Lead Source)**

```csv
S. No.,Name,Vehicle,Phone Number,Lead Source
1,Rajesh Kumar,Two Wheeler,9876543210,Facebook Ad
2,Priya Sharma,Four Wheeler,9876543211,Google Ad
3,Amit Patel,Two Wheeler,9876543212,Referral
4,Sneha Reddy,None,9876543213,Walk-in
5,Vijay Singh,Two Wheeler,9876543214,Instagram Ad
```

### **Format 2: Full Form (8+ columns + Lead Source)**

Your existing 8-column Tamil format will work - just add a "Lead Source" column at the end:

```
Name | Age | Phone | DL | Experience | Interested EV | Salary | Location | Lead Source
```

---

## 🔄 How It Works

### **Frontend Changes:**
1. New checkbox appears next to "Lead Source" label
2. When checked:
   - Input field is disabled with placeholder "Will be read from file..."
   - Info message shows: "Lead sources will be read from a 'Lead Source' column in your file"
3. Validation updated:
   - If checkbox unchecked: Lead Source is required
   - If checkbox checked: Lead Source field is optional

### **Backend Processing:**
1. Receives `read_source_from_file` flag from frontend
2. Searches for Lead Source column in uploaded file
3. For each row:
   - Reads lead source from the file column
   - Stores it with the lead data
4. Data syncs to Google Sheets with individual sources

---

## 📥 Data Flow

```
Upload File with Lead Source Column
        ↓
Backend detects "Lead Source" column
        ↓
Each lead gets its own source value
        ↓
Stored in MongoDB (lead_source field)
        ↓
Synced to Google Sheets (Column M)
```

---

## ✅ Validation & Error Handling

### **When checkbox is checked:**
- ✅ System validates that file has a "Lead Source" column
- ❌ Error if column is missing: *"Lead Source column not found in file. Please ensure your file has a 'Lead Source' column."*
- ℹ️ Empty cells in Lead Source column will be stored as empty strings

### **Column Detection:**
The system looks for these column names (case-sensitive):
1. `Lead Source` ✅ Recommended
2. `lead_source`
3. `Source`
4. `source`
5. `LeadSource`
6. `lead source`

---

## 🎨 UI/UX Features

### **Visual Indicators:**
- **Checkbox unchecked:** Lead Source field is normal, required (*)
- **Checkbox checked:** 
  - Lead Source label shows without asterisk
  - Input field disabled with gray background
  - Blue info message displayed below
  - Placeholder text: "Will be read from file..."

### **Responsive Design:**
- Works on desktop and mobile
- Checkbox and label stack properly on small screens

---

## 📋 Sample Files

### **Test File Provided:**
Location: `/app/sample_leads_with_source.csv`

This file contains 5 sample leads with different sources:
- Facebook Ad
- Google Ad
- Referral
- Walk-in
- Instagram Ad

Use this to test the feature!

---

## 🔧 Technical Details

### **Frontend Updates:**
- File: `/app/frontend/src/pages/DriverOnboardingPage.jsx`
- New state: `readSourceFromFile`
- Updated validation logic
- Sends `read_source_from_file` flag to backend

### **Backend Updates:**
- File: `/app/backend/server.py`
- Endpoint: `POST /driver-onboarding/import-leads`
- Detects Lead Source column automatically
- Processes per-row source values
- Supports both formats (4-column and 8-column)

### **Database:**
- Field: `lead_source` (String)
- Stores individual source for each lead
- Syncs to Google Sheets Column M

---

## 🎯 Use Cases

### **1. Multi-Campaign Import**
Import leads from different marketing campaigns in one file:
- Facebook Ads
- Google Ads
- LinkedIn
- Instagram
- Walk-ins

### **2. Partner/Channel Tracking**
Track which partner or channel each lead came from:
- Partner A
- Partner B
- Direct
- Affiliate

### **3. Event Tracking**
Import leads from different events:
- Tech Conference 2024
- Job Fair Chennai
- Campus Drive IIT
- Community Meetup

---

## ⚠️ Important Notes

1. **Column Name:** Make sure your file has a column named exactly "Lead Source" (case-sensitive)
2. **Empty Values:** If a cell in Lead Source column is empty, that lead will have an empty source
3. **Mixed Mode:** You cannot use both manual input and file reading at the same time
4. **Date Still Required:** Lead Date is always required, even when reading source from file
5. **Backward Compatible:** Existing import functionality (manual source) still works as before

---

## 🚀 Next Steps

After importing leads with sources from file:
1. View them in the Driver Onboarding table
2. Sync to Google Sheets - Column M will show individual sources
3. Filter and analyze by lead source
4. Track conversion rates by source

---

## 📞 Troubleshooting

### **Problem: "Lead Source column not found" error**
**Solution:** 
- Check your file has a column named "Lead Source"
- Verify the column name spelling and case
- Ensure it's in the first row (header row)

### **Problem: Some leads have empty sources**
**Solution:**
- Check if those cells are empty in your file
- Fill in values or use manual input mode instead

### **Problem: Checkbox not appearing**
**Solution:**
- Refresh the page
- Check browser console for errors
- Ensure frontend is running

---

## ✨ Summary

**Before:** All leads in a batch got the same source  
**After:** Each lead can have its own source from the file

This feature makes bulk importing more flexible and accurate for tracking lead origins!

---

**Last Updated:** Lead Source from File Feature - December 2024
