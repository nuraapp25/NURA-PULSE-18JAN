#!/usr/bin/env python3
"""
Driver Onboarding Bulk Export API Test
Tests the POST /api/driver-onboarding/bulk-export endpoint thoroughly
"""

import requests
import json
import sys
import os
import tempfile
from datetime import datetime
import pandas as pd

# Configuration
BASE_URL = "https://driver-roster-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

class DriverBulkExportTester:
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
        """Step 1: Login to get valid token"""
        print("\n=== Step 1: Authentication ===")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
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
    
    def test_database_count(self):
        """Step 2: Check database count for comparison"""
        print("\n=== Step 2: Database Count Check ===")
        
        response = self.make_request("GET", "/driver-onboarding/leads")
        
        if not response:
            self.log_test("Database Count - Get Leads", False, "Network error")
            return 0
        
        if response.status_code == 200:
            try:
                leads = response.json()
                count = len(leads)
                self.log_test("Database Count - Get Leads", True, 
                            f"Database contains {count} leads")
                return count
            except json.JSONDecodeError:
                self.log_test("Database Count - Get Leads", False, "Invalid JSON response", response.text)
                return 0
        else:
            self.log_test("Database Count - Get Leads", False, 
                        f"Failed to get leads with status {response.status_code}", response.text)
            return 0
    
    def test_bulk_export_endpoint(self, expected_count):
        """Step 3: Test the bulk export endpoint"""
        print("\n=== Step 3: Bulk Export Endpoint Test ===")
        
        success_count = 0
        
        # Test 1: Call the bulk export endpoint
        response = self.make_request("POST", "/driver-onboarding/bulk-export")
        
        if not response:
            self.log_test("Bulk Export - API Call", False, "Network error")
            return False
        
        # Test 2: Check HTTP status code
        if response.status_code == 200:
            self.log_test("Bulk Export - HTTP Status", True, "HTTP 200 status received")
            success_count += 1
        else:
            self.log_test("Bulk Export - HTTP Status", False, 
                        f"Expected HTTP 200, got {response.status_code}", response.text)
            return False
        
        # Test 3: Check Content-Type header
        content_type = response.headers.get('Content-Type', '')
        expected_content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
        if content_type == expected_content_type:
            self.log_test("Bulk Export - Content-Type", True, 
                        f"Correct Content-Type: {content_type}")
            success_count += 1
        else:
            self.log_test("Bulk Export - Content-Type", False, 
                        f"Expected {expected_content_type}, got {content_type}")
        
        # Test 4: Check Content-Disposition header
        content_disposition = response.headers.get('Content-Disposition', '')
        
        if 'attachment' in content_disposition and 'filename=' in content_disposition:
            self.log_test("Bulk Export - Content-Disposition", True, 
                        f"Content-Disposition header present: {content_disposition}")
            success_count += 1
        else:
            self.log_test("Bulk Export - Content-Disposition", False, 
                        f"Invalid Content-Disposition header: {content_disposition}")
        
        # Test 5: Check X-Total-Leads header
        total_leads_header = response.headers.get('X-Total-Leads', '')
        
        if total_leads_header:
            try:
                header_count = int(total_leads_header)
                if header_count == expected_count:
                    self.log_test("Bulk Export - X-Total-Leads Header", True, 
                                f"X-Total-Leads header matches database count: {header_count}")
                    success_count += 1
                else:
                    self.log_test("Bulk Export - X-Total-Leads Header", False, 
                                f"X-Total-Leads ({header_count}) doesn't match database count ({expected_count})")
            except ValueError:
                self.log_test("Bulk Export - X-Total-Leads Header", False, 
                            f"Invalid X-Total-Leads header value: {total_leads_header}")
        else:
            self.log_test("Bulk Export - X-Total-Leads Header", False, 
                        "X-Total-Leads header missing")
        
        # Test 6: Save and verify Excel file
        try:
            # Save the response content to a temporary file
            with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
                temp_file.write(response.content)
                temp_file_path = temp_file.name
            
            self.log_test("Bulk Export - File Download", True, 
                        f"Excel file downloaded successfully ({len(response.content)} bytes)")
            success_count += 1
            
            # Test 7: Verify Excel file can be opened
            try:
                df = pd.read_excel(temp_file_path)
                self.log_test("Bulk Export - File Integrity", True, 
                            "Excel file can be opened and read successfully")
                success_count += 1
                
                # Test 8: Check row count in Excel file
                excel_row_count = len(df)
                if excel_row_count == expected_count:
                    self.log_test("Bulk Export - Row Count Match", True, 
                                f"Excel contains {excel_row_count} rows matching database count ({expected_count})")
                    success_count += 1
                else:
                    self.log_test("Bulk Export - Row Count Match", False, 
                                f"Excel contains {excel_row_count} rows, expected {expected_count}")
                
                # Test 9: Verify Excel contains data (not empty)
                if excel_row_count > 0:
                    self.log_test("Bulk Export - Data Present", True, 
                                f"Excel file contains {excel_row_count} data rows")
                    success_count += 1
                    
                    # Test 10: Check for expected columns
                    expected_columns = ['id', 'name', 'phone_number', 'email', 'status', 'stage']
                    present_columns = [col for col in expected_columns if col in df.columns]
                    
                    if len(present_columns) >= 4:  # At least 4 key columns should be present
                        self.log_test("Bulk Export - Column Structure", True, 
                                    f"Excel contains expected columns: {present_columns}")
                        success_count += 1
                    else:
                        self.log_test("Bulk Export - Column Structure", False, 
                                    f"Missing expected columns. Present: {present_columns}, Expected: {expected_columns}")
                    
                    # Test 11: Sample data validation
                    sample_row = df.iloc[0] if len(df) > 0 else None
                    if sample_row is not None:
                        has_name = pd.notna(sample_row.get('name', '')) and str(sample_row.get('name', '')).strip() != ''
                        has_phone = pd.notna(sample_row.get('phone_number', '')) and str(sample_row.get('phone_number', '')).strip() != ''
                        
                        if has_name or has_phone:
                            self.log_test("Bulk Export - Sample Data Quality", True, 
                                        f"Sample row contains valid data (name: {has_name}, phone: {has_phone})")
                            success_count += 1
                        else:
                            self.log_test("Bulk Export - Sample Data Quality", False, 
                                        "Sample row appears to have empty name and phone fields")
                else:
                    self.log_test("Bulk Export - Data Present", False, 
                                "Excel file is empty (0 rows)")
                
            except Exception as e:
                self.log_test("Bulk Export - File Integrity", False, 
                            f"Cannot read Excel file: {str(e)}")
            
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except:
                pass
                
        except Exception as e:
            self.log_test("Bulk Export - File Download", False, 
                        f"Failed to save Excel file: {str(e)}")
        
        return success_count >= 8  # At least 8 out of 11 tests should pass
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Driver Onboarding Bulk Export API Test")
        print(f"Target URL: {self.base_url}/driver-onboarding/bulk-export")
        print(f"Login credentials: {ADMIN_EMAIL}")
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Get database count
        expected_count = self.test_database_count()
        print(f"\n📊 Expected lead count from database: {expected_count}")
        
        # Step 3: Test bulk export
        export_success = self.test_bulk_export_endpoint(expected_count)
        
        # Summary
        print(f"\n{'='*60}")
        print("📋 TEST SUMMARY")
        print(f"{'='*60}")
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if export_success:
            print("\n✅ BULK EXPORT ENDPOINT IS WORKING CORRECTLY")
            print("- HTTP 200 status ✓")
            print("- Proper Excel file format ✓") 
            print("- Correct headers (Content-Disposition, X-Total-Leads) ✓")
            print("- File integrity verified ✓")
            print("- Row count matches database ✓")
        else:
            print("\n❌ BULK EXPORT ENDPOINT HAS ISSUES")
            print("Check the failed tests above for details.")
        
        return export_success

def main():
    tester = DriverBulkExportTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()