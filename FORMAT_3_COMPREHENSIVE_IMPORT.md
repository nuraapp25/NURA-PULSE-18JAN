# Format 3: Comprehensive Lead Sheet Import

## 🎯 Overview

The app now supports a **third import format** - a comprehensive Excel format with 17 columns containing detailed lead information including Stage, Status, Training details, and more.

---

## 📊 Format Details

### **Column Structure (17 columns)**

| # | Column Name | Description | Maps To (App Field) |
|---|------------|-------------|---------------------|
| 1 | Sl.No | Serial Number | Ignored (auto-generated) |
| 2 | POC | Point of Contact | assigned_telecaller |
| 3 | Name | Lead's Full Name | name |
| 4 | Phone No | Contact Number | phone_number |
| 5 | Address | Full Address | current_location |
| 6 | Classroom Training | Training Status | driver_readiness |
| 7 | Ground Training | Training Status | docs_collection |
| 8 | Current Status | Current lead status | notes |
| 9 | Stage | Lead Stage | lead_stage |
| 10 | Status | Status Code | status (mapped to our codes) |
| 11 | Next Action | Action Items | telecaller_notes |
| 12 | Lead Creation Date | Date Created | lead_date |
| 13 | Lead Generator | Who generated lead | lead_source |
| 14 | DOJ | Date of Joining | Stored in notes |
| 15 | Status | Additional Status | Mapped to status |
| 16 | DOR | Date of Resignation | Stored in notes |
| 17 | Remarks | Additional Notes | notes |

---

## 🔄 Stage & Status Mapping

The system intelligently maps your external stages to our internal status system:

### **External Stage → Internal Status**

| Your Stage | Your Status | Our Status Code | Our Status Label |
|-----------|-------------|-----------------|------------------|
| DOCS_COLLECTION | Any | `Docs Upload Pending` | S2-a Docs Upload Pending |
| ROAD_TEST | Any | `Training WIP` | S3-b Training WIP |
| FILTERING | Any | `New` | S1-c Highly Interested |
| (Other) | Any | `New` | Default initial status |

**Note:** This mapping can be customized based on your workflow needs.

---

## 📥 Sample Data Format

### **Excel Structure:**

```
Row 1: [Empty or Title Row - Ignored]
Row 2: Headers (Sl.No, POC, Name, Phone No, Address, ...)
Row 3+: Data rows
```

### **Example Data:**

| Sl.No | POC | Name | Phone No | Address | Stage | Status | Lead Generator |
|-------|-----|------|----------|---------|-------|--------|----------------|
| 1 | - | Uma M | 8608522051 | Chennai - 600057 | DOCS_COLLECTION | REJECTED | Bhavani |
| 2 | - | Shanthi | 8438307206 | Chennai - 600052 | DOCS_COLLECTION | Not Interested | Bhavani |
| 3 | - | Saravanan | 9710204392 | Chennai - 600085 | DOCS_COLLECTION | Agreement_Pending | Bhavani |

---

## ✨ Key Features

### 1. **Auto-Detection**
- System automatically detects Format 3 by checking for headers
- Looks for keywords: "Sl.No", "Name", "Phone No", "Address"
- No manual format selection needed

### 2. **Smart Mapping**
- External stages/statuses mapped to internal system
- Multiple columns combined into appropriate fields
- Preserves all original data in notes/telecaller notes

### 3. **Lead Source Handling**
- Uses "Lead Generator" column as `lead_source`
- Respects "Read Source from file" checkbox
- Falls back to manual input if column empty

### 4. **Date Handling**
- Reads "Lead Creation Date" if available
- Uses manual Lead Date input as fallback
- DOJ (Date of Joining) stored for reference

### 5. **Training Status**
- Classroom Training → `driver_readiness`
- Ground Training → `docs_collection`
- Preserves original training status values

---

## 🚀 How to Import

### **Step 1: Prepare Your File**

Ensure your Excel file has:
- Headers in Row 1 or Row 2
- At minimum: Name, Phone No, Address columns
- Optional: Stage, Status, Lead Generator, etc.

### **Step 2: Import Process**

