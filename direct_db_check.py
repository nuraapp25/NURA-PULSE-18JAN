#!/usr/bin/env python3
"""
Direct Database Check - Check MongoDB directly
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).parent / "backend"
load_dotenv(ROOT_DIR / '.env')

async def check_database():
    """Check MongoDB directly"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔍 DIRECT DATABASE CHECK")
    print("=" * 50)
    
    # 1. Check QR codes collection
    print("\n1. Checking QR codes...")
    qr_codes = await db.qr_codes.find({}).limit(3).to_list(None)
    print(f"   Found {len(qr_codes)} QR codes (showing first 3)")
    
    for qr in qr_codes:
        qr_id = qr.get("id")
        qr_name = qr.get("qr_name", "Unknown")
        scan_count = qr.get("scan_count", 0)
        campaign = qr.get("campaign_name", "Unknown")
        print(f"   - {qr_name} (ID: {qr_id}) - Scan Count: {scan_count} - Campaign: {campaign}")
        
        # 2. Check scans for this QR code
        print(f"\n2. Checking scans for QR ID: {qr_id}")
        scans = await db.qr_scans.find({"qr_code_id": qr_id}).to_list(None)
        print(f"   Found {len(scans)} scans in qr_scans collection")
        
        if scans:
            print("   Scan details:")
            for i, scan in enumerate(scans):
                print(f"     Scan {i+1}:")
                print(f"       - ID: {scan.get('id')}")
                print(f"       - QR Code ID: {scan.get('qr_code_id')}")
                print(f"       - Scanned At: {scan.get('scanned_at')}")
                print(f"       - Platform: {scan.get('platform')}")
                print(f"       - IP: {scan.get('ip_address')}")
                print(f"       - Device: {scan.get('device')}")
                print(f"       - Browser: {scan.get('browser')}")
                print(f"       - Location: {scan.get('location_city')}, {scan.get('location_country')}")
        else:
            print("   ❌ NO SCANS FOUND in qr_scans collection!")
            print(f"   But QR code shows scan_count = {scan_count}")
            print("   This indicates scans are incrementing count but not storing scan records!")
        
        print("-" * 40)
    
    # 3. Check all scans in collection
    print(f"\n3. Checking ALL scans in qr_scans collection...")
    all_scans = await db.qr_scans.find({}).to_list(None)
    print(f"   Total scans in collection: {len(all_scans)}")
    
    if all_scans:
        print("   Recent scans:")
        for scan in all_scans[-3:]:  # Show last 3
            print(f"     - QR ID: {scan.get('qr_code_id')} | Platform: {scan.get('platform')} | Time: {scan.get('scanned_at')}")
    
    # 4. Check collection indexes
    print(f"\n4. Checking qr_scans collection indexes...")
    indexes = await db.qr_scans.list_indexes().to_list(None)
    print(f"   Indexes on qr_scans:")
    for index in indexes:
        print(f"     - {index.get('name')}: {index.get('key')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_database())