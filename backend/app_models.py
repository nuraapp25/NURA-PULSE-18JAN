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


# ==================== Vehicle Service Request ====================

class VehicleServiceRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vin: str  # Vehicle Identification Number
    vehicle_name: str
    request_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Repair Details
    repair_type: str  # Dropdown: Accident, Parts Replacement, etc.
    repair_sub_type: str  # Dropdown: Battery, Charger, Fork Bend, etc.
    description: str  # Long text up to 10000 words
    
    # Dates
    repair_start_date: Optional[datetime] = None
    repair_end_date: Optional[datetime] = None
    
    # Costs & Time
    repair_cost: Optional[float] = None
    repair_time_days: Optional[float] = None  # Auto-calculated
    service_vehicle_downtime_hours: Optional[float] = None  # Auto-calculated
    
    # Status & Responsibility
    repair_status: str = "Pending"  # Pending, In Progress, Completed, etc.
    liability: Optional[str] = None  # Driver, NURA, Manufacturer, Customer
    liability_POC: Optional[str] = None  # Point of Contact
    
    # Service Provider & Recovery
    repair_service_provider: Optional[str] = None
    recovery_amount: Optional[float] = None
    recovery_provider: Optional[str] = None
    
    # Media & Meta
    vehicle_images: List[str] = []  # Array of image URLs/paths
    request_reported_by: Optional[str] = None  # User email/name
    comments: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VehicleServiceRequestCreate(BaseModel):
    vin: str
    vehicle_name: str
    repair_type: str
    repair_sub_type: str
    description: str
    repair_start_date: Optional[datetime] = None
    repair_end_date: Optional[datetime] = None
    repair_cost: Optional[float] = None
    repair_status: str = "Pending"
    liability: Optional[str] = None
    liability_POC: Optional[str] = None
    repair_service_provider: Optional[str] = None
    recovery_amount: Optional[float] = None
    recovery_provider: Optional[str] = None
    vehicle_images: List[str] = []
    request_reported_by: Optional[str] = None
    comments: Optional[str] = None


class VehicleServiceRequestUpdate(BaseModel):
    vin: Optional[str] = None
    vehicle_name: Optional[str] = None
    repair_type: Optional[str] = None
    repair_sub_type: Optional[str] = None
    description: Optional[str] = None
    repair_start_date: Optional[datetime] = None
    repair_end_date: Optional[datetime] = None
    repair_cost: Optional[float] = None
    repair_status: Optional[str] = None
    liability: Optional[str] = None
    liability_POC: Optional[str] = None
    repair_service_provider: Optional[str] = None
    recovery_amount: Optional[float] = None
    recovery_provider: Optional[str] = None
    vehicle_images: Optional[List[str]] = None
    comments: Optional[str] = None


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
    source: Optional[str] = None  # Import source for filtering
    
    # Stage and Status (Stage-based onboarding system)
    stage: str = "S1"  # S1, S2, S3, S4
    status: str = "New"  # Stage-specific status
    
    # Telecaller assignment
    assigned_telecaller: Optional[str] = None
    telecaller_notes: Optional[str] = None
    
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_modified: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
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
    lead_source: Optional[str] = None
    stage: Optional[str] = None
    status: Optional[str] = None
    assigned_telecaller: Optional[str] = None
    telecaller_notes: Optional[str] = None
    notes: Optional[str] = None
    remarks: Optional[str] = None
    dl_no: Optional[str] = None
    badge_no: Optional[str] = None
    aadhar_card: Optional[str] = None
    pan_card: Optional[str] = None
    gas_bill: Optional[str] = None
    bank_passbook: Optional[str] = None
    preferred_shift: Optional[str] = None
    allotted_shift: Optional[str] = None
    default_vehicle: Optional[str] = None
    end_date: Optional[str] = None


class BulkLeadStatusUpdate(BaseModel):
    lead_ids: List[str]
    status: str


class BulkLeadDelete(BaseModel):
    lead_ids: List[str]


class DriverStageSync(BaseModel):
    """Model for syncing driver to next stage"""
    lead_id: str


# ==================== Telecaller Management ====================

