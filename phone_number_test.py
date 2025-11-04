#!/usr/bin/env python3
"""
Critical Phone Number Processing Fix Test
Tests the Driver Onboarding bulk import endpoint phone number processing logic
"""

import requests
import json
import sys
import io
import pandas as pd
from datetime import datetime

# Configuration
BASE_URL = "https://qr-campaign-fix.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class PhoneNumberProcessingTester:
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
    
    def authenticate(self):
        """Authenticate and get token"""
        print("=== Authenticating ===")
        
        login_data = {
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
            
            if response.status_code == 200:
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
            else:
                self.log_test("Authentication", False, 
                            f"Login failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Authentication", False, f"Network error: {e}")
            return False
    
    def create_test_csv(self, test_cases):
        """Create CSV content with test phone numbers"""
        csv_content = "Name,Phone Number,Status\n"
        for i, phone in enumerate(test_cases, 1):
            csv_content += f"Test User {i},{phone},New\n"
        return csv_content
    
    def import_leads_and_check_phones(self, test_name, test_cases, expected_results):
        """Import leads and verify phone number processing"""
        print(f"\n--- {test_name} ---")
        
        # Create CSV content
        csv_content = self.create_test_csv(test_cases)
        print(f"CSV Content:\n{csv_content}")
        
        # Import leads
        files = {'file': (f'{test_name.lower().replace(" ", "_")}.csv', csv_content, 'text/csv')}
        form_data = {
            'lead_source': f'Phone Test - {test_name}',
            'lead_date': '2024-12-15'
        }
        
        try:
            url = f"{self.base_url}/driver-onboarding/import-leads"
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(url, headers=headers, files=files, data=form_data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"Import response: {result}")
                if result.get("success"):
                    imported_count = result.get("imported_count", 0)
                    duplicate_count = result.get("duplicate_count", 0)
                    print(f"Import successful: {imported_count} leads imported, {duplicate_count} duplicates skipped")
                    
                    # Now fetch the imported leads to verify phone numbers
                    leads_response = requests.get(f"{self.base_url}/driver-onboarding/leads", 
                                                headers=headers, timeout=10)
                    
                    print(f"Leads API response status: {leads_response.status_code}")
                    if leads_response.status_code != 200:
                        print(f"Leads API error: {leads_response.text}")
                        return False
                    
                    if leads_response.status_code == 200:
                        response_data = leads_response.json()
                        
                        # Extract leads from the response structure
                        if isinstance(response_data, dict) and "leads" in response_data:
                            all_leads = response_data["leads"]
                        else:
                            print(f"Unexpected leads response structure: {response_data}")
                            return False
                        
                        # Find our test leads by source
                        test_leads = [lead for lead in all_leads 
                                    if isinstance(lead, dict) and lead.get("source") == f'Phone Test - {test_name}']
                        
                        print(f"Found {len(test_leads)} test leads")
                        
                        # Verify phone numbers
                        success_count = 0
                        for i, lead in enumerate(test_leads):
                            if i < len(expected_results):
                                actual_phone = lead.get("phone_number", "")
                                expected_phone = expected_results[i]
                                
                                if actual_phone == expected_phone:
                                    print(f"  ✅ Lead {i+1}: {test_cases[i]} → {actual_phone} (Expected: {expected_phone})")
                                    success_count += 1
                                else:
                                    print(f"  ❌ Lead {i+1}: {test_cases[i]} → {actual_phone} (Expected: {expected_phone})")
                        
                        # Clean up test leads
                        self.cleanup_test_leads(test_leads)
                        
                        if success_count == len(expected_results):
                            self.log_test(test_name, True, 
                                        f"All {success_count}/{len(expected_results)} phone numbers processed correctly")
                            return True
                        else:
                            self.log_test(test_name, False, 
                                        f"Only {success_count}/{len(expected_results)} phone numbers processed correctly")
                            return False
                    else:
                        self.log_test(test_name, False, 
                                    f"Failed to fetch leads: {leads_response.status_code}")
                        return False
                else:
                    self.log_test(test_name, False, 
                                f"Import failed: {result.get('message', 'Unknown error')}")
                    return False
            else:
                self.log_test(test_name, False, 
                            f"Import failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test(test_name, False, f"Exception during import: {e}")
            return False
    
    def cleanup_test_leads(self, test_leads):
        """Clean up test leads from database"""
        try:
            # Note: In a real scenario, we'd need a delete endpoint
            # For now, we'll just log that cleanup is needed
            print(f"  🧹 Cleanup: {len(test_leads)} test leads need to be removed")
        except Exception as e:
            print(f"  ⚠️ Cleanup failed: {e}")
    
    def test_phone_number_processing_fix(self):
        """Test all 5 critical phone number processing scenarios"""
        print("\n=== Testing Phone Number Processing Fix ===")
        
        if not self.authenticate():
            return False
        
        all_tests_passed = True
        
        # Test Case 1: 10-digit number starting with 91 (should be preserved)
        test_cases_1 = ["9178822331"]
        expected_1 = ["9178822331"]  # Should NOT become 78822331
        result_1 = self.import_leads_and_check_phones(
            "Test Case 1 - 10-digit starting with 91", 
            test_cases_1, expected_1
        )
        all_tests_passed = all_tests_passed and result_1
        
        # Test Case 2: +91 prefix removal
        test_cases_2 = ["+919897721333"]
        expected_2 = ["9897721333"]  # Should remove +91 prefix
        result_2 = self.import_leads_and_check_phones(
            "Test Case 2 - +91 prefix removal", 
            test_cases_2, expected_2
        )
        all_tests_passed = all_tests_passed and result_2
        
        # Test Case 3: 91 prefix removal (without +)
        test_cases_3 = ["919897721333"]
        expected_3 = ["9897721333"]  # Should remove 91 prefix
        result_3 = self.import_leads_and_check_phones(
            "Test Case 3 - 91 prefix removal", 
            test_cases_3, expected_3
        )
        all_tests_passed = all_tests_passed and result_3
        
        # Test Case 4: Float with .0 (pandas issue)
        # Note: We can't directly test float input via CSV, but we can test the string representation
        test_cases_4 = ["9897721333.0"]
        expected_4 = ["9897721333"]  # Should NOT become 98977213330
        result_4 = self.import_leads_and_check_phones(
            "Test Case 4 - Float with .0", 
            test_cases_4, expected_4
        )
        all_tests_passed = all_tests_passed and result_4
        
        # Test Case 5: 10-digit starting with 91 as float
        test_cases_5 = ["9178822331.0"]
        expected_5 = ["9178822331"]  # Should NOT become 78822331 or 178822331
        result_5 = self.import_leads_and_check_phones(
            "Test Case 5 - 10-digit starting with 91 as float", 
            test_cases_5, expected_5
        )
        all_tests_passed = all_tests_passed and result_5
        
        # Comprehensive test with all cases together
        all_test_cases = [
            "9178822331",      # 10-digit starting with 91
            "+919897721333",   # +91 prefix
            "919897721333",    # 91 prefix
            "9897721333.0",    # Float with .0
            "9178822331.0"     # 10-digit starting with 91 as float
        ]
        all_expected = [
            "9178822331",      # Should be preserved
            "9897721333",      # Should remove +91
            "9897721333",      # Should remove 91
            "9897721333",      # Should remove .0
            "9178822331"       # Should be preserved and remove .0
        ]
        
        result_comprehensive = self.import_leads_and_check_phones(
            "Comprehensive Test - All Cases", 
            all_test_cases, all_expected
        )
        all_tests_passed = all_tests_passed and result_comprehensive
        
        return all_tests_passed
    
    def test_work_india_source_scenario(self):
        """Test specific Work India source scenario mentioned in review"""
        print("\n=== Testing Work India Source Scenario ===")
        
        # Simulate Work India data with various phone formats
        work_india_cases = [
            "9178822331",      # 10-digit starting with 91 (critical case)
            "9897721333.0",    # Float issue from pandas
            "+919876543210",   # +91 prefix
            "919123456789",    # 91 prefix
            "8765432109"       # Normal 10-digit
        ]
        
        work_india_expected = [
            "9178822331",      # Should be preserved
            "9897721333",      # Should remove .0
            "9876543210",      # Should remove +91
            "9123456789",      # Should remove 91
            "8765432109"       # Should remain same
        ]
        
        result = self.import_leads_and_check_phones(
            "Work India Source Test", 
            work_india_cases, work_india_expected
        )
        
        return result
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("PHONE NUMBER PROCESSING FIX TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        print("\n" + "="*60)
        
        return passed_tests == total_tests

def main():
    """Main test execution"""
    tester = PhoneNumberProcessingTester()
    
    print("CRITICAL PHONE NUMBER PROCESSING FIX TEST")
    print("Testing Driver Onboarding bulk import endpoint")
    print("="*60)
    
    # Run phone number processing tests
    phone_test_passed = tester.test_phone_number_processing_fix()
    
    # Run Work India specific scenario
    work_india_passed = tester.test_work_india_source_scenario()
    
    # Print summary
    all_passed = tester.print_summary()
    
    if all_passed:
        print("🎉 ALL TESTS PASSED - Phone number processing fix is working correctly!")
        sys.exit(0)
    else:
        print("💥 SOME TESTS FAILED - Phone number processing fix needs attention!")
        sys.exit(1)

if __name__ == "__main__":
    main()