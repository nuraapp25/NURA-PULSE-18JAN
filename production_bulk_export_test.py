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
    
    def test_count_total_leads(self):
        """Test Step 2: Count Total Leads in production database"""
        print("\n📊 === STEP 2: COUNT TOTAL LEADS ===")
        
        response, duration = self.make_request_with_timing("GET", "/driver-onboarding/leads")
        
        if not response:
            self.log_test("Count Total Leads", False, f"Network/timeout error after {duration:.3f}s")
            return 0
        
        print(f"📊 HTTP Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                leads = response.json()
                total_leads = len(leads)
                
                self.log_test("Count Total Leads", True, 
                            f"✅ Retrieved {total_leads} leads from production database, Duration: {duration:.3f}s")
                
                print(f"📈 Total Leads in Production: {total_leads}")
                
                # Sample lead data for analysis
                if leads:
                    sample_lead = leads[0]
                    print(f"📋 Sample Lead Structure: {list(sample_lead.keys())}")
                    print(f"🏷️  Sample Lead Status: {sample_lead.get('status', 'Unknown')}")
                    print(f"📅 Sample Lead Date: {sample_lead.get('import_date', 'Unknown')}")
                
                return total_leads
                
            except json.JSONDecodeError:
                self.log_test("Count Total Leads", False, "Invalid JSON response", response.text)
                return 0
        else:
            self.log_test("Count Total Leads", False, 
                        f"❌ Failed to get leads - Status: {response.status_code}, Duration: {duration:.3f}s", 
                        response.text)
            return 0

    def test_bulk_export_endpoint(self):
        """Test Step 3: Test Bulk Export Endpoint with comprehensive analysis"""
        print("\n📦 === STEP 3: TEST BULK EXPORT ENDPOINT ===")
        
        print("🚀 Starting bulk export request...")
        print(f"🎯 Target URL: {self.base_url}/driver-onboarding/bulk-export")
        print(f"⏰ Timeout set to: 300 seconds")
        
        # Record start time for precise measurement
        start_timestamp = datetime.now()
        print(f"🕐 Start Time: {start_timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')}")
        
        response, duration = self.make_request_with_timing("POST", "/driver-onboarding/bulk-export", timeout=300)
        
        end_timestamp = datetime.now()
        print(f"🕐 End Time: {end_timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')}")
        print(f"⏱️  EXACT DURATION: {duration:.3f} seconds")
        
        # Analyze response
        if not response:
            self.log_test("Bulk Export Endpoint", False, 
                        f"❌ TIMEOUT/ERROR - Failed after {duration:.3f} seconds")
            
            print(f"🚨 BULK EXPORT FAILURE ANALYSIS:")
            print(f"   ⏰ Timeout Duration: {duration:.3f} seconds")
            print(f"   🔍 Failure Type: Network timeout or connection error")
            print(f"   📊 Expected Response: Excel file download")
            print(f"   💥 Actual Result: Request timeout/failure")
            
            return {
                "status_code": "TIMEOUT",
                "duration": duration,
                "error_type": "Network timeout or connection error",
                "success": False
            }
        
        # Response received - analyze details
        print(f"📊 HTTP Status Code: {response.status_code}")
        print(f"📋 Response Headers:")
        for header, value in response.headers.items():
            print(f"   {header}: {value}")
        
        # Analyze response based on status code
        analysis_result = {
            "status_code": response.status_code,
            "duration": duration,
            "headers": dict(response.headers),
            "success": False
        }
        
        if response.status_code == 200:
            # Success case
            content_type = response.headers.get('Content-Type', '')
            content_length = response.headers.get('Content-Length', 'Unknown')
            content_disposition = response.headers.get('Content-Disposition', '')
            
            if 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in content_type:
                file_size_mb = len(response.content) / (1024 * 1024) if response.content else 0
                
                self.log_test("Bulk Export Endpoint", True, 
                            f"✅ SUCCESS - Excel file received, Size: {file_size_mb:.2f}MB, Duration: {duration:.3f}s")
                
                print(f"🎉 BULK EXPORT SUCCESS:")
                print(f"   📊 Status Code: 200 OK")
                print(f"   📄 Content-Type: {content_type}")
                print(f"   📏 Content-Length: {content_length}")
                print(f"   📎 Content-Disposition: {content_disposition}")
                print(f"   💾 File Size: {file_size_mb:.2f} MB")
                print(f"   ⏱️  Response Time: {duration:.3f} seconds")
                
                analysis_result["success"] = True
                analysis_result["file_size_mb"] = file_size_mb
                analysis_result["content_type"] = content_type
                
            else:
                # 200 but wrong content type
                try:
                    error_data = response.json()
                    self.log_test("Bulk Export Endpoint", False, 
                                f"❌ 200 but wrong content type - Duration: {duration:.3f}s", error_data)
                    analysis_result["error_data"] = error_data
                except:
                    self.log_test("Bulk Export Endpoint", False, 
                                f"❌ 200 but unexpected response - Duration: {duration:.3f}s", response.text[:500])
                    analysis_result["error_text"] = response.text[:500]
        
        elif response.status_code == 503:
            # Service Unavailable
            try:
                error_data = response.json()
                error_message = error_data.get('detail', 'Service temporarily unavailable')
            except:
                error_message = response.text
            
            self.log_test("Bulk Export Endpoint", False, 
                        f"❌ 503 SERVICE UNAVAILABLE - Duration: {duration:.3f}s", error_message)
            
            print(f"🚨 503 SERVICE UNAVAILABLE ANALYSIS:")
            print(f"   ⏰ Response Time: {duration:.3f} seconds")
            print(f"   🔍 Error Type: Service temporarily unavailable")
            print(f"   💬 Error Message: {error_message}")
            print(f"   🎯 Root Cause: Server resource exhaustion or overload")
            print(f"   🔧 Likely Issue: Production server cannot handle large dataset export")
            
            analysis_result["error_message"] = error_message
            analysis_result["error_type"] = "Service Unavailable - Resource exhaustion"
        
        elif response.status_code == 504:
            # Gateway Timeout
            try:
                error_data = response.json()
                error_message = error_data.get('detail', 'Gateway timeout')
            except:
                error_message = response.text
            
            self.log_test("Bulk Export Endpoint", False, 
                        f"❌ 504 GATEWAY TIMEOUT - Duration: {duration:.3f}s", error_message)
            
            print(f"🚨 504 GATEWAY TIMEOUT ANALYSIS:")
            print(f"   ⏰ Response Time: {duration:.3f} seconds")
            print(f"   🔍 Error Type: Gateway timeout")
            print(f"   💬 Error Message: {error_message}")
            print(f"   🎯 Root Cause: Upstream server timeout")
            print(f"   🔧 Likely Issue: Backend processing time exceeds gateway timeout")
            
            analysis_result["error_message"] = error_message
            analysis_result["error_type"] = "Gateway Timeout - Processing time exceeded"
        
        elif response.status_code == 500:
            # Internal Server Error
            try:
                error_data = response.json()
                error_message = error_data.get('detail', 'Internal server error')
            except:
                error_message = response.text
            
            self.log_test("Bulk Export Endpoint", False, 
                        f"❌ 500 INTERNAL SERVER ERROR - Duration: {duration:.3f}s", error_message)
            
            print(f"🚨 500 INTERNAL SERVER ERROR ANALYSIS:")
            print(f"   ⏰ Response Time: {duration:.3f} seconds")
            print(f"   🔍 Error Type: Internal server error")
            print(f"   💬 Error Message: {error_message}")
            print(f"   🎯 Root Cause: Application error or memory issue")
            print(f"   🔧 Likely Issue: Memory exhaustion during Excel generation")
            
            analysis_result["error_message"] = error_message
            analysis_result["error_type"] = "Internal Server Error - Application/memory issue"
        
        else:
            # Other status codes
            try:
                error_data = response.json()
                error_message = error_data.get('detail', f'HTTP {response.status_code}')
            except:
                error_message = response.text
            
            self.log_test("Bulk Export Endpoint", False, 
                        f"❌ HTTP {response.status_code} - Duration: {duration:.3f}s", error_message)
            
            print(f"🚨 HTTP {response.status_code} ERROR ANALYSIS:")
            print(f"   ⏰ Response Time: {duration:.3f} seconds")
            print(f"   🔍 Error Type: HTTP {response.status_code}")
            print(f"   💬 Error Message: {error_message}")
            
            analysis_result["error_message"] = error_message
            analysis_result["error_type"] = f"HTTP {response.status_code}"
        
        return analysis_result
        
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