#!/usr/bin/env python3
"""
Debug QR Scans - Check what's actually in the database
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://driver-onboard-4.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

def authenticate():
    """Get authentication token"""
    login_data = {
        "email": MASTER_ADMIN_EMAIL,
        "password": MASTER_ADMIN_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    else:
        print(f"Login failed: {response.status_code} - {response.text}")
        return None

def debug_qr_scans():
    """Debug QR scans in database"""
    token = authenticate()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("🔍 DEBUGGING QR SCANS DATABASE")
    print("=" * 50)
    
    # 1. Get all QR codes
    print("\n1. Getting all QR codes...")
    response = requests.get(f"{BASE_URL}/qr-codes", headers=headers, timeout=10)
    
    if response.status_code == 200:
        qr_codes_data = response.json()
        # Handle both list and dict responses
        qr_codes = qr_codes_data if isinstance(qr_codes_data, list) else qr_codes_data.get("qr_codes", [])
        print(f"   Found {len(qr_codes)} QR codes")
        
        # Show recent QR codes
        for qr in qr_codes[:3]:  # Show first 3
            qr_id = qr.get("id")
            qr_name = qr.get("qr_name", "Unknown")
            scan_count = qr.get("scan_count", 0)
            campaign = qr.get("campaign_name", "Unknown")
            print(f"   - {qr_name} (ID: {qr_id[:8]}...) - Scans: {scan_count} - Campaign: {campaign}")
            
            # 2. Check analytics for this QR code
            print(f"\n2. Checking analytics for QR: {qr_name}")
            analytics_response = requests.get(f"{BASE_URL}/qr-codes/{qr_id}/analytics", headers=headers, timeout=10)
            
            if analytics_response.status_code == 200:
                analytics_data = analytics_response.json()
                if analytics_data.get("success"):
                    analytics = analytics_data.get("analytics", {})
                    total_scans = analytics.get("total_scans", 0)
                    scan_details = analytics.get("scan_details", [])
                    
                    print(f"   Analytics Response:")
                    print(f"   - Total Scans: {total_scans}")
                    print(f"   - Scan Details Count: {len(scan_details)}")
                    print(f"   - iOS Scans: {analytics.get('ios_scans', 0)}")
                    print(f"   - Android Scans: {analytics.get('android_scans', 0)}")
                    print(f"   - Web Scans: {analytics.get('web_scans', 0)}")
                    
                    # Show UTM URLs
                    print(f"   UTM URLs:")
                    print(f"   - iOS: {analytics.get('utm_url_ios', 'None')}")
                    print(f"   - Android: {analytics.get('utm_url_android', 'None')}")
                    print(f"   - Web: {analytics.get('utm_url_web', 'None')}")
                    
                    if scan_details:
                        print(f"\n   First scan detail:")
                        first_scan = scan_details[0]
                        for key, value in first_scan.items():
                            print(f"     {key}: {value}")
                    else:
                        print(f"   ❌ ISSUE: scan_details array is EMPTY despite total_scans = {total_scans}")
                        
                        # This is the core issue - let's investigate further
                        print(f"\n   🔍 INVESTIGATING: Why scan_details is empty...")
                        
                        # Let's check if there's a direct database query issue
                        # We can't directly query MongoDB from here, but we can check the QR scan endpoint
                        
                else:
                    print(f"   ❌ Analytics request failed: {analytics_data}")
            else:
                print(f"   ❌ Analytics request failed: {analytics_response.status_code} - {analytics_response.text}")
            
            print("-" * 30)
            
    else:
        print(f"❌ Failed to get QR codes: {response.status_code} - {response.text}")

if __name__ == "__main__":
    debug_qr_scans()