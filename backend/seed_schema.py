import os
from pymongo import MongoClient
from datetime import datetime

print("🚀 Running schema synchronization...")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

if not MONGO_URL:
    raise Exception("❌ ERROR: MONGO_URL environment variable missing")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# ========== YOUR FULL SCHEMA IN PYTHON DICT ==========

schema = {
    "users": {
        "first_name": None,
        "last_name": None,
        "email": None,
        "password": None,
        "account_type": None,
        "status": None,
        "created_at": None,
        "is_temp_password": None
    },
    "driver_leads": {
        "name": None,
        "phone_number": None,
        "email": None,
        "stage": None,
        "status": None,
        "source": None,
        "assigned_telecaller": None,
        "assigned_telecaller_name": None,
        "assigned_date": None,
        "callback_date": None,
        "last_called": None,
        "last_modified": None,
        "preferred_shift": None,
        "calling_history": None,
        "status_history": None,
        "remarks": None,
        "s1_status": None,
        "s2_status": None,
        "s3_status": None,
        "s4_status": None
    },
    "montra_feed_data": {
        "vehicle_id": None,
        "date": None,
        "registration_number": None,
        "filename": None,
        "imported_at": None,
        "Ignition Status": None,
        "Speed (km/h)": None,
        "Odometer (km)": None,
        "GPS Location": None,
        "Battery Soc(%)": None,
        "SOH": None,
        "Battery Pack Voltage": None,
        "Vehicle Status": None
    },
    "payment_records": {
        "driver": None,
        "vehicle": None,
        "date": None,
        "time": None,
        "amount": None,
        "payment_mode": None,
        "distance": None,
        "pickup_location": None,
        "drop_location": None,
        "platform": None,
        "screenshot_filename": None,
        "month_year": None
    },
    "drivers": {
        "name": None,
        "phone_number": None,
        "dl_number": None,
        "status": None,
        "created_at": None,
        "updated_at": None
    },
    "vehicle_documents": {
        "vin": None,
        "vehicle_number": None,
        "rc_book": None,
        "insurance_doc": None,
        "insurance_start_date": None,
        "insurance_expiry_date": None,
        "vehicle_model_number": None,
        "vehicle_manufacturer": None
    },
    "vehicle_mapping": {
        "vehicle_id": None,
        "registration_number": None
    },
    "shift_assignments": {
        "vehicle_reg_no": None,
        "driver_name": None,
        "shift_date": None,
        "shift_start_time": None,
        "shift_end_time": None,
        "driver_color": None,
        "notes": None
    },
    "telecaller_profiles": {
        "name": None,
        "email": None,
        "status": None,
        "total_assigned_leads": None,
        "active_leads": None,
        "converted_leads": None
    },
    "payment_folders": {
        "name": None,
        "month": None,
        "year": None,
        "monthLabel": None,
        "fullName": None,
        "permanent": None
    },
    "qr_codes": {
        "name": None,
        "campaign_name": None,
        "landing_page_type": None,
        "landing_page_single": None,
        "qr_image_filename": None,
        "unique_short_code": None,
        "is_active": None,
        "total_scans": None
    },
    "qr_scans": {
        "qr_code_id": None,
        "scan_datetime": None,
        "ip_address": None,
        "device_type": None,
        "browser": None,
        "os": None
    },
    "expenses": {
        "user_id": None,
        "user_name": None,
        "date": None,
        "description": None,
        "amount": None,
        "receipt_filenames": None,
        "approval_status": None
    },
    "hotspot_analyses": {
        "filename": None,
        "analysis_result": None,
        "total_rides": None,
        "time_slots_count": None
    },
    "app_settings": {
        "type": None,
        "payment_extractor_enabled": None,
        "maintenance_mode": None,
        "webhook_url": None,
        "daily_report_time": None,
        "enabled": None
    },
    "admin_files": {
        "filename": None,
        "original_filename": None,
        "file_path": None,
        "file_size": None,
        "content_type": None
    },
    "password_reset_requests": {
        "user_id": None,
        "user_email": None,
        "status": None,
        "temporary_password": None
    },
    "user_activity_logs": {
        "user_email": None,
        "action": None,
        "details": None,
        "module": None,
        "timestamp": None
    },
    "sync_metadata": {
        "key": None,
        "value": None,
        "updated_at": None
    },
    "customers": {},
    "driver_onboarding_leads": {},
    "ride_pay_folders": {},
    "ride_pay_images": {},
    "rides": {},
    "vehicle_service_requests": {}
}

# ========== SCHEMA SYNC LOGIC ==========

for col_name, fields in schema.items():
    col = db[col_name]

    # Create collection if empty
    if col.count_documents({}) == 0:
        print(f"📁 Creating new collection: {col_name}")
        col.insert_one({"_init": True})

    # Add missing fields
    for field in fields:
        update = col.update_many(
            {field: {"$exists": False}},
            {"$set": {field: None}}
        )
        if update.modified_count > 0:
            print(f"🔧 Added missing field '{field}' in {col_name}")

print("🎉 MongoDB Schema Sync Completed!")
