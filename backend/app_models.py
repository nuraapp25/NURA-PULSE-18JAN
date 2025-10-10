"""
Database Models for Nura Pulse Apps
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
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
