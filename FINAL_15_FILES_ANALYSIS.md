# Final 5 Excel Files - Complete Analysis

## Total Files Analyzed: 15
## Total Leads: 16,775 rows

---

## Batch 3 (Files 11-15) - 135 rows

### File 11: Workindia.xlsx (64 rows) ✅ STANDARD FORMAT
**Columns:** POC, Name, Phone No, Address, ss, dd, Lead Creation Date, Lead Generator, Status, ss.1, DOR, Remarks

**Status Format:** 
- "S1-a Not interested" ✅
- "New" ✅
- "S1-g Call back 1M" ✅
- "S1-b Interested, No DL" ✅
- "S1-c Highly Interested" ✅

**Source:** "Workindia"

**Mapping:**
- POC → Assigned Telecaller (Column H)
- Name → Name (Column B)
- Phone No → Phone Number (Column C) - handles scientific notation (9.840412e+09)
- Address → Address (Column E)
- ss → Telecaller Notes (Column I)
- dd → Notes
- Lead Generator → Source (Column J) = "Workindia"
- Status → Status (Column G) - preserved as-is
- Lead Creation Date → Import Date (Column K)

**Sample Data:**
```
Name: Manikandan, Phone: 9840412XXX, Status: "S1-a Not interested", dd: "Not Interested"
Name: Sasikumar, Phone: 9789958XXX, Status: "New", dd: "-"
```

---

### File 12: Usna_leads.xlsx (13 rows) ⚠️ DUAL STATUS COLUMNS
**Columns:** POC, Name, Phone No, Address, Current Status, **Status**, Lead Creation Date, Lead Generator, DOJ, **Status.1**, DOR, Remarks

**IMPORTANT:** Has TWO status columns with DIFFERENT formats!
- **Status** column: "Agreement_Pending", "Not Interested", "REJECTED", "-" (internal codes)
- **Status.1** column: "S4-d DONE!", "S1-a Not interested" (correct format) ✅

**Solution:** Backend prioritizes "Status.1" over "Status" column

**Sources:** 
- "Usna begum"
- "Vijayan Transport"
- "Vijayamohan"

**Mapping:**
- Status.1 → Status (Column G) = "S4-d DONE!", "S1-a Not interested" ✅
- Lead Generator → Source (Column J)
- Rest follows standard pattern

**Sample Data:**
```
Name: Abdul Nayeem, Status.1: "S4-d DONE!", Status: "Agreement_Pending", Source: "Usna begum"
Name: Sudhakar, Status.1: "S1-a Not interested", Status: "Not Interested", Source: "Vijayan Transport"
```

---

### File 13: ParveenTravels.xlsx (18 rows) ✅ STANDARD FORMAT
**Columns:** POC, Name, Phone No, Address, ss, ss.1, Lead Creation Date, Lead Generator, Status, ss.2, DOR, Remarks

**Status Format:**
- "S1-a Not interested" ✅
- "S1-c Highly Interested" ✅

**Source:** "Parveen Travels"

**Special Notes:**
- ss column has detailed notes: "Ready to join after receiving the driving licencse, but ensure the transportation interview are fixed"
- ss.1 typically: "Not Interested", "Highly Interested"

**Mapping:**
- ss → Telecaller Notes (Column I) - captures detailed notes
- ss.1 → Additional notes
- ss.2 → Additional notes
- Rest follows standard pattern

**Sample Data:**
```
Name: D Usha Dhanasekar, Status: "S1-a Not interested", ss: NaN, ss.1: "Not Interested"
Name: S. Nadmatha, Status: "S1-c Highly Interested", ss: "Ready to join after receiving", ss.1: "Highly Interested"
```

---

### File 14: Lead2.xlsx (20 rows) 🚨 GOOGLE FORMS DATA (TAMIL)
**Columns:** full_name, email_address, phone_number, [Tamil question columns], STATUS

**Tamil Columns (Questions):**
1. உங்களிடம்_ஓட்டுநர்_உரிமம்_(driving_licence)_உள்ளதா? (Do you have driving license?)
2. உங்களுக்கு_எத்தனை_வருட_ஓட்டுநர்_அனுபவம்_உள்ளது?_(ஆட்டோ_/_காப்_/_பைக்) (Years of driving experience)
3. மின்சார_(ev)_ஆட்டோக்களை_ஓட்டுவதில்_ஆர்வமா? (Interested in EV autos?)
4. தற்போது_உங்கள்_மாத_வருமானம்_எவ்வளவு? (Current monthly income?)
5. தற்போது_சென்னை_எந்த_பகுதியில்_வசிக்கிறீர்கள்? (Which area in Chennai do you live?)

**Phone Format:** `p:+919444499975` (with p: prefix) ✅ HANDLED

**Special Handling:**
- Phone numbers have "p:+" prefix → Backend strips this
- Email addresses included ✅
- STATUS column is **empty** (NaN) → Defaults to "New"
- Tamil text preserved as-is
- No POC, no source in file → Uses filename as source

**Backend Processing:**
```python
# Phone cleaning handles:
phone_val = phone_val.replace('p:', '').replace('p:+', '+')  # Remove p: prefix
if phone_val.startswith('+91'):
    phone_val = phone_val[3:]  # Keep only 10 digits
```

