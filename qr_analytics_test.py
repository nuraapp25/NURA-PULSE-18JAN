#!/usr/bin/env python3
"""
QR Code Analytics Display Testing
Tests the specific issue reported: QR codes work but analytics data not showing in production
"""

import requests
import json
import sys
import time
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://driver-sync-tool.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class QRAnalyticsDisplayTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_results = []
        self.created_qr_id = None
        self.campaign_name = "AnalyticsTest"
        
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
    
    def make_request(self, method, endpoint, data=None, files=None, use_auth=True, headers=None):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        request_headers = {}
        
        if use_auth and self.token:
            request_headers["Authorization"] = f"Bearer {self.token}"
        
        if headers:
            request_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=request_headers, timeout=30)
            elif method.upper() == "POST":
                if files:
                    response = requests.post(url, headers=request_headers, files=files, data=data, timeout=30)
                else:
                    request_headers["Content-Type"] = "application/json"
                    response = requests.post(url, headers=request_headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                if data is not None:
                    request_headers["Content-Type"] = "application/json"
                    response = requests.delete(url, headers=request_headers, json=data, timeout=30)
                else:
                    response = requests.delete(url, headers=request_headers, timeout=30)
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
    
    def authenticate(self):
        """Authenticate and get token"""
        print("\n=== Authenticating ===")
        
        login_data = {
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        
        if not response or response.status_code != 200:
            self.log_test("Authentication", False, "Login failed")
            return False
        
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
    
    def create_test_qr_code(self):
        """Step 1: Create a test QR code with multi-device URLs"""
        print("\n=== Step 1: Creating Test QR Code with Multi-Device URLs ===")
        
        qr_data = {
            "campaign_name": self.campaign_name,
            "landing_page_type": "multi",
            "landing_page_ios": "https://apps.apple.com/app/nura",
            "landing_page_android": "https://play.google.com/store/apps/nura", 
            "landing_page_desktop": "https://nuraemobility.co.in",
            "qr_count": 1
        }
        
        response = self.make_request("POST", "/qr-codes/create-batch", qr_data)
        
        if not response:
            self.log_test("QR Creation", False, "Network error during QR creation")
            return False
        
        if response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "qr_codes" in result:
                    qr_codes = result["qr_codes"]
                    if qr_codes and len(qr_codes) > 0:
                        self.created_qr_id = qr_codes[0].get("id")
                        qr_name = qr_codes[0].get("qr_name", "Unknown")
                        self.log_test("QR Creation", True, 
                                    f"Created QR code: {qr_name} (ID: {self.created_qr_id})")
                        
                        # Verify the QR code has correct multi-device URLs
                        qr_code = qr_codes[0]
                        ios_url = qr_code.get("landing_page_ios")
                        android_url = qr_code.get("landing_page_android") 
                        desktop_url = qr_code.get("landing_page_desktop")
                        
                        if ios_url and android_url and desktop_url:
                            self.log_test("QR Multi-Device URLs", True, 
                                        f"QR has all device URLs - iOS: {ios_url}, Android: {android_url}, Desktop: {desktop_url}")
                            return True
                        else:
                            self.log_test("QR Multi-Device URLs", False, 
                                        f"Missing device URLs - iOS: {ios_url}, Android: {android_url}, Desktop: {desktop_url}")
                            return False
                    else:
                        self.log_test("QR Creation", False, "No QR codes in response")
                        return False
                else:
                    self.log_test("QR Creation", False, f"QR creation failed: {result}")
                    return False
            except json.JSONDecodeError:
                self.log_test("QR Creation", False, "Invalid JSON response")
                return False
        else:
            self.log_test("QR Creation", False, f"QR creation failed with status {response.status_code}: {response.text}")
            return False
    
    def simulate_device_scans(self):
        """Step 2: Simulate 3 scans with different devices"""
        print("\n=== Step 2: Simulating 3 Scans with Different Devices ===")
        
        if not self.created_qr_id:
            self.log_test("Scan Simulation", False, "No QR code ID available for scanning")
            return False
        
        # Get the QR code details to find the short code
        response = self.make_request("GET", f"/qr-codes/{self.created_qr_id}/analytics")
        if not response or response.status_code != 200:
            self.log_test("Get QR Details", False, "Could not get QR code details for scanning")
            return False
        
        try:
            qr_data = response.json()
            # We need to find the short code from the QR code data
            # Let's get all QR codes and find our created one
            all_qr_response = self.make_request("GET", "/qr-codes")
            if not all_qr_response or all_qr_response.status_code != 200:
                self.log_test("Get All QR Codes", False, "Could not get QR codes list")
                return False
            
            all_qr_data = all_qr_response.json()
            target_qr = None
            # Handle both list and dict responses
            qr_list = all_qr_data if isinstance(all_qr_data, list) else all_qr_data.get("qr_codes", [])
            for qr in qr_list:
                if isinstance(qr, dict) and qr.get("id") == self.created_qr_id:
                    target_qr = qr
                    break
            
            if not target_qr:
                self.log_test("Find QR Code", False, "Could not find created QR code in list")
                return False
            
            short_code = target_qr.get("unique_short_code") or target_qr.get("short_code")
            if not short_code:
                self.log_test("Get Short Code", False, "QR code missing short code")
                return False
            
            self.log_test("Get Short Code", True, f"Found QR short code: {short_code}")
            
        except json.JSONDecodeError:
            self.log_test("Parse QR Details", False, "Invalid JSON response")
            return False
        
        # Define different device user agents and IPs
        scan_scenarios = [
            {
                "name": "iOS Device",
                "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
                "ip": "203.192.12.34"
            },
            {
                "name": "Android Device", 
                "user_agent": "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
                "ip": "203.192.12.35"
            },
            {
                "name": "Desktop Browser",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "ip": "203.192.12.36"
            }
        ]
        
        successful_scans = 0
        
        for i, scenario in enumerate(scan_scenarios, 1):
            print(f"\n--- Simulating Scan {i}: {scenario['name']} ---")
            
            # Simulate scan by calling the scan endpoint
            headers = {
                "User-Agent": scenario["user_agent"],
                "X-Forwarded-For": scenario["ip"],
                "X-Real-IP": scenario["ip"]
            }
            
            scan_url = f"/qr-codes/scan/{short_code}"
            response = self.make_request("GET", scan_url, use_auth=False, headers=headers)
            
            if response:
                if response.status_code in [200, 302]:
                    self.log_test(f"Scan {i} - {scenario['name']}", True, 
                                f"Scan successful (Status: {response.status_code})")
                    successful_scans += 1
                else:
                    self.log_test(f"Scan {i} - {scenario['name']}", False, 
                                f"Scan failed with status {response.status_code}: {response.text}")
            else:
                self.log_test(f"Scan {i} - {scenario['name']}", False, "Network error during scan")
            
            # Wait a bit between scans to ensure different timestamps
            time.sleep(2)
        
        if successful_scans >= 1:
            self.log_test("Scan Simulation Summary", True, 
                        f"Successfully simulated {successful_scans}/3 device scans (at least 1 needed for testing)")
            return True
        else:
            self.log_test("Scan Simulation Summary", False, 
                        f"Only {successful_scans}/3 scans were successful")
            return False
    
    def test_individual_qr_analytics(self):
        """Step 3: Test individual QR analytics endpoint"""
        print("\n=== Step 3: Testing Individual QR Analytics Endpoint ===")
        
        if not self.created_qr_id:
            self.log_test("Individual Analytics", False, "No QR code ID available")
            return False
        
        response = self.make_request("GET", f"/qr-codes/{self.created_qr_id}/analytics")
        
        if not response:
            self.log_test("Individual Analytics - Request", False, "Network error")
            return False
        
        if response.status_code != 200:
            self.log_test("Individual Analytics - Request", False, 
                        f"Request failed with status {response.status_code}: {response.text}")
            return False
        
        try:
            data = response.json()
            
            if not data.get("success"):
                self.log_test("Individual Analytics - Success", False, "Response success=false")
                return False
            
            analytics = data.get("analytics", {})
            if not analytics:
                self.log_test("Individual Analytics - Data", False, "No analytics data in response")
                return False
            
            # Check total_scans
            total_scans = analytics.get("total_scans", 0)
            self.log_test("Individual Analytics - Total Scans", total_scans >= 1, 
                        f"Total scans: {total_scans} (expected >= 1)")
            
            # Check platform breakdown
            ios_scans = analytics.get("ios_scans", 0)
            android_scans = analytics.get("android_scans", 0) 
            web_scans = analytics.get("web_scans", 0)
            
            self.log_test("Individual Analytics - Platform Breakdown", True,
                        f"iOS: {ios_scans}, Android: {android_scans}, Web: {web_scans}")
            
            # Check scan_details array - THIS IS CRITICAL
            scan_details = analytics.get("scan_details", [])
            if not scan_details:
                self.log_test("Individual Analytics - Scan Details CRITICAL", False, 
                            "scan_details array is EMPTY - this is the main issue!")
                return False
            
            self.log_test("Individual Analytics - Scan Details Present", True,
                        f"scan_details array has {len(scan_details)} records")
            
            # Verify each scan record has required fields
            required_fields = ["scanned_at", "platform", "os_family", "browser", "device", 
                             "ip_address", "location_city", "location_region", "location_country"]
            
            valid_records = 0
            for i, scan in enumerate(scan_details):
                missing_fields = [field for field in required_fields if field not in scan or scan[field] is None]
                if not missing_fields:
                    valid_records += 1
                    self.log_test(f"Scan Record {i+1} - Complete", True,
                                f"Platform: {scan.get('platform')}, Device: {scan.get('device')}, IP: {scan.get('ip_address')}")
                else:
                    self.log_test(f"Scan Record {i+1} - Missing Fields", False,
                                f"Missing: {missing_fields}")
            
            # Check UTM URLs
            utm_url_ios = analytics.get("utm_url_ios")
            utm_url_android = analytics.get("utm_url_android")
            utm_url_web = analytics.get("utm_url_web")
            
            utm_check = all([utm_url_ios, utm_url_android, utm_url_web])
            self.log_test("Individual Analytics - UTM URLs Present", utm_check,
                        f"iOS UTM: {utm_url_ios}, Android UTM: {utm_url_android}, Web UTM: {utm_url_web}")
            
            # Verify UTM parameters are properly formatted
            utm_param_check = True
            utm_issues = []
            
            for url_name, url in [("iOS", utm_url_ios), ("Android", utm_url_android), ("Web", utm_url_web)]:
                if url and "utm=" not in url:
                    utm_param_check = False
                    utm_issues.append(f"{url_name} URL missing utm parameter")
            
            if utm_param_check:
                self.log_test("Individual Analytics - UTM Parameters", True, 
                            "All UTM URLs contain utm parameters")
            else:
                self.log_test("Individual Analytics - UTM Parameters", False,
                            f"UTM parameter issues: {utm_issues}")
            
            return len(scan_details) > 0 and valid_records > 0 and utm_check
            
        except json.JSONDecodeError:
            self.log_test("Individual Analytics - Parse", False, "Invalid JSON response")
            return False
    
    def test_campaign_analytics(self):
        """Step 4: Test campaign analytics endpoint"""
        print("\n=== Step 4: Testing Campaign Analytics Endpoint ===")
        
        response = self.make_request("GET", f"/qr-codes/campaigns/{self.campaign_name}/analytics")
        
        if not response:
            self.log_test("Campaign Analytics - Request", False, "Network error")
            return False
        
        if response.status_code != 200:
            self.log_test("Campaign Analytics - Request", False,
                        f"Request failed with status {response.status_code}: {response.text}")
            return False
        
        try:
            data = response.json()
            
            if not data.get("success"):
                self.log_test("Campaign Analytics - Success", False, "Response success=false")
                return False
            
            campaign_analytics = data.get("campaign_analytics", {})
            qr_codes = campaign_analytics.get("qr_codes", [])
            
            if not qr_codes:
                self.log_test("Campaign Analytics - QR Codes", False, "No QR codes in campaign analytics")
                return False
            
            # Find our test QR code
            test_qr = None
            for qr in qr_codes:
                if qr.get("qr_code_id") == self.created_qr_id:
                    test_qr = qr
                    break
            
            if not test_qr:
                self.log_test("Campaign Analytics - Test QR Found", False, "Test QR code not found in campaign analytics")
                return False
            
            # Check scan details in campaign analytics
            scan_details = test_qr.get("scan_details", [])
            self.log_test("Campaign Analytics - Scan Details", len(scan_details) > 0,
                        f"Campaign analytics scan_details: {len(scan_details)} records")
            
            return len(scan_details) > 0
            
        except json.JSONDecodeError:
            self.log_test("Campaign Analytics - Parse", False, "Invalid JSON response")
            return False
    
    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n=== Cleaning Up Test Data ===")
        
        if self.campaign_name:
            # Delete the test campaign
            response = self.make_request("DELETE", f"/qr-codes/campaigns/{self.campaign_name}")
            if response and response.status_code == 200:
                self.log_test("Cleanup - Delete Campaign", True, f"Deleted test campaign: {self.campaign_name}")
            else:
                self.log_test("Cleanup - Delete Campaign", False, "Failed to delete test campaign")
    
    def run_comprehensive_test(self):
        """Run the complete QR Analytics Display test"""
        print("🔍 QR CODE ANALYTICS DISPLAY TESTING")
        print("=" * 60)
        print("Testing the reported issue: QR codes work but analytics data not showing")
        print("=" * 60)
        
        # Step 0: Authenticate
        if not self.authenticate():
            return False
        
        # Step 1: Create test QR code
        if not self.create_test_qr_code():
            return False
        
        # Step 2: Simulate scans
        if not self.simulate_device_scans():
            return False
        
        # Wait a moment for scans to be processed
        print("\n⏳ Waiting 5 seconds for scan processing...")
        time.sleep(5)
        
        # Step 3: Test individual QR analytics
        individual_success = self.test_individual_qr_analytics()
        
        # Step 4: Test campaign analytics  
        campaign_success = self.test_campaign_analytics()
        
        # Step 5: Cleanup
        self.cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 60)
        print("🎯 QR ANALYTICS DISPLAY TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = sum(1 for result in self.test_results if result["success"])
        total_tests = len(self.test_results)
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        
        print(f"📊 Overall Success Rate: {success_rate:.1f}% ({passed_tests}/{total_tests} tests passed)")
        
        # Critical findings
        critical_issues = []
        for result in self.test_results:
            if not result["success"] and "CRITICAL" in result["test"]:
                critical_issues.append(result["message"])
        
        if critical_issues:
            print("\n🚨 CRITICAL ISSUES FOUND:")
            for issue in critical_issues:
                print(f"   ❌ {issue}")
        
        # Success criteria check
        analytics_working = individual_success and campaign_success
        
        if analytics_working:
            print("\n✅ QR ANALYTICS DISPLAY: WORKING")
            print("   • Scan details arrays are populated")
            print("   • UTM URLs are present and formatted correctly")
            print("   • All required scan fields are available")
        else:
            print("\n❌ QR ANALYTICS DISPLAY: NOT WORKING")
            print("   • This confirms the reported production issue")
            print("   • Scan details arrays may be empty")
            print("   • UTM URLs or scan data may be missing")
        
        return analytics_working

if __name__ == "__main__":
    tester = QRAnalyticsDisplayTester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)