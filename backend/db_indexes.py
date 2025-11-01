"""
Database Index Creation Script for Performance Optimization

This script creates indexes on MongoDB collections to dramatically improve
query performance for Montra Vehicle Insights and Driver Onboarding.

Run this once after deployment to optimize production database.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

# Get MongoDB connection from environment
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/nura_pulse')

async def create_indexes():
    """Create all necessary indexes for optimal performance"""
    
    print(f"[{datetime.now()}] Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.get_database()
    
    print(f"[{datetime.now()}] Creating indexes for performance optimization...")
    
    # ==================== MONTRA FEED DATA INDEXES ====================
    print("\n[Montra Feed Data] Creating indexes...")
    
    # Compound index for battery consumption queries (vehicle_id + date)
    # This is the most critical index for battery consumption performance
    await db.montra_feed_data.create_index(
        [("vehicle_id", 1), ("date", 1)],
        name="idx_vehicle_date"
    )
    print("✓ Created compound index on (vehicle_id, date)")
    
    # Index for date queries
    await db.montra_feed_data.create_index(
        [("date", 1)],
        name="idx_date"
    )
    print("✓ Created index on date")
    
    # Index for vehicle_id queries
    await db.montra_feed_data.create_index(
        [("vehicle_id", 1)],
        name="idx_vehicle_id"
    )
    print("✓ Created index on vehicle_id")
    
    # Index for Date field (used for sorting)
    await db.montra_feed_data.create_index(
        [("Date", 1)],
        name="idx_Date"
    )
    print("✓ Created index on Date (for sorting)")
    
    # ==================== DRIVER LEADS INDEXES ====================
    print("\n[Driver Leads] Creating indexes...")
    
    # Index for telecaller assignments (most common query)
    await db.driver_leads.create_index(
        [("assigned_telecaller", 1)],
        name="idx_assigned_telecaller"
    )
    print("✓ Created index on assigned_telecaller")
    
    # Index for import_date (used for date filtering)
    await db.driver_leads.create_index(
        [("import_date", 1)],
        name="idx_import_date"
    )
    print("✓ Created index on import_date")
    
    # Compound index for telecaller + date queries
    await db.driver_leads.create_index(
        [("assigned_telecaller", 1), ("import_date", 1)],
        name="idx_telecaller_date"
    )
    print("✓ Created compound index on (assigned_telecaller, import_date)")
    
    # Index for phone number searches (exact match)
    await db.driver_leads.create_index(
        [("phone_number", 1)],
        name="idx_phone_number"
    )
    print("✓ Created index on phone_number")
    
    # Text index for name searches (partial matching)
    try:
        await db.driver_leads.create_index(
            [("name", "text")],
            name="idx_name_text"
        )
        print("✓ Created text index on name")
    except Exception as e:
        print(f"⚠ Text index on name may already exist: {e}")
    
    # Index for status (used for filtering)
    await db.driver_leads.create_index(
        [("status", 1)],
        name="idx_status"
    )
    print("✓ Created index on status")
    
    # Index for stage (used for filtering)
    await db.driver_leads.create_index(
        [("stage", 1)],
        name="idx_stage"
    )
    print("✓ Created index on stage")
    
    # Index for source (used for filtering by import source)
    await db.driver_leads.create_index(
        [("source", 1)],
        name="idx_source"
    )
    print("✓ Created index on source")
    
    # ==================== QR CODES INDEXES ====================
    print("\n[QR Codes] Creating indexes...")
    
    # Index for campaign queries
    await db.qr_codes.create_index(
        [("campaign_name", 1)],
        name="idx_campaign_name"
    )
    print("✓ Created index on campaign_name")
    
    # Index for short_code (used in redirects)
    await db.qr_codes.create_index(
        [("unique_short_code", 1)],
        unique=True,
        name="idx_unique_short_code"
    )
    print("✓ Created unique index on unique_short_code")
    
    # Index for published status
    await db.qr_codes.create_index(
        [("published", 1)],
        name="idx_published"
    )
    print("✓ Created index on published")
    
    # ==================== QR SCANS INDEXES ====================
    print("\n[QR Scans] Creating indexes...")
    
    # Index for qr_code_id (used for analytics)
    await db.qr_scans.create_index(
        [("qr_code_id", 1)],
        name="idx_qr_code_id"
    )
    print("✓ Created index on qr_code_id")
    
    # Index for campaign_name (used for campaign analytics)
    await db.qr_scans.create_index(
        [("campaign_name", 1)],
        name="idx_campaign_name"
    )
    print("✓ Created index on campaign_name")
    
    # Index for scanned_at (used for date filtering)
    await db.qr_scans.create_index(
        [("scanned_at", -1)],
        name="idx_scanned_at"
    )
    print("✓ Created index on scanned_at (descending)")
    
    # Compound index for duplicate scan prevention
    await db.qr_scans.create_index(
        [("ip_address", 1), ("qr_code_id", 1), ("scanned_at", -1)],
        name="idx_duplicate_prevention"
    )
    print("✓ Created compound index for duplicate scan prevention")
    
    # ==================== USERS INDEXES ====================
    print("\n[Users] Creating indexes...")
    
    # Index for email (used for login and lookups)
    await db.users.create_index(
        [("email", 1)],
        unique=True,
        name="idx_email"
    )
    print("✓ Created unique index on email")
    
    # Index for account_type (used for filtering telecallers, admins, etc.)
    await db.users.create_index(
        [("account_type", 1)],
        name="idx_account_type"
    )
    print("✓ Created index on account_type")
    
    # Index for status (used for filtering active users)
    await db.users.create_index(
        [("status", 1)],
        name="idx_user_status"
    )
    print("✓ Created index on status")
    
    # ==================== VERIFY INDEXES ====================
    print("\n[Verification] Checking created indexes...")
    
    collections_to_check = [
        "montra_feed_data",
        "driver_leads",
        "qr_codes",
        "qr_scans",
        "users"
    ]
    
    for collection_name in collections_to_check:
        indexes = await db[collection_name].list_indexes().to_list(None)
        print(f"\n{collection_name}: {len(indexes)} indexes")
        for idx in indexes:
            print(f"  - {idx['name']}: {idx.get('key', {})}")
    
    print(f"\n[{datetime.now()}] ✓ All indexes created successfully!")
    print("\nPerformance improvements expected:")
    print("  • Battery consumption queries: 10-100x faster")
    print("  • Driver leads loading: 5-50x faster")
    print("  • Search operations: 10-100x faster")
    print("  • QR code redirects: Instant")
    
    client.close()

if __name__ == "__main__":
    print("=" * 60)
    print("MongoDB Performance Optimization Script")
    print("=" * 60)
    asyncio.run(create_indexes())
    print("\n" + "=" * 60)
    print("Index creation complete! Your app should now be much faster.")
    print("=" * 60)