1. Open **Driver Onboarding** page
2. Click **"Import Leads"** button
3. Select **Lead Date** (required)
4. For Lead Source:
   - **Option A:** Check "Read Source from file" (uses "Lead Generator" column)
   - **Option B:** Enter manually (applies to all leads)
5. Upload your Excel file
6. Click **"Import Leads"**

### **Step 3: Verification**

After import:
- Check leads appear in table
- Verify statuses are correctly mapped
- Click on a lead to see full details
- Sync to Google Sheets to verify column mapping

---

## 📋 Import Behavior

### **Field Priority (when column exists):**

1. **Name:** Always from "Name " column
2. **Phone:** Always from "Phone No" column
3. **Address:** From "Address " column → `current_location`
4. **Lead Source:**
   - If checkbox checked: "Lead Generator" column
   - Else: Manual input
5. **Lead Date:**
   - If "Lead Creation Date" exists: Use it
   - Else: Manual input
6. **Status:** Mapped from "Stage" and "Status" columns
7. **Training:** From "Classroom Training " and "Ground Trainig"

### **Empty Cells:**
- Empty cells are stored as empty strings or None
- Phone number is required (rows with empty phone are skipped)
- Name is required (rows with empty name are skipped)

---

## 🔍 Detection Logic

The system detects Format 3 when:

```python
# Check if first row contains header keywords
first_row_has: 'Sl.No' OR 'Name' OR 'Phone No' OR 'Address'

# If true:
#   - Use first row as headers
#   - Process remaining rows as data
#   - Apply comprehensive field mapping
```

---

## 📊 What Gets Stored

### **MongoDB Structure:**

```json
{
  "id": "uuid-generated",
  "name": "Uma M",
  "phone_number": "8608522051",
  "current_location": "Plot No:76, ..., Chennai - 600057",
  "lead_source": "Bhavani",
  "lead_date": "2024-01-15",
  "lead_stage": "DOCS_COLLECTION",
  "status": "Docs Upload Pending",
  "driver_readiness": "Completed",
  "docs_collection": "Completed",
  "assigned_telecaller": null,
  "telecaller_notes": "0",
  "notes": null,
  "import_date": "2024-10-23T...",
  "created_at": "2024-10-23T..."
}
```

### **Google Sheets (Column M = Lead Source):**

When synced, the "Lead Generator" value appears in Column M.

---

## ⚠️ Important Notes

### **1. Phone Number Format**
- Accepts 10-digit numbers
- International formats supported
- Auto-strips spaces and special characters

### **2. Duplicate Detection**
- System checks for duplicate phone numbers
- Shows duplicate dialog if found
- Choose: Skip, Replace, or Keep Both

### **3. Required Fields**
- **Name:** Must be present
- **Phone No:** Must be present
- **Lead Date:** Must be entered manually (or read from file)

### **4. Optional Fields**
All other columns are optional:
- POC
- Classroom/Ground Training
- Current Status
- Next Action
- DOJ, DOR, Remarks

### **5. Status Mapping**
Current mapping is basic. For advanced mapping:
- Edit `server.py` line ~850
- Add custom stage → status logic
- Restart backend

---

## 🎨 Visual Example

### **Your Excel File:**

```
┌─────┬─────┬───────────┬────────────┬─────────────────┬─────────┬────────┐
│Sl.No│ POC │   Name    │  Phone No  │    Address      │  Stage  │ Status │
├─────┼─────┼───────────┼────────────┼─────────────────┼─────────┼────────┤
│  1  │  -  │  Uma M    │ 8608522051 │ Chennai-600057  │ DOCS... │REJECTED│
│  2  │  -  │ Shanthi   │ 8438307206 │ Chennai-600052  │ DOCS... │  Not I.│
└─────┴─────┴───────────┴────────────┴─────────────────┴─────────┴────────┘
```

### **After Import (App Table):**

```
┌────┬───────────┬────────────┬─────────────────┬──────────────────────┐
│ #  │   Name    │   Phone    │    Location     │       Status         │
├────┼───────────┼────────────┼─────────────────┼──────────────────────┤
│ 1  │  Uma M    │ 8608522051 │ Chennai-600057  │ S2-a Docs Upload...  │
│ 2  │ Shanthi   │ 8438307206 │ Chennai-600052  │ S2-a Docs Upload...  │
└────┴───────────┴────────────┴─────────────────┴──────────────────────┘
```

