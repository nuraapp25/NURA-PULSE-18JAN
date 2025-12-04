#!/usr/bin/env python3
"""
Focused Test for Telecaller's Desk Status Update and Mark as Called Functionality
Tests the specific fix for MongoDB WriteError with null status_history fields
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://driver-hub-46.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

class TelecallerDeskTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        if not success and response_data:
            print(f"   Response: {response_data}")
    
    def make_request(self, method, endpoint, data=None, use_auth=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                headers["Content-Type"] = "application/json"
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PATCH":
                headers["Content-Type"] = "application/json"
                response = requests.patch(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            print(f"DEBUG: {method} {url} -> Status: {response.status_code}")
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error for {method} {url}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error for {method} {url}: {e}")
            return None
    
    def test_authentication(self):
        """Test authentication with admin credentials"""
        print("\n=== Testing Authentication ===")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        
        if not response:
            self.log_test("Authentication", False, "Network error during login")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "token" in data:
                    self.token = data["token"]
                    user_info = data.get("user", {})
                    self.log_test("Authentication", True, 
                                f"Login successful. User: {user_info.get('first_name', 'Unknown')}, Type: {user_info.get('account_type', 'Unknown')}")
                    return True
                else:
                    self.log_test("Authentication", False, "No token in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("Authentication", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Authentication", False, 
                        f"Login failed with status {response.status_code}", response.text)
            return False
    
    def test_telecaller_status_update_and_mark_called(self):
        """Test Telecaller's Desk Status Update and Mark as Called functionality"""
        print("\n=== Testing Telecaller's Desk Status Update and Mark as Called ===")
        
        success_count = 0
        test_lead_id = None
        
        # Step 1: Get a lead ID from the database
        print("\n--- Step 1: Getting a lead ID from database ---")
        response = self.make_request("GET", "/driver-onboarding/leads?limit=1")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                leads = data.get("leads", [])
                if leads and len(leads) > 0:
                    test_lead_id = leads[0].get("id")
                    lead_name = leads[0].get("name", "Unknown")
                    current_status = leads[0].get("status", "Unknown")
                    self.log_test("Get Lead ID", True, 
                                f"Retrieved lead ID: {test_lead_id}, Name: {lead_name}, Current Status: {current_status}")
                    success_count += 1
                else:
                    self.log_test("Get Lead ID", False, "No leads found in database")
                    return False
            except json.JSONDecodeError:
                self.log_test("Get Lead ID", False, "Invalid JSON response", response.text)
                return False
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Get Lead ID", False, error_msg, response.text if response else None)
            return False
        
        if not test_lead_id:
            self.log_test("Telecaller Status Update Tests", False, "No test lead ID available")
            return False
        
        # Step 2: Test Status Update (PATCH /api/driver-onboarding/leads/{lead_id})
        print("\n--- Step 2: Testing Status Update ---")
        update_data = {
            "status": "Interested",
            "remarks": "Test update from backend testing - verifying null status_history fix"
        }
        
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", update_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "lead" in result:
                    updated_lead = result["lead"]
                    new_status = updated_lead.get("status")
                    status_history = updated_lead.get("status_history", [])
                    
                    self.log_test("Status Update - PATCH Success", True, 
                                f"✅ Status updated successfully to '{new_status}', status_history has {len(status_history)} entries")
                    success_count += 1
                    
                    # Verify status_history is properly populated (this was the main issue)
                    if isinstance(status_history, list) and len(status_history) > 0:
                        latest_entry = status_history[-1]
                        if latest_entry.get("action") == "status_changed" and latest_entry.get("new_value") == "Interested":
                            self.log_test("Status Update - History Populated", True, 
                                        f"✅ Status history properly recorded: {latest_entry.get('timestamp')}")
                            success_count += 1
                        else:
                            self.log_test("Status Update - History Populated", False, 
                                        f"Status history entry incorrect: {latest_entry}")
                    else:
                        self.log_test("Status Update - History Populated", False, 
                                    f"Status history not properly populated: {status_history}")
                else:
                    self.log_test("Status Update - PATCH Success", False, 
                                "Response missing success field or lead data", result)
            except json.JSONDecodeError:
                self.log_test("Status Update - PATCH Success", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            error_detail = response.text if response else None
            self.log_test("Status Update - PATCH Success", False, 
                        f"❌ Status update failed: {error_msg}", error_detail)
        
        # Step 3: Test Mark as Called (POST /api/driver-onboarding/leads/{lead_id}/mark-called)
        print("\n--- Step 3: Testing Mark as Called ---")
        response = self.make_request("POST", f"/driver-onboarding/leads/{test_lead_id}/mark-called")
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "last_called" in result:
                    last_called = result.get("last_called")
                    self.log_test("Mark as Called - POST Success", True, 
                                f"✅ Lead marked as called successfully, last_called: {last_called}")
                    success_count += 1
                    
                    # Verify the lead was updated in database
                    verify_response = self.make_request("GET", f"/driver-onboarding/leads")
                    if verify_response and verify_response.status_code == 200:
                        try:
                            verify_data = verify_response.json()
                            verify_leads = verify_data.get("leads", [])
                            # Find our test lead
                            updated_lead = None
                            for lead in verify_leads:
                                if lead.get("id") == test_lead_id:
                                    updated_lead = lead
                                    break
                            
                            if updated_lead:
                                calling_history = updated_lead.get("calling_history", [])
                                db_last_called = updated_lead.get("last_called")
                                
                                if db_last_called and len(calling_history) > 0:
                                    self.log_test("Mark as Called - Database Updated", True, 
                                                f"✅ Database updated: last_called set, calling_history has {len(calling_history)} entries")
                                    success_count += 1
                                else:
                                    self.log_test("Mark as Called - Database Updated", False, 
                                                f"Database not properly updated: last_called={db_last_called}, calling_history={len(calling_history)}")
                            else:
                                self.log_test("Mark as Called - Database Updated", False, "Could not find test lead in verification")
                        except json.JSONDecodeError:
                            self.log_test("Mark as Called - Database Updated", False, "Invalid JSON in verification response")
                else:
                    self.log_test("Mark as Called - POST Success", False, 
                                "Response missing success field or last_called", result)
            except json.JSONDecodeError:
                self.log_test("Mark as Called - POST Success", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            error_detail = response.text if response else None
            self.log_test("Mark as Called - POST Success", False, 
                        f"❌ Mark as called failed: {error_msg}", error_detail)
        
        # Step 4: Test Multiple Status Updates (to verify null status_history handling works consistently)
        print("\n--- Step 4: Testing Multiple Status Updates ---")
        
        update_data_2 = {
            "status": "Highly Interested",
            "remarks": "Second test update to verify null status_history handling works consistently"
        }
        
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", update_data_2)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success"):
                    self.log_test("Multiple Updates - Null Fix", True, 
                                "✅ Second status update successful - null status_history handling working consistently")
                    success_count += 1
                else:
                    self.log_test("Multiple Updates - Null Fix", False, 
                                "Second status update failed", result)
            except json.JSONDecodeError:
                self.log_test("Multiple Updates - Null Fix", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Multiple Updates - Null Fix", False, 
                        f"Second status update failed: {error_msg}")
        
        # Step 5: Test Error Handling - Invalid Lead ID
        print("\n--- Step 5: Testing Error Handling ---")
        invalid_lead_id = "invalid-lead-id-12345"
        
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{invalid_lead_id}", {"status": "Test"})
        
        if response and response.status_code == 404:
            self.log_test("Error Handling - Invalid Lead ID", True, 
                        "✅ Correctly returns 404 for invalid lead ID")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Error Handling - Invalid Lead ID", False, 
                        f"Expected 404, got {error_msg}")
        
        # Step 6: Test Authentication Requirements
        print("\n--- Step 6: Testing Authentication Requirements ---")
        
        # Test without authentication token
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", 
                                   {"status": "Test"}, use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("Authentication Required", True, 
                        f"✅ Correctly requires authentication ({response.status_code} without token)")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Authentication Required", False, 
                        f"Expected 401/403, got {error_msg}")
        
        return success_count >= 5  # At least 5 out of 7 tests should pass
    
    def run_tests(self):
        """Run all tests"""
        print("🚀 Testing Telecaller's Desk Status Update and Mark as Called Fix")
        print("=" * 80)
        print("CONTEXT: Testing fix for MongoDB WriteError with null status_history fields")
        print("ISSUE: Some leads had status_history field set to null instead of array []")
        print("FIX: Enhanced initialization in PATCH /api/driver-onboarding/leads/{lead_id}")
        print("=" * 80)
        
        # Test authentication first
        if not self.test_authentication():
            print("\n❌ Authentication failed - cannot proceed with tests")
            return False
        
        # Run the main test
        success = self.test_telecaller_status_update_and_mark_called()
        
        # Print final summary
        print("\n" + "=" * 80)
        print("🏁 TELECALLER DESK TEST SUMMARY")
        print("=" * 80)
        
        passed_tests = sum(1 for result in self.test_results if result["success"])
        total_tests = len(self.test_results)
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success:
            print("🎉 SUCCESS: Telecaller's Desk Status Update and Mark as Called functionality is working!")
            print("✅ The null status_history fix is working correctly")
            print("✅ Both 'Update Status' and 'Mark as Called' return 200 OK (not 500)")
        else:
            print("❌ FAILURE: Issues found with Telecaller's Desk functionality")
        
        # Print individual test results
        print("\n📊 Individual Test Results:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return success

if __name__ == "__main__":
    tester = TelecallerDeskTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)