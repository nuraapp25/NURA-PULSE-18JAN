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
from google_sheets_sync import sync_user_to_sheets, bulk_sync_users_to_sheets, delete_user_from_sheets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
    """Reset password using temporary password (from forgot password page)"""
    # Find user with temp password
    all_users = await db.users.find({"is_temp_password": True}).to_list(1000)
    
    user_found = None
    for user in all_users:
        if verify_password(reset_data.temp_password, user['password']):
            user_found = user
            break
    
    if not user_found:
        raise HTTPException(status_code=400, detail="Invalid temporary password")
    
    # Update password
    new_hashed_password = hash_password(reset_data.new_password)
    await db.users.update_one(
        {"id": user_found['id']},
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