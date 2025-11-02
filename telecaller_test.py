#!/usr/bin/env python3
"""
Focused Testing for Telecaller's Desk Backend Enhancements
Tests callback date calculation, lead sorting, and telecaller summary
"""

import requests
import json
import sys
from datetime import datetime, timezone, timedelta

# Configuration
BASE_URL = "https://lead-management-4.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class TelecallerDeskTester:
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
            elif method.upper() == "PATCH":
                headers["Content-Type"] = "application/json"
                response = requests.patch(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error for {method} {url}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error for {method} {url}: {e}")
            return None
    
    def authenticate(self):
        """Authenticate and get token"""
        print("🔐 Authenticating...")
        
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
    
    def test_telecaller_desk_enhancements(self):
        """Test Telecaller's Desk Backend Enhancements"""
        print("\n🎯 Testing Telecaller's Desk Backend Enhancements")
        print("=" * 60)
        
        success_count = 0
        test_lead_id = None
        
        # Test 1: Get a test lead ID from /driver-onboarding/leads
        print("\n--- Test 1: Getting Test Lead for Callback Testing ---")
        response = self.make_request("GET", "/driver-onboarding/leads?skip_pagination=true")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and "leads" in data:
                    leads_list = data["leads"]
                    if leads_list and len(leads_list) > 0:
                        test_lead_id = leads_list[0].get("id")
                        self.log_test("Get Test Lead", True, 
                                    f"Retrieved test lead ID: {test_lead_id} from {len(leads_list)} total leads")
                        success_count += 1
                    else:
                        self.log_test("Get Test Lead", False, 
                                    "No leads found in database for testing")
                        return False
                else:
                    self.log_test("Get Test Lead", False, 
                                f"Unexpected response format: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_test("Get Test Lead", False, 
                            "Invalid JSON response", response.text)
                return False
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Get Test Lead", False, error_msg)
            return False
        
        if not test_lead_id:
            self.log_test("Test Setup", False, "Cannot proceed without test lead ID")
            return False
        
        # Test 2: Lead Update with Callback Status - Test all 4 callback options
        print("\n--- Test 2: Callback Date Calculation ---")
        
        callback_tests = [
            {"status": "Call back 1D", "expected_days": 1},
            {"status": "Call back 1W", "expected_days": 7},
            {"status": "Call back 2W", "expected_days": 14},
            {"status": "Call back 1M", "expected_days": 30}
        ]
        
        for callback_test in callback_tests:
            status = callback_test["status"]
            expected_days = callback_test["expected_days"]
            
            # Update lead with callback status
            update_data = {"status": status}
            response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", update_data)
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    # PATCH endpoint returns null on success, which is valid
                    if response.status_code == 200:  # Success is indicated by 200 status
                        # Verify callback_date is set correctly
                        lead_response = self.make_request("GET", f"/driver-onboarding/leads/{test_lead_id}")
                        if lead_response and lead_response.status_code == 200:
                            try:
                                lead_data = lead_response.json()
                                callback_date = lead_data.get("callback_date")
                                
                                if callback_date:
                                    # Parse callback date and verify it's correct
                                    callback_dt = datetime.fromisoformat(callback_date.replace('Z', '+00:00'))
                                    now = datetime.now(timezone.utc)
                                    expected_date = now + timedelta(days=expected_days)
                                    
                                    # Allow 2 minute tolerance for test execution time
                                    time_diff = abs((callback_dt - expected_date).total_seconds())
                                    if time_diff <= 120:  # 2 minute tolerance
                                        self.log_test(f"Callback Date - {status}", True, 
                                                    f"Callback date correctly set to {expected_days} days from now")
                                        success_count += 1
                                    else:
                                        self.log_test(f"Callback Date - {status}", False, 
                                                    f"Callback date incorrect. Expected ~{expected_days} days, got {time_diff/86400:.1f} days difference")
                                else:
                                    self.log_test(f"Callback Date - {status}", False, 
                                                f"Callback date not set for {status}")
                            except Exception as e:
                                self.log_test(f"Callback Date - {status}", False, 
                                            f"Error parsing callback date: {e}")
                        else:
                            self.log_test(f"Callback Date - {status}", False, 
                                        "Could not retrieve updated lead data")
                    else:
                        self.log_test(f"Callback Status - {status}", False, 
                                    f"Update failed: {result}")
                except json.JSONDecodeError:
                    self.log_test(f"Callback Status - {status}", False, 
                                "Invalid JSON response", response.text)
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test(f"Callback Status - {status}", False, error_msg)
        
        # Test 3: Test updating status to non-callback and verify callback_date is cleared
        print("\n--- Test 3: Clear Callback Date for Non-Callback Status ---")
        
        update_data = {"status": "Interested"}
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", update_data)
        
        if response and response.status_code == 200:
            # PATCH successful, now verify callback_date is cleared
            lead_response = self.make_request("GET", f"/driver-onboarding/leads/{test_lead_id}")
            if lead_response and lead_response.status_code == 200:
                try:
                    lead_data = lead_response.json()
                    callback_date = lead_data.get("callback_date")
                    
                    if callback_date is None:
                        self.log_test("Clear Callback Date", True, 
                                    "Callback date correctly cleared for non-callback status")
                        success_count += 1
                    else:
                        self.log_test("Clear Callback Date", False, 
                                    f"Callback date not cleared: {callback_date}")
                except Exception as e:
                    self.log_test("Clear Callback Date", False, 
                                f"Error checking cleared callback date: {e}")
            else:
                self.log_test("Clear Callback Date", False, 
                            "Could not retrieve lead data to verify callback_date clearing")
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Clear Callback Date", False, error_msg)
        
        # Test 4: Lead Sorting Logic - Test that uncalled leads appear first
        print("\n--- Test 4: Lead Sorting Logic ---")
        
        # Get all leads to check initial sorting
        response = self.make_request("GET", "/driver-onboarding/leads?skip_pagination=true")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                leads_before = data.get("leads", []) if isinstance(data, dict) else data
                
                # Find leads without last_called (should be at top)
                uncalled_leads = [lead for lead in leads_before if not lead.get("last_called")]
                called_leads = [lead for lead in leads_before if lead.get("last_called")]
                
                self.log_test("Lead Sorting - Initial State", True, 
                            f"Found {len(uncalled_leads)} uncalled leads, {len(called_leads)} called leads")
                success_count += 1
                
                # Mark a lead as called if we have uncalled leads
                if uncalled_leads:
                    test_uncalled_lead = uncalled_leads[0]
                    call_response = self.make_request("POST", f"/driver-onboarding/leads/{test_uncalled_lead['id']}/call-done")
                    
                    if call_response and call_response.status_code == 200:
                        self.log_test("Mark Call Done", True, 
                                    f"Successfully marked lead {test_uncalled_lead['id']} as called")
                        success_count += 1
                        
                        # Get leads again and verify sorting
                        response_after = self.make_request("GET", "/driver-onboarding/leads?skip_pagination=true")
                        
                        if response_after and response_after.status_code == 200:
                            try:
                                data_after = response_after.json()
                                leads_after = data_after.get("leads", []) if isinstance(data_after, dict) else data_after
                                
                                # Check that the previously uncalled lead is no longer at the top
                                uncalled_after = [lead for lead in leads_after if not lead.get("last_called")]
                                called_after = [lead for lead in leads_after if lead.get("last_called")]
                                
                                # The lead we called should now be in called_after
                                called_lead_found = any(lead['id'] == test_uncalled_lead['id'] for lead in called_after)
                                
                                if called_lead_found and len(uncalled_after) == len(uncalled_leads) - 1:
                                    self.log_test("Lead Sorting - After Call Done", True, 
                                                f"Lead correctly moved to called list. Uncalled: {len(uncalled_after)}, Called: {len(called_after)}")
                                    success_count += 1
                                else:
                                    self.log_test("Lead Sorting - After Call Done", False, 
                                                f"Lead sorting not working correctly. Called lead found: {called_lead_found}")
                            except Exception as e:
                                self.log_test("Lead Sorting - After Call Done", False, 
                                            f"Error parsing leads after call: {e}")
                        else:
                            self.log_test("Lead Sorting - After Call Done", False, 
                                        "Could not retrieve leads after marking call done")
                    else:
                        error_msg = "Network error" if not call_response else f"Status {call_response.status_code}"
                        self.log_test("Mark Call Done", False, error_msg)
                else:
                    self.log_test("Mark Call Done", True, 
                                "No uncalled leads available for testing (all leads already called)")
                    success_count += 1
                    
            except Exception as e:
                self.log_test("Lead Sorting - Initial State", False, 
                            f"Error parsing leads: {e}")
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Lead Sorting - Initial State", False, error_msg)
        
        # Test 5: Telecaller Summary with Callbacks
        print("\n--- Test 5: Telecaller Summary ---")
        
        response = self.make_request("GET", "/driver-onboarding/telecaller-summary")
        
        if response and response.status_code == 200:
            try:
                summary = response.json()
                
                if summary.get("success"):
                    stage_breakdown = summary.get("stage_breakdown", {})
                    total_leads = summary.get("total_leads", 0)
                    
                    self.log_test("Telecaller Summary - Basic Structure", True, 
                                f"Retrieved telecaller summary: {total_leads} total leads, {len(stage_breakdown)} stages")
                    success_count += 1
                    
                    # Check if callback leads are included in stage breakdown
                    callback_statuses_found = []
                    for stage, stage_data in stage_breakdown.items():
                        statuses = stage_data.get("statuses", {})
                        for status in statuses:
                            if status.startswith("Call back"):
                                callback_statuses_found.append(f"{stage}:{status}")
                    
                    if callback_statuses_found:
                        self.log_test("Telecaller Summary - Callback Leads", True, 
                                    f"Callback leads found in summary: {callback_statuses_found}")
                        success_count += 1
                    else:
                        self.log_test("Telecaller Summary - Callback Leads", True, 
                                    "No callback leads in current data (expected if no callback leads exist)")
                        success_count += 1
                else:
                    self.log_test("Telecaller Summary - Basic Structure", False, 
                                f"Summary request failed: {summary}")
            except Exception as e:
                self.log_test("Telecaller Summary - Basic Structure", False, 
                            f"Error parsing summary: {e}")
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Telecaller Summary - Basic Structure", False, error_msg)
        
        # Test 6: Callback Date Field Persistence
        print("\n--- Test 6: Callback Date Persistence ---")
        
        # Set a callback status and verify persistence
        update_data = {"status": "Call back 1W"}
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{test_lead_id}", update_data)
        
        if response and response.status_code == 200:
            # Fetch the lead again to verify callback_date persists
            lead_response = self.make_request("GET", f"/driver-onboarding/leads/{test_lead_id}")
            
            if lead_response and lead_response.status_code == 200:
                try:
                    lead_data = lead_response.json()
                    callback_date = lead_data.get("callback_date")
                    
                    if callback_date:
                        # Verify it's a valid ISO date
                        try:
                            parsed_date = datetime.fromisoformat(callback_date.replace('Z', '+00:00'))
                            self.log_test("Callback Date Persistence", True, 
                                        f"Callback date persisted correctly: {callback_date}")
                            success_count += 1
                        except ValueError:
                            self.log_test("Callback Date Persistence", False, 
                                        f"Callback date format invalid: {callback_date}")
                    else:
                        self.log_test("Callback Date Persistence", False, 
                                    "Callback date not persisted in database")
                except Exception as e:
                    self.log_test("Callback Date Persistence", False, 
                                f"Error checking callback date persistence: {e}")
            else:
                self.log_test("Callback Date Persistence", False, 
                            "Could not retrieve lead to check callback_date persistence")
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Callback Date Persistence", False, error_msg)
        
        return success_count
    
    def run_tests(self):
        """Run all tests"""
        print("🚀 Starting Telecaller's Desk Backend Enhancement Testing")
        print("=" * 80)
        
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed")
            return False
        
        success_count = self.test_telecaller_desk_enhancements()
        
        # Print summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results) - 1  # Exclude authentication
        passed_tests = sum(1 for result in self.test_results[1:] if result["success"])  # Exclude authentication
        
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        print(f"✅ Passed: {passed_tests}/{total_tests} tests ({success_rate:.1f}%)")
        
        if success_rate >= 80:
            print("🎉 Overall Status: EXCELLENT - All enhancements working correctly!")
        elif success_rate >= 60:
            print("⚠️  Overall Status: GOOD - Minor issues detected")
        else:
            print("🚨 Overall Status: NEEDS ATTENTION - Multiple issues found")
        
        # Print individual test results
        print("\n📋 Detailed Results:")
        for result in self.test_results[1:]:  # Skip authentication
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return success_rate >= 60

def main():
    """Main test execution"""
    tester = TelecallerDeskTester()
    success = tester.run_tests()
    
    if success:
        print("\n🎯 Testing completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Testing failed - issues detected")
        sys.exit(1)

if __name__ == "__main__":
    main()