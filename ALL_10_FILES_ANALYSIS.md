# All 10 Excel Files - Complete Analysis

## Batch 1 (First 5 Files) - 16,538 rows

### 1. GaneshLeads.xlsx (15,909 rows)
**Columns:** POC, Name, Phone No, Address, Current Status, ss, Lead Creation Date, Lead Generator, Status
**Status Format:** "S1-g Call back 1M"
**Key Mapping:**
- POC → Assigned Telecaller
- Name → Name
- Phone No → Phone Number
- Address → Address
- Current Status → Telecaller Notes
- ss → Notes
- Lead Creation Date → Import Date
- Lead Generator → Source
- Status → Status (preserved as-is: "S1-g Call back 1M")

---

### 2. Anew.xlsx (17 rows)
**Columns:** POC, Name, Phone No, Address, ss, dd, Lead Creation Date, Lead Generator, Status
**Status Format:** "S1-a Not interested"
**Key Mapping:**
- ss → Telecaller Notes
- dd → Notes
- Rest same as above

---

### 3. Lokal.xlsx (48 rows)
**Columns:** POC, Name, Phone No, Address, sss, ss, Lead Creation Date, Lead Generator, Status
**Status Format:** "S1-c Highly Interested"
**Key Mapping:**
- sss → Telecaller Notes
- ss → Notes
- Rest same as above

---

### 4. DigitalMarketing.xlsx (401 rows)
**Columns:** POC, Name, Phone No, Address, Current Status, ss, Lead Creation Date, Lead Generator, Status
**Status Format:** "S1-g Call back 1M", "S1-a Not interested"
**Source:** "Facebook"
**Key Mapping:**
- Current Status → Telecaller Notes
- ss → Notes
- Rest same as above

---

### 5. Bhavani.xlsx (163 rows)
**Columns:** POC, Name, Phone No, Address, Current Status, ss, Lead Creation Date, Lead Generator, DOJ, ss.1, DOR, Remarks, Status
**Status Format:** "S1-a Not interested"
**Key Mapping:**
- Current Status → Notes
- ss → Telecaller Notes
- Remarks → Additional notes
- DOJ, DOR, ss.1 → Ignored (not relevant)
- Rest same as above

---

## Batch 2 (Next 5 Files) - 102 rows

### 6. TN Skill.xlsx (27 rows)
**Columns:** POC, Name, Phone No, Address, ss, ss.1, Lead Creation Date, Lead Generator, Status, ss.2, DOR, Remarks
**Status Format:** "S1-g Call back 1M"
**Source:** "TN Skill"
**Key Mapping:**
- ss → Telecaller Notes
- ss.1 → Additional telecaller notes
- ss.2 → Notes
- Remarks → Additional notes
- DOR → Ignored

**Sample Data:**
- Name: "Meganathan", Status: "S1-g Call back 1M", ss: "Requested Accomodation"
- Name: "Pushparaj", Status: "S1-g Call back 1M", ss: "Call on Monday"

---

### 7. Pamphlet.xlsx (6 rows)
**Columns:** POC, Name, Phone No, Address, Current Status, Status, Lead Creation Date, Lead Generator, ss, dd, DOR, Remarks
**Status Format:** "S1-a Not interested"
**Source:** "Pamphlet"
**Key Mapping:**
- Current Status → Telecaller Notes (empty in this file)
- Status → Status (preserved as-is)
- ss, dd → Notes
- DOR, Remarks → Additional info

**Sample Data:**
- Name: "Prathap", Status: "S1-a Not interested"
- Name: "Sriphan", Status: "S1-a Not interested"

---

### 8. OLX.xlsx (27 rows)
**Columns:** POC, Name, Phone No, Address, ss, ss.1, Lead Creation Date, Lead Generator, DOJ, Status, DOR, Remarks
**Status Format:** "S1-a Not interested"
**Source:** "OLX"
**Key Mapping:**
- ss → Telecaller Notes (e.g., "Interview Attended")
- ss.1 → Additional notes (e.g., "Not Interested")
- DOJ → Date of Joining (ignored)
- DOR, Remarks → Additional info

**Sample Data:**
- Name: "Prabagaran", Status: "S1-a Not interested"
- Name: "Kiran", Status: "S1-a Not interested", ss: "Interview Attended"

---

