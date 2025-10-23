# Complete Import Formats Guide

## 🎯 Overview

The Driver Onboarding system supports **3 import formats** to accommodate different data sources and levels of detail.

---

## 📊 Format Comparison

| Feature | Format 1 | Format 2 | Format 3 |
|---------|----------|----------|----------|
| **Name** | Basic | Tamil Questions | Comprehensive |
| **Columns** | 4 | 8 | 17 |
| **File Type** | CSV/XLSX | CSV/XLSX | XLSX |
| **Use Case** | Simple imports | Google Forms | External systems |
| **Auto-Detection** | ✅ Column count | ✅ Column count | ✅ Headers |
| **Lead Source** | Manual | Manual | Auto (from file) |
| **Training Status** | ❌ | ❌ | ✅ |
| **Stage Tracking** | ❌ | ❌ | ✅ |
| **Complexity** | ⭐ Easy | ⭐⭐ Medium | ⭐⭐⭐ Advanced |

---

## 📋 Format 1: Basic (4 Columns)

### **Structure:**
```csv
S. No., Name, Vehicle, Phone Number
1, Rajesh Kumar, Two Wheeler, 9876543210
2, Priya Sharma, Four Wheeler, 9876543211
```

### **Columns:**
1. **S. No.** - Serial number (ignored)
2. **Name** - Lead's full name
3. **Vehicle** - Vehicle type
4. **Phone Number** - Contact number

### **When to Use:**
- Quick imports from simple lists
- Basic lead collection
- Minimal information available

### **What's Stored:**
- ✅ Name
- ✅ Phone number
- ✅ Vehicle type
- ⚪ All other fields = defaults

### **Sample File:**
`/app/sample_leads_with_source.csv` (add "Lead Source" column for Format 1 with source tracking)

---

## 📋 Format 2: Tamil Questions (8 Columns)

### **Structure:**
```
Name, Age, Phone, DL, Experience, Interested EV, Salary, Location
Rajesh, 25, p:+919876543210, Yes, 3 years, Yes, 25000, Chennai
```

### **Columns:**
1. **Name** - Full name
2. **Age** - Age (optional)
3. **Phone** - Phone with p:+91 prefix
4. **Driving License** - DL status
5. **Experience** - Driving experience
6. **Interested in EV** - EV interest
7. **Monthly Salary** - Salary expectation
8. **Location** - Current location

### **When to Use:**
- Google Form exports
- Detailed lead qualification
- Tamil language forms
- Pre-screened candidates

### **What's Stored:**
- ✅ Name
- ✅ Phone (auto-cleaned from p:+91 format)
- ✅ DL, Experience, EV Interest
- ✅ Salary, Location
- ⚪ Other fields = defaults

### **Special Features:**
- Auto-cleans phone format (`p:+919876543210` → `9876543210`)
- Extracts last 10 digits if longer
- Maps Tamil questions to English fields

---

## 📋 Format 3: Comprehensive (17 Columns)

### **Structure:**
```
Sl.No | POC | Name | Phone No | Address | Classroom Training | Ground Training | 
Current Status | Stage | Status | Next Action | Lead Creation Date | 
Lead Generator | DOJ | Status | DOR | Remarks
```

### **Full Column List:**
1. **Sl.No** - Serial number
2. **POC** - Point of contact → assigned_telecaller
3. **Name** - Full name
4. **Phone No** - Contact number
5. **Address** - Full address → current_location
6. **Classroom Training** - Training status → driver_readiness
7. **Ground Training** - Training status → docs_collection
8. **Current Status** - Current status → notes
9. **Stage** - Lead stage → lead_stage
10. **Status** - Status code → status (mapped)
11. **Next Action** - Action items → telecaller_notes
12. **Lead Creation Date** - Date created → lead_date
13. **Lead Generator** - Source → lead_source
14. **DOJ** - Date of joining
15. **Status** - Additional status
16. **DOR** - Date of resignation
17. **Remarks** - Notes

### **When to Use:**
- Importing from external CRM/systems
- Detailed lead tracking
- Training center exports
- Existing databases
- Multi-stage workflow data

### **What's Stored:**
- ✅ All basic fields (name, phone, address)
- ✅ Training statuses
- ✅ Stage and status information
- ✅ Telecaller/POC assignments
- ✅ Action items and notes
- ✅ Multiple date fields (creation, joining, resignation)
- ✅ Lead source from file

### **Special Features:**
- **Auto-detects headers** in Row 1 or 2
- **Smart status mapping**: External stages → Internal status codes
- **Lead source auto-fill**: Uses "Lead Generator" column
- **Training status preservation**: Classroom/Ground training
- **Rich notes**: Combines multiple note fields

### **Sample File:**
`/app/sample_lead_sheet_format3.xlsx`

---

## 🔄 How Format Detection Works

