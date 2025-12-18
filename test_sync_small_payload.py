#!/usr/bin/env python3
"""
Test sync with a small payload to isolate the issue
"""

import requests
import json
import sys
import time

# Configuration
BASE_URL = "https://fleetflow-8.preview.emergentagent.com/api"
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

def test_with_monitoring():
    """Test sync while monitoring backend logs"""
    token = authenticate()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Starting sync request...")
    print("Monitor backend logs with: tail -f /var/log/supervisor/backend.err.log")
    
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BASE_URL}/driver-onboarding/sync-leads",
            headers=headers,
            timeout=60  # Longer timeout to see what happens
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\nRequest completed in {duration:.2f} seconds")
        print(f"Status Code: {response.status_code}")
        
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
            print(f"Response: {response.text}")
            
    except requests.exceptions.Timeout:
        end_time = time.time()
        duration = end_time - start_time
        print(f"Request timed out after {duration:.2f} seconds")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_with_monitoring()