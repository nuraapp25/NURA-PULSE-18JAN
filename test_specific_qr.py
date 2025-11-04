#!/usr/bin/env python3
"""
Test specific QR code that we know has scans
"""

import requests
import json

# Configuration
BASE_URL = "https://qr-campaign-fix.preview.emergentagent.com/api"
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

def test_specific_qr():
    """Test the specific QR code that has scans"""
    token = authenticate()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test the QR code that we know has scans: d44f7edd-cde9-4c9f-8147-a2987fc0e79f
    qr_id = "d44f7edd-cde9-4c9f-8147-a2987fc0e79f"
    
    print(f"🔍 TESTING SPECIFIC QR CODE: {qr_id}")
    print("=" * 60)
    
    # Call analytics endpoint
    response = requests.get(f"{BASE_URL}/qr-codes/{qr_id}/analytics", headers=headers, timeout=10)
    
    print("Testing CORRECT endpoint with qr_code_id parameter...")
    response2 = requests.get(f"{BASE_URL}/qr-codes/{qr_id}/analytics", headers=headers, timeout=10)
    
    if response.status_code == 200:
        try:
            data = response.json()
            print(f"Raw Response:")
            print(json.dumps(data, indent=2))
            
            if data.get("success"):
                analytics = data.get("analytics", {})
                scan_details = analytics.get("scan_details", [])
                
                print(f"\n📊 ANALYTICS BREAKDOWN:")
                print(f"   Total Scans: {analytics.get('total_scans', 0)}")
                print(f"   Scan Details Count: {len(scan_details)}")
                print(f"   iOS Scans: {analytics.get('ios_scans', 0)}")
                print(f"   Android Scans: {analytics.get('android_scans', 0)}")
                print(f"   Web Scans: {analytics.get('web_scans', 0)}")
                
                print(f"\n🔗 UTM URLs:")
                print(f"   iOS: {analytics.get('utm_url_ios')}")
                print(f"   Android: {analytics.get('utm_url_android')}")
                print(f"   Web: {analytics.get('utm_url_web')}")
                
                if scan_details:
                    print(f"\n📋 SCAN DETAILS:")
                    for i, scan in enumerate(scan_details):
                        print(f"   Scan {i+1}:")
                        for key, value in scan.items():
                            print(f"     {key}: {value}")
                        print()
                else:
                    print(f"\n❌ SCAN DETAILS STILL EMPTY!")
                    print(f"   This confirms the filtering is working but scans have scanned_at=None")
            else:
                print(f"❌ Analytics request unsuccessful: {data}")
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON response: {response.text}")
    else:
        print(f"❌ Analytics request failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_specific_qr()