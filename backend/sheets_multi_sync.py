"""
Multi-Tab Google Sheets Sync Module
Handles sync for all Nura Pulse apps
"""
import os
import logging
import requests
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# Configuration
GOOGLE_SHEETS_ENABLED = os.environ.get('GOOGLE_SHEETS_ENABLED', 'false').lower() == 'true'
GOOGLE_SHEETS_WEB_APP_URL = os.environ.get('GOOGLE_SHEETS_WEB_APP_URL', '')

# Tab mappings
TABS = {
    'users': 'users',
    'leads': 'leads',
    'payment_reconciliation': 'payment_reconciliation',
    'driver_onboarding': 'driver_onboarding',
    'telecaller_queue': 'telecaller_queue',
    'montra_vehicle_insights': 'montra_vehicle_insights'
}


def send_to_sheets(payload: Dict) -> Dict:
    """
    Send data to Google Sheets Web App
    
    Returns:
        Dict with success status and message
    """
    if not GOOGLE_SHEETS_ENABLED:
        logger.info("Google Sheets sync is disabled")
        return {'success': False, 'message': 'Sync disabled'}
    
    if not GOOGLE_SHEETS_WEB_APP_URL:
        logger.warning("GOOGLE_SHEETS_WEB_APP_URL not configured")
        return {'success': False, 'message': 'Web App URL not configured'}
    
    try:
        response = requests.post(
            GOOGLE_SHEETS_WEB_APP_URL,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                logger.info(f"Sheets sync success: {result.get('message')}")
                return result
            else:
                logger.error(f"Sheets sync failed: {result.get('message')}")
                return result
        else:
            logger.error(f"Sheets Web App returned status {response.status_code}")
            return {'success': False, 'message': f'HTTP {response.status_code}'}
            
    except Exception as e:
        logger.error(f"Failed to sync to Sheets: {e}")
        return {'success': False, 'message': str(e)}


# ==================== WRITE OPERATIONS ====================

def sync_all_records(tab: str, records: List[Dict]) -> bool:
    """Sync all records to a specific tab"""
    payload = {
        'action': 'sync_all',
        'tab': tab,
        'records': records
    }
    result = send_to_sheets(payload)
    return result.get('success', False)


def sync_single_record(tab: str, record: Dict) -> bool:
    """Sync a single record to a specific tab"""
    payload = {
        'action': 'sync_single',
        'tab': tab,
        'record': record
    }
    result = send_to_sheets(payload)
    return result.get('success', False)


def delete_record(tab: str, record_id: str) -> bool:
    """Delete a record from a specific tab"""
    payload = {
        'action': 'delete_record',
        'tab': tab,
        'id': record_id
    }
    result = send_to_sheets(payload)
    return result.get('success', False)


def update_field(tab: str, record_id: str, field: str, value: Any) -> bool:
    """Update a single field in a record"""
    payload = {
        'action': 'update_field',
        'tab': tab,
        'id': record_id,
        'field': field,
        'value': value
    }
    result = send_to_sheets(payload)
    return result.get('success', False)


# ==================== READ OPERATIONS ====================

def get_all_records(tab: str) -> List[Dict]:
    """Get all records from a specific tab"""
    payload = {
        'action': 'get_all',
        'tab': tab
    }
    result = send_to_sheets(payload)
    if result.get('success'):
        return result.get('data', [])
    return []


def get_single_record(tab: str, record_id: str) -> Optional[Dict]:
    """Get a single record from a specific tab"""
    payload = {
        'action': 'get_single',
        'tab': tab,
        'id': record_id
    }
    result = send_to_sheets(payload)
    if result.get('success'):
        return result.get('data')
    return None


def search_records(tab: str, query: str) -> List[Dict]:
    """Search records in a specific tab"""
    payload = {
        'action': 'search',
        'tab': tab,
        'query': query
    }
    result = send_to_sheets(payload)
    if result.get('success'):
        return result.get('data', [])
    return []


# ==================== APP-SPECIFIC SYNC FUNCTIONS ====================

def sync_users(users: List[Dict]) -> bool:
    """Sync all users"""
    return sync_all_records('users', users)


def sync_payment(payment: Dict) -> bool:
    """Sync single payment record"""
    return sync_single_record('payment_reconciliation', payment)


def sync_driver(driver: Dict) -> bool:
    """Sync single driver record"""
    return sync_single_record('driver_onboarding', driver)


def sync_telecaller_task(task: Dict) -> bool:
    """Sync single telecaller task"""
    return sync_single_record('telecaller_queue', task)


def sync_vehicle(vehicle: Dict) -> bool:
    """Sync single vehicle record"""
    return sync_single_record('montra_vehicle_insights', vehicle)


# ==================== FETCH OPERATIONS ====================

def fetch_all_payments() -> List[Dict]:
    """Fetch all payment records from sheets"""
    return get_all_records('payment_reconciliation')


def fetch_all_drivers() -> List[Dict]:
    """Fetch all driver records from sheets"""
    return get_all_records('driver_onboarding')


def fetch_telecaller_queue() -> List[Dict]:
    """Fetch all telecaller tasks from sheets"""
    return get_all_records('telecaller_queue')


def fetch_vehicle_insights() -> List[Dict]:
    """Fetch all vehicle records from sheets"""
    return get_all_records('montra_vehicle_insights')


# ==================== LEGACY SUPPORT (for Users tab) ====================

def sync_user_to_sheets(user_data: Dict) -> bool:
    """Legacy function for user sync - redirects to new system"""
    return sync_single_record('users', user_data)


def bulk_sync_users_to_sheets(users: List[Dict]) -> bool:
    """Legacy function for bulk user sync - redirects to new system"""
    return sync_all_records('users', users)


def delete_user_from_sheets(user_email: str) -> bool:
    """Legacy function for user deletion - redirects to new system"""
    return delete_record('users', user_email)
