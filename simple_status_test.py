#!/usr/bin/env python3
"""
Simple Driver Onboarding Status Test
"""

import requests
import json

# Configuration
BASE_URL = "https://driver-docs-2.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

def main():
    print("🔍 Simple Driver Onboarding Status Test")
    print("=" * 50)
    
    # Step 1: Login
    print("\n--- Step 1: Login ---")
    login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        print(f"Login response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            print(f"✅ Login successful, got token")
        else:
            print(f"❌ Login failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Step 2: Fetch leads
    print("\n--- Step 2: Fetch leads ---")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/leads?skip_pagination=true", 
                              headers=headers, timeout=30)
        print(f"Leads response status: {response.status_code}")
        
        if response.status_code == 200:
            leads = response.json()
            print(f"✅ Got {len(leads)} leads")
            
            if len(leads) > 0:
                print(f"\nFirst lead keys: {list(leads[0].keys())}")
                print(f"First lead sample: {json.dumps(leads[0], indent=2)[:500]}...")
                
                # Count statuses
                status_counts = {}
                for lead in leads:
                    status = lead.get('status', 'Unknown')
                    status_counts[status] = status_counts.get(status, 0) + 1
                
                print(f"\nStatus counts:")
                for status, count in status_counts.items():
                    print(f"  {status}: {count}")
            else:
                print("No leads found")
        else:
            print(f"❌ Failed to fetch leads: {response.text}")
    except Exception as e:
        print(f"❌ Error fetching leads: {e}")
    
    # Step 3: Check status summary
    print("\n--- Step 3: Check status summary ---")
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/status-summary", 
                              headers=headers, timeout=10)
        print(f"Status summary response status: {response.status_code}")
        
        if response.status_code == 200:
            summary = response.json()
            print(f"✅ Status summary: {json.dumps(summary, indent=2)}")
        else:
            print(f"❌ Status summary failed: {response.text}")
    except Exception as e:
        print(f"❌ Error checking status summary: {e}")

if __name__ == "__main__":
    main()