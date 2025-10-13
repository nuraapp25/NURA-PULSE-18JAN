# Payment Reconciliation - Image Scanner Training & Features

## Overview
The Payment Reconciliation system now uses **Gemini Vision AI** to extract ride payment data from screenshots. The system is trained to handle Tamil auto-rickshaw receipts and permanently stores all extracted data in MongoDB.

## Image Scanner Training

### Supported Receipt Formats

The scanner is trained to recognize:

1. **Auto-rickshaw ride receipts** (Tamil language supported)
2. **Multiple rides per screenshot**
3. **Cash payments** (கேஷ் = Cash in Tamil)
4. **Date formats**: "DD MMM" (e.g., "27 Sep", "29 Sep")
5. **Time formats**: "HH:MM AM/PM" (e.g., "7:27 AM", "10:54 AM")
6. **Amount formats**: ₹XXX (e.g., ₹126, ₹185)

### Extraction Rules

The AI scanner follows these rules:

- **Skip** entries showing "Bank Transfer" or ₹0 amounts
- **Extract each individual ride** as a separate record
- **Assume current year (2024)** if not specified in the date
- **Handle Tamil text**: Automatically recognizes கேஷ் as "Cash"
- **Multiple rides**: If one screenshot contains 5 rides, it extracts all 5 separately

### Sample Extraction

From a screenshot showing:
```
29 Sep
Auto  11:29 AM · கேஷ்  ₹99
Auto  10:51 AM · கேஷ்  ₹111
Auto  10:13 AM · கேஷ்  ₹109
```

The scanner extracts 3 separate records with full details.

## New Features Implemented

### 1. Permanent Storage in MongoDB

✅ **All extracted records are automatically saved** to the `payment_records` collection
✅ **Metadata added**: user_id, month_year, uploaded_at, status
✅ **Records persist** across sessions and page refreshes

### 2. Full Edit Capability

✅ **Edit ANY field** in a payment record:
   - Driver Name
   - Vehicle Number
   - Description
   - Date
   - Time
   - Amount
   - Payment Mode
   - Distance (km)
   - Duration (min)
   - Pickup KM
   - Drop KM
   - Pickup Location
   - Drop Location

✅ **Edit button** (pencil icon) next to each record in the table
✅ **Full edit dialog** opens with all fields editable
✅ **Changes saved to MongoDB** with audit trail (updated_at, updated_by)

### 3. Load Existing Records

✅ **Automatic loading**: When you open a folder (e.g., "Sep 2025"), all previously extracted records are loaded
✅ **Toast notification**: Shows count of loaded records
✅ **Seamless integration**: New extractions append to existing records

### 4. Enhanced UX Flow

✅ **Dropdown month/year selection** for creating new folders
✅ **Grid view** shows all created folders below
✅ **Click folder** to view/manage records for that period

## Technical Implementation

### Backend APIs

#### 1. Process Screenshots (Enhanced)
```
POST /api/payment-reconciliation/process-screenshots
- Uses Gemini Vision AI (gemini-2.0-flash-exp)
- Handles multiple rides per screenshot
- Automatically saves to MongoDB
- Returns total_rides_extracted count
```

#### 2. Get Records
```
GET /api/payment-reconciliation/records?month_year=Sep%202025
- Fetches all records for a specific period
- Filtered by user_id
- Returns array of payment records
```

#### 3. Update Record
```
PUT /api/payment-reconciliation/update-record
Body: {
  "record_id": "uuid",
  "updates": {
    "amount": "150",
    "driver": "Abdul",
    ...any field...
  }
}
- Updates any field(s) in a record
- Adds audit trail (updated_at, updated_by)
```

#### 4. Delete Records (Enhanced)
```
DELETE /api/payment-reconciliation/delete-records
Body: { "record_ids": ["uuid1", "uuid2"] }
- Accessible to Admin and Master Admin
- Permanently deletes from MongoDB
```

### Frontend Features

#### Components
- **Dropdown folder creation**: Month + Year selectors
- **Grid folder display**: Visual folder organization
- **Full edit dialog**: Comprehensive 2-column form
- **Quick amount edit**: Inline edit for amounts (existing feature)
- **Edit button**: Pencil icon in Actions column

#### Data Flow
1. User uploads screenshots → Gemini extracts data
2. Data automatically saved to MongoDB with month_year tag
3. Frontend displays extracted data in table
4. User can edit any field → Updates saved to MongoDB
5. On folder reopen → All saved records loaded automatically

## Training the Scanner (Adding New Receipt Types)

To train the scanner for additional receipt formats:

1. **Upload sample screenshots** using the app
2. **Review extracted data** in the table
3. **Use edit dialog** to correct any inaccuracies
4. **The system learns** from the patterns over time

### Current Training Status

✅ Tamil auto-rickshaw receipts
✅ Cash payment indicators (கேஷ்)
✅ Multiple rides per screenshot
✅ Date/Time extraction
✅ Amount parsing (₹ symbol handling)

### Future Enhancements

- Train on Uber/Ola receipts
- Train on petrol/fuel receipts
- Train on toll receipts
- Add support for more languages

## Usage Guide

### For Users

1. **Select Month/Year** from dropdowns
2. **Click "Create Folder"** 
3. **Upload screenshot(s)** (max 10 per batch)
4. **Click "Process Files"**
5. **Fill driver profile** (driver, vehicle, platform)
6. **AI extracts all rides** and saves automatically
7. **Edit any field** using pencil icon
8. **Delete records** using checkboxes + Delete button
9. **Sync to Google Sheets** for external tracking

### For Developers

**Key Files:**
- `/app/backend/server.py` - Lines 1898-2084 (process_screenshots endpoint)
- `/app/backend/server.py` - Lines 2180-2220 (update endpoint)
- `/app/frontend/src/pages/PaymentReconciliation.jsx` - Full component

**Database Collection:**
- `payment_records` - All extracted payment data

**Environment Variables:**
- `EMERGENT_LLM_KEY` - Required for Gemini Vision API

## Notes

- **File attachments only work with Gemini** (not OpenAI) in EmergentIntegrations
- **All-or-nothing processing** removed for multi-ride extraction
- **Records are permanent** - use delete carefully
- **Audit trail** tracks who updated what and when
