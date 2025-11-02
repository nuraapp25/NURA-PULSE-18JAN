"""
Background Analytics Cache System
Pre-computes heavy analytics data for faster frontend display
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, date, time as dt_time, timedelta, timezone
import os
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL')
client = AsyncIOMotorClient(MONGO_URL)
db = client['nura_db']


async def compute_battery_audit_cache():
    """Pre-compute battery audit data and cache it"""
    try:
        logger.info("=== Starting Battery Audit Cache Computation ===")
        
        # Limit to last 30 days
        cutoff_date = (date.today() - timedelta(days=30)).isoformat()
        
        pipeline = [
            {"$match": {"date": {"$gte": cutoff_date}}},
            {"$project": {
                "_id": 0,
                "vehicle_id": 1,
                "registration_number": 1,
                "date": 1,
                "Date": 1,
                "Battery Soc(%)": 1,
                "Battery SOC(%)": 1,
                "Odometer (km)": 1
            }},
            {"$sort": {"date": -1, "Date": 1}},
            {"$limit": 50000}
        ]
        
        cursor = db.montra_feed_data.aggregate(pipeline)
        
        # Group records by vehicle and date
        vehicle_date_groups = {}
        record_count = 0
        
        async for record in cursor:
            record_count += 1
            vehicle_id = record.get("vehicle_id")
            registration = record.get("registration_number")
            date_val = record.get("date")
            
            if not vehicle_id or not date_val:
                continue
            
            display_name = registration if registration else vehicle_id
            key = f"{vehicle_id}_{date_val}"
            
            if key not in vehicle_date_groups:
                vehicle_date_groups[key] = {
                    "vehicle_id": vehicle_id,
                    "display_name": display_name,
                    "date": date_val,
                    "records": []
                }
            vehicle_date_groups[key]["records"].append(record)
        
        logger.info(f"Grouped {record_count} records into {len(vehicle_date_groups)} vehicle-dates")
        
        # Process audit data
        audit_results = []
        critical_count = 0
        
        for key, group in vehicle_date_groups.items():
            records = group["records"]
            
            # Find records closest to 6 AM, 12 PM, and 5 PM
            target_times = {
                "6am": dt_time(6, 0),
                "12pm": dt_time(12, 0),
                "5pm": dt_time(17, 0)
            }
            
            closest_records = {}
            for time_label, target_time in target_times.items():
                min_diff = timedelta(hours=24)
                closest_record = None
                
                for record in records:
                    time_str = record.get("Date") or record.get("time")
                    if not time_str:
                        continue
                    
                    try:
                        if isinstance(time_str, str):
                            record_time = datetime.fromisoformat(time_str.replace('Z', '+00:00')).time()
                        else:
                            record_time = time_str if isinstance(time_str, dt_time) else datetime.min.time()
                        
                        time_diff = abs(
                            datetime.combine(date.today(), record_time) - 
                            datetime.combine(date.today(), target_time)
                        )
                        
                        if time_diff < min_diff:
                            min_diff = time_diff
                            closest_record = record
                    except:
                        continue
                
                if closest_record and min_diff < timedelta(hours=2):
                    closest_records[time_label] = closest_record
            
            if len(closest_records) >= 2:
                charge_6am = None
                charge_12pm = None
                charge_5pm = None
                odometer_6am = None
                odometer_12pm = None
                odometer_5pm = None
                
                if "6am" in closest_records:
                    rec = closest_records["6am"]
                    charge_6am = rec.get("Battery Soc(%)") or rec.get("Battery SOC(%)")
                    odometer_6am = rec.get("Odometer (km)")
                
                if "12pm" in closest_records:
                    rec = closest_records["12pm"]
                    charge_12pm = rec.get("Battery Soc(%)") or rec.get("Battery SOC(%)")
                    odometer_12pm = rec.get("Odometer (km)")
                
                if "5pm" in closest_records:
                    rec = closest_records["5pm"]
                    charge_5pm = rec.get("Battery Soc(%)") or rec.get("Battery SOC(%)")
                    odometer_5pm = rec.get("Odometer (km)")
                
                km_6_to_12 = None
                km_6_to_5 = None
                mileage_6_to_12 = None
                mileage_6_to_5 = None
                
                if odometer_6am and odometer_12pm:
                    km_6_to_12 = odometer_12pm - odometer_6am
                    if charge_6am and charge_12pm and charge_6am > charge_12pm:
                        charge_drop = charge_6am - charge_12pm
                        if charge_drop > 0:
                            mileage_6_to_12 = round(km_6_to_12 / charge_drop, 2)
                
                if odometer_6am and odometer_5pm:
                    km_6_to_5 = odometer_5pm - odometer_6am
                    if charge_6am and charge_5pm and charge_6am > charge_5pm:
                        charge_drop = charge_6am - charge_5pm
                        if charge_drop > 0:
                            mileage_6_to_5 = round(km_6_to_5 / charge_drop, 2)
                
                is_critical = False
                if charge_12pm and charge_5pm:
                    if charge_12pm < 60 and charge_5pm < 20:
                        is_critical = True
                        critical_count += 1
                
                audit_results.append({
                    "date": group["date"],
                    "vehicle_name": group["display_name"],
                    "charge_6am": charge_6am,
                    "charge_12pm": charge_12pm,
                    "charge_5pm": charge_5pm,
                    "km_6_to_12": km_6_to_12,
                    "km_6_to_5": km_6_to_5,
                    "mileage_6_to_12": mileage_6_to_12,
                    "mileage_6_to_5": mileage_6_to_5,
                    "is_critical": is_critical
                })
        
        # Sort by date descending
        audit_results.sort(key=lambda x: x["date"], reverse=True)
        
        # Cache the results
        cache_doc = {
            "cache_type": "battery_audit",
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "data": {
                "success": True,
                "audit_results": audit_results,
                "count": len(audit_results),
                "critical_count": critical_count,
                "message": f"Battery audit data (last 30 days). Cached at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC"
            }
        }
        
        # Upsert into cache collection
        await db.analytics_cache.update_one(
            {"cache_type": "battery_audit"},
            {"$set": cache_doc},
            upsert=True
        )
        
        logger.info(f"✓ Battery Audit Cache Updated: {len(audit_results)} results, {critical_count} critical")
        return True
        
    except Exception as e:
        logger.error(f"Error computing battery audit cache: {e}")
        return False


async def compute_morning_charge_cache():
    """Pre-compute morning charge audit data and cache it"""
    try:
        logger.info("=== Starting Morning Charge Audit Cache Computation ===")
        
        cutoff_date = (date.today() - timedelta(days=30)).isoformat()
        
        pipeline = [
            {"$match": {"date": {"$gte": cutoff_date}}},
            {"$project": {
                "_id": 0,
                "vehicle_id": 1,
                "Vehicle ID": 1,
                "registration_number": 1,
                "Registration Number": 1,
                "date": 1,
                "Date": 1,
                "Portal Received Time": 1,
                "time": 1,
                "Time": 1,
                "Battery Soc(%)": 1,
                "Battery SOC(%)": 1,
                "Battery %": 1,
                "battery_soc_percentage": 1
            }},
            {"$sort": {"date": -1}},
            {"$limit": 50000}
        ]
        
        cursor = db.montra_feed_data.aggregate(pipeline)
        
        vehicle_date_groups = {}
        record_count = 0
        
        async for record in cursor:
            record_count += 1
            vehicle_id = record.get("vehicle_id") or record.get("Vehicle ID")
            registration = record.get("registration_number") or record.get("Registration Number")
            date_val = record.get("date")
            
            if not vehicle_id or not date_val:
                continue
            
            display_name = registration if registration else vehicle_id
            key = f"{vehicle_id}_{date_val}"
            
            if key not in vehicle_date_groups:
                vehicle_date_groups[key] = {
                    "vehicle_id": vehicle_id,
                    "display_name": display_name,
                    "date": date_val,
                    "records": []
                }
            vehicle_date_groups[key]["records"].append(record)
        
        logger.info(f"Grouped {record_count} records into {len(vehicle_date_groups)} vehicle-dates")
        
        audit_results = []
        target_time_6am = dt_time(6, 0)
        
        for key, group in vehicle_date_groups.items():
            records = group["records"]
            
            min_diff = timedelta(hours=24)
            closest_record = None
            
            for record in records:
                time_str = (record.get("Date") or record.get("time") or 
                           record.get("Time") or record.get("Portal Received Time"))
                
                if not time_str:
                    continue
                
                try:
                    if isinstance(time_str, str):
                        record_time = datetime.fromisoformat(time_str.replace('Z', '+00:00')).time()
                    else:
                        record_time = time_str if isinstance(time_str, dt_time) else datetime.min.time()
                    
                    time_diff = abs(
                        datetime.combine(date.today(), record_time) - 
                        datetime.combine(date.today(), target_time_6am)
                    )
                    
                    if time_diff < min_diff:
                        min_diff = time_diff
                        closest_record = record
                except:
                    continue
            
            if closest_record and min_diff < timedelta(hours=2):
                battery_charge = (closest_record.get("Battery Soc(%)") or 
                                 closest_record.get("Battery SOC(%)") or
                                 closest_record.get("Battery %") or
                                 closest_record.get("battery_soc_percentage"))
                
                if battery_charge and battery_charge < 95:
                    audit_results.append({
                        "date": group["date"],
                        "vehicle_name": group["display_name"],
                        "charge_6am": battery_charge
                    })
        
        audit_results.sort(key=lambda x: x["date"], reverse=True)
        
        cache_doc = {
            "cache_type": "morning_charge_audit",
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "data": {
                "success": True,
                "audit_results": audit_results,
                "count": len(audit_results),
                "message": f"Morning charge audit data (last 30 days). Cached at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC"
            }
        }
        
        await db.analytics_cache.update_one(
            {"cache_type": "morning_charge_audit"},
            {"$set": cache_doc},
            upsert=True
        )
        
        logger.info(f"✓ Morning Charge Audit Cache Updated: {len(audit_results)} results")
        return True
        
    except Exception as e:
        logger.error(f"Error computing morning charge cache: {e}")
        return False


async def run_all_cache_jobs():
    """Run all cache computation jobs"""
    logger.info("=" * 60)
    logger.info("STARTING ANALYTICS CACHE COMPUTATION")
    logger.info("=" * 60)
    
    start_time = datetime.now()
    
    # Run jobs in parallel
    results = await asyncio.gather(
        compute_battery_audit_cache(),
        compute_morning_charge_cache(),
        return_exceptions=True
    )
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    logger.info("=" * 60)
    logger.info(f"CACHE COMPUTATION COMPLETE in {duration:.2f} seconds")
    logger.info(f"Battery Audit: {'✓ SUCCESS' if results[0] else '✗ FAILED'}")
    logger.info(f"Morning Charge Audit: {'✓ SUCCESS' if results[1] else '✗ FAILED'}")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_all_cache_jobs())
