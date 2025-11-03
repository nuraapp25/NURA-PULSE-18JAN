#!/usr/bin/env python3
"""
Focused Backend Testing for Review Request Issues
1. Remarks persistence in Lead Details Dialog
2. Export Database functionality
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://driver-onboard-4.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class ReviewRequestTester:
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
            print(f"   Response: {str(response_data)[:200]}...")
    
    def make_request(self, method, endpoint, data=None, use_auth=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "PATCH":
                headers["Content-Type"] = "application/json"
                response = requests.patch(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "POST":
                headers["Content-Type"] = "application/json"
                response = requests.post(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error for {method} {url}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error for {method} {url}: {e}")
            return None
    
    def test_authentication(self):
        """Test authentication and get token"""
        print("🔐 Authenticating...")
        
        login_data = {
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
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
                                f"Login successful. User: {user_info.get('first_name', 'Unknown')}")
                    return True
                else:
                    self.log_test("Authentication", False, "No token in response")
                    return False
            except json.JSONDecodeError:
                self.log_test("Authentication", False, "Invalid JSON response")
                return False
        else:
            self.log_test("Authentication", False, 
                        f"Login failed with status {response.status_code}")
            return False
    
    def test_remarks_persistence(self):
        """Test remarks persistence workflow"""
        print("\n🔥 CRITICAL TEST 1: Remarks Persistence Workflow")
        print("=" * 60)
        
        success_count = 0
        
        # Step 1: Get test lead ID
        print("--- Step 1: Fetching test lead ---")
        response = self.make_request("GET", "/driver-onboarding/leads")
        
        if not response or response.status_code != 200:
            self.log_test("Remarks - Get Lead", False, "Failed to fetch leads")
            return False
        
        try:
            leads = response.json()
            if not leads or len(leads) == 0:
                self.log_test("Remarks - Get Lead", False, "No leads found in database")
                return False
            
            test_lead = leads[0]
            test_lead_id = test_lead.get("id")
            lead_name = test_lead.get("name", "Unknown")
            
            self.log_test("Remarks - Get Lead", True, 
                        f"Found test lead: {lead_name} (ID: {test_lead_id})")
            success_count += 1
            
        except json.JSONDecodeError:
            self.log_test("Remarks - Get Lead", False, "Invalid JSON response")
            return False
        
        # Step 2: Save first remarks
        print("--- Step 2: Saving first remarks ---")
        first_remarks = "Test remark 1 - First save"
        update_data = {"remarks": first_remarks}
        
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", update_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                self.log_test("Remarks - First PATCH", True, 
                            f"First remarks saved successfully")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Remarks - First PATCH", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Remarks - First PATCH", False, f"PATCH failed: {status}")
        
        # Step 3: Verify first remarks persisted
        print("--- Step 3: Verifying first remarks persistence ---")
        response = self.make_request("GET", f"/driver-onboarding/leads/{test_lead_id}")
        
        if response and response.status_code == 200:
            try:
                lead_data = response.json()
                stored_remarks = lead_data.get("remarks")
                if stored_remarks == first_remarks:
                    self.log_test("Remarks - First GET Verification", True, 
                                f"First remarks correctly persisted: '{stored_remarks}'")
                    success_count += 1
                else:
                    self.log_test("Remarks - First GET Verification", False, 
                                f"Remarks mismatch - Expected: '{first_remarks}', Got: '{stored_remarks}'")
            except json.JSONDecodeError:
                self.log_test("Remarks - First GET Verification", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Remarks - First GET Verification", False, f"GET failed: {status}")
        
        # Step 4: Update remarks
        print("--- Step 4: Updating remarks ---")
        updated_remarks = "Test remark 2 - Updated remarks"
        update_data = {"remarks": updated_remarks}
        
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", update_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                self.log_test("Remarks - Updated PATCH", True, 
                            f"Updated remarks saved successfully")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Remarks - Updated PATCH", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Remarks - Updated PATCH", False, f"PATCH failed: {status}")
        
        # Step 5: Verify updated remarks persisted
        print("--- Step 5: Verifying updated remarks persistence ---")
        response = self.make_request("GET", f"/driver-onboarding/leads/{test_lead_id}")
        
        if response and response.status_code == 200:
            try:
                lead_data = response.json()
                stored_remarks = lead_data.get("remarks")
                if stored_remarks == updated_remarks:
                    self.log_test("Remarks - Updated GET Verification", True, 
                                f"Updated remarks correctly persisted: '{stored_remarks}'")
                    success_count += 1
                else:
                    self.log_test("Remarks - Updated GET Verification", False, 
                                f"Remarks mismatch - Expected: '{updated_remarks}', Got: '{stored_remarks}'")
            except json.JSONDecodeError:
                self.log_test("Remarks - Updated GET Verification", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Remarks - Updated GET Verification", False, f"GET failed: {status}")
        
        # Step 6: Check PATCH response contains lead object with remarks
        print("--- Step 6: Verifying PATCH response structure ---")
        final_remarks = "Test remark 3 - Final verification"
        update_data = {"remarks": final_remarks}
        
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", update_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                # Check for lead object in response
                lead_object = None
                if "data" in result and "lead" in result["data"]:
                    lead_object = result["data"]["lead"]
                elif "lead" in result:
                    lead_object = result["lead"]
                
                if lead_object and lead_object.get("remarks") == final_remarks:
                    self.log_test("Remarks - PATCH Response Structure", True, 
                                f"PATCH response contains lead object with remarks field")
                    success_count += 1
                else:
                    self.log_test("Remarks - PATCH Response Structure", False, 
                                f"PATCH response missing lead object with remarks. Keys: {list(result.keys())}")
            except json.JSONDecodeError:
                self.log_test("Remarks - PATCH Response Structure", False, "Invalid JSON response")
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Remarks - PATCH Response Structure", False, f"PATCH failed: {status}")
        
        print(f"\n📊 Remarks Persistence: {success_count}/6 tests passed")
        return success_count >= 4  # At least 4 out of 6 tests should pass
    
    def test_export_database(self):
        """Test Export Database functionality"""
        print("\n🔥 CRITICAL TEST 2: Export Database Functionality")
        print("=" * 60)
        
        success_count = 0
        
        # Test the export endpoint
        print("--- Testing GET /api/admin/database/export ---")
        response = self.make_request("GET", "/admin/database/export")
        
        if response and response.status_code == 200:
            # Check Content-Type
            content_type = response.headers.get('Content-Type', '')
            if 'application/json' in content_type:
                self.log_test("Export - Content Type", True, f"Correct Content-Type: {content_type}")
                success_count += 1
            else:
                self.log_test("Export - Content Type", False, f"Wrong Content-Type: {content_type}")
            
            # Check Content-Disposition
            content_disposition = response.headers.get('Content-Disposition', '')
            if 'filename' in content_disposition:
                self.log_test("Export - Content Disposition", True, f"Has filename header")
                success_count += 1
            else:
                self.log_test("Export - Content Disposition", False, "Missing filename header")
            
            try:
                data = response.json()
                
                # Check export_timestamp
                if 'export_timestamp' in data:
                    self.log_test("Export - Timestamp", True, f"Has export_timestamp: {data['export_timestamp']}")
                    success_count += 1
                else:
                    self.log_test("Export - Timestamp", False, "Missing export_timestamp")
                
                # Check exported_by
                if 'exported_by' in data:
                    self.log_test("Export - Exported By", True, f"Has exported_by: {data['exported_by']}")
                    success_count += 1
                else:
                    self.log_test("Export - Exported By", False, "Missing exported_by")
                
                # Check collections
                if 'collections' in data and isinstance(data['collections'], dict):
                    collections = data['collections']
                    collection_count = len(collections)
                    
                    total_records = 0
                    for collection_name, collection_data in collections.items():
                        if isinstance(collection_data, list):
                            total_records += len(collection_data)
                    
                    self.log_test("Export - Collections", True, 
                                f"Has {collection_count} collections with {total_records} total records")
                    success_count += 1
                else:
                    self.log_test("Export - Collections", False, "Missing or invalid collections object")
                
            except json.JSONDecodeError:
                self.log_test("Export - JSON Parse", False, "Response is not valid JSON")
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Export - Endpoint", False, f"Export failed: {status}")
        
        # Test authentication requirement
        print("--- Testing authentication requirement ---")
        response = self.make_request("GET", "/admin/database/export", use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("Export - Authentication", True, f"Correctly requires auth ({response.status_code})")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Export - Authentication", False, f"Auth check failed: {status}")
        
        print(f"\n📊 Export Database: {success_count}/6 tests passed")
        return success_count >= 4  # At least 4 out of 6 tests should pass
    
    def run_tests(self):
        """Run all tests"""
        print("🚀 REVIEW REQUEST BACKEND TESTING")
        print("=" * 80)
        print("FOCUS: Remarks Persistence & Export Database Issues")
        print("=" * 80)
        
        # Authenticate
        if not self.test_authentication():
            print("\n❌ Authentication failed. Cannot proceed.")
            return False
        
        # Run critical tests
        tests = [
            ("Remarks Persistence", self.test_remarks_persistence),
            ("Export Database", self.test_export_database)
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed_tests += 1
                    print(f"✅ {test_name} - PASSED")
                else:
                    print(f"❌ {test_name} - FAILED")
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {e}")
        
        # Summary
        print("\n" + "=" * 80)
        print("🏁 TESTING COMPLETE")
        print("=" * 80)
        
        success_rate = (passed_tests / total_tests) * 100
        print(f"✅ Passed: {passed_tests}/{total_tests} tests ({success_rate:.1f}%)")
        
        if success_rate == 100:
            print("🎉 STATUS: EXCELLENT - Both critical issues resolved!")
        elif success_rate >= 50:
            print("⚠️  STATUS: PARTIAL - Some issues remain")
        else:
            print("🚨 STATUS: FAILED - Critical issues need attention")
        
        # Detailed results
        print(f"\n📊 DETAILED RESULTS:")
        print("-" * 50)
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return success_rate >= 50

if __name__ == "__main__":
    tester = ReviewRequestTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)