# Excel Files Column Analysis

## File 1: GaneshLeads.xlsx (15,909 rows)
**Columns:**
- POC → Assigned Telecaller (Column H)
- Name → Name (Column B)
- Phone No → Phone Number (Column C)
- Address → Address (Column E)
- Current Status → Status notes/description
- ss → Status notes (secondary)
- Lead Creation Date → Import Date (Column K)
- Lead Generator → Source (Column J)
- Status → Status (Column G)

**Mapping:**
```python
{
    'POC': 'assigned_telecaller',
    'Name ': 'name',           # Note: has trailing space
    'Phone No': 'phone_number',
    'Address ': 'address',     # Note: has trailing space
    'Current Status': 'telecaller_notes',
    'ss': 'notes',
    'Lead Creation Date': 'import_date',
    'Lead Generator': 'source',
    'Status': 'status'
}
```

---

## File 2: Anew.xlsx (17 rows)
**Columns:**
- POC → Assigned Telecaller (Column H)
- Name → Name (Column B)
- Phone No → Phone Number (Column C)
- Address → Address (Column E)
- ss → Telecaller Notes (Column I)
- dd → Additional notes
- Lead Creation Date → Import Date (Column K)
- Lead Generator → Source (Column J)
- Status → Status (Column G)

**Mapping:**
```python
{
    'POC': 'assigned_telecaller',
    'Name ': 'name',
    'Phone No': 'phone_number',
    'Address ': 'address',
    'ss': 'telecaller_notes',
    'dd': 'notes',
    'Lead Creation Date': 'import_date',
    'Lead Generator': 'source',
    'Status': 'status'
}
```

---

## File 3: Lokal.xlsx (48 rows)
**Columns:**
- POC → Assigned Telecaller (Column H)
- Name → Name (Column B)
- Phone No → Phone Number (Column C)
- Address → Address (Column E)
- sss → Telecaller Notes (Column I)
- ss → Status description
- Lead Creation Date → Import Date (Column K)
- Lead Generator → Source (Column J)
- Status → Status (Column G)

**Mapping:**
```python
{
    'POC': 'assigned_telecaller',
    'Name ': 'name',
    'Phone No': 'phone_number',
    'Address ': 'address',
    'sss': 'telecaller_notes',
    'ss': 'notes',
    'Lead Creation Date': 'import_date',
    'Lead Generator': 'source',
    'Status': 'status'
}
```

---

## File 4: DigitalMarketing.xlsx (401 rows)
**Columns:**
- POC → Assigned Telecaller (Column H)
- Name → Name (Column B)
- Phone No → Phone Number (Column C)
- Address → Address (Column E)
- Current Status → Telecaller Notes (Column I)
- ss → Additional notes
- Lead Creation Date → Import Date (Column K)
- Lead Generator → Source (Column J)
- Status → Status (Column G)

**Mapping:**
```python
{
    'POC': 'assigned_telecaller',
    'Name ': 'name',
    'Phone No': 'phone_number',
    'Address ': 'address',
    'Current Status': 'telecaller_notes',
    'ss': 'notes',
    'Lead Creation Date': 'import_date',
    'Lead Generator': 'source',
    'Status': 'status'
}
```

---

## File 5: Bhavani.xlsx (163 rows)
**Columns:**
- POC → Assigned Telecaller (Column H)
- Name → Name (Column B)
- Phone No → Phone Number (Column C)
- Address → Address (Column E)
- Current Status → Status description
- ss → Telecaller Notes (Column I)
- Lead Creation Date → Import Date (Column K)
- Lead Generator → Source (Column J)
- DOJ → Date of Joining (ignore)
- ss.1 → Additional status (ignore)
- DOR → Date of Release (ignore)
- Remarks → Additional notes
- Status → Status (Column G)

**Mapping:**
```python
{
    'POC': 'assigned_telecaller',
    'Name ': 'name',
    'Phone No': 'phone_number',
    'Address ': 'address',
    'Current Status': 'notes',
    'ss': 'telecaller_notes',
    'Lead Creation Date': 'import_date',
    'Lead Generator': 'source',
    'Remarks': 'notes',
    'Status': 'status'
}
```

---

## Common Patterns Identified

### Standard Mappings:
1. **POC** → Always maps to `Assigned Telecaller` (Column H)
2. **Name** (with trailing space) → `Name` (Column B)
3. **Phone No** → `Phone Number` (Column C)
4. **Address** (with trailing space) → `Address` (Column E)
5. **Lead Generator** → `Source` (Column J)
6. **Lead Creation Date** → `Import Date` (Column K)
7. **Status** → `Status` (Column G) - Contains format like "S1-a Not interested"

### Variable Mappings:
- **ss / sss / dd** → Can be telecaller notes or general notes
- **Current Status** → Usually telecaller notes or status description
- **Remarks** → Additional notes

### Status Format:
All files use format: `S1-a Not interested`, `S1-c Highly Interested`, `S1-g Call back 1M`
- Need to extract the actual status (after the code)
- The prefix (S1-a, S1-c, etc.) is just a code

### Experience Field:
- **NOT PRESENT** in any of these 5 files
- Should default to empty or extract from notes if mentioned

---

## Enhanced Column Detection Logic Required

Update `/app/backend/server.py` import function to:

1. **Add these exact column name matches:**
   - 'Name ' (with trailing space)
   - 'Address ' (with trailing space)
   - 'Phone No'
   - 'Lead Generator'
   - 'Lead Creation Date'
   - 'Current Status'
   - 'ss', 'sss', 'dd' (as telecaller notes)
   - 'POC' (as assigned telecaller)

2. **Status parsing:**
   - Extract text after the code (e.g., "S1-a Not interested" → "Not interested")
   - Match with app's status hierarchy

3. **Missing Experience field:**
   - Set to `None` or empty string
   - Can add logic to extract from notes if needed

---

## Total Leads: 16,538 rows
This is a large dataset that will likely cause timeout issues on sync.

**Solution:** Implement batch syncing (sync 100-500 leads at a time)
