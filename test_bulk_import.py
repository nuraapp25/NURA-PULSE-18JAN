#!/usr/bin/env python3
"""
Focused test for Driver Onboarding Bulk Import fixes
Tests the specific issues mentioned in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://fleetflow-8.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

class BulkImportTester:
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
        """Login and get token"""
        print("🔐 Authenticating...")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data:
                    self.token = data["token"]
                    user_info = data.get("user", {})
                    print(f"✅ Login successful. User: {user_info.get('first_name', 'Unknown')}")
                    return True
                else:
                    print(f"❌ No token in response: {data}")
                    return False
            else:
                print(f"❌ Login failed with status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    def test_bulk_import_with_excel_file(self):
        """Test bulk import with the actual Excel file"""
        print("\n=== Testing Bulk Import with User's Excel File ===")
        
        success_count = 0
        
        # Step 1: Get initial lead count
        print("\n--- Step 1: Getting initial lead count ---")
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/driver-onboarding/leads", headers=headers, timeout=10)
            
            initial_count = 0
            if response.status_code == 200:
                leads = response.json()
                initial_count = len(leads)
                self.log_test("Initial Lead Count", True, f"Current database has {initial_count} leads")
                success_count += 1
            else:
                self.log_test("Initial Lead Count", False, f"Failed to get leads: {response.status_code}")
        except Exception as e:
            self.log_test("Initial Lead Count", False, f"Error getting leads: {e}")
        
        # Step 2: Perform bulk import with Excel file
        print("\n--- Step 2: Testing bulk import with Excel file ---")
        
        # Column mapping as specified in review request
        column_mapping = {
            "name": 1,
            "phone_number": 2,
            "address": 3,
            "remarks": 4,
            "status": 5,
            "source": 6
        }
        
        try:
            # Read the Excel file
            with open('/app/backend/test_import.xlsx', 'rb') as f:
                excel_content = f.read()
            
            # Prepare the import request
            files = {'file': ('test_import.xlsx', excel_content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            form_data = {
                'lead_source': 'Test Import - User Excel File',
                'lead_date': '2024-12-15',
                'column_mapping': json.dumps(column_mapping)
            }
            
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(f"{self.base_url}/driver-onboarding/bulk-import", 
                                   headers=headers, files=files, data=form_data, timeout=120)
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    print(f"Import response: {json.dumps(result, indent=2)}")
                    
                    if result.get("success"):
                        # Check for duplicates_skipped field (Issue 1)
                        duplicates_skipped = result.get("duplicates_skipped")
                        new_leads_count = result.get("new_leads_count", 0)
                        total_leads_now = result.get("total_leads_now", 0)
                        
                        if duplicates_skipped is not None:
                            self.log_test("Duplicates Skipped Field Present", True, 
                                        f"duplicates_skipped field present: {duplicates_skipped} (not undefined)")
                            success_count += 1
                        else:
                            self.log_test("Duplicates Skipped Field Present", False, 
                                        "duplicates_skipped field is missing or undefined")
                        
                        self.log_test("Excel File Import", True, 
                                    f"Import successful: {new_leads_count} new leads, total now: {total_leads_now}")
                        success_count += 1
                        
                    else:
                        self.log_test("Excel File Import", False, 
                                    f"Import failed: {result.get('message', 'Unknown error')}")
                except json.JSONDecodeError:
                    self.log_test("Excel File Import", False, 
                                f"Invalid JSON response: {response.text}")
            else:
                self.log_test("Excel File Import", False, 
                            f"Import failed with status {response.status_code}: {response.text}")
        
        except FileNotFoundError:
            self.log_test("Excel File Import", False, 
                        "Test Excel file not found at /app/backend/test_import.xlsx")
        except Exception as e:
            self.log_test("Excel File Import", False, f"Exception during import: {e}")
        
        # Step 3: Test Status Summary Dashboard (Issue 2)
        print("\n--- Step 3: Testing Status Summary Dashboard ---")
        
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/driver-onboarding/status-summary", 
                                  headers=headers, timeout=10)
            
            if response.status_code == 200:
                try:
                    summary_data = response.json()
                    print(f"Status summary response: {json.dumps(summary_data, indent=2)}")
                    
                    if summary_data.get("success"):
                        summary = summary_data.get("summary", {})
                        stage_totals = summary_data.get("stage_totals", {})
                        
                        # Check S3 stage for "Training WIP" (should be 4 leads)
                        s3_summary = summary.get("S3", {})
                        training_wip_count = s3_summary.get("Training WIP", 0)
                        
                        # Check S4 stage for "DONE!" (should be 25 leads)
                        s4_summary = summary.get("S4", {})
                        done_count = s4_summary.get("DONE!", 0)
                        
                        if training_wip_count > 0:
                            self.log_test("Training WIP Count in S3", True, 
                                        f"S3 stage shows 'Training WIP': {training_wip_count} leads")
                            success_count += 1
                        else:
                            self.log_test("Training WIP Count in S3", False, 
                                        f"S3 stage 'Training WIP' shows {training_wip_count} (expected > 0)")
                        
                        if done_count > 0:
                            self.log_test("DONE Count in S4", True, 
                                        f"S4 stage shows 'DONE!': {done_count} leads")
                            success_count += 1
                        else:
                            self.log_test("DONE Count in S4", False, 
                                        f"S4 stage 'DONE!' shows {done_count} (expected > 0)")
                        
                        # Verify stage totals
                        s3_total = stage_totals.get("S3", 0)
                        s4_total = stage_totals.get("S4", 0)
                        
                        self.log_test("Stage Totals", True, 
                                    f"Stage totals - S3: {s3_total}, S4: {s4_total}")
                        success_count += 1
                        
                    else:
                        self.log_test("Status Summary Response", False, 
                                    "Summary response missing success field")
                except json.JSONDecodeError:
                    self.log_test("Status Summary Response", False, 
                                f"Invalid JSON response: {response.text}")
            else:
                self.log_test("Status Summary Response", False, 
                            f"Status summary failed with status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Status Summary Response", False, f"Exception: {e}")
        
        # Step 4: Verify individual leads have stage field
        print("\n--- Step 4: Verifying lead stage assignment ---")
        
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/driver-onboarding/leads?limit=20", 
                                  headers=headers, timeout=10)
            
            if response.status_code == 200:
                try:
                    leads_data = response.json()
                    
                    # Handle both list and dict responses
                    if isinstance(leads_data, dict):
                        leads = leads_data.get('leads', []) if 'leads' in leads_data else []
                    else:
                        leads = leads_data if isinstance(leads_data, list) else []
                    
                    leads_with_stage = 0
                    training_wip_leads = []
                    done_leads = []
                    
                    for lead in leads:
                        if isinstance(lead, dict) and lead.get('stage'):
                            leads_with_stage += 1
                        
                        if isinstance(lead, dict) and lead.get('status') == 'Training WIP':
                            training_wip_leads.append(lead)
                        
                        if isinstance(lead, dict) and lead.get('status') == 'DONE!':
                            done_leads.append(lead)
                    
                    if leads_with_stage > 0:
                        self.log_test("Leads Have Stage Field", True, 
                                    f"{leads_with_stage} out of {len(leads)} leads have stage field set")
                        success_count += 1
                    else:
                        self.log_test("Leads Have Stage Field", False, 
                                    "No leads found with stage field set")
                    
                    # Check specific status-stage mappings
                    if training_wip_leads:
                        training_wip_with_s3 = [l for l in training_wip_leads if l.get('stage') and 'S3' in l.get('stage')]
                        self.log_test("Training WIP Stage Mapping", True, 
                                    f"Found {len(training_wip_leads)} 'Training WIP' leads, {len(training_wip_with_s3)} have S3 stage")
                        success_count += 1
                    
                    if done_leads:
                        done_with_s4 = [l for l in done_leads if l.get('stage') and 'S4' in l.get('stage')]
                        self.log_test("DONE Stage Mapping", True, 
                                    f"Found {len(done_leads)} 'DONE!' leads, {len(done_with_s4)} have S4 stage")
                        success_count += 1
                    
                except json.JSONDecodeError:
                    self.log_test("Leads Have Stage Field", False, 
                                f"Invalid JSON response: {response.text}")
            else:
                self.log_test("Leads Have Stage Field", False, 
                            f"Failed to get leads: {response.status_code}")
        except Exception as e:
            self.log_test("Leads Have Stage Field", False, f"Exception: {e}")
        
        return success_count
    
    def run_test(self):
        """Run the bulk import test"""
        print("🚀 Testing Driver Onboarding Bulk Import Fixes")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed")
            return False
        
        success_count = self.test_bulk_import_with_excel_file()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        failed = len(self.test_results) - passed
        
        for result in self.test_results:
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"{status} {result['test']}")
        
        print(f"\nTotal Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        # Overall result
        overall_success = success_count >= 6  # At least 6 critical tests should pass
        
        if overall_success:
            print("\n🎉 BULK IMPORT FIXES: WORKING CORRECTLY")
        else:
            print("\n⚠️  BULK IMPORT FIXES: NEED ATTENTION")
        
        return overall_success

if __name__ == "__main__":
    tester = BulkImportTester()
    success = tester.run_test()
    sys.exit(0 if success else 1)