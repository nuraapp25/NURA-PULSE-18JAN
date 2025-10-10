"""
Google Sheets synchronization module for Nura Pulse
This module handles syncing user data with Google Sheets using Web App
"""
import os
import json
from typing import Dict, List, Optional
import logging
import requests

logger = logging.getLogger(__name__)

# Google Sheets configuration
GOOGLE_SHEETS_ENABLED = os.environ.get('GOOGLE_SHEETS_ENABLED', 'false').lower() == 'true'
GOOGLE_SHEETS_WEB_APP_URL = os.environ.get('GOOGLE_SHEETS_WEB_APP_URL', '')
SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY/edit?gid=0#gid=0"
SPREADSHEET_ID = "1PPtzfxqvP80SqCywj3F_3FbCVPOLw2lh_-RG95rZYSY"
WORKSHEET_NAME = "Users"


def get_gspread_client():
    """Initialize and return gspread client"""
    if not GOOGLE_SHEETS_ENABLED:
        return None
    
    try:
        import gspread
        from oauth2client.service_account import ServiceAccountCredentials
        
        # Get credentials from environment variable
        creds_json = os.environ.get('GOOGLE_SHEETS_CREDENTIALS')
        if not creds_json:
            logger.warning("GOOGLE_SHEETS_CREDENTIALS not found in environment")
            return None
        
        creds_dict = json.loads(creds_json)
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        credentials = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        client = gspread.authorize(credentials)
        return client
    except Exception as e:
        logger.error(f"Failed to initialize gspread client: {e}")
        return None


def sync_user_to_sheets(user_data: Dict) -> bool:
    """
    Sync a single user to Google Sheets
    
    Args:
        user_data: Dictionary containing user information
        
    Returns:
        bool: True if sync successful, False otherwise
    """
    if not GOOGLE_SHEETS_ENABLED:
        logger.info("Google Sheets sync is disabled")
        return False
    
    try:
        client = get_gspread_client()
        if not client:
            return False
        
        # Open spreadsheet and worksheet
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = spreadsheet.worksheet(WORKSHEET_NAME)
        
        # Get all records
        all_records = worksheet.get_all_records()
        
        # Check if user already exists
        user_email = user_data.get('email')
        existing_row = None
        for idx, record in enumerate(all_records, start=2):  # Start from row 2 (after header)
            if record.get('Mail ID') == user_email:
                existing_row = idx
                break
        
        # Prepare row data
        from datetime import datetime
        created_date = user_data.get('created_at')
        if isinstance(created_date, str):
            created_date = datetime.fromisoformat(created_date)
        
        formatted_date = created_date.strftime('%Y-%m-%d %H:%M:%S') if created_date else ''
        
        # Determine row number (S. No.)
        row_num = existing_row - 1 if existing_row else len(all_records) + 1
        
        row_data = [
            row_num,  # S. No.
            formatted_date,  # Date Created
            user_data.get('email', ''),  # Mail ID
            user_data.get('account_type', '').replace('_', ' ').title(),  # Account Type
            user_data.get('status', 'pending').title()  # Status
        ]
        
        if existing_row:
            # Update existing row
            worksheet.update(f'A{existing_row}:E{existing_row}', [row_data])
            logger.info(f"Updated user {user_email} in Google Sheets")
        else:
            # Append new row
            worksheet.append_row(row_data)
            logger.info(f"Added user {user_email} to Google Sheets")
        
        return True
    except Exception as e:
        logger.error(f"Failed to sync user to Google Sheets: {e}")
        return False


def bulk_sync_users_to_sheets(users: List[Dict]) -> bool:
    """
    Sync multiple users to Google Sheets
    
    Args:
        users: List of user dictionaries
        
    Returns:
        bool: True if sync successful, False otherwise
    """
    if not GOOGLE_SHEETS_ENABLED:
        logger.info("Google Sheets sync is disabled")
        return False
    
    try:
        client = get_gspread_client()
        if not client:
            return False
        
        # Open spreadsheet and worksheet
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = spreadsheet.worksheet(WORKSHEET_NAME)
        
        # Clear existing data (except header)
        worksheet.clear()
        
        # Set header
        header = ['S. No.', 'Date Created', 'Mail ID', 'Account Type', 'Status']
        worksheet.append_row(header)
        
        # Prepare all rows
        from datetime import datetime
        rows = []
        for idx, user in enumerate(users, start=1):
            created_date = user.get('created_at')
            if isinstance(created_date, str):
                created_date = datetime.fromisoformat(created_date)
            
            formatted_date = created_date.strftime('%Y-%m-%d %H:%M:%S') if created_date else ''
            
            row = [
                idx,  # S. No.
                formatted_date,  # Date Created
                user.get('email', ''),  # Mail ID
                user.get('account_type', '').replace('_', ' ').title(),  # Account Type
                user.get('status', 'pending').title()  # Status
            ]
            rows.append(row)
        
        # Batch update
        if rows:
            worksheet.append_rows(rows)
        
        logger.info(f"Bulk synced {len(users)} users to Google Sheets")
        return True
    except Exception as e:
        logger.error(f"Failed to bulk sync users to Google Sheets: {e}")
        return False


def delete_user_from_sheets(user_email: str) -> bool:
    """
    Mark user as deleted in Google Sheets (update status to 'Deleted')
    
    Args:
        user_email: Email of the user to mark as deleted
        
    Returns:
        bool: True if successful, False otherwise
    """
    if not GOOGLE_SHEETS_ENABLED:
        logger.info("Google Sheets sync is disabled")
        return False
    
    try:
        client = get_gspread_client()
        if not client:
            return False
        
        # Open spreadsheet and worksheet
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = spreadsheet.worksheet(WORKSHEET_NAME)
        
        # Find user row
        all_records = worksheet.get_all_records()
        for idx, record in enumerate(all_records, start=2):  # Start from row 2
            if record.get('Mail ID') == user_email:
                # Update status to 'Deleted'
                worksheet.update(f'E{idx}', 'Deleted')
                logger.info(f"Marked user {user_email} as Deleted in Google Sheets")
                return True
        
        logger.warning(f"User {user_email} not found in Google Sheets")
        return False
    except Exception as e:
        logger.error(f"Failed to delete user from Google Sheets: {e}")
        return False
