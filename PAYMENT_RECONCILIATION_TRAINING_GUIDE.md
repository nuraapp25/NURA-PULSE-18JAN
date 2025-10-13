# Payment Reconciliation - Image Scanner Training & Features

## Overview
The Payment Reconciliation system now uses **Gemini Vision AI** to extract ride payment data from screenshots. The system is trained to handle Tamil auto-rickshaw receipts and permanently stores all extracted data in MongoDB.

## Image Scanner Training

### Supported Receipt Formats

The scanner is trained to recognize **7 different receipt types**:

1. **Simple cash receipts**: "Auto", time, கேஷ் (Cash), ₹amount
2. **Detailed app receipts**: "Auto", ₹amount, distance (கி.மீ), duration (நிமி, வி), time
3. **Paytm detailed receipts**: "மதிப்பிடப்பட்ட வருவாய்" (Estimated Fare), decimal distances (2.36 km), decimal durations (16.67 min), full pickup/drop addresses
4. **Ride history summaries**: Multiple completed rides with individual timestamps (10:59 pm, 10:18 pm), locations, amounts
5. **Surge pricing receipts**: Upward arrow ↑ with "அதிகரித்துள்ளது" (increased)
6. **Cancelled rides**: "வாடிக்கையாளர் ரத்துசெய்தார்" (customer) or "வண்டிக்கையாளர் ரத்துசெய்தார்" (driver)
7. **Zero-fare/promotional rides**: ₹0.00 with challenge text or cancellation status

### Tamil Text Recognition

**The scanner understands these Tamil/English terms:**
- கேஷ் = Cash
- கி.மீ / km = Kilometers (supports decimals: 2.36 km)
- நிமி (நிமிடம்) / min = Minutes (supports decimals: 16.67 min)
- வி (விநாடி) = Seconds
- ம.நே (மணிநேரம்) = Hours
- மதிப்பிடப்பட்ட வருவாய் / மதிப்பிடப்பட்ட வரு... = Estimated Fare
- பிக்கப் = Pickup
- முரபி / டிராப் = Dropoff/Drop
- அதிகரித்துள்ளது = Surge/Increased pricing
- வாடிக்கையாளர் ரத்துசெய்தார் = Customer cancelled
- வண்டிக்கையாளர் ரத்துசெய்தார் = Driver cancelled
- பயணச் சவால் = Travel challenge (promotional)
- ஆட்டோ ஆர்டர் = Auto Order
- முடிந்த ஆர்டர்கள் = Completed orders/rides

### Extraction Rules

The AI scanner follows these enhanced rules:

- **✅ Extract ALL rides** including ₹0.00 cancelled/promotional rides
- **✅ Extract each individual ride** as a separate record (5 rides → 5 records)
- **✅ Convert Tamil units to numbers**:
  - "3.57 கி.மீ" → distance: 3.57
  - "16 நிமி 55 வி" → duration: 16 minutes
  - "1 ம.நே 11 நிமி" → duration: 71 minutes
- **✅ Detect surge pricing**: Auto-labeled as "Auto (Surge)"
- **✅ Detect cancellations**: Auto-labeled as "Auto (Cancelled)" with ₹0
- **✅ Handle date formats**: "திங்கள்., 29 செப்." → "29/09/2024"
- **✅ Extract amounts as numbers**: "₹126.45" → 126.45

### Sample Extractions

**Example 1: Simple Cash Receipts**
```
29 Sep
Auto  11:29 AM · கேஷ்  ₹99
Auto  10:51 AM · கேஷ்  ₹111
Auto  10:13 AM · கேஷ்  ₹109
```
**Extracts:** 3 records with date: 29/09/2024, payment: Cash, amounts as numbers

**Example 2: Detailed App Receipts with Metrics**
```
திங்கள்., 29 செ.பி.
₹92.44  ↑ அதிகரித்துள்ளது
Auto · 16 நிமி 55 வி · 3.57 கி.மீ  PM 8:48

₹189.80
Auto · 24 நிமி 26 வி · 8.83 கி.மீ  PM 4:21
```
**Extracts:** 2 records
- Record 1: Surge pricing, 16 min duration, 3.57 km distance
- Record 2: Regular fare, 24 min duration, 8.83 km distance

**Example 3: Cancellations & Zero-Fare**
```
₹0.00
Auto · வாடிக்கையாளர் ரத்துசெய்தார்  AM 11:11

₹0.00
7 பயணச் சவால் · நீங்கள் 5 பயணங்களை மட்டுமே முடித்துள்ளீர்கள்  PM 10:00
```
**Extracts:** 2 records
- Record 1: Cancelled by customer, ₹0
- Record 2: Travel challenge promotional, ₹0

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

✅ **Tamil auto-rickshaw receipts** (all 5 format types)
✅ **Cash payment indicators** (கேஷ்)
✅ **Distance extraction** (கி.மீ to kilometers)
✅ **Duration extraction** (நிமி/வி/ம.நே to minutes)
✅ **Surge pricing detection** (அதிகரித்துள்ளது)
✅ **Cancellation detection** (customer/driver cancelled)
✅ **Zero-fare rides** (promotional challenges, cancellations)
✅ **Multiple rides per screenshot**
✅ **Date/Time extraction** (Tamil dates converted to DD/MM/YYYY)
✅ **Amount parsing** (₹ symbol handling with decimals)

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
