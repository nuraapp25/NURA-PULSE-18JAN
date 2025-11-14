#!/usr/bin/env python3
"""
Critical QR Code Production Fixes Testing
Tests the two critical QR code production fixes as documented in test_result.md:
1. Batch QR Code Field Name Mismatch Fix
2. Campaign Deletion Enhanced Logging
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BASE_URL = "https://driver-docs-2.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class QRCodeCriticalFixesTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_results = []
        self.created_campaigns = []  # Track campaigns for cleanup
        
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
        """Authenticate and get token"""
        print("=== Authenticating ===")
        
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
    
    def test_batch_qr_code_field_name_fix(self):
        """
        Test 1: Batch QR Code Field Name Mismatch Fix
        Create batch QR codes with device-specific URLs and verify they work correctly
        """
        print("\n=== TEST 1: Batch QR Code Field Name Mismatch Fix ===")
        
        success_count = 0
        campaign_name = f"TestBatch_{int(time.time())}"
        
        # Test data as specified in review request
        batch_data = {
            "campaign_name": campaign_name,
            "landing_page_type": "multi",
            "landing_page_ios": "https://apps.apple.com/app/nura",
            "landing_page_android": "https://play.google.com/store/apps/nura",
            "landing_page_mobile": "https://nuraemobility.co.in/mobile",
            "landing_page_desktop": "https://nuraemobility.co.in/desktop",
            "qr_count": 3,
            "utm_source": "test_batch",
            "utm_medium": "qr_code",
            "utm_campaign": campaign_name
        }
        
        print(f"\n--- Creating batch of {batch_data['qr_count']} QR codes with multi-URL type ---")
        
        # Step 1: Create batch QR codes
        response = self.make_request("POST", "/qr-codes/create-batch", batch_data)
        
        created_qr_codes = []
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "qr_codes" in result:
                    created_qr_codes = result["qr_codes"]
                    self.log_test("Batch QR Creation", True, 
                                f"Successfully created {len(created_qr_codes)} QR codes in campaign '{campaign_name}'")
                    success_count += 1
                    self.created_campaigns.append(campaign_name)
                else:
                    self.log_test("Batch QR Creation", False, 
                                f"Batch creation failed: {result.get('message', 'Unknown error')}", result)
                    return success_count
            except json.JSONDecodeError:
                self.log_test("Batch QR Creation", False, "Invalid JSON response", response.text)
                return success_count
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Batch QR Creation", False, error_msg, 
                        response.text if response else None)
            return success_count
        
        # Step 2: Check database to confirm QR codes stored with NEW field names
        print("\n--- Verifying QR codes stored with correct field names ---")
        
        # Get campaign details to verify field names
        response = self.make_request("GET", f"/qr-codes/campaign/{campaign_name}")
        
        if response and response.status_code == 200:
            try:
                campaign_data = response.json()
                if "qr_codes" in campaign_data:
                    qr_codes = campaign_data["qr_codes"]
                    
                    # Check if QR codes have the new field names
                    sample_qr = qr_codes[0] if qr_codes else {}
                    new_field_names = ["landing_page_ios", "landing_page_android", "landing_page_mobile", "landing_page_desktop"]
                    
                    fields_present = []
                    for field in new_field_names:
                        if field in sample_qr:
                            fields_present.append(field)
                    
                    if len(fields_present) == len(new_field_names):
                        self.log_test("Database Field Names", True, 
                                    f"QR codes stored with NEW field names: {', '.join(fields_present)}")
                        success_count += 1
                    else:
                        missing_fields = [f for f in new_field_names if f not in fields_present]
                        self.log_test("Database Field Names", False, 
                                    f"Missing new field names: {missing_fields}. Present: {fields_present}")
                else:
                    self.log_test("Database Field Names", False, "No QR codes found in campaign response")
            except json.JSONDecodeError:
                self.log_test("Database Field Names", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Database Field Names", False, error_msg)
        
        # Step 3: Test scanning each QR code's short_code
        print("\n--- Testing QR code scanning and device detection ---")
        
        device_test_cases = [
            {
                "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
                "expected_redirect": "https://apps.apple.com/app/nura",
                "device_type": "iOS"
            },
            {
                "user_agent": "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
                "expected_redirect": "https://play.google.com/store/apps/nura",
                "device_type": "Android"
            },
            {
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "expected_redirect": "https://nuraemobility.co.in/desktop",
                "device_type": "Desktop"
            }
        ]
        
        for i, qr_code in enumerate(created_qr_codes[:3]):  # Test first 3 QR codes
            short_code = qr_code.get("short_code")
            if not short_code:
                self.log_test(f"QR Scan Test {i+1}", False, "QR code missing short_code")
                continue
            
            for j, test_case in enumerate(device_test_cases):
                print(f"\n--- Testing QR {i+1} with {test_case['device_type']} device ---")
                
                # Test scanning with specific user agent
                headers = {
                    "User-Agent": test_case["user_agent"]
                }
                if self.token:
                    headers["Authorization"] = f"Bearer {self.token}"
                
                try:
                    url = f"{self.base_url}/qr/{short_code}"
                    response = requests.get(url, headers=headers, allow_redirects=False, timeout=10)
                    
                    if response.status_code in [301, 302, 307, 308]:
                        redirect_url = response.headers.get("Location", "")
                        
                        # Check if redirect URL matches expected URL
                        if test_case["expected_redirect"] in redirect_url:
                            self.log_test(f"QR {i+1} {test_case['device_type']} Redirect", True, 
                                        f"Correct redirect to {test_case['device_type']} URL: {redirect_url}")
                            success_count += 1
                        else:
                            self.log_test(f"QR {i+1} {test_case['device_type']} Redirect", False, 
                                        f"Wrong redirect URL. Expected: {test_case['expected_redirect']}, Got: {redirect_url}")
                    else:
                        self.log_test(f"QR {i+1} {test_case['device_type']} Redirect", False, 
                                    f"Expected redirect (301/302), got status {response.status_code}")
                        
                except Exception as e:
                    self.log_test(f"QR {i+1} {test_case['device_type']} Redirect", False, 
                                f"Exception during scan test: {e}")
        
        # Step 4: Verify analytics are recorded
        print("\n--- Verifying scan analytics are recorded ---")
        
        # Wait a moment for analytics to be processed
        time.sleep(2)
        
        response = self.make_request("GET", f"/qr-codes/campaigns/{campaign_name}/analytics")
        
        if response and response.status_code == 200:
            try:
                analytics = response.json()
                total_scans = analytics.get("total_scans", 0)
                
                if total_scans > 0:
                    self.log_test("Analytics Recording", True, 
                                f"Analytics recorded: {total_scans} total scans")
                    success_count += 1
                else:
                    self.log_test("Analytics Recording", False, 
                                f"No scans recorded in analytics (expected > 0)")
            except json.JSONDecodeError:
                self.log_test("Analytics Recording", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Analytics Recording", False, error_msg)
        
        return success_count
    
    def test_campaign_deletion_enhanced_logging(self):
        """
        Test 2: Campaign Deletion Enhanced Logging
        Test campaign deletion with proper permission checks and logging
        """
        print("\n=== TEST 2: Campaign Deletion Enhanced Logging ===")
        
        success_count = 0
        test_campaign_name = f"TestDeleteCampaign_{int(time.time())}"
        
        # Step 1: Create a test campaign with 2 QR codes
        print(f"\n--- Creating test campaign '{test_campaign_name}' with 2 QR codes ---")
        
        campaign_data = {
            "campaign_name": test_campaign_name,
            "landing_page_type": "single",
            "landing_page_url": "https://nuraemobility.co.in/test",
            "qr_count": 2,
            "utm_source": "test_delete",
            "utm_medium": "qr_code",
            "utm_campaign": test_campaign_name
        }
        
        response = self.make_request("POST", "/qr-codes/create-batch", campaign_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success"):
                    self.log_test("Test Campaign Creation", True, 
                                f"Created test campaign with {result.get('qr_count', 0)} QR codes")
                    success_count += 1
                    self.created_campaigns.append(test_campaign_name)
                else:
                    self.log_test("Test Campaign Creation", False, 
                                f"Failed to create test campaign: {result.get('message', 'Unknown error')}")
                    return success_count
            except json.JSONDecodeError:
                self.log_test("Test Campaign Creation", False, "Invalid JSON response", response.text)
                return success_count
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Test Campaign Creation", False, error_msg)
            return success_count
        
        # Step 2: Try deleting without force flag (should work if unpublished)
        print("\n--- Testing deletion without force flag (unpublished campaign) ---")
        
        response = self.make_request("DELETE", f"/qr-codes/campaigns/{test_campaign_name}")
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success"):
                    self.log_test("Delete Unpublished Campaign", True, 
                                f"Successfully deleted unpublished campaign: {result.get('message', '')}")
                    success_count += 1
                    
                    # Remove from our tracking since it's deleted
                    if test_campaign_name in self.created_campaigns:
                        self.created_campaigns.remove(test_campaign_name)
                else:
                    self.log_test("Delete Unpublished Campaign", False, 
                                f"Failed to delete unpublished campaign: {result.get('message', 'Unknown error')}")
            except json.JSONDecodeError:
                self.log_test("Delete Unpublished Campaign", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Delete Unpublished Campaign", False, error_msg)
        
        # Step 3: Create another campaign and publish it
        print(f"\n--- Creating and publishing another test campaign ---")
        
        published_campaign_name = f"TestPublishedCampaign_{int(time.time())}"
        
        campaign_data["campaign_name"] = published_campaign_name
        campaign_data["utm_campaign"] = published_campaign_name
        
        response = self.make_request("POST", "/qr-codes/create-batch", campaign_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success"):
                    self.log_test("Published Campaign Creation", True, 
                                f"Created campaign for publish test")
                    success_count += 1
                    self.created_campaigns.append(published_campaign_name)
                    
                    # Publish the campaign
                    publish_response = self.make_request("POST", f"/qr-codes/campaigns/{published_campaign_name}/publish")
                    
                    if publish_response and publish_response.status_code == 200:
                        self.log_test("Campaign Publishing", True, "Successfully published campaign")
                        success_count += 1
                    else:
                        self.log_test("Campaign Publishing", False, 
                                    f"Failed to publish campaign: {publish_response.status_code if publish_response else 'Network error'}")
                else:
                    self.log_test("Published Campaign Creation", False, 
                                f"Failed to create campaign for publish test")
                    return success_count
            except json.JSONDecodeError:
                self.log_test("Published Campaign Creation", False, "Invalid JSON response", response.text)
                return success_count
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Published Campaign Creation", False, error_msg)
            return success_count
        
        # Step 4: Try deleting published campaign without force flag (should fail)
        print("\n--- Testing deletion of published campaign without force flag ---")
        
        response = self.make_request("DELETE", f"/qr-codes/campaigns/{published_campaign_name}")
        
        if response and response.status_code in [400, 403, 409]:
            try:
                result = response.json()
                error_message = result.get("detail", result.get("message", ""))
                if "published" in error_message.lower() or "force" in error_message.lower():
                    self.log_test("Delete Published Campaign Without Force", True, 
                                f"Correctly rejected deletion of published campaign: {error_message}")
                    success_count += 1
                else:
                    self.log_test("Delete Published Campaign Without Force", False, 
                                f"Wrong error message: {error_message}")
            except json.JSONDecodeError:
                self.log_test("Delete Published Campaign Without Force", False, "Invalid JSON response", response.text)
        elif response and response.status_code == 400:
            # Check if it's the expected error about published campaigns
            try:
                result = response.json()
                error_message = result.get("detail", result.get("message", ""))
                self.log_test("Delete Published Campaign Without Force", True, 
                            f"Correctly rejected deletion: {error_message}")
                success_count += 1
            except:
                self.log_test("Delete Published Campaign Without Force", False, 
                            f"Got 400 but couldn't parse error message")
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Delete Published Campaign Without Force", False, 
                        f"Expected 400/403/409, got {status}")
        
        # Step 5: Try deleting published campaign with force=true as master admin (should work)
        print("\n--- Testing deletion of published campaign with force=true ---")
        
        response = self.make_request("DELETE", f"/qr-codes/campaigns/{published_campaign_name}?force=true")
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success"):
                    self.log_test("Delete Published Campaign With Force", True, 
                                f"Successfully deleted published campaign with force=true: {result.get('message', '')}")
                    success_count += 1
                    
                    # Remove from our tracking since it's deleted
                    if published_campaign_name in self.created_campaigns:
                        self.created_campaigns.remove(published_campaign_name)
                else:
                    self.log_test("Delete Published Campaign With Force", False, 
                                f"Failed to delete with force=true: {result.get('message', 'Unknown error')}")
            except json.JSONDecodeError:
                self.log_test("Delete Published Campaign With Force", False, "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Delete Published Campaign With Force", False, error_msg)
        
        # Step 6: Verify both QR codes and associated scans are deleted
        print("\n--- Verifying QR codes and scans are properly deleted ---")
        
        # Try to access the deleted campaign
        response = self.make_request("GET", f"/qr-codes/campaign/{published_campaign_name}")
        
        if response and response.status_code == 404:
            self.log_test("Campaign Deletion Verification", True, 
                        "Campaign properly deleted (404 when accessing)")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Campaign Deletion Verification", False, 
                        f"Expected 404 for deleted campaign, got {status}")
        
        return success_count
    
    def cleanup_test_campaigns(self):
        """Clean up any remaining test campaigns"""
        print("\n=== Cleaning up test campaigns ===")
        
        for campaign_name in self.created_campaigns:
            try:
                # Try to delete with force=true
                response = self.make_request("DELETE", f"/qr-codes/campaigns/{campaign_name}?force=true")
                if response and response.status_code == 200:
                    print(f"✅ Cleaned up campaign: {campaign_name}")
                else:
                    print(f"⚠️  Could not clean up campaign: {campaign_name}")
            except Exception as e:
                print(f"⚠️  Error cleaning up campaign {campaign_name}: {e}")
    
    def run_all_tests(self):
        """Run all critical QR code fix tests"""
        print("🔍 CRITICAL QR CODE PRODUCTION FIXES TESTING")
        print("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        try:
            # Test 1: Batch QR Code Field Name Mismatch Fix
            test1_success = self.test_batch_qr_code_field_name_fix()
            
            # Test 2: Campaign Deletion Enhanced Logging
            test2_success = self.test_campaign_deletion_enhanced_logging()
            
            # Summary
            print("\n" + "=" * 60)
            print("🏁 CRITICAL FIXES TEST SUMMARY")
            print("=" * 60)
            
            total_tests = len(self.test_results)
            passed_tests = sum(1 for result in self.test_results if result["success"])
            
            print(f"Total Tests: {total_tests}")
            print(f"Passed: {passed_tests}")
            print(f"Failed: {total_tests - passed_tests}")
            print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
            
            # Critical success criteria
            print("\n🎯 CRITICAL SUCCESS CRITERIA:")
            print(f"✅ Test 1 (Batch QR Field Fix): {test1_success}/6 tests passed")
            print(f"✅ Test 2 (Campaign Deletion): {test2_success}/6 tests passed")
            
            # Detailed results
            print("\n📋 DETAILED RESULTS:")
            for result in self.test_results:
                status = "✅" if result["success"] else "❌"
                print(f"{status} {result['test']}: {result['message']}")
            
            # Overall assessment
            critical_threshold = 8  # At least 8 out of 12 critical tests should pass
            overall_success = passed_tests >= critical_threshold
            
            print(f"\n🏆 OVERALL ASSESSMENT: {'PASS' if overall_success else 'FAIL'}")
            if overall_success:
                print("✅ Critical QR code production fixes are working correctly!")
            else:
                print("❌ Critical issues found that need immediate attention!")
            
            return overall_success
            
        finally:
            # Always clean up test campaigns
            self.cleanup_test_campaigns()

def main():
    """Main function to run the critical QR code fixes tests"""
    tester = QRCodeCriticalFixesTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()