from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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
            payment['date'] = datetime.fromisoformat(payment['date'])
        if isinstance(payment.get('created_at'), str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
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
    duplicate_action: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Import driver leads from CSV or XLSX with duplicate detection"""
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
            
            # If duplicates found and no action specified, ask user
            if duplicates and not duplicate_action:
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
    print(f"=== BULK UPDATE CALLED ===")
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
    """Get daily lead assignments for telecallers"""
    # Status priority for calling
    # High Priority: New, Interested, Scheduled
    # Medium Priority: Contacted, Documents Pending
    # Low Priority: Not Interested
    # Excluded: Onboarded, Rejected
    
    # Get top 20 leads based on priority
    high_priority = await db.driver_leads.find({
        "status": {"$in": ["New", "Interested", "Scheduled"]}
    }, {"_id": 0}).sort("import_date", 1).to_list(15)
    
    medium_priority = await db.driver_leads.find({
        "status": {"$in": ["Contacted", "Documents Pending"]}
    }, {"_id": 0}).sort("import_date", 1).to_list(10)
    
    # Combine and limit to 20
    all_leads = high_priority + medium_priority
    selected_leads = all_leads[:20]
    
    # Split between 2 telecallers (10 each)
    telecaller1_leads = selected_leads[0:10]
    telecaller2_leads = selected_leads[10:20]
    
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
        "total_assigned": len(selected_leads),
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


@api_router.post("/telecaller-queue/sync")
async def sync_telecaller_queue(current_user: User = Depends(get_current_user)):
    """Sync all telecaller tasks to Google Sheets"""
    tasks = await db.telecaller_queue.find({}, {"_id": 0}).to_list(1000)
    success = sync_all_records('telecaller_queue', tasks)
    if success:
        return {"message": "Telecaller queue synced successfully"}
    raise HTTPException(status_code=500, detail="Failed to sync telecaller queue")


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