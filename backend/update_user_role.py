#!/usr/bin/env python3
"""
Update user role to master_admin
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['nura_pulse_db']

async def update_user_to_master_admin(search_name):
    """Update user role to master_admin"""
    print(f"Searching for user: {search_name}")
    
    # Find user by name (case insensitive)
    user = await db.users.find_one({'name': {'$regex': search_name, '$options': 'i'}})
    
    if user:
        print(f"\nFound user:")
        print(f"  Name: {user.get('name')}")
        print(f"  Email: {user.get('email')}")
        print(f"  Current role: {user.get('account_type')}")
        
        # Update to master_admin
        result = await db.users.update_one(
            {'_id': user['_id']},
            {'$set': {'account_type': 'master_admin'}}
        )
        
        if result.modified_count > 0:
            print(f"\n✅ Successfully updated {user.get('name')} to master_admin")
        else:
            print(f"\n⚠️ User was already master_admin")
        
        return True
    else:
        print(f"\n❌ User '{search_name}' not found")
        print("\nAvailable users:")
        users = await db.users.find({}).to_list(length=None)
        for u in users:
            print(f"  - {u.get('name')} ({u.get('email')}) - {u.get('account_type')}")
        return False

if __name__ == "__main__":
    success = asyncio.run(update_user_to_master_admin("ashok"))
    exit(0 if success else 1)
