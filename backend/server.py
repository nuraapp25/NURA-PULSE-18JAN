from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, Request
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
    account_type: str  # "master_admin", "admin", "standard"
    status: str = "pending"  # "pending", "active", "rejected", "deleted"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_temp_password: bool = False


class UserCreate(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    email: str
    password: str
    account_type: str  # "admin" or "standard"


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
    if user_data.account_type not in ["admin", "standard"]:
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
    if user_data.account_type not in ["admin", "standard"]:
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
    pending_users = await db.users.count_documents({"status": "pending"})
    pending_resets = await db.password_reset_requests.count_documents({"status": "pending"})
    
    return {
        "total_users": total_users,
        "admin_users": admin_users,
        "standard_users": standard_users,
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
    PaymentRecord, PaymentRecordCreate,
    DriverRecord, DriverRecordCreate,
    TelecallerTask, TelecallerTaskCreate,
    VehicleRecord, VehicleRecordCreate,
    DriverLead, DriverLeadUpdate, BulkLeadStatusUpdate, BulkLeadDelete
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

@api_router.post("/admin/files/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload a file to admin files storage (max 100MB)"""
    try:
        # Check file size (100MB limit)
        MAX_SIZE = 100 * 1024 * 1024  # 100MB in bytes
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        if file_size > MAX_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File size exceeds 100MB limit. File size: {file_size / 1024 / 1024:.2f}MB"
            )
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Save file to disk
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
        with open(file_path, "wb") as f:
            f.write(content)
        
        logger.info(f"File uploaded: {file.filename} ({file_size / 1024:.2f} KB)")
        
        # Save metadata to MongoDB
        file_metadata = {
            "id": file_id,
            "filename": file.filename,
            "original_filename": file.filename,
            "file_path": file_path,
            "file_size": file_size,
            "content_type": file.content_type or "application/octet-stream",
            "uploaded_by": current_user.email,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.admin_files.insert_one(file_metadata)
        
        return {
            "message": "File uploaded successfully",
            "file_id": file_id,
            "filename": file.filename,
            "size": file_size,
            "uploaded_at": file_metadata["uploaded_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


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
        backend_url = os.environ.get('BACKEND_URL', 'https://nurapulse-1.preview.emergentagent.com')
        
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


@api_router.get("/admin/files/get-drivers-vehicles")
async def get_drivers_and_vehicles(
    month: str = Query(..., description="Month name (e.g., Sep)"),
    year: str = Query(..., description="Year (e.g., 2025)"),
    current_user: User = Depends(get_current_user)
):
    """Get drivers and vehicles list for a specific month/year"""
    import pandas as pd
    
    try:
        # Search for files matching the pattern "Drivers List (Mon YYYY).xlsx" and "Vehicles List (Mon YYYY).xlsx"
        month_names = {
            "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
            "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
        }
        
        # Convert month number to name if needed
        month_name = month_names.get(month, month)
        
        drivers_pattern = f"Drivers List ({month_name} {year}).xlsx"
        vehicles_pattern = f"Vehicles List ({month_name} {year}).xlsx"
        
        logger.info(f"Looking for files: {drivers_pattern}, {vehicles_pattern}")
        
        # Find the files
        files = await db.admin_files.find({}).to_list(1000)
        
        drivers_file = None
        vehicles_file = None
        
        for file in files:
            filename = file.get("filename", "")
            if filename == drivers_pattern:
                drivers_file = file
            elif filename == vehicles_pattern:
                vehicles_file = file
        
        result = {
            "success": True,
            "drivers": [],
            "vehicles": [],
            "month": month_name,
            "year": year
        }
        
        # Parse drivers file
        if drivers_file:
            file_path = drivers_file.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    df = pd.read_excel(file_path)
                    # Read from Column B (second column, index 1) instead of Column A (index 0)
                    if len(df.columns) > 1:
                        drivers = df.iloc[:, 1].dropna().astype(str).tolist()
                        drivers = [name.strip() for name in drivers if name.strip() and name.strip().lower() not in ['nan', 'name', 'driver name', 'driver']]
                        result["drivers"] = drivers
                        logger.info(f"Loaded {len(drivers)} drivers from Column B of {drivers_pattern}")
                    else:
                        logger.warning(f"Drivers file {drivers_pattern} does not have Column B")
                except Exception as e:
                    logger.error(f"Error parsing drivers file: {str(e)}")
        else:
            logger.warning(f"Drivers file not found: {drivers_pattern}")
        
        # Parse vehicles file
        if vehicles_file:
            file_path = vehicles_file.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    df = pd.read_excel(file_path)
                    # Read from Column B (second column, index 1) instead of Column A (index 0)
                    if len(df.columns) > 1:
                        vehicles = df.iloc[:, 1].dropna().astype(str).tolist()
                        vehicles = [name.strip() for name in vehicles if name.strip() and name.strip().lower() not in ['nan', 'name', 'vehicle number', 'vehicle']]
                        result["vehicles"] = vehicles
                        logger.info(f"Loaded {len(vehicles)} vehicles from Column B of {vehicles_pattern}")
                    else:
                        logger.warning(f"Vehicles file {vehicles_pattern} does not have Column B")
                except Exception as e:
                    logger.error(f"Error parsing vehicles file: {str(e)}")
        else:
            logger.warning(f"Vehicles file not found: {vehicles_pattern}")
        
        if not result["drivers"] and not result["vehicles"]:
            # Return mock data as fallback
            result["drivers"] = ["Abdul", "Samantha", "Samuel", "Sareena", "Ravi", "John", "Mike"]
            result["vehicles"] = ["TN07CE2222", "TN01AB1234", "KA05CD5678", "AP09EF9012"]
            result["using_mock_data"] = True
            logger.warning(f"No files found for {month_name} {year}, using mock data")
        
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
            system_message="You are an expert at extracting ride payment details from screenshots. Extract data accurately and return structured information."
        ).with_model("openai", "gpt-4o")
        
        extracted_results = []
        processing_errors = []
        temp_files = []
        
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
                    
                    # Read image and encode as base64 for Gemini
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

                    # Send to Gemini
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
            
            # Save extracted records to MongoDB permanently
            if extracted_results:
                try:
                    # Add additional metadata
                    for record in extracted_results:
                        record["user_id"] = current_user.id
                        record["month_year"] = month_year
                        record["driver"] = driver_name or record.get("driver", "N/A")
                        record["vehicle"] = vehicle_number or record.get("vehicle", "N/A")
                        record["platform"] = platform or record.get("platform", "N/A")
                        record["uploaded_at"] = datetime.now().isoformat()
                        record["status"] = "pending"  # pending, reconciled, etc.
                    
                    # Insert into payment_records collection
                    await db.payment_records.insert_many(extracted_results)
                    logger.info(f"Saved {len(extracted_results)} payment records to MongoDB for {month_year}")
                except Exception as e:
                    logger.error(f"Error saving to MongoDB: {str(e)}")
                    # Don't fail the request, just log the error
            
            # Save screenshot files to organized folder structure
            if driver_name and month_year:
                try:
                    # Create directory: payment_screenshots/Sep 2025/DriverName/
                    base_dir = "/app/backend/payment_screenshots"
                    driver_dir = os.path.join(base_dir, month_year, driver_name)
                    os.makedirs(driver_dir, exist_ok=True)
                    
                    # Copy files to the driver folder
                    for file in files:
                        src_path = next((tf for tf in temp_files if file.filename in tf), None)
                        if src_path and os.path.exists(src_path):
                            dest_path = os.path.join(driver_dir, file.filename)
                            import shutil
                            shutil.copy2(src_path, dest_path)
                            logger.info(f"Saved screenshot: {dest_path}")
                except Exception as e:
                    logger.error(f"Error saving screenshots to folder: {str(e)}")
                    # Don't fail the request, just log the error
        
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


@api_router.post("/payment-reconciliation/sync-to-sheets")
async def sync_payment_data_to_sheets(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Sync payment reconciliation data to Google Sheets using Apps Script V2"""
    try:
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
            "action": "sync_from_backend",
            "month_year": month_year,
            "records": records_to_sync
        }
        
        response = requests.post(apps_script_url, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                logger.info(f"Successfully synced {len(records_to_sync)} records to Google Sheets: {month_year}")
                return {"success": True, "message": result.get("message", "Synced successfully")}
            else:
                raise HTTPException(status_code=500, detail=f"Apps Script error: {result.get('message')}")
        else:
            raise HTTPException(status_code=500, detail=f"Apps Script request failed: {response.status_code}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing to Google Sheets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error syncing to Google Sheets: {str(e)}")


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
        records = await db.payment_records.find(query).to_list(length=None)
        
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


@api_router.get("/admin/payment-screenshots/browse")
async def browse_payment_screenshots(
    path: str = "",
    current_user: User = Depends(get_current_user)
):
    """Browse payment screenshots directory structure"""
    try:
        # Only allow Master Admin access
        if current_user.account_type not in ["master_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        base_dir = "/app/backend/payment_screenshots"
        full_path = os.path.join(base_dir, path) if path else base_dir
        
        # Security check - prevent directory traversal
        if not os.path.abspath(full_path).startswith(os.path.abspath(base_dir)):
            raise HTTPException(status_code=403, detail="Invalid path")
        
        if not os.path.exists(full_path):
            return {"folders": [], "files": []}
        
        folders = []
        files = []
        
        for item in os.listdir(full_path):
            item_path = os.path.join(full_path, item)
            if os.path.isdir(item_path):
                folders.append(item)
            else:
                files.append(item)
        
        return {
            "folders": sorted(folders),
            "files": sorted(files)
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
        # Only allow Master Admin access
        if current_user.account_type not in ["master_admin", "admin"]:
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
    """Delete a file or folder from payment screenshots directory"""
    try:
        # Only allow Master Admin access
        if current_user.account_type not in ["master_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
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