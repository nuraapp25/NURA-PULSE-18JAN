"""
Background worker for Ride Pay Extract v2
Processes uploaded images one by one and extracts payment data
"""

import os
import asyncio
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import uuid
from PIL import Image
import io

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017/nura_pulse")
client = AsyncIOMotorClient(MONGO_URL)
db = client.get_database()

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# Extraction prompt
EXTRACTION_PROMPT = """You are analyzing ride-sharing receipt screenshots (Tamil/English). These can be in multiple formats:

**FORMAT TYPES:**
1. Simple cash receipts: "Auto", time, கேஷ், ₹amount
2. Detailed app receipts: "Auto", ₹amount, distance (கி.மீ), duration (நிமி, வி), time
3. Paytm detailed receipts: "மதிப்பிடப்பட்ட வருவாய்" (Estimated Fare), distance with decimals (2.36 km), duration with decimals (16.67 min), pickup/drop locations
4. Ride history list: Multiple rides with timestamps like "10:59 pm", "10:18 pm", pickup/drop locations, fare amounts
5. Surge pricing: Upward arrow ↑ with "அதிகரித்துள்ளது" (increased)
6. Cancellations: "வாடிக்கையாளர் ரத்துசெய்தார்" (customer cancelled)
7. Zero-fare rides: ₹0.00 with promotional text or cancellation

**TAMIL TEXT MEANINGS:**
- கேஷ் = Cash
- கி.மீ / km = Kilometers
- நிமி = Minutes (நிமிடம்)
- வி = Seconds (விநாடி)
- ம.நே = Hours (மணிநேரம்)
- மதிப்பிடப்பட்ட வருவாய் = Estimated Fare
- பிக்கப் = Pickup
- முரபி / டிராப் = Dropoff/Drop
- அதிகரித்துள்ளது = Surge/Increased pricing
- வாடிக்கையாளர் ரத்துசெய்தார் = Customer cancelled
- ஆட்டோ ஆர்டர் = Auto Order
- முடிந்த ஆர்டர்கள் = Completed orders/rides

**EXTRACT EACH RIDE AS JSON:**

[
  {
    "driver": "Driver name if visible, otherwise N/A",
    "vehicle": "Vehicle number if visible, otherwise N/A", 
    "description": "Auto, Bike, Car, etc. If surge add (Surge), if cancelled add (Cancelled)",
    "date": "DD/MM/YYYY format (convert DD MMM or date from screenshot)",
    "time": "HH:MM AM/PM format",
    "amount": "Fare amount as NUMBER only (no ₹, commas). Use 0 for ₹0.00 rides",
    "payment_mode": "Cash/UPI/Card if visible, otherwise N/A",
    "distance": "Extract km as NUMBER only (e.g., '3.57' from '3.57 கி.மீ'), or N/A",
    "duration": "Convert to MINUTES as NUMBER (e.g., '16' for '16 நிமி', '71' for '1 ம.நே 11 நிமி'), or N/A", 
    "pickup_km": "N/A",
    "drop_km": "N/A",
    "pickup_location": "N/A",
    "drop_location": "N/A"
  }
]

**EXTRACTION RULES:**
✅ Extract EVERY visible ride (including ₹0.00 if cancelled/promotional)
✅ For duration: Convert hours to minutes (1 hour 11 min = 71 min)
✅ Accept decimal distances: "2.36 km" → 2.36
✅ Accept decimal durations: "16.67 min" → 16.67
✅ For surge pricing: Include in description (e.g., "Auto (Surge)")
✅ For cancellations: Set amount to 0, add to description (e.g., "Auto (Cancelled)")
✅ Skip only "Bank Transfer" entries or unrelated promotional banners
✅ Extract distance/duration as numbers (remove Tamil/English text)
✅ If screenshot shows "26 September" or "செப்." convert to DD/MM/2024 format
✅ Extract pickup/drop locations if visible (e.g., "Crown Residences", "Mogappair West")
✅ For ride history lists: Extract each ride separately with its timestamp

⚠️ **CRITICAL RULES - NO ASSUMPTIONS:**
❌ DO NOT copy or assume data from other rides in the same screenshot
❌ DO NOT guess missing pickup/drop locations - use "N/A" if not visible
❌ DO NOT assume the same location repeats across multiple rides
❌ DO NOT fill in missing data based on other rides
✅ ONLY extract data that is CLEARLY VISIBLE for each specific ride
✅ If a ride has no visible pickup location, use "N/A" - DO NOT copy from other rides
✅ If a ride has no visible drop location, use "N/A" - DO NOT copy from other rides
✅ Each ride is independent - treat them separately

Be precise and extract ALL rides shown in the screenshot. If a screenshot shows multiple rides (like a ride history list), extract each as a separate record.
"""


async def optimize_image(file_path):
    """Optimize image before processing"""
    try:
        with open(file_path, 'rb') as f:
            img_bytes = f.read()
        
        image = Image.open(io.BytesIO(img_bytes))
        
        # Resize if too large
        max_dimension = 2048
        if max(image.size) > max_dimension:
            ratio = max_dimension / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Convert to RGB
        if image.mode not in ('RGB', 'RGBA'):
            image = image.convert('RGB')
        
        # Save optimized
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=85, optimize=True)
        return img_byte_arr.getvalue()
    except Exception as e:
        logger.error(f"Image optimization failed: {str(e)}")
        with open(file_path, 'rb') as f:
            return f.read()