### 9. OthersPlusPragadeesh.xlsx (7 rows)
**Columns:** POC, Name, Phone No, Address, Current Status, Status, Lead Creation Date, Lead Generator, DOJ, **Status.1**
**Status Format:** "S1-c Highly Interested", "S1-a Not interested"
**Source:** "Others"
**Special Note:** Has TWO status columns: "Status" and "Status.1"
**Key Mapping:**
- **Status.1** → Primary status column (takes priority)
- Current Status → Telecaller Notes (e.g., "no smartphone", "Not reachable")
- Status → Secondary status (not used if Status.1 exists)

**Sample Data:**
- Name: "Yard", Status.1: "S1-c Highly Interested", Current Status: "no smartphone"
- Name: "Jeeva", Status.1: "S1-a Not interested", Current Status: "Not reachable"

---

### 10. JobHai.xlsx (35 rows)
**Columns:** POC, Name, Phone No, Address, dd, ss, Lead Creation Date, Lead Generator, Status, dd.1, DOR, Remarks
**Status Format:** "S1-a Not interested"
**Source:** "Job hai"
**Key Mapping:**
- dd → Additional notes
- ss → Telecaller Notes (e.g., "Not Interested")
- dd.1 → More notes
- Status → Status (preserved as-is)

**Sample Data:**
- Name: "Santhosh Siva", Status: "S1-a Not interested", ss: "Not Interested"
- Name: "Vignesh R", Status: "S1-a Not interested"

---

## Total Summary

**Total Leads:** 16,640 rows across 10 files

**Status Formats Identified:**
1. `S1-a Not interested`
2. `S1-c Highly Interested`
3. `S1-g Call back 1M`
4. `S1-g Call back 1W`
5. `S1-g Call back 2W`

**Common Columns Across All Files:**
- POC → Assigned Telecaller (Column H in Google Sheets)
- Name → Name (Column B)
- Phone No → Phone Number (Column C)
- Address → Address (Column E)
- Lead Generator → Source (Column J)
- Lead Creation Date → Import Date (Column K)
- Status → Status (Column G) - **PRESERVED AS-IS**

**Variable Columns (mapped to Telecaller Notes or Notes):**
- ss, ss.1, ss.2 → Telecaller Notes or Notes
- sss → Telecaller Notes
- dd, dd.1 → Notes
- Current Status → Telecaller Notes
- Remarks → Notes
- DOJ, DOR → Ignored (not relevant for import)

**Special Cases:**
1. **OthersPlusPragadeesh.xlsx** has `Status.1` column - takes priority over `Status`
2. Multiple `ss` variations (ss, ss.1, ss.2) - first match used for telecaller notes
3. Multiple `dd` variations (dd, dd.1) - used for general notes

---

## Updated Backend Logic

### Column Detection Priority:
```python
status_col = find_column(df, ['Status.1', 'status', 'Status', ...])  # Status.1 first!
telecaller_notes_col = find_column(df, ['ss', 'ss.1', 'sss', 'current status', ...])
remarks_col = find_column(df, ['dd', 'dd.1', 'ss.2', 'remarks', ...])
```

### Status Handling:
- **Original status from file is PRESERVED** (e.g., "S1-a Not interested")
- Status parsing is done internally for logic/filtering only
- User sees EXACT status from Excel file in the app

### Google Sheets Mapping (All 12 Columns):
```
A: ID (auto-generated)
B: Name ✅
C: Phone Number ✅
D: Experience ✅ (if present)
E: Address ✅
F: Stage (default "S1") ✅
G: Status (ORIGINAL format: "S1-a Not interested") ✅
H: Assigned Telecaller (from POC) ✅
I: Telecaller Notes (from ss/sss/Current Status) ✅
J: Source (from Lead Generator) ✅
K: Import Date (from Lead Creation Date) ✅
L: Last Modified (auto-generated) ✅
```

---

## Testing Recommendations

For each of the 10 files, verify:
1. ✅ Status displays EXACTLY as in Excel (e.g., "S1-a Not interested")
2. ✅ POC maps to Assigned Telecaller correctly
3. ✅ ss/sss columns map to Telecaller Notes
4. ✅ Lead Generator maps to Source
5. ✅ All columns sync to Google Sheets in correct order (A-L)
6. ✅ Duplicate phone numbers detected and handled
7. ✅ Batch sync works for large datasets (16,640 leads = 34 batches)
