#!/usr/bin/env python3
"""
Production Environment Testing for Driver Onboarding Bulk Export
Tests the specific production endpoint at https://pulse.nuraemobility.co.in
"""

import requests
import json
import sys
import pandas as pd
import io
from datetime import datetime

# Production Configuration
PRODUCTION_BASE_URL = "https://pulse.nuraemobility.co.in/api"
PRODUCTION_EMAIL = "admin"
PRODUCTION_PASSWORD = "Nura@1234$"

class ProductionBulkExportTester:
    def __init__(self):
        self.base_url = PRODUCTION_BASE_URL
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
    
    def make_request(self, method, endpoint, data=None, files=None, use_auth=True, timeout=300):
        """Make HTTP request with proper headers and extended timeout for bulk operations"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method.upper() == "POST":
                if files:
                    response = requests.post(url, headers=headers, files=files, timeout=timeout)
                else:
                    headers["Content-Type"] = "application/json"
                    response = requests.post(url, headers=headers, json=data, timeout=timeout)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            print(f"DEBUG: {method} {url} -> Status: {response.status_code}")
            return response
        except requests.exceptions.Timeout:
            print(f"Request timeout for {method} {url} (timeout: {timeout}s)")
            return None
        except requests.exceptions.RequestException as e:
            print(f"Request error for {method} {url}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error for {method} {url}: {e}")
            return None
    
    def test_production_authentication(self):
        """Test 1: Production Authentication"""
        print("\n=== Testing Production Authentication ===")
        
        login_data = {
            "email": PRODUCTION_EMAIL,
            "password": PRODUCTION_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        
        if not response:
            self.log_test("Production Authentication", False, "Network error during login")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "token" in data:
                    self.token = data["token"]
                    user_info = data.get("user", {})
                    self.log_test("Production Authentication", True, 
                                f"Login successful. User: {user_info.get('first_name', 'Unknown')}, Type: {user_info.get('account_type', 'Unknown')}")
                    return True
                else:
                    self.log_test("Production Authentication", False, "No token in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("Production Authentication", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Production Authentication", False, 
                        f"Login failed with status {response.status_code}", response.text)
            return False
    
    def test_bulk_export_endpoint(self):
        """Test 2: Driver Onboarding Bulk Export Endpoint"""
        print("\n=== Testing Driver Onboarding Bulk Export Endpoint ===")
        
        if not self.token:
            self.log_test("Bulk Export - Authentication Check", False, "No authentication token available")
            return False
        
        # Test the bulk export endpoint with extended timeout (5 minutes)
        print("Calling POST /api/driver-onboarding/bulk-export (timeout: 5 minutes)...")
        response = self.make_request("POST", "/driver-onboarding/bulk-export", timeout=300)
        
        if not response:
            self.log_test("Bulk Export - Network Request", False, "Network error or timeout during bulk export")
            return False
        
        # Check status code
        if response.status_code != 200:
            self.log_test("Bulk Export - HTTP Status", False, 
                        f"Expected HTTP 200, got {response.status_code}", response.text)
            return False
        
        self.log_test("Bulk Export - HTTP Status", True, "HTTP 200 response received")
        
        # Check Content-Type header
        content_type = response.headers.get('Content-Type', '')
        expected_content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
        if expected_content_type in content_type:
            self.log_test("Bulk Export - Content Type", True, 
                        f"Correct Content-Type: {content_type}")
        else:
            self.log_test("Bulk Export - Content Type", False, 
                        f"Expected Excel content type, got: {content_type}")
            return False
        
        # Check Content-Disposition header
        content_disposition = response.headers.get('Content-Disposition', '')
        if 'attachment' in content_disposition and 'filename=' in content_disposition:
            filename = content_disposition.split('filename=')[1].strip('"')
            self.log_test("Bulk Export - Content Disposition", True, 
                        f"File download header present: {filename}")
        else:
            self.log_test("Bulk Export - Content Disposition", False, 
                        f"Missing or invalid Content-Disposition header: {content_disposition}")
        
        # Check X-Total-Leads header
        total_leads_header = response.headers.get('X-Total-Leads', '')
        if total_leads_header:
            try:
                total_leads = int(total_leads_header)
                self.log_test("Bulk Export - X-Total-Leads Header", True, 
                            f"X-Total-Leads header present: {total_leads} leads")
                
                # Report the total number of leads in production database
                print(f"\n🔢 PRODUCTION DATABASE LEAD COUNT: {total_leads}")
                
                # Check if it's approximately 30,000 as user mentioned
                if 25000 <= total_leads <= 35000:
                    self.log_test("Bulk Export - Lead Count Verification", True, 
                                f"Lead count ({total_leads}) is within expected range (25,000-35,000)")
                else:
                    self.log_test("Bulk Export - Lead Count Verification", False, 
                                f"Lead count ({total_leads}) is outside expected range (25,000-35,000)")
            except ValueError:
                self.log_test("Bulk Export - X-Total-Leads Header", False, 
                            f"Invalid X-Total-Leads header value: {total_leads_header}")
                total_leads = None
        else:
            self.log_test("Bulk Export - X-Total-Leads Header", False, 
                        "X-Total-Leads header missing")
            total_leads = None
        
        # Check file size and content
        content_length = len(response.content)
        if content_length > 0:
            self.log_test("Bulk Export - File Download", True, 
                        f"Excel file downloaded successfully ({content_length:,} bytes)")
        else:
            self.log_test("Bulk Export - File Download", False, "Empty file downloaded")
            return False
        
        # Try to open and verify Excel file
        try:
            excel_data = io.BytesIO(response.content)
            df = pd.read_excel(excel_data)
            
            row_count = len(df)
            column_count = len(df.columns)
            
            self.log_test("Bulk Export - Excel File Integrity", True, 
                        f"Excel file can be opened: {row_count:,} rows, {column_count} columns")
            
            # Verify expected columns are present
            expected_columns = ['id', 'name', 'phone_number', 'email', 'status', 'stage']
            missing_columns = [col for col in expected_columns if col not in df.columns]
            
            if not missing_columns:
                self.log_test("Bulk Export - Column Structure", True, 
                            f"All expected columns present: {', '.join(expected_columns)}")
            else:
                self.log_test("Bulk Export - Column Structure", False, 
                            f"Missing expected columns: {missing_columns}")
            
            # Verify row count matches header
            if total_leads and row_count == total_leads:
                self.log_test("Bulk Export - Row Count Verification", True, 
                            f"Excel row count ({row_count:,}) matches X-Total-Leads header ({total_leads:,})")
            elif total_leads:
                self.log_test("Bulk Export - Row Count Verification", False, 
                            f"Excel row count ({row_count:,}) doesn't match X-Total-Leads header ({total_leads:,})")
            else:
                self.log_test("Bulk Export - Row Count Verification", True, 
                            f"Excel contains {row_count:,} rows (header not available for comparison)")
            
            # Sample data quality check
            if row_count > 0:
                sample_row = df.iloc[0]
                name_sample = str(sample_row.get('name', ''))
                phone_sample = str(sample_row.get('phone_number', ''))
                
                if name_sample and name_sample != 'nan' and phone_sample and phone_sample != 'nan':
                    self.log_test("Bulk Export - Data Quality Sample", True, 
                                f"Sample data looks valid - Name: '{name_sample}', Phone: '{phone_sample}'")
                else:
                    self.log_test("Bulk Export - Data Quality Sample", False, 
                                f"Sample data appears invalid - Name: '{name_sample}', Phone: '{phone_sample}'")
            
            return True
            
        except Exception as e:
            self.log_test("Bulk Export - Excel File Integrity", False, 
                        f"Cannot open Excel file: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all production tests"""
        print("🚀 Starting Production Environment Testing for Driver Onboarding Bulk Export")
        print(f"🌐 Production URL: {PRODUCTION_BASE_URL}")
        print(f"👤 Credentials: {PRODUCTION_EMAIL} / {'*' * len(PRODUCTION_PASSWORD)}")
        print("=" * 80)
        
        # Test 1: Authentication
        auth_success = self.test_production_authentication()
        if not auth_success:
            print("\n❌ Authentication failed. Cannot proceed with bulk export test.")
            return False
        
        # Test 2: Bulk Export
        export_success = self.test_bulk_export_endpoint()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 PRODUCTION TEST SUMMARY")
        print("=" * 80)
        
        passed_tests = sum(1 for result in self.test_results if result['success'])
        total_tests = len(self.test_results)
        
        print(f"✅ Passed: {passed_tests}/{total_tests} tests")
        print(f"❌ Failed: {total_tests - passed_tests}/{total_tests} tests")
        
        if export_success:
            print("\n🎉 PRODUCTION BULK EXPORT TEST: SUCCESS")
            print("✅ Login successful with production credentials")
            print("✅ HTTP 200 from bulk export endpoint")
            print("✅ Excel file downloads successfully")
            print("✅ File integrity verified")
            
            # Find the lead count from results
            for result in self.test_results:
                if "X-Total-Leads header present" in result['message']:
                    lead_count = result['message'].split(': ')[1].split(' ')[0]
                    print(f"📊 Production database contains: {lead_count} leads")
                    break
        else:
            print("\n❌ PRODUCTION BULK EXPORT TEST: FAILED")
            print("Please check the detailed test results above for specific issues.")
        
        return export_success

def main():
    """Main function to run production tests"""
    tester = ProductionBulkExportTester()
    success = tester.run_all_tests()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()