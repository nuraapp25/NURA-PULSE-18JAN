
import asyncio
import json
import os
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet
import logging
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

# CONFIGURATION
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "nura_pulse_db"
USERS_FILE_PATH = r"c:\Users\MUNIRAJ\Downloads\users_export_all_2026-01-19.json"
SCHEMA_FILE_PATH = r"c:\Users\MUNIRAJ\Downloads\database_schema.json"

async def main():
    logger.info("🚀 Starting database seeding process...")

    # 1. Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    logger.info(f"✅ Connected to MongoDB: {DB_NAME}")

    # 2. Read Users File and Decrypt
    try:
        with open(USERS_FILE_PATH, 'r') as f:
            users_data = json.load(f)
        
        encrypted_data = users_data.get('encrypted_data')
        encryption_key = users_data.get('encryption_key')
        
        if not encrypted_data or not encryption_key:
            logger.error("❌ Invalid users file format: missing encrypted_data or encryption_key")
            return

        logger.info("🔐 Decrypting user data...")
        f = Fernet(encryption_key)
        decrypted_content = f.decrypt(encrypted_data.encode()).decode()
        users_list = json.loads(decrypted_content)
        
        logger.info(f"📄 Found {len(users_list)} users to insert.")

        # 3. Insert Users
        users_collection = db["users"]
        # Create unique index on email if not exists
        await users_collection.create_index("email", unique=True)
        
        success_count = 0
        skipped_count = 0
        
        for user in users_list:
            email = user.get('email')
            if not email:
                continue
                
            # Upsert user based on email
            result = await users_collection.replace_one(
                {"email": email},
                user,
                upsert=True
            )
            
            if result.upserted_id or result.modified_count > 0:
                success_count += 1
            else:
                skipped_count += 1
        
        logger.info(f"✅ Users synced: {success_count} inserted/updated, {skipped_count} unchanged.")

    except FileNotFoundError:
        logger.error(f"❌ Users file not found at: {USERS_FILE_PATH}")
    except Exception as e:
        logger.error(f"❌ Error processing users: {str(e)}")

    # 4. Initialize Other Collections (from Schema)
    try:
        with open(SCHEMA_FILE_PATH, 'r') as f:
            schema_data = json.load(f)
            
        collections_info = schema_data.get('collections', {})
        logger.info(f"📂 Verifying {len(collections_info)} collections from schema...")
        
        existing_collections = await db.list_collection_names()
        
        created_count = 0
        for col_name in collections_info.keys():
            if col_name not in existing_collections:
                await db.create_collection(col_name)
                created_count += 1
                logger.info(f"   - Created collection: {col_name}")
        
        if created_count > 0:
            logger.info(f"✅ Created {created_count} missing collections.")
        else:
            logger.info("✅ All collections already exist.")

    except FileNotFoundError:
         logger.error(f"❌ Schema file not found at: {SCHEMA_FILE_PATH}")
    except Exception as e:
        logger.error(f"❌ Error converting schema: {str(e)}")

    logger.info("🏁 Database seeding completed.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