class TelecallerProfile(BaseModel):
    """Telecaller Profile Model"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone_number: str
    email: str
    status: str = "active"  # "active", "inactive"
    notes: Optional[str] = None  # General notes about telecaller
    
    # Documents (optional)
    aadhar_card: Optional[str] = None
    pan_card: Optional[str] = None
    address_proof: Optional[str] = None
    
    # Assignment stats
    total_assigned_leads: int = 0
    active_leads: int = 0
    converted_leads: int = 0
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_modified: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None  # Admin user ID


class TelecallerProfileCreate(BaseModel):
    """Model for creating telecaller profile"""
    name: str
    phone_number: str
    email: str
    notes: Optional[str] = None
    status: Optional[str] = "active"
    aadhar_card: Optional[str] = None
    pan_card: Optional[str] = None
    address_proof: Optional[str] = None


class TelecallerProfileUpdate(BaseModel):
    """Model for updating telecaller profile"""
    name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    aadhar_card: Optional[str] = None
    pan_card: Optional[str] = None
    address_proof: Optional[str] = None


class LeadAssignment(BaseModel):
    """Model for assigning leads to telecallers"""
    lead_ids: List[str]
    telecaller_id: str


class LeadReassignment(BaseModel):
    """Model for reassigning leads from one telecaller to another"""
    lead_ids: List[str]
    from_telecaller_id: Optional[str] = None  # If None, reassign from any telecaller
    to_telecaller_id: str


class LeadDeassignment(BaseModel):
    """Model for removing telecaller assignment from leads"""
    lead_ids: List[str]


class BulkAssignFromSheets(BaseModel):
    """Model for bulk assignment from Google Sheets Column H"""
    pass  # No params needed, will read from sheets



# ==================== QR Code Management ====================

class QRCodeCreate(BaseModel):
    """Model for creating a new QR code"""
    name: str
    campaign_name: Optional[str] = None  # NEW: Group QR codes under campaigns
    landing_page_type: str  # "single" or "multiple"
    landing_page_single: Optional[str] = None
    landing_page_ios: Optional[str] = None
    landing_page_android: Optional[str] = None
    landing_page_mobile: Optional[str] = None
    landing_page_desktop: Optional[str] = None
    # UTM Parameters for analytics tracking
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    # Bulk generation
    bulk_count: Optional[int] = 1  # Number of QR codes to generate (default 1)


class QRCode(BaseModel):
    """Model for QR code stored in database"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    campaign_name: Optional[str] = None
    landing_page_type: str
    landing_page_single: Optional[str] = None
    landing_page_ios: Optional[str] = None
    landing_page_android: Optional[str] = None
    landing_page_mobile: Optional[str] = None
    landing_page_desktop: Optional[str] = None
    # UTM Parameters
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    qr_image_filename: str
    unique_short_code: str
    created_by: str  # user_id
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_scans: int = 0
    is_active: bool = True


class QRCodeUpdate(BaseModel):
    """Model for updating QR code settings"""
    name: Optional[str] = None
    campaign_name: Optional[str] = None
    landing_page_type: Optional[str] = None
    landing_page_single: Optional[str] = None
    landing_page_ios: Optional[str] = None
    landing_page_android: Optional[str] = None
    landing_page_mobile: Optional[str] = None
    landing_page_desktop: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
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



