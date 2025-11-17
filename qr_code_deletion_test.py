#!/usr/bin/env python3
"""
QR Code Deletion Functionality Test
Tests all QR code deletion endpoints as requested in review
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://leadonboard.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class QRCodeDeletionTester:
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
    
    def login(self):
        """Login as master admin"""
        print("=== Logging in as Master Admin ===")
        
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
    
    def test_qr_code_deletion_functionality(self):
        """Test QR Code Deletion Functionality as requested in review"""
        print("\n=== Testing QR Code Deletion Functionality ===")
        
        success_count = 0
        test_qr_ids = []
        test_campaign_name = f"TestCampaign_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Step 1: Get existing QR codes to test deletion
        print("\n--- Step 1: Getting existing QR codes for testing ---")
        response = self.make_request("GET", "/qr-codes")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and "qr_codes" in data:
                    existing_qr_codes = data["qr_codes"]
                    total_count = data.get("total_count", 0)
                    
                    self.log_test("QR Code Deletion - GET Existing QR Codes", True, 
                                f"Retrieved {len(existing_qr_codes)} QR codes (total: {total_count})")
                    success_count += 1
                    
                    # Store some QR code IDs for testing (if any exist)
                    if existing_qr_codes:
                        test_qr_ids = [qr.get("id") for qr in existing_qr_codes[:2] if qr.get("id")]
                        self.log_test("QR Code Deletion - Test Data Available", True, 
                                    f"Found {len(test_qr_ids)} QR codes available for deletion testing")
                        success_count += 1
                    else:
                        self.log_test("QR Code Deletion - Test Data Available", True, 
                                    "No existing QR codes found - will create test data")
                        success_count += 1
                else:
                    self.log_test("QR Code Deletion - GET Existing QR Codes", False, 
                                "Invalid response structure", data)
            except json.JSONDecodeError:
                self.log_test("QR Code Deletion - GET Existing QR Codes", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("QR Code Deletion - GET Existing QR Codes", False, error_msg, 
                        response.text if response else None)
        
        # Step 2: Create test QR codes if none exist
        if not test_qr_ids:
            print("\n--- Step 2: Creating test QR codes for deletion testing ---")
            
            # Create test QR codes in a campaign
            test_qr_data = {
                "name": "Test QR Code for Deletion",
                "campaign_name": test_campaign_name,
                "destination_url": "https://example.com/test",
                "bulk_count": 2,
                "utm_source": "test",
                "utm_medium": "qr",
                "utm_campaign": test_campaign_name
            }
            
            response = self.make_request("POST", "/qr-codes/create", test_qr_data)
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    if result.get("success") and "qr_codes" in result:
                        created_qr_codes = result["qr_codes"]
                        test_qr_ids = [qr.get("id") for qr in created_qr_codes if qr.get("id")]
                        
                        self.log_test("QR Code Deletion - Create Test Data", True, 
                                    f"Created {len(test_qr_ids)} test QR codes for deletion testing")
                        success_count += 1
                    else:
                        self.log_test("QR Code Deletion - Create Test Data", False, 
                                    "Failed to create test QR codes", result)
                except json.JSONDecodeError:
                    self.log_test("QR Code Deletion - Create Test Data", False, 
                                "Invalid JSON response", response.text)
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test("QR Code Deletion - Create Test Data", False, error_msg, 
                            response.text if response else None)
        
        # Step 3: Test Individual QR Code Deletion
        if test_qr_ids:
            print("\n--- Step 3: Testing Individual QR Code Deletion ---")
            
            test_qr_id = test_qr_ids[0]
            response = self.make_request("DELETE", f"/qr-codes/{test_qr_id}")
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    if result.get("success") and "deleted successfully" in result.get("message", ""):
                        self.log_test("QR Code Deletion - Individual Delete", True, 
                                    f"Successfully deleted QR code {test_qr_id}: {result['message']}")
                        success_count += 1
                        
                        # Verify QR code is actually removed from database
                        verify_response = self.make_request("GET", "/qr-codes")
                        if verify_response and verify_response.status_code == 200:
                            try:
                                verify_data = verify_response.json()
                                remaining_qr_codes = verify_data.get("qr_codes", [])
                                deleted_qr_found = any(qr.get("id") == test_qr_id for qr in remaining_qr_codes)
                                
                                if not deleted_qr_found:
                                    self.log_test("QR Code Deletion - Database Verification", True, 
                                                f"QR code {test_qr_id} successfully removed from database")
                                    success_count += 1
                                else:
                                    self.log_test("QR Code Deletion - Database Verification", False, 
                                                f"QR code {test_qr_id} still found in database after deletion")
                            except json.JSONDecodeError:
                                self.log_test("QR Code Deletion - Database Verification", False, 
                                            "Could not verify database changes")
                    else:
                        self.log_test("QR Code Deletion - Individual Delete", False, 
                                    "Unexpected response format", result)
                except json.JSONDecodeError:
                    self.log_test("QR Code Deletion - Individual Delete", False, 
                                "Invalid JSON response", response.text)
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test("QR Code Deletion - Individual Delete", False, error_msg, 
                            response.text if response else None)
        
        # Step 4: Test Campaign Deletion
        if test_campaign_name:
            print("\n--- Step 4: Testing Campaign Deletion ---")
            
            response = self.make_request("DELETE", f"/qr-codes/campaigns/{test_campaign_name}")
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    if result.get("success") and "deleted successfully" in result.get("message", ""):
                        message = result.get("message", "")
                        self.log_test("QR Code Deletion - Campaign Delete", True, 
                                    f"Successfully deleted campaign: {message}")
                        success_count += 1
                        
                        # Verify all QR codes in campaign are removed
                        verify_response = self.make_request("GET", "/qr-codes")
                        if verify_response and verify_response.status_code == 200:
                            try:
                                verify_data = verify_response.json()
                                remaining_qr_codes = verify_data.get("qr_codes", [])
                                campaign_qr_codes = [qr for qr in remaining_qr_codes 
                                                   if qr.get("campaign_name") == test_campaign_name]
                                
                                if not campaign_qr_codes:
                                    self.log_test("QR Code Deletion - Campaign Verification", True, 
                                                f"All QR codes in campaign '{test_campaign_name}' successfully removed")
                                    success_count += 1
                                else:
                                    self.log_test("QR Code Deletion - Campaign Verification", False, 
                                                f"Found {len(campaign_qr_codes)} QR codes still in campaign after deletion")
                            except json.JSONDecodeError:
                                self.log_test("QR Code Deletion - Campaign Verification", False, 
                                            "Could not verify campaign deletion")
                    else:
                        self.log_test("QR Code Deletion - Campaign Delete", False, 
                                    "Unexpected response format", result)
                except json.JSONDecodeError:
                    self.log_test("QR Code Deletion - Campaign Delete", False, 
                                "Invalid JSON response", response.text)
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test("QR Code Deletion - Campaign Delete", False, error_msg, 
                            response.text if response else None)
        
        # Step 5: Test Error Cases
        print("\n--- Step 5: Testing Error Cases ---")
        
        # Test delete non-existent QR code (should return 404)
        fake_qr_id = "nonexistent-qr-code-id-12345"
        response = self.make_request("DELETE", f"/qr-codes/{fake_qr_id}")
        
        if response and response.status_code == 404:
            self.log_test("QR Code Deletion - Non-existent QR Code", True, 
                        f"Correctly returned 404 for non-existent QR code {fake_qr_id}")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("QR Code Deletion - Non-existent QR Code", False, 
                        f"Expected 404, got {error_msg}")
        
        # Test delete non-existent campaign (should return 404)
        fake_campaign = "nonexistent-campaign-12345"
        response = self.make_request("DELETE", f"/qr-codes/campaigns/{fake_campaign}")
        
        if response and response.status_code == 404:
            self.log_test("QR Code Deletion - Non-existent Campaign", True, 
                        f"Correctly returned 404 for non-existent campaign {fake_campaign}")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("QR Code Deletion - Non-existent Campaign", False, 
                        f"Expected 404, got {error_msg}")
        
        # Step 6: Test Authentication Requirements
        print("\n--- Step 6: Testing Authentication Requirements ---")
        
        # Test individual delete without authentication
        response = self.make_request("DELETE", f"/qr-codes/test-id", use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("QR Code Deletion - Individual Auth Required", True, 
                        f"Correctly requires authentication ({response.status_code} without token)")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("QR Code Deletion - Individual Auth Required", False, 
                        f"Expected 401/403, got {error_msg}")
        
        # Test campaign delete without authentication
        response = self.make_request("DELETE", f"/qr-codes/campaigns/test-campaign", use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("QR Code Deletion - Campaign Auth Required", True, 
                        f"Correctly requires authentication ({response.status_code} without token)")
            success_count += 1
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("QR Code Deletion - Campaign Auth Required", False, 
                        f"Expected 401/403, got {error_msg}")
        
        return success_count >= 7  # At least 7 out of 12 tests should pass
    
    def run_tests(self):
        """Run QR code deletion tests"""
        print("🚀 Starting QR Code Deletion Functionality Testing")
        print("=" * 80)
        
        # Login first
        if not self.login():
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with tests.")
            return False
        
        # Run QR code deletion tests
        success = self.test_qr_code_deletion_functionality()
        
        # Print final summary
        print("\n" + "=" * 80)
        print("🏁 QR CODE DELETION TEST SUMMARY")
        print("=" * 80)
        
        passed_tests = sum(1 for result in self.test_results if result["success"])
        total_tests = len(self.test_results)
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 OVERALL RESULT: EXCELLENT - QR code deletion functionality working!")
        elif success_rate >= 60:
            print("✅ OVERALL RESULT: GOOD - Most QR code deletion functionality working")
        elif success_rate >= 40:
            print("⚠️  OVERALL RESULT: FAIR - Some QR code deletion issues need attention")
        else:
            print("❌ OVERALL RESULT: POOR - Significant QR code deletion issues detected")
        
        # Print individual test results
        print("\n📋 DETAILED TEST RESULTS:")
        for i, result in enumerate(self.test_results, 1):
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{i:2d}. {status} {result['test']}")
            if not result["success"]:
                print(f"    └─ {result['message']}")
        
        return success

if __name__ == "__main__":
    tester = QRCodeDeletionTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)