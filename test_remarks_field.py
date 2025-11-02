#!/usr/bin/env python3
"""
Remarks Field Testing for Driver Onboarding Leads
Tests remarks field saving and retrieval functionality as requested in review
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://lead-management-4.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin"
ADMIN_PASSWORD = "Nura@1234$"

def main():
    print("=== REMARKS FIELD TESTING ===")
    print("Testing remarks field saving and retrieval as requested in review")
    print()

    # Step 1: Login as admin
    print("1. Login as admin (admin/Nura@1234$)")
    login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=30)
    except Exception as e:
        print(f"❌ Network error during login: {e}")
        return False

    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return False

    try:
        login_result = response.json()
        token = login_result["token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        print("✅ Login successful")
    except (json.JSONDecodeError, KeyError) as e:
        print(f"❌ Login response error: {e}")
        return False

    # Step 2: Get a test lead
    print("2. GET /api/driver-onboarding/leads (get first lead ID)")
    
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/leads", headers=headers, timeout=30)
    except Exception as e:
        print(f"❌ Network error getting leads: {e}")
        return False

    if response.status_code != 200:
        print(f"❌ Failed to get leads: {response.status_code} - {response.text}")
        return False

    try:
        response_data = response.json()
        leads = response_data.get("leads", [])
    except json.JSONDecodeError:
        print(f"❌ Invalid JSON response: {response.text}")
        return False

    if not leads or len(leads) == 0:
        print("❌ No leads found in database")
        return False

    lead_id = leads[0].get("id")
    lead_name = leads[0].get("name", "Unknown")
    current_remarks = leads[0].get("remarks", "None")
    
    if not lead_id:
        print("❌ Lead missing ID field")
        return False
        
    print(f"✅ Found test lead: {lead_name} (ID: {lead_id})")
    print(f"   Current remarks: {current_remarks}")

    # Step 3: Update lead with remarks
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    test_remarks = f"Test remarks from API - timestamp: {current_time}"

    print(f"3. PATCH /api/driver-onboarding/leads/{lead_id}")
    print(f"   Body: {{\"remarks\": \"{test_remarks}\"}}")

    update_data = {"remarks": test_remarks}
    
    try:
        response = requests.patch(f"{BASE_URL}/driver-onboarding/leads/{lead_id}", 
                                json=update_data, headers=headers, timeout=30)
    except Exception as e:
        print(f"❌ Network error during PATCH: {e}")
        return False

    print(f"   Response status: {response.status_code}")

    if response.status_code == 200:
        try:
            result = response.json()
            print("✅ PATCH request successful")
            print(f"   Response: {result}")
            
            # Check if response contains updated remarks field
            if "lead" in result and "remarks" in result["lead"]:
                response_remarks = result["lead"]["remarks"]
                if response_remarks == test_remarks:
                    print("✅ Response contains updated remarks field")
                else:
                    print(f"❌ Response remarks mismatch. Expected: \"{test_remarks}\", Got: \"{response_remarks}\"")
            else:
                print("⚠️  Response does not contain updated lead data with remarks field")
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON response: {response.text}")
    else:
        print(f"❌ PATCH failed: {response.status_code} - {response.text}")
        return False

    # Step 4: Verify remarks persisted
    print("4. Verify remarks persisted")
    print(f"   GET /api/driver-onboarding/leads (check lead {lead_id})")

    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/leads", headers=headers, timeout=30)
    except Exception as e:
        print(f"❌ Network error verifying persistence: {e}")
        return False

    if response.status_code == 200:
        try:
            response_data = response.json()
            leads = response_data.get("leads", [])
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON response: {response.text}")
            return False
            
        target_lead = None
        
        for lead in leads:
            if lead.get("id") == lead_id:
                target_lead = lead
                break
        
        if target_lead:
            persisted_remarks = target_lead.get("remarks")
            print(f"   Found lead remarks: {persisted_remarks}")
            
            if persisted_remarks == test_remarks:
                print("✅ Remarks correctly persisted in database")
            else:
                print(f"❌ Remarks not persisted correctly. Expected: \"{test_remarks}\", Found: \"{persisted_remarks}\"")
                return False
        else:
            print(f"❌ Lead {lead_id} not found in database")
            return False
    else:
        print(f"❌ Failed to verify persistence: {response.status_code} - {response.text}")
        return False

    # Step 5: Update remarks again
    new_remarks = f"Updated remarks from API - timestamp: {current_time} - UPDATED"
    print(f"5. Update remarks again")
    print(f"   PATCH with new remarks: \"{new_remarks}\"")

    update_data = {"remarks": new_remarks}
    
    try:
        response = requests.patch(f"{BASE_URL}/driver-onboarding/leads/{lead_id}", 
                                json=update_data, headers=headers, timeout=30)
    except Exception as e:
        print(f"❌ Network error during second update: {e}")
        return False

    if response.status_code == 200:
        print("✅ Second update successful")
        
        # Verify second update persisted
        try:
            response = requests.get(f"{BASE_URL}/driver-onboarding/leads", headers=headers, timeout=30)
        except Exception as e:
            print(f"❌ Network error verifying second update: {e}")
            return False
            
        if response.status_code == 200:
            try:
                response_data = response.json()
                leads = response_data.get("leads", [])
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON response: {response.text}")
                return False
                
            for lead in leads:
                if lead.get("id") == lead_id:
                    final_remarks = lead.get("remarks")
                    if final_remarks == new_remarks:
                        print("✅ Second update correctly persisted")
                    else:
                        print(f"❌ Second update not persisted. Expected: \"{new_remarks}\", Found: \"{final_remarks}\"")
                        return False
                    break
    else:
        print(f"❌ Second update failed: {response.status_code} - {response.text}")
        return False

    print()
    print("=== REMARKS FIELD TESTING COMPLETE ===")
    print("✅ ALL TESTS PASSED - Remarks field is working correctly")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)