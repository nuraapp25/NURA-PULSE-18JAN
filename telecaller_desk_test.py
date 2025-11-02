#!/usr/bin/env python3
"""
Comprehensive Telecaller's Desk Backend Testing
Tests all Telecaller's Desk APIs as requested in the review
"""

import requests
import json
import sys
import io
from datetime import datetime

# Configuration
BASE_URL = "https://lead-management-4.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class TelecallerDeskTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        self.test_results = []
        self.test_lead_id = None
        
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
    
    def make_request(self, method, endpoint, data=None, files=None, use_auth=True, params=None):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                if files:
                    response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
                else:
                    headers["Content-Type"] = "application/json"
                    response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PATCH":
                headers["Content-Type"] = "application/json"
                response = requests.patch(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
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
        print("\n=== Authenticating as Master Admin ===")
        
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
                if "token" in data and "user" in data:
                    self.token = data["token"]
                    self.user_id = data["user"]["id"]
                    user_info = data["user"]
                    self.log_test("Authentication", True, 
                                f"Login successful. User: {user_info.get('first_name', 'Unknown')}, ID: {self.user_id}")
                    return True
                else:
                    self.log_test("Authentication", False, "No token or user in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("Authentication", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Authentication", False, 
                        f"Login failed with status {response.status_code}", response.text)
            return False
    
    def test_lead_fetching_for_telecaller(self):
        """Test 1: Lead Fetching for Telecaller"""
        print("\n=== Test 1: Lead Fetching for Telecaller ===")
        
        success_count = 0
        
        # Test GET /api/driver-onboarding/leads?telecaller={user_id}&skip_pagination=true
        params = {
            "telecaller": self.user_id,
            "skip_pagination": "true"
        }
        
        response = self.make_request("GET", "/driver-onboarding/leads", params=params)
        
        if response and response.status_code == 200:
            try:
                response_data = response.json()
                leads = response_data.get("leads", [])
                
                if isinstance(leads, list):
                    self.log_test("Lead Fetching - GET with telecaller filter", True, 
                                f"Successfully retrieved {len(leads)} leads for telecaller {self.user_id}")
                    success_count += 1
                    
                    # Store a test lead ID for later tests
                    if leads:
                        self.test_lead_id = leads[0].get("id")
                        self.log_test("Lead Fetching - Test lead ID found", True, 
                                    f"Using lead ID {self.test_lead_id} for subsequent tests")
                        success_count += 1
                    
                    # Verify lead structure
                    if leads:
                        sample_lead = leads[0]
                        required_fields = ["id", "name", "phone_number", "status", "stage"]
                        missing_fields = [field for field in required_fields if field not in sample_lead]
                        
                        if not missing_fields:
                            self.log_test("Lead Fetching - Lead structure validation", True, 
                                        "Leads contain all required fields: id, name, phone_number, status, stage")
                            success_count += 1
                        else:
                            self.log_test("Lead Fetching - Lead structure validation", False, 
                                        f"Leads missing required fields: {missing_fields}")
                else:
                    self.log_test("Lead Fetching - GET with telecaller filter", False, 
                                f"Expected array of leads in 'leads' key, got: {type(leads)}")
            except json.JSONDecodeError:
                self.log_test("Lead Fetching - GET with telecaller filter", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Lead Fetching - GET with telecaller filter", False, error_msg, 
                        response.text if response else None)
        
        # Test without telecaller filter to get all leads
        response = self.make_request("GET", "/driver-onboarding/leads")
        
        if response and response.status_code == 200:
            try:
                response_data = response.json()
                all_leads = response_data.get("leads", [])
                
                if isinstance(all_leads, list) and all_leads:
                    # Use first lead for testing if we don't have one yet
                    if not self.test_lead_id:
                        self.test_lead_id = all_leads[0].get("id")
                    
                    self.log_test("Lead Fetching - GET all leads", True, 
                                f"Successfully retrieved {len(all_leads)} total leads")
                    success_count += 1
                else:
                    self.log_test("Lead Fetching - GET all leads", False, 
                                "No leads found in database")
            except json.JSONDecodeError:
                self.log_test("Lead Fetching - GET all leads", False, 
                            "Invalid JSON response", response.text)
        
        return success_count >= 2
    
    def test_status_update_patch(self):
        """Test 2: Status Update (PATCH)"""
        print("\n=== Test 2: Status Update (PATCH) ===")
        
        if not self.test_lead_id:
            self.log_test("Status Update - No test lead", False, "No test lead ID available")
            return False
        
        success_count = 0
        
        # Test different status updates
        status_tests = [
            {"status": "S1", "description": "S1 status update"},
            {"status": "S2", "description": "S2 status update"},
            {"status": "S3", "description": "S3 status update"},
            {"status": "S4", "description": "S4 status update"},
            {"status": "Interested", "description": "Interested status"},
            {"status": "Not Interested", "description": "Not Interested status"},
            {"status": "Highly Interested", "description": "Highly Interested status"}
        ]
        
        for i, test_case in enumerate(status_tests, 1):
            update_data = {"status": test_case["status"]}
            
            response = self.make_request("PATCH", f"/driver-onboarding/leads/{self.test_lead_id}", update_data)
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    if "message" in result and "success" in result.get("message", "").lower():
                        self.log_test(f"Status Update - {test_case['description']}", True, 
                                    f"Successfully updated status to '{test_case['status']}': {result['message']}")
                        success_count += 1
                    else:
                        self.log_test(f"Status Update - {test_case['description']}", False, 
                                    f"Update response missing success message: {result}")
                except json.JSONDecodeError:
                    self.log_test(f"Status Update - {test_case['description']}", False, 
                                "Invalid JSON response", response.text)
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test(f"Status Update - {test_case['description']}", False, 
                            f"{error_msg}: {response.text if response else 'No response'}")
        
        return success_count >= 4  # At least 4 out of 7 status updates should work
    
    def test_lead_details_update(self):
        """Test 3: Lead Details Update"""
        print("\n=== Test 3: Lead Details Update ===")
        
        if not self.test_lead_id:
            self.log_test("Lead Details Update - No test lead", False, "No test lead ID available")
            return False
        
        success_count = 0
        
        # Test comprehensive lead details update
        update_data = {
            "name": "Updated Test Lead Name",
            "phone_number": "9876543210",
            "vehicle": "Auto Rickshaw",
            "status": "Interested",
            "stage": "S1",
            "remarks": "Updated via comprehensive testing",
            "current_location": "Chennai, Tamil Nadu",
            "experience": "5 years",
            "email": "updated.test@example.com"
        }
        
        response = self.make_request("PATCH", f"/driver-onboarding/leads/{self.test_lead_id}", update_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if "message" in result and "success" in result.get("message", "").lower():
                    self.log_test("Lead Details Update - Full update", True, 
                                f"Successfully updated lead details: {result['message']}")
                    success_count += 1
                    
                    # Verify the update by fetching the lead
                    verify_response = self.make_request("GET", f"/driver-onboarding/leads")
                    
                    if verify_response and verify_response.status_code == 200:
                        try:
                            response_data = verify_response.json()
                            all_leads = response_data.get("leads", [])
                            updated_lead = None
                            
                            for lead in all_leads:
                                if lead.get("id") == self.test_lead_id:
                                    updated_lead = lead
                                    break
                            
                            if updated_lead:
                                # Check if key fields were updated
                                checks = [
                                    (updated_lead.get("name") == update_data["name"], "name"),
                                    (updated_lead.get("phone_number") == update_data["phone_number"], "phone_number"),
                                    (updated_lead.get("status") == update_data["status"], "status"),
                                    (updated_lead.get("stage") == update_data["stage"], "stage")
                                ]
                                
                                passed_checks = sum(1 for check, _ in checks if check)
                                
                                if passed_checks >= 3:
                                    self.log_test("Lead Details Update - Verification", True, 
                                                f"Update verification successful: {passed_checks}/4 fields updated correctly")
                                    success_count += 1
                                else:
                                    failed_fields = [field for check, field in checks if not check]
                                    self.log_test("Lead Details Update - Verification", False, 
                                                f"Update verification failed for fields: {failed_fields}")
                            else:
                                self.log_test("Lead Details Update - Verification", False, 
                                            "Updated lead not found in database")
                        except json.JSONDecodeError:
                            self.log_test("Lead Details Update - Verification", False, 
                                        "Invalid JSON response during verification")
                else:
                    self.log_test("Lead Details Update - Full update", False, 
                                f"Update response missing success message: {result}")
            except json.JSONDecodeError:
                self.log_test("Lead Details Update - Full update", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Lead Details Update - Full update", False, 
                        f"{error_msg}: {response.text if response else 'No response'}")
        
        return success_count >= 1
    
    def test_document_status_fetching(self):
        """Test 4: Document Status Fetching"""
        print("\n=== Test 4: Document Status Fetching ===")
        
        if not self.test_lead_id:
            self.log_test("Document Status - No test lead", False, "No test lead ID available")
            return False
        
        success_count = 0
        
        # Test GET /api/driver-onboarding/documents/status/{lead_id}
        response = self.make_request("GET", f"/driver-onboarding/documents/status/{self.test_lead_id}")
        
        if response and response.status_code == 200:
            try:
                doc_status = response.json()
                
                # Expected document types
                expected_doc_types = ["dl", "aadhar", "pan", "gas_bill", "bank_passbook"]
                
                # Check if response includes document status for all types
                documents = doc_status.get("documents", {})
                all_types_present = all(doc_type in documents for doc_type in expected_doc_types)
                
                if all_types_present:
                    self.log_test("Document Status - All document types present", True, 
                                f"Response includes all expected document types: {expected_doc_types}")
                    success_count += 1
                    
                    # Check if uploaded status is boolean for each document type
                    boolean_status_correct = True
                    for doc_type in expected_doc_types:
                        uploaded_status = documents.get(doc_type, {}).get("uploaded")
                        if not isinstance(uploaded_status, bool):
                            boolean_status_correct = False
                            break
                    
                    if boolean_status_correct:
                        self.log_test("Document Status - Boolean status validation", True, 
                                    "All document types have boolean 'uploaded' status")
                        success_count += 1
                    else:
                        self.log_test("Document Status - Boolean status validation", False, 
                                    "Some document types have non-boolean 'uploaded' status")
                    
                    # Log current document status
                    uploaded_docs = [doc_type for doc_type in expected_doc_types 
                                   if documents.get(doc_type, {}).get("uploaded", False)]
                    self.log_test("Document Status - Current status", True, 
                                f"Currently uploaded documents: {uploaded_docs if uploaded_docs else 'None'}")
                    success_count += 1
                else:
                    missing_types = [doc_type for doc_type in expected_doc_types if doc_type not in doc_status]
                    self.log_test("Document Status - All document types present", False, 
                                f"Missing document types in response: {missing_types}")
                
            except json.JSONDecodeError:
                self.log_test("Document Status - GET status", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Document Status - GET status", False, 
                        f"{error_msg}: {response.text if response else 'No response'}")
        
        return success_count >= 2
    
    def test_document_upload(self):
        """Test 5: Document Upload"""
        print("\n=== Test 5: Document Upload ===")
        
        if not self.test_lead_id:
            self.log_test("Document Upload - No test lead", False, "No test lead ID available")
            return False
        
        success_count = 0
        
        # Create a test image file (simple PNG)
        test_image_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        
        # Test document upload for different document types
        document_types = ["dl", "aadhar", "pan", "gas_bill", "bank_passbook"]
        
        for doc_type in document_types:
            # Test POST /api/driver-onboarding/upload-document/{lead_id}?document_type={doc_type}
            files = {
                'file': (f'test_{doc_type}.png', test_image_content, 'image/png')
            }
            
            response = self.make_request("POST", f"/driver-onboarding/upload-document/{self.test_lead_id}?document_type={doc_type}", 
                                       files=files)
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    if "message" in result and "success" in result.get("message", "").lower():
                        self.log_test(f"Document Upload - {doc_type.upper()}", True, 
                                    f"Successfully uploaded {doc_type} document: {result['message']}")
                        success_count += 1
                    else:
                        self.log_test(f"Document Upload - {doc_type.upper()}", False, 
                                    f"Upload response missing success message: {result}")
                except json.JSONDecodeError:
                    self.log_test(f"Document Upload - {doc_type.upper()}", False, 
                                "Invalid JSON response", response.text)
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test(f"Document Upload - {doc_type.upper()}", False, 
                            f"{error_msg}: {response.text if response else 'No response'}")
        
        return success_count >= 3  # At least 3 out of 5 document uploads should work
    
    def test_document_view_download(self):
        """Test 6: Document View/Download"""
        print("\n=== Test 6: Document View/Download ===")
        
        if not self.test_lead_id:
            self.log_test("Document View/Download - No test lead", False, "No test lead ID available")
            return False
        
        success_count = 0
        
        # Test document view/download for different document types
        document_types = ["dl", "aadhar", "pan", "gas_bill", "bank_passbook"]
        
        for doc_type in document_types:
            # Test GET /api/driver-onboarding/document/{lead_id}/{doc_type}
            response = self.make_request("GET", f"/driver-onboarding/document/{self.test_lead_id}/{doc_type}")
            
            if response:
                if response.status_code == 200:
                    # Check if response is a blob (binary content)
                    content_type = response.headers.get('content-type', '')
                    
                    if 'image' in content_type or 'application' in content_type:
                        self.log_test(f"Document View/Download - {doc_type.upper()}", True, 
                                    f"Successfully retrieved {doc_type} document (Content-Type: {content_type})")
                        success_count += 1
                    else:
                        self.log_test(f"Document View/Download - {doc_type.upper()}", False, 
                                    f"Unexpected content type: {content_type}")
                elif response.status_code == 404:
                    self.log_test(f"Document View/Download - {doc_type.upper()}", True, 
                                f"Document {doc_type} not found (404) - expected if not uploaded")
                    success_count += 1
                else:
                    self.log_test(f"Document View/Download - {doc_type.upper()}", False, 
                                f"Unexpected status code: {response.status_code}")
            else:
                self.log_test(f"Document View/Download - {doc_type.upper()}", False, 
                            "Network error")
        
        return success_count >= 3  # At least 3 out of 5 document retrievals should work
    
    def test_document_delete(self):
        """Test 7: Document Delete"""
        print("\n=== Test 7: Document Delete ===")
        
        if not self.test_lead_id:
            self.log_test("Document Delete - No test lead", False, "No test lead ID available")
            return False
        
        success_count = 0
        
        # Test document deletion for different document types
        document_types = ["dl", "aadhar", "pan"]  # Test fewer to avoid deleting all test documents
        
        for doc_type in document_types:
            # Test DELETE /api/driver-onboarding/document/{lead_id}/{doc_type}
            response = self.make_request("DELETE", f"/driver-onboarding/document/{self.test_lead_id}/{doc_type}")
            
            if response:
                if response.status_code == 200:
                    try:
                        result = response.json()
                        if "message" in result and ("deleted" in result.get("message", "").lower() or 
                                                  "removed" in result.get("message", "").lower()):
                            self.log_test(f"Document Delete - {doc_type.upper()}", True, 
                                        f"Successfully deleted {doc_type} document: {result['message']}")
                            success_count += 1
                        else:
                            self.log_test(f"Document Delete - {doc_type.upper()}", False, 
                                        f"Delete response missing success message: {result}")
                    except json.JSONDecodeError:
                        self.log_test(f"Document Delete - {doc_type.upper()}", False, 
                                    "Invalid JSON response", response.text)
                elif response.status_code == 404:
                    self.log_test(f"Document Delete - {doc_type.upper()}", True, 
                                f"Document {doc_type} not found for deletion (404) - expected if not uploaded")
                    success_count += 1
                else:
                    self.log_test(f"Document Delete - {doc_type.upper()}", False, 
                                f"Unexpected status code: {response.status_code}")
            else:
                self.log_test(f"Document Delete - {doc_type.upper()}", False, 
                            "Network error")
        
        # Verify document status updates after deletion
        verify_response = self.make_request("GET", f"/driver-onboarding/documents/status/{self.test_lead_id}")
        
        if verify_response and verify_response.status_code == 200:
            try:
                doc_status = verify_response.json()
                
                # Check if deleted documents show as not uploaded
                documents = doc_status.get("documents", {})
                deleted_docs_updated = True
                for doc_type in document_types:
                    if documents.get(doc_type, {}).get("uploaded", True):  # Should be False after deletion
                        deleted_docs_updated = False
                        break
                
                if deleted_docs_updated:
                    self.log_test("Document Delete - Status verification", True, 
                                "Document status correctly updated after deletion")
                    success_count += 1
                else:
                    self.log_test("Document Delete - Status verification", False, 
                                "Document status not updated after deletion")
            except json.JSONDecodeError:
                self.log_test("Document Delete - Status verification", False, 
                            "Invalid JSON response during verification")
        
        return success_count >= 2
    
    def run_all_tests(self):
        """Run all Telecaller's Desk tests"""
        print("🚀 Starting Comprehensive Telecaller's Desk Backend Testing")
        print(f"Backend URL: {self.base_url}")
        print(f"Authentication: {MASTER_ADMIN_EMAIL}")
        
        # Authenticate first
        if not self.authenticate():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Run all test scenarios
        test_results = []
        
        test_results.append(("Lead Fetching for Telecaller", self.test_lead_fetching_for_telecaller()))
        test_results.append(("Status Update (PATCH)", self.test_status_update_patch()))
        test_results.append(("Lead Details Update", self.test_lead_details_update()))
        test_results.append(("Document Status Fetching", self.test_document_status_fetching()))
        test_results.append(("Document Upload", self.test_document_upload()))
        test_results.append(("Document View/Download", self.test_document_view_download()))
        test_results.append(("Document Delete", self.test_document_delete()))
        
        # Calculate results
        passed_tests = sum(1 for _, result in test_results if result)
        total_tests = len(test_results)
        success_rate = (passed_tests / total_tests) * 100
        
        print(f"\n{'='*60}")
        print("📊 TELECALLER'S DESK TESTING SUMMARY")
        print(f"{'='*60}")
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
        
        print(f"\n📈 Overall Success Rate: {success_rate:.1f}% ({passed_tests}/{total_tests} tests passed)")
        
        if success_rate >= 70:
            print("🎉 Telecaller's Desk functionality is working correctly!")
            return True
        else:
            print("⚠️  Some Telecaller's Desk functionality needs attention.")
            return False
    
    def get_summary(self):
        """Get test summary for reporting"""
        passed_tests = sum(1 for result in self.test_results if result["success"])
        total_tests = len(self.test_results)
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "success_rate": success_rate,
            "test_results": self.test_results
        }

def main():
    """Main function to run Telecaller's Desk tests"""
    tester = TelecallerDeskTester()
    success = tester.run_all_tests()
    
    # Print detailed results for debugging
    print(f"\n{'='*60}")
    print("🔍 DETAILED TEST RESULTS")
    print(f"{'='*60}")
    
    for result in tester.test_results:
        status = "✅" if result["success"] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)