# ==================== Ride Deck Data Management ====================

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str  # Primary key from CSV
    name: Optional[str] = None
    email: Optional[str] = None
    phoneNumber: Optional[str] = None
    gender: Optional[str] = None
    rideOtp: Optional[str] = None
    referredById: Optional[str] = None
    nuraCoins: Optional[int] = 0
    dateOfBirth: Optional[str] = None
    emergencyContact: Optional[str] = None
    userReferralCode: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    hour: Optional[int] = None
    source: Optional[str] = None
    Channel: Optional[str] = None
    imported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Ride(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str  # Primary key from CSV
    customerId: Optional[str] = None
    driverId: Optional[str] = None
    rideStatus: Optional[str] = None
    rideType: Optional[str] = None
    pickupPoint: Optional[str] = None
    pickupLat: Optional[float] = None
    pickupLong: Optional[float] = None
    dropPoint: Optional[str] = None
    dropLat: Optional[float] = None
    dropLong: Optional[float] = None
    initialDistance: Optional[float] = None
    initialDuration: Optional[int] = None
    finalDistance: Optional[float] = None
    finalDuration: Optional[int] = None
    payWithNuraCoins: Optional[str] = None
    appliedVoucherId: Optional[str] = None
    appliedCouponId: Optional[str] = None
    rideAssignedLat: Optional[float] = None
    rideAssignedLong: Optional[float] = None
    initialFare: Optional[float] = None
    finalFare: Optional[float] = None
    payableAmount: Optional[float] = None
    rideStartTime: Optional[str] = None
    rideEndTime: Optional[str] = None
    rideAssignedTime: Optional[str] = None
    initialOdometer: Optional[float] = None
    finalOdometer: Optional[float] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    date: Optional[str] = None
    time_est: Optional[str] = None
    hour: Optional[int] = None
    source: Optional[str] = None
    dd: Optional[str] = None
    dd1: Optional[str] = None
    dd2: Optional[str] = None
    dd3: Optional[str] = None
    dd4: Optional[str] = None
    dd5: Optional[str] = None
    
    # Computed fields
    pickupLocality: Optional[str] = None
    dropLocality: Optional[str] = None
    pickupDistanceFromDepot: Optional[float] = None
    dropDistanceFromDepot: Optional[float] = None
    mostCommonPickupPoint: Optional[str] = None  # Format: "lat,long"
    mostCommonPickupLocality: Optional[str] = None
    statusReason: Optional[str] = None
    statusDetail: Optional[str] = None  # Username who updated
    
    imported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ImportStats(BaseModel):
    """Statistics returned after import"""
    total_rows: int
    new_records: int
    duplicate_records: int
    errors: int
    error_details: Optional[List[str]] = None


# ==================== Vehicle Documents ====================

class VehicleDocument(BaseModel):
    """Vehicle Document Model"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vin: str  # Vehicle Identification Number
    vehicle_number: str
    vehicle_name: str  # Derived from Vehicles List.xlsx
    
    # Document files (pdf/png/word)
    rc_book: Optional[str] = None  # RC Book file path
    insurance_doc: Optional[str] = None  # Insurance Document file path
    sales_invoice: Optional[str] = None  # Sales Invoice file path
    purchase_order: Optional[str] = None  # Purchase Order file path
    
    # Registration & Insurance Details
    registration_number: Optional[str] = None
    registration_expiry_date: Optional[datetime] = None
    insurance_start_date: Optional[datetime] = None
    insurance_expiry_date: Optional[datetime] = None
    
    # Vehicle Details
    vehicle_model_number: Optional[str] = None
    vehicle_description: Optional[str] = None
    vehicle_cost: Optional[float] = None
    vehicle_manufacturer: Optional[str] = None
    manufacturer_details: Optional[str] = None
    purchase_date: Optional[datetime] = None
    
    # Additional Info
    comments: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None  # user_id


class VehicleDocumentCreate(BaseModel):
    """Model for creating vehicle document"""
    vin: str
    vehicle_number: str
    vehicle_name: str
    rc_book: Optional[str] = None
    insurance_doc: Optional[str] = None
    sales_invoice: Optional[str] = None
    purchase_order: Optional[str] = None
    registration_number: Optional[str] = None
    registration_expiry_date: Optional[datetime] = None
    insurance_expiry_date: Optional[datetime] = None
    vehicle_model_number: Optional[str] = None
    vehicle_description: Optional[str] = None
    vehicle_cost: Optional[float] = None
    vehicle_manufacturer: Optional[str] = None
    manufacturer_details: Optional[str] = None
    purchase_date: Optional[datetime] = None
    comments: Optional[str] = None


class VehicleDocumentUpdate(BaseModel):
    """Model for updating vehicle document"""
    vin: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_name: Optional[str] = None
    rc_book: Optional[str] = None
    insurance_doc: Optional[str] = None
    sales_invoice: Optional[str] = None
    purchase_order: Optional[str] = None
    registration_number: Optional[str] = None
    registration_expiry_date: Optional[datetime] = None
    insurance_expiry_date: Optional[datetime] = None
    vehicle_model_number: Optional[str] = None
    vehicle_description: Optional[str] = None
    vehicle_cost: Optional[float] = None
    vehicle_manufacturer: Optional[str] = None
    manufacturer_details: Optional[str] = None
    purchase_date: Optional[datetime] = None
    comments: Optional[str] = None

