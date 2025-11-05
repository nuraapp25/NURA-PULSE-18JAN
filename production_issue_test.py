#!/usr/bin/env python3
"""
URGENT PRODUCTION ISSUE INVESTIGATION
Testing specific production issues reported by user:
1. Campaign Folder Cannot Be Deleted (5 QR codes, 0 scans, created 28/10/2025)
2. Scan Data Not Showing (0 Total Scans) - QR codes work but analytics show 0
"""

import requests
import json
import sys
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://telecaller-desk.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class ProductionIssueTester:
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
    
    def investigate_campaign_deletion_issue(self):
        """
        ISSUE 1: Campaign Folder Cannot Be Deleted
        Investigation Steps:
        1. List all campaigns in the database using GET /api/qr-codes endpoint
        2. For the campaign shown in screenshot (created on 28/10/2025 with 5 QR codes), get campaign details
        3. Try to delete this specific campaign with force=true
        4. Check backend logs for any specific error messages during deletion attempt
        5. Verify if the campaign has any special characters or naming issues
        6. Check if QR codes in this campaign have any orphaned data
        """
        print("\n=== INVESTIGATING CAMPAIGN DELETION ISSUE ===")
        
        success_count = 0
        
        # Step 1: List all campaigns in the database
        print("\n--- Step 1: Listing all campaigns in database ---")
        response = self.make_request("GET", "/qr-codes")
        
        all_campaigns = []
        problematic_campaign = None
        
        if response and response.status_code == 200:
            try:
                response_data = response.json()
                qr_codes = response_data.get('qr_codes', [])
                
                # Group QR codes by campaign
                campaigns = {}
                for qr in qr_codes:
                    campaign_name = qr.get('campaign_name', 'Unknown')
                    if campaign_name not in campaigns:
                        campaigns[campaign_name] = []
                    campaigns[campaign_name].append(qr)
                
                self.log_test("Campaign Investigation - List Campaigns", True, 
                            f"Found {len(campaigns)} campaigns with total {len(qr_codes)} QR codes")
                success_count += 1
                
                # Look for campaigns with 5 QR codes (matching the screenshot)
                five_qr_campaigns = []
                for campaign_name, qr_list in campaigns.items():
                    if len(qr_list) == 5:
                        five_qr_campaigns.append({
                            'name': campaign_name,
                            'qr_codes': qr_list,
                            'count': len(qr_list)
                        })
                
                if five_qr_campaigns:
                    self.log_test("Campaign Investigation - Find 5-QR Campaigns", True, 
                                f"Found {len(five_qr_campaigns)} campaigns with exactly 5 QR codes")
                    success_count += 1
                    
                    # Print details of campaigns with 5 QR codes
                    for i, campaign in enumerate(five_qr_campaigns):
                        print(f"   Campaign {i+1}: '{campaign['name']}' - {campaign['count']} QR codes")
                        
                        # Check creation dates to find the one from 28/10/2025
                        for qr in campaign['qr_codes']:
                            created_at = qr.get('created_at', '')
                            print(f"     QR ID: {qr.get('id', 'Unknown')}, Created: {created_at}")
                            
                            # Look for dates around 28/10/2025 (could be different format)
                            if '2025-10-28' in str(created_at) or '28/10/2025' in str(created_at):
                                problematic_campaign = campaign
                                print(f"     *** FOUND PROBLEMATIC CAMPAIGN: {campaign['name']} ***")
                    
                    # If no exact date match, use the first 5-QR campaign for testing
                    if not problematic_campaign and five_qr_campaigns:
                        problematic_campaign = five_qr_campaigns[0]
                        print(f"   Using first 5-QR campaign for testing: {problematic_campaign['name']}")
                else:
                    self.log_test("Campaign Investigation - Find 5-QR Campaigns", False, 
                                "No campaigns found with exactly 5 QR codes")
                
            except json.JSONDecodeError:
                self.log_test("Campaign Investigation - List Campaigns", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Campaign Investigation - List Campaigns", False, error_msg)
        
        # Step 2: Get campaign details and check scan counts
        if problematic_campaign:
            print(f"\n--- Step 2: Investigating campaign '{problematic_campaign['name']}' ---")
            
            campaign_name = problematic_campaign['name']
            qr_codes = problematic_campaign['qr_codes']
            
            # Check scan counts for each QR code
            total_scans = 0
            for qr in qr_codes:
                scan_count = qr.get('total_scans', 0)
                total_scans += scan_count
                print(f"   QR Code {qr.get('id', 'Unknown')}: {scan_count} scans")
            
            if total_scans == 0:
                self.log_test("Campaign Investigation - Zero Scans Confirmed", True, 
                            f"Campaign '{campaign_name}' has 0 total scans (matches screenshot)")
                success_count += 1
            else:
                self.log_test("Campaign Investigation - Zero Scans Confirmed", False, 
                            f"Campaign '{campaign_name}' has {total_scans} total scans (doesn't match screenshot)")
            
            # Check if any QR codes are published
            published_qrs = [qr for qr in qr_codes if qr.get('is_published', False)]
            if published_qrs:
                self.log_test("Campaign Investigation - Published QR Check", True, 
                            f"Campaign has {len(published_qrs)} published QR codes (may require force=true)")
                success_count += 1
            else:
                self.log_test("Campaign Investigation - Published QR Check", True, 
                            f"Campaign has no published QR codes (should delete without force)")
                success_count += 1
        
        # Step 3: Try to delete the problematic campaign
        if problematic_campaign:
            print(f"\n--- Step 3: Attempting to delete campaign '{problematic_campaign['name']}' ---")
            
            campaign_name = problematic_campaign['name']
            
            # First try without force flag
            print("   Trying deletion without force flag...")
            response = self.make_request("DELETE", f"/qr-codes/campaigns/{campaign_name}")
            
            if response:
                if response.status_code == 200:
                    try:
                        result = response.json()
                        self.log_test("Campaign Deletion - Without Force", True, 
                                    f"Campaign deleted successfully: {result.get('message', 'No message')}")
                        success_count += 1
                    except json.JSONDecodeError:
                        self.log_test("Campaign Deletion - Without Force", False, 
                                    "Invalid JSON response", response.text)
                elif response.status_code == 400:
                    try:
                        error_data = response.json()
                        error_detail = error_data.get('detail', 'Unknown error')
                        self.log_test("Campaign Deletion - Without Force", True, 
                                    f"Correctly rejected deletion (400): {error_detail}")
                        success_count += 1
                        
                        # Now try with force=true
                        print("   Trying deletion with force=true...")
                        response = self.make_request("DELETE", f"/qr-codes/campaigns/{campaign_name}?force=true")
                        
                        if response and response.status_code == 200:
                            try:
                                result = response.json()
                                self.log_test("Campaign Deletion - With Force", True, 
                                            f"Campaign deleted with force: {result.get('message', 'No message')}")
                                success_count += 1
                            except json.JSONDecodeError:
                                self.log_test("Campaign Deletion - With Force", False, 
                                            "Invalid JSON response", response.text)
                        else:
                            error_msg = "Network error" if not response else f"Status {response.status_code}"
                            self.log_test("Campaign Deletion - With Force", False, 
                                        f"Force deletion failed: {error_msg}")
                    except json.JSONDecodeError:
                        self.log_test("Campaign Deletion - Without Force", False, 
                                    "Invalid JSON error response", response.text)
                else:
                    self.log_test("Campaign Deletion - Without Force", False, 
                                f"Unexpected status code: {response.status_code}", response.text)
            else:
                self.log_test("Campaign Deletion - Without Force", False, "Network error")
        
        return success_count >= 3
    
    def investigate_scan_data_issue(self):
        """
        ISSUE 2: Scan Data Not Showing (0 Total Scans)
        Investigation Steps:
        1. Check the qr_scans collection in MongoDB - verify if scan records exist
        2. For QR codes in the problematic campaign, check if scan_count field is being incremented
        3. Test creating a new QR code and scanning it - verify scan is recorded
        4. Check if there's a mismatch between qr_code_id in qr_codes vs qr_scans collections
        5. Verify the scan recording logic is working correctly
        6. Check if analytics aggregation is failing
        """
        print("\n=== INVESTIGATING SCAN DATA ISSUE ===")
        
        success_count = 0
        
        # Step 1: Check existing QR codes and their scan counts
        print("\n--- Step 1: Checking existing QR codes and scan counts ---")
        response = self.make_request("GET", "/qr-codes")
        
        if response and response.status_code == 200:
            try:
                response_data = response.json()
                qr_codes = response_data.get('qr_codes', [])
                
                total_qr_codes = len(qr_codes)
                qr_codes_with_scans = [qr for qr in qr_codes if qr.get('total_scans', 0) > 0]
                qr_codes_zero_scans = [qr for qr in qr_codes if qr.get('total_scans', 0) == 0]
                
                self.log_test("Scan Investigation - QR Code Scan Counts", True, 
                            f"Total QR codes: {total_qr_codes}, With scans: {len(qr_codes_with_scans)}, Zero scans: {len(qr_codes_zero_scans)}")
                success_count += 1
                
                # Test a QR code with zero scans to see if scanning works
                if qr_codes_zero_scans:
                    test_qr = qr_codes_zero_scans[0]
                    qr_id = test_qr.get('id')
                    short_code = test_qr.get('unique_short_code')
                    
                    if short_code:
                        print(f"   Testing QR code: {qr_id} with short_code: {short_code}")
                        
                        # Step 2: Test scanning the QR code
                        print(f"\n--- Step 2: Testing scan functionality for QR {short_code} ---")
                        
                        # Simulate a scan by calling the scan endpoint
                        scan_response = self.make_request("GET", f"/qr-codes/scan/{short_code}", use_auth=False)
                        
                        if scan_response:
                            if scan_response.status_code == 302:
                                # Redirect response is expected for working QR codes
                                redirect_url = scan_response.headers.get('Location', 'No location header')
                                self.log_test("Scan Investigation - QR Scan Redirect", True, 
                                            f"QR scan works correctly (302 redirect to: {redirect_url})")
                                success_count += 1
                                
                                # Check if scan was recorded by getting updated QR code data
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
                                                self.log_test("Scan Investigation - Scan Count Increment", True, 
                                                            f"Scan count incremented from {old_scan_count} to {new_scan_count}")
                                                success_count += 1
                                            else:
                                                self.log_test("Scan Investigation - Scan Count Increment", False, 
                                                            f"Scan count not incremented (still {new_scan_count})")
                                        else:
                                            self.log_test("Scan Investigation - Scan Count Increment", False, 
                                                        "Could not find updated QR code data")
                                    except json.JSONDecodeError:
                                        self.log_test("Scan Investigation - Scan Count Increment", False, 
                                                    "Invalid JSON response for updated data")
                            elif scan_response.status_code == 404:
                                self.log_test("Scan Investigation - QR Scan Redirect", False, 
                                            f"QR code not found (404) - this matches the production issue!")
                                # This confirms the production issue
                                success_count += 1
                            else:
                                self.log_test("Scan Investigation - QR Scan Redirect", False, 
                                            f"Unexpected scan response: {scan_response.status_code}")
                        else:
                            self.log_test("Scan Investigation - QR Scan Redirect", False, "Network error during scan test")
                    else:
                        self.log_test("Scan Investigation - QR Code Selection", False, 
                                    "Test QR code missing short_code field")
                else:
                    self.log_test("Scan Investigation - QR Code Selection", False, 
                                "No QR codes with zero scans found for testing")
                
            except json.JSONDecodeError:
                self.log_test("Scan Investigation - QR Code Scan Counts", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Scan Investigation - QR Code Scan Counts", False, error_msg)
        
        # Step 3: Test QR code analytics endpoints
        print("\n--- Step 3: Testing QR code analytics endpoints ---")
        
        # Test campaign analytics
        response = self.make_request("GET", "/qr-codes/analytics/campaigns")
        
        if response and response.status_code == 200:
            try:
                analytics = response.json()
                self.log_test("Scan Investigation - Campaign Analytics", True, 
                            f"Campaign analytics endpoint working: {len(analytics)} campaigns")
                success_count += 1
                
                # Check if any campaigns show scan data
                campaigns_with_scans = [c for c in analytics if c.get('total_scans', 0) > 0]
                if campaigns_with_scans:
                    self.log_test("Scan Investigation - Analytics Scan Data", True, 
                                f"{len(campaigns_with_scans)} campaigns show scan data in analytics")
                    success_count += 1
                else:
                    self.log_test("Scan Investigation - Analytics Scan Data", False, 
                                "No campaigns show scan data in analytics (confirms the issue)")
                
            except json.JSONDecodeError:
                self.log_test("Scan Investigation - Campaign Analytics", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Scan Investigation - Campaign Analytics", False, error_msg)
        
        # Step 4: Create a new QR code and test scanning
        print("\n--- Step 4: Creating new QR code to test scan recording ---")
        
        test_qr_data = {
            "campaign_name": f"TEST_SCAN_INVESTIGATION_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "qr_type": "single_url",
            "landing_page_url": "https://nuraemobility.co.in",
            "utm_source": "test",
            "utm_medium": "qr_code",
            "utm_campaign": "scan_investigation"
        }
        
        response = self.make_request("POST", "/qr-codes/create", test_qr_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                new_qr_id = result.get('qr_code', {}).get('id')
                new_short_code = result.get('qr_code', {}).get('unique_short_code')
                
                if new_qr_id and new_short_code:
                    self.log_test("Scan Investigation - Create Test QR", True, 
                                f"Created test QR code: {new_qr_id} with short_code: {new_short_code}")
                    success_count += 1
                    
                    # Test scanning the new QR code
                    print(f"   Testing scan of new QR code: {new_short_code}")
                    scan_response = self.make_request("GET", f"/qr-codes/scan/{new_short_code}", use_auth=False)
                    
                    if scan_response and scan_response.status_code == 302:
                        self.log_test("Scan Investigation - New QR Scan Test", True, 
                                    "New QR code scan works correctly (302 redirect)")
                        success_count += 1
                        
                        # Check if scan was recorded
                        import time
                        time.sleep(2)  # Wait for scan to be processed
                        
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
                                                    "Scan not recorded (scan_count still 0)")
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
                    self.log_test("Scan Investigation - Create Test QR", False, 
                                "Created QR missing ID or short_code", result)
            except json.JSONDecodeError:
                self.log_test("Scan Investigation - Create Test QR", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Scan Investigation - Create Test QR", False, error_msg)
        
        return success_count >= 4
    
    def run_production_investigation(self):
        """Run the complete production issue investigation"""
        print("🚨 URGENT PRODUCTION ISSUE INVESTIGATION 🚨")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed with investigation")
            return False
        
        # Investigate both issues
        issue1_success = self.investigate_campaign_deletion_issue()
        issue2_success = self.investigate_scan_data_issue()
        
        # Summary
        print("\n" + "=" * 60)
        print("🔍 PRODUCTION INVESTIGATION SUMMARY")
        print("=" * 60)
        
        passed_tests = sum(1 for result in self.test_results if result['success'])
        total_tests = len(self.test_results)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print("\n📋 DETAILED FINDINGS:")
        
        # Group results by issue
        campaign_tests = [r for r in self.test_results if 'Campaign' in r['test']]
        scan_tests = [r for r in self.test_results if 'Scan' in r['test']]
        
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
        
        return passed_tests >= (total_tests * 0.7)  # 70% success rate

if __name__ == "__main__":
    tester = ProductionIssueTester()
    success = tester.run_production_investigation()
    
    if success:
        print("\n✅ Production investigation completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Production investigation found critical issues")
        sys.exit(1)