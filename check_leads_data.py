#!/usr/bin/env python3
"""
Check the structure of leads data to identify serialization issues
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://nurapulse-2.preview.emergentagent.com/api"
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

def check_leads_data():
    """Check the leads data structure"""
    token = authenticate()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        print("Getting leads data...")
        response = requests.get(f"{BASE_URL}/driver-onboarding/leads", headers=headers, timeout=10)
        
        if response.status_code == 200:
            leads = response.json()
            print(f"Total leads: {len(leads)}")
            
            if leads:
                # Check first lead structure
                first_lead = leads[0]
                print(f"\nFirst lead structure:")
                for key, value in first_lead.items():
                    print(f"  {key}: {type(value).__name__} = {value}")
                
                # Try to serialize to JSON to check for issues
                try:
                    json_str = json.dumps(leads)
                    print(f"\n✅ All leads can be serialized to JSON (size: {len(json_str)} chars)")
                except Exception as e:
                    print(f"\n❌ JSON serialization error: {e}")
                    
                    # Find problematic fields
                    for i, lead in enumerate(leads[:5]):  # Check first 5 leads
                        try:
                            json.dumps(lead)
                        except Exception as lead_error:
                            print(f"  Lead {i} has serialization issue: {lead_error}")
                            print(f"  Lead {i} data: {lead}")
                            break
            else:
                print("No leads found")
        else:
            print(f"Failed to get leads: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_leads_data()