### **Detection Flow:**

```
1. Upload file → Parse with pandas
   ↓
2. Check first row for headers
   ├─ Has "Sl.No", "Name", "Phone No"? → Format 3 ✅
   ├─ Has 4 columns? → Format 1 ✅
   └─ Has 8+ columns? → Format 2 ✅
   
3. Apply appropriate parser
   ↓
4. Import leads with format-specific logic
```

### **Priority Order:**
1. **Header-based** (Format 3) - Checked first
2. **Column count** (Format 1/2) - Fallback
3. **Error** if no match

---

## 📥 Import Process (All Formats)

### **Common Steps:**

```
1. Open Driver Onboarding
   ↓
2. Click "Import Leads"
   ↓
3. Configure:
   • Lead Source (manual OR from file)
   • Lead Date (required)
   • Upload file
   ↓
4. System auto-detects format
   ↓
5. Parses and imports
   ↓
6. Shows success/duplicate dialog
   ↓
7. Sync to Google Sheets
```

### **Format-Specific Behavior:**

| Step | Format 1 | Format 2 | Format 3 |
|------|----------|----------|----------|
| **Detection** | 4 columns | 8+ columns | Headers present |
| **Lead Source** | Manual only | Manual only | Auto OR manual |
| **Phone Cleaning** | Direct use | p:+91 cleanup | Direct use |
| **Status** | Default "New" | Default "New" | Mapped from Stage |
| **Training** | Not captured | Not captured | Captured |

---

## 🎯 Which Format Should You Use?

### **Use Format 1 When:**
- ✅ You have basic lead lists
- ✅ Data from simple sources (Excel lists, contacts)
- ✅ Need quick imports
- ✅ Minimal information available
- ❌ Don't need detailed tracking

### **Use Format 2 When:**
- ✅ Importing from Google Forms
- ✅ Pre-screening questionnaires
- ✅ Tamil language forms
- ✅ Need DL, experience, salary data
- ❌ Don't have stage/status info

### **Use Format 3 When:**
- ✅ Importing from external systems
- ✅ Training center databases
- ✅ Existing CRM exports
- ✅ Need stage/status tracking
- ✅ Have detailed lead information
- ✅ Multiple date fields to track
- ✅ Different lead generators/sources

---

## 📊 Data Mapping Summary

### **Common Fields (All Formats):**
- `name` - Lead's full name ✅
- `phone_number` - Contact number ✅
- `lead_source` - Source/generator ✅
- `lead_date` - Creation/import date ✅
- `status` - Current status ✅
- `import_date` - System timestamp ✅

### **Format 1 Only:**
- `vehicle` - Vehicle type 🚗

### **Format 2 Only:**
- `driving_license` - DL status 🪪
- `experience` - Driving experience 📅
- `interested_ev` - EV interest ⚡
- `monthly_salary` - Salary expectation 💰
- `current_location` - Location 📍

### **Format 3 Only:**
- `assigned_telecaller` - POC 👤
- `driver_readiness` - Classroom training ✅
- `docs_collection` - Ground training ✅
- `telecaller_notes` - Next action 📝
- `notes` - Remarks/Current status 📋
- `lead_stage` - External stage 🎯

---

## 🔄 Lead Source Handling

### **Comparison:**

| Format | Lead Source | Checkbox Support | From File? |
|--------|-------------|------------------|------------|
| Format 1 | Manual input | ✅ Yes (if "Lead Source" column) | Optional |
| Format 2 | Manual input | ✅ Yes (if "Lead Source" column) | Optional |
| Format 3 | Auto from "Lead Generator" | ✅ Yes | Default ✅ |

### **Best Practice:**
- **Format 1/2:** Add "Lead Source" column for per-lead tracking
- **Format 3:** Use "Lead Generator" column (auto-detected)

---

## ⚙️ Advanced Features

### **1. Duplicate Detection (All Formats)**
- Checks phone numbers across all imports
- Shows duplicate dialog with options:
  - Skip duplicates
  - Replace existing
  - Keep both
- Works across all formats

### **2. Read Source from File (All Formats)**
- Check "Read Source from file" checkbox
- Requires "Lead Source" column (Format 1/2)
- Auto-uses "Lead Generator" (Format 3)
- Each lead gets unique source

### **3. Status Mapping (Format 3 Only)**
- External stages mapped to internal codes
- Example: `DOCS_COLLECTION` → `S2-a Docs Upload Pending`
- Customizable in backend code

### **4. Phone Number Cleanup (Format 2)**
- Auto-removes `p:+91` prefix
- Extracts last 10 digits
- Handles international formats

---

## 🧪 Testing Each Format

