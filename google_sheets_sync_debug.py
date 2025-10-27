#!/usr/bin/env python3
"""
Google Sheets Sync Debugging Test
Specifically tests the driver onboarding sync to Google Sheets endpoint that's returning 500 error.
"""

import requests
import json
import sys
import traceback
from datetime import datetime

# Configuration
BASE_URL = "https://pulse-cluster.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"

class GoogleSheetsSyncDebugger:
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
        
        if response_data:
            print(f"   Response Data: {json.dumps(response_data, indent=2)}")
    
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
    
    def check_google_sheets_config(self):
        """Check if Google Sheets Web App URL is configured"""
        print("\n=== Checking Google Sheets Configuration ===")
        
        # Check backend .env file for GOOGLE_SHEETS_WEB_APP_URL
        try:
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
                
            if 'GOOGLE_SHEETS_WEB_APP_URL' in env_content:
                # Extract the URL
                for line in env_content.split('\n'):
                    if line.startswith('GOOGLE_SHEETS_WEB_APP_URL'):
                        url = line.split('=', 1)[1].strip()
                        self.log_test("Config Check", True, f"GOOGLE_SHEETS_WEB_APP_URL found: {url}")
                        return True
                        
                self.log_test("Config Check", False, "GOOGLE_SHEETS_WEB_APP_URL found but empty")
                return False
            else:
                self.log_test("Config Check", False, "GOOGLE_SHEETS_WEB_APP_URL not found in .env")
                return False
                
        except Exception as e:
            self.log_test("Config Check", False, f"Error reading .env file: {e}")
            return False
    
    def check_leads_in_database(self):
        """Check if leads exist in database"""
        print("\n=== Checking Leads in Database ===")
        
        response = self.make_request("GET", "/driver-onboarding/leads")
        
        if not response:
            self.log_test("Database Check", False, "Network error getting leads")
            return False
        
        if response.status_code == 200:
            try:
                leads = response.json()
                lead_count = len(leads)
                self.log_test("Database Check", True, f"Found {lead_count} leads in database")
                
                if lead_count > 0:
                    # Show sample lead structure
                    sample_lead = leads[0]
                    sample_fields = {k: v for k, v in sample_lead.items() if k in ['id', 'name', 'phone_number', 'status']}
                    print(f"   Sample lead: {json.dumps(sample_fields, indent=2)}")
                
                return lead_count > 0
            except json.JSONDecodeError:
                self.log_test("Database Check", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Database Check", False, 
                        f"Failed to get leads with status {response.status_code}", response.text)
            return False
    
    def test_sync_endpoint_detailed(self):
        """Test the sync endpoint with detailed error analysis"""
        print("\n=== Testing Sync Endpoint with Detailed Analysis ===")
        
        response = self.make_request("POST", "/driver-onboarding/sync-leads")
        
        if not response:
            self.log_test("Sync Test", False, "Network error during sync request")
            return False
        
        print(f"Response Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 500:
            # Get the full error details
            try:
                error_data = response.json()
                self.log_test("Sync Test - Error Analysis", False, 
                            f"500 Internal Server Error: {error_data.get('detail', 'No detail provided')}", 
                            error_data)
            except json.JSONDecodeError:
                error_text = response.text
                self.log_test("Sync Test - Error Analysis", False, 
                            f"500 Internal Server Error (non-JSON): {error_text[:500]}...")
            
            # Check backend logs for more details
            self.check_backend_logs()
            return False
            
        elif response.status_code == 200:
            try:
                result = response.json()
                self.log_test("Sync Test", True, 
                            f"Sync successful: {result.get('message', 'No message')}", result)
                return True
            except json.JSONDecodeError:
                self.log_test("Sync Test", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("Sync Test", False, 
                        f"Unexpected status code {response.status_code}", response.text)
            return False
    
    def check_backend_logs(self):
        """Check backend logs for error details"""
        print("\n=== Checking Backend Logs ===")
        
        try:
            import subprocess
            
            # Check supervisor backend logs
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and result.stdout.strip():
                print("Backend Error Logs (last 50 lines):")
                print("=" * 50)
                print(result.stdout)
                print("=" * 50)
                
                # Look for specific error patterns
                if "GOOGLE_SHEETS_WEB_APP_URL" in result.stdout:
                    self.log_test("Log Analysis", False, "Google Sheets URL configuration error found in logs")
                elif "ConnectionError" in result.stdout or "timeout" in result.stdout.lower():
                    self.log_test("Log Analysis", False, "Network connectivity error found in logs")
                elif "Traceback" in result.stdout:
                    self.log_test("Log Analysis", False, "Python traceback found in logs - code error")
                else:
                    self.log_test("Log Analysis", True, "No obvious errors found in recent logs")
            else:
                print("No recent error logs found or unable to read logs")
                
        except Exception as e:
            print(f"Error checking logs: {e}")
    
    def test_google_sheets_connectivity(self):
        """Test connectivity to Google Sheets Web App URL"""
        print("\n=== Testing Google Sheets Connectivity ===")
        
        try:
            # Read the URL from .env
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
            
            web_app_url = None
            for line in env_content.split('\n'):
                if line.startswith('GOOGLE_SHEETS_WEB_APP_URL'):
                    web_app_url = line.split('=', 1)[1].strip()
                    break
            
            if not web_app_url:
                self.log_test("Connectivity Test", False, "No Google Sheets Web App URL found")
                return False
            
            # Test basic connectivity
            try:
                test_response = requests.get(web_app_url, timeout=10)
                self.log_test("Connectivity Test", True, 
                            f"Google Sheets Web App reachable (status: {test_response.status_code})")
                return True
            except requests.exceptions.Timeout:
                self.log_test("Connectivity Test", False, "Timeout connecting to Google Sheets Web App")
                return False
            except requests.exceptions.RequestException as e:
                self.log_test("Connectivity Test", False, f"Connection error: {e}")
                return False
                
        except Exception as e:
            self.log_test("Connectivity Test", False, f"Error testing connectivity: {e}")
            return False
    
    def run_debug_session(self):
        """Run complete debugging session"""
        print("🔍 GOOGLE SHEETS SYNC DEBUGGING SESSION")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed")
            return
        
        # Step 2: Check configuration
        config_ok = self.check_google_sheets_config()
        
        # Step 3: Check database
        leads_exist = self.check_leads_in_database()
        
        # Step 4: Test connectivity
        connectivity_ok = self.test_google_sheets_connectivity()
        
        # Step 5: Test the actual sync endpoint
        sync_ok = self.test_sync_endpoint_detailed()
        
        # Summary
        print("\n" + "=" * 60)
        print("🔍 DEBUGGING SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r['success'])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print("\n📋 DETAILED FINDINGS:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        # Recommendations
        print("\n💡 RECOMMENDATIONS:")
        if not config_ok:
            print("- Check GOOGLE_SHEETS_WEB_APP_URL configuration in backend/.env")
        if not leads_exist:
            print("- Import some leads first before testing sync")
        if not connectivity_ok:
            print("- Verify Google Sheets Web App URL is accessible")
        if not sync_ok:
            print("- Check backend logs for detailed error information")
            print("- Verify Google Apps Script permissions and deployment")

if __name__ == "__main__":
    debugger = GoogleSheetsSyncDebugger()
    debugger.run_debug_session()