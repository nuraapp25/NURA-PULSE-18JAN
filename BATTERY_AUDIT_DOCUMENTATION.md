# Battery Charge Audit Analysis - Documentation

## Overview
The Battery Charge Audit Analysis is a new feature that identifies and reports all instances where vehicle battery charge dropped below 20% during operational hours (7 AM to 7 PM).

## Purpose
This audit helps:
- **Monitor battery health**: Track vehicles that frequently run low on charge
- **Identify operational issues**: Detect vehicles that may need maintenance or charging infrastructure improvements
- **Optimize fleet management**: Make data-driven decisions about vehicle deployment and charging schedules
- **Prevent service disruptions**: Proactively address vehicles at risk of running out of charge

## How It Works

### Data Analysis Process
1. **Data Source**: Analyzes all Montra vehicle feed data stored in MongoDB
2. **Time Window**: Only considers records between 7 AM and 7 PM (operational hours)
3. **Threshold**: Identifies when battery charge drops below 20%
4. **First Instance**: Returns the **first occurrence each day** per vehicle (not all instances)
5. **KM Calculation**: Computes total KM driven from start of day (00:00) to the low charge timestamp

### Output Format
The audit report provides the following information in a tabular format:

| Field | Description |
|-------|-------------|
| **Date** | The date when the low charge was detected (format: "DD MMM") |
| **Vehicle Name** | The vehicle ID or registration number |
| **Timestamp** | The exact time when charge dropped below 20% (HH:MM:SS) |
| **Battery %** | The actual battery percentage at that timestamp |
| **KM Driven** | Total kilometers driven from start of day to that point |

## API Endpoint

### GET `/api/montra-vehicle/battery-audit`

**Authentication**: Required (Bearer token)

**Response Format**:
```json
{
  "success": true,
  "audit_results": [
    {
      "date": "05 Sep",
      "vehicle_name": "P60G2512500002032",
      "timestamp": "15:30:45",
      "battery_percentage": 18.5,
      "km_driven_upto_point": 145.8
    }
  ],
  "count": 1,
  "message": "Found 1 instances where battery dropped below 20% between 7 AM - 7 PM"
}
```

## Usage Methods

### Method 1: API Call (For Integration)
```bash
# Get authentication token first
curl -X POST https://driver-qr.preview.emergentagent.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"Nura@1234$"}'

# Call the audit endpoint
curl -X GET https://driver-qr.preview.emergentagent.com/api/montra-vehicle/battery-audit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Method 2: Python Report Script (For Console Output)
```bash
cd /app/backend
python3 battery_audit_report.py
```

This generates a formatted console report:
```
🔋 BATTERY CHARGE AUDIT REPORT
   Low Charge Instances (<20%) Between 7 AM - 7 PM
================================================================================

📊 Found 2 instances where battery dropped below 20% between 7 AM - 7 PM

+--------+--------------------+-----------+-----------+-------------------------------+
| Date   | Vehicle Name       | Timestamp | Battery % | KM Driven (from start of day) |
+========+====================+===========+===========+===============================+
| 05 Sep | P60G2512500002032  | 15:30:45  | 18.5%     | 145.8                         |
| 06 Sep | TN02CE0738         | 16:45:20  | 19.2%     | 132.4                         |
+--------+--------------------+-----------+-----------+-------------------------------+

✅ Total Instances: 2
```

## Data Requirements

### Prerequisites
1. **Montra Feed Data**: Vehicle data must be imported through the Montra Vehicle Insights interface
2. **Required Fields**: The data must contain:
   - `Battery %` or `battery_soc_percentage` (battery charge level)
   - `time` or `Hour` (timestamp)
   - `KM` or `km` (kilometer reading)
   - `vehicle_id` (vehicle identifier)
   - `date` (date of record)

### Import Data
To populate data for the audit:
1. Navigate to **Montra Vehicle Insights** in the dashboard
2. Click **Import Feed**
3. Upload CSV files with vehicle data
4. Ensure files contain the required columns (Battery %, Hour, KM, etc.)

## Current Status
✅ **Backend Implementation**: Complete and tested
✅ **API Endpoint**: Fully functional (`/api/montra-vehicle/battery-audit`)
✅ **Report Script**: Ready for use (`battery_audit_report.py`)
✅ **Dependencies**: Installed (`tabulate` library added to requirements.txt)

⚠️ **Note**: Currently returns 0 instances because no Montra feed data has been imported yet. Once vehicle data is uploaded, the audit will automatically analyze all records.

## Technical Details

### Database Query
- **Collection**: `montra_feed_data`
- **Grouping**: By `vehicle_id` and `date`
- **Sorting**: Records sorted by time within each day
- **Filtering**: Time window 7:00 AM - 7:00 PM, Battery < 20%

### Performance
- Analyzes up to 100,000 records
- Processes all vehicles and dates in a single query
- Returns results sorted by date and vehicle name

### Error Handling
- Gracefully handles missing fields (returns "N/A")
- Skips invalid records without failing the entire analysis
- Provides informative messages when no data is available

## Future Enhancements (Optional)
- Add date range filters to audit specific periods
- Include vehicle-specific filtering
- Export results to Excel/CSV
- Email alerts for vehicles frequently hitting low charge
- Dashboard widget for real-time monitoring

## Support
For issues or questions:
1. Check that Montra feed data is imported
2. Verify authentication token is valid
3. Review backend logs: `tail -f /var/log/supervisor/backend.*.log`
4. Contact support with specific error messages
