#!/usr/bin/env python3
"""
Production Bulk Export Failure Analysis
Comprehensive diagnosis of bulk export failure in production environment
URL: https://pulse.nuraemobility.co.in
Credentials: admin / Nura@1234$

OBJECTIVE: Determine the EXACT reason why bulk export is failing
"""

import requests
import json
import sys
import pandas as pd
import io
import time
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
    
    def make_request_with_timing(self, method, endpoint, data=None, files=None, use_auth=True, timeout=300):
        """Make HTTP request with precise timing measurement and comprehensive error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        # Record precise start time
        start_time = time.time()
        
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
            
            end_time = time.time()
            duration = end_time - start_time
            
            print(f"⏱️  {method} {url} -> Status: {response.status_code}, Duration: {duration:.3f}s")
            return response, duration
            
        except requests.exceptions.Timeout as e:
            end_time = time.time()
            duration = end_time - start_time
            print(f"⏰ TIMEOUT after {duration:.3f} seconds: {e}")
            return None, duration
        except requests.exceptions.RequestException as e:
            end_time = time.time()
            duration = end_time - start_time
            print(f"🚨 REQUEST ERROR after {duration:.3f} seconds: {e}")
            return None, duration
        except Exception as e:
            end_time = time.time()
            duration = end_time - start_time
            print(f"💥 UNEXPECTED ERROR after {duration:.3f} seconds: {e}")
            return None, duration
    
    def test_production_authentication(self):
        """Test 1: Production Authentication"""
        print("\n=== Testing Production Authentication ===")
        
        login_data = {
            "email": PRODUCTION_EMAIL,
            "password": PRODUCTION_PASSWORD
        }
        
        response, duration = self.make_request_with_timing("POST", "/auth/login", login_data, use_auth=False)
        
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
        
        # First, let's check how many leads are in the database
        print("Checking lead count in production database...")
        leads_response = self.make_request("GET", "/driver-onboarding/leads", timeout=30)
        
        if leads_response and leads_response.status_code == 200:
            try:
                leads_data = leads_response.json()
                if isinstance(leads_data, dict) and 'leads' in leads_data:
                    sample_leads = leads_data['leads']
                    self.log_test("Production Database - Sample Leads", True, 
                                f"Successfully retrieved sample of {len(sample_leads)} leads from production")
                elif isinstance(leads_data, list):
                    sample_leads = leads_data
                    self.log_test("Production Database - Sample Leads", True, 
                                f"Successfully retrieved sample of {len(sample_leads)} leads from production")
                else:
                    self.log_test("Production Database - Sample Leads", False, 
                                f"Unexpected response format: {type(leads_data)}")
            except json.JSONDecodeError:
                self.log_test("Production Database - Sample Leads", False, 
                            "Invalid JSON response from leads endpoint")
        else:
            error_msg = "Network error" if not leads_response else f"Status {leads_response.status_code}"
            self.log_test("Production Database - Sample Leads", False, 
                        f"Could not retrieve sample leads: {error_msg}")
        
        # Test the bulk export endpoint with extended timeout (5 minutes)
        print("Calling POST /api/driver-onboarding/bulk-export (timeout: 5 minutes)...")
        response = self.make_request("POST", "/driver-onboarding/bulk-export", timeout=300)
        
        if not response:
            self.log_test("Bulk Export - Network Request", False, "Network error or timeout during bulk export (5 min timeout)")
            
            # Try with shorter timeout to see if it's a timeout issue
            print("Retrying with 30 second timeout to diagnose...")
            quick_response = self.make_request("POST", "/driver-onboarding/bulk-export", timeout=30)
            if quick_response:
                if quick_response.status_code == 503:
                    self.log_test("Bulk Export - Service Availability", False, 
                                "Service returns 503 - Server overloaded or export process exceeds timeout limits")
                    print("🔍 DIAGNOSIS: The bulk export endpoint is returning HTTP 503 Service Unavailable.")
                    print("   This typically indicates:")
                    print("   • Server timeout due to large dataset export (30,000+ leads)")
                    print("   • Server resource exhaustion during export processing")
                    print("   • Proxy/gateway timeout limits exceeded")
                    print("   • Backend service temporarily overloaded")
                else:
                    self.log_test("Bulk Export - Service Response", False, 
                                f"Service responds with {quick_response.status_code} but times out on full export")
            return False
        
        # Check status code
        if response.status_code == 503:
            self.log_test("Bulk Export - HTTP Status", False, 
                        "HTTP 503 Service Unavailable - Export process likely exceeds server timeout limits for large dataset")
            
            print("🔍 DETAILED DIAGNOSIS:")
            print("   • Production database likely contains large dataset (30,000+ leads)")
            print("   • Bulk export process exceeds server/proxy timeout configurations")
            print("   • Server resources may be insufficient for large Excel generation")
            print("   • Recommendation: Increase server timeouts or implement chunked export")
            return False
        elif response.status_code != 200:
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
            
            # Check if it's a 503 service unavailable issue
            service_unavailable = any("503" in result['message'] for result in self.test_results)
            timeout_issue = any("timeout" in result['message'].lower() for result in self.test_results)
            
            if service_unavailable or timeout_issue:
                print("\n🔍 ROOT CAUSE ANALYSIS:")
                print("   The bulk export endpoint is experiencing service availability issues.")
                print("   This is likely due to:")
                print("   • Large dataset size (potentially 30,000+ leads as mentioned)")
                print("   • Server timeout configurations insufficient for bulk export")
                print("   • Resource constraints during Excel file generation")
                print("   • Production server optimization needed for large exports")
                print("\n💡 RECOMMENDATIONS:")
                print("   1. Increase server timeout settings (proxy_read_timeout, etc.)")
                print("   2. Implement chunked/paginated export for large datasets")
                print("   3. Add background job processing for bulk exports")
                print("   4. Scale server resources for production workload")
                print("   5. Add export progress tracking and resume capability")
            else:
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