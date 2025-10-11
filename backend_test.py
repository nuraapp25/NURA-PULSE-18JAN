#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Nura Pulse Application
Tests all backend APIs to verify functionality after fork restoration
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://driver-insights-2.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class NuraPulseBackendTester:
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
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == "POST":
                if files:
                    response = requests.post(url, headers=headers, files=files, timeout=10)
                else:
                    headers["Content-Type"] = "application/json"
                    response = requests.post(url, headers=headers, json=data, timeout=10)
            elif method.upper() == "PUT":
                headers["Content-Type"] = "application/json"
                response = requests.put(url, headers=headers, json=data, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error for {method} {url}: {e}")
            return None
    
    def test_authentication_flow(self):
        """Test 1: Authentication Flow - Login and token verification"""
        print("\n=== Testing Authentication Flow ===")
        
        # Test login
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
        
        # Test /auth/me with token
        response = self.make_request("GET", "/auth/me")
        
        if not response:
            self.log_test("Authentication - Get Me", False, "Network error")
            return False
        
        if response.status_code == 200:
            try:
                user_data = response.json()
                self.log_test("Authentication - Get Me", True, 
                            f"Token verification successful. User ID: {user_data.get('id', 'Unknown')}")
                return True
            except json.JSONDecodeError:
                self.log_test("Authentication - Get Me", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Authentication - Get Me", False, 
                        f"Token verification failed with status {response.status_code}", response.text)
            return False
    
    def test_user_management(self):
        """Test 2: User Management APIs"""
        print("\n=== Testing User Management ===")
        
        # Test get all users
        response = self.make_request("GET", "/users")
        
        if not response:
            self.log_test("User Management - Get Users", False, "Network error")
            return False
        
        if response.status_code == 200:
            try:
                users = response.json()
                self.log_test("User Management - Get Users", True, 
                            f"Retrieved {len(users)} users successfully")
            except json.JSONDecodeError:
                self.log_test("User Management - Get Users", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("User Management - Get Users", False, 
                        f"Failed to get users with status {response.status_code}", response.text)
            return False
        
        # Test get stats
        response = self.make_request("GET", "/stats")
        
        if not response:
            self.log_test("User Management - Get Stats", False, "Network error")
            return False
        
        if response.status_code == 200:
            try:
                stats = response.json()
                self.log_test("User Management - Get Stats", True, 
                            f"Stats retrieved: {stats.get('total_users', 0)} total users, {stats.get('pending_users', 0)} pending")
                return True
            except json.JSONDecodeError:
                self.log_test("User Management - Get Stats", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("User Management - Get Stats", False, 
                        f"Failed to get stats with status {response.status_code}", response.text)
            return False
    
    def test_google_sheets_sync(self):
        """Test 3: Google Sheets Sync"""
        print("\n=== Testing Google Sheets Sync ===")
        
        response = self.make_request("POST", "/users/sync-to-sheets")
        
        if not response:
            self.log_test("Google Sheets - Manual Sync", False, "Network error")
            return False
        
        if response.status_code == 200:
            try:
                result = response.json()
                self.log_test("Google Sheets - Manual Sync", True, 
                            f"Sync successful: {result.get('message', 'No message')}")
                return True
            except json.JSONDecodeError:
                self.log_test("Google Sheets - Manual Sync", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Google Sheets - Manual Sync", False, 
                        f"Sync failed with status {response.status_code}", response.text)
            return False
    
    def test_driver_onboarding_leads(self):
        """Test 4: Driver Onboarding - Leads"""
        print("\n=== Testing Driver Onboarding - Leads ===")
        
        response = self.make_request("GET", "/driver-onboarding/leads")
        
        if not response:
            self.log_test("Driver Onboarding - Get Leads", False, "Network error")
            return False
        
        if response.status_code == 200:
            try:
                leads = response.json()
                self.log_test("Driver Onboarding - Get Leads", True, 
                            f"Retrieved {len(leads)} leads successfully")
                return True
            except json.JSONDecodeError:
                self.log_test("Driver Onboarding - Get Leads", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Driver Onboarding - Get Leads", False, 
                        f"Failed to get leads with status {response.status_code}", response.text)
            return False
    
    def test_payment_reconciliation_apis(self):
        """Test 5: Payment Reconciliation APIs - Full CRUD and Sync"""
        print("\n=== Testing Payment Reconciliation APIs ===")
        
        success_count = 0
        test_payment_id = None
        
        # Test 1: GET all payments (should work even if empty)
        response = self.make_request("GET", "/payment-reconciliation")
        
        if response and response.status_code == 200:
            try:
                payments = response.json()
                self.log_test("Payment Reconciliation - GET All", True, 
                            f"Retrieved {len(payments)} payment records")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Payment Reconciliation - GET All", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Payment Reconciliation - GET All", False, error_msg, 
                        response.text if response else None)
        
        # Test 2: POST create new payment record
        test_payment_data = {
            "transaction_id": f"TEST_TXN_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "amount": 1500.50,
            "payment_method": "UPI",
            "status": "Pending",
            "customer_name": "John Doe",
            "customer_phone": "9876543210",
            "customer_email": "john.doe@example.com",
            "notes": "Test payment record for API validation"
        }
        
        response = self.make_request("POST", "/payment-reconciliation", test_payment_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if "payment" in result:
                    test_payment_id = result["payment"].get("id")
                    self.log_test("Payment Reconciliation - POST Create", True, 
                                f"Created payment record: {result['payment'].get('transaction_id', 'Unknown')}")
                    success_count += 1
                else:
                    self.log_test("Payment Reconciliation - POST Create", False, "No payment data in response", result)
            except json.JSONDecodeError:
                self.log_test("Payment Reconciliation - POST Create", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Payment Reconciliation - POST Create", False, error_msg, 
                        response.text if response else None)
        
        # Test 3: Google Sheets Sync
        response = self.make_request("POST", "/payment-reconciliation/sync")
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                self.log_test("Payment Reconciliation - Sheets Sync", True, 
                            f"Sync successful: {result.get('message', 'No message')}")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Payment Reconciliation - Sheets Sync", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Payment Reconciliation - Sheets Sync", False, error_msg, 
                        response.text if response else None)
        
        return success_count >= 2  # At least GET and POST should work
    
    def test_battery_consumption_analytics(self):
        """Test 6: Battery Consumption Analytics - New endpoint testing"""
        print("\n=== Testing Battery Consumption Analytics ===")
        
        success_count = 0
        
        # Test cases with expected outcomes
        test_cases = [
            {"vehicle_id": "P60G2512500002032", "date": "01 Sep", "expect_data": True},
            {"vehicle_id": "TEST_VEHICLE_001", "date": "15 Aug", "expect_data": False},
            {"vehicle_id": "P60G2512500002032", "date": "02 Sep", "expect_data": False}
        ]
        
        for i, case in enumerate(test_cases, 1):
            vehicle_id = case["vehicle_id"]
            date = case["date"]
            url = f"{self.base_url}/montra-vehicle/analytics/battery-data?vehicle_id={vehicle_id}&date={date}"
            
            try:
                headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
                response = requests.get(url, headers=headers, timeout=10)
                
                if case["expect_data"]:
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            if data.get("success") and "data" in data:
                                data_rows = data["data"]
                                has_column_a = any("A" in str(row) for row in data_rows) if data_rows else False
                                self.log_test(f"Battery Analytics - Test Case {i}", True, 
                                            f"Vehicle {vehicle_id} on {date}: Retrieved {len(data_rows)} rows, Column A data: {'Yes' if has_column_a else 'No'}")
                                success_count += 1
                            else:
                                self.log_test(f"Battery Analytics - Test Case {i}", False, 
                                            f"Invalid response structure for {vehicle_id}")
                        except json.JSONDecodeError:
                            self.log_test(f"Battery Analytics - Test Case {i}", False, 
                                        f"Invalid JSON response for {vehicle_id}")
                    else:
                        self.log_test(f"Battery Analytics - Test Case {i}", False, 
                                    f"Expected 200, got {response.status_code} for {vehicle_id}")
                else:
                    if response.status_code == 404:
                        self.log_test(f"Battery Analytics - Test Case {i}", True, 
                                    f"Vehicle {vehicle_id} on {date}: Correctly returned 404 (no data)")
                        success_count += 1
                    else:
                        self.log_test(f"Battery Analytics - Test Case {i}", False, 
                                    f"Expected 404, got {response.status_code} for {vehicle_id}")
                        
            except Exception as e:
                self.log_test(f"Battery Analytics - Test Case {i}", False, 
                            f"Exception for {vehicle_id}: {e}")
        
        # Test parameter validation
        try:
            headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
            response = requests.get(f"{self.base_url}/montra-vehicle/analytics/battery-data", 
                                  headers=headers, timeout=10)
            if response.status_code == 422:
                self.log_test("Battery Analytics - Parameter Validation", True, 
                            "Correctly rejected missing parameters (422)")
                success_count += 1
            else:
                self.log_test("Battery Analytics - Parameter Validation", False, 
                            f"Expected 422, got {response.status_code}")
        except Exception as e:
            self.log_test("Battery Analytics - Parameter Validation", False, 
                        f"Exception during parameter validation: {e}")
        
        return success_count >= 3  # At least 3 tests should pass
    
    def test_telecaller_queue_assignments(self):
        """Test 7: Telecaller Queue Assignment Endpoints"""
        print("\n=== Testing Telecaller Queue Assignments ===")
        
        success_count = 0
        
        # Test daily assignments endpoint
        response = self.make_request("GET", "/telecaller-queue/daily-assignments")
        
        if response and response.status_code == 200:
            try:
                assignments = response.json()
                telecaller1_count = assignments.get("telecaller1", {}).get("count", 0)
                telecaller2_count = assignments.get("telecaller2", {}).get("count", 0)
                total_assigned = assignments.get("total_assigned", 0)
                
                self.log_test("Telecaller Queue - Daily Assignments", True, 
                            f"Assigned {total_assigned} leads (T1: {telecaller1_count}, T2: {telecaller2_count})")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Telecaller Queue - Daily Assignments", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Telecaller Queue - Daily Assignments", False, error_msg, 
                        response.text if response else None)
        
        # Test regular telecaller queue endpoint
        response = self.make_request("GET", "/telecaller-queue")
        
        if response and response.status_code == 200:
            try:
                tasks = response.json()
                self.log_test("Telecaller Queue - Get Tasks", True, 
                            f"Retrieved {len(tasks)} telecaller tasks")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Telecaller Queue - Get Tasks", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Telecaller Queue - Get Tasks", False, error_msg, 
                        response.text if response else None)
        
        return success_count >= 1
    
    def test_montra_feed_database_management(self):
        """Test 8: Montra Feed Database Management Endpoints"""
        print("\n=== Testing Montra Feed Database Management ===")
        
        success_count = 0
        
        # Test 1: GET /montra-vehicle/feed-database - Retrieve all uploaded feed files
        response = self.make_request("GET", "/montra-vehicle/feed-database")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if "success" in data and "files" in data and "count" in data:
                    files = data["files"]
                    count = data["count"]
                    
                    self.log_test("Montra Feed Database - GET All Files", True, 
                                f"Retrieved {count} feed files from database")
                    
                    # Verify response structure for each file
                    if files and len(files) > 0:
                        sample_file = files[0]
                        required_fields = ["vehicle_id", "date", "record_count", "uploaded_at"]
                        missing_fields = [field for field in required_fields if field not in sample_file]
                        
                        if not missing_fields:
                            self.log_test("Montra Feed Database - File Metadata Structure", True, 
                                        f"File metadata contains all required fields: {required_fields}")
                            success_count += 1
                        else:
                            self.log_test("Montra Feed Database - File Metadata Structure", False, 
                                        f"Missing required fields: {missing_fields}")
                    else:
                        self.log_test("Montra Feed Database - File Metadata Structure", True, 
                                    "No files in database - structure validation skipped")
                        success_count += 1
                    
                    success_count += 1
                else:
                    self.log_test("Montra Feed Database - GET All Files", False, 
                                "Response missing required fields (success, files, count)", data)
            except json.JSONDecodeError:
                self.log_test("Montra Feed Database - GET All Files", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Montra Feed Database - GET All Files", False, error_msg, 
                        response.text if response else None)
        
        # Test 2: Authentication requirement for GET endpoint
        response = self.make_request("GET", "/montra-vehicle/feed-database", use_auth=False)
        
        if response and response.status_code == 401:
            self.log_test("Montra Feed Database - GET Authentication", True, 
                        "Correctly requires authentication (401 without token)")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Montra Feed Database - GET Authentication", False, 
                        f"Expected 401, got {status}")
        
        # Test 3: DELETE /montra-vehicle/feed-database - Test with empty request
        delete_data = []
        response = self.make_request("DELETE", "/montra-vehicle/feed-database", data=delete_data)
        
        if response and response.status_code == 400:
            try:
                error_data = response.json()
                if "detail" in error_data and "No files specified" in error_data["detail"]:
                    self.log_test("Montra Feed Database - DELETE Empty Request", True, 
                                "Correctly rejects empty delete request (400)")
                    success_count += 1
                else:
                    self.log_test("Montra Feed Database - DELETE Empty Request", False, 
                                f"Unexpected error message: {error_data}")
            except json.JSONDecodeError:
                self.log_test("Montra Feed Database - DELETE Empty Request", False, 
                            "Invalid JSON error response", response.text)
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Montra Feed Database - DELETE Empty Request", False, 
                        f"Expected 400, got {status}")
        
        # Test 4: DELETE authentication requirement
        response = self.make_request("DELETE", "/montra-vehicle/feed-database", 
                                   data=[{"vehicle_id": "TEST", "date": "01 Jan", "filename": "test.csv"}], 
                                   use_auth=False)
        
        if response and response.status_code == 401:
            self.log_test("Montra Feed Database - DELETE Authentication", True, 
                        "Correctly requires authentication (401 without token)")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Montra Feed Database - DELETE Authentication", False, 
                        f"Expected 401, got {status}")
        
        # Test 5: DELETE with invalid/non-existent file identifiers
        invalid_delete_data = [
            {"vehicle_id": "NONEXISTENT_VEHICLE", "date": "99 Xxx", "filename": "nonexistent.csv"}
        ]
        response = self.make_request("DELETE", "/montra-vehicle/feed-database", data=invalid_delete_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if "success" in result and "deleted_count" in result:
                    deleted_count = result["deleted_count"]
                    self.log_test("Montra Feed Database - DELETE Invalid Files", True, 
                                f"Handled non-existent files gracefully (deleted {deleted_count} records)")
                    success_count += 1
                else:
                    self.log_test("Montra Feed Database - DELETE Invalid Files", False, 
                                "Response missing required fields", result)
            except json.JSONDecodeError:
                self.log_test("Montra Feed Database - DELETE Invalid Files", False, 
                            "Invalid JSON response", response.text)
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Montra Feed Database - DELETE Invalid Files", False, 
                        f"Expected 200, got {status}")
        
        return success_count >= 4  # At least 4 out of 6 tests should pass
    
    def test_mini_apps_endpoints(self):
        """Test 9: Remaining Mini-Apps Endpoints"""
        print("\n=== Testing Remaining Mini-Apps Endpoints ===")
        
        success_count = 0
        
        # Test Montra Vehicle Insights
        response = self.make_request("GET", "/montra-vehicle-insights")
        
        if response and response.status_code == 200:
            try:
                vehicles = response.json()
                self.log_test("Mini-Apps - Montra Vehicle Insights", True, 
                            f"Retrieved {len(vehicles)} vehicle records")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Mini-Apps - Montra Vehicle Insights", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Mini-Apps - Montra Vehicle Insights", False, error_msg, 
                        response.text if response else None)
        
        return success_count == 1
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Nura Pulse Backend Testing - Focus on Battery Consumption & Payment Reconciliation")
        print(f"Backend URL: {self.base_url}")
        print(f"Master Admin: {MASTER_ADMIN_EMAIL}")
        
        # Test sequence as per requirements
        auth_success = self.test_authentication_flow()
        
        if not auth_success:
            print("\n❌ Authentication failed - cannot proceed with other tests")
            return False
        
        # Core functionality tests
        user_mgmt_success = self.test_user_management()
        sheets_sync_success = self.test_google_sheets_sync()
        leads_success = self.test_driver_onboarding_leads()
        
        # NEW: Priority tests from review request
        payment_reconciliation_success = self.test_payment_reconciliation_apis()
        battery_analytics_success = self.test_battery_consumption_analytics()
        telecaller_assignments_success = self.test_telecaller_queue_assignments()
        
        # NEW: Montra Feed Database Management (from current review request)
        montra_feed_db_success = self.test_montra_feed_database_management()
        
        # Remaining mini-apps
        mini_apps_success = self.test_mini_apps_endpoints()
        
        # Summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Priority test results
        print("\n🎯 PRIORITY TEST RESULTS (Review Request Focus):")
        priority_tests = [
            ("Payment Reconciliation APIs", payment_reconciliation_success),
            ("Battery Consumption Analytics", battery_analytics_success),
            ("Telecaller Queue Assignments", telecaller_assignments_success)
        ]
        
        for test_name, success in priority_tests:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"  {status} {test_name}")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        overall_success = failed_tests == 0
        status = "✅ ALL TESTS PASSED" if overall_success else f"❌ {failed_tests} TESTS FAILED"
        print(f"\n{status}")
        
        return overall_success

def main():
    """Main test execution"""
    tester = NuraPulseBackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()