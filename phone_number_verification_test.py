#!/usr/bin/env python3
"""
Phone Number Processing Verification Test
Verifies the phone number processing logic by analyzing import responses
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://leadonboard.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class PhoneNumberVerificationTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_results = []
        
    def log_test(self, test_name, success, message):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
    
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
                    self.log_test("Authentication", False, "No token in response")
                    return False
            else:
                self.log_test("Authentication", False, 
                            f"Login failed with status {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Authentication", False, f"Network error: {e}")
            return False
    
    def test_phone_processing_via_duplicates(self, test_name, input_phone, expected_phone):
        """Test phone processing by checking duplicate detection response"""
        print(f"\n--- {test_name} ---")
        print(f"Input: {input_phone} → Expected: {expected_phone}")
        
        # Create CSV with the test phone number
        timestamp = datetime.now().strftime('%H%M%S%f')
        csv_content = f"Name,Phone Number,Status\nTestUser_{timestamp},{input_phone},New\n"
        
        files = {'file': (f'test_{timestamp}.csv', csv_content, 'text/csv')}
        form_data = {
            'lead_source': f'Phone Processing Test {timestamp}',
            'lead_date': '2024-12-15'
        }
        
        try:
            url = f"{self.base_url}/driver-onboarding/import-leads"
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(url, headers=headers, files=files, data=form_data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                
                # Check if it was imported or detected as duplicate
                if result.get("success"):
                    imported_count = result.get("imported_count", 0)
                    duplicate_count = result.get("duplicate_count", 0)
                    
                    if imported_count > 0:
                        # Phone was processed and imported (new unique number)
                        self.log_test(test_name, True, 
                                    f"Phone number processed and imported successfully")
                        return True
                    elif duplicate_count > 0 and "duplicates" in result:
                        # Phone was processed and detected as duplicate
                        duplicates = result["duplicates"]
                        if len(duplicates) > 0:
                            processed_phone = duplicates[0].get("phone_number", "")
                            normalized_phone = duplicates[0].get("normalized_phone", "")
                            
                            print(f"  Processed phone: {processed_phone}")
                            print(f"  Normalized phone: {normalized_phone}")
                            
                            if processed_phone == expected_phone:
                                self.log_test(test_name, True, 
                                            f"Phone correctly processed: {input_phone} → {processed_phone}")
                                return True
                            else:
                                self.log_test(test_name, False, 
                                            f"Phone incorrectly processed: {input_phone} → {processed_phone} (expected: {expected_phone})")
                                return False
                        else:
                            self.log_test(test_name, False, "No duplicate details in response")
                            return False
                    else:
                        self.log_test(test_name, False, 
                                    f"Unexpected result: {imported_count} imported, {duplicate_count} duplicates")
                        return False
                else:
                    self.log_test(test_name, False, 
                                f"Import failed: {result.get('message', 'Unknown error')}")
                    return False
            else:
                self.log_test(test_name, False, 
                            f"Import failed with status {response.status_code}")
                return False
        except Exception as e:
            self.log_test(test_name, False, f"Exception during import: {e}")
            return False
    
    def run_all_tests(self):
        """Run all phone number processing tests"""
        print("\n=== Testing Phone Number Processing Fix ===")
        
        if not self.authenticate():
            return False
        
        all_tests_passed = True
        
        # Test Case 1: 10-digit number starting with 91 (should be preserved)
        result_1 = self.test_phone_processing_via_duplicates(
            "Test Case 1 - 10-digit starting with 91", 
            "9178822331", "9178822331"
        )
        all_tests_passed = all_tests_passed and result_1
        
        # Test Case 2: +91 prefix removal
        result_2 = self.test_phone_processing_via_duplicates(
            "Test Case 2 - +91 prefix removal", 
            "+919897721333", "9897721333"
        )
        all_tests_passed = all_tests_passed and result_2
        
        # Test Case 3: 91 prefix removal (without +)
        result_3 = self.test_phone_processing_via_duplicates(
            "Test Case 3 - 91 prefix removal", 
            "919897721333", "9897721333"
        )
        all_tests_passed = all_tests_passed and result_3
        
        # Test Case 4: Float with .0 (pandas issue)
        result_4 = self.test_phone_processing_via_duplicates(
            "Test Case 4 - Float with .0", 
            "9897721333.0", "9897721333"
        )
        all_tests_passed = all_tests_passed and result_4
        
        # Test Case 5: 10-digit starting with 91 as float
        result_5 = self.test_phone_processing_via_duplicates(
            "Test Case 5 - 10-digit starting with 91 as float", 
            "9178822331.0", "9178822331"
        )
        all_tests_passed = all_tests_passed and result_5
        
        return all_tests_passed
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("PHONE NUMBER PROCESSING VERIFICATION SUMMARY")
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
    tester = PhoneNumberVerificationTester()
    
    print("PHONE NUMBER PROCESSING VERIFICATION TEST")
    print("Testing Driver Onboarding bulk import phone number processing")
    print("="*60)
    
    # Run all tests
    all_passed = tester.run_all_tests()
    
    # Print summary
    success = tester.print_summary()
    
    if success:
        print("🎉 ALL TESTS PASSED - Phone number processing fix is working correctly!")
        sys.exit(0)
    else:
        print("💥 SOME TESTS FAILED - Phone number processing fix needs attention!")
        sys.exit(1)

if __name__ == "__main__":
    main()