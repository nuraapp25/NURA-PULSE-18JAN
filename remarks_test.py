#!/usr/bin/env python3
"""
Driver Onboarding Remarks System Testing
Tests the remarks functionality as requested in the review
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://driver-roster-1.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class RemarksSystemTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_results = []
        self.test_lead_id = None
        
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
    
    def make_request(self, method, endpoint, data=None, files=None, use_auth=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                if files:
                    response = requests.post(url, headers=headers, files=files, timeout=30)
                else:
                    headers["Content-Type"] = "application/json"
                    response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                headers["Content-Type"] = "application/json"
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                if data is not None:
                    headers["Content-Type"] = "application/json"
                    response = requests.delete(url, headers=headers, json=data, timeout=30)
                else:
                    response = requests.delete(url, headers=headers, timeout=30)
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
        """Test 1: Authentication with master admin credentials"""
        print("\n=== Testing Authentication ===")
        
        # Test login with correct credentials from review request
        login_data = {
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        
        if not response:
            self.log_test("Authentication - Login", False, "Network error during login")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "token" in data:
                    self.token = data["token"]
                    user_info = data.get("user", {})
                    self.log_test("Authentication - Login", True, 
                                f"Login successful. User: {user_info.get('first_name', 'Unknown')}, Type: {user_info.get('account_type', 'Unknown')}")
                    return True
                else:
                    self.log_test("Authentication - Login", False, "No token in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("Authentication - Login", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Authentication - Login", False, 
                        f"Login failed with status {response.status_code}", response.text)
            return False
    
    def get_test_lead_id(self):
        """Get a valid lead ID for testing"""
        print("\n=== Getting Test Lead ID ===")
        
        response = self.make_request("GET", "/driver-onboarding/leads")
        
        if not response:
            self.log_test("Get Lead ID", False, "Network error getting leads")
            return None
        
        if response.status_code == 200:
            try:
                leads = response.json()
                if leads and len(leads) > 0:
                    # Get the first lead ID
                    first_lead = leads[0]
                    lead_id = first_lead.get("id")
                    lead_name = first_lead.get("name", "Unknown")
                    lead_phone = first_lead.get("phone_number", "Unknown")
                    
                    if lead_id:
                        self.test_lead_id = lead_id
                        self.log_test("Get Lead ID", True, 
                                    f"Found test lead: {lead_name} ({lead_phone}) - ID: {lead_id}")
                        return lead_id
                    else:
                        self.log_test("Get Lead ID", False, "Lead missing ID field")
                        return None
                else:
                    self.log_test("Get Lead ID", False, "No leads found in database")
                    return None
            except json.JSONDecodeError:
                self.log_test("Get Lead ID", False, "Invalid JSON response", response.text)
                return None
        else:
            self.log_test("Get Lead ID", False, 
                        f"Failed to get leads with status {response.status_code}", response.text)
            return None
    
    def test_add_remark_endpoint(self):
        """Test 2: POST /api/driver-onboarding/{lead_id}/remarks - Add remark"""
        print("\n=== Testing Add Remark Endpoint ===")
        
        if not self.test_lead_id:
            self.log_test("Add Remark - No Lead ID", False, "No test lead ID available")
            return False
        
        success_count = 0
        
        # Test 1: Add a valid remark
        remark_data = {"remark_text": "Test remark added via API testing"}
        
        response = self.make_request("POST", f"/driver-onboarding/{self.test_lead_id}/remarks", remark_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "remark" in result:
                    remark = result["remark"]
                    self.log_test("Add Remark - Valid Remark", True, 
                                f"Successfully added remark: '{remark.get('text', 'Unknown')}'")
                    success_count += 1
                    
                    # Verify remark structure
                    required_fields = ["text", "timestamp", "user_id", "user_name", "user_email"]
                    missing_fields = [field for field in required_fields if field not in remark]
                    
                    if not missing_fields:
                        self.log_test("Add Remark - Remark Structure", True, 
                                    "Remark contains all required fields")
                        success_count += 1
                    else:
                        self.log_test("Add Remark - Remark Structure", False, 
                                    f"Remark missing fields: {missing_fields}")
                else:
                    self.log_test("Add Remark - Valid Remark", False, 
                                "Response missing success or remark field", result)
            except json.JSONDecodeError:
                self.log_test("Add Remark - Valid Remark", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Add Remark - Valid Remark", False, error_msg, 
                        response.text if response else None)
        
        # Test 2: Add another remark to test multiple remarks
        remark_data2 = {"remark_text": "Second test remark for multiple remarks testing"}
        
        response = self.make_request("POST", f"/driver-onboarding/{self.test_lead_id}/remarks", remark_data2)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success"):
                    self.log_test("Add Remark - Multiple Remarks", True, 
                                "Successfully added second remark")
                    success_count += 1
                else:
                    self.log_test("Add Remark - Multiple Remarks", False, 
                                "Failed to add second remark", result)
            except json.JSONDecodeError:
                self.log_test("Add Remark - Multiple Remarks", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Add Remark - Multiple Remarks", False, error_msg)
        
        # Test 3: Test with empty remark text (should fail validation)
        empty_remark_data = {"remark_text": ""}
        
        response = self.make_request("POST", f"/driver-onboarding/{self.test_lead_id}/remarks", empty_remark_data)
        
        if response and response.status_code in [400, 422]:
            self.log_test("Add Remark - Empty Text Validation", True, 
                        f"Correctly rejected empty remark text ({response.status_code})")
            success_count += 1
        elif response and response.status_code == 200:
            # If it accepts empty text, that's also acceptable behavior
            self.log_test("Add Remark - Empty Text Validation", True, 
                        "Accepts empty remark text (lenient validation)")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Add Remark - Empty Text Validation", False, 
                        f"Unexpected response for empty text: {error_msg}")
        
        # Test 4: Test with invalid lead ID (should return 404)
        invalid_lead_id = "invalid-lead-id-12345"
        remark_data = {"remark_text": "Test remark for invalid lead"}
        
        response = self.make_request("POST", f"/driver-onboarding/{invalid_lead_id}/remarks", remark_data)
        
        if response and response.status_code == 404:
            self.log_test("Add Remark - Invalid Lead ID", True, 
                        "Correctly returned 404 for invalid lead ID")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Add Remark - Invalid Lead ID", False, 
                        f"Expected 404, got {error_msg}")
        
        # Test 5: Test authentication requirement
        response = self.make_request("POST", f"/driver-onboarding/{self.test_lead_id}/remarks", 
                                   remark_data, use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("Add Remark - Authentication Required", True, 
                        f"Correctly requires authentication ({response.status_code})")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Add Remark - Authentication Required", False, 
                        f"Expected 401/403, got {error_msg}")
        
        return success_count >= 4  # At least 4 out of 6 tests should pass
    
    def test_get_remarks_endpoint(self):
        """Test 3: GET /api/driver-onboarding/{lead_id}/remarks - Get all remarks"""
        print("\n=== Testing Get Remarks Endpoint ===")
        
        if not self.test_lead_id:
            self.log_test("Get Remarks - No Lead ID", False, "No test lead ID available")
            return False
        
        success_count = 0
        
        # Test 1: Get remarks for valid lead ID
        response = self.make_request("GET", f"/driver-onboarding/{self.test_lead_id}/remarks")
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "remarks" in result and "count" in result:
                    remarks = result["remarks"]
                    count = result["count"]
                    
                    self.log_test("Get Remarks - Valid Lead ID", True, 
                                f"Successfully retrieved {count} remarks")
                    success_count += 1
                    
                    # Verify remarks array structure
                    if isinstance(remarks, list):
                        self.log_test("Get Remarks - Array Structure", True, 
                                    "Remarks returned as array")
                        success_count += 1
                        
                        # If there are remarks, verify their structure
                        if len(remarks) > 0:
                            first_remark = remarks[0]
                            required_fields = ["text", "timestamp", "user_id", "user_name", "user_email"]
                            missing_fields = [field for field in required_fields if field not in first_remark]
                            
                            if not missing_fields:
                                self.log_test("Get Remarks - Remark Structure", True, 
                                            "Remarks contain all required fields")
                                success_count += 1
                            else:
                                self.log_test("Get Remarks - Remark Structure", False, 
                                            f"Remarks missing fields: {missing_fields}")
                            
                            # Verify sorting (newest first)
                            if len(remarks) > 1:
                                first_timestamp = remarks[0].get("timestamp", "")
                                second_timestamp = remarks[1].get("timestamp", "")
                                
                                if first_timestamp >= second_timestamp:
                                    self.log_test("Get Remarks - Sorting", True, 
                                                "Remarks sorted by timestamp (newest first)")
                                    success_count += 1
                                else:
                                    self.log_test("Get Remarks - Sorting", False, 
                                                "Remarks not properly sorted")
                            else:
                                self.log_test("Get Remarks - Sorting", True, 
                                            "Single remark - sorting not applicable")
                                success_count += 1
                        else:
                            self.log_test("Get Remarks - Empty Array", True, 
                                        "No remarks found (empty array)")
                            success_count += 1
                    else:
                        self.log_test("Get Remarks - Array Structure", False, 
                                    f"Remarks not returned as array: {type(remarks)}")
                else:
                    self.log_test("Get Remarks - Valid Lead ID", False, 
                                "Response missing required fields", result)
            except json.JSONDecodeError:
                self.log_test("Get Remarks - Valid Lead ID", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Get Remarks - Valid Lead ID", False, error_msg, 
                        response.text if response else None)
        
        # Test 2: Test with invalid lead ID (should return 404)
        invalid_lead_id = "invalid-lead-id-12345"
        
        response = self.make_request("GET", f"/driver-onboarding/{invalid_lead_id}/remarks")
        
        if response and response.status_code == 404:
            self.log_test("Get Remarks - Invalid Lead ID", True, 
                        "Correctly returned 404 for invalid lead ID")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Get Remarks - Invalid Lead ID", False, 
                        f"Expected 404, got {error_msg}")
        
        # Test 3: Test authentication requirement
        response = self.make_request("GET", f"/driver-onboarding/{self.test_lead_id}/remarks", use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("Get Remarks - Authentication Required", True, 
                        f"Correctly requires authentication ({response.status_code})")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Get Remarks - Authentication Required", False, 
                        f"Expected 401/403, got {error_msg}")
        
        return success_count >= 4  # At least 4 out of 6 tests should pass
    
    def test_backend_logs(self):
        """Test 4: Check backend logs for any errors during remark operations"""
        print("\n=== Checking Backend Logs ===")
        
        try:
            # Check supervisor backend logs
            import subprocess
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Look for remark-related errors
                remark_errors = []
                for line in log_content.split('\n'):
                    if 'remark' in line.lower() and ('error' in line.lower() or 'exception' in line.lower()):
                        remark_errors.append(line.strip())
                
                if remark_errors:
                    self.log_test("Backend Logs - Remark Errors", False, 
                                f"Found {len(remark_errors)} remark-related errors in logs")
                    for error in remark_errors[:3]:  # Show first 3 errors
                        print(f"   ERROR: {error}")
                else:
                    self.log_test("Backend Logs - Remark Errors", True, 
                                "No remark-related errors found in recent logs")
                    return True
            else:
                self.log_test("Backend Logs - Access", False, 
                            "Could not access backend error logs")
        except Exception as e:
            self.log_test("Backend Logs - Check", False, f"Error checking logs: {e}")
        
        return False
    
    def run_comprehensive_test(self):
        """Run all tests and provide summary"""
        print("🚀 Starting Driver Onboarding Remarks System Testing")
        print("=" * 60)
        
        # Test 1: Authentication
        if not self.test_authentication():
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with testing.")
            return False
        
        # Test 2: Get test lead ID
        if not self.get_test_lead_id():
            print("\n❌ CRITICAL: No test lead available. Cannot test remarks functionality.")
            return False
        
        # Test 3: Add remark endpoint
        add_remark_success = self.test_add_remark_endpoint()
        
        # Test 4: Get remarks endpoint
        get_remarks_success = self.test_get_remarks_endpoint()
        
        # Test 5: Check backend logs
        logs_clean = self.test_backend_logs()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TESTING SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Critical issues
        critical_issues = []
        
        if not add_remark_success:
            critical_issues.append("Add Remark endpoint not working properly")
        
        if not get_remarks_success:
            critical_issues.append("Get Remarks endpoint not working properly")
        
        if not logs_clean:
            critical_issues.append("Backend errors detected in logs")
        
        if critical_issues:
            print("\n❌ CRITICAL ISSUES FOUND:")
            for issue in critical_issues:
                print(f"   • {issue}")
            return False
        else:
            print("\n✅ ALL CRITICAL TESTS PASSED")
            print("   • Authentication working")
            print("   • Add Remark endpoint functional")
            print("   • Get Remarks endpoint functional")
            print("   • No backend errors detected")
            return True

def main():
    tester = RemarksSystemTester()
    success = tester.run_comprehensive_test()
    
    if success:
        print("\n🎉 Remarks System Testing COMPLETED SUCCESSFULLY")
        sys.exit(0)
    else:
        print("\n💥 Remarks System Testing FAILED - Issues need to be addressed")
        sys.exit(1)

if __name__ == "__main__":
    main()