### **Test Format 1:**
```bash
# Create test file
echo "S. No.,Name,Vehicle,Phone Number,Lead Source
1,Test User 1,Two Wheeler,9876543210,Facebook
2,Test User 2,Four Wheeler,9876543211,Google" > test_format1.csv

# Import via UI → Should detect Format 1
```

### **Test Format 2:**
```bash
# Download sample or create 8-column file
# Import via UI → Should detect Format 2
```

### **Test Format 3:**
```bash
# Use provided sample
/app/sample_lead_sheet_format3.xlsx

# Import via UI → Should detect Format 3
```

---

## 📈 Migration Guide

### **Upgrading from Format 1 → Format 3:**

1. Export your Format 1 data
2. Create Format 3 template
3. Map columns:
   - S.No → Sl.No
   - Name → Name
   - Phone Number → Phone No
   - (Add other columns)
4. Fill additional fields
5. Import as Format 3

### **Combining Formats:**

You can import different formats into the same system:
- Import basic leads with Format 1
- Import detailed leads with Format 3
- All coexist in same database
- Filter/search works across all

---

## 🎨 Visual Format Examples

### **Format 1: Simple List**
```
┌──────┬──────────────┬─────────────┬──────────────┐
│ S.No │     Name     │   Vehicle   │    Phone     │
├──────┼──────────────┼─────────────┼──────────────┤
│  1   │ Rajesh Kumar │ Two Wheeler │ 9876543210   │
│  2   │ Priya Sharma │ Four Wheeler│ 9876543211   │
└──────┴──────────────┴─────────────┴──────────────┘
```

### **Format 2: Detailed Form**
```
┌───────────┬─────┬──────────────┬─────┬────────────┐
│   Name    │ Age │    Phone     │ DL  │ Experience │
├───────────┼─────┼──────────────┼─────┼────────────┤
│  Rajesh   │ 25  │ p:+919876... │ Yes │  3 years   │
│  Priya    │ 28  │ p:+919876... │ Yes │  5 years   │
└───────────┴─────┴──────────────┴─────┴────────────┘
```

### **Format 3: Comprehensive System**
```
┌──┬────┬─────────┬──────────┬─────────┬────────┬────────┬───────┐
│No│POC │  Name   │  Phone   │ Address │ Class  │Ground  │Stage  │
├──┼────┼─────────┼──────────┼─────────┼────────┼────────┼───────┤
│1 │ -  │ Uma M   │86085...  │Chennai  │Complete│Complete│DOCS..│
│2 │ -  │Shanthi  │84383...  │Chennai  │Complete│Complete│DOCS..│
└──┴────┴─────────┴──────────┴─────────┴────────┴────────┴───────┘
```

---

## 💡 Tips & Best Practices

### **1. Choose Right Format**
- Start simple (Format 1)
- Upgrade as needs grow
- Use Format 3 for integrations

### **2. Consistent Column Names**
- Keep exact names for auto-detection
- Don't rename columns
- Follow format specifications

### **3. Clean Data Before Import**
- Remove empty rows
- Validate phone numbers
- Fill required fields

### **4. Use Read Source Checkbox**
- Track sources accurately
- Avoid manual entry errors
- Enable better analytics

### **5. Regular Syncs**
- Import → Verify → Sync to Sheets
- Keep systems in sync
- Backup before bulk imports

---

## 🚨 Common Issues & Solutions

### **Issue: Wrong format detected**
**Solution:** Check column names and count match specification

### **Issue: Some leads not imported**
**Solution:** Verify Name and Phone are filled for all rows

### **Issue: Phone numbers incorrect**
**Solution:** 
- Format 2: Check p:+91 prefix format
- Format 1/3: Ensure numeric values

### **Issue: Status not mapping correctly**
**Solution:** Check Stage column values in Format 3

### **Issue: Lead source not appearing**
**Solution:** 
- Enable "Read Source from file" checkbox
- Verify column name exactly matches
- Format 3: Check "Lead Generator" column

---

## ✅ Summary

### **Quick Reference:**

| Need | Use This |
|------|----------|
| Quick import from list | Format 1 (4 columns) |
| Google Form data | Format 2 (8 columns) |
| External system import | Format 3 (17 columns) |
| Training status tracking | Format 3 |
| Multiple lead sources | Format 1/2/3 with "Lead Source" column |
| Stage progression | Format 3 |
| Basic contact info | Format 1 |
| Detailed qualification | Format 2 |
| Full lead lifecycle | Format 3 |

---

**Sample Files:**
- Format 1: `/app/sample_leads_with_source.csv`
- Format 3: `/app/sample_lead_sheet_format3.xlsx`

**Documentation:**
- Format 3 Details: `/app/FORMAT_3_COMPREHENSIVE_IMPORT.md`
- Lead Source Feature: `/app/LEAD_SOURCE_FROM_FILE_FEATURE.md`

**Last Updated:** Complete Import Formats Guide - December 2024