---

## 🧪 Testing

### **Test File Provided:**
**Location:** `/app/sample_lead_sheet_format3.xlsx`

This is the actual file you uploaded, containing 10 sample leads.

### **Test Steps:**

1. Download or use `/app/sample_lead_sheet_format3.xlsx`
2. Go to Driver Onboarding → Import Leads
3. Check "Read Source from file"
4. Select today's date
5. Upload the file
6. Click Import
7. Verify leads appear with correct data

---

## 🔧 Troubleshooting

### **Problem: "Unsupported format" error**
**Solution:**
- Ensure headers are in Row 1 or Row 2
- Check that "Name " and "Phone No" columns exist
- Verify file is .xlsx or .csv format

### **Problem: No leads imported**
**Solution:**
- Check if rows have empty Name or Phone
- Look for data starting from Row 3 onwards
- Ensure at least one valid row exists

### **Problem: Wrong status mapping**
**Solution:**
- Check your "Stage" column values
- Contact admin to update mapping logic
- Or manually update status after import

### **Problem: Lead source not appearing**
**Solution:**
- Verify "Lead Generator" column exists
- Check "Read Source from file" is checked
- Ensure column has values (not empty)

---

## 📈 Comparison with Other Formats

| Feature | Format 1 | Format 2 | Format 3 ⭐ |
|---------|----------|----------|------------|
| Columns | 4 | 8 | 17 |
| Complexity | Basic | Medium | Advanced |
| Stage Tracking | ❌ | ❌ | ✅ |
| Training Status | ❌ | ❌ | ✅ |
| Lead Source Auto | ❌ | ❌ | ✅ (from file) |
| Detailed Address | ❌ | ✅ | ✅ |
| POC/Telecaller | ❌ | ❌ | ✅ |
| Action Items | ❌ | ❌ | ✅ |
| Date Tracking | ❌ | ❌ | ✅ (DOJ, DOR) |

---

## 💡 Best Practices

### **1. Maintain Column Names**
Keep exact column names for auto-detection:
- "Name " (with space)
- "Phone No"
- "Address " (with space)
- "Lead Generator"

### **2. Clean Data**
- Remove extra rows/columns
- Ensure phone numbers are numeric
- Fill required fields (Name, Phone)

### **3. Regular Syncs**
- Import new leads regularly
- Sync to Google Sheets after each import
- Backup Excel file before importing

### **4. Use Lead Generator Column**
- Populate "Lead Generator" for tracking
- Helps identify source campaigns
- Enables better analytics

### **5. Stage Consistency**
- Use consistent stage names
- Match your workflow stages
- Update mapping logic as needed

---

## 🎯 Use Cases

### **Use Case 1: Bulk Import from Training Center**
- Training center sends Excel with all lead details
- Includes training completion status
- Import maintains all information
- Team sees current stage instantly

### **Use Case 2: Multi-Source Campaign**
- Different lead generators in same file
- "Lead Generator" column has unique values
- Import preserves source tracking
- Easy to filter by generator later

### **Use Case 3: Status Tracking**
- External system exports current stages
- Import maps to internal statuses
- Team continues from correct stage
- No manual status updates needed

---

## ✅ Summary

**What's New:**
- ✅ Support for 17-column comprehensive format
- ✅ Auto-detection of format based on headers
- ✅ Smart stage/status mapping
- ✅ Lead Generator column for source tracking
- ✅ Training status preservation
- ✅ Action items and notes import
- ✅ Date tracking (DOJ, DOR, Lead Creation)

**Benefits:**
- 📊 Import complex lead data without manual entry
- 🔄 Maintain consistency across systems
- 📈 Track lead progression from external sources
- ⚡ Faster onboarding for existing databases
- 🎯 Better analytics with detailed fields

---

**Sample File:** `/app/sample_lead_sheet_format3.xlsx`  
**Last Updated:** Format 3 Comprehensive Import - December 2024
