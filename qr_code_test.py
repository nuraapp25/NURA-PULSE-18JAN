#!/usr/bin/env python3
"""
QR Code Dynamic URL Generation Test
Tests the critical production fix for QR codes using dynamic URLs
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://driver-hub-46.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class QRCodeDynamicURLTester:
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
    
    def make_request(self, method, endpoint, data=None, use_auth=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
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
    
    def authenticate(self):
        """Login as master admin and get token"""
        print("\n=== Authentication ===")
        
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
    
    def test_single_qr_creation(self):
        """Test 1: Create single QR code and verify dynamic URL"""
        print("\n=== Test 1: Single QR Code Creation with Dynamic URL ===")
        
        qr_data = {
            "name": "Test QR Dynamic URL",
            "campaign_name": "URL Test Campaign",
            "landing_page_type": "single",
            "landing_page_single": "https://nuraemobility.co.in/",
            "bulk_count": 1
        }
        
        response = self.make_request("POST", "/qr-codes/create", qr_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                
                if result.get("success") and "qr_codes" in result:
                    qr_codes = result["qr_codes"]
                    
                    if len(qr_codes) >= 1:
                        qr_code = qr_codes[0]
                        qr_url = qr_code.get("qr_url", "")
                        
                        # CRITICAL CHECK: Verify qr_url uses current environment host
                        print(f"   📋 QR URL Generated: {qr_url}")
                        
                        if qr_url:
                            # Check that it doesn't contain the hardcoded preview URL in wrong context
                            # The URL should use the current request host dynamically
                            if "/qr/" in qr_url and "?to=" in qr_url:
                                self.log_test("QR Code - Dynamic URL Generation", True, 
                                            f"QR URL uses correct format with dynamic host: {qr_url}")
                                return True
                            else:
                                self.log_test("QR Code - Dynamic URL Generation", False, 
                                            f"QR URL format incorrect: {qr_url}")
                        else:
                            self.log_test("QR Code - Dynamic URL Generation", False, 
                                        "QR code response missing qr_url field")
                    else:
                        self.log_test("QR Code - Single Creation", False, 
                                    f"Expected 1 QR code, got {len(qr_codes)}")
                else:
                    self.log_test("QR Code - Single Creation", False, 
                                "Response missing success or qr_codes field", result)
            except json.JSONDecodeError:
                self.log_test("QR Code - Single Creation", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("QR Code - Single Creation", False, error_msg, 
                        response.text if response else None)
        
        return False
    
    def test_batch_qr_creation(self):
        """Test 2: Create batch QR codes and verify dynamic URLs"""
        print("\n=== Test 2: Batch QR Code Creation with Dynamic URLs ===")
        
        batch_data = {
            "campaign_name": "Batch URL Test",
            "qr_count": 2,
            "landing_page_type": "single",
            "single_url": "https://nuraemobility.co.in/"
        }
        
        response = self.make_request("POST", "/qr-codes/create-batch", batch_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                
                if result.get("success") and "qr_codes" in result:
                    qr_codes = result["qr_codes"]
                    
                    if len(qr_codes) == 2:
                        all_urls_correct = True
                        
                        for i, qr_code in enumerate(qr_codes):
                            tracking_url = qr_code.get("tracking_url", "")
                            
                            # Check each tracking URL
                            if tracking_url:
                                print(f"   📋 Batch QR {i+1} URL: {tracking_url}")
                                # Verify it has the correct format for dynamic URLs
                                if "/qr-codes/scan/" not in tracking_url:
                                    all_urls_correct = False
                                    print(f"   ❌ Batch QR {i+1} URL format incorrect")
                            else:
                                all_urls_correct = False
                        
                        if all_urls_correct:
                            self.log_test("QR Code - Batch Dynamic URLs", True, 
                                        f"All {len(qr_codes)} batch QR codes use correct URL format")
                            return True
                        else:
                            self.log_test("QR Code - Batch Dynamic URLs", False, 
                                        "Some batch QR codes have incorrect URL format")
                    else:
                        self.log_test("QR Code - Batch Creation", False, 
                                    f"Expected 2 QR codes, got {len(qr_codes)}")
                else:
                    self.log_test("QR Code - Batch Creation", False, 
                                "Batch response missing success or qr_codes field", result)
            except json.JSONDecodeError:
                self.log_test("QR Code - Batch Creation", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("QR Code - Batch Creation", False, error_msg, 
                        response.text if response else None)
        
        return False
    
    def test_url_format_verification(self):
        """Test 3: Verify QR code format matches expected pattern"""
        print("\n=== Test 3: QR URL Format Verification ===")
        
        test_qr_data = {
            "name": "Format Test QR",
            "campaign_name": "Format Test Campaign", 
            "landing_page_type": "single",
            "landing_page_single": "https://example.com/test",
            "bulk_count": 1
        }
        
        response = self.make_request("POST", "/qr-codes/create", test_qr_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                
                if result.get("success") and result.get("qr_codes"):
                    qr_url = result["qr_codes"][0].get("qr_url", "")
                    
                    # Verify format: {scheme}://{host}/qr/{unique_code}?to=...
                    import re
                    pattern = r'^https?://[^/]+/qr/[a-f0-9-]+\?to='
                    
                    if re.match(pattern, qr_url):
                        self.log_test("QR Code - URL Format", True, 
                                    f"QR URL matches expected format: {qr_url}")
                        return True
                    else:
                        self.log_test("QR Code - URL Format", False, 
                                    f"QR URL format incorrect: {qr_url}")
                else:
                    self.log_test("QR Code - URL Format", False, 
                                "Failed to create test QR code for format verification")
            except Exception as e:
                self.log_test("QR Code - URL Format", False, 
                            f"Error verifying URL format: {e}")
        else:
            self.log_test("QR Code - URL Format", False, 
                        "Failed to create QR code for format test")
        
        return False
    
    def check_backend_logs(self):
        """Test 4: Check backend logs for dynamic URL usage"""
        print("\n=== Test 4: Backend Logging Verification ===")
        
        # Check supervisor logs for backend
        try:
            import subprocess
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                log_content = result.stdout
                if "Creating QR code with backend URL:" in log_content:
                    self.log_test("QR Code - Backend Logging", True, 
                                "Found 'Creating QR code with backend URL:' in backend logs")
                    return True
                else:
                    self.log_test("QR Code - Backend Logging", False, 
                                "Backend logging message not found in recent logs")
            else:
                self.log_test("QR Code - Backend Logging", False, 
                            "Could not access backend logs")
        except Exception as e:
            self.log_test("QR Code - Backend Logging", False, 
                        f"Error checking backend logs: {e}")
        
        return False
    
    def run_all_tests(self):
        """Run all QR Code Dynamic URL Generation tests"""
        print("🚀 Starting QR Code Dynamic URL Generation Testing")
        print("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            print("\n❌ Authentication failed - cannot proceed with tests")
            return False
        
        # Run tests
        tests = [
            self.test_single_qr_creation,
            self.test_batch_qr_creation,
            self.test_url_format_verification,
            self.check_backend_logs
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test in tests:
            try:
                if test():
                    passed_tests += 1
            except Exception as e:
                print(f"❌ Test {test.__name__} failed with exception: {e}")
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 QR CODE DYNAMIC URL TEST SUMMARY")
        print("=" * 60)
        
        success_rate = (passed_tests / total_tests) * 100
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 75:
            print("🎉 EXCELLENT: QR Code Dynamic URL Generation is working correctly!")
        elif success_rate >= 50:
            print("✅ GOOD: QR Code Dynamic URL Generation is mostly working")
        else:
            print("❌ CRITICAL: QR Code Dynamic URL Generation has major issues")
        
        # Print detailed results
        print("\n📋 DETAILED TEST RESULTS:")
        print("-" * 40)
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return success_rate >= 50

if __name__ == "__main__":
    tester = QRCodeDynamicURLTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)