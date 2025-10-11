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
        self.session = requests.Session()
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
        headers = {"Content-Type": "application/json"}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                if files:
                    # Remove Content-Type for file uploads
                    headers.pop("Content-Type", None)
                    response = self.session.post(url, headers=headers, files=files)
                else:
                    response = self.session.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = self.session.put(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
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
    
    def test_mini_apps_endpoints(self):
        """Test 5: Mini-Apps Endpoints"""
        print("\n=== Testing Mini-Apps Endpoints ===")
        
        success_count = 0
        
        # Test Payment Reconciliation
        response = self.make_request("GET", "/payment-reconciliation")
        
        if response and response.status_code == 200:
            try:
                payments = response.json()
                self.log_test("Mini-Apps - Payment Reconciliation", True, 
                            f"Retrieved {len(payments)} payment records")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Mini-Apps - Payment Reconciliation", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Mini-Apps - Payment Reconciliation", False, error_msg, 
                        response.text if response else None)
        
        # Test Telecaller Queue
        response = self.make_request("GET", "/telecaller-queue")
        
        if response and response.status_code == 200:
            try:
                tasks = response.json()
                self.log_test("Mini-Apps - Telecaller Queue", True, 
                            f"Retrieved {len(tasks)} telecaller tasks")
                success_count += 1
            except json.JSONDecodeError:
                self.log_test("Mini-Apps - Telecaller Queue", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Mini-Apps - Telecaller Queue", False, error_msg, 
                        response.text if response else None)
        
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
        
        return success_count == 3
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Nura Pulse Backend Testing")
        print(f"Backend URL: {self.base_url}")
        print(f"Master Admin: {MASTER_ADMIN_EMAIL}")
        
        # Test sequence as per requirements
        auth_success = self.test_authentication_flow()
        
        if not auth_success:
            print("\n❌ Authentication failed - cannot proceed with other tests")
            return False
        
        user_mgmt_success = self.test_user_management()
        sheets_sync_success = self.test_google_sheets_sync()
        leads_success = self.test_driver_onboarding_leads()
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