#!/usr/bin/env python3
"""
Detailed test of the sync endpoint to get exact error response
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://operator-hub-3.preview.emergentagent.com/api"
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
        print(f"Authentication failed: {response.status_code}")
        return None

def test_sync_with_shorter_timeout():
    """Test sync with shorter timeout to get actual error"""
    token = authenticate()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        print("Testing sync endpoint with 10 second timeout...")
        response = requests.post(
            f"{BASE_URL}/driver-onboarding/sync-leads",
            headers=headers,
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 500:
            try:
                error_data = response.json()
                print(f"Error Response: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Error Text: {response.text}")
        elif response.status_code == 200:
            try:
                success_data = response.json()
                print(f"Success Response: {json.dumps(success_data, indent=2)}")
            except:
                print(f"Response Text: {response.text}")
        else:
            print(f"Unexpected status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print("Request timed out after 10 seconds")
    except Exception as e:
        print(f"Error: {e}")

def test_google_sheets_directly():
    """Test Google Sheets Web App directly to see what actions it supports"""
    web_app_url = "https://script.google.com/macros/s/AKfycbyP7biLOVqWdDFjqDnbD7Owv-nUSmi69ZzzZJFmpijrtj88_uOsIdpyZWaoa3LC0kTD/exec"
    
    # Test with the action that's being sent
    test_payload = {
        "action": "sync_from_app",
        "leads": [
            {
                "id": "test-id-123",
                "name": "Test Lead",
                "phone_number": "1234567890",
                "status": "New"
            }
        ]
    }
    
    try:
        print("\nTesting Google Sheets Web App directly...")
        response = requests.post(
            web_app_url,
            json=test_payload,
            headers={'Content-Type': 'application/json'},
            timeout=15
        )
        
        print(f"Direct Google Sheets Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"Google Sheets Response: {json.dumps(result, indent=2)}")
            except:
                print(f"Google Sheets Text: {response.text}")
        else:
            print(f"Google Sheets Error: {response.text}")
            
    except requests.exceptions.Timeout:
        print("Google Sheets request timed out")
    except Exception as e:
        print(f"Google Sheets error: {e}")

if __name__ == "__main__":
    test_sync_with_shorter_timeout()
    test_google_sheets_directly()