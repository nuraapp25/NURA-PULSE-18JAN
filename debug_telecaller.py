#!/usr/bin/env python3
"""
Debug script to check Telecaller's Desk API responses
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://lead-management-4.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

def authenticate():
    """Get authentication token"""
    login_data = {
        "email": MASTER_ADMIN_EMAIL,
        "password": MASTER_ADMIN_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    else:
        print(f"Authentication failed: {response.status_code} - {response.text}")
        return None

def debug_apis():
    """Debug the APIs"""
    token = authenticate()
    if not token:
        print("❌ Authentication failed")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("🔍 Debugging Telecaller's Desk APIs")
    print("=" * 50)
    
    # Test 1: Get leads with skip_pagination
    print("\n1. Testing GET /driver-onboarding/leads?skip_pagination=true")
    response = requests.get(f"{BASE_URL}/driver-onboarding/leads?skip_pagination=true", headers=headers, timeout=30)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        try:
            data = response.json()
            print(f"Response type: {type(data)}")
            if isinstance(data, dict):
                print(f"Keys: {list(data.keys())}")
                if 'leads' in data:
                    leads = data['leads']
                    print(f"Leads count: {len(leads)}")
                    if leads:
                        print(f"First lead keys: {list(leads[0].keys())}")
                        print(f"First lead ID: {leads[0].get('id')}")
                elif isinstance(data, list):
                    print(f"Direct list with {len(data)} items")
                    if data:
                        print(f"First item keys: {list(data[0].keys())}")
            else:
                print(f"Unexpected response format: {data}")
        except Exception as e:
            print(f"Error parsing response: {e}")
            print(f"Raw response: {response.text[:500]}")
    else:
        print(f"Error: {response.text}")
    
    # Test 2: Get a single lead
    print("\n2. Testing GET /driver-onboarding/leads (paginated)")
    response = requests.get(f"{BASE_URL}/driver-onboarding/leads", headers=headers, timeout=30)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        try:
            data = response.json()
            print(f"Response type: {type(data)}")
            if isinstance(data, dict):
                print(f"Keys: {list(data.keys())}")
            elif isinstance(data, list) and data:
                print(f"List with {len(data)} items")
                test_lead_id = data[0].get('id')
                print(f"Test lead ID: {test_lead_id}")
                
                # Test 3: Update lead status
                print(f"\n3. Testing PATCH /driver-onboarding/leads/{test_lead_id}")
                update_data = {"status": "Call back 1D"}
                headers_with_content = headers.copy()
                headers_with_content["Content-Type"] = "application/json"
                patch_response = requests.patch(f"{BASE_URL}/driver-onboarding/leads/{test_lead_id}", 
                                              json=update_data, headers=headers_with_content, timeout=30)
                print(f"PATCH Status: {patch_response.status_code}")
                print(f"PATCH Response: {patch_response.text}")
                
                if patch_response.status_code == 200:
                    try:
                        patch_data = patch_response.json()
                        print(f"PATCH Response JSON: {patch_data}")
                    except:
                        print("PATCH Response is not JSON")
                
                # Test 4: Get updated lead
                print(f"\n4. Testing GET /driver-onboarding/leads/{test_lead_id}")
                get_response = requests.get(f"{BASE_URL}/driver-onboarding/leads/{test_lead_id}", 
                                          headers=headers, timeout=30)
                print(f"GET Status: {get_response.status_code}")
                if get_response.status_code == 200:
                    lead_data = get_response.json()
                    print(f"Lead status: {lead_data.get('status')}")
                    print(f"Callback date: {lead_data.get('callback_date')}")
                else:
                    print(f"GET Error: {get_response.text}")
        except Exception as e:
            print(f"Error: {e}")
            print(f"Raw response: {response.text[:500]}")
    else:
        print(f"Error: {response.text}")
    
    # Test 5: Telecaller summary
    print("\n5. Testing GET /driver-onboarding/telecaller-summary")
    response = requests.get(f"{BASE_URL}/driver-onboarding/telecaller-summary", headers=headers, timeout=30)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        try:
            data = response.json()
            print(f"Summary keys: {list(data.keys())}")
            print(f"Total leads: {data.get('total_leads')}")
            print(f"Stage breakdown: {data.get('stage_breakdown')}")
        except Exception as e:
            print(f"Error: {e}")
            print(f"Raw response: {response.text[:500]}")
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    debug_apis()