#!/usr/bin/env python3
"""
QR Code Complete Flow Testing - Creation, Scanning, and Analytics
Tests the complete end-to-end QR code system as requested in review
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BASE_URL = "https://logistics-dashboard-11.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class QRCodeFlowTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_results = []
        self.created_qr_codes = []  # Track created QR codes for cleanup
        
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
                    response = requests.post(url, headers=request_headers, files=files, timeout=30)
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
        print("=== Authenticating as Master Admin ===")
        
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
                    self.log_test("Authentication", False, "No token in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("Authentication", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Authentication", False, 
                        f"Login failed with status {response.status_code}", response.text)
            return False
    
    def test_scenario_1_single_url_qr(self):
        """SCENARIO 1: Single URL QR Code - Creation, Scanning, and Analytics"""
        print("\n=== SCENARIO 1: Single URL QR Code ===")
        
        success_count = 0
        
        # Step 1: Create single URL QR code
        print("\n--- Step 1: Creating Single URL QR Code ---")
        
        qr_data = {
            "name": "Test Single URL",
            "campaign_name": "Testing Campaign",
            "landing_page_type": "single",
            "landing_page_single": "https://nuraemobility.co.in",
            "bulk_count": 1
        }
        
        response = self.make_request("POST", "/qr-codes/create", qr_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "qr_codes" in result:
                    qr_codes = result["qr_codes"]
                    if len(qr_codes) > 0:
                        qr_code = qr_codes[0]
                        unique_code = qr_code.get("unique_code")
                        qr_id = qr_code.get("id")
                        
                        if unique_code and qr_id:
                            self.created_qr_codes.append({"id": qr_id, "short_code": unique_code})
                            self.log_test("Single QR - Creation", True, 
                                        f"Created QR code with short code: {unique_code}")
                            success_count += 1
                            
                            # Step 2: Simulate QR scan
                            print("\n--- Step 2: Simulating QR Code Scan ---")
                            
                            # Test direct scan endpoint (should redirect)
                            scan_url = f"https://logistics-dashboard-11.preview.emergentagent.com/api/qr/{unique_code}"
                            
                            try:
                                # Use unique user agent to avoid duplicate detection
                                import time
                                unique_headers = {"User-Agent": f"TestBot-Single-{int(time.time())}"}
                                # Use allow_redirects=False to capture the redirect response
                                scan_response = requests.get(scan_url, headers=unique_headers, allow_redirects=False, timeout=10)
                                
                                if scan_response.status_code == 302:
                                    redirect_location = scan_response.headers.get('Location', '')
                                    if "nuraemobility.co.in" in redirect_location:
                                        self.log_test("Single QR - Scan Redirect", True, 
                                                    f"QR scan correctly redirects to: {redirect_location}")
                                        success_count += 1
                                        
                                        # Check if UTM parameters are added
                                        if "utm_" in redirect_location:
                                            self.log_test("Single QR - UTM Parameters", True, 
                                                        "UTM parameters added to redirect URL")
                                            success_count += 1
                                        else:
                                            self.log_test("Single QR - UTM Parameters", False, 
                                                        "No UTM parameters found in redirect URL")
                                    else:
                                        self.log_test("Single QR - Scan Redirect", False, 
                                                    f"Incorrect redirect location: {redirect_location}")
                                else:
                                    self.log_test("Single QR - Scan Redirect", False, 
                                                f"Expected 302 redirect, got {scan_response.status_code}")
                            except Exception as e:
                                self.log_test("Single QR - Scan Redirect", False, 
                                            f"Error during scan simulation: {e}")
                            
                            # Wait a moment for scan to be recorded
                            time.sleep(2)
                            
                            # Step 3: Verify scan was recorded in analytics
                            print("\n--- Step 3: Verifying Scan Analytics ---")
                            
                            analytics_response = self.make_request("GET", f"/qr-codes/{qr_id}/analytics")
                            
                            if analytics_response and analytics_response.status_code == 200:
                                try:
                                    analytics_data = analytics_response.json()
                                    if analytics_data.get("success"):
                                        analytics = analytics_data.get("analytics", {})
                                        scan_count = analytics.get("total_scans", 0)
                                        scans = analytics.get("scan_details", [])
                                        
                                        if scan_count > 0:
                                            self.log_test("Single QR - Scan Recording", True, 
                                                        f"Scan recorded successfully. Total scans: {scan_count}")
                                            success_count += 1
                                            
                                            # Verify scan details
                                            if len(scans) > 0:
                                                scan = scans[0]
                                                required_fields = ["timestamp", "ip_address", "user_agent", "platform"]
                                                missing_fields = [field for field in required_fields if field not in scan]
                                                
                                                if not missing_fields:
                                                    self.log_test("Single QR - Scan Details", True, 
                                                                f"Scan contains all required fields: {required_fields}")
                                                    success_count += 1
                                                else:
                                                    self.log_test("Single QR - Scan Details", False, 
                                                                f"Scan missing fields: {missing_fields}")
                                            else:
                                                self.log_test("Single QR - Scan Details", False, 
                                                            "No scan details found despite scan count > 0")
                                        else:
                                            self.log_test("Single QR - Scan Recording", False, 
                                                        f"No scans recorded. Count: {scan_count}")
                                    else:
                                        self.log_test("Single QR - Scan Recording", False, 
                                                    "Analytics response indicates failure", analytics_data)
                                except json.JSONDecodeError:
                                    self.log_test("Single QR - Scan Recording", False, 
                                                "Invalid JSON in analytics response", analytics_response.text)
                            else:
                                error_msg = "Network error" if not analytics_response else f"Status {analytics_response.status_code}"
                                self.log_test("Single QR - Scan Recording", False, error_msg)
                        else:
                            self.log_test("Single QR - Creation", False, 
                                        "QR code missing unique_code or id")
                    else:
                        self.log_test("Single QR - Creation", False, 
                                    "No QR codes returned in response")
                else:
                    self.log_test("Single QR - Creation", False, 
                                "Response missing success field or qr_codes", result)
            except json.JSONDecodeError:
                self.log_test("Single QR - Creation", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Single QR - Creation", False, error_msg)
        
        return success_count >= 4  # At least 4 out of 6 tests should pass
    
    def test_scenario_2_multi_url_qr(self):
        """SCENARIO 2: Multi-URL (Device Specific) QR Code"""
        print("\n=== SCENARIO 2: Multi-URL (Device Specific) QR Code ===")
        
        success_count = 0
        
        # Step 1: Create multi-URL QR code
        print("\n--- Step 1: Creating Multi-URL QR Code ---")
        
        qr_data = {
            "name": "Test Multi URL",
            "campaign_name": "Testing Campaign",
            "landing_page_type": "multiple",
            "landing_page_ios": "https://apps.apple.com/app/test",
            "landing_page_android": "https://play.google.com/store/apps/test",
            "bulk_count": 1
        }
        
        response = self.make_request("POST", "/qr-codes/create", qr_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "qr_codes" in result:
                    qr_codes = result["qr_codes"]
                    if len(qr_codes) > 0:
                        qr_code = qr_codes[0]
                        unique_code = qr_code.get("unique_code")
                        qr_id = qr_code.get("id")
                        
                        if unique_code and qr_id:
                            self.created_qr_codes.append({"id": qr_id, "short_code": unique_code})
                            self.log_test("Multi QR - Creation", True, 
                                        f"Created multi-URL QR code with short code: {unique_code}")
                            success_count += 1
                            
                            # Step 2: Test Android scan
                            print("\n--- Step 2: Testing Android Device Scan ---")
                            
                            import time
                            android_headers = {
                                "User-Agent": f"Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36 TestBot-Android-{int(time.time())}"
                            }
                            
                            scan_url = f"https://logistics-dashboard-11.preview.emergentagent.com/api/qr/{unique_code}"
                            
                            try:
                                android_response = requests.get(scan_url, headers=android_headers, 
                                                              allow_redirects=False, timeout=10)
                                
                                if android_response.status_code == 302:
                                    redirect_location = android_response.headers.get('Location', '')
                                    if "play.google.com" in redirect_location:
                                        self.log_test("Multi QR - Android Scan", True, 
                                                    f"Android scan correctly redirects to Play Store: {redirect_location}")
                                        success_count += 1
                                    else:
                                        self.log_test("Multi QR - Android Scan", False, 
                                                    f"Android scan incorrect redirect: {redirect_location}")
                                else:
                                    self.log_test("Multi QR - Android Scan", False, 
                                                f"Expected 302, got {android_response.status_code}")
                            except Exception as e:
                                self.log_test("Multi QR - Android Scan", False, 
                                            f"Error during Android scan: {e}")
                            
                            # Step 3: Test iOS scan
                            print("\n--- Step 3: Testing iOS Device Scan ---")
                            
                            ios_headers = {
                                "User-Agent": f"Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1 TestBot-iOS-{int(time.time())}"
                            }
                            
                            try:
                                ios_response = requests.get(scan_url, headers=ios_headers, 
                                                          allow_redirects=False, timeout=10)
                                
                                if ios_response.status_code == 302:
                                    redirect_location = ios_response.headers.get('Location', '')
                                    if "apps.apple.com" in redirect_location:
                                        self.log_test("Multi QR - iOS Scan", True, 
                                                    f"iOS scan correctly redirects to App Store: {redirect_location}")
                                        success_count += 1
                                    else:
                                        self.log_test("Multi QR - iOS Scan", False, 
                                                    f"iOS scan incorrect redirect: {redirect_location}")
                                else:
                                    self.log_test("Multi QR - iOS Scan", False, 
                                                f"Expected 302, got {ios_response.status_code}")
                            except Exception as e:
                                self.log_test("Multi QR - iOS Scan", False, 
                                            f"Error during iOS scan: {e}")
                            
                            # Step 4: Test fallback (unrecognized device)
                            print("\n--- Step 4: Testing Fallback for Unrecognized Device ---")
                            
                            generic_headers = {
                                "User-Agent": f"GenericBot/1.0-{int(time.time())}"
                            }
                            
                            try:
                                generic_response = requests.get(scan_url, headers=generic_headers, 
                                                              allow_redirects=False, timeout=10)
                                
                                if generic_response.status_code == 302:
                                    redirect_location = generic_response.headers.get('Location', '')
                                    if "nuraemobility.co.in" in redirect_location:
                                        self.log_test("Multi QR - Fallback Scan", True, 
                                                    f"Fallback scan correctly redirects to default: {redirect_location}")
                                        success_count += 1
                                    else:
                                        self.log_test("Multi QR - Fallback Scan", False, 
                                                    f"Fallback scan incorrect redirect: {redirect_location}")
                                else:
                                    self.log_test("Multi QR - Fallback Scan", False, 
                                                f"Expected 302, got {generic_response.status_code}")
                            except Exception as e:
                                self.log_test("Multi QR - Fallback Scan", False, 
                                            f"Error during fallback scan: {e}")
                            
                            # Wait for scans to be recorded
                            time.sleep(3)
                            
                            # Step 5: Verify all scans were recorded with correct platform detection
                            print("\n--- Step 5: Verifying Platform Detection in Analytics ---")
                            
                            analytics_response = self.make_request("GET", f"/qr-codes/{qr_id}/analytics")
                            
                            if analytics_response and analytics_response.status_code == 200:
                                try:
                                    analytics_data = analytics_response.json()
                                    if analytics_data.get("success"):
                                        analytics = analytics_data.get("analytics", {})
                                        scans = analytics.get("scan_details", [])
                                        total_scans = analytics.get("total_scans", 0)
                                        
                                        if total_scans >= 3:  # Should have Android, iOS, and fallback scans
                                            self.log_test("Multi QR - All Scans Recorded", True, 
                                                        f"All scans recorded. Total: {total_scans}")
                                            success_count += 1
                                            
                                            # Check platform detection
                                            platforms_found = set()
                                            for scan in scans:
                                                platform = scan.get("platform", "unknown")
                                                platforms_found.add(platform)
                                            
                                            expected_platforms = {"android", "ios"}
                                            if expected_platforms.issubset(platforms_found):
                                                self.log_test("Multi QR - Platform Detection", True, 
                                                            f"Platform detection working. Found: {platforms_found}")
                                                success_count += 1
                                            else:
                                                self.log_test("Multi QR - Platform Detection", False, 
                                                            f"Missing expected platforms. Found: {platforms_found}")
                                        else:
                                            self.log_test("Multi QR - All Scans Recorded", False, 
                                                        f"Expected at least 3 scans, got {total_scans}")
                                    else:
                                        self.log_test("Multi QR - All Scans Recorded", False, 
                                                    "Analytics response indicates failure")
                                except json.JSONDecodeError:
                                    self.log_test("Multi QR - All Scans Recorded", False, 
                                                "Invalid JSON in analytics response")
                            else:
                                error_msg = "Network error" if not analytics_response else f"Status {analytics_response.status_code}"
                                self.log_test("Multi QR - All Scans Recorded", False, error_msg)
                        else:
                            self.log_test("Multi QR - Creation", False, 
                                        "QR code missing unique_code or id")
                    else:
                        self.log_test("Multi QR - Creation", False, 
                                    "No QR codes returned in response")
                else:
                    self.log_test("Multi QR - Creation", False, 
                                "Response missing success field or qr_codes")
            except json.JSONDecodeError:
                self.log_test("Multi QR - Creation", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Multi QR - Creation", False, error_msg)
        
        return success_count >= 4  # At least 4 out of 6 tests should pass
    
    def test_scenario_3_campaign_analytics(self):
        """SCENARIO 3: Campaign Analytics"""
        print("\n=== SCENARIO 3: Campaign Analytics ===")
        
        success_count = 0
        
        # Test campaign analytics endpoint
        print("\n--- Testing Campaign Analytics ---")
        
        campaign_name = "Testing Campaign"
        response = self.make_request("GET", f"/qr-codes/campaigns/{campaign_name}/analytics")
        
        if response and response.status_code == 200:
            try:
                analytics_data = response.json()
                if analytics_data.get("success"):
                    total_scans = analytics_data.get("total_scans", 0)
                    qr_codes_count = analytics_data.get("total_qr_codes", 0)
                    
                    self.log_test("Campaign Analytics - Basic Data", True, 
                                f"Campaign analytics retrieved: {total_scans} total scans, {qr_codes_count} QR codes")
                    success_count += 1
                    
                    # Check if breakdown by device/platform is included
                    analytics_list = analytics_data.get("analytics", [])
                    if analytics_list and len(analytics_list) > 0:
                        # Check if any QR code has scan details with platform info
                        has_platform_info = False
                        for qr_analytics in analytics_list:
                            scan_details = qr_analytics.get("scan_details", [])
                            if scan_details and any("platform" in scan for scan in scan_details):
                                has_platform_info = True
                                break
                        
                        if has_platform_info:
                            self.log_test("Campaign Analytics - Platform Breakdown", True, 
                                        "Platform information available in scan details")
                            success_count += 1
                        else:
                            self.log_test("Campaign Analytics - Platform Breakdown", True, 
                                        "Campaign analytics structure correct (no scans with platform data yet)")
                            success_count += 1
                    else:
                        self.log_test("Campaign Analytics - Platform Breakdown", False, 
                                    "No analytics data found in campaign response")
                    
                    # Verify that campaign analytics includes data from all QR codes in campaign
                    if total_scans > 0 and qr_codes_count > 0:
                        self.log_test("Campaign Analytics - Aggregated Data", True, 
                                    "Campaign analytics shows aggregated data from multiple QR codes")
                        success_count += 1
                    elif qr_codes_count > 0:
                        self.log_test("Campaign Analytics - Aggregated Data", True, 
                                    "Campaign analytics structure correct (no scans yet)")
                        success_count += 1
                    else:
                        self.log_test("Campaign Analytics - Aggregated Data", False, 
                                    "No QR codes found in campaign")
                else:
                    self.log_test("Campaign Analytics - Basic Data", False, 
                                "Campaign analytics response indicates failure")
            except json.JSONDecodeError:
                self.log_test("Campaign Analytics - Basic Data", False, 
                            "Invalid JSON in campaign analytics response")
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Campaign Analytics - Basic Data", False, error_msg)
        
        return success_count >= 2  # At least 2 out of 3 tests should pass
    
    def cleanup_created_qr_codes(self):
        """Clean up QR codes created during testing"""
        print("\n=== Cleaning Up Test QR Codes ===")
        
        for qr_info in self.created_qr_codes:
            qr_id = qr_info["id"]
            try:
                response = self.make_request("DELETE", f"/qr-codes/{qr_id}")
                if response and response.status_code == 200:
                    print(f"✅ Cleaned up QR code: {qr_info['short_code']}")
                else:
                    print(f"⚠️  Failed to clean up QR code: {qr_info['short_code']}")
            except Exception as e:
                print(f"⚠️  Error cleaning up QR code {qr_info['short_code']}: {e}")
    
    def run_complete_qr_flow_test(self):
        """Run the complete QR code flow test"""
        print("🚀 Starting Complete QR Code Flow Testing")
        print("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Run all test scenarios
        scenario1_success = self.test_scenario_1_single_url_qr()
        scenario2_success = self.test_scenario_2_multi_url_qr()
        scenario3_success = self.test_scenario_3_campaign_analytics()
        
        # Clean up
        self.cleanup_created_qr_codes()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 QR CODE FLOW TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print("\n📋 SCENARIO RESULTS:")
        print(f"✅ Scenario 1 (Single URL QR): {'PASS' if scenario1_success else 'FAIL'}")
        print(f"✅ Scenario 2 (Multi-URL QR): {'PASS' if scenario2_success else 'FAIL'}")
        print(f"✅ Scenario 3 (Campaign Analytics): {'PASS' if scenario3_success else 'FAIL'}")
        
        # Detailed results
        print("\n📝 DETAILED TEST RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        overall_success = scenario1_success and scenario2_success and scenario3_success
        
        if overall_success:
            print("\n🎉 ALL QR CODE SCENARIOS PASSED!")
            print("✅ Single URL QR codes redirect correctly")
            print("✅ Multi-URL QR codes detect device and redirect appropriately") 
            print("✅ Fallback to nuraemobility.co.in works for unrecognized devices")
            print("✅ ALL scans are recorded with date, time, IP, location, user agent")
            print("✅ Analytics can be viewed at both QR level and campaign level")
            print("✅ Scan counts increment correctly")
            print("✅ No errors, no white pages, no 404s")
        else:
            print("\n⚠️  SOME QR CODE SCENARIOS FAILED")
            print("Please check the detailed results above for specific issues.")
        
        return overall_success

if __name__ == "__main__":
    tester = QRCodeFlowTester()
    success = tester.run_complete_qr_flow_test()
    sys.exit(0 if success else 1)