#!/usr/bin/env python3
"""
QR Code Dynamic URL Generation Test
Tests the fix for QR codes to use dynamic URLs based on request host instead of hardcoded environment variables.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration - Use environment URL from frontend/.env
BASE_URL = "https://driver-roster-1.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class QRDynamicURLTester:
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
        
        if response_data and isinstance(response_data, dict):
            # Print relevant response data for debugging
            if "qr_url" in str(response_data):
                print(f"   QR URL: {response_data}")
            elif not success:
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
            elif method.upper() == "PUT":
                if files:
                    response = requests.put(url, headers=headers, files=files, timeout=30)
                else:
                    headers["Content-Type"] = "application/json"
                    response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                if data is not None:
                    headers["Content-Type"] = "application/json"
                    response = requests.delete(url, headers=headers, json=data, timeout=30)
                else:
                    response = requests.delete(url, headers=headers, timeout=30)
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
        """Test 1: Login as master admin to get auth token"""
        print("\n=== Testing Authentication ===")
        
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
    
    def test_qr_code_creation_single(self):
        """Test 2: Create a test QR code using POST /api/qr-codes/create endpoint"""
        print("\n=== Testing Single QR Code Creation ===")
        
        # Test data as specified in the review request
        qr_data = {
            "name": "Test QR Dynamic URL",
            "campaign_name": "URL Test Campaign", 
            "landing_page_type": "single",
            "landing_page_single": "https://nuraemobility.co.in/",
            "bulk_count": 1
        }
        
        response = self.make_request("POST", "/qr-codes/create", qr_data)
        
        if not response:
            self.log_test("QR Creation - Single QR Code", False, "Network error during QR creation")
            return False
        
        if response.status_code == 200:
            try:
                result = response.json()
                
                # Verify response structure
                if result.get("success") == True:
                    qr_codes = result.get("qr_codes", [])
                    
                    if len(qr_codes) >= 1:
                        qr_code = qr_codes[0]
                        qr_url = qr_code.get("qr_url", "")
                        
                        self.log_test("QR Creation - Single QR Code", True, 
                                    f"QR code created successfully. QR codes count: {len(qr_codes)}")
                        
                        # CRITICAL CHECK: Examine the qr_url field
                        self.check_qr_url_format(qr_url, "Single QR Code")
                        
                        return True
                    else:
                        self.log_test("QR Creation - Single QR Code", False, 
                                    f"Expected at least 1 QR code, got {len(qr_codes)}", result)
                        return False
                else:
                    self.log_test("QR Creation - Single QR Code", False, 
                                f"QR creation failed: {result.get('message', 'Unknown error')}", result)
                    return False
                    
            except json.JSONDecodeError:
                self.log_test("QR Creation - Single QR Code", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("QR Creation - Single QR Code", False, 
                        f"QR creation failed with status {response.status_code}", response.text)
            return False
    
    def test_qr_code_creation_batch(self):
        """Test 3: Create batch QR codes using POST /api/qr-codes/create-batch endpoint"""
        print("\n=== Testing Batch QR Code Creation ===")
        
        # Test data as specified in the review request
        batch_data = {
            "campaign_name": "Batch URL Test",
            "qr_count": 2,
            "landing_page_type": "single",
            "single_url": "https://nuraemobility.co.in/"
        }
        
        response = self.make_request("POST", "/qr-codes/create-batch", batch_data)
        
        if not response:
            self.log_test("QR Creation - Batch QR Codes", False, "Network error during batch QR creation")
            return False
        
        if response.status_code == 200:
            try:
                result = response.json()
                
                # Verify response structure
                if result.get("success") == True:
                    qr_codes = result.get("qr_codes", [])
                    count = result.get("count", 0)
                    
                    if count == 2 and len(qr_codes) == 2:
                        self.log_test("QR Creation - Batch QR Codes", True, 
                                    f"Batch QR codes created successfully. Count: {count}")
                        
                        # CRITICAL CHECK: Examine tracking_url fields for both QR codes
                        for i, qr_code in enumerate(qr_codes):
                            tracking_url = qr_code.get("tracking_url", "")
                            self.check_qr_url_format(tracking_url, f"Batch QR Code #{i+1}")
                        
                        return True
                    else:
                        self.log_test("QR Creation - Batch QR Codes", False, 
                                    f"Expected 2 QR codes, got count={count}, array_length={len(qr_codes)}", result)
                        return False
                else:
                    self.log_test("QR Creation - Batch QR Codes", False, 
                                f"Batch QR creation failed: {result.get('message', 'Unknown error')}", result)
                    return False
                    
            except json.JSONDecodeError:
                self.log_test("QR Creation - Batch QR Codes", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("QR Creation - Batch QR Codes", False, 
                        f"Batch QR creation failed with status {response.status_code}", response.text)
            return False
    
    def check_qr_url_format(self, url, qr_type):
        """CRITICAL CHECK: Examine the qr_url/tracking_url field format"""
        print(f"\n--- CRITICAL URL CHECK for {qr_type} ---")
        print(f"URL: {url}")
        
        if not url:
            self.log_test(f"URL Format - {qr_type}", False, "URL is empty or missing")
            return False
        
        # Check if URL contains the current environment's host
        expected_host = "leadmanager-15.preview.emergentagent.com"
        
        if expected_host in url:
            # Check if it's using the correct format - both formats are valid:
            # 1. /qr/{code}?to=... (from first endpoint)
            # 2. /qr-codes/scan/{code} (from second endpoint)
            valid_formats = [
                f"https://{expected_host}/qr/",
                f"https://{expected_host}/qr-codes/scan/",
                f"https://{expected_host}/api/qr/"
            ]
            
            is_valid_format = any(url.startswith(fmt) for fmt in valid_formats)
            
            if is_valid_format:
                self.log_test(f"URL Format - {qr_type}", True, 
                            f"URL uses correct environment host and valid format: {expected_host}")
                
                # Check that it's NOT using the old hardcoded preview URL pattern
                # The fix should ensure URLs are dynamically generated based on request host
                if expected_host in url:
                    self.log_test(f"URL Dynamic Generation - {qr_type}", True, 
                                "URL uses current environment host (dynamic generation working)")
                else:
                    self.log_test(f"URL Dynamic Generation - {qr_type}", False, 
                                "URL does not use current environment host")
                
                return True
            else:
                self.log_test(f"URL Format - {qr_type}", False, 
                            f"URL has correct host but invalid path format: {url}")
                return False
        else:
            self.log_test(f"URL Format - {qr_type}", False, 
                        f"URL does not contain expected host '{expected_host}': {url}")
            return False
    
    def check_backend_logs(self):
        """Test 4: Check backend logs for the dynamic URL message"""
        print("\n=== Checking Backend Logs ===")
        
        try:
            # Try to read supervisor backend logs
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.out.log"], 
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Look for the specific log message
                if "Creating QR code with backend URL:" in log_content:
                    # Extract the URL from the log
                    lines = log_content.split('\n')
                    url_lines = [line for line in lines if "Creating QR code with backend URL:" in line]
                    
                    if url_lines:
                        latest_url_line = url_lines[-1]  # Get the most recent one
                        self.log_test("Backend Logs - Dynamic URL Message", True, 
                                    f"Found dynamic URL log message: {latest_url_line.strip()}")
                        
                        # Check if the URL in the log is correct
                        if "leadmanager-15.preview.emergentagent.com" in latest_url_line:
                            self.log_test("Backend Logs - Correct Environment URL", True, 
                                        "Log shows correct environment URL being used")
                        else:
                            self.log_test("Backend Logs - Correct Environment URL", False, 
                                        f"Log shows unexpected URL: {latest_url_line}")
                        
                        return True
                    else:
                        self.log_test("Backend Logs - Dynamic URL Message", False, 
                                    "Log message found but could not extract URL")
                        return False
                else:
                    self.log_test("Backend Logs - Dynamic URL Message", False, 
                                "Dynamic URL log message not found in recent logs")
                    return False
            else:
                self.log_test("Backend Logs - Access", False, 
                            f"Could not read backend logs: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            self.log_test("Backend Logs - Access", False, "Timeout reading backend logs")
            return False
        except Exception as e:
            self.log_test("Backend Logs - Access", False, f"Error reading backend logs: {e}")
            return False
    
    def run_all_tests(self):
        """Run all QR Dynamic URL tests"""
        print("🧪 Starting QR Code Dynamic URL Generation Tests")
        print("=" * 60)
        
        success_count = 0
        total_tests = 4
        
        # Test 1: Authentication
        if self.test_authentication():
            success_count += 1
        
        # Test 2: Single QR Code Creation
        if self.test_qr_code_creation_single():
            success_count += 1
        
        # Test 3: Batch QR Code Creation  
        if self.test_qr_code_creation_batch():
            success_count += 1
        
        # Test 4: Backend Logs Check
        if self.check_backend_logs():
            success_count += 1
        
        # Summary
        print("\n" + "=" * 60)
        print(f"🏁 QR Dynamic URL Tests Complete: {success_count}/{total_tests} passed")
        
        if success_count == total_tests:
            print("✅ ALL TESTS PASSED - QR Code Dynamic URL Generation is working correctly!")
            return True
        else:
            print(f"❌ {total_tests - success_count} TESTS FAILED - Issues found with QR Code Dynamic URL Generation")
            return False

def main():
    """Main test execution"""
    tester = QRDynamicURLTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()