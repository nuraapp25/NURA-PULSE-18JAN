#!/usr/bin/env python3
"""
Initialize permanent payment reconciliation folders
Creates Sep 2025 and Oct 2025 folders in MongoDB
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'nura_pulse_db')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Permanent folders to create
PERMANENT_FOLDERS = [
    {
        "name": "Sep 2025",
        "month": "sep",
        "year": "2025",
        "monthLabel": "Sep",
        "fullName": "September",
        "createdAt": datetime.now().isoformat(),
        "permanent": True
    },
    {
        "name": "Oct 2025",
        "month": "oct",
        "year": "2025",
        "monthLabel": "Oct",
        "fullName": "October",
        "createdAt": datetime.now().isoformat(),
        "permanent": True
    }
]

async def init_folders():
    """Initialize permanent folders in MongoDB"""
    print("Initializing permanent payment reconciliation folders...")
    
    try:
        # Check if folders already exist
        existing_folders = await db.payment_folders.find({}).to_list(length=None)
        existing_names = {folder.get('name') for folder in existing_folders}
        
        print(f"Found {len(existing_folders)} existing folders: {existing_names}")
        
        # Insert only folders that don't exist
        folders_to_insert = []
        for folder in PERMANENT_FOLDERS:
            if folder['name'] not in existing_names:
                folders_to_insert.append(folder)
                print(f"  Will create: {folder['name']}")
            else:
                print(f"  Already exists: {folder['name']}")
        
        if folders_to_insert:
            result = await db.payment_folders.insert_many(folders_to_insert)
            print(f"\n✅ Successfully created {len(result.inserted_ids)} permanent folders")
        else:
            print("\n✅ All permanent folders already exist")
        
        # List all folders
        all_folders = await db.payment_folders.find({}).to_list(length=None)
        print(f"\nTotal folders in database: {len(all_folders)}")
        for folder in all_folders:
            print(f"  - {folder['name']} (permanent: {folder.get('permanent', False)})")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error initializing folders: {str(e)}")
        return False

if __name__ == "__main__":
    success = asyncio.run(init_folders())
    exit(0 if success else 1)
