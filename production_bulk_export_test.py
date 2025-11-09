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
    
    def run_comprehensive_analysis(self):
        """Run complete production bulk export failure analysis"""
        print("🔍 === PRODUCTION BULK EXPORT FAILURE ANALYSIS ===")
        print(f"🌐 Production URL: {PRODUCTION_BASE_URL}")
        print(f"👤 Credentials: {PRODUCTION_EMAIL} / {PRODUCTION_PASSWORD}")
        print(f"🕐 Analysis Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Step 1: Login
        print("\n🔐 === STEP 1: LOGIN TO PRODUCTION ===")
        login_success = self.test_production_authentication()
        if not login_success:
            print("❌ Cannot proceed without authentication")
            return
        
        # Step 2: Count leads
        total_leads = self.test_count_total_leads()
        
        # Step 3: Test bulk export
        export_result = self.test_bulk_export_endpoint()
        
        # Final Analysis Report
        print("\n📋 === FINAL DIAGNOSTIC REPORT ===")
        print(f"🕐 Analysis Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🌐 Production Environment: {PRODUCTION_BASE_URL}")
        print(f"📊 Total Leads in Production: {total_leads}")
        
        print(f"\n🎯 BULK EXPORT RESULTS:")
        print(f"   📊 HTTP Status Code: {export_result.get('status_code', 'Unknown')}")
        print(f"   ⏰ Exact Timeout Duration: {export_result.get('duration', 0):.3f} seconds")
        print(f"   ✅ Success: {export_result.get('success', False)}")
        
        if export_result.get('error_type'):
            print(f"   🚨 Error Type: {export_result['error_type']}")
        
        if export_result.get('error_message'):
            print(f"   💬 Error Message: {export_result['error_message']}")
        
        if export_result.get('file_size_mb'):
            print(f"   💾 File Size: {export_result['file_size_mb']:.2f} MB")
        
        # Response Headers Analysis
        if export_result.get('headers'):
            print(f"\n📋 RESPONSE HEADERS:")
            headers = export_result['headers']
            for key, value in headers.items():
                print(f"   {key}: {value}")
        
        # Recommendations
        print(f"\n🔧 RECOMMENDATIONS:")
        
        if export_result.get('status_code') == 503:
            print("   1. 🚀 Scale production server resources (CPU/Memory)")
            print("   2. ⏰ Increase server timeout limits (300+ seconds)")
            print("   3. 📦 Implement chunked/paginated export")
            print("   4. 🔄 Add background job processing for bulk operations")
            print("   5. 💾 Consider database query optimization")
        
        elif export_result.get('status_code') == 504:
            print("   1. ⏰ Increase gateway timeout configuration")
            print("   2. 🚀 Optimize backend processing speed")
            print("   3. 📦 Implement streaming response for large files")
            print("   4. 🔄 Add progress tracking for long operations")
        
        elif export_result.get('status_code') == 500:
            print("   1. 💾 Increase server memory allocation")
            print("   2. 🔍 Check application logs for specific errors")
            print("   3. 📊 Optimize Excel generation process")
            print("   4. 🔄 Implement memory-efficient data processing")
        
        elif export_result.get('status_code') == 'TIMEOUT':
            print("   1. 🌐 Check network connectivity and stability")
            print("   2. ⏰ Increase client timeout settings")
            print("   3. 🚀 Investigate server performance issues")
            print("   4. 📊 Monitor server resource usage during export")
        
        else:
            print("   1. 🔍 Investigate specific error details")
            print("   2. 📊 Check server logs and monitoring")
            print("   3. 🚀 Verify server configuration and resources")
        
        print(f"\n📈 SUMMARY:")
        print(f"   🎯 Issue: Production bulk export failing")
        print(f"   📊 Dataset Size: {total_leads} leads")
        print(f"   ⏰ Failure Time: {export_result.get('duration', 0):.3f} seconds")
        print(f"   🔍 Root Cause: {export_result.get('error_type', 'Unknown')}")
        print(f"   🚨 Priority: CRITICAL - Production functionality impacted")

def main():
    """Main function to run production analysis"""
    tester = ProductionBulkExportTester()
    tester.run_comprehensive_analysis()

if __name__ == "__main__":
    main()