async def process_single_image(image_doc, folder_doc):
    """Process a single image and extract payment data"""
    try:
        logger.info(f"Processing image: {image_doc['filename']}")
        
        # Update status to processing
        await db.ride_pay_images.update_one(
            {'id': image_doc['id']},
            {'$set': {
                'status': 'processing',
                'processing_started_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Optimize and encode image
        file_content = await optimize_image(image_doc['filepath'])
        image_base64 = base64.b64encode(file_content).decode('utf-8')
        
        # Create ImageContent
        image_content = ImageContent(image_base64=image_base64)
        
        # Initialize LLM chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ride-pay-v2-{uuid.uuid4()}",
            system_message="You are an expert at extracting ride payment details from screenshots. Extract ONLY visible data accurately."
        ).with_model("openai", "gpt-4o")
        
        # Send to OpenAI GPT-4o Vision with timeout
        user_message = UserMessage(
            text=EXTRACTION_PROMPT,
            file_contents=[image_content]
        )
        
        response = await asyncio.wait_for(
            chat.send_message(user_message),
            timeout=90.0
        )
        
        # Parse JSON response
        import json
        clean_response = response.strip()
        if clean_response.startswith("```json"):
            clean_response = clean_response[7:]
        if clean_response.endswith("```"):
            clean_response = clean_response[:-3]
        clean_response = clean_response.strip()
        
        parsed_data = json.loads(clean_response)
        
        # Handle both single object and array responses
        results = []
        if isinstance(parsed_data, list):
            results = parsed_data
        else:
            results = [parsed_data]
        
        # Save extracted data to ride_pay_data collection
        extracted_count = 0
        for ride_data in results:
            ride_data["id"] = str(uuid.uuid4())
            ride_data["folder_id"] = folder_doc['id']
            ride_data["image_id"] = image_doc['id']
            ride_data["screenshot_filename"] = image_doc['filename']
            ride_data["month_year"] = folder_doc['month_year']
            ride_data["driver"] = folder_doc.get('driver_name', ride_data.get('driver', 'N/A'))
            ride_data["vehicle"] = folder_doc.get('vehicle_number', ride_data.get('vehicle', 'N/A'))
            ride_data["platform"] = folder_doc.get('platform', 'N/A')
            ride_data["extracted_at"] = datetime.now(timezone.utc).isoformat()
            ride_data["status"] = "pending"
            
            await db.ride_pay_data.insert_one(ride_data)
            extracted_count += 1
        
        # Update image status to completed
        await db.ride_pay_images.update_one(
            {'id': image_doc['id']},
            {'$set': {
                'status': 'completed',
                'processed_at': datetime.now(timezone.utc).isoformat(),
                'rides_extracted': extracted_count
            }}
        )
        
        # Update folder processed count
        await db.ride_pay_folders.update_one(
            {'id': folder_doc['id']},
            {'$inc': {'processed_images': 1}}
        )
        
        logger.info(f"✅ Image {image_doc['filename']} processed: {extracted_count} rides extracted")
        return True
        
    except asyncio.TimeoutError:
        logger.error(f"⏱️ Timeout processing image: {image_doc['filename']}")
        await db.ride_pay_images.update_one(
            {'id': image_doc['id']},
            {'$set': {
                'status': 'failed',
                'error': 'Processing timeout (>90 seconds)',
                'failed_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        return False
    except Exception as e:
        logger.error(f"❌ Error processing image {image_doc['filename']}: {str(e)}")
        await db.ride_pay_images.update_one(
            {'id': image_doc['id']},
            {'$set': {
                'status': 'failed',
                'error': str(e),
                'failed_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        return False


async def process_folder_worker(folder_id):
    """Process all pending images in a folder"""
    try:
        logger.info(f"Starting folder processing: {folder_id}")
        
        # Get folder
        folder = await db.ride_pay_folders.find_one({'id': folder_id})
        if not folder:
            logger.error(f"Folder not found: {folder_id}")
            return
        
        # Update folder status to processing
        await db.ride_pay_folders.update_one(
            {'id': folder_id},
            {'$set': {
                'status': 'processing',
                'processing_started_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Get all pending images
        pending_images = await db.ride_pay_images.find({
            'folder_id': folder_id,
            'status': 'pending'
        }).to_list(None)
        
        logger.info(f"Found {len(pending_images)} pending images to process")
        
        # Process each image one by one
        for image in pending_images:
            await process_single_image(image, folder)
            # Small delay between images
            await asyncio.sleep(0.5)
        
        # Check if all images are processed
        total_images = await db.ride_pay_images.count_documents({'folder_id': folder_id})
        completed_images = await db.ride_pay_images.count_documents({
            'folder_id': folder_id,
            'status': 'completed'
        })
        failed_images = await db.ride_pay_images.count_documents({
            'folder_id': folder_id,
            'status': 'failed'
        })
        
        # Update folder status
        if completed_images + failed_images == total_images:
            await db.ride_pay_folders.update_one(
                {'id': folder_id},
                {'$set': {
                    'status': 'completed',
                    'completed_at': datetime.now(timezone.utc).isoformat(),
                    'total_images': total_images,
                    'processed_images': completed_images,
                    'failed_images': failed_images
                }}
            )
            logger.info(f"✅ Folder processing complete: {folder_id}")
        else:
            logger.warning(f"⚠️ Folder processing incomplete: {folder_id}")
        
    except Exception as e:
        logger.error(f"❌ Error processing folder {folder_id}: {str(e)}")
        await db.ride_pay_folders.update_one(
            {'id': folder_id},
            {'$set': {
                'status': 'failed',
                'error': str(e),
                'failed_at': datetime.now(timezone.utc).isoformat()
            }}
        )


if __name__ == "__main__":
    # This worker can be called from the API to process folders
    logger.info("Ride Pay Extract v2 Worker initialized")
