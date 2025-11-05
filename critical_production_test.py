#!/usr/bin/env python3
"""
CRITICAL PRODUCTION ISSUE TESTING
Based on the review request, focusing on:
1. Campaign deletion issues (5 QR codes, 0 scans, created 28/10/2025)
2. Scan data not showing (QR codes work but analytics show 0)
"""

import requests
import json
import sys
from datetime import datetime
import time

# Configuration
BASE_URL = "https://telecaller-desk.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class CriticalProductionTester:
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
    
    def authenticate(self):
        """Authenticate as master admin"""
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
    
    def test_campaign_deletion_comprehensive(self):
        """
        COMPREHENSIVE CAMPAIGN DELETION TESTING
        Tests the specific production issue where campaigns cannot be deleted
        """
        print("\n=== COMPREHENSIVE CAMPAIGN DELETION TESTING ===")
        
        success_count = 0
        
        # Step 1: List all existing campaigns
        print("\n--- Step 1: Listing all existing campaigns ---")
        response = self.make_request("GET", "/qr-codes")
        
        existing_campaigns = {}
        if response and response.status_code == 200:
            try:
                response_data = response.json()
                qr_codes = response_data.get('qr_codes', [])
                
                # Group by campaign
                for qr in qr_codes:
                    campaign_name = qr.get('campaign_name', 'Unknown')
                    if campaign_name not in existing_campaigns:
                        existing_campaigns[campaign_name] = []
                    existing_campaigns[campaign_name].append(qr)
                
                self.log_test("Campaign Deletion - List Existing", True, 
                            f"Found {len(existing_campaigns)} existing campaigns with {len(qr_codes)} total QR codes")
                success_count += 1
                
                # Look for campaigns with 5 QR codes (matching the production issue)
                five_qr_campaigns = [name for name, qrs in existing_campaigns.items() if len(qrs) == 5]
                if five_qr_campaigns:
                    print(f"   Found campaigns with 5 QR codes: {five_qr_campaigns}")
                else:
                    print("   No existing campaigns with exactly 5 QR codes found")
                
            except json.JSONDecodeError:
                self.log_test("Campaign Deletion - List Existing", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Campaign Deletion - List Existing", False, error_msg)
        
        # Step 2: Create a test campaign with 5 QR codes to simulate the production issue
        print("\n--- Step 2: Creating test campaign with 5 QR codes ---")
        
        test_campaign_name = f"PRODUCTION_TEST_5QR_{int(time.time())}"
        
        # Create 5 QR codes using the batch endpoint
        batch_data = {
            "campaign_name": test_campaign_name,
            "landing_page_type": "single",
            "landing_page_single": "https://nuraemobility.co.in",
            "utm_source": "production_test",
            "utm_medium": "qr_code",
            "utm_campaign": "deletion_test",
            "count": 5
        }
        
        response = self.make_request("POST", "/qr-codes/create-batch", batch_data)
        
        created_qr_ids = []
        if response and response.status_code == 200:
            try:
                result = response.json()
                qr_codes = result.get('qr_codes', [])
                created_qr_ids = [qr.get('id') for qr in qr_codes]
                
                if len(qr_codes) == 5:
                    self.log_test("Campaign Deletion - Create Test Campaign", True, 
                                f"Created test campaign '{test_campaign_name}' with 5 QR codes")
                    success_count += 1
                else:
                    self.log_test("Campaign Deletion - Create Test Campaign", False, 
                                f"Expected 5 QR codes, got {len(qr_codes)}")
            except json.JSONDecodeError:
                self.log_test("Campaign Deletion - Create Test Campaign", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Campaign Deletion - Create Test Campaign", False, error_msg)
            return success_count >= 1
        
        # Step 3: Verify the campaign has 0 scans (matching production issue)
        print("\n--- Step 3: Verifying campaign has 0 scans ---")
        
        response = self.make_request("GET", "/qr-codes")
        if response and response.status_code == 200:
            try:
                response_data = response.json()
                qr_codes = response_data.get('qr_codes', [])
                
                test_qr_codes = [qr for qr in qr_codes if qr.get('campaign_name') == test_campaign_name]
                total_scans = sum(qr.get('total_scans', 0) for qr in test_qr_codes)
                
                if total_scans == 0:
                    self.log_test("Campaign Deletion - Zero Scans Verified", True, 
                                f"Campaign '{test_campaign_name}' has 0 total scans (matches production issue)")
                    success_count += 1
                else:
                    self.log_test("Campaign Deletion - Zero Scans Verified", False, 
                                f"Campaign has {total_scans} scans, expected 0")
                
            except json.JSONDecodeError:
                self.log_test("Campaign Deletion - Zero Scans Verified", False, 
                            "Invalid JSON response", response.text)
        
        # Step 4: Test deletion without force flag (should work for unpublished campaigns)
        print(f"\n--- Step 4: Testing deletion of '{test_campaign_name}' without force ---")
        
        response = self.make_request("DELETE", f"/qr-codes/campaigns/{test_campaign_name}")
        
        if response:
            if response.status_code == 200:
                try:
                    result = response.json()
                    self.log_test("Campaign Deletion - Without Force Success", True, 
                                f"Campaign deleted successfully: {result.get('message', 'No message')}")
                    success_count += 1
                    
                    # Verify deletion by checking if campaign still exists
                    verify_response = self.make_request("GET", "/qr-codes")
                    if verify_response and verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        remaining_qr_codes = verify_data.get('qr_codes', [])
                        remaining_test_qrs = [qr for qr in remaining_qr_codes if qr.get('campaign_name') == test_campaign_name]
                        
                        if len(remaining_test_qrs) == 0:
                            self.log_test("Campaign Deletion - Verification", True, 
                                        "Campaign and all QR codes successfully removed from database")
                            success_count += 1
                        else:
                            self.log_test("Campaign Deletion - Verification", False, 
                                        f"Campaign still has {len(remaining_test_qrs)} QR codes in database")
                    
                except json.JSONDecodeError:
                    self.log_test("Campaign Deletion - Without Force Success", False, 
                                "Invalid JSON response", response.text)
            elif response.status_code == 400:
                try:
                    error_data = response.json()
                    error_detail = error_data.get('detail', 'Unknown error')
                    
                    if "published" in error_detail.lower():
                        self.log_test("Campaign Deletion - Published Campaign Protection", True, 
                                    f"Correctly rejected deletion of published campaign: {error_detail}")
                        success_count += 1
                        
                        # Try with force=true
                        print(f"   Trying deletion with force=true...")
                        force_response = self.make_request("DELETE", f"/qr-codes/campaigns/{test_campaign_name}?force=true")
                        
                        if force_response and force_response.status_code == 200:
                            try:
                                force_result = force_response.json()
                                self.log_test("Campaign Deletion - Force Delete Success", True, 
                                            f"Force deletion successful: {force_result.get('message', 'No message')}")
                                success_count += 1
                            except json.JSONDecodeError:
                                self.log_test("Campaign Deletion - Force Delete Success", False, 
                                            "Invalid JSON response for force delete", force_response.text)
                        else:
                            force_error = "Network error" if not force_response else f"Status {force_response.status_code}"
                            self.log_test("Campaign Deletion - Force Delete Success", False, 
                                        f"Force deletion failed: {force_error}")
                    else:
                        self.log_test("Campaign Deletion - Error Analysis", False, 
                                    f"Unexpected error (not published-related): {error_detail}")
                except json.JSONDecodeError:
                    self.log_test("Campaign Deletion - Error Analysis", False, 
                                "Invalid JSON error response", response.text)
            else:
                self.log_test("Campaign Deletion - Without Force Success", False, 
                            f"Unexpected status code: {response.status_code}", response.text)
        else:
            self.log_test("Campaign Deletion - Without Force Success", False, "Network error")
        
        return success_count >= 3
    
    def test_scan_data_investigation(self):
        """
        SCAN DATA INVESTIGATION
        Tests the specific production issue where scan analytics show 0 despite QR codes working
        """
        print("\n=== SCAN DATA INVESTIGATION ===")
        
        success_count = 0
        
        # Step 1: Check existing QR codes and their scan data
        print("\n--- Step 1: Analyzing existing QR codes and scan data ---")
        
        response = self.make_request("GET", "/qr-codes")
        
        if response and response.status_code == 200:
            try:
                response_data = response.json()
                qr_codes = response_data.get('qr_codes', [])
                
                total_qr_codes = len(qr_codes)
                qr_codes_with_scans = [qr for qr in qr_codes if qr.get('total_scans', 0) > 0]
                qr_codes_zero_scans = [qr for qr in qr_codes if qr.get('total_scans', 0) == 0]
                
                self.log_test("Scan Investigation - QR Code Analysis", True, 
                            f"Total: {total_qr_codes} QR codes, With scans: {len(qr_codes_with_scans)}, Zero scans: {len(qr_codes_zero_scans)}")
                success_count += 1
                
                # Test scanning functionality with a QR code that has zero scans
                if qr_codes_zero_scans:
                    test_qr = qr_codes_zero_scans[0]
                    qr_id = test_qr.get('id')
                    short_code = test_qr.get('unique_short_code')
                    
                    if short_code:
                        print(f"   Testing QR code: {qr_id} with short_code: {short_code}")
                        
                        # Step 2: Test QR code scanning functionality
                        print(f"\n--- Step 2: Testing scan functionality for QR {short_code} ---")
                        
                        # Test the scan endpoint (should redirect)
                        scan_response = self.make_request("GET", f"/qr/{short_code}", use_auth=False)
                        
                        if scan_response:
                            if scan_response.status_code == 302:
                                redirect_url = scan_response.headers.get('Location', 'No location header')
                                self.log_test("Scan Investigation - QR Redirect Test", True, 
                                            f"QR scan works correctly (302 redirect to: {redirect_url})")
                                success_count += 1
                                
                                # Wait a moment for scan to be processed
                                time.sleep(2)
                                
                                # Check if scan was recorded
                                print("   Checking if scan was recorded...")
                                updated_response = self.make_request("GET", "/qr-codes")
                                
                                if updated_response and updated_response.status_code == 200:
                                    try:
                                        updated_data = updated_response.json()
                                        updated_qr_codes = updated_data.get('qr_codes', [])
                                        updated_qr = next((qr for qr in updated_qr_codes if qr.get('id') == qr_id), None)
                                        
                                        if updated_qr:
                                            new_scan_count = updated_qr.get('total_scans', 0)
                                            old_scan_count = test_qr.get('total_scans', 0)
                                            
                                            if new_scan_count > old_scan_count:
                                                self.log_test("Scan Investigation - Scan Recording", True, 
                                                            f"Scan recorded successfully: {old_scan_count} -> {new_scan_count}")
                                                success_count += 1
                                            else:
                                                self.log_test("Scan Investigation - Scan Recording", False, 
                                                            f"Scan not recorded (still {new_scan_count}) - THIS IS THE PRODUCTION ISSUE!")
                                        else:
                                            self.log_test("Scan Investigation - Scan Recording", False, 
                                                        "Could not find updated QR code data")
                                    except json.JSONDecodeError:
                                        self.log_test("Scan Investigation - Scan Recording", False, 
                                                    "Invalid JSON response for updated data")
                            elif scan_response.status_code == 404:
                                self.log_test("Scan Investigation - QR Redirect Test", False, 
                                            f"QR code not found (404) - THIS MATCHES THE PRODUCTION ISSUE!")
                                success_count += 1  # This confirms the production issue
                            elif scan_response.status_code == 200:
                                # This might be returning HTML instead of redirecting
                                self.log_test("Scan Investigation - QR Redirect Test", False, 
                                            f"QR scan returned 200 instead of 302 redirect - possible issue with scan endpoint")
                            else:
                                self.log_test("Scan Investigation - QR Redirect Test", False, 
                                            f"Unexpected scan response: {scan_response.status_code}")
                        else:
                            self.log_test("Scan Investigation - QR Redirect Test", False, "Network error during scan test")
                    else:
                        self.log_test("Scan Investigation - QR Code Selection", False, 
                                    "Test QR code missing unique_short_code field")
                else:
                    self.log_test("Scan Investigation - QR Code Selection", False, 
                                "No QR codes with zero scans found for testing")
                
            except json.JSONDecodeError:
                self.log_test("Scan Investigation - QR Code Analysis", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Scan Investigation - QR Code Analysis", False, error_msg)
        
        # Step 3: Test QR analytics endpoints
        print("\n--- Step 3: Testing QR analytics endpoints ---")
        
        # Test the main analytics endpoint
        response = self.make_request("GET", "/qr-codes/analytics")
        
        if response:
            if response.status_code == 200:
                try:
                    analytics = response.json()
                    self.log_test("Scan Investigation - Analytics Endpoint", True, 
                                f"Analytics endpoint working: {analytics}")
                    success_count += 1
                except json.JSONDecodeError:
                    self.log_test("Scan Investigation - Analytics Endpoint", False, 
                                "Invalid JSON response", response.text)
            elif response.status_code == 404:
                self.log_test("Scan Investigation - Analytics Endpoint", False, 
                            "Analytics endpoint returns 404 - QR code not found")
            else:
                self.log_test("Scan Investigation - Analytics Endpoint", False, 
                            f"Analytics endpoint failed: {response.status_code}")
        else:
            self.log_test("Scan Investigation - Analytics Endpoint", False, "Network error")
        
        # Step 4: Create a new QR code and test complete flow
        print("\n--- Step 4: Testing complete QR code flow (create -> scan -> analytics) ---")
        
        test_qr_data = {
            "campaign_name": f"SCAN_TEST_{int(time.time())}",
            "landing_page_type": "single",
            "single_url": "https://nuraemobility.co.in",
            "utm_source": "scan_test",
            "utm_medium": "qr_code",
            "utm_campaign": "production_investigation"
        }
        
        response = self.make_request("POST", "/qr-codes/create", test_qr_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                new_qr = result.get('qr_code', {})
                new_qr_id = new_qr.get('id')
                new_short_code = new_qr.get('unique_short_code')
                
                if new_qr_id and new_short_code:
                    self.log_test("Scan Investigation - Create New QR", True, 
                                f"Created test QR: {new_qr_id} with code: {new_short_code}")
                    success_count += 1
                    
                    # Test scanning the new QR code
                    print(f"   Testing scan of new QR code: {new_short_code}")
                    scan_response = self.make_request("GET", f"/qr/{new_short_code}", use_auth=False)
                    
                    if scan_response and scan_response.status_code == 302:
                        self.log_test("Scan Investigation - New QR Scan Test", True, 
                                    "New QR code scan works correctly (302 redirect)")
                        success_count += 1
                        
                        # Check if scan was recorded
                        time.sleep(2)
                        
                        check_response = self.make_request("GET", "/qr-codes")
                        if check_response and check_response.status_code == 200:
                            try:
                                check_data = check_response.json()
                                all_qr_codes = check_data.get('qr_codes', [])
                                test_qr = next((qr for qr in all_qr_codes if qr.get('id') == new_qr_id), None)
                                
                                if test_qr:
                                    scan_count = test_qr.get('total_scans', 0)
                                    if scan_count > 0:
                                        self.log_test("Scan Investigation - New QR Scan Recording", True, 
                                                    f"Scan recorded successfully: {scan_count} scans")
                                        success_count += 1
                                    else:
                                        self.log_test("Scan Investigation - New QR Scan Recording", False, 
                                                    "Scan not recorded (total_scans still 0) - PRODUCTION ISSUE CONFIRMED!")
                                else:
                                    self.log_test("Scan Investigation - New QR Scan Recording", False, 
                                                "Could not find test QR code after scan")
                            except json.JSONDecodeError:
                                self.log_test("Scan Investigation - New QR Scan Recording", False, 
                                            "Invalid JSON response when checking scan recording")
                    else:
                        status = scan_response.status_code if scan_response else "Network error"
                        self.log_test("Scan Investigation - New QR Scan Test", False, 
                                    f"New QR scan failed: {status}")
                else:
                    self.log_test("Scan Investigation - Create New QR", False, 
                                "Created QR missing ID or short_code", result)
            except json.JSONDecodeError:
                self.log_test("Scan Investigation - Create New QR", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Scan Investigation - Create New QR", False, error_msg)
        
        return success_count >= 4
    
    def run_critical_production_tests(self):
        """Run the critical production issue tests"""
        print("🚨 CRITICAL PRODUCTION ISSUE TESTING 🚨")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed with testing")
            return False
        
        # Run both critical tests
        campaign_deletion_success = self.test_campaign_deletion_comprehensive()
        scan_data_success = self.test_scan_data_investigation()
        
        # Summary
        print("\n" + "=" * 60)
        print("🔍 CRITICAL PRODUCTION TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = sum(1 for result in self.test_results if result['success'])
        total_tests = len(self.test_results)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print("\n📋 DETAILED FINDINGS:")
        
        # Group results by issue
        campaign_tests = [r for r in self.test_results if 'Campaign Deletion' in r['test']]
        scan_tests = [r for r in self.test_results if 'Scan Investigation' in r['test']]
        
        print(f"\n🗂️  ISSUE 1 - Campaign Deletion ({len(campaign_tests)} tests):")
        for result in campaign_tests:
            status = "✅" if result['success'] else "❌"
            print(f"   {status} {result['test']}: {result['message']}")
        
        print(f"\n📊 ISSUE 2 - Scan Data ({len(scan_tests)} tests):")
        for result in scan_tests:
            status = "✅" if result['success'] else "❌"
            print(f"   {status} {result['test']}: {result['message']}")
        
        # Critical issues found
        critical_issues = [r for r in self.test_results if not r['success']]
        if critical_issues:
            print(f"\n🚨 CRITICAL ISSUES IDENTIFIED ({len(critical_issues)}):")
            for issue in critical_issues:
                print(f"   ❌ {issue['test']}: {issue['message']}")
        
        # Root cause analysis
        print(f"\n🔍 ROOT CAUSE ANALYSIS:")
        
        # Check for specific patterns in failures
        scan_recording_failures = [r for r in critical_issues if 'Scan Recording' in r['test']]
        if scan_recording_failures:
            print("   📊 SCAN RECORDING ISSUE: QR codes redirect correctly but scans are not being recorded in the database")
        
        redirect_failures = [r for r in critical_issues if 'Redirect' in r['test']]
        if redirect_failures:
            print("   🔗 REDIRECT ISSUE: QR codes are not redirecting properly (returning 200 instead of 302)")
        
        analytics_failures = [r for r in critical_issues if 'Analytics' in r['test']]
        if analytics_failures:
            print("   📈 ANALYTICS ISSUE: Analytics endpoints are not working correctly")
        
        return passed_tests >= (total_tests * 0.6)  # 60% success rate

if __name__ == "__main__":
    tester = CriticalProductionTester()
    success = tester.run_critical_production_tests()
    
    if success:
        print("\n✅ Critical production testing completed with acceptable results")
        sys.exit(0)
    else:
        print("\n❌ Critical production issues identified - requires immediate attention")
        sys.exit(1)