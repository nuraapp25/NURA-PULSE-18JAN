# File #16: Sandhiya Lead Sheet.xlsx - Analysis

## File Structure
**Total Rows:** 10 leads
**Source:** Bhavani (telecaller's personal sheet)
**Format:** Internal tracking sheet with training stages

---

## Column Mapping

| Column # | Header | Description | Maps To |
|----------|--------|-------------|---------|
| 1 | Sl.No | Serial number | - |
| 2 | POC | Assigned telecaller | **Empty** (all NaN) |
| 3 | Name  | Lead name (with trailing space) | Name (Column B) |
| 4 | Phone No | Phone number | Phone Number (Column C) |
| 5 | Address  | Full address (trailing space) | Address (Column E) |
| 6 | Classroom Training  | Training status | - |
| 7 | Ground Trainig | Training status (typo: "Trainig") | - |
| 8 | Current Status | Descriptive notes | Telecaller Notes (Column I) |
| 9 | **Stage** | Internal stage codes | - |
| 10 | **Status** | Internal status codes | - |
| 11 | Next Action | Action items | Notes |
| 12 | Lead Creation Date | Import date | **Empty** (all NaN) |
| 13 | Lead Generator | Source | Source (Column J) = "Bhavani" |
| 14 | DOJ | Date of Joining | - |
| 15 | **Status.1** | Final status | Status (Column G) |
| 16 | DOR | Date of Release | - |
| 17 | Remarks | Additional notes | Notes |

---

## Critical Findings

### ⚠️ **Different Status Format!**
This file does NOT use the "S1-a Not interested" format like previous files.

**Status column values:**
- `REJECTED`
- `Not Interested`
- `Agreement_Pending`
- `Re-Training`
- `DL_PENDING`

**Status.1 column values:**
- `Working` (only 1 occurrence)
- Mostly empty (NaN)

**Stage column values:**
- `DOCS_COLLECTION`
- `ROAD_TEST`

### Current Status column (Descriptive):
- `Joined on 21.09.2025`
- Empty for most

---

## Data Samples

### Sample 1:
```
Name: Uma M
Phone: 8608522051
Address: Plot No:76, 12th Street, Aathidravidar colony, Ernaoor, Chennai - 600057.
Stage: DOCS_COLLECTION
Status: REJECTED
Status.1: NaN
Current Status: NaN
Next Action: 0
Lead Generator: Bhavani
```

### Sample 2:
```
Name: Saravanan E
Phone: 9710204392
Address: No: 4/24, LGGS, Water tank colony, Kotturpuram, Chennai - 600085.
Stage: DOCS_COLLECTION
Status: Agreement_Pending
Status.1: Working
Current Status: Joined on 21.09.2025
Next Action: Move to "CT_PENDING"
Lead Generator: Bhavani
```

---

## Backend Handling Strategy

### Challenge:
This file uses **different status vocabulary** than other 15 files:
- Other files: "S1-a Not interested", "S1-c Highly Interested"
- This file: "REJECTED", "Agreement_Pending", "DL_PENDING"

### Solution Options:

**Option 1: Map to Standard Statuses** (Recommended)
```python
status_mapping = {
    'REJECTED': 'Not interested',
    'Not Interested': 'Not interested',
    'Agreement_Pending': 'Docs Upload Pending',
    'DL_PENDING': 'Interested, No DL',
    'Re-Training': 'Re-Training',
    'Working': 'DONE!'
}
```

**Option 2: Use as-is** (User requirement: "status should be reflected as it is")
- Keep "REJECTED", "Agreement_Pending" exactly as written
- Display them in the app without modification
- They won't match existing status filters/colors

**Recommendation:** Since user wants status "as-is", keep original values but add mapping logic for filtering/grouping.

---

## Google Sheets Mapping

Following the standard 12-column format:

```
A: ID (UUID) → Auto-generated
B: Name → "Uma M", "Saravanan E" (from Name  column)
C: Phone Number → 8608522051, 9710204392
D: Experience → Empty (not in file)
E: Address → Full address with Chennai pincode
F: Stage → "S1" (default) OR map from "DOCS_COLLECTION" → "S2"?
G: Status → "REJECTED", "Agreement_Pending" (from Status column)
H: Assigned Telecaller → Empty (POC column is NaN)
I: Telecaller Notes → "Joined on 21.09.2025" (from Current Status)
J: Source → "Bhavani" (from Lead Generator)
K: Import Date → Auto-generated (Lead Creation Date is empty)
L: Last Modified → Auto-generated
```

---

## Backend Implementation Required

### 1. Column Detection Already Handles:
✅ `Name ` (with trailing space)
✅ `Phone No`
✅ `Address ` (with trailing space)
✅ `Status.1` (priority over Status)
✅ `Lead Generator` → Source
✅ `Current Status` → Telecaller Notes
✅ `Next Action` → Notes

### 2. New Handling Needed:
- Recognize `REJECTED`, `Agreement_Pending`, `DL_PENDING` as valid statuses
- Don't try to parse them (no "S1-a" format)
- Use **Status column** (not Status.1, which is mostly empty)
- Empty POC → No assigned telecaller

### 3. Stage Mapping (Optional):
```python
stage_mapping = {
    'DOCS_COLLECTION': 'S2',
    'ROAD_TEST': 'S3',
    'CLASSROOM_TRAINING': 'S3',
    'GROUND_TRAINING': 'S3'
}
```

---

## Import Test Expectations

**Input:** Sandhiya Lead Sheet.xlsx (10 rows)

**Expected Output:**
```
Lead 1:
  Name: Uma M
  Phone: 8608522051
  Address: Plot No:76, 12th Street...
  Status: REJECTED (preserved as-is)
  Stage: S1 (default) or S2 (if mapped from DOCS_COLLECTION)
  Source: Bhavani
  Assigned Telecaller: (empty)
  Telecaller Notes: (empty)
  
Lead 2:
  Name: Saravanan E
  Phone: 9710204392
  Status: Agreement_Pending (preserved as-is)
  Stage: S1 (default)
  Source: Bhavani
  Telecaller Notes: Joined on 21.09.2025
  Notes: Move to "CT_PENDING"
```

---

## Summary

**File Type:** Internal tracking sheet with different status format
**Unique Characteristics:**
- No POC (assigned telecaller)
- Different status codes (REJECTED, Agreement_Pending, DL_PENDING)
- Has training stages (Classroom, Ground)
- Status.1 mostly empty (only "Working" for 1 lead)
- Source is always "Bhavani"

**Backend Changes Needed:**
- Recognize new status values as valid
- Don't parse them (no "S1-a" format)
- Use Status column (not Status.1) since Status.1 is mostly empty
- Handle empty POC gracefully

**This is the 16th file format trained!**
**Total leads across all 16 files: 16,785 rows**
