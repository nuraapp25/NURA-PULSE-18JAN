"""
Database Models for Nura Pulse Apps
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# ==================== Payment Reconciliation ====================

class PaymentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    amount: float
    payment_method: str  # "UPI", "Card", "Cash", "Net Banking"
    status: str  # "Pending", "Completed", "Failed", "Reconciled"
    reconciled_by: Optional[str] = None
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentRecordCreate(BaseModel):
    transaction_id: str
    amount: float
    payment_method: str
    status: str = "Pending"
    customer_name: Optional[str] = None
    notes: Optional[str] = None


class PaymentFolder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Sep 2025"
    month: str  # e.g., "09"
    year: str  # e.g., "2025"
    monthLabel: str  # e.g., "Sep"
    fullName: str  # e.g., "September"
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str  # user_id who created the folder


class PaymentFolderCreate(BaseModel):
    name: str
    month: str
    year: str
    monthLabel: str
    fullName: str


# ==================== Driver Onboarding ====================

class DriverRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_name: str
    license_number: str
    phone: str
    email: Optional[str] = None
    status: str  # "Applied", "Documents Pending", "Verified", "Onboarded", "Rejected"
    assigned_vehicle: Optional[str] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DriverRecordCreate(BaseModel):
    driver_name: str
    license_number: str
    phone: str
    email: Optional[str] = None
    status: str = "Applied"
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None


# ==================== Telecaller Queue ====================

class TelecallerTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_name: str
    phone: str
    purpose: str  # "Follow-up", "New Lead", "Complaint", "Inquiry"
    priority: str = "Medium"  # "Low", "Medium", "High", "Urgent"
    assigned_to: Optional[str] = None
    status: str  # "Queue", "In Progress", "Completed", "Failed", "Callback"
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    scheduled_time: Optional[datetime] = None
    notes: Optional[str] = None
    callback_requested: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TelecallerTaskCreate(BaseModel):
    customer_name: str
    phone: str
    purpose: str
    priority: str = "Medium"
    scheduled_time: Optional[datetime] = None
    notes: Optional[str] = None


# ==================== Montra Vehicle Insights ====================

class VehicleRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    model: str
    status: str  # "Active", "Maintenance", "Inactive", "Out of Service"
    last_service: Optional[datetime] = None
    mileage: Optional[int] = 0
    driver_assigned: Optional[str] = None
    location: Optional[str] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    registration_number: Optional[str] = None
    fuel_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VehicleRecordCreate(BaseModel):
    vehicle_id: str
    model: str
    status: str = "Active"
    registration_number: Optional[str] = None
    fuel_type: Optional[str] = None
    mileage: Optional[int] = 0
    location: Optional[str] = None
    notes: Optional[str] = None


# ==================== Driver Leads (Enhanced) ====================

class DriverLead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone_number: str
    vehicle: Optional[str] = None
    driving_license: Optional[str] = None
    experience: Optional[str] = None
    interested_ev: Optional[str] = None
    monthly_salary: Optional[str] = None
    residing_chennai: Optional[str] = None
    current_location: Optional[str] = None
    import_date: str
    
    # Lead source tracking
    lead_source: Optional[str] = None
    
    # Stage and Status
    stage: str = "New"  # Stage field (renamed from lead_stage)
    status: str = "New"  # Status field
    
    # Telecaller assignment
    assigned_telecaller: Optional[str] = None
    telecaller_notes: Optional[str] = None
    
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # New document fields
    dl_no: Optional[str] = None  # DL No.
    badge_no: Optional[str] = None  # Badge No.
    aadhar_card: Optional[str] = None  # Aadhar card
    pan_card: Optional[str] = None  # Pan card
    gas_bill: Optional[str] = None  # Gas bill
    bank_passbook: Optional[str] = None  # Bank passbook
    
    # Shift fields
    preferred_shift: Optional[str] = None  # preferred shift
    allotted_shift: Optional[str] = None  # alotted shift
    
    # Vehicle assignment
    default_vehicle: Optional[str] = None  # Default Vehicle
    
    # End date
    end_date: Optional[str] = None  # End Date


class DriverLeadUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    vehicle: Optional[str] = None
    driving_license: Optional[str] = None
    experience: Optional[str] = None
    interested_ev: Optional[str] = None
    monthly_salary: Optional[str] = None
    current_location: Optional[str] = None
    lead_stage: Optional[str] = None
    status: Optional[str] = None
    driver_readiness: Optional[str] = None
    docs_collection: Optional[str] = None
    customer_readiness: Optional[str] = None
    assigned_telecaller: Optional[str] = None
    telecaller_notes: Optional[str] = None
    notes: Optional[str] = None


class BulkLeadStatusUpdate(BaseModel):
    lead_ids: List[str]
    status: str


class BulkLeadDelete(BaseModel):
    lead_ids: List[str]



# ==================== QR Code Management ====================

class QRCodeCreate(BaseModel):
    """Model for creating a new QR code"""
    name: str
    landing_page_type: str  # "single" or "multiple"
    landing_page_single: Optional[str] = None
    landing_page_ios: Optional[str] = None
    landing_page_android: Optional[str] = None
    landing_page_mobile: Optional[str] = None
    landing_page_desktop: Optional[str] = None


class QRCode(BaseModel):
    """Model for QR code stored in database"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    landing_page_type: str
    landing_page_single: Optional[str] = None
    landing_page_ios: Optional[str] = None
    landing_page_android: Optional[str] = None
    landing_page_mobile: Optional[str] = None
    landing_page_desktop: Optional[str] = None
    qr_image_filename: str
    unique_short_code: str
    created_by: str  # user_id
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_scans: int = 0
    is_active: bool = True


class QRCodeUpdate(BaseModel):
    """Model for updating QR code settings"""
    name: Optional[str] = None
    landing_page_type: Optional[str] = None
    landing_page_single: Optional[str] = None
    landing_page_ios: Optional[str] = None
    landing_page_android: Optional[str] = None
    landing_page_mobile: Optional[str] = None
    landing_page_desktop: Optional[str] = None
    is_active: Optional[bool] = None


class QRScan(BaseModel):
    """Model for QR scan event"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    qr_code_id: str
    scan_datetime: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    scan_date: str  # YYYY-MM-DD format
    scan_time: str  # HH:MM:SS format
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_source: str = "none"  # "gps", "ip", "none"
    ip_address: str
    device_type: str  # "ios", "android", "mobile", "desktop", "unknown"
    device_info: str  # Full user agent
    browser: Optional[str] = None
    os: Optional[str] = None
    landing_page_redirected: str
    country: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

