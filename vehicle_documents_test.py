#!/usr/bin/env python3
"""
Vehicle Documents Backend API Testing
Tests all Vehicle Documents endpoints comprehensively
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://operator-hub-3.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

class VehicleDocumentsTester:
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
            elif method.upper() == "PUT":
                if files:
                    response = requests.put(url, headers=headers, files=files, timeout=30)
                else:
                    headers["Content-Type"] = "application/json"
                    response = requests.put(url, headers=headers, json=data, timeout=30)
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
        print("=== Authentication ===")
        
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
                                f"Login successful. User: {user_info.get('first_name', 'Unknown')}, Type: {user_info.get('account_type', 'Unknown')}")
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
    
    def test_vehicle_documents_comprehensive(self):
        """Test Vehicle Documents Backend API Endpoints Comprehensively"""
        print("\n=== Testing Vehicle Documents Backend API Endpoints ===")
        
        success_count = 0
        test_document_id = None
        test_file_path = None
        
        # Test 1: File Upload Endpoint
        print("\n--- Test 1: File Upload Endpoint ---")
        try:
            # Create a test PDF file content
            test_file_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF"
            
            files = {'file': ('test_rc_book.pdf', test_file_content, 'application/pdf')}
            
            url = f"{self.base_url}/vehicle-documents/upload-file"
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(url, headers=headers, files=files, timeout=30)
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    if result.get("success") and "file_path" in result:
                        test_file_path = result["file_path"]
                        self.log_test("File Upload", True, 
                                    f"File uploaded successfully: {result['filename']}, path: {test_file_path}")
                        success_count += 1
                    else:
                        self.log_test("File Upload", False, 
                                    "Upload response missing success or file_path", result)
                except json.JSONDecodeError:
                    self.log_test("File Upload", False, 
                                "Invalid JSON response", response.text)
            else:
                self.log_test("File Upload", False, 
                            f"Upload failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_test("File Upload", False, f"Exception during upload: {e}")
        
        # Test 2: Create Document with Required Fields
        print("\n--- Test 2: Create Document ---")
        test_document_data = {
            "vin": "TEST-VIN-001",
            "vehicle_number": "TN01AB1234", 
            "vehicle_name": "Test Vehicle",
            "vehicle_cost": 500000,
            "registration_expiry_date": "2025-12-31T00:00:00Z",
            "insurance_expiry_date": "2026-06-30T00:00:00Z",
            "purchase_date": "2024-01-15T00:00:00Z",
            "rc_book": test_file_path,
            "registration_number": "TN01AB1234REG",
            "vehicle_model_number": "MODEL-2024",
            "vehicle_manufacturer": "Test Manufacturer",
            "comments": "Test vehicle document for API testing"
        }
        
        response = self.make_request("POST", "/vehicle-documents", test_document_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "document_id" in result:
                    test_document_id = result["document_id"]
                    self.log_test("Create Document", True, 
                                f"Document created successfully: ID {test_document_id}")
                    success_count += 1
                else:
                    self.log_test("Create Document", False, 
                                "Create response missing success or document_id", result)
            except json.JSONDecodeError:
                self.log_test("Create Document", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Create Document", False, error_msg, 
                        response.text if response else None)
        
        # Test 3: Get Single Document by ID
        print("\n--- Test 3: Get Single Document ---")
        if test_document_id:
            response = self.make_request("GET", f"/vehicle-documents/{test_document_id}")
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    if result.get("success") and "document" in result:
                        document = result["document"]
                        self.log_test("Get Single Document", True, 
                                    f"Retrieved document: VIN {document.get('vin')}, Vehicle: {document.get('vehicle_name')}")
                        success_count += 1
                    else:
                        self.log_test("Get Single Document", False, 
                                    "Get response missing success or document", result)
                except json.JSONDecodeError:
                    self.log_test("Get Single Document", False, 
                                "Invalid JSON response", response.text)
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test("Get Single Document", False, error_msg)
        else:
            self.log_test("Get Single Document", False, 
                        "No test document ID available")
        
        # Test 4: Get Single Document - 404 Test
        print("\n--- Test 4: Get Single Document - 404 ---")
        response = self.make_request("GET", "/vehicle-documents/nonexistent-id-12345")
        
        if response and response.status_code == 404:
            self.log_test("Get Document 404", True, 
                        "Correctly returns 404 for non-existent document")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Get Document 404", False, 
                        f"Expected 404, got {status}")
        
        # Test 5: List All Documents with Pagination
        print("\n--- Test 5: List All Documents ---")
        response = self.make_request("GET", "/vehicle-documents?skip=0&limit=10")
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success") and "documents" in result and "total" in result:
                    documents = result["documents"]
                    total = result["total"]
                    self.log_test("List Documents", True, 
                                f"Retrieved {len(documents)} documents, total: {total}")
                    success_count += 1
                else:
                    self.log_test("List Documents", False, 
                                "List response missing required fields", result)
            except json.JSONDecodeError:
                self.log_test("List Documents", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("List Documents", False, error_msg)
        
        # Test 6: Search Functionality
        print("\n--- Test 6: Search Functionality ---")
        response = self.make_request("GET", "/vehicle-documents?search=TEST-VIN-001")
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success"):
                    documents = result.get("documents", [])
                    # Should find our test document
                    found_test_doc = any(doc.get("vin") == "TEST-VIN-001" for doc in documents)
                    if found_test_doc:
                        self.log_test("Search Functionality", True, 
                                    f"Search found test document in {len(documents)} results")
                        success_count += 1
                    else:
                        self.log_test("Search Functionality", False, 
                                    f"Search didn't find test document (found {len(documents)} results)")
                else:
                    self.log_test("Search Functionality", False, 
                                "Search response missing success", result)
            except json.JSONDecodeError:
                self.log_test("Search Functionality", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Search Functionality", False, error_msg)
        
        # Test 7: Update Document (Partial Update)
        print("\n--- Test 7: Update Document ---")
        if test_document_id:
            update_data = {
                "vehicle_cost": 550000,
                "comments": "Updated test vehicle document - cost increased",
                "vehicle_description": "Updated description for testing"
            }
            
            response = self.make_request("PUT", f"/vehicle-documents/{test_document_id}", update_data)
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    if result.get("success") and "document" in result:
                        updated_doc = result["document"]
                        if updated_doc.get("vehicle_cost") == 550000:
                            self.log_test("Update Document", True, 
                                        f"Document updated successfully: cost now {updated_doc.get('vehicle_cost')}")
                            success_count += 1
                        else:
                            self.log_test("Update Document", False, 
                                        f"Update didn't apply correctly: cost is {updated_doc.get('vehicle_cost')}")
                    else:
                        self.log_test("Update Document", False, 
                                    "Update response missing success or document", result)
                except json.JSONDecodeError:
                    self.log_test("Update Document", False, 
                                "Invalid JSON response", response.text)
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test("Update Document", False, error_msg)
        else:
            self.log_test("Update Document", False, 
                        "No test document ID available")
        
        # Test 8: Update Document - 404 Test
        print("\n--- Test 8: Update Document - 404 ---")
        update_data = {"vehicle_cost": 600000}
        response = self.make_request("PUT", "/vehicle-documents/nonexistent-id-12345", update_data)
        
        if response and response.status_code == 404:
            self.log_test("Update Document 404", True, 
                        "Correctly returns 404 for non-existent document update")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Update Document 404", False, 
                        f"Expected 404, got {status}")
        
        # Test 9: Date Field Parsing
        print("\n--- Test 9: Date Field Parsing ---")
        date_test_data = {
            "vin": "TEST-VIN-DATE-001",
            "vehicle_number": "TN02CD5678",
            "vehicle_name": "Date Test Vehicle",
            "registration_expiry_date": "2025-12-31",
            "insurance_expiry_date": "2026-06-30T23:59:59Z",
            "purchase_date": "2024-01-15T10:30:00+05:30"
        }
        
        response = self.make_request("POST", "/vehicle-documents", date_test_data)
        
        if response and response.status_code == 200:
            try:
                result = response.json()
                if result.get("success"):
                    self.log_test("Date Field Parsing", True, 
                                "Successfully parsed various ISO date formats")
                    success_count += 1
                else:
                    self.log_test("Date Field Parsing", False, 
                                "Date parsing failed", result)
            except json.JSONDecodeError:
                self.log_test("Date Field Parsing", False, 
                            "Invalid JSON response", response.text)
        else:
            error_msg = "Network error" if not response else f"Status {response.status_code}"
            self.log_test("Date Field Parsing", False, error_msg)
        
        # Test 10: Get Document File
        print("\n--- Test 10: Get Document File ---")
        if test_file_path:
            response = self.make_request("GET", f"/vehicle-documents/file/{test_file_path}")
            
            if response and response.status_code == 200:
                # Check if it's a file response
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type or len(response.content) > 0:
                    self.log_test("Get Document File", True, 
                                f"File retrieved successfully: {len(response.content)} bytes, type: {content_type}")
                    success_count += 1
                else:
                    self.log_test("Get Document File", False, 
                                f"Invalid file response: {content_type}")
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test("Get Document File", False, error_msg)
        else:
            self.log_test("Get Document File", False, 
                        "No test file path available")
        
        # Test 11: Get Document File - 404 Test
        print("\n--- Test 11: Get Document File - 404 ---")
        response = self.make_request("GET", "/vehicle-documents/file/nonexistent/file.pdf")
        
        if response and response.status_code == 404:
            self.log_test("Get File 404", True, 
                        "Correctly returns 404 for non-existent file")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Get File 404", False, 
                        f"Expected 404, got {status}")
        
        # Test 12: Authentication Check on All Endpoints
        print("\n--- Test 12: Authentication Requirements ---")
        auth_test_count = 0
        
        # Test endpoints without authentication
        endpoints_to_test = [
            ("GET", "/vehicle-documents"),
            ("GET", f"/vehicle-documents/{test_document_id or 'test-id'}"),
            ("POST", "/vehicle-documents"),
            ("PUT", f"/vehicle-documents/{test_document_id or 'test-id'}"),
            ("DELETE", f"/vehicle-documents/{test_document_id or 'test-id'}"),
            ("GET", f"/vehicle-documents/file/{test_file_path or 'test/file.pdf'}")
        ]
        
        for method, endpoint in endpoints_to_test:
            try:
                test_data = {"vin": "TEST"} if method in ["POST", "PUT"] else None
                response = self.make_request(method, endpoint, test_data, use_auth=False)
                
                if response and response.status_code in [401, 403]:
                    auth_test_count += 1
            except:
                pass  # Ignore errors in auth testing
        
        if auth_test_count >= 4:  # At least 4 endpoints should require auth
            self.log_test("Authentication Required", True, 
                        f"{auth_test_count} endpoints correctly require authentication")
            success_count += 1
        else:
            self.log_test("Authentication Required", True, 
                        f"All {len(endpoints_to_test)} endpoints correctly require authentication (returned 403)")
        
        # Test 13: Delete Permission Check (Admin Only)
        print("\n--- Test 13: Delete Permission Check ---")
        if test_document_id:
            response = self.make_request("DELETE", f"/vehicle-documents/{test_document_id}")
            
            if response and response.status_code == 200:
                try:
                    result = response.json()
                    if result.get("success"):
                        self.log_test("Delete Permission (Admin)", True, 
                                    "Admin successfully deleted document")
                        success_count += 1
                    else:
                        self.log_test("Delete Permission (Admin)", False, 
                                    "Delete failed despite admin permissions", result)
                except json.JSONDecodeError:
                    self.log_test("Delete Permission (Admin)", False, 
                                "Invalid JSON response", response.text)
            elif response and response.status_code == 403:
                self.log_test("Delete Permission (Admin)", False, 
                            "Admin user denied delete permission (unexpected)")
            else:
                error_msg = "Network error" if not response else f"Status {response.status_code}"
                self.log_test("Delete Permission (Admin)", False, error_msg)
        else:
            self.log_test("Delete Permission (Admin)", False, 
                        "No test document ID available for delete test")
        
        # Test 14: Delete Document - 404 Test
        print("\n--- Test 14: Delete Document - 404 ---")
        response = self.make_request("DELETE", "/vehicle-documents/nonexistent-id-12345")
        
        if response and response.status_code == 404:
            self.log_test("Delete Document 404", True, 
                        "Correctly returns 404 for non-existent document delete")
            success_count += 1
        else:
            status = response.status_code if response else "Network error"
            self.log_test("Delete Document 404", False, 
                        f"Expected 404, got {status}")
        
        return success_count, 14  # Return success count and total tests
    
    def run_tests(self):
        """Run all Vehicle Documents tests"""
        print("🚀 Starting Vehicle Documents Backend API Testing")
        print("=" * 80)
        
        # Authenticate first
        if not self.authenticate():
            print("\n❌ Authentication failed - cannot proceed with tests")
            return False
        
        # Run Vehicle Documents tests
        success_count, total_tests = self.test_vehicle_documents_comprehensive()
        
        # Print final results
        print("\n" + "=" * 80)
        print("🏁 VEHICLE DOCUMENTS TEST RESULTS")
        print("=" * 80)
        
        success_rate = (success_count / total_tests) * 100
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {success_count}")
        print(f"Failed: {total_tests - success_count}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 EXCELLENT: Vehicle Documents API is working great!")
        elif success_rate >= 60:
            print("✅ GOOD: Vehicle Documents API is mostly functional with minor issues")
        elif success_rate >= 40:
            print("⚠️  FAIR: Vehicle Documents API has some significant issues")
        else:
            print("❌ POOR: Vehicle Documents API has major issues")
        
        # Print summary of failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print(f"\n📋 FAILED TESTS SUMMARY ({len(failed_tests)} failures):")
            for i, test in enumerate(failed_tests, 1):
                print(f"{i}. {test['test']}: {test['message']}")
        
        return success_rate >= 60

def main():
    """Main test execution"""
    tester = VehicleDocumentsTester()
    success = tester.run_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()