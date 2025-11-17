#!/usr/bin/env python3
"""
Lead Assignment and Retrieval Testing for Joshua
Tests the specific scenario reported by user: lead assignment to Joshua not appearing in Telecaller's Desk
"""

import requests
import json
import sys
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://leadonboard.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"
JOSHUA_EMAIL = "praylovemusic@gmail.com"
ASSIGNMENT_DATE = "2025-11-15"

class LeadAssignmentTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.test_lead_id = None
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
            elif method.upper() == "PATCH":
                headers["Content-Type"] = "application/json"
                response = requests.patch(url, headers=headers, json=data, timeout=30)
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
        """Step 0: Authenticate with admin credentials"""
        print("\n=== STEP 0: Authentication ===")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
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
    
    def create_test_lead(self):
        """Step 1: Create a test lead"""
        print("\n=== STEP 1: Create Test Lead ===")
        
        # Generate unique test lead data
        unique_id = str(uuid.uuid4())[:8]
        test_lead_data = {
            "name": f"Test Lead for Joshua {unique_id}",
            "phone_number": f"98765{unique_id[:5]}",
            "email": f"testlead{unique_id}@example.com",
            "vehicle": "Auto",
            "driving_license": "Yes",
            "experience": "2 years",
            "interested_ev": "Yes",
            "monthly_salary": "25000",
            "residing_chennai": "Yes",
            "current_location": "Chennai",
            "lead_source": "Test Assignment"
        }
        
        response = self.make_request("POST", "/driver-onboarding/create-lead", test_lead_data)
        
        if not response:
            self.log_test("Create Test Lead", False, "Network error during lead creation")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "lead_id" in data:
                    self.test_lead_id = data["lead_id"]
                    self.log_test("Create Test Lead", True, 
                                f"Created test lead: {test_lead_data['name']} (ID: {self.test_lead_id})")
                    return True
                else:
                    self.log_test("Create Test Lead", False, "No lead ID in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("Create Test Lead", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Create Test Lead", False, 
                        f"Lead creation failed with status {response.status_code}", response.text)
            return False
    
    def assign_lead_to_joshua(self):
        """Step 2: Assign lead to Joshua for Nov 15, 2025"""
        print("\n=== STEP 2: Assign Lead to Joshua ===")
        
        if not self.test_lead_id:
            self.log_test("Assign Lead to Joshua", False, "No test lead ID available")
            return False
        
        assignment_data = {
            "lead_ids": [self.test_lead_id],
            "telecaller_email": JOSHUA_EMAIL,
            "assignment_date": ASSIGNMENT_DATE
        }
        
        response = self.make_request("PATCH", "/driver-onboarding/bulk-assign", assignment_data)
        
        if not response:
            self.log_test("Assign Lead to Joshua", False, "Network error during assignment")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and data.get("modified_count", 0) > 0:
                    self.log_test("Assign Lead to Joshua", True, 
                                f"Assignment successful: {data.get('message', 'No message')}")
                    return True
                else:
                    self.log_test("Assign Lead to Joshua", False, 
                                f"Assignment failed or no leads modified: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_test("Assign Lead to Joshua", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Assign Lead to Joshua", False, 
                        f"Assignment failed with status {response.status_code}", response.text)
            return False
    
    def query_leads_for_joshua(self):
        """Step 3: Query leads for Joshua to check if assigned lead appears"""
        print("\n=== STEP 3: Query Leads for Joshua ===")
        
        # Test without skip_pagination first
        response = self.make_request("GET", f"/driver-onboarding/leads?telecaller={JOSHUA_EMAIL}")
        
        if not response:
            self.log_test("Query Leads for Joshua (Paginated)", False, "Network error during query")
            return False
        
        if response.status_code == 200:
            try:
                leads = response.json()
                # Handle the actual response format: {"leads": [...], "total": N}
                if isinstance(leads, dict) and "leads" in leads:
                    leads_list = leads["leads"]
                    joshua_leads = [lead for lead in leads_list if lead.get("assigned_telecaller") == JOSHUA_EMAIL]
                    test_lead_found = any(lead.get("id") == self.test_lead_id for lead in joshua_leads)
                    
                    # Debug: Show all leads assigned to Joshua
                    print(f"DEBUG: Found {len(joshua_leads)} leads assigned to Joshua:")
                    for lead in joshua_leads:
                        print(f"  - {lead.get('name')} (ID: {lead.get('id')}) - Date: {lead.get('assigned_date')}")
                elif isinstance(leads, list):
                    joshua_leads = [lead for lead in leads if lead.get("assigned_telecaller") == JOSHUA_EMAIL]
                    test_lead_found = any(lead.get("id") == self.test_lead_id for lead in joshua_leads)
                else:
                    print(f"DEBUG: Unexpected leads response format: {type(leads)}")
                    joshua_leads = []
                    test_lead_found = False
                
                self.log_test("Query Leads for Joshua (Paginated)", True, 
                            f"Found {len(joshua_leads)} leads assigned to Joshua, test lead found: {test_lead_found}")
                
                if test_lead_found:
                    # Check the assigned lead details
                    test_lead = next(lead for lead in joshua_leads if lead.get("id") == self.test_lead_id)
                    assigned_telecaller = test_lead.get("assigned_telecaller")
                    assigned_date = test_lead.get("assigned_date")
                    
                    self.log_test("Verify Lead Assignment Details", True, 
                                f"assigned_telecaller: '{assigned_telecaller}', assigned_date: '{assigned_date}'")
                else:
                    self.log_test("Verify Lead Assignment Details", False, 
                                "Test lead not found in Joshua's assigned leads")
                
            except json.JSONDecodeError:
                self.log_test("Query Leads for Joshua (Paginated)", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Query Leads for Joshua (Paginated)", False, 
                        f"Query failed with status {response.status_code}", response.text)
            return False
        
        # Test with skip_pagination=true
        response = self.make_request("GET", f"/driver-onboarding/leads?telecaller={JOSHUA_EMAIL}&skip_pagination=true")
        
        if not response:
            self.log_test("Query Leads for Joshua (All)", False, "Network error during full query")
            return False
        
        if response.status_code == 200:
            try:
                all_leads = response.json()
                # Handle the actual response format: {"leads": [...], "total": N}
                if isinstance(all_leads, dict) and "leads" in all_leads:
                    leads_list = all_leads["leads"]
                    joshua_all_leads = [lead for lead in leads_list if lead.get("assigned_telecaller") == JOSHUA_EMAIL]
                    test_lead_found_all = any(lead.get("id") == self.test_lead_id for lead in joshua_all_leads)
                elif isinstance(all_leads, list):
                    joshua_all_leads = [lead for lead in all_leads if lead.get("assigned_telecaller") == JOSHUA_EMAIL]
                    test_lead_found_all = any(lead.get("id") == self.test_lead_id for lead in joshua_all_leads)
                else:
                    print(f"DEBUG: Unexpected all leads response format: {type(all_leads)}")
                    joshua_all_leads = []
                    test_lead_found_all = False
                
                self.log_test("Query Leads for Joshua (All)", True, 
                            f"Found {len(joshua_all_leads)} total leads assigned to Joshua, test lead found: {test_lead_found_all}")
                
                return test_lead_found_all
                
            except json.JSONDecodeError:
                self.log_test("Query Leads for Joshua (All)", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Query Leads for Joshua (All)", False, 
                        f"Full query failed with status {response.status_code}", response.text)
            return False
    
    def query_with_date_filter(self):
        """Step 4: Query with date filter if backend supports it"""
        print("\n=== STEP 4: Query with Date Filter ===")
        
        # Test date filtering
        response = self.make_request("GET", 
                                   f"/driver-onboarding/leads?telecaller={JOSHUA_EMAIL}&start_date={ASSIGNMENT_DATE}&end_date={ASSIGNMENT_DATE}")
        
        if not response:
            self.log_test("Query with Date Filter", False, "Network error during date filtered query")
            return False
        
        if response.status_code == 200:
            try:
                filtered_leads = response.json()
                # Handle the actual response format: {"leads": [...], "total": N}
                if isinstance(filtered_leads, dict) and "leads" in filtered_leads:
                    leads_list = filtered_leads["leads"]
                    joshua_filtered_leads = [lead for lead in leads_list if lead.get("assigned_telecaller") == JOSHUA_EMAIL]
                    test_lead_found_filtered = any(lead.get("id") == self.test_lead_id for lead in joshua_filtered_leads)
                elif isinstance(filtered_leads, list):
                    joshua_filtered_leads = [lead for lead in filtered_leads if lead.get("assigned_telecaller") == JOSHUA_EMAIL]
                    test_lead_found_filtered = any(lead.get("id") == self.test_lead_id for lead in joshua_filtered_leads)
                else:
                    print(f"DEBUG: Unexpected filtered leads response format: {type(filtered_leads)}")
                    joshua_filtered_leads = []
                    test_lead_found_filtered = False
                
                self.log_test("Query with Date Filter", True, 
                            f"Date filter query returned {len(joshua_filtered_leads)} leads for Joshua, test lead found: {test_lead_found_filtered}")
                
                return test_lead_found_filtered
                
            except json.JSONDecodeError:
                self.log_test("Query with Date Filter", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Query with Date Filter", False, 
                        f"Date filtered query failed with status {response.status_code}", response.text)
            return False
    
    def direct_mongodb_check(self):
        """Step 5: Direct MongoDB check via backend endpoint"""
        print("\n=== STEP 5: Direct MongoDB Check ===")
        
        if not self.test_lead_id:
            self.log_test("Direct MongoDB Check", False, "No test lead ID available")
            return False
        
        # Get the specific lead by ID to check database values
        response = self.make_request("GET", f"/driver-onboarding/leads/{self.test_lead_id}")
        
        if not response:
            self.log_test("Direct MongoDB Check", False, "Network error during direct lead query")
            return False
        
        if response.status_code == 200:
            try:
                lead_data = response.json()
                assigned_telecaller = lead_data.get("assigned_telecaller")
                assigned_date = lead_data.get("assigned_date")
                lead_name = lead_data.get("name")
                
                self.log_test("Direct MongoDB Check", True, 
                            f"Lead '{lead_name}' - assigned_telecaller: '{assigned_telecaller}', assigned_date: '{assigned_date}'")
                
                # Verify the values are correct
                telecaller_match = assigned_telecaller == JOSHUA_EMAIL
                date_present = assigned_date is not None
                
                self.log_test("Verify Database Values", telecaller_match and date_present, 
                            f"Telecaller match: {telecaller_match}, Date present: {date_present}")
                
                return telecaller_match and date_present
                
            except json.JSONDecodeError:
                self.log_test("Direct MongoDB Check", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Direct MongoDB Check", False, 
                        f"Direct lead query failed with status {response.status_code}", response.text)
            return False
    
    def cleanup_test_lead(self):
        """Cleanup: Delete the test lead"""
        print("\n=== CLEANUP: Delete Test Lead ===")
        
        if not self.test_lead_id:
            print("No test lead to cleanup")
            return
        
        # Note: There might not be a direct delete endpoint, so we'll try to update status to "Junk"
        cleanup_data = {
            "status": "Junk",
            "notes": "Test lead - can be deleted"
        }
        
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{self.test_lead_id}", cleanup_data)
        
        if response and response.status_code == 200:
            self.log_test("Cleanup Test Lead", True, "Test lead marked as Junk for cleanup")
        else:
            self.log_test("Cleanup Test Lead", False, "Could not cleanup test lead")
    
    def run_comprehensive_test(self):
        """Run the complete test flow"""
        print("🔍 LEAD ASSIGNMENT AND RETRIEVAL TESTING FOR JOSHUA")
        print("=" * 60)
        print(f"Testing assignment to: {JOSHUA_EMAIL}")
        print(f"Assignment date: {ASSIGNMENT_DATE}")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Step 0: Authenticate
        if not self.authenticate():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return False
        
        # Step 1: Create test lead
        if not self.create_test_lead():
            print("\n❌ TEST LEAD CREATION FAILED - Cannot proceed with assignment tests")
            return False
        
        # Step 2: Assign lead to Joshua
        if not self.assign_lead_to_joshua():
            print("\n❌ LEAD ASSIGNMENT FAILED")
            self.cleanup_test_lead()
            return False
        
        # Step 3: Query leads for Joshua
        retrieval_success = self.query_leads_for_joshua()
        
        # Step 4: Query with date filter
        date_filter_success = self.query_with_date_filter()
        
        # Step 5: Direct MongoDB check
        db_check_success = self.direct_mongodb_check()
        
        # Cleanup
        self.cleanup_test_lead()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = sum(1 for result in self.test_results if result["success"])
        total_tests = len(self.test_results)
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        
        print(f"Tests Passed: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
        
        # Key findings
        print("\n🔍 KEY FINDINGS:")
        print(f"1. Lead assignment works: {'✅' if any('Assign Lead to Joshua' in r['test'] and r['success'] for r in self.test_results) else '❌'}")
        print(f"2. Lead retrieval works: {'✅' if retrieval_success else '❌'}")
        print(f"3. Database values correct: {'✅' if db_check_success else '❌'}")
        print(f"4. Date filtering works: {'✅' if date_filter_success else '❌'}")
        
        # Detailed results
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return success_rate >= 70  # Consider successful if 70% of tests pass

if __name__ == "__main__":
    tester = LeadAssignmentTester()
    success = tester.run_comprehensive_test()
    
    if success:
        print("\n🎉 OVERALL TEST RESULT: SUCCESS")
        sys.exit(0)
    else:
        print("\n💥 OVERALL TEST RESULT: FAILURE")
        sys.exit(1)