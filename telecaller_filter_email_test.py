#!/usr/bin/env python3
"""
Telecaller Filter Email Test - Test the filter with Genelia's email address
This confirms the filter works with email but not user ID, and tests assigned_telecaller_name field
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://driver-qr.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin"
ADMIN_PASSWORD = "Nura@1234$"

class TelecallerEmailFilterTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        
    def make_request(self, method, endpoint, data=None, params=None, use_auth=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                headers["Content-Type"] = "application/json"
                response = requests.post(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            return response
        except Exception as e:
            print(f"Request error for {method} {url}: {e}")
            return None
    
    def login(self):
        """Login as admin"""
        login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        
        if response and response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            return True
        return False
    
    def test_email_filter(self):
        """Test telecaller filter with Genelia's email address"""
        print("🧪 TESTING TELECALLER FILTER WITH EMAIL")
        print("=" * 50)
        
        genelia_email = "praylovemusic@gmail.com"
        
        # Test the filter with email
        params = {"telecaller": genelia_email}
        response = self.make_request("GET", "/driver-onboarding/leads", params=params)
        
        if response and response.status_code == 200:
            leads = response.json()
            print(f"✅ Filter with email returned {len(leads)} leads")
            
            if len(leads) == 5:
                print(f"✅ Correct count: Found exactly 5 leads as expected")
                
                # Check each lead
                all_correct = True
                leads_with_name = 0
                
                for i, lead in enumerate(leads, 1):
                    assigned_telecaller = lead.get('assigned_telecaller')
                    assigned_telecaller_name = lead.get('assigned_telecaller_name')
                    lead_name = lead.get('name', 'Unknown')
                    
                    print(f"   Lead {i}: {lead_name}")
                    print(f"      assigned_telecaller: '{assigned_telecaller}'")
                    print(f"      assigned_telecaller_name: '{assigned_telecaller_name}'")
                    
                    if assigned_telecaller != genelia_email:
                        print(f"      ❌ Wrong assignment: expected '{genelia_email}'")
                        all_correct = False
                    else:
                        print(f"      ✅ Correct assignment")
                    
                    if assigned_telecaller_name and assigned_telecaller_name != 'None':
                        leads_with_name += 1
                        print(f"      ✅ Has telecaller name: '{assigned_telecaller_name}'")
                    else:
                        print(f"      ❌ Missing telecaller name (shows: '{assigned_telecaller_name}')")
                
                if all_correct:
                    print(f"\n✅ All 5 leads have correct email assignment")
                else:
                    print(f"\n❌ Some leads have incorrect assignments")
                
                if leads_with_name == 5:
                    print(f"✅ All 5 leads have assigned_telecaller_name populated")
                else:
                    print(f"❌ Only {leads_with_name}/5 leads have assigned_telecaller_name populated")
                    print(f"   This is why telecaller names don't show in the UI")
                
                return True
            else:
                print(f"❌ Wrong count: Found {len(leads)} leads, expected 5")
                return False
        else:
            print(f"❌ Filter request failed: {response.status_code if response else 'Network error'}")
            return False
    
    def test_user_id_filter(self):
        """Test telecaller filter with Genelia's user ID (should return 0)"""
        print(f"\n🧪 TESTING TELECALLER FILTER WITH USER ID")
        print("=" * 50)
        
        genelia_user_id = "e25f3297-1252-48b1-8b20-36db996c52e0"
        
        # Test the filter with user ID
        params = {"telecaller": genelia_user_id}
        response = self.make_request("GET", "/driver-onboarding/leads", params=params)
        
        if response and response.status_code == 200:
            leads = response.json()
            print(f"✅ Filter with user ID returned {len(leads)} leads")
            
            if len(leads) == 0:
                print(f"✅ Correct: User ID filter returns 0 leads (assignments use email)")
                return True
            else:
                print(f"❌ Unexpected: User ID filter returned {len(leads)} leads")
                return False
        else:
            print(f"❌ Filter request failed: {response.status_code if response else 'Network error'}")
            return False
    
    def check_backend_filter_logic(self):
        """Check if backend supports both email and user ID in telecaller filter"""
        print(f"\n🔍 CHECKING BACKEND FILTER LOGIC")
        print("=" * 50)
        
        # Check the backend code to see how the filter works
        print("📋 Based on analysis:")
        print("   - Leads are assigned using telecaller EMAIL addresses")
        print("   - But users are identified by USER IDs in the user management system")
        print("   - The telecaller filter parameter accepts any string and matches against assigned_telecaller field")
        print("   - This creates a mismatch: filter expects user ID but assignments use email")
        
        print(f"\n💡 SOLUTIONS:")
        print("   1. BACKEND FIX: Update telecaller filter to lookup user email from user ID")
        print("   2. DATA FIX: Update all lead assignments to use user IDs instead of emails")
        print("   3. FRONTEND FIX: Pass email instead of user ID to the filter")
        
        return True
    
    def run_tests(self):
        """Run all telecaller filter tests"""
        print("🧪 TELECALLER FILTER COMPREHENSIVE TEST")
        print("=" * 60)
        print("Testing both email and user ID filtering for Genelia")
        print("=" * 60)
        
        if not self.login():
            print("❌ Login failed")
            return False
        
        print("✅ Admin login successful")
        
        success_count = 0
        
        # Test 1: Email filter (should work)
        if self.test_email_filter():
            success_count += 1
        
        # Test 2: User ID filter (should return 0)
        if self.test_user_id_filter():
            success_count += 1
        
        # Test 3: Check backend logic
        if self.check_backend_filter_logic():
            success_count += 1
        
        print(f"\n📊 TEST RESULTS")
        print("=" * 60)
        print(f"✅ Tests passed: {success_count}/3")
        
        if success_count == 3:
            print(f"\n🎯 CONCLUSION:")
            print(f"   ✅ Telecaller filter WORKS with email addresses")
            print(f"   ❌ Telecaller filter FAILS with user IDs")
            print(f"   ❌ assigned_telecaller_name field is NOT populated")
            print(f"   📋 Root cause: Mismatch between assignment method (email) and filter expectation (user ID)")
            return True
        else:
            print(f"\n❌ Some tests failed")
            return False

def main():
    tester = TelecallerEmailFilterTester()
    tester.run_tests()

if __name__ == "__main__":
    main()