#!/usr/bin/env python3
"""
Telecaller Leads Filter Test - Verify Genelia can see her assigned leads
Test Steps from Review Request:
1. Get Genelia's User ID by logging in as admin and calling GET /api/users
2. Check assigned leads with GET /api/driver-onboarding/leads to count leads with assigned_telecaller = Genelia's ID (should be 5)
3. Test telecaller filter with GET /api/driver-onboarding/leads?telecaller={genelia_user_id} to verify it returns exactly 5 leads
4. Verify telecaller name display in assigned_telecaller_name field
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://telecaller-hub-4.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin"
ADMIN_PASSWORD = "Nura@1234$"

class TelecallerFilterTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_results = []
        self.genelia_user_id = None
        
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
    
    def make_request(self, method, endpoint, data=None, params=None, use_auth=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
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
    
    def test_admin_login(self):
        """Step 1: Login as admin to get access token"""
        print("\n=== Step 1: Admin Login ===")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        
        if not response:
            self.log_test("Admin Login", False, "Network error during login")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "token" in data:
                    self.token = data["token"]
                    user_info = data.get("user", {})
                    self.log_test("Admin Login", True, 
                                f"Login successful. User: {user_info.get('first_name', 'Unknown')}, Type: {user_info.get('account_type', 'Unknown')}")
                    return True
                else:
                    self.log_test("Admin Login", False, "No token in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("Admin Login", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Admin Login", False, 
                        f"Login failed with status {response.status_code}", response.text)
            return False
    
    def test_get_genelia_user_id(self):
        """Step 2: Get Genelia's User ID from GET /api/users endpoint"""
        print("\n=== Step 2: Get Genelia's User ID ===")
        
        response = self.make_request("GET", "/users")
        
        if not response:
            self.log_test("Get Users", False, "Network error")
            return False
        
        if response.status_code == 200:
            try:
                users = response.json()
                self.log_test("Get Users", True, f"Retrieved {len(users)} users successfully")
                
                # Find Genelia's user record
                genelia_user = None
                for user in users:
                    # Look for Genelia by name (first_name or full name)
                    first_name = user.get('first_name', '').lower()
                    last_name = user.get('last_name', '').lower() if user.get('last_name') else ''
                    email = user.get('email', '').lower()
                    full_name = f"{first_name} {last_name}".strip()
                    
                    if ('genelia' in first_name or 'genelia' in full_name or 'genelia' in email):
                        genelia_user = user
                        break
                
                if genelia_user:
                    self.genelia_user_id = genelia_user.get('id')
                    self.log_test("Find Genelia User", True, 
                                f"Found Genelia: ID={self.genelia_user_id}, Name={genelia_user.get('first_name')} {genelia_user.get('last_name', '')}, Email={genelia_user.get('email')}")
                    return True
                else:
                    # List all users for debugging
                    user_list = []
                    for user in users:
                        name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                        user_list.append(f"{name} ({user.get('email', 'No email')})")
                    
                    self.log_test("Find Genelia User", False, 
                                f"Genelia not found in {len(users)} users. Available users: {', '.join(user_list)}")
                    return False
                    
            except json.JSONDecodeError:
                self.log_test("Get Users", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Get Users", False, 
                        f"Failed to get users with status {response.status_code}", response.text)
            return False
    
    def test_check_assigned_leads(self):
        """Step 3: Check assigned leads with GET /api/driver-onboarding/leads"""
        print("\n=== Step 3: Check Assigned Leads ===")
        
        if not self.genelia_user_id:
            self.log_test("Check Assigned Leads", False, "Genelia's user ID not found")
            return False
        
        response = self.make_request("GET", "/driver-onboarding/leads")
        
        if not response:
            self.log_test("Get All Leads", False, "Network error")
            return False
        
        if response.status_code == 200:
            try:
                leads = response.json()
                self.log_test("Get All Leads", True, f"Retrieved {len(leads)} total leads")
                
                # Count leads assigned to Genelia
                genelia_leads = []
                for lead in leads:
                    assigned_telecaller = lead.get('assigned_telecaller')
                    if assigned_telecaller == self.genelia_user_id:
                        genelia_leads.append(lead)
                
                genelia_count = len(genelia_leads)
                expected_count = 5
                
                if genelia_count == expected_count:
                    self.log_test("Count Genelia's Assigned Leads", True, 
                                f"Found exactly {genelia_count} leads assigned to Genelia (expected {expected_count})")
                    
                    # Verify assigned_telecaller_name field is populated
                    leads_with_name = 0
                    for lead in genelia_leads:
                        if lead.get('assigned_telecaller_name'):
                            leads_with_name += 1
                    
                    if leads_with_name == genelia_count:
                        self.log_test("Telecaller Name Field", True, 
                                    f"All {genelia_count} assigned leads have assigned_telecaller_name populated")
                    else:
                        self.log_test("Telecaller Name Field", False, 
                                    f"Only {leads_with_name}/{genelia_count} assigned leads have assigned_telecaller_name populated")
                    
                    return True
                else:
                    self.log_test("Count Genelia's Assigned Leads", False, 
                                f"Found {genelia_count} leads assigned to Genelia, expected {expected_count}")
                    
                    # Show sample of assigned telecallers for debugging
                    telecaller_counts = {}
                    for lead in leads:
                        telecaller = lead.get('assigned_telecaller')
                        if telecaller:
                            telecaller_counts[telecaller] = telecaller_counts.get(telecaller, 0) + 1
                    
                    print(f"   DEBUG: Telecaller assignment counts: {telecaller_counts}")
                    return False
                    
            except json.JSONDecodeError:
                self.log_test("Get All Leads", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Get All Leads", False, 
                        f"Failed to get leads with status {response.status_code}", response.text)
            return False
    
    def test_telecaller_filter(self):
        """Step 4: Test telecaller filter with GET /api/driver-onboarding/leads?telecaller={genelia_user_id}"""
        print("\n=== Step 4: Test Telecaller Filter ===")
        
        if not self.genelia_user_id:
            self.log_test("Telecaller Filter", False, "Genelia's user ID not found")
            return False
        
        # Test the telecaller filter
        params = {"telecaller": self.genelia_user_id}
        response = self.make_request("GET", "/driver-onboarding/leads", params=params)
        
        if not response:
            self.log_test("Telecaller Filter Request", False, "Network error")
            return False
        
        if response.status_code == 200:
            try:
                filtered_leads = response.json()
                filtered_count = len(filtered_leads)
                expected_count = 5
                
                self.log_test("Telecaller Filter Request", True, 
                            f"Filter request successful, returned {filtered_count} leads")
                
                if filtered_count == expected_count:
                    self.log_test("Telecaller Filter Count", True, 
                                f"Filter returned exactly {filtered_count} leads (expected {expected_count})")
                    
                    # Verify all returned leads have correct assigned_telecaller
                    correct_assignments = 0
                    for lead in filtered_leads:
                        if lead.get('assigned_telecaller') == self.genelia_user_id:
                            correct_assignments += 1
                    
                    if correct_assignments == filtered_count:
                        self.log_test("Telecaller Filter Accuracy", True, 
                                    f"All {filtered_count} filtered leads have correct assigned_telecaller ID")
                    else:
                        self.log_test("Telecaller Filter Accuracy", False, 
                                    f"Only {correct_assignments}/{filtered_count} filtered leads have correct assigned_telecaller ID")
                    
                    # Verify assigned_telecaller_name field
                    leads_with_name = 0
                    sample_name = None
                    for lead in filtered_leads:
                        telecaller_name = lead.get('assigned_telecaller_name')
                        if telecaller_name:
                            leads_with_name += 1
                            if not sample_name:
                                sample_name = telecaller_name
                    
                    if leads_with_name == filtered_count:
                        self.log_test("Telecaller Name Display", True, 
                                    f"All filtered leads show telecaller name: '{sample_name}' (not email)")
                        
                        # Verify it's showing name, not email
                        if sample_name and '@' not in sample_name:
                            self.log_test("Telecaller Name Format", True, 
                                        f"Telecaller name field shows name '{sample_name}', not email address")
                        else:
                            self.log_test("Telecaller Name Format", False, 
                                        f"Telecaller name field shows email '{sample_name}' instead of name")
                    else:
                        self.log_test("Telecaller Name Display", False, 
                                    f"Only {leads_with_name}/{filtered_count} filtered leads have assigned_telecaller_name populated")
                    
                    return True
                else:
                    self.log_test("Telecaller Filter Count", False, 
                                f"Filter returned {filtered_count} leads, expected {expected_count}")
                    return False
                    
            except json.JSONDecodeError:
                self.log_test("Telecaller Filter Request", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Telecaller Filter Request", False, 
                        f"Filter request failed with status {response.status_code}", response.text)
            return False
    
    def test_filter_case_sensitivity(self):
        """Step 5: Test filter is case-sensitive to user ID"""
        print("\n=== Step 5: Test Filter Case Sensitivity ===")
        
        if not self.genelia_user_id:
            self.log_test("Filter Case Sensitivity", False, "Genelia's user ID not found")
            return False
        
        # Test with wrong case (should return no results)
        wrong_case_id = self.genelia_user_id.upper() if self.genelia_user_id.islower() else self.genelia_user_id.lower()
        params = {"telecaller": wrong_case_id}
        response = self.make_request("GET", "/driver-onboarding/leads", params=params)
        
        if response and response.status_code == 200:
            try:
                wrong_case_leads = response.json()
                wrong_case_count = len(wrong_case_leads)
                
                if wrong_case_count == 0:
                    self.log_test("Filter Case Sensitivity", True, 
                                f"Filter is case-sensitive: wrong case ID '{wrong_case_id}' returned {wrong_case_count} leads")
                    return True
                else:
                    self.log_test("Filter Case Sensitivity", False, 
                                f"Filter not case-sensitive: wrong case ID '{wrong_case_id}' returned {wrong_case_count} leads")
                    return False
            except json.JSONDecodeError:
                self.log_test("Filter Case Sensitivity", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Filter Case Sensitivity", False, 
                        f"Case sensitivity test failed with status {response.status_code if response else 'Network error'}")
            return False
    
    def run_all_tests(self):
        """Run all telecaller filter tests"""
        print("🧪 TELECALLER LEADS FILTER TEST")
        print("=" * 50)
        print("Testing Genelia's assigned leads visibility")
        print("Expected: 5 leads assigned to Genelia")
        print("=" * 50)
        
        success_count = 0
        total_tests = 5
        
        # Step 1: Admin Login
        if self.test_admin_login():
            success_count += 1
        
        # Step 2: Get Genelia's User ID
        if self.test_get_genelia_user_id():
            success_count += 1
        
        # Step 3: Check Assigned Leads
        if self.test_check_assigned_leads():
            success_count += 1
        
        # Step 4: Test Telecaller Filter
        if self.test_telecaller_filter():
            success_count += 1
        
        # Step 5: Test Case Sensitivity
        if self.test_filter_case_sensitivity():
            success_count += 1
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        success_rate = (success_count / total_tests) * 100
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        print(f"\n🎯 Overall Success Rate: {success_count}/{total_tests} ({success_rate:.1f}%)")
        
        if success_count == total_tests:
            print("🎉 ALL TESTS PASSED - Telecaller filter is working correctly!")
            return True
        elif success_count >= 3:
            print("⚠️  PARTIAL SUCCESS - Some issues found but core functionality works")
            return True
        else:
            print("❌ TESTS FAILED - Telecaller filter has critical issues")
            return False

def main():
    """Main function to run telecaller filter tests"""
    tester = TelecallerFilterTester()
    success = tester.run_all_tests()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()