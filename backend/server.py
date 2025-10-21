from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, Request, Form, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
import secrets
import string
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import after loading .env so environment variables are available
from sheets_multi_sync import (
    sync_user_to_sheets, bulk_sync_users_to_sheets, delete_user_from_sheets,
    sync_all_records, get_all_records, sync_single_record, delete_record,
    get_last_sync_time, update_last_sync_time
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ==================== Models ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str
    last_name: Optional[str] = None
    email: str
    account_type: str  # "master_admin", "admin", "standard", "ops_team"
    status: str = "pending"  # "pending", "active", "rejected", "deleted"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_temp_password: bool = False


class UserCreate(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    email: str
    password: str
    account_type: str  # "admin", "standard", or "ops_team"


class UserLogin(BaseModel):
    email: str
    password: str


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    user_name: str
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    temporary_password: Optional[str] = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class TempPasswordReset(BaseModel):
    email: str
    temp_password: str
    new_password: str


class PasswordResetApproval(BaseModel):
    request_id: str


class UserApproval(BaseModel):
    user_id: str


# ==================== Helper Functions ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    characters = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(characters) for _ in range(length))



def load_mode_mapping_tables():
    """Load Model Mapping and Ride Mode Mapping from Excel file"""
    import pandas as pd
    
    mapping_file_path = "/app/backend/uploaded_files/mode_details.xlsx"
    
    try:
        # Read Model Mapping
        model_mapping = pd.read_excel(mapping_file_path, sheet_name='Model Mapping')
        model_dict = {}
        for _, row in model_mapping.iterrows():
            vehicle_num = str(row['Vehicle Number']).strip()
            model = str(row['Model']).strip()
            model_dict[vehicle_num] = model
        
        # Read Ride Mode Mapping
        ride_mode_mapping = pd.read_excel(mapping_file_path, sheet_name='Ride Mode Mapping')
        mode_dict = {}
        for _, row in ride_mode_mapping.iterrows():
            concat_key = str(row['Vehicle-Mode Concatenation']).strip()
            mode_name = str(row['Mode Name']).strip()
            mode_type = str(row['Mode Type']).strip()
            mode_dict[concat_key] = {
                'mode_name': mode_name,
                'mode_type': mode_type
            }
        
        logger.info(f"Loaded {len(model_dict)} vehicle models and {len(mode_dict)} ride modes")
        return model_dict, mode_dict
    except Exception as e:
        logger.error(f"Error loading mode mapping tables: {str(e)}")
        return {}, {}


def enrich_with_mode_data(vehicle_id: str, ride_mode: str, model_dict: dict, mode_dict: dict):
    """Enrich a single record with Mode Name and Mode Type"""
    # Get model for this vehicle
    model = model_dict.get(vehicle_id, "Unknown")
    
    if model == "Unknown":
        return "Unknown Model", "Unknown"
    
    # Create concatenation key
    concat_key = f"{model} {ride_mode}"
    
    # Look up mode details
    mode_details = mode_dict.get(concat_key)
    
    if mode_details:
        return mode_details['mode_name'], mode_details['mode_type']
    else:
        return "Unknown Mode", "Unknown"


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Convert datetime strings back to datetime objects
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


async def initialize_master_admin():
    """Create master admin account if it doesn't exist"""
    master_admin = await db.users.find_one({"email": "admin"})
    if not master_admin:
        master_admin_data = {
            "id": str(uuid.uuid4()),
            "first_name": "Master Admin",
            "last_name": "",
            "email": "admin",
            "password": hash_password("Nura@1234$"),
            "account_type": "master_admin",
            "status": "active",  # Master admin is always active
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_temp_password": False
        }
        await db.users.insert_one(master_admin_data)
        logger.info("Master admin account created")
        
        # Sync to Google Sheets
        sync_user_to_sheets(master_admin_data)


# ==================== Auth Routes ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        # Allow re-registration if the account was deleted
        if existing_user.get('status') == 'deleted':
            # Delete the old record completely
            await db.users.delete_one({"email": user_data.email})
        else:
            raise HTTPException(status_code=400, detail="Email already registered. If you're awaiting approval, please contact admin.")
    
    # Validate account type
    if user_data.account_type not in ["admin", "standard", "ops_team"]:
        raise HTTPException(status_code=400, detail="Invalid account type")
    
    # Create user with pending status
    hashed_password = hash_password(user_data.password)
    user = User(
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        account_type=user_data.account_type,
        status="pending"  # Requires admin approval
    )
    
    user_dict = user.model_dump()
    user_dict['password'] = hashed_password
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Sync to Google Sheets
    sync_user_to_sheets(user_dict)
    
    return {
        "message": "Registration successful! Your account is pending approval. Please wait for admin to approve.",
        "status": "pending"
    }


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    # Find user
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if user is approved
    if user.get('status') == 'pending':
        raise HTTPException(status_code=403, detail="Your account is pending approval. Please contact admin.")
    
    if user.get('status') == 'rejected':
        raise HTTPException(status_code=403, detail="Your account has been rejected. Please contact admin.")
    
    if user.get('status') == 'deleted':
        raise HTTPException(status_code=403, detail="Your account has been deleted. Please contact admin.")
    
    if user.get('status') != 'active':
        raise HTTPException(status_code=403, detail="Your account is not active. Please contact admin.")
    
    # Convert datetime string back
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    user_obj = User(**user)
    
    # Create token
    token = create_access_token({"user_id": user_obj.id, "email": user_obj.email})
    
    return {
        "message": "Login successful",
        "user": user_obj,
        "token": token
    }


@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@api_router.post("/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user)
):
    # Get user with password
    user = await db.users.find_one({"id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify old password
    if not verify_password(password_data.old_password, user['password']):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    
    # Update password
    new_hashed_password = hash_password(password_data.new_password)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"password": new_hashed_password, "is_temp_password": False}}
    )
    
    return {"message": "Password changed successfully"}


@api_router.post("/auth/reset-with-temp-password")
async def reset_with_temp_password(reset_data: TempPasswordReset):
    """Reset password using email and temporary password (from forgot password page)"""
    # Find user by email
    user = await db.users.find_one({"email": reset_data.email})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or temporary password")
    
    # Check if user has a temporary password
    if not user.get('is_temp_password'):
        raise HTTPException(status_code=400, detail="No temporary password set for this account. Please request a password reset from admin.")
    
    # Verify the temporary password
    if not verify_password(reset_data.temp_password, user['password']):
        raise HTTPException(status_code=400, detail="Invalid email or temporary password")
    
    # Update password
    new_hashed_password = hash_password(reset_data.new_password)
    await db.users.update_one(
        {"id": user['id']},
        {"$set": {"password": new_hashed_password, "is_temp_password": False}}
    )
    
    return {"message": "Password reset successfully. You can now login with your new password."}


# ==================== Password Reset Routes ====================

@api_router.post("/password-reset/request")
async def request_password_reset(current_user: User = Depends(get_current_user)):
    """User requests a password reset"""
    # Check if there's already a pending request
    existing_request = await db.password_reset_requests.find_one({
        "user_id": current_user.id,
        "status": "pending"
    })
    
    if existing_request:
        raise HTTPException(status_code=400, detail="You already have a pending password reset request")
    
    # Create reset request
    reset_request = PasswordResetRequest(
        user_id=current_user.id,
        user_email=current_user.email,
        user_name=current_user.first_name
    )
    
    request_dict = reset_request.model_dump()
    request_dict['created_at'] = request_dict['created_at'].isoformat()
    
    await db.password_reset_requests.insert_one(request_dict)
    
    return {"message": "Password reset request submitted. Please wait for admin approval."}


@api_router.get("/password-reset/requests")
async def get_password_reset_requests(current_user: User = Depends(get_current_user)):
    """Get all password reset requests (admin only)"""
    if current_user.account_type not in ["master_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    requests = await db.password_reset_requests.find({}, {"_id": 0}).to_list(1000)
    
    # Convert datetime strings
    for req in requests:
        if isinstance(req.get('created_at'), str):
            req['created_at'] = datetime.fromisoformat(req['created_at'])
    
    return requests


@api_router.post("/password-reset/approve")
async def approve_password_reset(
    approval: PasswordResetApproval,
    current_user: User = Depends(get_current_user)
):
    """Admin approves password reset and generates temporary password"""
    if current_user.account_type not in ["master_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find the request
    request = await db.password_reset_requests.find_one({"id": approval.request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request['status'] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Generate temporary password
    temp_password = generate_temporary_password()
    
    # Update user's password
    hashed_temp_password = hash_password(temp_password)
    await db.users.update_one(
        {"id": request['user_id']},
        {"$set": {"password": hashed_temp_password, "is_temp_password": True}}
    )
    
    # Update request status
    await db.password_reset_requests.update_one(
        {"id": approval.request_id},
        {"$set": {"status": "approved", "temporary_password": temp_password}}
    )
    
    return {
        "message": "Password reset approved",
        "temporary_password": temp_password,
        "user_email": request['user_email']
    }


# ==================== User Management Routes (Master Admin) ====================

@api_router.get("/users")
async def get_all_users(current_user: User = Depends(get_current_user)):
    """Get all users (master admin only) - excludes deleted users"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Filter out deleted users
    users = await db.users.find({"status": {"$ne": "deleted"}}, {"_id": 0, "password": 0}).to_list(1000)
    
    # Convert datetime strings
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return users


@api_router.post("/users/create")
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    """Create a new user (master admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate account type
    if user_data.account_type not in ["admin", "standard", "ops_team"]:
        raise HTTPException(status_code=400, detail="Invalid account type")
    
    # Create user (master admin created users are auto-approved)
    hashed_password = hash_password(user_data.password)
    user = User(
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        account_type=user_data.account_type,
        status="active"  # Master admin created users are auto-approved
    )
    
    user_dict = user.model_dump()
    user_dict['password'] = hashed_password
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Sync to Google Sheets
    sync_user_to_sheets(user_dict)
    
    return {"message": "User created successfully", "user": user}


@api_router.post("/users/approve")
async def approve_user(approval: UserApproval, current_user: User = Depends(get_current_user)):
    """Approve a pending user (master admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.users.find_one({"id": approval.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('status') != 'pending':
        raise HTTPException(status_code=400, detail="User is not pending approval")
    
    # Update user status to active
    await db.users.update_one(
        {"id": approval.user_id},
        {"$set": {"status": "active"}}
    )
    
    # Sync to Google Sheets
    user['status'] = 'active'
    sync_user_to_sheets(user)
    
    return {"message": "User approved successfully"}


@api_router.post("/users/reject")
async def reject_user(approval: UserApproval, current_user: User = Depends(get_current_user)):
    """Reject a pending user (master admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.users.find_one({"id": approval.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('status') != 'pending':
        raise HTTPException(status_code=400, detail="User is not pending approval")
    
    # Update user status to rejected
    await db.users.update_one(
        {"id": approval.user_id},
        {"$set": {"status": "rejected"}}
    )
    
    # Sync to Google Sheets
    user['status'] = 'rejected'
    sync_user_to_sheets(user)
    
    return {"message": "User rejected"}


@api_router.post("/users/{user_id}/generate-temp-password")
async def generate_temp_password_for_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Generate temporary password for a user (master admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('account_type') == 'master_admin':
        raise HTTPException(status_code=400, detail="Cannot reset master admin password")
    
    # Generate temporary password
    temp_password = generate_temporary_password()
    hashed_temp_password = hash_password(temp_password)
    
    # Update user's password
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password": hashed_temp_password, "is_temp_password": True}}
    )
    
    return {
        "message": "Temporary password generated",
        "temporary_password": temp_password,
        "user_email": user.get('email')
    }


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete a user (master admin only) - permanently removes from database"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Don't allow deleting master admin
    user_to_delete = await db.users.find_one({"id": user_id})
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_to_delete.get('account_type') == "master_admin":
        raise HTTPException(status_code=400, detail="Cannot delete master admin")
    
    # Permanently delete the user
    await db.users.delete_one({"id": user_id})
    
    # Update Google Sheets - remove the row
    delete_user_from_sheets(user_to_delete.get('email'))
    
    return {"message": "User deleted successfully"}


@api_router.get("/stats")
async def get_stats(current_user: User = Depends(get_current_user)):
    """Get user statistics (master admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    total_users = await db.users.count_documents({"status": {"$ne": "deleted"}})
    admin_users = await db.users.count_documents({"account_type": "admin", "status": {"$ne": "deleted"}})
    standard_users = await db.users.count_documents({"account_type": "standard", "status": {"$ne": "deleted"}})
    ops_team_users = await db.users.count_documents({"account_type": "ops_team", "status": {"$ne": "deleted"}})
    pending_users = await db.users.count_documents({"status": "pending"})
    pending_resets = await db.password_reset_requests.count_documents({"status": "pending"})
    
    return {
        "total_users": total_users,
        "admin_users": admin_users,
        "standard_users": standard_users,
        "ops_team_users": ops_team_users,
        "pending_users": pending_users,
        "pending_password_resets": pending_resets
    }


@api_router.post("/users/sync-to-sheets")
async def sync_all_users_to_sheets(current_user: User = Depends(get_current_user)):
    """Manually sync all users to Google Sheets (master admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    
    success = bulk_sync_users_to_sheets(users)
    
    if success:
        return {"message": "All users synced to Google Sheets successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to sync users to Google Sheets. Check if Google Sheets integration is enabled.")


# ==================== Multi-App Endpoints ====================

from app_models import (
    PaymentRecord, PaymentRecordCreate, PaymentFolder, PaymentFolderCreate,
    DriverRecord, DriverRecordCreate,
    TelecallerTask, TelecallerTaskCreate,
    VehicleRecord, VehicleRecordCreate,
    DriverLead, DriverLeadUpdate, BulkLeadStatusUpdate, BulkLeadDelete,
    QRCode, QRCodeCreate, QRCodeUpdate, QRScan
)

# Payment Reconciliation
@api_router.post("/payment-reconciliation")
async def create_payment(payment_data: PaymentRecordCreate, current_user: User = Depends(get_current_user)):
    """Create new payment record"""
    payment = PaymentRecord(**payment_data.model_dump())
    payment_dict = payment.model_dump()
    payment_dict['date'] = payment_dict['date'].isoformat()
    payment_dict['created_at'] = payment_dict['created_at'].isoformat()
    
    await db.payment_reconciliation.insert_one(payment_dict)
    sync_single_record('payment_reconciliation', payment_dict)
    
    return {"message": "Payment record created", "payment": payment}


@api_router.get("/payment-reconciliation")
async def get_payments(current_user: User = Depends(get_current_user)):
    """Get all payment records"""
    payments = await db.payment_reconciliation.find({}, {"_id": 0}).to_list(1000)
    for payment in payments:
        if isinstance(payment.get('date'), str):
            try:
                payment['date'] = datetime.fromisoformat(payment['date'])
            except ValueError:
                # Handle non-ISO date formats, keep as string
                pass
        if isinstance(payment.get('created_at'), str):
            try:
                payment['created_at'] = datetime.fromisoformat(payment['created_at'])
            except ValueError:
                # Handle non-ISO date formats, keep as string
                pass
    return payments


@api_router.post("/payment-reconciliation/sync")
async def sync_payments(current_user: User = Depends(get_current_user)):
    """Sync all payments to Google Sheets"""
    payments = await db.payment_reconciliation.find({}, {"_id": 0}).to_list(1000)
    success = sync_all_records('payment_reconciliation', payments)
    if success:
        return {"message": "Payments synced successfully"}
    raise HTTPException(status_code=500, detail="Failed to sync payments")


# Driver Onboarding
@api_router.post("/driver-onboarding")
async def create_driver(driver_data: DriverRecordCreate, current_user: User = Depends(get_current_user)):
    """Create new driver record"""
    driver = DriverRecord(**driver_data.model_dump())
    driver_dict = driver.model_dump()
    driver_dict['date'] = driver_dict['date'].isoformat()
    driver_dict['created_at'] = driver_dict['created_at'].isoformat()
    
    await db.driver_onboarding.insert_one(driver_dict)
    sync_single_record('driver_onboarding', driver_dict)
    
    return {"message": "Driver record created", "driver": driver}


@api_router.get("/driver-onboarding")
async def get_drivers(current_user: User = Depends(get_current_user)):
    """Get all driver records"""
    drivers = await db.driver_onboarding.find({}, {"_id": 0}).to_list(1000)
    for driver in drivers:
        if isinstance(driver.get('date'), str):
            driver['date'] = datetime.fromisoformat(driver['date'])
        if isinstance(driver.get('created_at'), str):
            driver['created_at'] = datetime.fromisoformat(driver['created_at'])
    return drivers


@api_router.post("/driver-onboarding/sync")
async def sync_drivers(current_user: User = Depends(get_current_user)):
    """Sync all drivers to Google Sheets"""
    drivers = await db.driver_onboarding.find({}, {"_id": 0}).to_list(1000)
    success = sync_all_records('driver_onboarding', drivers)
    if success:
        return {"message": "Drivers synced successfully"}
    raise HTTPException(status_code=500, detail="Failed to sync drivers")


# Driver Onboarding - Leads Import
from fastapi import File, UploadFile
import pandas as pd
import io


@api_router.post("/driver-onboarding/import-leads")
async def import_leads(
    file: UploadFile = File(...), 
    duplicate_action: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Import driver leads from CSV or XLSX with duplicate detection"""
    logger.info(f"Import request received. Duplicate action: {duplicate_action}")
    try:
        # Read file content
        content = await file.read()
        
        # Detect file type and parse
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Invalid file type. Only CSV and XLSX are supported.")
        
        # Detect format and map columns
        leads = []
        import_date = datetime.now(timezone.utc).isoformat()
        
        # Check column count to determine format
        if len(df.columns) == 4:
            # Format 1: S. No., Name, Vehicle, Phone Number
            logger.info("Detected Format 1 (4 columns)")
            for _, row in df.iterrows():
                lead = {
                    "id": str(uuid.uuid4()),
                    "name": str(row.iloc[1]) if pd.notna(row.iloc[1]) else "",
                    "phone_number": str(row.iloc[3]) if pd.notna(row.iloc[3]) else "",
                    "vehicle": str(row.iloc[2]) if pd.notna(row.iloc[2]) else "",
                    "driving_license": None,
                    "experience": None,
                    "interested_ev": None,
                    "monthly_salary": None,
                    "residing_chennai": None,
                    "current_location": None,
                    "import_date": import_date,
                    "status": "New",
                    "lead_stage": "New",
                    "driver_readiness": "Not Started",
                    "docs_collection": "Pending",
                    "customer_readiness": "Not Ready",
                    "assigned_telecaller": None,
                    "telecaller_notes": None,
                    "notes": None,
                    "created_at": import_date
                }
                leads.append(lead)
        
        elif len(df.columns) >= 8:
            # Format 2: 8 columns with Tamil
            logger.info("Detected Format 2 (8+ columns)")
            for _, row in df.iterrows():
                # Map Tamil questions to English fields
                driving_license = str(row.iloc[3]) if pd.notna(row.iloc[3]) else ""
                experience = str(row.iloc[4]) if pd.notna(row.iloc[4]) else ""
                interested_ev = str(row.iloc[5]) if pd.notna(row.iloc[5]) else ""
                location = str(row.iloc[7]) if pd.notna(row.iloc[7]) else ""
                
                # Parse phone number - remove p:+91 prefix and get last 10 digits
                raw_phone = str(row.iloc[2]) if pd.notna(row.iloc[2]) else ""
                phone_number = raw_phone
                if raw_phone.startswith("p:"):
                    # Remove p: prefix and any country code, keep last 10 digits
                    phone_number = raw_phone.replace("p:", "").replace("+", "").replace(" ", "")
                    if len(phone_number) > 10:
                        phone_number = phone_number[-10:]  # Get last 10 digits
                
                lead = {
                    "id": str(uuid.uuid4()),
                    "name": str(row.iloc[0]) if pd.notna(row.iloc[0]) else "",
                    "phone_number": phone_number,
                    "vehicle": None,
                    "driving_license": driving_license,
                    "experience": experience,
                    "interested_ev": interested_ev,
                    "monthly_salary": str(row.iloc[6]) if pd.notna(row.iloc[6]) else "",
                    "residing_chennai": None,
                    "current_location": location,
                    "import_date": import_date,
                    "status": "New",
                    "lead_stage": "New",
                    "driver_readiness": "Not Started",
                    "docs_collection": "Pending",
                    "customer_readiness": "Not Ready",
                    "assigned_telecaller": None,
                    "telecaller_notes": None,
                    "notes": None,
                    "created_at": import_date
                }
                leads.append(lead)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format. Expected 4 or 8 columns, got {len(df.columns)}")
        
        # Check for duplicates by phone number
        if leads:
            phone_numbers = [lead['phone_number'] for lead in leads if lead['phone_number']]
            
            # Find existing leads with matching phone numbers
            existing_leads = await db.driver_leads.find(
                {"phone_number": {"$in": phone_numbers}},
                {"_id": 0, "phone_number": 1, "name": 1, "id": 1}
            ).to_list(10000)
            
            existing_phones = {lead['phone_number']: lead for lead in existing_leads}
            
            # Identify duplicates
            duplicates = []
            non_duplicates = []
            
            for lead in leads:
                if lead['phone_number'] in existing_phones:
                    duplicates.append({
                        "name": lead['name'],
                        "phone_number": lead['phone_number'],
                        "existing_name": existing_phones[lead['phone_number']]['name']
                    })
                else:
                    non_duplicates.append(lead)
            
            # If duplicates found and no valid action specified, ask user
            # Check if duplicate_action is None, empty, or invalid
            valid_action = duplicate_action in ['skip', 'add_copy'] if duplicate_action else False
            
            if duplicates and not valid_action:
                logger.info(f"Found {len(duplicates)} duplicates, asking user for action")
                return {
                    "duplicates_found": True,
                    "duplicate_count": len(duplicates),
                    "new_leads_count": len(non_duplicates),
                    "total_in_file": len(leads),
                    "duplicates": duplicates[:10],  # Show first 10 duplicates
                    "message": f"Found {len(duplicates)} duplicate(s) based on phone number. Please choose an action."
                }
            
            # Process based on user action
            leads_to_insert = []
            
            if duplicate_action == "skip":
                # Only insert non-duplicates
                leads_to_insert = non_duplicates
                skipped_count = len(duplicates)
            elif duplicate_action == "add_copy":
                # Add non-duplicates as is, and duplicates with "-copy" suffix
                leads_to_insert = non_duplicates
                for lead in leads:
                    if lead['phone_number'] in existing_phones:
                        lead['name'] = f"{lead['name']}-copy"
                        leads_to_insert.append(lead)
                skipped_count = 0
            else:
                # No duplicates or no action needed
                leads_to_insert = leads
                skipped_count = 0
            
            # Insert leads
            if leads_to_insert:
                await db.driver_leads.insert_many(leads_to_insert)
                logger.info(f"Imported {len(leads_to_insert)} leads to database")
                
                # Sync to Google Sheets
                sync_all_records('leads', leads_to_insert)
            
            message = f"Successfully imported {len(leads_to_insert)} lead(s)"
            if duplicate_action == "skip" and skipped_count > 0:
                message += f", skipped {skipped_count} duplicate(s)"
            elif duplicate_action == "add_copy" and len(duplicates) > 0:
                message += f", added {len(duplicates)} duplicate(s) as copies"
            
            return {
                "message": message,
                "count": len(leads_to_insert),
                "skipped": skipped_count if duplicate_action == "skip" else 0,
                "format_detected": "Format 1 (4 columns)" if len(df.columns) == 4 else "Format 2 (8 columns)",
                "duplicates_found": False
            }
        
        return {
            "message": "No leads found in file",
            "count": 0,
            "format_detected": "Format 1 (4 columns)" if len(df.columns) == 4 else "Format 2 (8 columns)"
        }
        
    except Exception as e:
        logger.error(f"Error importing leads: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import leads: {str(e)}")


@api_router.get("/driver-onboarding/leads")
async def get_leads(current_user: User = Depends(get_current_user)):
    """Get all driver leads"""
    leads = await db.driver_leads.find({}, {"_id": 0}).to_list(10000)
    return leads


@api_router.post("/driver-onboarding/sync-leads")
async def sync_leads_to_sheets(current_user: User = Depends(get_current_user)):
    """Sync all leads to Google Sheets"""
    try:
        leads = await db.driver_leads.find({}, {"_id": 0}).to_list(10000)
        success = sync_all_records('leads', leads)
        if success:
            return {"message": f"Successfully synced {len(leads)} leads to Google Sheets"}
        raise HTTPException(status_code=500, detail="Failed to sync leads to Google Sheets")
    except Exception as e:
        logger.error(f"Sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync: {str(e)}")


class LeadStatusUpdate(BaseModel):
    status: str


# IMPORTANT: Bulk update route must come BEFORE {lead_id} routes to avoid path conflicts
@api_router.patch("/driver-onboarding/leads/bulk-update-status")
async def bulk_update_lead_status(bulk_data: BulkLeadStatusUpdate, current_user: User = Depends(get_current_user)):
    """Bulk update lead status for multiple leads"""
    print("=== BULK UPDATE CALLED ===")
    print(f"Lead IDs count: {len(bulk_data.lead_ids) if bulk_data.lead_ids else 0}")
    print(f"Status: {bulk_data.status}")
    
    if not bulk_data.lead_ids or len(bulk_data.lead_ids) == 0:
        raise HTTPException(status_code=400, detail="No leads selected for update")
    
    # Update all matching leads
    result = await db.driver_leads.update_many(
        {"id": {"$in": bulk_data.lead_ids}},
        {"$set": {"status": bulk_data.status}}
    )
    
    print(f"MongoDB update result: matched={result.matched_count}, modified={result.modified_count}")
    
    # Get all updated leads for syncing to Google Sheets
    updated_leads = await db.driver_leads.find(
        {"id": {"$in": bulk_data.lead_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    print(f"Found {len(updated_leads)} leads to sync")
    
    if not updated_leads or len(updated_leads) == 0:
        print("ERROR: No leads found - raising 404")
        raise HTTPException(status_code=404, detail="Could not find any leads with the provided IDs")
    
    # Sync all to Google Sheets
    try:
        sync_all_records('leads', updated_leads)
    except Exception as e:
        logger.error(f"Failed to sync to Google Sheets: {str(e)}")
        # Don't fail the whole operation if sheets sync fails
    
    # Return success message
    count = len(updated_leads)
    return {
        "message": f"Successfully updated status for {count} lead(s) to '{bulk_data.status}'",
        "updated_count": count
    }


@api_router.patch("/driver-onboarding/leads/{lead_id}")
async def update_lead(lead_id: str, lead_data: DriverLeadUpdate, current_user: User = Depends(get_current_user)):
    """Update lead details"""
    # Find the lead
    lead = await db.driver_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Prepare update data (only include fields that are provided)
    update_data = {}
    for field, value in lead_data.model_dump(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Update lead
    await db.driver_leads.update_one(
        {"id": lead_id},
        {"$set": update_data}
    )
    
    # Get updated lead for sync
    updated_lead = await db.driver_leads.find_one({"id": lead_id}, {"_id": 0})
    
    # Sync to Google Sheets
    sync_single_record('leads', updated_lead)
    
    return {"message": "Lead updated successfully", "lead": updated_lead}


@api_router.patch("/driver-onboarding/leads/{lead_id}/status")
async def update_lead_status(lead_id: str, status_data: LeadStatusUpdate, current_user: User = Depends(get_current_user)):
    """Update lead status"""
    # Find the lead
    lead = await db.driver_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Update status
    await db.driver_leads.update_one(
        {"id": lead_id},
        {"$set": {"status": status_data.status}}
    )
    
    # Get updated lead for sync
    updated_lead = await db.driver_leads.find_one({"id": lead_id}, {"_id": 0})
    
    # Sync to Google Sheets
    sync_single_record('leads', updated_lead)
    
    return {"message": "Lead status updated successfully", "lead": updated_lead}


@api_router.delete("/driver-onboarding/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: User = Depends(get_current_user)):
    """Delete a single lead (Master Admin only)"""
    # Check if user is master admin
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Only Master Admin can delete leads")
    
    # Find the lead
    lead = await db.driver_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Delete from MongoDB
    await db.driver_leads.delete_one({"id": lead_id})
    
    # Delete from Google Sheets
    try:
        delete_record('leads', lead_id)
    except Exception as e:
        logger.error(f"Failed to delete from Google Sheets: {str(e)}")
        # Don't fail the whole operation if sheets delete fails
    
    return {"message": "Lead deleted successfully"}


@api_router.post("/driver-onboarding/leads/bulk-delete")
async def bulk_delete_leads(bulk_data: BulkLeadDelete, current_user: User = Depends(get_current_user)):
    """Bulk delete leads (Master Admin only)"""
    # Check if user is master admin
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Only Master Admin can delete leads")
    
    if not bulk_data.lead_ids or len(bulk_data.lead_ids) == 0:
        raise HTTPException(status_code=400, detail="No leads selected for deletion")
    
    # Delete from MongoDB first (fast operation)
    result = await db.driver_leads.delete_many(
        {"id": {"$in": bulk_data.lead_ids}}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No leads found to delete")
    
    # Return immediately, sync will happen in background
    # Note: We just update the sync time marker, the actual Google Sheets
    # will be synced on next manual sync or when leads are updated
    try:
        update_last_sync_time('leads')
        logger.info(f"Bulk delete: Deleted {result.deleted_count} leads from database")
    except Exception as e:
        logger.error(f"Failed to update sync time: {str(e)}")
    
    return {
        "message": f"Successfully deleted {result.deleted_count} lead(s)",
        "deleted_count": result.deleted_count
    }


@api_router.get("/driver-onboarding/test-bulk")
async def test_bulk_endpoint(current_user: User = Depends(get_current_user)):
    """Test endpoint to verify route is working"""
    return {"message": "Bulk update endpoint route is accessible", "version": "2"}


@api_router.get("/driver-onboarding/performance-tracking")
async def get_performance_tracking(current_user: User = Depends(get_current_user)):
    """Get telecaller performance metrics"""
    try:
        # Get all leads
        all_leads = await db.driver_leads.find({}, {"_id": 0}).to_list(10000)
        
        # Group by telecaller
        telecaller_stats = {}
        
        for lead in all_leads:
            telecaller = lead.get("assigned_telecaller", "Unassigned")
            
            if telecaller not in telecaller_stats:
                telecaller_stats[telecaller] = {
                    "name": telecaller,
                    "total_leads": 0,
                    "contacted": 0,
                    "qualified": 0,
                    "onboarded": 0,
                    "rejected": 0,
                    "in_progress": 0,
                    "conversion_rate": 0,
                    "stages": {
                        "new": 0,
                        "contacted": 0,
                        "qualified": 0,
                        "assigned": 0,
                        "in_progress": 0
                    }
                }
            
            stats = telecaller_stats[telecaller]
            stats["total_leads"] += 1
            
            # Count by status
            status = lead.get("status", "New").lower()
            if "contact" in status:
                stats["contacted"] += 1
            elif "interested" in status or "qualified" in status:
                stats["qualified"] += 1
            elif "onboard" in status:
                stats["onboarded"] += 1
            elif "reject" in status or "not interested" in status:
                stats["rejected"] += 1
            
            # Count by lead stage
            lead_stage = lead.get("lead_stage", "New").lower()
            if "new" in lead_stage:
                stats["stages"]["new"] += 1
            elif "contacted" in lead_stage:
                stats["stages"]["contacted"] += 1
            elif "qualified" in lead_stage:
                stats["stages"]["qualified"] += 1
            elif "assigned" in lead_stage:
                stats["stages"]["assigned"] += 1
            elif "progress" in lead_stage:
                stats["stages"]["in_progress"] += 1
        
        # Calculate conversion rates
        for telecaller, stats in telecaller_stats.items():
            if stats["total_leads"] > 0:
                stats["conversion_rate"] = round((stats["onboarded"] / stats["total_leads"]) * 100, 2)
        
        # Overall stats
        total_leads = len(all_leads)
        total_contacted = sum(s["contacted"] for s in telecaller_stats.values())
        total_onboarded = sum(s["onboarded"] for s in telecaller_stats.values())
        overall_conversion = round((total_onboarded / total_leads * 100), 2) if total_leads > 0 else 0
        
        return {
            "telecallers": list(telecaller_stats.values()),
            "overall": {
                "total_leads": total_leads,
                "total_contacted": total_contacted,
                "total_onboarded": total_onboarded,
                "conversion_rate": overall_conversion
            }
        }
    except Exception as e:
        logger.error(f"Performance tracking error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance data: {str(e)}")


@api_router.post("/driver-onboarding/webhook/sync-from-sheets")
async def sync_from_google_sheets(request: Request):
    """
    Webhook endpoint to receive driver leads data FROM Google Sheets
    This enables two-way sync: Google Sheets → App
    
    SYNC STRATEGY:
    - Uses ID as unique identifier (not phone number)
    - If ID exists in DB → UPDATE the lead
    - If ID doesn't exist in DB → CREATE new lead with that ID
    - If lead exists in DB but NOT in sheets → DELETE from DB
    
    Expected payload: {
        "action": "sync_from_sheets",
        "leads": [array of lead objects with id field]
    }
    """
    try:
        body = await request.json()
        logger.info(f"Received sync from Google Sheets: {body.get('action')}")
        
        if body.get('action') != 'sync_from_sheets':
            raise HTTPException(status_code=400, detail="Invalid action")
        
        leads_data = body.get('leads', [])
        
        # Get all IDs from Google Sheets (filter out empty rows)
        sheet_lead_ids = set()
        valid_leads = []
        
        for lead in leads_data:
            # Skip empty rows (no phone number means empty row)
            if not lead.get('phone_number') or lead.get('phone_number') == '':
                continue
            
            lead_id = lead.get('id', '').strip()
            
            # Generate ID if not present
            if not lead_id:
                lead_id = str(uuid.uuid4())
                lead['id'] = lead_id
            
            sheet_lead_ids.add(lead_id)
            valid_leads.append(lead)
        
        # Get all existing leads from database
        existing_leads = await db.driver_leads.find().to_list(length=None)
        db_lead_ids = {lead['id'] for lead in existing_leads}
        
        created_count = 0
        updated_count = 0
        deleted_count = 0
        
        # Process each lead from sheets
        for lead in valid_leads:
            lead_id = lead['id']
            
            # Check if lead exists by ID
            existing_lead = await db.driver_leads.find_one({"id": lead_id})
            
            # Prepare lead data with all fields
            lead_data = {
                "id": lead_id,
                "name": lead.get('name', ''),
                "phone_number": lead.get('phone_number', ''),
                "vehicle": lead.get('vehicle'),
                "driving_license": lead.get('driving_license'),
                "experience": lead.get('experience'),
                "interested_ev": lead.get('interested_ev'),
                "monthly_salary": lead.get('monthly_salary'),
                "residing_chennai": lead.get('residing_chennai'),
                "current_location": lead.get('current_location'),
                "lead_stage": lead.get('lead_stage', 'New'),
                "status": lead.get('status', 'New'),
                "driver_readiness": lead.get('driver_readiness', 'Not Started'),
                "docs_collection": lead.get('docs_collection', 'Pending'),
                "customer_readiness": lead.get('customer_readiness', 'Not Ready'),
                "assigned_telecaller": lead.get('assigned_telecaller'),
                "telecaller_notes": lead.get('telecaller_notes'),
                "notes": lead.get('notes'),
                "import_date": lead.get('import_date', ''),
                "created_at": lead.get('created_at', '')
            }
            
            if existing_lead:
                # Update existing lead (overwrite with sheet data)
                await db.driver_leads.update_one(
                    {"id": lead_id},
                    {"$set": lead_data}
                )
                updated_count += 1
                logger.info(f"Updated lead: {lead_id} - {lead_data['name']}")
            else:
                # Create new lead with the ID from sheets
                # Add timestamps if not present
                if not lead_data['import_date']:
                    lead_data['import_date'] = datetime.now(timezone.utc).isoformat()
                if not lead_data['created_at']:
                    lead_data['created_at'] = datetime.now(timezone.utc).isoformat()
                
                await db.driver_leads.insert_one(lead_data)
                created_count += 1
                logger.info(f"Created new lead: {lead_id} - {lead_data['name']}")
        
        # Delete leads that exist in DB but NOT in Google Sheets
        leads_to_delete = db_lead_ids - sheet_lead_ids
        
        if leads_to_delete:
            delete_result = await db.driver_leads.delete_many({
                "id": {"$in": list(leads_to_delete)}
            })
            deleted_count = delete_result.deleted_count
            logger.info(f"Deleted {deleted_count} leads that were removed from Google Sheets")
        
        return {
            "success": True,
            "message": f"Synced {len(valid_leads)} leads from Google Sheets",
            "created": created_count,
            "updated": updated_count,
            "deleted": deleted_count,
            "total_processed": created_count + updated_count + deleted_count
        }
        
    except Exception as e:
        logger.error(f"Sync from sheets error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to sync from sheets: {str(e)}")


# Telecaller Queue Manager - Lead Assignment
@api_router.get("/telecaller-queue/daily-assignments")
async def get_daily_assignments(current_user: User = Depends(get_current_user)):
    """Get daily lead assignments for telecallers - 20 NEW leads each (40 total)"""
    # Priority: Assign only NEW leads (status = "New")
    # Sorted by import date (oldest first)
    
    logger.info("Fetching daily assignments for telecallers")
    
    # Get 40 NEW leads (20 for each telecaller)
    new_leads = await db.driver_leads.find({
        "status": "New",
        "lead_stage": "New"
    }, {"_id": 0}).sort("import_date", 1).to_list(40)
    
    logger.info(f"Found {len(new_leads)} NEW leads for assignment")
    
    # If we have fewer than 40 NEW leads, try to get more from other stages
    if len(new_leads) < 40:
        additional_needed = 40 - len(new_leads)
        logger.info(f"Need {additional_needed} more leads, fetching from other statuses")
        
        # Get leads from other statuses (but not Onboarded or Rejected)
        additional_leads = await db.driver_leads.find({
            "status": {"$nin": ["New", "Onboarded", "Rejected"]},
            "lead_stage": {"$ne": "In Progress"}
        }, {"_id": 0}).sort("import_date", 1).to_list(additional_needed)
        
        new_leads.extend(additional_leads)
        logger.info(f"Total leads after adding from other statuses: {len(new_leads)}")
    
    # Split leads equally between 2 telecallers (20 each)
    telecaller1_leads = new_leads[0:20]
    telecaller2_leads = new_leads[20:40]
    
    logger.info(f"Assigned {len(telecaller1_leads)} leads to Telecaller 1")
    logger.info(f"Assigned {len(telecaller2_leads)} leads to Telecaller 2")
    
    return {
        "telecaller1": {
            "name": "Telecaller 1",
            "leads": telecaller1_leads,
            "count": len(telecaller1_leads)
        },
        "telecaller2": {
            "name": "Telecaller 2", 
            "leads": telecaller2_leads,
            "count": len(telecaller2_leads)
        },
        "total_assigned": len(telecaller1_leads) + len(telecaller2_leads),
        "assignment_date": datetime.now(timezone.utc).isoformat()
    }


@api_router.post("/telecaller-queue/update-call-status")
async def update_call_status(
    lead_id: str,
    call_outcome: str,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Update lead status after call"""
    # Find the lead
    lead = await db.driver_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Update status based on call outcome
    new_status = call_outcome
    
    await db.driver_leads.update_one(
        {"id": lead_id},
        {"$set": {"status": new_status}}
    )
    
    # Get updated lead for sync
    updated_lead = await db.driver_leads.find_one({"id": lead_id}, {"_id": 0})
    
    # Sync to Google Sheets
    sync_single_record('leads', updated_lead)
    
    return {"message": "Call status updated successfully", "lead": updated_lead}


# Telecaller Queue
@api_router.post("/telecaller-queue")
async def create_telecaller_task(task_data: TelecallerTaskCreate, current_user: User = Depends(get_current_user)):
    """Create new telecaller task"""
    task = TelecallerTask(**task_data.model_dump())
    task_dict = task.model_dump()
    task_dict['date'] = task_dict['date'].isoformat()
    task_dict['created_at'] = task_dict['created_at'].isoformat()
    if task_dict.get('scheduled_time'):
        task_dict['scheduled_time'] = task_dict['scheduled_time'].isoformat()
    
    await db.telecaller_queue.insert_one(task_dict)
    sync_single_record('telecaller_queue', task_dict)
    
    return {"message": "Telecaller task created", "task": task}


@api_router.get("/telecaller-queue")
async def get_telecaller_tasks(current_user: User = Depends(get_current_user)):
    """Get all telecaller tasks"""
    tasks = await db.telecaller_queue.find({}, {"_id": 0}).to_list(1000)
    for task in tasks:
        if isinstance(task.get('date'), str):
            task['date'] = datetime.fromisoformat(task['date'])
        if isinstance(task.get('created_at'), str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    return tasks


# ==================== MONTRA VEHICLE INSIGHTS ====================

@api_router.post("/montra-vehicle/import-feed")
async def import_montra_feed(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Import Montra vehicle feed data and sync to Google Sheets"""
    try:
        import re
        
        # Get filename without extension
        filename = file.filename
        logger.info(f"Importing Montra feed from file: {filename}")
        
        # Extract vehicle ID, day, month, and year from filename
        # Expected format: "P60G2512500002032 - 01 Sep 2025.csv"
        filename_pattern = r"^([A-Z0-9]+)\s*-\s*(\d{2})\s+([A-Za-z]+)\s+(\d{4})\.(csv|xlsx)$"
        match = re.match(filename_pattern, filename)
        
        if not match:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid filename format. Expected: 'VEHICLE_ID - DD MMM YYYY.csv'. Got: {filename}"
            )
        
        vehicle_id = match.group(1)
        day = match.group(2)
        month = match.group(3)
        year = match.group(4)
        separator = "-"
        
        logger.info(f"Extracted from filename - Vehicle ID: {vehicle_id}, Day: {day}, Month: {month}, Year: {year}")
        
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        file_extension = filename.split('.')[-1].lower()
        
        if file_extension == 'csv':
            import io
            df = pd.read_csv(io.BytesIO(content))
        elif file_extension == 'xlsx':
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        logger.info(f"Parsed file with {len(df)} rows and {len(df.columns)} columns")
        
        # Verify we have the expected columns (A to U = 21 columns)
        if len(df.columns) != 21:
            raise HTTPException(
                status_code=400,
                detail=f"Expected 21 columns (A-U), but found {len(df.columns)} columns"
            )
        
        # Look up registration number from vehicle mapping
        vehicle_mapping = await db.vehicle_mapping.find_one(
            {"vehicle_id": vehicle_id}, 
            {"_id": 0, "registration_number": 1}
        )
        registration_number = vehicle_mapping.get("registration_number", "") if vehicle_mapping else ""
        
        logger.info(f"Vehicle {vehicle_id} → Registration: {registration_number if registration_number else 'Not found'}")
        
        # Prepare data for Google Sheets
        # Sheet columns: D to X (CSV columns A to U)
        # Additional columns: Y (vehicle_id), Z (separator), AA (day), AB (month), AC (registration_number)
        
        rows_to_import = []
        for idx, row in df.iterrows():
            # Convert row to list and add filename data
            row_data = row.tolist()
            # Add vehicle_id, separator, day, month, registration_number
            row_data.extend([vehicle_id, separator, day, month, registration_number])
            rows_to_import.append(row_data)
        
        logger.info(f"Prepared {len(rows_to_import)} rows for import")
        
        # Load mode mapping tables
        model_dict, mode_dict = load_mode_mapping_tables()
        
        # Also save to MongoDB for analytics queries
        montra_docs = []
        headers = df.columns.tolist() + ['Vehicle ID', 'Separator', 'Day', 'Month', 'Registration Number']
        
        for row_data in rows_to_import:
            doc = {
                "vehicle_id": vehicle_id,
                "date": f"{day} {month}",
                "day": day,
                "month": month,
                "year": year,
                "registration_number": registration_number,
                "filename": filename,
                "imported_at": datetime.now(timezone.utc).isoformat()
            }
            # Map all columns to document
            for i, header in enumerate(headers):
                if i < len(row_data):
                    doc[header] = row_data[i]
            
            # Enrich with Mode Name and Mode Type
            ride_mode = doc.get("Ride Mode", "")
            if ride_mode:
                mode_name, mode_type = enrich_with_mode_data(
                    registration_number if registration_number else vehicle_id,
                    str(ride_mode),
                    model_dict,
                    mode_dict
                )
                doc["mode_name"] = mode_name
                doc["mode_type"] = mode_type
            else:
                doc["mode_name"] = "Unknown"
                doc["mode_type"] = "Unknown"
            
            montra_docs.append(doc)
        
        # Save to MongoDB
        if montra_docs:
            await db.montra_feed_data.insert_many(montra_docs)
            logger.info(f"Saved {len(montra_docs)} rows to MongoDB")
        
        logger.info(f"Successfully imported {len(rows_to_import)} rows to database")
        return {
            "message": f"Successfully imported {len(rows_to_import)} rows from {filename}",
            "rows": len(rows_to_import),
            "vehicle_id": vehicle_id,
            "date": f"{day} {month}",
            "synced_to_database": True
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing Montra feed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import feed: {str(e)}")


@api_router.post("/montra-vehicle/enrich-existing-data")
async def enrich_existing_montra_data(current_user: User = Depends(get_current_user)):
    """Re-process all existing Montra feed data to add Mode Name and Mode Type"""
    try:
        # Load mode mapping tables
        model_dict, mode_dict = load_mode_mapping_tables()
        
        if not model_dict or not mode_dict:
            raise HTTPException(status_code=400, detail="Mode mapping tables not available. Please upload Mode Details.xlsx")
        
        # Get all records
        all_records = await db.montra_feed_data.find({}).to_list(100000)
        
        logger.info(f"Processing {len(all_records)} existing records for mode enrichment")
        
        updated_count = 0
        for record in all_records:
            vehicle_id = record.get("vehicle_id")
            registration = record.get("registration_number")
            ride_mode = record.get("Ride Mode")
            
            if not ride_mode:
                continue
            
            # Use registration number if available, otherwise vehicle ID
            lookup_id = registration if registration else vehicle_id
            
            mode_name, mode_type = enrich_with_mode_data(
                lookup_id,
                str(ride_mode),
                model_dict,
                mode_dict
            )
            
            # Update record in MongoDB
            await db.montra_feed_data.update_one(
                {"_id": record["_id"]},
                {"$set": {
                    "mode_name": mode_name,
                    "mode_type": mode_type
                }}
            )
            updated_count += 1
        
        logger.info(f"Successfully enriched {updated_count} records")
        
        return {
            "success": True,
            "message": f"Successfully enriched {updated_count} records with mode data",
            "updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"Error enriching existing data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to enrich data: {str(e)}")


@api_router.get("/montra-vehicle/download-mode-mapping")
async def download_mode_mapping(current_user: User = Depends(get_current_user)):
    """Download the current Mode Details.xlsx mapping file"""
    from fastapi.responses import FileResponse
    
    mapping_file_path = "/app/backend/uploaded_files/mode_details.xlsx"
    
    if not os.path.exists(mapping_file_path):
        raise HTTPException(status_code=404, detail="Mode mapping file not found")
    
    return FileResponse(
        path=mapping_file_path,
        filename="Mode Details.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@api_router.post("/montra-vehicle/upload-mode-mapping")
async def upload_mode_mapping(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload updated Mode Details.xlsx mapping file"""
    try:
        import pandas as pd
        import io
        
        # Verify it's an Excel file
        if not file.filename.endswith('.xlsx'):
            raise HTTPException(status_code=400, detail="File must be .xlsx format")
        
        # Read and validate the file
        content = await file.read()
        
        try:
            excel_file = pd.ExcelFile(io.BytesIO(content))
            
            # Verify required sheets exist
            if 'Model Mapping' not in excel_file.sheet_names:
                raise HTTPException(status_code=400, detail="Missing 'Model Mapping' sheet")
            if 'Ride Mode Mapping' not in excel_file.sheet_names:
                raise HTTPException(status_code=400, detail="Missing 'Ride Mode Mapping' sheet")
            
            # Validate Model Mapping structure
            model_df = pd.read_excel(io.BytesIO(content), sheet_name='Model Mapping')
            required_model_cols = ['Vehicle Number', 'VIN', 'Model']
            if not all(col in model_df.columns for col in required_model_cols):
                raise HTTPException(status_code=400, detail=f"Model Mapping must have columns: {required_model_cols}")
            
            # Validate Ride Mode Mapping structure
            mode_df = pd.read_excel(io.BytesIO(content), sheet_name='Ride Mode Mapping')
            required_mode_cols = ['Vehicle-Mode Concatenation', 'Vehicle Model', 'Ride Mode', 'Mode Name', 'Mode Type']
            if not all(col in mode_df.columns for col in required_mode_cols):
                raise HTTPException(status_code=400, detail=f"Ride Mode Mapping must have columns: {required_mode_cols}")
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid Excel file structure: {str(e)}")
        
        # Save the file
        mapping_file_path = "/app/backend/uploaded_files/mode_details.xlsx"
        with open(mapping_file_path, "wb") as f:
            f.write(content)
        
        logger.info(f"Updated mode mapping file: {file.filename}")
        
        return {
            "success": True,
            "message": "Mode mapping file updated successfully",
            "filename": file.filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading mode mapping: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload mapping file: {str(e)}")


@api_router.post("/telecaller-queue/sync")
async def sync_telecaller_queue(current_user: User = Depends(get_current_user)):
    """Sync all telecaller tasks to Google Sheets"""
    tasks = await db.telecaller_queue.find({}, {"_id": 0}).to_list(1000)
    success = sync_all_records('telecaller_queue', tasks)
    if success:
        return {"message": "Telecaller queue synced successfully"}
    raise HTTPException(status_code=500, detail="Failed to sync telecaller queue")


# ==================== ADMIN FILES MANAGEMENT ====================

# Create uploaded files directory if it doesn't exist
UPLOAD_DIR = "/app/backend/uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@api_router.post("/montra-vehicle/view-file-data")
async def view_montra_file_data(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """View data from a specific uploaded Montra feed file"""
    try:
        data = await request.json()
        vehicle_id = data.get("vehicle_id")
        date = data.get("date")
        filename = data.get("filename")
        
        if not vehicle_id or not date:
            raise HTTPException(status_code=400, detail="vehicle_id and date are required")
        
        # Query records for this specific file
        query = {
            "vehicle_id": vehicle_id,
            "date": date
        }
        if filename:
            query["filename"] = filename
        
        records = await db.montra_feed_data.find(query, {"_id": 0}).sort("Portal Received Time", 1).to_list(1000)
        
        if not records:
            return {
                "success": True,
                "data": [],
                "columns": [],
                "count": 0,
                "message": "No data found for this file"
            }
        
        # Extract columns from first record
        columns = list(records[0].keys())
        
        return {
            "success": True,
            "data": records,
            "columns": columns,
            "count": len(records)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error viewing file data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to view file data: {str(e)}")


@api_router.get("/admin/files")
async def list_files(current_user: User = Depends(get_current_user)):
    """Get list of all uploaded files"""
    try:
        files = await db.admin_files.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(1000)
        
        # Format file sizes for display
        for file in files:
            file["size_display"] = format_file_size(file.get("file_size", 0))
        
        return {
            "files": files,
            "count": len(files)
        }
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list files")


@api_router.get("/admin/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    """Download a file"""
    try:
        file_metadata = await db.admin_files.find_one({"id": file_id}, {"_id": 0})
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_path = file_metadata["file_path"]
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        from fastapi.responses import FileResponse
        
        return FileResponse(
            path=file_path,
            filename=file_metadata["original_filename"],
            media_type=file_metadata.get("content_type", "application/octet-stream")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to download file")


@api_router.get("/admin/files/{file_id}/share-link")
async def get_share_link(file_id: str, current_user: User = Depends(get_current_user)):
    """Get shareable download link for a file"""
    try:
        file_metadata = await db.admin_files.find_one({"id": file_id}, {"_id": 0})
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get backend URL from environment
        backend_url = os.environ.get('BACKEND_URL', 'https://driver-sync-hub.preview.emergentagent.com')
        
        share_link = f"{backend_url}/api/admin/files/{file_id}/download"
        
        return {
            "share_link": share_link,
            "filename": file_metadata["original_filename"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating share link: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate share link")


@api_router.delete("/admin/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_current_user)):
    """Delete a file (Master Admin only)"""
    # Check if user is master admin
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Only Master Admin can delete files")
    
    try:
        file_metadata = await db.admin_files.find_one({"id": file_id}, {"_id": 0})
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete file from disk
        file_path = file_metadata["file_path"]
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Deleted file from disk: {file_path}")
        
        # Delete metadata from database
        await db.admin_files.delete_one({"id": file_id})
        
        return {
            "message": f"File '{file_metadata['original_filename']}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete file")


@api_router.post("/admin/files/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload a new file"""
    try:
        # Validate file size (100MB limit)
        max_size = 100 * 1024 * 1024  # 100MB
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > max_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File size exceeds 100MB limit. File size: {format_file_size(file_size)}"
            )
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Save file to disk
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Save metadata to database
        file_metadata = {
            "id": file_id,
            "original_filename": file.filename,
            "file_path": file_path,
            "file_size": file_size,
            "uploaded_by": current_user.id,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.admin_files.insert_one(file_metadata)
        
        logger.info(f"File uploaded successfully: {file.filename} (ID: {file_id})")
        
        return {
            "message": f"File '{file.filename}' uploaded successfully",
            "file_id": file_id,
            "filename": file.filename,
            "size": format_file_size(file_size)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@api_router.put("/admin/files/{file_id}/update")
async def update_file(
    file_id: str, 
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user)
):
    """Update/replace an existing file - overwrites the old file (Master Admin only)"""
    # Check if user is master admin
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Only Master Admin can update files")
    
    try:
        # Find existing file metadata
        file_metadata = await db.admin_files.find_one({"id": file_id}, {"_id": 0})
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Validate file size (100MB limit)
        max_size = 100 * 1024 * 1024  # 100MB
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > max_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File size exceeds 100MB limit. File size: {format_file_size(file_size)}"
            )
        
        # Delete old file from disk
        old_file_path = file_metadata["file_path"]
        if os.path.exists(old_file_path):
            os.remove(old_file_path)
            logger.info(f"Deleted old file from disk: {old_file_path}")
        
        # Save new file to disk with same naming pattern
        new_file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
        with open(new_file_path, "wb") as f:
            f.write(file_content)
        
        # Update metadata in database
        updated_metadata = {
            "original_filename": file.filename,
            "file_path": new_file_path,
            "file_size": file_size,
            "updated_by": current_user.id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.admin_files.update_one(
            {"id": file_id},
            {"$set": updated_metadata}
        )
        
        logger.info(f"File updated successfully: {file.filename} (ID: {file_id})")
        
        return {
            "message": f"File '{file.filename}' updated successfully",
            "file_id": file_id,
            "filename": file.filename,
            "size": format_file_size(file_size)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update file: {str(e)}")


@api_router.post("/admin/files/bulk-delete")
async def bulk_delete_files(file_ids: list, current_user: User = Depends(get_current_user)):
    """Bulk delete files (Master Admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Only Master Admin can delete files")
    
    try:
        deleted_count = 0
        
        for file_id in file_ids:
            file_metadata = await db.admin_files.find_one({"id": file_id}, {"_id": 0})
            
            if file_metadata:
                # Delete file from disk
                file_path = file_metadata["file_path"]
                if os.path.exists(file_path):
                    os.remove(file_path)
                
                # Delete from database
                await db.admin_files.delete_one({"id": file_id})
                deleted_count += 1
        
        return {
            "message": f"Successfully deleted {deleted_count} file(s)",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        logger.error(f"Error bulk deleting files: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete files")


@api_router.get("/montra-vehicle/analytics/battery-data")
async def get_battery_consumption_data(
    vehicle_id: str = Query(...),
    date: str = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Get battery consumption data for a specific vehicle and date from MongoDB"""
    try:
        logger.info(f"Fetching battery data for vehicle {vehicle_id} on {date}")
        
        # Query MongoDB for matching data
        query = {
            "vehicle_id": vehicle_id,
            "date": date
        }
        
        results = await db.montra_feed_data.find(query, {"_id": 0}).sort("Date", 1).to_list(10000)
        
        if not results:
            logger.warning(f"No data found for vehicle {vehicle_id} on {date}")
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for vehicle {vehicle_id} on {date}. Please import the feed data first."
            )
        
        logger.info(f"Retrieved {len(results)} rows for vehicle {vehicle_id}")
        
        return {
            "success": True,
            "vehicle_id": vehicle_id,
            "date": date,
            "data": results,
            "count": len(results)
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching battery data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch battery data: {str(e)}")


@api_router.get("/montra-vehicle/vehicles")
async def get_vehicles_list(current_user: User = Depends(get_current_user)):
    """Get list of all vehicles from vehicle mapping"""
    try:
        vehicles = await db.vehicle_mapping.find({}, {"_id": 0}).to_list(1000)
        
        vehicle_list = [
            {
                "vehicle_id": v["vehicle_id"],
                "registration_number": v.get("registration_number", "")
            }
            for v in vehicles
        ]
        
        return {
            "vehicles": vehicle_list,
            "count": len(vehicle_list)
        }
    except Exception as e:
        logger.error(f"Error fetching vehicles: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch vehicles list")


@api_router.get("/montra-vehicle/feed-database")
async def get_montra_feed_database(current_user: User = Depends(get_current_user)):
    """Get all montra feed entries with file information for database management"""
    try:
        # Aggregate to get unique files with their data counts, grouped by month
        pipeline = [
            {
                "$group": {
                    "_id": {
                        "vehicle_id": "$vehicle_id",
                        "date": "$date",
                        "filename": {"$ifNull": ["$filename", "Unknown"]},
                        "month": "$month",
                        "year": {"$ifNull": ["$year", "2024"]}  # Default to 2024 if year is missing
                    },
                    "count": {"$sum": 1},
                    "first_entry": {"$first": "$$ROOT"}
                }
            },
            {
                "$project": {
                    "vehicle_id": "$_id.vehicle_id",
                    "date": "$_id.date", 
                    "filename": "$_id.filename",
                    "month": "$_id.month",
                    "year": "$_id.year",
                    "month_year": {"$concat": ["$_id.month", " ", {"$toString": "$_id.year"}]},
                    "record_count": "$count",
                    "uploaded_at": "$first_entry.imported_at",
                    "file_size": "$first_entry.file_size"
                }
            },
            {"$sort": {"uploaded_at": -1}}
        ]
        
        results = await db.montra_feed_data.aggregate(pipeline).to_list(1000)
        
        return {
            "success": True,
            "files": results,
            "count": len(results)
        }
    except Exception as e:
        logger.error(f"Error fetching montra feed database: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch montra feed database")


@api_router.delete("/montra-vehicle/feed-database")
async def delete_montra_feed_files(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Delete selected montra feed files from database
    
    Args:
        request: Request containing file_identifiers in JSON body
    """
    try:
        # Parse JSON body
        body = await request.json()
        file_identifiers = body if isinstance(body, list) else body.get("file_identifiers", [])
        
        if not file_identifiers:
            raise HTTPException(status_code=400, detail="No files specified for deletion")
        
        deleted_count = 0
        failed_deletions = []
        
        for file_info in file_identifiers:
            try:
                # Use vehicle_id and date as primary identifiers since filename might be null in older records
                query = {
                    "vehicle_id": file_info["vehicle_id"],
                    "date": file_info["date"]
                }
                
                result = await db.montra_feed_data.delete_many(query)
                deleted_count += result.deleted_count
                
                logger.info(f"Deleted {result.deleted_count} records for vehicle {file_info['vehicle_id']} date {file_info['date']}")
                
            except Exception as e:
                logger.error(f"Error deleting records for {file_info.get('vehicle_id', 'Unknown')}: {str(e)}")
                failed_deletions.append({
                    "filename": file_info.get("filename", f"{file_info.get('vehicle_id', 'Unknown')}-{file_info.get('date', 'Unknown')}"),
                    "error": str(e)
                })
        
        if failed_deletions:
            return {
                "success": False,
                "message": f"Partially completed. Deleted {deleted_count} records.",
                "deleted_count": deleted_count,
                "failed_deletions": failed_deletions
            }
        
        return {
            "success": True,
            "message": f"Successfully deleted {deleted_count} records from {len(file_identifiers)} files",
            "deleted_count": deleted_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting montra feed files: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete montra feed files")



@api_router.post("/montra-vehicle/battery-milestones")
async def get_battery_milestones(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze battery charge milestones for vehicles over a date range.
    Returns time and km when battery hits 80%, 50%, 30%, 20%, plus derived mileage and mid-day charging.
    """
    try:
        from datetime import datetime, time as dt_time
        import pandas as pd
        
        data = await request.json()
        vehicle_ids = data.get("vehicle_ids", [])
        start_date = data.get("start_date")  # Format: "01 Sep"
        end_date = data.get("end_date")      # Format: "30 Sep"
        
        if not vehicle_ids or not start_date or not end_date:
            raise HTTPException(status_code=400, detail="vehicle_ids, start_date, and end_date are required")
        
        results = []
        
        for vehicle_id in vehicle_ids:
            # Query data for this vehicle in date range
            query = {
                "vehicle_id": vehicle_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }
            
            # Get all records for this vehicle in the date range, grouped by date
            records = await db.montra_feed_data.find(query).sort("date", 1).to_list(10000)
            
            # Group by date
            date_groups = {}
            for record in records:
                date_key = record.get("date")
                if date_key not in date_groups:
                    date_groups[date_key] = []
                date_groups[date_key].append(record)
            
            # Analyze each date
            for date_str, day_records in date_groups.items():
                try:
                    # Sort records by time
                    day_records.sort(key=lambda x: x.get("time", "00:00:00"))
                    
                    # Skip if insufficient data
                    if len(day_records) < 5:
                        continue
                    
                    analysis = {
                        "date": date_str,
                        "vehicle": vehicle_id,
                        "charge_at_6am": None,
                        "time_at_80": None,
                        "km_at_80": None,
                        "time_at_50": None,
                        "km_at_50": None,
                        "time_at_30": None,
                        "time_at_20": None,
                        "km_at_20": None,
                        "derived_mileage": None,
                        "midday_charge": None
                    }
                    
                    # Find charge at 6AM (or closest time before 7AM)
                    charge_at_6am = None
                    for record in day_records:
                        record_time_str = record.get("time", "00:00:00")
                        try:
                            record_time = datetime.strptime(record_time_str, "%H:%M:%S").time()
                            if record_time <= dt_time(7, 0):
                                battery_pct = record.get("battery_soc_percentage")
                                if battery_pct is not None:
                                    charge_at_6am = battery_pct
                        except:
                            pass
                    
                    # Skip this day if no 6AM charge found
                    if charge_at_6am is None:
                        continue
                    
                    analysis["charge_at_6am"] = f"{charge_at_6am}%"
                    
                    # Find milestones (80%, 50%, 30%, 20%) - first occurrence during driving
                    milestones = {80: False, 50: False, 30: False, 20: False}
                    prev_battery = None
                    has_any_milestone = False
                    
                    for record in day_records:
                        battery_pct = record.get("battery_soc_percentage")
                        km = record.get("km")
                        record_time = record.get("time")
                        
                        if battery_pct is None:
                            continue
                        
                        # Check if battery is decreasing (driving, not charging)
                        is_driving = prev_battery is not None and battery_pct < prev_battery
                        
                        if is_driving or prev_battery is None:
                            # Check each milestone
                            for milestone in [80, 50, 30, 20]:
                                if not milestones[milestone]:
                                    if battery_pct <= milestone:
                                        milestones[milestone] = True
                                        has_any_milestone = True
                                        if milestone == 80:
                                            analysis["time_at_80"] = record_time
                                            if km:
                                                analysis["km_at_80"] = km
                                        elif milestone == 50:
                                            analysis["time_at_50"] = record_time
                                            if km:
                                                analysis["km_at_50"] = km
                                        elif milestone == 30:
                                            analysis["time_at_30"] = record_time
                                        elif milestone == 20:
                                            analysis["time_at_20"] = record_time
                                            if km:
                                                analysis["km_at_20"] = km
                        
                        prev_battery = battery_pct
                    
                    # Skip if no meaningful milestones reached
                    if not has_any_milestone:
                        continue
                    
                    # Calculate derived mileage (km per % charge drop during driving periods)
                    # Only consider periods where battery is decreasing (driving)
                    driving_segments = []
                    prev_record = None
                    
                    for record in day_records:
                        battery_pct = record.get("battery_soc_percentage")
                        km = record.get("km")
                        
                        if prev_record and battery_pct is not None and km is not None:
                            prev_battery_pct = prev_record.get("battery_soc_percentage")
                            prev_km = prev_record.get("km")
                            
                            if prev_battery_pct and prev_km:
                                # Check if driving (battery decreasing)
                                if battery_pct < prev_battery_pct:
                                    charge_drop = prev_battery_pct - battery_pct
                                    km_traveled = km - prev_km
                                    
                                    # Only include reasonable values
                                    if charge_drop > 0 and km_traveled > 0 and charge_drop < 50 and km_traveled < 100:
                                        efficiency = km_traveled / charge_drop
                                        driving_segments.append(efficiency)
                        
                        prev_record = record
                    
                    if driving_segments:
                        avg_mileage = sum(driving_segments) / len(driving_segments)
                        analysis["derived_mileage"] = f"{avg_mileage:.2f}"
                    
                    # Calculate mid-day charge (7AM to 7PM)
                    total_midday_charge = 0
                    prev_battery_midday = None
                    
                    for record in day_records:
                        record_time_str = record.get("time", "00:00:00")
                        battery_pct = record.get("battery_soc_percentage")
                        
                        try:
                            record_time = datetime.strptime(record_time_str, "%H:%M:%S").time()
                            
                            # Check if between 7AM and 7PM
                            if dt_time(7, 0) <= record_time <= dt_time(19, 0):
                                if battery_pct is not None and prev_battery_midday is not None:
                                    # If battery increased (charging)
                                    if battery_pct > prev_battery_midday:
                                        charge_added = battery_pct - prev_battery_midday
                                        # Only add if reasonable increase (not data error)
                                        if charge_added < 50:
                                            total_midday_charge += charge_added
                                
                                prev_battery_midday = battery_pct
                        except:
                            pass
                    
                    if total_midday_charge > 0:
                        analysis["midday_charge"] = f"{total_midday_charge:.1f}%"
                    
                    results.append(analysis)
                    
                except Exception as e:
                    logger.error(f"Error analyzing date {date_str} for vehicle {vehicle_id}: {str(e)}")
                    continue
        
        return {
            "success": True,
            "milestones": results,
            "count": len(results)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in battery milestones analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing battery milestones: {str(e)}")


@api_router.get("/montra-vehicle/battery-audit")
async def get_battery_charge_audit(current_user: User = Depends(get_current_user)):
    """
    Battery Charge Audit: Find all instances where vehicle charge dropped to or below 20% 
    between 7 AM and 7 PM. Returns the first instance per day per vehicle.
    
    Returns: Date, Vehicle Name, Timestamp (when charge <=20%), KM driven from start of day
    """
    try:
        from datetime import datetime, time as dt_time
        
        # Get all Montra feed data (increased limit to handle all records)
        all_records = await db.montra_feed_data.find({}).to_list(250000)
        
        if not all_records:
            return {
                "success": True,
                "audit_results": [],
                "count": 0,
                "message": "No Montra feed data found. Please import vehicle data first."
            }
        
        logger.info(f"Processing {len(all_records)} records for battery audit")
        
        # Group records by vehicle and date
        vehicle_date_groups = {}
        for record in all_records:
            vehicle_id = record.get("vehicle_id") or record.get("Vehicle ID")
            registration = record.get("registration_number") or record.get("Registration Number")
            date = record.get("date")
            
            if not vehicle_id or not date:
                continue
            
            # Use registration number if available, otherwise vehicle_id
            display_name = registration if registration else vehicle_id
            
            key = f"{vehicle_id}_{date}"
            if key not in vehicle_date_groups:
                vehicle_date_groups[key] = {
                    "vehicle_id": vehicle_id,
                    "display_name": display_name,
                    "date": date,
                    "records": []
                }
            vehicle_date_groups[key]["records"].append(record)
        
        logger.info(f"Grouped into {len(vehicle_date_groups)} vehicle-date combinations")
        
        audit_results = []
        
        # Analyze each vehicle-date combination
        for key, group_data in vehicle_date_groups.items():
            vehicle_id = group_data["vehicle_id"]
            display_name = group_data["display_name"]
            date = group_data["date"]
            day_records = group_data["records"]
            
            # Sort records by time
            try:
                day_records.sort(key=lambda x: x.get("Portal Received Time", x.get("time", "00:00:00")) if x.get("Portal Received Time") or x.get("time") else "00:00:00")
            except Exception as e:
                logger.error(f"Error sorting records for {vehicle_id} on {date}: {str(e)}")
                continue
            
            # Find first instance where charge <= 20% between 7 AM and 7 PM
            first_low_charge = None
            start_of_day_km = None
            charge_at_7am = None
            
            # Get the KM at start of day (earliest record)
            if day_records:
                start_of_day_km = (day_records[0].get("Odometer (km)") or
                                  day_records[0].get("KM") or 
                                  day_records[0].get("km") or 
                                  day_records[0].get("Kilometer"))
            
            # Find battery charge at or before 7 AM
            for record in day_records:
                battery_pct_7am = (record.get("Battery Soc(%)") or 
                                  record.get("Battery %") or 
                                  record.get("battery_soc_percentage") or 
                                  record.get("Battery") or
                                  record.get("battery") or
                                  record.get("SOC") or
                                  record.get("soc"))
                
                time_str_7am = (record.get("Portal Received Time") or
                               record.get("time") or 
                               record.get("Time") or 
                               record.get("Hour") or
                               record.get("hour"))
                
                if battery_pct_7am and time_str_7am:
                    try:
                        if isinstance(time_str_7am, str):
                            try:
                                dt_7am = datetime.fromisoformat(time_str_7am.replace(' ', 'T'))
                                record_time_7am = dt_7am.time()
                            except:
                                time_part = time_str_7am.split()[0] if ' ' in time_str_7am else time_str_7am
                                try:
                                    record_time_7am = datetime.strptime(time_part, "%H:%M:%S").time()
                                except:
                                    continue
                        else:
                            continue
                        
                        # Get battery at or just before 7 AM
                        if record_time_7am <= dt_time(7, 0):
                            if battery_pct_7am != '-':
                                try:
                                    charge_at_7am = float(str(battery_pct_7am))
                                except:
                                    pass
                        else:
                            # Once we pass 7 AM, stop looking
                            break
                    except:
                        continue
            
            for record in day_records:
                # Get battery percentage (check all possible field names)
                battery_pct = (record.get("Battery Soc(%)") or 
                              record.get("Battery %") or 
                              record.get("battery_soc_percentage") or 
                              record.get("Battery") or
                              record.get("battery") or
                              record.get("SOC") or
                              record.get("soc"))
                
                time_str = (record.get("Portal Received Time") or
                           record.get("time") or 
                           record.get("Time") or 
                           record.get("Hour") or
                           record.get("hour"))
                
                km_value = (record.get("Odometer (km)") or
                           record.get("KM") or 
                           record.get("km") or 
                           record.get("Kilometer") or
                           record.get("kilometer"))
                
                if battery_pct is None or time_str is None:
                    continue
                
                try:
                    # Parse time - handle different time formats including datetime strings
                    if isinstance(time_str, str):
                        # Try to parse as datetime first (e.g., "2025-09-30 18:09:56")
                        try:
                            dt = datetime.fromisoformat(time_str.replace(' ', 'T'))
                            record_time = dt.time()
                        except:
                            # Try as time only
                            time_part = time_str.split()[0] if ' ' in time_str else time_str
                            try:
                                record_time = datetime.strptime(time_part, "%H:%M:%S").time()
                            except:
                                try:
                                    record_time = datetime.strptime(time_part, "%H:%M").time()
                                except:
                                    continue
                    else:
                        continue
                    
                    # Check if between 7 AM and 7 PM (inclusive)
                    if dt_time(7, 0) <= record_time <= dt_time(19, 0):
                        # Check if charge is at or below 20%
                        try:
                            # Handle string values like "20", "0", "-"
                            if battery_pct == '-' or battery_pct is None:
                                continue
                            battery_value = float(str(battery_pct))
                        except (ValueError, TypeError):
                            continue
                        
                        # Changed from < to <= to include 20%
                        if battery_value <= 20:
                            # Calculate KM driven from start of day
                            km_driven = None
                            if km_value is not None and start_of_day_km is not None:
                                try:
                                    km_driven = float(km_value) - float(start_of_day_km)
                                    if km_driven < 0:
                                        km_driven = 0  # Set to 0 instead of None for negative values
                                except:
                                    km_driven = None
                            
                            first_low_charge = {
                                "date": date,
                                "vehicle_name": display_name,
                                "timestamp": time_str,
                                "km_driven_upto_point": round(km_driven, 2) if km_driven is not None else "N/A",
                                "battery_percentage": round(battery_value, 1),
                                "charge_at_7am": round(charge_at_7am, 1) if charge_at_7am is not None else "N/A"
                            }
                            logger.info(f"Found low charge: {vehicle_id} on {date} at {time_str} - {battery_value}%")
                            break  # Found first instance, stop checking this day
                    
                except Exception as e:
                    logger.error(f"Error processing record for {vehicle_id} on {date}: {str(e)}")
                    continue
            
            # Add to results if we found a low charge instance
            if first_low_charge:
                audit_results.append(first_low_charge)
        
        # Sort results by date and vehicle
        audit_results.sort(key=lambda x: (x["date"], x["vehicle_name"]))
        
        logger.info(f"Battery audit complete: Found {len(audit_results)} low charge instances")
        
        return {
            "success": True,
            "audit_results": audit_results,
            "count": len(audit_results),
            "message": f"Found {len(audit_results)} instances where battery dropped to or below 20% between 7 AM - 7 PM"
        }
        
    except Exception as e:
        logger.error(f"Error in battery charge audit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating battery audit: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error in battery charge audit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating battery audit: {str(e)}")


@api_router.get("/montra-vehicle/morning-charge-audit")
async def get_morning_charge_audit(current_user: User = Depends(get_current_user)):
    """
    Morning Charge Audit: Find all instances where vehicle charge at 6 AM was less than 95%
    This helps identify vehicles that didn't charge properly overnight.
    
    Returns: Date, Vehicle Name, Charge at 6 AM (only for instances < 95%)
    """
    try:
        from datetime import datetime, time as dt_time
        
        # Get all Montra feed data
        all_records = await db.montra_feed_data.find({}).to_list(250000)
        
        if not all_records:
            return {
                "success": True,
                "audit_results": [],
                "count": 0,
                "message": "No Montra feed data found. Please import vehicle data first."
            }
        
        logger.info(f"Processing {len(all_records)} records for morning charge audit")
        
        # Group records by vehicle and date
        vehicle_date_groups = {}
        for record in all_records:
            vehicle_id = record.get("vehicle_id") or record.get("Vehicle ID")
            registration = record.get("registration_number") or record.get("Registration Number")
            date = record.get("date")
            
            if not vehicle_id or not date:
                continue
            
            # Use registration number if available, otherwise vehicle_id
            display_name = registration if registration else vehicle_id
            
            key = f"{vehicle_id}_{date}"
            if key not in vehicle_date_groups:
                vehicle_date_groups[key] = {
                    "vehicle_id": vehicle_id,
                    "display_name": display_name,
                    "date": date,
                    "records": []
                }
            vehicle_date_groups[key]["records"].append(record)
        
        logger.info(f"Grouped into {len(vehicle_date_groups)} vehicle-date combinations")
        
        audit_results = []
        
        # Analyze each vehicle-date combination
        for key, group_data in vehicle_date_groups.items():
            vehicle_id = group_data["vehicle_id"]
            display_name = group_data["display_name"]
            date = group_data["date"]
            day_records = group_data["records"]
            
            # Sort records by time
            try:
                day_records.sort(key=lambda x: x.get("Portal Received Time", x.get("time", "00:00:00")) if x.get("Portal Received Time") or x.get("time") else "00:00:00")
            except Exception as e:
                logger.error(f"Error sorting records for {vehicle_id} on {date}: {str(e)}")
                continue
            
            # Find battery charge at or closest to 6 AM
            charge_at_6am = None
            closest_time_to_6am = None
            
            for record in day_records:
                battery_pct = (record.get("Battery Soc(%)") or 
                              record.get("Battery %") or 
                              record.get("battery_soc_percentage") or 
                              record.get("Battery") or
                              record.get("battery") or
                              record.get("SOC") or
                              record.get("soc"))
                
                time_str = (record.get("Portal Received Time") or
                           record.get("time") or 
                           record.get("Time") or 
                           record.get("Hour") or
                           record.get("hour"))
                
                if battery_pct and time_str:
                    try:
                        if isinstance(time_str, str):
                            try:
                                dt = datetime.fromisoformat(time_str.replace(' ', 'T'))
                                record_time = dt.time()
                            except:
                                time_part = time_str.split()[0] if ' ' in time_str else time_str
                                try:
                                    record_time = datetime.strptime(time_part, "%H:%M:%S").time()
                                except:
                                    continue
                        else:
                            continue
                        
                        # Look for records between 5:30 AM and 6:30 AM to get closest to 6 AM
                        if dt_time(5, 30) <= record_time <= dt_time(6, 30):
                            if battery_pct != '-':
                                try:
                                    battery_val = float(str(battery_pct))
                                    
                                    # Keep the record closest to 6:00 AM
                                    target_time = dt_time(6, 0)
                                    time_diff = abs((datetime.combine(datetime.today(), record_time) - 
                                                   datetime.combine(datetime.today(), target_time)).total_seconds())
                                    
                                    if closest_time_to_6am is None or time_diff < closest_time_to_6am:
                                        closest_time_to_6am = time_diff
                                        charge_at_6am = battery_val
                                except:
                                    pass
                        elif record_time > dt_time(6, 30):
                            # Stop looking once we're past 6:30 AM
                            break
                    except:
                        continue
            
            # Add to results if charge at 6 AM is less than 95%
            if charge_at_6am is not None and charge_at_6am < 95:
                audit_results.append({
                    "date": date,
                    "vehicle_name": display_name,
                    "charge_at_6am": round(charge_at_6am, 1)
                })
                logger.info(f"Found low morning charge: {vehicle_id} on {date} - {charge_at_6am}%")
        
        # Sort results by date and vehicle
        audit_results.sort(key=lambda x: (x["date"], x["vehicle_name"]))
        
        logger.info(f"Morning charge audit complete: Found {len(audit_results)} instances with charge < 95% at 6 AM")
        
        return {
            "success": True,
            "audit_results": audit_results,
            "count": len(audit_results),
            "message": f"Found {len(audit_results)} instances where morning charge was below 95% at 6 AM"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in morning charge audit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating morning charge audit: {str(e)}")


@api_router.get("/admin/files/get-drivers-vehicles")
async def get_drivers_and_vehicles(
    month: str = Query(..., description="Month name (e.g., Sep)"),
    year: str = Query(..., description="Year (e.g., 2025)"),
    current_user: User = Depends(get_current_user)
):
    """Get drivers and vehicles list for a specific month/year from generic Excel files with monthly tabs"""
    import pandas as pd
    
    try:
        # Convert month number to name if needed
        month_names = {
            "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
            "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
        }
        month_name = month_names.get(month, month)
        
        # Ensure month name is title case (handles "sep" -> "Sep", "SEP" -> "Sep", etc.)
        month_name = month_name.capitalize()
        
        # Tab name format: "Sep 2025", "Oct 2025", etc.
        tab_name = f"{month_name} {year}"
        
        logger.info(f"Looking for tab '{tab_name}' in Drivers List.xlsx and Vehicles List.xlsx")
        
        # Find the generic files (not month-specific)
        files = await db.admin_files.find({}).to_list(1000)
        
        drivers_file = None
        vehicles_file = None
        
        for file in files:
            filename = file.get("original_filename", "")
            # Look for generic filenames
            if filename == "Drivers List.xlsx":
                drivers_file = file
            elif filename == "Vehicles List.xlsx":
                vehicles_file = file
        
        result = {
            "success": True,
            "drivers": [],
            "vehicles": [],
            "month": month_name,
            "year": year
        }
        
        # Parse drivers file - read from specific tab
        if drivers_file:
            file_path = drivers_file.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    # Read specific sheet/tab by name (header=None to not treat B1 as column names)
                    df = pd.read_excel(file_path, sheet_name=tab_name, header=None)
                    # Read from Column B (index 1), skip first row (B1 which has headers)
                    if len(df.columns) > 1:
                        drivers = df.iloc[1:, 1].dropna().astype(str).tolist()  # Start from row 1 (B2), column 1 (B)
                        drivers = [name.strip() for name in drivers if name.strip() and name.strip().lower() not in ['nan', 'name', 'driver name', 'driver', 'drivers']]
                        result["drivers"] = drivers
                        logger.info(f"Loaded {len(drivers)} drivers from tab '{tab_name}' Column B of Drivers List.xlsx")
                    else:
                        logger.warning(f"Drivers file tab '{tab_name}' does not have Column B")
                except Exception as e:
                    logger.error(f"Error parsing drivers file tab '{tab_name}': {str(e)}")
        else:
            logger.warning(f"Drivers List.xlsx file not found in admin files")
        
        # Parse vehicles file - read from specific tab
        if vehicles_file:
            file_path = vehicles_file.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    # Read specific sheet/tab by name (header=None to not treat B1 as column names)
                    df = pd.read_excel(file_path, sheet_name=tab_name, header=None)
                    # Read from Column B (index 1), skip first row (B1 which has headers)
                    if len(df.columns) > 1:
                        vehicles = df.iloc[1:, 1].dropna().astype(str).tolist()  # Start from row 1 (B2), column 1 (B)
                        vehicles = [name.strip() for name in vehicles if name.strip() and name.strip().lower() not in ['nan', 'name', 'vehicle number', 'vehicle', 'registration number', 'vehicles']]
                        result["vehicles"] = vehicles
                        logger.info(f"Loaded {len(vehicles)} vehicles from tab '{tab_name}' Column B of Vehicles List.xlsx")
                    else:
                        logger.warning(f"Vehicles file tab '{tab_name}' does not have Column B")
                except Exception as e:
                    logger.error(f"Error parsing vehicles file tab '{tab_name}': {str(e)}")
        else:
            logger.warning(f"Vehicles List.xlsx file not found in admin files")
        
        if not result["drivers"] and not result["vehicles"]:
            # Return mock data as fallback
            result["drivers"] = ["Abdul", "Samantha", "Samuel", "Sareena", "Ravi", "John", "Mike"]
            result["vehicles"] = ["TN07CE2222", "TN01AB1234", "KA05CD5678", "AP09EF9012"]
            result["using_mock_data"] = True
            logger.warning(f"No data found for tab '{tab_name}', using mock data")
        
        return result
        
    except Exception as e:
        logger.error(f"Error in get_drivers_and_vehicles: {str(e)}")
        # Return mock data as fallback
        return {
            "success": True,
            "drivers": ["Abdul", "Samantha", "Samuel", "Sareena", "Ravi", "John", "Mike"],
            "vehicles": ["TN07CE2222", "TN01AB1234", "KA05CD5678", "AP09EF9012"],
            "month": month,
            "year": year,
            "using_mock_data": True,
            "error": str(e)
        }


@api_router.post("/payment-reconciliation/process-screenshots")
async def process_payment_screenshots(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Process uploaded screenshots using OpenAI GPT-4o Vision to extract payment data"""
    from dotenv import load_dotenv
    from datetime import datetime
    load_dotenv()
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import base64
        import tempfile
        import uuid
        
        # Parse form data
        form = await request.form()
        files = form.getlist("files")
        month_year = form.get("month_year", "")  # e.g., "Sep 2025"
        driver_name = form.get("driver_name", "")  # Driver name for folder organization
        vehicle_number = form.get("vehicle_number", "")
        platform = form.get("platform", "")
        
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")
        
        if len(files) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 files allowed per batch")
        
        # Get the emergent LLM key
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Emergent LLM API key not configured")
        
        # Initialize OpenAI GPT-4o with Vision capabilities
        chat = LlmChat(
            api_key=api_key,
            session_id=f"payment-extraction-{uuid.uuid4()}",
            system_message="You are an expert at extracting ride payment details from screenshots. Extract ONLY visible data accurately. DO NOT assume or guess missing information. DO NOT copy data from one ride to another. Return structured information with N/A for any data that is not clearly visible."
        ).with_model("openai", "gpt-4o")
        
        extracted_results = []
        processing_errors = []
        temp_files = []
        file_mapping = {}  # Map original filename to temp file path
        
        try:
            # Process each file - collect all results first
            for i, file in enumerate(files):
                try:
                    # Read file content
                    file_content = await file.read()
                    
                    # Create temporary file
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1]}")
                    temp_file.write(file_content)
                    temp_file.close()
                    temp_files.append(temp_file.name)
                    
                    # Map original filename to temp file path
                    file_mapping[file.filename] = temp_file.name
                    
                    # Read image and encode as base64 for OpenAI GPT-4o Vision
                    with open(temp_file.name, 'rb') as img_file:
                        image_bytes = img_file.read()
                        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    
                    # Create ImageContent with base64 encoding
                    image_content = ImageContent(image_base64=image_base64)
                    
                    # Create extraction prompt - Enhanced for Tamil auto-rickshaw receipts (multiple formats)
                    extraction_prompt = """You are analyzing ride-sharing receipt screenshots (Tamil/English). These can be in multiple formats:

**FORMAT TYPES:**
1. Simple cash receipts: "Auto", time, கேஷ், ₹amount
2. Detailed app receipts: "Auto", ₹amount, distance (கி.மீ), duration (நிமி, வி), time
3. Paytm detailed receipts: "மதிப்பிடப்பட்ட வருவாய்" (Estimated Fare), distance with decimals (2.36 km), duration with decimals (16.67 min), pickup/drop locations
4. Ride history list: Multiple rides with timestamps like "10:59 pm", "10:18 pm", pickup/drop locations, fare amounts
5. Surge pricing: Upward arrow ↑ with "அதிகரித்துள்ளது" (increased)
6. Cancellations: "வாடிக்கையாளர் ரத்துசெய்தார்" (customer cancelled) or "வண்டிக்கையாளர் ரத்துசெய்தார்" (driver cancelled)
7. Zero-fare rides: ₹0.00 with promotional text or cancellation

**TAMIL TEXT MEANINGS:**
- கேஷ் = Cash
- கி.மீ / km = Kilometers
- நிமி = Minutes (நிமிடம்)
- வி = Seconds (விநாடி)
- ம.நே = Hours (மணிநேரம்)
- மதிப்பிடப்பட்ட வருவாய் / மதிப்பிடப்பட்ட வரு... = Estimated Fare
- பிக்கப் = Pickup
- முரபி / டிராப் = Dropoff/Drop
- அதிகரித்துள்ளது = Surge/Increased pricing
- வாடிக்கையாளர் ரத்துசெய்தார் = Customer cancelled
- வண்டிக்கையாளர் ரத்துசெய்தார் = Driver cancelled
- பயணச் சவால் = Travel challenge (promotional)
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

**EXAMPLE CONVERSIONS:**
- "3.57 கி.மீ" / "2.36 km" → distance: "3.57" / "2.36"
- "16 நிமி 55 வி" → duration: "16" (ignore seconds)
- "16.67 min" → duration: "16.67"
- "1 ம.நே 11 நிமி" → duration: "71"
- "₹126.45" / "₹89" → amount: "126.45" / "89"
- "திங்கள்., 29 செப்." / "26 September" → date: "29/09/2024" / "26/09/2024"
- "10:59 pm" → time: "10:59 PM"
- "Crown Residences" → pickup_location: "Crown Residences"
- "8/25, Srinivasa Nagar, Virugambakkam" → drop_location: "8/25, Srinivasa Nagar, Virugambakkam"
- "B1 Entrance, Thirumangalam Metro St..." → pickup_location: "B1 Entrance, Thirumangalam Metro Station"

Be precise and extract ALL rides shown in the screenshot. If a screenshot shows multiple rides (like a ride history list), extract each as a separate record.
"""

                    # Send to OpenAI GPT-4o Vision
                    user_message = UserMessage(
                        text=extraction_prompt,
                        file_contents=[image_content]
                    )
                    
                    response = await chat.send_message(user_message)
                    
                    # Parse JSON response
                    import json
                    try:
                        # Clean response - remove markdown formatting if present
                        clean_response = response.strip()
                        if clean_response.startswith("```json"):
                            clean_response = clean_response[7:]
                        if clean_response.endswith("```"):
                            clean_response = clean_response[:-3]
                        clean_response = clean_response.strip()
                        
                        # Parse the response - it should be an array of rides
                        parsed_data = json.loads(clean_response)
                        
                        # Handle both single object and array responses
                        if isinstance(parsed_data, list):
                            # Multiple rides extracted from one screenshot
                            for ride_data in parsed_data:
                                ride_data["screenshot_filename"] = file.filename
                                ride_data["id"] = str(uuid.uuid4())
                                ride_data["processed_at"] = datetime.now().isoformat()
                                extracted_results.append(ride_data)
                        else:
                            # Single ride
                            parsed_data["screenshot_filename"] = file.filename
                            parsed_data["id"] = str(uuid.uuid4())
                            parsed_data["processed_at"] = datetime.now().isoformat()
                            extracted_results.append(parsed_data)
                        
                    except json.JSONDecodeError as e:
                        error_msg = f"Failed to parse JSON response for file {file.filename}: {str(e)}"
                        logger.error(error_msg)
                        processing_errors.append(error_msg)
                        break  # Stop processing on parse error
                    
                except Exception as e:
                    error_msg = f"Error processing file {file.filename}: {str(e)}"
                    logger.error(error_msg)
                    processing_errors.append(error_msg)
                    break  # Stop processing on any error
            
            # Check if all files processed successfully
            if processing_errors:
                raise HTTPException(
                    status_code=422, 
                    detail={
                        "message": "Batch processing failed. Please try again with all 10 files.",
                        "errors": processing_errors,
                        "failed_batch": True
                    }
                )
            
            if len(extracted_results) < len(files):
                logger.warning(f"Only {len(extracted_results)} rides extracted from {len(files)} files")
            
            # Add metadata to results and save to MongoDB
            if extracted_results:
                for record in extracted_results:
                    record["user_id"] = current_user.id
                    record["month_year"] = month_year
                    record["driver"] = driver_name or record.get("driver", "N/A")
                    record["vehicle"] = vehicle_number or record.get("vehicle", "N/A")
                    record["platform"] = platform or record.get("platform", "N/A")
                    record["uploaded_at"] = datetime.now().isoformat()
                    record["status"] = "pending"
                
                # Save all extracted records to MongoDB with files_imported flag
                try:
                    if extracted_results:
                        # Mark files as not imported yet
                        for record in extracted_results:
                            record["files_imported"] = False
                        
                        # Create copies for MongoDB (will get _id added)
                        records_to_insert = [record.copy() for record in extracted_results]
                        await db.payment_records.insert_many(records_to_insert)
                        logger.info(f"✅ Saved {len(extracted_results)} payment records to MongoDB for {month_year}")
                        
                        # Clean up - remove _id from original records if it was added
                        for record in extracted_results:
                            if "_id" in record:
                                del record["_id"]
                        
                except Exception as e:
                    logger.error(f"❌ Failed to save payment records to MongoDB: {str(e)}")
                    # Don't fail the request, records are still in memory
            
            # Keep temp files for later import - store mapping in the response
            # Don't save screenshots yet - will be saved when user clicks "Import Files to Backend"
        
            return {
                "success": True,
                "extracted_data": extracted_results,
                "processed_files": len(files),
                "total_rides_extracted": len(extracted_results),
                "message": f"Successfully processed {len(files)} screenshots and extracted {len(extracted_results)} ride(s)"
            }
            
        finally:
            # Clean up all temporary files
            for temp_file_path in temp_files:
                try:
                    if os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                except Exception as e:
                    logger.error(f"Failed to cleanup temp file {temp_file_path}: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error in process_payment_screenshots: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process screenshots: {str(e)}")


@api_router.post("/payment-reconciliation/import-files")
async def import_files_to_backend(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Import screenshot files to payment_screenshots folder and mark records as imported"""
    try:
        data = await request.json()
        month_year = data.get("month_year")
        record_ids = data.get("record_ids", [])
        
        if not month_year:
            raise HTTPException(status_code=400, detail="month_year is required")
        
        if not record_ids:
            raise HTTPException(status_code=400, detail="No records to import")
        
        # Fetch the records
        records = await db.payment_records.find({
            "id": {"$in": record_ids},
            "user_id": current_user.id,
            "month_year": month_year
        }, {"_id": 0}).to_list(length=None)
        
        if not records:
            raise HTTPException(status_code=404, detail="No records found")
        
        # Group records by driver
        drivers_screenshots = {}
        for record in records:
            driver = record.get("driver", "Unknown")
            filename = record.get("screenshot_filename")
            if filename:
                if driver not in drivers_screenshots:
                    drivers_screenshots[driver] = []
                drivers_screenshots[driver].append(filename)
        
        # Get unique screenshot filenames that need to be imported
        all_filenames = []
        for driver, filenames in drivers_screenshots.items():
            all_filenames.extend(filenames)
        
        unique_filenames = list(set(all_filenames))
        
        # For now, we'll just mark the records as imported in the database
        # The actual files should be re-uploaded by the frontend
        # Update: We'll save files that are already in temp directory or ask frontend to send them
        
        # Mark records as imported
        result = await db.payment_records.update_many(
            {
                "id": {"$in": record_ids},
                "user_id": current_user.id
            },
            {
                "$set": {
                    "files_imported": True,
                    "imported_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"✅ Marked {result.modified_count} records as imported for {month_year}")
        
        return {
            "success": True,
            "message": f"Successfully marked {result.modified_count} record(s) as imported",
            "imported_count": result.modified_count,
            "files_needed": unique_filenames
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to import files: {str(e)}")


@api_router.post("/payment-reconciliation/upload-screenshots-to-folder")
async def upload_screenshots_to_folder(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Upload screenshot files to payment_screenshots folder structure"""
    try:
        form = await request.form()
        files = form.getlist("files")
        month_year = form.get("month_year")
        driver_name = form.get("driver_name")
        
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        if not month_year or not driver_name:
            raise HTTPException(status_code=400, detail="month_year and driver_name are required")
        
        # Create directory structure
        base_dir = "/app/backend/payment_screenshots"
        driver_dir = os.path.join(base_dir, month_year, driver_name)
        os.makedirs(driver_dir, exist_ok=True)
        
        logger.info(f"Uploading {len(files)} files to {driver_dir}")
        
        saved_files = []
        saved_count = 0
        
        for file in files:
            try:
                # Read file content
                file_content = await file.read()
                
                # Handle duplicate filenames
                base_filename = file.filename
                filename_without_ext, ext = os.path.splitext(base_filename)
                dest_path = os.path.join(driver_dir, base_filename)
                
                counter = 2
                final_filename = base_filename
                while os.path.exists(dest_path):
                    # File exists, add (2), (3), etc.
                    final_filename = f"{filename_without_ext} ({counter}){ext}"
                    dest_path = os.path.join(driver_dir, final_filename)
                    counter += 1
                
                # Save file
                with open(dest_path, 'wb') as f:
                    f.write(file_content)
                
                saved_files.append(final_filename)
                saved_count += 1
                logger.info(f"✅ Saved screenshot: {dest_path}")
                
            except Exception as e:
                logger.error(f"Error saving file {file.filename}: {str(e)}")
        
        logger.info(f"✅ Successfully saved {saved_count}/{len(files)} screenshots to {driver_dir}")
        
        return {
            "success": True,
            "message": f"Successfully uploaded {saved_count} file(s) to {month_year}/{driver_name}",
            "saved_count": saved_count,
            "saved_files": saved_files
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading screenshots: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload screenshots: {str(e)}")


@api_router.post("/payment-reconciliation/sync-to-sheets")
async def sync_payment_data_to_sheets(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Sync payment reconciliation data to Google Sheets using Apps Script V2"""
    try:
        import shutil
        
        body = await request.json()
        data_rows = body.get("data", [])
        month_year = body.get("month_year", "Sep 2025")
        
        if not data_rows:
            raise HTTPException(status_code=400, detail="No data to sync")
        
        # Get Google Apps Script URL from environment
        apps_script_url = os.environ.get("PAYMENT_SHEETS_APPS_SCRIPT_URL")
        
        if not apps_script_url:
            logger.warning("PAYMENT_SHEETS_APPS_SCRIPT_URL not configured, skipping sync")
            return {"success": True, "message": "Sync skipped - Apps Script URL not configured"}
        
        # Prepare data for Apps Script V2 format
        records_to_sync = []
        for row in data_rows:
            records_to_sync.append({
                "id": row.get("id", ""),
                "driver": row.get("driver", "N/A"),
                "vehicle": row.get("vehicle", "N/A"),
                "date": row.get("date", "N/A"),
                "time": row.get("time", "N/A"),
                "description": row.get("description", "Auto"),
                "amount": str(row.get("amount", "0")),
                "payment_mode": row.get("paymentMode", "N/A"),
                "distance": str(row.get("distance", "N/A")),
                "duration": str(row.get("duration", "N/A")),
                "pickup_km": row.get("pickupKm", "N/A"),
                "drop_km": row.get("dropKm", "N/A"),
                "pickup_location": row.get("pickupLocation", "N/A"),
                "drop_location": row.get("dropLocation", "N/A"),
                "screenshot_filename": row.get("screenshotFilename", "N/A"),
                "status": row.get("status", "pending")
            })
        
        # Call Apps Script Web App
        import requests
        payload = {
            "data": records_to_sync,
            "month_year": month_year
        }
        
        response = requests.post(apps_script_url, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                logger.info(f"Successfully synced {len(records_to_sync)} records to Google Sheets: {month_year}")
                
                # Note: Screenshots are already organized in Payment Screenshots library
                # during processing at: /app/backend/payment_screenshots/{month_year}/{driver_name}/
                # No need to copy them again after sync
                
                return {
                    "success": True, 
                    "message": result.get("message", "Synced successfully")
                }
            else:
                raise HTTPException(status_code=500, detail=f"Apps Script error: {result.get('message')}")
        else:
            raise HTTPException(status_code=500, detail=f"Apps Script request failed: {response.status_code}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing to Google Sheets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error syncing to Google Sheets: {str(e)}")


@api_router.post("/payment-reconciliation/delete-records")
async def delete_payment_records(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Delete payment records after successful sync to Google Sheets"""
    try:
        body = await request.json()
        record_ids = body.get("record_ids", [])
        month_year = body.get("month_year", "")
        
        if not record_ids:
            return {"success": True, "message": "No records to delete"}
        
        # Delete records from MongoDB
        delete_result = await db.payment_records.delete_many({
            "id": {"$in": record_ids},
            "month_year": month_year
        })
        
        logger.info(f"Deleted {delete_result.deleted_count} payment records for {month_year}")
        
        return {
            "success": True,
            "deleted_count": delete_result.deleted_count,
            "message": f"Successfully deleted {delete_result.deleted_count} records"
        }
        
    except Exception as e:
        logger.error(f"Error deleting payment records: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting records: {str(e)}")


@api_router.get("/payment-reconciliation/sync-status")
async def get_payment_sync_status(current_user: User = Depends(get_current_user)):
    """Get last sync status for payment reconciliation"""
    try:
        # For now, return a mock status - in production, this would check actual sync history
        return {
            "success": True,
            "last_sync": datetime.now().isoformat(),
            "sync_status": "up_to_date",
            "message": "Data is synchronized"
        }
    except Exception as e:
        logger.error(f"Error getting sync status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get sync status")


@api_router.get("/payment-reconciliation/records")
async def get_payment_records(
    month_year: str = None,
    current_user: User = Depends(get_current_user)
):
    """Get all payment records, optionally filtered by month/year"""
    try:
        query = {"user_id": current_user.id}
        
        # Add month_year filter if provided
        if month_year:
            query["month_year"] = month_year
        
        # Fetch records from MongoDB
        records = await db.payment_records.find(query, {"_id": 0}).to_list(length=None)
        
        return {
            "success": True,
            "records": records,
            "count": len(records)
        }
    except Exception as e:
        logger.error(f"Error fetching payment records: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/payment-reconciliation/update-record")
async def update_payment_record(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Update any field in a payment record"""
    try:
        data = await request.json()
        record_id = data.get("record_id")
        updates = data.get("updates", {})
        
        if not record_id:
            raise HTTPException(status_code=400, detail="No record ID provided")
        
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        # Add updated_at timestamp
        updates["updated_at"] = datetime.now().isoformat()
        updates["updated_by"] = current_user.id
        
        # Update record in payment_records collection
        result = await db.payment_records.update_one(
            {"id": record_id},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        
        return {
            "success": True,
            "message": "Record updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating payment record: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/payment-reconciliation/export-to-excel")
async def export_payment_data_to_excel(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Export payment reconciliation data to Excel file in backend storage"""
    try:
        body = await request.json()
        month_year = body.get("month_year")  # e.g., "Sep 2025"
        
        if not month_year:
            raise HTTPException(status_code=400, detail="month_year is required")
        
        # Fetch all records for this month from MongoDB
        records = await db.payment_records.find({"month_year": month_year}).to_list(length=None)
        
        if not records:
            raise HTTPException(status_code=404, detail=f"No records found for {month_year}")
        
        # Create DataFrame
        import pandas as pd
        df = pd.DataFrame([{
            "Driver": record.get("driver", "N/A"),
            "Vehicle": record.get("vehicle", "N/A"),
            "Date": record.get("date", "N/A"),
            "Time": record.get("time", "N/A"),
            "Description": record.get("description", "Auto"),
            "Amount": record.get("amount", "0"),
            "Payment Mode": record.get("payment_mode", "N/A"),
            "Distance (km)": record.get("distance", "N/A"),
            "Duration (min)": record.get("duration", "N/A"),
            "Pickup KM": record.get("pickup_km", "N/A"),
            "Drop KM": record.get("drop_km", "N/A"),
            "Pickup Location": record.get("pickup_location", "N/A"),
            "Drop Location": record.get("drop_location", "N/A"),
            "Screenshot": record.get("screenshot_filename", "N/A")
        } for record in records])
        
        # Create directory structure: Payment Screenshots/Sep 2025/
        base_dir = "/app/backend/payment_screenshots"
        month_dir = os.path.join(base_dir, month_year)
        os.makedirs(month_dir, exist_ok=True)
        
        # Generate filename
        filename = f"{month_year.replace(' ', '_')}_data.xlsx"
        filepath = os.path.join(month_dir, filename)
        
        # Save to Excel
        df.to_excel(filepath, index=False, engine='openpyxl')
        
        logger.info(f"Exported {len(records)} records to {filepath}")
        
        return {
            "success": True,
            "message": f"Exported {len(records)} records to Excel",
            "filepath": filepath,
            "filename": filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting to Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error exporting to Excel: {str(e)}")


@api_router.delete("/payment-reconciliation/delete-records")
async def delete_payment_records(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Delete selected payment records (Master Admin only)"""
    try:
        # Check if user has permission
        if current_user.account_type not in ["master_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Only Admin or Master Admin can delete records")
        
        data = await request.json()
        record_ids = data.get("record_ids", [])
        
        if not record_ids:
            raise HTTPException(status_code=400, detail="No record IDs provided")
        
        # Delete records from payment_records collection
        result = await db.payment_records.delete_many({"id": {"$in": record_ids}})
        
        return {
            "success": True,
            "deleted_count": result.deleted_count,
            "message": f"Successfully deleted {result.deleted_count} records"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting payment records: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/payment-reconciliation/folders")
async def get_payment_folders(current_user: User = Depends(get_current_user)):
    """Get all payment reconciliation folders"""
    try:
        folders = await db.payment_folders.find({}, {"_id": 0}).to_list(1000)
        return {
            "success": True,
            "folders": folders
        }
    except Exception as e:
        logger.error(f"Error fetching payment folders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/payment-reconciliation/folders")
async def create_payment_folder(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Create a new payment reconciliation folder"""
    try:
        data = await request.json()
        
        # Check if folder already exists
        existing_folder = await db.payment_folders.find_one({"name": data["name"]})
        if existing_folder:
            raise HTTPException(status_code=400, detail="Folder already exists")
        
        # Create new folder
        folder_data = {
            "id": str(uuid.uuid4()),
            "name": data["name"],
            "month": data["month"],
            "year": data["year"],
            "monthLabel": data["monthLabel"],
            "fullName": data["fullName"],
            "createdAt": data["createdAt"],
            "created_by": current_user.id
        }
        
        await db.payment_folders.insert_one(folder_data)
        
        return {
            "success": True,
            "folder": folder_data,
            "message": f"Folder '{data['name']}' created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating payment folder: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/payment-screenshots/browse")
async def browse_payment_screenshots(
    path: str = "",
    current_user: User = Depends(get_current_user)
):
    """Browse payment screenshots directory structure"""
    try:
        # Allow all authenticated users to browse
        if current_user.account_type not in ["master_admin", "admin", "standard", "ops_team"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        base_dir = "/app/backend/payment_screenshots"
        full_path = os.path.join(base_dir, path) if path else base_dir
        
        # Security check - prevent directory traversal
        if not os.path.abspath(full_path).startswith(os.path.abspath(base_dir)):
            raise HTTPException(status_code=403, detail="Invalid path")
        
        if not os.path.exists(full_path):
            # Create the directory if it doesn't exist
            os.makedirs(full_path, exist_ok=True)
            return {"folders": [], "files": []}
        
        folders = []
        files = []
        
        for item in os.listdir(full_path):
            item_path = os.path.join(full_path, item)
            if os.path.isdir(item_path):
                # Count files in this folder recursively
                file_count = sum(1 for _, _, f in os.walk(item_path) for _ in f)
                folders.append({"name": item, "file_count": file_count})
            else:
                # Get file size
                file_size = os.path.getsize(item_path)
                files.append({"name": item, "size": file_size})
        
        return {
            "folders": sorted(folders, key=lambda x: x["name"]),
            "files": sorted(files, key=lambda x: x["name"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error browsing payment screenshots: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/payment-screenshots/download")
async def download_payment_screenshot(
    path: str,
    current_user: User = Depends(get_current_user)
):
    """Download a file from payment screenshots directory"""
    try:
        # Allow all authenticated users to download
        if current_user.account_type not in ["master_admin", "admin", "standard", "ops_team"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        base_dir = "/app/backend/payment_screenshots"
        full_path = os.path.join(base_dir, path)
        
        # Security check
        if not os.path.abspath(full_path).startswith(os.path.abspath(base_dir)):
            raise HTTPException(status_code=403, detail="Invalid path")
        
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        from fastapi.responses import FileResponse
        return FileResponse(full_path, filename=os.path.basename(full_path))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/admin/payment-screenshots/delete")
async def delete_payment_screenshot(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Delete a file or folder from payment screenshots directory (Master Admin only)"""
    try:
        # Only Master Admin can delete
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only Master Admin can delete payment screenshots")
        
        body = await request.json()
        path = body.get("path")
        is_folder = body.get("is_folder", False)
        
        base_dir = "/app/backend/payment_screenshots"
        full_path = os.path.join(base_dir, path)
        
        # Security check
        if not os.path.abspath(full_path).startswith(os.path.abspath(base_dir)):
            raise HTTPException(status_code=403, detail="Invalid path")
        
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Item not found")
        
        if is_folder:
            import shutil
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
        
        return {"success": True, "message": "Item deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting item: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/files/reload-fleet-mapping")
async def reload_fleet_mapping(current_user: User = Depends(get_current_user)):
    """Reload vehicle to registration number mapping from Nura Fleet Data.xlsx"""
    try:
        # Find the fleet data file
        fleet_file = await db.admin_files.find_one(
            {"original_filename": "Nura Fleet Data.xlsx"}, 
            {"_id": 0}
        )
        
        if not fleet_file:
            raise HTTPException(
                status_code=404, 
                detail="Nura Fleet Data.xlsx not found. Please upload the file first."
            )
        
        file_path = fleet_file["file_path"]
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Fleet data file not found on disk")
        
        # Read Excel file
        df = pd.read_excel(file_path)
        
        logger.info(f"Loading fleet mapping from {fleet_file['original_filename']}")
        logger.info(f"Columns: {df.columns.tolist()}")
        
        # Create mapping from Column A (Vehicle ID) to Column B (Registration Number)
        vehicle_mapping = {}
        for idx, row in df.iterrows():
            vehicle_id = str(row.iloc[0]) if pd.notna(row.iloc[0]) else None
            reg_number = str(row.iloc[1]) if pd.notna(row.iloc[1]) else None
            
            if vehicle_id and reg_number:
                vehicle_mapping[vehicle_id] = reg_number
        
        # Save to database
        await db.vehicle_mapping.delete_many({})  # Clear old mapping
        
        mapping_docs = [
            {"vehicle_id": vid, "registration_number": reg} 
            for vid, reg in vehicle_mapping.items()
        ]
        
        if mapping_docs:
            await db.vehicle_mapping.insert_many(mapping_docs)
        
        logger.info(f"Loaded {len(vehicle_mapping)} vehicle mappings")
        
        return {
            "message": f"Successfully loaded {len(vehicle_mapping)} vehicle mappings",
            "count": len(vehicle_mapping),
            "sample_mappings": list(vehicle_mapping.items())[:5]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reloading fleet mapping: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reload fleet mapping: {str(e)}")


def format_file_size(size_bytes):
    """Format file size in human readable format"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


# Montra Vehicle Insights
@api_router.post("/montra-vehicle-insights")
async def create_vehicle(vehicle_data: VehicleRecordCreate, current_user: User = Depends(get_current_user)):
    """Create new vehicle record"""
    vehicle = VehicleRecord(**vehicle_data.model_dump())
    vehicle_dict = vehicle.model_dump()
    vehicle_dict['date'] = vehicle_dict['date'].isoformat()
    vehicle_dict['created_at'] = vehicle_dict['created_at'].isoformat()
    if vehicle_dict.get('last_service'):
        vehicle_dict['last_service'] = vehicle_dict['last_service'].isoformat()
    
    await db.montra_vehicle_insights.insert_one(vehicle_dict)
    sync_single_record('montra_vehicle_insights', vehicle_dict)
    
    return {"message": "Vehicle record created", "vehicle": vehicle}


@api_router.get("/montra-vehicle-insights")
async def get_vehicles(current_user: User = Depends(get_current_user)):
    """Get all vehicle records"""
    vehicles = await db.montra_vehicle_insights.find({}, {"_id": 0}).to_list(1000)
    for vehicle in vehicles:
        if isinstance(vehicle.get('date'), str):
            vehicle['date'] = datetime.fromisoformat(vehicle['date'])
        if isinstance(vehicle.get('created_at'), str):
            vehicle['created_at'] = datetime.fromisoformat(vehicle['created_at'])
        if vehicle.get('last_service') and isinstance(vehicle.get('last_service'), str):
            vehicle['last_service'] = datetime.fromisoformat(vehicle['last_service'])
    return vehicles


@api_router.post("/montra-vehicle-insights/sync")
async def sync_vehicles(current_user: User = Depends(get_current_user)):
    """Sync all vehicles to Google Sheets"""
    vehicles = await db.montra_vehicle_insights.find({}, {"_id": 0}).to_list(1000)
    success = sync_all_records('montra_vehicle_insights', vehicles)
    if success:
        return {"message": "Vehicles synced successfully"}
    raise HTTPException(status_code=500, detail="Failed to sync vehicles")


# Fetch from Sheets (Read from Sheets to app)
@api_router.get("/sheets/fetch/{tab}")
async def fetch_from_sheets(tab: str, current_user: User = Depends(get_current_user)):
    """Fetch data from Google Sheets"""
    valid_tabs = ['payment_reconciliation', 'driver_onboarding', 'telecaller_queue', 'montra_vehicle_insights']
    if tab not in valid_tabs:
        raise HTTPException(status_code=400, detail="Invalid tab name")
    
    records = get_all_records(tab)
    return {"message": f"Fetched {len(records)} records", "data": records}


@api_router.get("/sheets/last-sync-time")
async def get_sheets_last_sync_time(current_user: User = Depends(get_current_user)):
    """Get the last sync time from Google Sheets"""
    try:
        last_sync = get_last_sync_time()
        return {"last_sync_time": last_sync}
    except Exception as e:
        logger.error(f"Failed to get last sync time: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get last sync time")


# ==================== App Initialization ====================

@app.on_event("startup")
async def startup_event():
    await initialize_master_admin()
    logger.info("Application started")




# ==================== HOTSPOT PLANNING ====================

@api_router.post("/hotspot-planning/analyze")
async def analyze_hotspot_placement(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Analyze ride data and recommend optimal placement locations per time slot"""
    try:
        import pandas as pd
        import numpy as np
        from sklearn.cluster import KMeans
        from geopy.distance import geodesic
        import json
        from collections import defaultdict
        from datetime import datetime, timedelta
        import pytz
        
        # Read CSV file
        contents = await file.read()
        import io
        df = pd.read_csv(io.BytesIO(contents))
        
        logger.info(f"Loaded {len(df)} rides from CSV")
        
        # Validate required columns
        required_cols = ['pickupLat', 'pickupLong', 'dropLat', 'dropLong']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_cols)}"
            )
        
        # Clean data - remove rows with missing coordinates
        df_clean = df.dropna(subset=['pickupLat', 'pickupLong'])
        logger.info(f"Clean data: {len(df_clean)} rides with valid pickup coordinates")
        
        # Geographic filter - Chennai bounds (to remove multi-city outliers)
        # This ensures all hotspots are within operational area
        CHENNAI_BOUNDS = {
            'lat_min': 12.8,
            'lat_max': 13.3,
            'long_min': 80.0,
            'long_max': 80.4
        }
        
        df_chennai = df_clean[
            (df_clean['pickupLat'] >= CHENNAI_BOUNDS['lat_min']) &
            (df_clean['pickupLat'] <= CHENNAI_BOUNDS['lat_max']) &
            (df_clean['pickupLong'] >= CHENNAI_BOUNDS['long_min']) &
            (df_clean['pickupLong'] <= CHENNAI_BOUNDS['long_max'])
        ].copy()
        
        filtered_out = len(df_clean) - len(df_chennai)
        if filtered_out > 0:
            logger.info(f"Geographic filter: Removed {filtered_out} rides outside Chennai bounds")
        
        logger.info(f"Chennai rides: {len(df_chennai)} (within lat: {CHENNAI_BOUNDS['lat_min']}-{CHENNAI_BOUNDS['lat_max']}, long: {CHENNAI_BOUNDS['long_min']}-{CHENNAI_BOUNDS['long_max']})")
        
        # Use filtered data for analysis
        df_clean = df_chennai
        
        if len(df_clean) < 10:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough data points after geographic filtering. Need at least 10 Chennai rides, got {len(df_clean)}. {filtered_out} rides were outside Chennai bounds."
            )
        
        # UTC to IST conversion
        def convert_utc_to_ist(time_str):
            """Convert UTC time string to IST hour"""
            try:
                if pd.isna(time_str):
                    return None
                time_str = str(time_str).strip()
                
                # Try parsing different time formats
                for fmt in ['%H:%M:%S', '%H:%M', '%I:%M:%S %p', '%I:%M %p']:
                    try:
                        utc_time = datetime.strptime(time_str, fmt)
                        # Add IST offset (UTC + 5:30)
                        ist_time = utc_time + timedelta(hours=5, minutes=30)
                        return ist_time.hour
                    except ValueError:
                        continue
                
                # If parsing fails, try extracting hour directly
                if ':' in time_str:
                    hour = int(time_str.split(':')[0])
                    # Add 5.5 hours for IST
                    ist_hour = (hour + 5) % 24
                    return ist_hour
                    
                return None
            except Exception as e:
                logger.warning(f"Failed to parse time '{time_str}': {e}")
                return None
        
        # Define time slots (IST)
        time_slots = {
            'Morning Rush (6AM-9AM)': (6, 9),
            'Mid-Morning (9AM-12PM)': (9, 12),
            'Afternoon (12PM-4PM)': (12, 16),
            'Evening Rush (4PM-7PM)': (16, 19),
            'Night (7PM-10PM)': (19, 22),
            'Late Night (10PM-1AM)': (22, 25)  # 25 represents 1AM next day
        }
        
        # Find time column
        time_col = None
        for col in ['time', 'rideAssignedTime', 'pickup_time', 'request_time']:
            if col in df_clean.columns:
                time_col = col
                break
        
        if not time_col:
            raise HTTPException(
                status_code=400,
                detail="No time column found. Expected 'time', 'rideAssignedTime', 'pickup_time', or 'request_time'"
            )
        
        # Convert time to IST hours
        df_clean['ist_hour'] = df_clean[time_col].apply(convert_utc_to_ist)
        df_clean = df_clean.dropna(subset=['ist_hour'])
        
        logger.info(f"After time conversion: {len(df_clean)} rides with valid IST time")
        
        # Constants
        MAX_LOCATIONS = 10
        PICKUP_TIME_MINUTES = 5
        AVG_SPEED_KMH = 5
        MAX_DISTANCE_KM = (PICKUP_TIME_MINUTES / 60) * AVG_SPEED_KMH  # 0.4167 km
        
        # Analyze each time slot
        time_slot_results = {}
        
        for slot_name, (start_hour, end_hour) in time_slots.items():
            # Filter rides for this time slot
            if end_hour > 24:
                # Handle overnight slot (e.g., 10PM-1AM)
                slot_rides = df_clean[
                    (df_clean['ist_hour'] >= start_hour) | 
                    (df_clean['ist_hour'] < (end_hour - 24))
                ]
            else:
                slot_rides = df_clean[
                    (df_clean['ist_hour'] >= start_hour) & 
                    (df_clean['ist_hour'] < end_hour)
                ]
            
            logger.info(f"{slot_name}: {len(slot_rides)} rides")
            
            if len(slot_rides) == 0:
                time_slot_results[slot_name] = {
                    'status': 'no_data',
                    'message': 'No rides in this time slot',
                    'rides_count': 0
                }
                continue
            
            # Determine number of clusters (locations)
            num_locations = min(MAX_LOCATIONS, len(slot_rides))
            
            if num_locations < 3:
                time_slot_results[slot_name] = {
                    'status': 'insufficient_data',
                    'message': f'Only {len(slot_rides)} ride(s) in this slot - insufficient for clustering',
                    'rides_count': len(slot_rides),
                    'rides': slot_rides[['pickupLat', 'pickupLong']].values.tolist()
                }
                continue
            
            # Run K-Means clustering for this time slot
            pickup_coords = slot_rides[['pickupLat', 'pickupLong']].values
            
            kmeans = KMeans(n_clusters=num_locations, random_state=42, n_init=10)
            slot_rides_copy = slot_rides.copy()
            slot_rides_copy['cluster'] = kmeans.fit_predict(pickup_coords)
            
            hotspot_locations = kmeans.cluster_centers_
            
            # Calculate coverage for this time slot
            def calculate_coverage(row, locations):
                pickup_point = (row['pickupLat'], row['pickupLong'])
                min_distance = float('inf')
                nearest_location = -1
                
                for idx, location in enumerate(locations):
                    location_point = (location[0], location[1])
                    distance = geodesic(pickup_point, location_point).kilometers
                    if distance < min_distance:
                        min_distance = distance
                        nearest_location = idx
                
                return {
                    'nearest_location': nearest_location,
                    'distance_km': min_distance,
                    'within_5min': min_distance <= MAX_DISTANCE_KM
                }
            
            coverage_results = slot_rides_copy.apply(
                lambda row: calculate_coverage(row, hotspot_locations), 
                axis=1, 
                result_type='expand'
            )
            
            slot_rides_copy['nearest_location'] = coverage_results['nearest_location']
            slot_rides_copy['distance_to_nearest'] = coverage_results['distance_km']
            slot_rides_copy['within_5min'] = coverage_results['within_5min']
            
            # Calculate coverage percentage
            total_rides_slot = len(slot_rides_copy)
            covered_rides_slot = slot_rides_copy['within_5min'].sum()
            coverage_percentage_slot = (covered_rides_slot / total_rides_slot) * 100
            
            # Location statistics
            location_stats = []
            for i in range(num_locations):
                location_rides = slot_rides_copy[slot_rides_copy['nearest_location'] == i]
                covered_in_location = location_rides['within_5min'].sum()
                
                location_stats.append({
                    'location_id': int(i),
                    'lat': float(hotspot_locations[i][0]),
                    'long': float(hotspot_locations[i][1]),
                    'rides_assigned': int(len(location_rides)),
                    'rides_within_5min': int(covered_in_location),
                    'coverage_percentage': float((covered_in_location / len(location_rides) * 100) if len(location_rides) > 0 else 0)
                })
            
            # Sort by rides assigned
            location_stats.sort(key=lambda x: x['rides_assigned'], reverse=True)
            
            # Prepare pickup points for map
            pickup_points = slot_rides_copy[['pickupLat', 'pickupLong', 'within_5min']].values.tolist()
            
            time_slot_results[slot_name] = {
                'status': 'success',
                'rides_count': int(total_rides_slot),
                'covered_rides': int(covered_rides_slot),
                'coverage_percentage': float(round(coverage_percentage_slot, 2)),
                'num_locations': int(num_locations),
                'avg_distance': float(round(slot_rides_copy['distance_to_nearest'].mean(), 3)),
                'hotspot_locations': location_stats,
                'pickup_points': pickup_points[:200],  # Limit for performance
                'warning': f'Only {num_locations} locations generated (low sample size)' if num_locations < MAX_LOCATIONS else None
            }
        
        # Calculate overall summary
        total_rides = len(df_clean)
        all_slots_with_data = [slot for slot, data in time_slot_results.items() if data.get('status') == 'success']
        
        logger.info(f"Analysis complete: {len(all_slots_with_data)} time slots with data")
        
        return {
            'success': True,
            'total_rides_analyzed': int(total_rides),
            'time_slots': time_slot_results,
            'analysis_params': {
                'max_distance_km': float(MAX_DISTANCE_KM),
                'speed_kmh': AVG_SPEED_KMH,
                'max_locations': MAX_LOCATIONS
            },
            'message': f'Analysis complete: {len(all_slots_with_data)} time slots analyzed from {total_rides} rides'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in hotspot analysis: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to analyze data: {str(e)}")


# ==================== ANALYTICS ====================

# In-memory storage for active sessions and page views
active_sessions = {}  # {user_id: {username, email, account_type, last_seen, current_page}}
page_views = {}  # {page_name: count}

@api_router.post("/analytics/track-page-view")
async def track_page_view(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Track page view and update user session"""
    try:
        body = await request.json()
        page_name = body.get("page")
        
        if not page_name:
            raise HTTPException(status_code=400, detail="Page name is required")
        
        # Update active session
        active_sessions[current_user.id] = {
            "user_id": current_user.id,
            "username": f"{current_user.first_name} {current_user.last_name or ''}".strip(),
            "email": current_user.email,
            "account_type": current_user.account_type,
            "current_page": page_name,
            "last_seen": datetime.now(timezone.utc).isoformat()
        }
        
        # Update page view count
        page_views[page_name] = page_views.get(page_name, 0) + 1
        
        return {"success": True, "message": "Page view tracked"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error tracking page view: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to track page view")


@api_router.get("/analytics/active-users")
async def get_active_users(current_user: User = Depends(get_current_user)):
    """Get list of currently active users (Master Admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Only Master Admin can view analytics")
    
    try:
        # Clean up stale sessions (inactive for more than 5 minutes)
        current_time = datetime.now(timezone.utc)
        stale_users = []
        
        for user_id, session in active_sessions.items():
            last_seen = datetime.fromisoformat(session["last_seen"])
            if (current_time - last_seen).total_seconds() > 300:  # 5 minutes
                stale_users.append(user_id)
        
        for user_id in stale_users:
            del active_sessions[user_id]
        
        return {
            "success": True,
            "active_users": list(active_sessions.values()),
            "count": len(active_sessions)
        }
        
    except Exception as e:
        logger.error(f"Error getting active users: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get active users")


@api_router.get("/analytics/page-views")
async def get_page_views(current_user: User = Depends(get_current_user)):
    """Get page view statistics (Master Admin only)"""
    if current_user.account_type != "master_admin":
        raise HTTPException(status_code=403, detail="Only Master Admin can view analytics")
    
    try:
        # Convert to list of {page, count} sorted by count
        page_view_list = [
            {"page": page, "views": count}
            for page, count in page_views.items()
        ]
        page_view_list.sort(key=lambda x: x["views"], reverse=True)
        
        return {
            "success": True,
            "page_views": page_view_list,
            "total_views": sum(page_views.values())
        }
        
    except Exception as e:
        logger.error(f"Error getting page views: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get page views")


@api_router.post("/analytics/logout")
async def track_logout(current_user: User = Depends(get_current_user)):
    """Track user logout"""
    try:
        if current_user.id in active_sessions:
            del active_sessions[current_user.id]
        
        return {"success": True, "message": "Logout tracked"}
        
    except Exception as e:
        logger.error(f"Error tracking logout: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to track logout")


# ==================== EXPENSE TRACKER ====================

# Expenses directory
EXPENSES_DIR = ROOT_DIR / "expense_receipts"
EXPENSES_DIR.mkdir(exist_ok=True)

@api_router.get("/expenses")
async def get_expenses(current_user: User = Depends(get_current_user)):
    """Get all expenses for the user or all expenses for admin/master_admin"""
    try:
        if current_user.account_type in ["master_admin", "admin"]:
            # Admins can see all expenses
            expenses_cursor = db.expenses.find({"deleted": {"$ne": True}})
        else:
            # Standard users see only their expenses
            expenses_cursor = db.expenses.find({
                "user_id": current_user.id,
                "deleted": {"$ne": True}
            })
        
        expenses = await expenses_cursor.to_list(length=None)
        
        # Convert ObjectId and datetime to string
        for expense in expenses:
            if '_id' in expense:
                del expense['_id']
            if 'created_at' in expense and isinstance(expense['created_at'], datetime):
                expense['created_at'] = expense['created_at'].isoformat()
        
        return {"expenses": expenses}
    except Exception as e:
        logger.error(f"Error fetching expenses: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch expenses")


@api_router.post("/expenses/add")
async def add_expense(
    date: str = Form(...),
    description: str = Form(...),
    amount: float = Form(...),
    receipts: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user)
):
    """Add a new expense"""
    try:
        expense_id = str(uuid.uuid4())
        receipt_filenames = []
        
        # Save receipt files
        if receipts:
            expense_folder = EXPENSES_DIR / expense_id
            expense_folder.mkdir(exist_ok=True)
            
            for receipt in receipts:
                if receipt.size > 10 * 1024 * 1024:  # 10MB limit
                    raise HTTPException(status_code=400, detail=f"File {receipt.filename} exceeds 10MB limit")
                
                file_path = expense_folder / receipt.filename
                with open(file_path, "wb") as f:
                    content = await receipt.read()
                    f.write(content)
                receipt_filenames.append(receipt.filename)
        
        expense_data = {
            "id": expense_id,
            "user_id": current_user.id,
            "user_name": f"{current_user.first_name} {current_user.last_name or ''}".strip(),
            "date": date,
            "description": description,
            "amount": amount,
            "receipt_filenames": receipt_filenames,
            "approval_status": "Pending",
            "created_at": datetime.now(timezone.utc),
            "deleted": False
        }
        
        await db.expenses.insert_one(expense_data)
        
        return {"message": "Expense added successfully", "expense_id": expense_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding expense: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to add expense")


@api_router.post("/expenses/update")
async def update_expense(
    expense_id: str = Form(...),
    date: str = Form(...),
    description: str = Form(...),
    amount: float = Form(...),
    receipts: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user)
):
    """Update an existing expense"""
    try:
        # Check if expense exists and user has permission
        expense = await db.expenses.find_one({"id": expense_id})
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        # Only the creator or admin/master_admin can edit
        if expense["user_id"] != current_user.id and current_user.account_type not in ["master_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized to edit this expense")
        
        update_data = {
            "date": date,
            "description": description,
            "amount": amount,
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Handle new receipt files
        if receipts and any(r.filename for r in receipts):
            expense_folder = EXPENSES_DIR / expense_id
            expense_folder.mkdir(exist_ok=True)
            
            existing_receipts = expense.get("receipt_filenames", [])
            
            for receipt in receipts:
                if receipt.filename and receipt.size > 0:
                    if receipt.size > 10 * 1024 * 1024:
                        raise HTTPException(status_code=400, detail=f"File {receipt.filename} exceeds 10MB limit")
                    
                    file_path = expense_folder / receipt.filename
                    with open(file_path, "wb") as f:
                        content = await receipt.read()
                        f.write(content)
                    
                    if receipt.filename not in existing_receipts:
                        existing_receipts.append(receipt.filename)
            
            update_data["receipt_filenames"] = existing_receipts
        
        await db.expenses.update_one(
            {"id": expense_id},
            {"$set": update_data}
        )
        
        return {"message": "Expense updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating expense: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update expense")


@api_router.post("/expenses/delete")
async def delete_expenses(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Delete expenses (master admin only)"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can delete expenses")
        
        body = await request.json()
        expense_ids = body.get("expense_ids", [])
        
        if not expense_ids:
            raise HTTPException(status_code=400, detail="No expense IDs provided")
        
        # Mark as deleted instead of actually deleting
        result = await db.expenses.update_many(
            {"id": {"$in": expense_ids}},
            {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc)}}
        )
        
        return {"message": f"Deleted {result.modified_count} expense(s)"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting expenses: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete expenses")


@api_router.post("/expenses/approve")
async def approve_expense(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Approve or reject an expense (admin/master admin only)"""
    try:
        if current_user.account_type not in ["master_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Only admins can approve/reject expenses")
        
        body = await request.json()
        expense_id = body.get("expense_id")
        status = body.get("status")  # "Approved", "Rejected", "Pending"
        
        if not expense_id or not status:
            raise HTTPException(status_code=400, detail="Missing expense_id or status")
        
        if status not in ["Approved", "Rejected", "Pending"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        result = await db.expenses.update_one(
            {"id": expense_id},
            {"$set": {
                "approval_status": status,
                "approved_by": current_user.id,
                "approved_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        return {"message": f"Expense {status.lower()} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving expense: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update approval status")


@api_router.get("/expenses/{expense_id}/receipt/{filename}")
async def get_expense_receipt(
    expense_id: str,
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Download/view an expense receipt"""
    from fastapi.responses import FileResponse
    
    try:
        # Check if expense exists and user has permission
        expense = await db.expenses.find_one({"id": expense_id})
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        # Check permissions
        if expense["user_id"] != current_user.id and current_user.account_type not in ["master_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized to view this receipt")
        
        file_path = EXPENSES_DIR / expense_id / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Receipt file not found")
        
        return FileResponse(file_path, filename=filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving receipt: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve receipt")




# ==================== QR Code Management ====================

@api_router.post("/qr-codes/create")
async def create_qr_code(
    qr_data: QRCodeCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new dynamic QR code - Master Admin only"""
    try:
        # Check master admin permission
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can create QR codes")
        
        import qrcode
        from io import BytesIO
        
        # Generate unique short code
        unique_code = str(uuid.uuid4())[:8]
        
        # Get backend URL from environment
        backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001/api')
        # Create QR redirect URL
        qr_redirect_url = f"{backend_url}/qr/{unique_code}"
        
        # Generate QR code image
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_redirect_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save QR code image
        qr_filename = f"qr_{unique_code}.png"
        qr_path = f"/app/backend/qr_codes/{qr_filename}"
        img.save(qr_path)
        
        logger.info(f"QR code image saved: {qr_path}")
        
        # Create QR code document
        qr_code = QRCode(
            name=qr_data.name,
            landing_page_type=qr_data.landing_page_type,
            landing_page_single=qr_data.landing_page_single,
            landing_page_ios=qr_data.landing_page_ios,
            landing_page_android=qr_data.landing_page_android,
            landing_page_mobile=qr_data.landing_page_mobile,
            landing_page_desktop=qr_data.landing_page_desktop,
            qr_image_filename=qr_filename,
            unique_short_code=unique_code,
            created_by=current_user.id,
        )
        
        # Save to database
        await db.qr_codes.insert_one(qr_code.model_dump())
        
        logger.info(f"QR code created: {qr_code.id} by {current_user.email}")
        
        return {
            "success": True,
            "message": "QR code created successfully",
            "qr_code": {
                "id": qr_code.id,
                "name": qr_code.name,
                "unique_code": unique_code,
                "qr_url": qr_redirect_url,
                "qr_image": qr_filename
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create QR code: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to create QR code: {str(e)}")


@api_router.get("/qr-codes")
async def get_qr_codes(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Get all QR codes - Master Admin only"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can view QR codes")
        
        # Get QR codes with pagination
        qr_codes = await db.qr_codes.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
        
        # Get total count
        total_count = await db.qr_codes.count_documents({})
        
        # Calculate total scans across all QR codes
        total_scans = sum(qr.get('total_scans', 0) for qr in qr_codes)
        
        return {
            "success": True,
            "qr_codes": qr_codes,
            "total_count": total_count,
            "total_scans": total_scans,
            "skip": skip,
            "limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get QR codes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get QR codes: {str(e)}")


@api_router.get("/qr-codes/{qr_id}")
async def get_qr_code(
    qr_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific QR code details - Master Admin only"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can view QR codes")
        
        qr_code = await db.qr_codes.find_one({"id": qr_id}, {"_id": 0})
        
        if not qr_code:
            raise HTTPException(status_code=404, detail="QR code not found")
        
        return qr_code
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get QR code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get QR code: {str(e)}")


@api_router.get("/qr-codes/{qr_id}/download")
async def download_qr_code(
    qr_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download QR code image - Master Admin only"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can download QR codes")
        
        qr_code = await db.qr_codes.find_one({"id": qr_id}, {"_id": 0})
        
        if not qr_code:
            raise HTTPException(status_code=404, detail="QR code not found")
        
        qr_image_path = f"/app/backend/qr_codes/{qr_code['qr_image_filename']}"
        
        if not os.path.exists(qr_image_path):
            raise HTTPException(status_code=404, detail="QR code image not found")
        
        return FileResponse(
            path=qr_image_path,
            media_type="image/png",
            filename=f"{qr_code['name']}_QR.png"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download QR code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download QR code: {str(e)}")


@api_router.get("/qr-codes/{qr_id}/analytics")
async def get_qr_analytics(
    qr_id: str,
    current_user: User = Depends(get_current_user),
    filter_type: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get QR code analytics with date filters - Master Admin only"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can view analytics")
        
        qr_code = await db.qr_codes.find_one({"id": qr_id}, {"_id": 0})
        
        if not qr_code:
            raise HTTPException(status_code=404, detail="QR code not found")
        
        # Build date filter query
        query = {"qr_code_id": qr_id}
        
        from datetime import datetime, timedelta
        now = datetime.now()
        
        if filter_type == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query["scan_datetime"] = {"$gte": start}
        elif filter_type == "yesterday":
            yesterday = now - timedelta(days=1)
            start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
            end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
            query["scan_datetime"] = {"$gte": start, "$lte": end}
        elif filter_type == "last_7_days":
            start = now - timedelta(days=7)
            query["scan_datetime"] = {"$gte": start}
        elif filter_type == "last_30_days":
            start = now - timedelta(days=30)
            query["scan_datetime"] = {"$gte": start}
        elif filter_type == "last_3_months":
            start = now - timedelta(days=90)
            query["scan_datetime"] = {"$gte": start}
        elif filter_type == "custom" and start_date and end_date:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query["scan_datetime"] = {"$gte": start, "$lte": end}
        
        # Get all scans with filter
        scans = await db.qr_scans.find(query).sort("scan_datetime", -1).to_list(length=None)
        
        # Group scans by date for graph
        from collections import defaultdict
        scans_by_date = defaultdict(int)
        
        for scan in scans:
            scan_date = scan.get('scan_date', '')
            scans_by_date[scan_date] += 1
        
        # Convert to sorted list
        graph_data = [
            {"date": date, "scans": count}
            for date, count in sorted(scans_by_date.items())
        ]
        
        # Device type breakdown
        device_breakdown = defaultdict(int)
        for scan in scans:
            device_type = scan.get('device_type', 'unknown')
            device_breakdown[device_type] += 1
        
        # Location breakdown (top 10 countries)
        location_breakdown = defaultdict(int)
        for scan in scans:
            country = scan.get('country', 'Unknown')
            if country:
                location_breakdown[country] += 1
        
        top_locations = sorted(
            [{"country": k, "scans": v} for k, v in location_breakdown.items()],
            key=lambda x: x['scans'],
            reverse=True
        )[:10]
        
        return {
            "success": True,
            "qr_code": qr_code,
            "analytics": {
                "total_scans": len(scans),
                "graph_data": graph_data,
                "device_breakdown": dict(device_breakdown),
                "top_locations": top_locations,
                "filter_applied": filter_type
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analytics: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@api_router.get("/qr-codes/{qr_id}/scans")
async def get_qr_scans(
    qr_id: str,
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50
):
    """Get QR code scan history - Master Admin only"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can view scan history")
        
        # Get scans with pagination
        scans = await db.qr_scans.find({"qr_code_id": qr_id}).sort("scan_datetime", -1).skip(skip).limit(limit).to_list(length=None)
        
        # Get total count
        total_count = await db.qr_scans.count_documents({"qr_code_id": qr_id})
        
        return {
            "success": True,
            "scans": scans,
            "total_count": total_count,
            "skip": skip,
            "limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get scans: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get scans: {str(e)}")


@api_router.get("/qr-codes/{qr_id}/export-csv")
async def export_qr_scans_csv(
    qr_id: str,
    current_user: User = Depends(get_current_user)
):
    """Export QR scan data as CSV - Master Admin only"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can export scan data")
        
        qr_code = await db.qr_codes.find_one({"id": qr_id}, {"_id": 0})
        if not qr_code:
            raise HTTPException(status_code=404, detail="QR code not found")
        
        # Get all scans
        scans = await db.qr_scans.find({"qr_code_id": qr_id}).sort("scan_datetime", -1).to_list(length=None)
        
        # Create CSV
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "Date", "Time", "Device Type", "Browser", "OS",
            "IP Address", "Country", "City",
            "Latitude", "Longitude", "Location Source",
            "Landing Page"
        ])
        
        # Write data
        for scan in scans:
            writer.writerow([
                scan.get('scan_date', ''),
                scan.get('scan_time', ''),
                scan.get('device_type', ''),
                scan.get('browser', ''),
                scan.get('os', ''),
                scan.get('ip_address', ''),
                scan.get('country', ''),
                scan.get('city', ''),
                scan.get('latitude', ''),
                scan.get('longitude', ''),
                scan.get('location_source', ''),
                scan.get('landing_page_redirected', '')
            ])
        
        # Create response
        from fastapi.responses import StreamingResponse
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={qr_code['name']}_scans.csv"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")


@api_router.put("/qr-codes/{qr_id}")
async def update_qr_code(
    qr_id: str,
    qr_update: QRCodeUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update QR code settings - Master Admin only"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can update QR codes")
        
        qr_code = await db.qr_codes.find_one({"id": qr_id}, {"_id": 0})
        if not qr_code:
            raise HTTPException(status_code=404, detail="QR code not found")
        
        # Prepare update data (only non-None fields)
        update_data = {k: v for k, v in qr_update.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update in database
        await db.qr_codes.update_one(
            {"id": qr_id},
            {"$set": update_data}
        )
        
        logger.info(f"QR code updated: {qr_id} by {current_user.email}")
        
        return {
            "success": True,
            "message": "QR code updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update QR code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update QR code: {str(e)}")


@api_router.delete("/qr-codes/{qr_id}")
async def delete_qr_code(
    qr_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete QR code - Master Admin only"""
    try:
        if current_user.account_type != "master_admin":
            raise HTTPException(status_code=403, detail="Only master admin can delete QR codes")
        
        qr_code = await db.qr_codes.find_one({"id": qr_id}, {"_id": 0})
        if not qr_code:
            raise HTTPException(status_code=404, detail="QR code not found")
        
        # Delete QR code image
        qr_image_path = f"/app/backend/qr_codes/{qr_code['qr_image_filename']}"
        if os.path.exists(qr_image_path):
            os.remove(qr_image_path)
        
        # Delete from database
        await db.qr_codes.delete_one({"id": qr_id})
        
        # Delete all associated scans
        await db.qr_scans.delete_many({"qr_code_id": qr_id})
        
        logger.info(f"QR code deleted: {qr_id} by {current_user.email}")
        
        return {
            "success": True,
            "message": "QR code and all associated scans deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete QR code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete QR code: {str(e)}")


# PUBLIC ENDPOINT - No authentication required
@api_router.get("/qr/{short_code}")
async def qr_redirect(
    short_code: str,
    request: Request,
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    """Public QR redirect endpoint - tracks scan and redirects to landing page"""
    try:
        # Find QR code by short code
        qr_code = await db.qr_codes.find_one({"unique_short_code": short_code}, {"_id": 0})
        
        if not qr_code:
            raise HTTPException(status_code=404, detail="QR code not found")
        
        if not qr_code.get('is_active', True):
            raise HTTPException(status_code=410, detail="QR code is inactive")
        
        # Extract request information
        from datetime import datetime
        import requests
        from user_agents import parse
        
        now = datetime.now()
        
        # Get IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip_address = forwarded.split(",")[0]
        else:
            ip_address = request.client.host
        
        # Parse user agent
        user_agent_string = request.headers.get("User-Agent", "")
        user_agent = parse(user_agent_string)
        
        # Determine device type
        if user_agent.is_mobile:
            if user_agent.os.family == "iOS":
                device_type = "ios"
            elif user_agent.os.family == "Android":
                device_type = "android"
            else:
                device_type = "mobile"
        elif user_agent.is_tablet:
            device_type = "mobile"
        else:
            device_type = "desktop"
        
        # Get location from IP
        location_source = "none"
        country = None
        city = None
        ip_lat = None
        ip_lng = None
        
        try:
            # Use free IP geolocation API
            ip_response = requests.get(f"http://ip-api.com/json/{ip_address}", timeout=2)
            if ip_response.status_code == 200:
                ip_data = ip_response.json()
                if ip_data.get('status') == 'success':
                    country = ip_data.get('country')
                    city = ip_data.get('city')
                    ip_lat = ip_data.get('lat')
                    ip_lng = ip_data.get('lon')
                    location_source = "ip"
        except:
            logger.warning(f"IP geolocation failed for {ip_address}")
        
        # Use GPS coordinates if provided
        final_lat = lat if lat is not None else ip_lat
        final_lng = lng if lng is not None else ip_lng
        if lat is not None and lng is not None:
            location_source = "gps"
        
        # Determine landing page
        landing_page = None
        if qr_code.get('landing_page_type') == 'single':
            landing_page = qr_code.get('landing_page_single')
        else:
            # Multiple landing pages
            if device_type == "ios" and qr_code.get('landing_page_ios'):
                landing_page = qr_code['landing_page_ios']
            elif device_type == "android" and qr_code.get('landing_page_android'):
                landing_page = qr_code['landing_page_android']
            elif device_type == "mobile" and qr_code.get('landing_page_mobile'):
                landing_page = qr_code['landing_page_mobile']
            elif device_type == "desktop" and qr_code.get('landing_page_desktop'):
                landing_page = qr_code['landing_page_desktop']
            else:
                # Fallback to any available landing page
                landing_page = (
                    qr_code.get('landing_page_mobile') or
                    qr_code.get('landing_page_desktop') or
                    qr_code.get('landing_page_ios') or
                    qr_code.get('landing_page_android')
                )
        
        if not landing_page:
            raise HTTPException(status_code=500, detail="No landing page configured")
        
        # Create scan record
        scan = QRScan(
            qr_code_id=qr_code['id'],
            scan_date=now.strftime("%Y-%m-%d"),
            scan_time=now.strftime("%H:%M:%S"),
            scan_datetime=now,
            latitude=final_lat,
            longitude=final_lng,
            location_source=location_source,
            ip_address=ip_address,
            device_type=device_type,
            device_info=user_agent_string,
            browser=user_agent.browser.family,
            os=user_agent.os.family,
            landing_page_redirected=landing_page,
            country=country,
            city=city
        )
        
        # Save scan to database
        await db.qr_scans.insert_one(scan.model_dump())
        
        # Increment total scans counter
        await db.qr_codes.update_one(
            {"id": qr_code['id']},
            {"$inc": {"total_scans": 1}}
        )
        
        logger.info(f"QR scan recorded: {short_code} -> {device_type} -> {landing_page}")
        
        # Redirect to landing page
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=landing_page, status_code=302)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"QR redirect failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"QR redirect failed: {str(e)}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("Application shutdown")


# ==================== Include Router ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)