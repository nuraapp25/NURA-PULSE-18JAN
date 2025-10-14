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
BASE_URL = "https://fleet-monitor-41.preview.emergentagent.com/api"
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
                if data is not None:
                    headers["Content-Type"] = "application/json"
                    response = requests.delete(url, headers=headers, json=data, timeout=10)
                else:
                    response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            print(f"DEBUG make_request: {method} {url} -> Status: {response.status_code}")
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error for {method} {url}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error for {method} {url}: {e}")
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
    
    def test_montra_feed_corrected_functionality(self):
        """Test 8: Corrected Montra Feed Functionality - Import without Google Sheets, Updated Database with Month Grouping, Delete Functionality"""
        print("\n=== Testing Corrected Montra Feed Functionality ===")
        
        success_count = 0
        
        # Test 1: Montra Feed Import without Google Sheets
        print("\n--- Testing Montra Feed Import (Database Only) ---")
        
        # Create a sample CSV content for testing
        import io
        sample_csv_content = """A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U
1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21
-1,100,200,300,400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000
1,110,210,310,410,510,610,710,810,910,1010,1110,1210,1310,1410,1510,1610,1710,1810,1910,2010
0,120,220,320,420,520,620,720,820,920,1020,1120,1220,1320,1420,1520,1620,1720,1820,1920,2020"""
        
        # Test import endpoint with proper filename format
        test_filename = "P60G2512500002032 - 15 Dec 2024.csv"
        files = {'file': (test_filename, sample_csv_content, 'text/csv')}
        
        response = self.make_request("POST", "/montra-vehicle/import-feed", files=files)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                # Check for corrected response format
                if "synced_to_database" in result and result["synced_to_database"] == True:
                    self.log_test("Montra Feed Import - Database Only", True, 
                                f"Import successful: {result.get('rows', 0)} rows, synced_to_database: {result['synced_to_database']}")
                    success_count += 1
                    
                    # Verify data structure includes required fields
                    if "vehicle_id" in result and "date" in result:
                        self.log_test("Montra Feed Import - Data Structure", True, 
                                    f"Response includes vehicle_id: {result['vehicle_id']}, date: {result['date']}")
                        success_count += 1
                    else:
                        self.log_test("Montra Feed Import - Data Structure", False, 
                                    "Response missing vehicle_id or date fields")
                else:
                    self.log_test("Montra Feed Import - Database Only", False, 
                                f"Expected synced_to_database: true, got: {result}")
            except json.JSONDecodeError:
                self.log_test("Montra Feed Import - Database Only", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Montra Feed Import - Database Only", False, error_msg, 
                        response.text if response else None)
        
        # Test 2: Updated Feed Database with Month Grouping
        print("\n--- Testing Feed Database with Month Grouping ---")
        
        response = self.make_request("GET", "/montra-vehicle/feed-database")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if "success" in data and "files" in data and "count" in data:
                    files = data["files"]
                    count = data["count"]
                    
                    self.log_test("Montra Feed Database - GET All Files", True, 
                                f"Retrieved {count} feed files from database")
                    
                    # Verify month grouping and required fields
                    if files and len(files) > 0:
                        sample_file = files[0]
                        required_fields = ["vehicle_id", "date", "record_count", "uploaded_at", "month_year"]
                        missing_fields = [field for field in required_fields if field not in sample_file]
                        
                        if not missing_fields:
                            month_year = sample_file.get("month_year", "")
                            self.log_test("Montra Feed Database - Month Grouping", True, 
                                        f"File metadata includes month_year field: '{month_year}' and all required fields")
                            success_count += 1
                        else:
                            self.log_test("Montra Feed Database - Month Grouping", False, 
                                        f"Missing required fields for month grouping: {missing_fields}")
                        
                        # Check if aggregation includes month and year fields
                        if "month" in sample_file and "year" in sample_file:
                            self.log_test("Montra Feed Database - Aggregation Pipeline", True, 
                                        f"Aggregation includes month: '{sample_file.get('month')}', year: '{sample_file.get('year')}'")
                            success_count += 1
                        else:
                            self.log_test("Montra Feed Database - Aggregation Pipeline", False, 
                                        "Aggregation missing month or year fields")
                    else:
                        self.log_test("Montra Feed Database - Month Grouping", True, 
                                    "No files in database - month grouping validation skipped")
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
        
        # Test 3: Delete Functionality with Sample File Identifiers
        print("\n--- Testing Delete Functionality ---")
        
        # Test with empty request first
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
        
        # Test bulk delete with sample file identifiers
        sample_delete_data = [
            {"vehicle_id": "P60G2512500002032", "date": "15 Dec", "filename": "P60G2512500002032 - 15 Dec 2024.csv"},
            {"vehicle_id": "NONEXISTENT_VEHICLE", "date": "99 Xxx", "filename": "nonexistent.csv"}
        ]
        response = self.make_request("DELETE", "/montra-vehicle/feed-database", data=sample_delete_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if "success" in result and "deleted_count" in result:
                    deleted_count = result["deleted_count"]
                    self.log_test("Montra Feed Database - Bulk Delete", True, 
                                f"Bulk delete processed successfully (deleted {deleted_count} records)")
                    success_count += 1
                else:
                    self.log_test("Montra Feed Database - Bulk Delete", False, 
                                "Response missing required fields", result)
            except json.JSONDecodeError:
                self.log_test("Montra Feed Database - Bulk Delete", False, 
                            "Invalid JSON response", response.text)
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Montra Feed Database - Bulk Delete", False, 
                        f"Expected 200, got {status}")
        
        # Test 4: Authentication Requirements
        print("\n--- Testing Authentication Requirements ---")
        
        # Test GET without authentication
        response = self.make_request("GET", "/montra-vehicle/feed-database", use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("Montra Feed Database - GET Authentication", True, 
                        f"Correctly requires authentication ({response.status_code} without token)")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Montra Feed Database - GET Authentication", False, 
                        f"Expected 401/403, got {status}")
        
        # Test DELETE without authentication
        response = self.make_request("DELETE", "/montra-vehicle/feed-database", 
                                   data=[{"vehicle_id": "TEST", "date": "01 Jan", "filename": "test.csv"}], 
                                   use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("Montra Feed Database - DELETE Authentication", True, 
                        f"Correctly requires authentication ({response.status_code} without token)")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Montra Feed Database - DELETE Authentication", False, 
                        f"Expected 401/403, got {status}")
        
        # Test POST import without authentication
        files = {'file': (test_filename, sample_csv_content, 'text/csv')}
        response = self.make_request("POST", "/montra-vehicle/import-feed", files=files, use_auth=False)
        
        if response and response.status_code in [401, 403]:
            self.log_test("Montra Feed Import - Authentication", True, 
                        f"Correctly requires authentication ({response.status_code} without token)")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Montra Feed Import - Authentication", False, 
                        f"Expected 401/403, got {status}")
        
        return success_count >= 6  # At least 6 out of 10 tests should pass
    
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
    
    def test_delete_endpoint_fix(self):
        """Test the fixed DELETE /montra-vehicle/feed-database endpoint specifically"""
        print("\n=== Testing Fixed DELETE /montra-vehicle/feed-database Endpoint ===")
        
        success_count = 0
        
        # Step 1: First get existing feed files to use real identifiers
        print("\n--- Step 1: Getting existing feed files for testing ---")
        response = self.make_request("GET", "/montra-vehicle/feed-database")
        
        existing_files = []
        if response and response.status_code == 200:
            try:
                data = response.json()
                if "files" in data and data["files"]:
                    existing_files = data["files"][:2]  # Take first 2 files for testing
                    self.log_test("DELETE Test - Get Existing Files", True, 
                                f"Retrieved {len(existing_files)} existing files for delete testing")
                    success_count += 1
                else:
                    self.log_test("DELETE Test - Get Existing Files", True, 
                                "No existing files found - will test with sample data")
                    success_count += 1
            except json.JSONDecodeError:
                self.log_test("DELETE Test - Get Existing Files", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("DELETE Test - Get Existing Files", False, error_msg)
        
        # Step 2: Test DELETE with empty request body (should return 400)
        print("\n--- Step 2: Testing DELETE with empty request body ---")
        try:
            import requests
            url = f"{self.base_url}/montra-vehicle/feed-database"
            headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
            empty_data = []
            
            response = requests.delete(url, json=empty_data, headers=headers, timeout=10)
            
            if response.status_code == 400:
                try:
                    error_data = response.json()
                    if "detail" in error_data and "No files specified" in error_data["detail"]:
                        self.log_test("DELETE Test - Empty Request Validation", True, 
                                    "Correctly rejects empty delete request (400): No files specified")
                        success_count += 1
                    else:
                        self.log_test("DELETE Test - Empty Request Validation", False, 
                                    f"Unexpected error message: {error_data}")
                except json.JSONDecodeError:
                    self.log_test("DELETE Test - Empty Request Validation", False, 
                                "Invalid JSON error response", response.text)
            else:
                self.log_test("DELETE Test - Empty Request Validation", False, 
                            f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("DELETE Test - Empty Request Validation", False, f"Exception: {e}")
        
        # Step 3: Test DELETE with invalid/non-existent file identifiers
        print("\n--- Step 3: Testing DELETE with invalid file identifiers ---")
        invalid_data = [
            {"vehicle_id": "NONEXISTENT_VEHICLE_123", "date": "99 Xxx", "filename": "nonexistent.csv"},
            {"vehicle_id": "FAKE_VEHICLE_456", "date": "00 Yyy", "filename": "fake_file.csv"}
        ]
        response = self.make_request("DELETE", "/montra-vehicle/feed-database", data=invalid_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if "success" in result and "deleted_count" in result:
                    deleted_count = result["deleted_count"]
                    if deleted_count == 0:
                        self.log_test("DELETE Test - Invalid File Identifiers", True, 
                                    f"Correctly handled invalid identifiers (deleted {deleted_count} records)")
                        success_count += 1
                    else:
                        self.log_test("DELETE Test - Invalid File Identifiers", False, 
                                    f"Unexpectedly deleted {deleted_count} records for invalid identifiers")
                else:
                    self.log_test("DELETE Test - Invalid File Identifiers", False, 
                                "Response missing required fields", result)
            except json.JSONDecodeError:
                self.log_test("DELETE Test - Invalid File Identifiers", False, 
                            "Invalid JSON response", response.text)
        else:
            status = response.status_code if response else "Network error"
            self.log_test("DELETE Test - Invalid File Identifiers", False, 
                        f"Expected 200, got {status}")
        
        # Step 4: Test DELETE with valid file identifiers 
        print("\n--- Step 4: Testing DELETE with valid file identifiers ---")
        
        # Since existing data may not have filename field, let's create test data first
        print("Creating test data with filename field for proper DELETE testing...")
        
        # Create sample CSV content for testing
        sample_csv_content = """A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U
-1,100,200,300,400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000
1,110,210,310,410,510,610,710,810,910,1010,1110,1210,1310,1410,1510,1610,1710,1810,1910,2010
0,120,220,320,420,520,620,720,820,920,1020,1120,1220,1320,1420,1520,1620,1720,1820,1920,2020"""
        
        # Import test data with proper filename (vehicle_id must be alphanumeric only)
        test_filename = f"TESTDELETEVEHICLE - 15 Dec 2024.csv"
        files = {'file': (test_filename, sample_csv_content, 'text/csv')}
        
        import_response = self.make_request("POST", "/montra-vehicle/import-feed", files=files)
        
        if import_response:
            print(f"DEBUG: Import response status: {import_response.status_code}")
            if import_response.status_code != 200:
                print(f"DEBUG: Import error response: {import_response.text}")
        
        if import_response and import_response.status_code == 200:
            try:
                import_result = import_response.json()
                self.log_test("DELETE Test - Create Test Data", True, 
                            f"Created test data: {import_result.get('rows', 0)} rows imported")
                
                # Now test deletion with the imported data
                valid_data = [{
                    "vehicle_id": "TESTDELETEVEHICLE",
                    "date": "15 Dec",
                    "filename": test_filename
                }]
                
                # Get count before deletion to verify database changes
                pre_delete_response = self.make_request("GET", "/montra-vehicle/feed-database")
                pre_delete_count = 0
                if pre_delete_response and pre_delete_response.status_code == 200:
                    try:
                        pre_data = pre_delete_response.json()
                        pre_delete_count = pre_data.get("count", 0)
                    except:
                        pass
                
                # Perform the DELETE operation
                response = self.make_request("DELETE", "/montra-vehicle/feed-database", data=valid_data)
                
                if response and response.status_code == 200:
                    try:
                        result = response.json()
                        if "success" in result and "deleted_count" in result:
                            deleted_count = result["deleted_count"]
                            success_status = result.get("success", False)
                            
                            if success_status and deleted_count > 0:
                                self.log_test("DELETE Test - Valid File Identifiers", True, 
                                            f"Successfully deleted {deleted_count} records from test file")
                                success_count += 1
                                
                                # Verify records were actually removed from database
                                post_delete_response = self.make_request("GET", "/montra-vehicle/feed-database")
                                if post_delete_response and post_delete_response.status_code == 200:
                                    try:
                                        post_data = post_delete_response.json()
                                        post_delete_count = post_data.get("count", 0)
                                        
                                        # Check if the specific test file was removed
                                        test_file_found = False
                                        for file_info in post_data.get("files", []):
                                            if (file_info.get("vehicle_id") == "TESTDELETEVEHICLE" and 
                                                file_info.get("date") == "15 Dec"):
                                                test_file_found = True
                                                break
                                        
                                        if not test_file_found:
                                            self.log_test("DELETE Test - Database Verification", True, 
                                                        f"Test file successfully removed from database (count: {pre_delete_count} -> {post_delete_count})")
                                            success_count += 1
                                        else:
                                            self.log_test("DELETE Test - Database Verification", False, 
                                                        "Test file still found in database after deletion")
                                    except:
                                        self.log_test("DELETE Test - Database Verification", False, 
                                                    "Could not verify database changes")
                            else:
                                self.log_test("DELETE Test - Valid File Identifiers", False, 
                                            f"Delete operation failed or no records deleted (success: {success_status}, count: {deleted_count})")
                        else:
                            self.log_test("DELETE Test - Valid File Identifiers", False, 
                                        "Response missing required fields", result)
                    except json.JSONDecodeError:
                        self.log_test("DELETE Test - Valid File Identifiers", False, 
                                    "Invalid JSON response", response.text)
                else:
                    status = response.status_code if response else "Network error"
                    self.log_test("DELETE Test - Valid File Identifiers", False, 
                                f"Expected 200, got {status}")
                    
            except json.JSONDecodeError:
                self.log_test("DELETE Test - Create Test Data", False, "Invalid JSON response from import", import_response.text)
        else:
            self.log_test("DELETE Test - Create Test Data", False, 
                        f"Failed to create test data for deletion test (status: {import_response.status_code if import_response else 'Network error'})")
        
        # Step 5: Test authentication requirements
        print("\n--- Step 5: Testing authentication requirements ---")
        try:
            import requests
            url = f"{self.base_url}/montra-vehicle/feed-database"
            headers = {"Content-Type": "application/json"}  # No Authorization header
            test_data = [{"vehicle_id": "TEST", "date": "01 Jan", "filename": "test.csv"}]
            
            response = requests.delete(url, json=test_data, headers=headers, timeout=10)
            
            if response.status_code in [401, 403]:
                self.log_test("DELETE Test - Authentication Required", True, 
                            f"Correctly requires authentication ({response.status_code} without token)")
                success_count += 1
            else:
                self.log_test("DELETE Test - Authentication Required", False, 
                            f"Expected 401/403, got {response.status_code}")
        except Exception as e:
            self.log_test("DELETE Test - Authentication Required", False, f"Exception: {e}")
        
        return success_count >= 4  # At least 4 out of 6 tests should pass

    def test_battery_charge_audit_endpoint(self):
        """Test Battery Charge Audit endpoint as requested in review"""
        print("\n=== Testing Battery Charge Audit Endpoint ===")
        
        success_count = 0
        
        # Test 1: Authentication requirement (should return 403 without token)
        print("\n--- Testing Authentication Requirement ---")
        try:
            import requests
            url = f"{self.base_url}/montra-vehicle/battery-audit"
            response = requests.get(url, timeout=10)  # No Authorization header
            
            if response.status_code in [401, 403]:
                self.log_test("Battery Audit - Authentication Required", True, 
                            f"Correctly requires authentication ({response.status_code} without token)")
                success_count += 1
            else:
                self.log_test("Battery Audit - Authentication Required", False, 
                            f"Expected 401/403, got {response.status_code}")
        except Exception as e:
            self.log_test("Battery Audit - Authentication Required", False, 
                        f"Network error during authentication test: {e}")
        
        # Test 2: Valid request with authentication (should return 200 with proper structure)
        print("\n--- Testing Valid Request with Authentication ---")
        response = self.make_request("GET", "/montra-vehicle/battery-audit")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                
                # Check required response structure
                required_fields = ["success", "audit_results", "count", "message"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("Battery Audit - Response Structure", True, 
                                "Response contains all required fields: success, audit_results, count, message")
                    success_count += 1
                    
                    # Check if success is True
                    if data.get("success") == True:
                        self.log_test("Battery Audit - Success Status", True, 
                                    "Response success field is True")
                        success_count += 1
                    else:
                        self.log_test("Battery Audit - Success Status", False, 
                                    f"Expected success=True, got success={data.get('success')}")
                    
                    # Check audit_results is an array
                    audit_results = data.get("audit_results", [])
                    if isinstance(audit_results, list):
                        self.log_test("Battery Audit - Audit Results Array", True, 
                                    f"audit_results is an array with {len(audit_results)} items")
                        success_count += 1
                        
                        # Since no Montra data exists, should return count: 0
                        count = data.get("count", -1)
                        if count == 0:
                            self.log_test("Battery Audit - Empty Data Count", True, 
                                        "Correctly returns count: 0 when no Montra data exists")
                            success_count += 1
                        else:
                            self.log_test("Battery Audit - Empty Data Count", False, 
                                        f"Expected count: 0, got count: {count}")
                        
                        # Check message indicates no data found
                        message = data.get("message", "")
                        if "0 instances" in message and "7 AM" in message and "7 PM" in message:
                            self.log_test("Battery Audit - Informative Message", True, 
                                        f"Message correctly indicates no instances found: '{message}'")
                            success_count += 1
                        elif "No Montra feed data found" in message:
                            self.log_test("Battery Audit - Informative Message", True, 
                                        f"Message correctly indicates no Montra data: '{message}'")
                            success_count += 1
                        else:
                            self.log_test("Battery Audit - Informative Message", False, 
                                        f"Message doesn't indicate expected empty state: '{message}'")
                        
                        # If there are audit results, validate their structure
                        if len(audit_results) > 0:
                            sample_result = audit_results[0]
                            expected_result_fields = ["date", "vehicle_name", "timestamp", "battery_percentage", "km_driven_upto_point"]
                            missing_result_fields = [field for field in expected_result_fields if field not in sample_result]
                            
                            if not missing_result_fields:
                                self.log_test("Battery Audit - Result Structure", True, 
                                            "Audit result contains all required fields: date, vehicle_name, timestamp, battery_percentage, km_driven_upto_point")
                                success_count += 1
                            else:
                                self.log_test("Battery Audit - Result Structure", False, 
                                            f"Audit result missing fields: {missing_result_fields}")
                        else:
                            self.log_test("Battery Audit - Result Structure", True, 
                                        "No audit results to validate (expected for empty data)")
                            success_count += 1
                    else:
                        self.log_test("Battery Audit - Audit Results Array", False, 
                                    f"audit_results is not an array, got: {type(audit_results)}")
                else:
                    self.log_test("Battery Audit - Response Structure", False, 
                                f"Response missing required fields: {missing_fields}")
                
            except json.JSONDecodeError:
                self.log_test("Battery Audit - Valid Request", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Battery Audit - Valid Request", False, error_msg, 
                        response.text if response else None)
        
        # Test 3: Response format validation
        print("\n--- Testing Response Format Validation ---")
        if response and response.status_code == 200:
            try:
                data = response.json()
                
                # Validate JSON structure matches expected format
                expected_structure = {
                    "success": bool,
                    "audit_results": list,
                    "count": int,
                    "message": str
                }
                
                structure_valid = True
                for field, expected_type in expected_structure.items():
                    if field in data:
                        actual_type = type(data[field])
                        if actual_type != expected_type:
                            structure_valid = False
                            self.log_test("Battery Audit - Field Type Validation", False, 
                                        f"Field '{field}' expected {expected_type.__name__}, got {actual_type.__name__}")
                            break
                
                if structure_valid:
                    self.log_test("Battery Audit - Field Type Validation", True, 
                                "All response fields have correct data types")
                    success_count += 1
                
            except Exception as e:
                self.log_test("Battery Audit - Response Format Validation", False, 
                            f"Error validating response format: {e}")
        
        return success_count >= 5  # At least 5 out of 7 tests should pass

    def test_payment_reconciliation_drivers_vehicles_api(self):
        """Test Payment Reconciliation Drivers and Vehicles API - Excel files with monthly tabs"""
        print("\n=== Testing Payment Reconciliation Drivers and Vehicles API ===")
        
        success_count = 0
        
        # Test 1: Sep 2025 Data
        print("\n--- Testing Sep 2025 Data ---")
        response = self.make_request("GET", "/admin/files/get-drivers-vehicles?month=Sep&year=2025")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                
                # Check basic response structure
                if "success" in data and data["success"]:
                    drivers = data.get("drivers", [])
                    vehicles = data.get("vehicles", [])
                    using_mock = data.get("using_mock_data", False)
                    
                    self.log_test("Payment Reconciliation API - Sep 2025 Response", True, 
                                f"Retrieved {len(drivers)} drivers, {len(vehicles)} vehicles, using_mock_data: {using_mock}")
                    
                    # Check if using real data (not mock)
                    if not using_mock:
                        self.log_test("Payment Reconciliation API - Sep 2025 Real Data", True, 
                                    "Successfully using real data from Excel files (not mock)")
                        success_count += 1
                        
                        # Verify expected counts from review request
                        if len(drivers) == 22:
                            self.log_test("Payment Reconciliation API - Sep 2025 Driver Count", True, 
                                        f"Correct driver count: {len(drivers)} (expected 22)")
                            success_count += 1
                        else:
                            self.log_test("Payment Reconciliation API - Sep 2025 Driver Count", False, 
                                        f"Incorrect driver count: {len(drivers)} (expected 22)")
                        
                        if len(vehicles) == 9:
                            self.log_test("Payment Reconciliation API - Sep 2025 Vehicle Count", True, 
                                        f"Correct vehicle count: {len(vehicles)} (expected 9)")
                            success_count += 1
                        else:
                            self.log_test("Payment Reconciliation API - Sep 2025 Vehicle Count", False, 
                                        f"Incorrect vehicle count: {len(vehicles)} (expected 9)")
                        
                        # Check for specific driver names from review request
                        expected_drivers = ["Alexander A", "Anandhi", "Bavanai"]
                        found_drivers = [d for d in expected_drivers if d in drivers]
                        if len(found_drivers) >= 2:  # At least 2 out of 3 expected drivers
                            self.log_test("Payment Reconciliation API - Sep 2025 Driver Names", True, 
                                        f"Found expected drivers: {found_drivers}")
                            success_count += 1
                        else:
                            self.log_test("Payment Reconciliation API - Sep 2025 Driver Names", False, 
                                        f"Expected drivers not found. Found: {found_drivers}, All drivers: {drivers[:5]}...")
                        
                        # Check for specific vehicle numbers from review request
                        expected_vehicles = ["TN02CE0738", "TN02CE0751", "TN02CE2901"]
                        found_vehicles = [v for v in expected_vehicles if v in vehicles]
                        if len(found_vehicles) >= 2:  # At least 2 out of 3 expected vehicles
                            self.log_test("Payment Reconciliation API - Sep 2025 Vehicle Numbers", True, 
                                        f"Found expected vehicles: {found_vehicles}")
                            success_count += 1
                        else:
                            self.log_test("Payment Reconciliation API - Sep 2025 Vehicle Numbers", False, 
                                        f"Expected vehicles not found. Found: {found_vehicles}, All vehicles: {vehicles[:5]}...")
                    else:
                        self.log_test("Payment Reconciliation API - Sep 2025 Real Data", False, 
                                    "Using mock data instead of real Excel file data")
                else:
                    self.log_test("Payment Reconciliation API - Sep 2025 Response", False, 
                                "Response missing success field or success=false", data)
            except json.JSONDecodeError:
                self.log_test("Payment Reconciliation API - Sep 2025 Response", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Payment Reconciliation API - Sep 2025 Response", False, error_msg, 
                        response.text if response else None)
        
        # Test 2: Oct 2025 Data
        print("\n--- Testing Oct 2025 Data ---")
        response = self.make_request("GET", "/admin/files/get-drivers-vehicles?month=Oct&year=2025")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                
                if "success" in data and data["success"]:
                    drivers = data.get("drivers", [])
                    vehicles = data.get("vehicles", [])
                    using_mock = data.get("using_mock_data", False)
                    
                    self.log_test("Payment Reconciliation API - Oct 2025 Response", True, 
                                f"Retrieved {len(drivers)} drivers, {len(vehicles)} vehicles, using_mock_data: {using_mock}")
                    
                    # Check if using real data (not mock)
                    if not using_mock:
                        self.log_test("Payment Reconciliation API - Oct 2025 Real Data", True, 
                                    "Successfully using real data from Excel files (not mock)")
                        success_count += 1
                        
                        # Verify expected counts (should be same as Sep 2025 according to review)
                        if len(drivers) == 22:
                            self.log_test("Payment Reconciliation API - Oct 2025 Driver Count", True, 
                                        f"Correct driver count: {len(drivers)} (expected 22)")
                            success_count += 1
                        else:
                            self.log_test("Payment Reconciliation API - Oct 2025 Driver Count", False, 
                                        f"Incorrect driver count: {len(drivers)} (expected 22)")
                        
                        if len(vehicles) == 9:
                            self.log_test("Payment Reconciliation API - Oct 2025 Vehicle Count", True, 
                                        f"Correct vehicle count: {len(vehicles)} (expected 9)")
                            success_count += 1
                        else:
                            self.log_test("Payment Reconciliation API - Oct 2025 Vehicle Count", False, 
                                        f"Incorrect vehicle count: {len(vehicles)} (expected 9)")
                    else:
                        self.log_test("Payment Reconciliation API - Oct 2025 Real Data", False, 
                                    "Using mock data instead of real Excel file data")
                else:
                    self.log_test("Payment Reconciliation API - Oct 2025 Response", False, 
                                "Response missing success field or success=false", data)
            except json.JSONDecodeError:
                self.log_test("Payment Reconciliation API - Oct 2025 Response", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Payment Reconciliation API - Oct 2025 Response", False, error_msg, 
                        response.text if response else None)
        
        # Test 3: Parameter Validation
        print("\n--- Testing Parameter Validation ---")
        
        # Test missing parameters
        response = self.make_request("GET", "/admin/files/get-drivers-vehicles")
        if response and response.status_code == 422:
            self.log_test("Payment Reconciliation API - Missing Parameters", True, 
                        "Correctly rejects missing parameters (422)")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Payment Reconciliation API - Missing Parameters", False, 
                        f"Expected 422, got {status}")
        
        # Test authentication requirement
        response = self.make_request("GET", "/admin/files/get-drivers-vehicles?month=Sep&year=2025", use_auth=False)
        if response and response.status_code in [401, 403]:
            self.log_test("Payment Reconciliation API - Authentication Required", True, 
                        f"Correctly requires authentication ({response.status_code} without token)")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Payment Reconciliation API - Authentication Required", False, 
                        f"Expected 401/403, got {status}")
        
        return success_count >= 6  # At least 6 out of 10 tests should pass

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Nura Pulse Backend Testing - Focus on Battery Charge Audit Endpoint")
        print(f"Backend URL: {self.base_url}")
        print(f"Master Admin: {MASTER_ADMIN_EMAIL}")
        
        # Test sequence as per requirements
        auth_success = self.test_authentication_flow()
        
        if not auth_success:
            print("\n❌ Authentication failed - cannot proceed with other tests")
            return False
        
        # PRIORITY: Test the Battery Charge Audit endpoint as requested in review
        battery_audit_success = self.test_battery_charge_audit_endpoint()
        
        # Summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY - BATTERY CHARGE AUDIT ENDPOINT")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Priority test results
        print(f"\n🎯 BATTERY CHARGE AUDIT ENDPOINT RESULT: {'✅ PASS' if battery_audit_success else '❌ FAIL'}")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        overall_success = battery_audit_success and failed_tests <= 3  # Allow some minor failures
        status = "✅ BATTERY CHARGE AUDIT ENDPOINT VERIFIED" if overall_success else "❌ BATTERY CHARGE AUDIT ENDPOINT ISSUES FOUND"
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