**Mapping:**
- full_name → Name (Column B)
- phone_number → Phone Number (Column C) - "p:+919444499975" → "9444499975"
- email_address → Email (stored in lead object)
- Tamil columns → Ignored (not mapped to standard fields)
- STATUS → Status (Column G) = "New" (default, since empty)
- Filename → Source (Column J) = "Lead2.xlsx"

**Sample Data:**
```
Name: S. velu, Email: easytech75@gmail.com, Phone: p:+919444499975 → 9444499975
Name: Mahesh Mahesh, Email: maheshg7708@gmail.com, Phone: p:+919284381146 → 9284381146
Name: Vijayan, Email: v56027688@gmail.com, Phone: p:+919003225646 → 9003225646
```

---

### File 15: Lead1.xlsx (20 rows) 🚨 MINIMAL FORMAT
**Columns:** S. No., Name, Vehicle, Phone Number

**Extremely Basic:**
- Only 4 columns
- No status, no address, no POC, no source, no date
- Just serial number, name, vehicle type, phone

**Mapping:**
- Name → Name (Column B)
- Phone Number → Phone Number (Column C)
- Vehicle → Vehicle type (stored in lead object)
- Status → "New" (default)
- Stage → "S1" (default)
- Source → "Lead1.xlsx" (filename)
- All other fields → Empty/default

**Sample Data:**
```
S.No: 1, Name: Guna sekar, Vehicle: Auto, Phone: 9962164683
S.No: 2, Name: mohankumar, Vehicle: Auto, Phone: 9283115940
S.No: 3, Name: RAJA, Vehicle: Auto, Phone: 9884416818
```

---

## Summary of All 15 Files

### Total Statistics:
- **Total Leads:** 16,775 rows
- **Standard Format Files:** 11 files (Ganesh, Anew, Lokal, Digital, Bhavani, TN Skill, Pamphlet, OLX, Others, JobHai, Workindia)
- **Dual Status Column Files:** 2 files (OthersPlusPragadeesh, Usna_leads) - Status.1 used
- **Google Forms Data:** 1 file (Lead2) - Tamil columns, p:+ phone format
- **Minimal Format:** 1 file (Lead1) - Only name, phone, vehicle
- **Special Case (Parveen):** 1 file - Very detailed telecaller notes in ss column

---

## Backend Enhancements Made

### 1. Column Detection Updates:
```python
# Added:
- 'full_name', 'full_name' (for Google Forms)
- 'Phone Number' (capitalized)
- 'email', 'email_address', 'email_address'
- 'STATUS' (uppercase for Google Forms)
- 'Status.1' (highest priority for dual-status files)
- 'Vehicle', 'vehicle'
```

### 2. Phone Number Cleaning:
```python
# Handles multiple formats:
- Scientific notation: 9.840412e+09 → 9840412XXX
- p:+ prefix: p:+919444499975 → 9444499975
- +91 prefix: +919003225646 → 9003225646
- Spaces, dashes, dots removed
```

### 3. Status Priority:
```python
# Priority order:
1. Status.1 (if exists)
2. STATUS (uppercase)
3. status
4. Status
5. Current Status (last)
```

### 4. Default Handling:
```python
# When fields missing:
- Status → "New"
- Stage → "S1"
- Source → filename (if no Lead Generator column)
- POC → None (empty)
- Email → Captured if present
```

---

## Google Sheets Mapping (Final)

**All 15 file formats map to these 12 columns:**

| Column | Header | Source | Example |
|--------|--------|--------|---------|
| A | ID | Auto-generated | f8698824-afc7... |
| B | Name | Name / full_name | Manikandan |
| C | Phone Number | Phone No / phone_number | 9840412XXX |
| D | Experience | Experience (if present) | 3+ years |
| E | Address | Address / Location | Porur |
| F | Stage | Default S1 | S1 |
| G | Status | Status / Status.1 / STATUS | **S1-a Not interested** |
| H | Assigned Telecaller | POC | santhiya |
| I | Telecaller Notes | ss / sss / Current Status | Requested Accomodation |
| J | Source | Lead Generator / filename | Workindia |
| K | Import Date | Lead Creation Date / auto | 15.09.2025 |
| L | Last Modified | Auto-generated | 28.10.2025 |

---

## Import Success Criteria

For each file format:
1. ✅ Name extracted correctly
2. ✅ Phone cleaned and normalized (10 digits)
3. ✅ Status preserved as-is (e.g., "S1-a Not interested")
4. ✅ Source identified (Lead Generator or filename)
5. ✅ POC mapped to Assigned Telecaller
6. ✅ Email captured (if present)
7. ✅ Vehicle type captured (if present)
8. ✅ Duplicate detection by phone number
9. ✅ All fields sync to Google Sheets correctly

---

## Testing Checklist

- [ ] Import all 15 files individually
- [ ] Verify status displays exactly as in Excel (with S1-a prefix)
- [ ] Check phone numbers cleaned correctly (no p:+, no +91)
- [ ] Confirm POC → Assigned Telecaller mapping
- [ ] Verify ss/sss → Telecaller Notes mapping
- [ ] Check Lead Generator → Source mapping
- [ ] Test batch sync (16,775 leads = 34 batches)
- [ ] Verify Google Sheets columns A-L populated correctly
- [ ] Check duplicate detection works across all files
- [ ] Confirm Tamil text handled correctly (Lead2.xlsx)
