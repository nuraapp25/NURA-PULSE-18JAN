#!/usr/bin/env python3
"""
Hotspot Planning Test for User's CSV File (Book2.csv)
Tests the POST /api/hotspot-planning/analyze endpoint with the user-provided CSV file
"""

import requests
import json
import sys
from datetime import datetime
import os

# Configuration
BASE_URL = "https://leadtracker-39.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"
CSV_FILE_PATH = "/tmp/Book2.csv"

class HotspotPlanningTester:
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
                    response = requests.post(url, headers=headers, files=files, data=data, timeout=60)
                else:
                    headers["Content-Type"] = "application/json"
                    response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                headers["Content-Type"] = "application/json"
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            return response
        except requests.exceptions.Timeout:
            self.log_test(f"{method} {endpoint}", False, "Request timed out")
            return None
        except requests.exceptions.RequestException as e:
            self.log_test(f"{method} {endpoint}", False, f"Request failed: {str(e)}")
            return None
    
    def login(self):
        """Login as Master Admin"""
        print("\n=== Master Admin Login ===")
        
        login_data = {
            "email": MASTER_ADMIN_EMAIL,
            "password": MASTER_ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", data=login_data, use_auth=False)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                self.token = data.get("token")
                user_info = data.get("user", {})
                
                if self.token:
                    self.log_test("Master Admin Login", True, 
                                f"Successfully logged in as {user_info.get('first_name', 'Master Admin')} ({user_info.get('account_type', 'Unknown')})")
                    return True
                else:
                    self.log_test("Master Admin Login", False, "No token received", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("Master Admin Login", False, "Invalid JSON response", response.text)
                return False
        else:
            error_msg = "Unknown error"
            if response:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("detail", f"HTTP {response.status_code}")
                except:
                    error_msg = f"HTTP {response.status_code}"
            
            self.log_test("Master Admin Login", False, f"Login failed: {error_msg}")
            return False
    
    def check_csv_file(self):
        """Check if the CSV file exists and get basic info"""
        print("\n=== CSV File Verification ===")
        
        if not os.path.exists(CSV_FILE_PATH):
            self.log_test("CSV File Check", False, f"CSV file not found at {CSV_FILE_PATH}")
            return False
        
        try:
            file_size = os.path.getsize(CSV_FILE_PATH)
            
            # Read first few lines to check format
            with open(CSV_FILE_PATH, 'r') as f:
                first_line = f.readline().strip()
                second_line = f.readline().strip()
                
                # Count total lines
                f.seek(0)
                line_count = sum(1 for line in f) - 1  # Subtract header
            
            self.log_test("CSV File Check", True, 
                        f"CSV file found - Size: {file_size} bytes, Rows: {line_count}")
            
            # Check if required columns exist
            required_columns = ['pickupLat', 'pickupLong', 'dropLat', 'dropLong', 'createdAt', 'updatedAt']
            header_columns = first_line.split(',')
            
            missing_columns = []
            for col in required_columns:
                if col not in header_columns:
                    missing_columns.append(col)
            
            if missing_columns:
                self.log_test("CSV Column Check", False, 
                            f"Missing required columns: {missing_columns}")
                return False
            else:
                self.log_test("CSV Column Check", True, 
                            f"All required columns present: {required_columns}")
            
            # Show sample data
            print(f"   Header: {first_line}")
            print(f"   Sample: {second_line}")
            
            return True
            
        except Exception as e:
            self.log_test("CSV File Check", False, f"Error reading CSV file: {str(e)}")
            return False
    
    def test_hotspot_analyze_endpoint(self):
        """Test the POST /api/hotspot-planning/analyze endpoint with Book2.csv"""
        print("\n=== Testing Hotspot Planning Analyze Endpoint ===")
        
        success_count = 0
        
        # Test 1: Authentication Required
        print("\n--- Test 1: Authentication Required ---")
        try:
            with open(CSV_FILE_PATH, 'rb') as f:
                csv_content = f.read()
            
            files = {'file': ('Book2.csv', csv_content, 'text/csv')}
            response = self.make_request("POST", "/hotspot-planning/analyze", files=files, use_auth=False)
            
            if response and response.status_code == 403:
                self.log_test("Authentication Required", True, 
                            "Correctly requires authentication (403 Forbidden)")
                success_count += 1
            else:
                self.log_test("Authentication Required", False, 
                            f"Expected 403, got {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("Authentication Required", False, f"Error: {str(e)}")
        
        # Test 2: Successful CSV Analysis
        print("\n--- Test 2: CSV Analysis with Authentication ---")
        try:
            with open(CSV_FILE_PATH, 'rb') as f:
                csv_content = f.read()
            
            files = {'file': ('Book2.csv', csv_content, 'text/csv')}
            response = self.make_request("POST", "/hotspot-planning/analyze", files=files)
            
            if response and response.status_code == 200:
                try:
                    data = response.json()
                    
                    # Check basic response structure
                    if data.get("success"):
                        total_rides = data.get("total_rides_analyzed", 0)
                        self.log_test("CSV Analysis Success", True, 
                                    f"Successfully analyzed {total_rides} rides from Book2.csv")
                        success_count += 1
                        
                        # Test 3: Response Structure Validation
                        print("\n--- Test 3: Response Structure Validation ---")
                        required_fields = ["success", "total_rides_analyzed", "time_slots", "analysis_params", "message"]
                        missing_fields = [field for field in required_fields if field not in data]
                        
                        if not missing_fields:
                            self.log_test("Response Structure", True, 
                                        f"All required fields present: {required_fields}")
                            success_count += 1
                        else:
                            self.log_test("Response Structure", False, 
                                        f"Missing required fields: {missing_fields}")
                        
                        # Test 4: Time Slot Analysis
                        print("\n--- Test 4: Time Slot Analysis ---")
                        time_slots = data.get("time_slots", {})
                        expected_slots = ["Morning Rush", "Mid-Morning", "Afternoon", "Evening Rush", "Night", "Late Night"]
                        
                        slots_with_data = 0
                        total_hotspots = 0
                        
                        for slot_name in expected_slots:
                            if slot_name in time_slots:
                                slot_data = time_slots[slot_name]
                                rides_count = slot_data.get("rides_count", 0)
                                hotspot_locations = slot_data.get("hotspot_locations", [])
                                coverage = slot_data.get("coverage_percentage", 0)
                                
                                if rides_count > 0:
                                    slots_with_data += 1
                                    total_hotspots += len(hotspot_locations)
                                    
                                    print(f"   {slot_name}: {rides_count} rides, {len(hotspot_locations)} hotspots, {coverage:.1f}% coverage")
                        
                        if slots_with_data > 0:
                            self.log_test("Time Slot Analysis", True, 
                                        f"{slots_with_data}/6 time slots have data, {total_hotspots} total hotspots")
                            success_count += 1
                        else:
                            self.log_test("Time Slot Analysis", False, 
                                        "No time slots contain ride data")
                        
                        # Test 5: Hotspot Location Structure
                        print("\n--- Test 5: Hotspot Location Structure ---")
                        sample_location = None
                        sample_slot = None
                        
                        for slot_name, slot_data in time_slots.items():
                            hotspot_locations = slot_data.get("hotspot_locations", [])
                            if hotspot_locations:
                                sample_location = hotspot_locations[0]
                                sample_slot = slot_name
                                break
                        
                        if sample_location:
                            required_location_fields = ["lat", "long", "rides_assigned", "rides_within_5min", "coverage_percentage", "locality"]
                            missing_location_fields = [field for field in required_location_fields if field not in sample_location]
                            
                            if not missing_location_fields:
                                self.log_test("Hotspot Location Structure", True, 
                                            f"All required location fields present: {required_location_fields}")
                                success_count += 1
                                
                                # Show sample location data
                                print(f"   Sample location from {sample_slot}:")
                                print(f"     Coordinates: ({sample_location.get('lat')}, {sample_location.get('long')})")
                                print(f"     Rides assigned: {sample_location.get('rides_assigned')}")
                                print(f"     Coverage: {sample_location.get('coverage_percentage')}%")
                                print(f"     Locality: {sample_location.get('locality')}")
                            else:
                                self.log_test("Hotspot Location Structure", False, 
                                            f"Missing location fields: {missing_location_fields}")
                        else:
                            self.log_test("Hotspot Location Structure", False, 
                                        "No hotspot locations found to validate structure")
                        
                        # Test 6: Geographic Filter (Chennai Bounds)
                        print("\n--- Test 6: Geographic Filter Validation ---")
                        chennai_bounds = {
                            "lat_min": 12.8,
                            "lat_max": 13.3,
                            "long_min": 80.0,
                            "long_max": 80.4
                        }
                        
                        locations_in_bounds = 0
                        locations_out_of_bounds = 0
                        out_of_bounds_locations = []
                        
                        for slot_name, slot_data in time_slots.items():
                            for location in slot_data.get("hotspot_locations", []):
                                lat = location.get("lat")
                                long = location.get("long")
                                
                                if (chennai_bounds["lat_min"] <= lat <= chennai_bounds["lat_max"] and 
                                    chennai_bounds["long_min"] <= long <= chennai_bounds["long_max"]):
                                    locations_in_bounds += 1
                                else:
                                    locations_out_of_bounds += 1
                                    out_of_bounds_locations.append({
                                        "slot": slot_name,
                                        "lat": lat,
                                        "long": long,
                                        "locality": location.get("locality", "Unknown")
                                    })
                        
                        total_locations = locations_in_bounds + locations_out_of_bounds
                        
                        if total_locations > 0:
                            bounds_percentage = (locations_in_bounds / total_locations) * 100
                            
                            if bounds_percentage >= 90:  # Allow some tolerance
                                self.log_test("Geographic Filter", True, 
                                            f"{locations_in_bounds}/{total_locations} locations within Chennai bounds ({bounds_percentage:.1f}%)")
                                success_count += 1
                            else:
                                self.log_test("Geographic Filter", False, 
                                            f"Only {locations_in_bounds}/{total_locations} locations within Chennai bounds ({bounds_percentage:.1f}%)")
                                
                                # Show some out-of-bounds locations
                                if out_of_bounds_locations:
                                    print("   Out-of-bounds locations:")
                                    for loc in out_of_bounds_locations[:3]:
                                        print(f"     {loc['slot']}: ({loc['lat']}, {loc['long']}) - {loc['locality']}")
                        else:
                            self.log_test("Geographic Filter", False, 
                                        "No locations found to validate geographic bounds")
                        
                        # Test 7: Analysis Parameters
                        print("\n--- Test 7: Analysis Parameters ---")
                        analysis_params = data.get("analysis_params", {})
                        expected_params = ["max_distance", "speed", "max_locations"]
                        
                        params_present = all(param in analysis_params for param in expected_params)
                        
                        if params_present:
                            max_distance = analysis_params.get("max_distance")
                            speed = analysis_params.get("speed")
                            max_locations = analysis_params.get("max_locations")
                            
                            self.log_test("Analysis Parameters", True, 
                                        f"Parameters: max_distance={max_distance}km, speed={speed}km/h, max_locations={max_locations}")
                            success_count += 1
                        else:
                            missing_params = [param for param in expected_params if param not in analysis_params]
                            self.log_test("Analysis Parameters", False, 
                                        f"Missing analysis parameters: {missing_params}")
                        
                        # Test 8: Locality Names Validation
                        print("\n--- Test 8: Locality Names Validation ---")
                        localities_found = []
                        unknown_localities = 0
                        
                        for slot_name, slot_data in time_slots.items():
                            for location in slot_data.get("hotspot_locations", []):
                                locality = location.get("locality", "Unknown")
                                if locality and locality != "Unknown":
                                    localities_found.append(locality)
                                else:
                                    unknown_localities += 1
                        
                        unique_localities = list(set(localities_found))
                        
                        if len(unique_localities) > 0:
                            locality_success_rate = (len(localities_found) / (len(localities_found) + unknown_localities)) * 100
                            self.log_test("Locality Names", True, 
                                        f"Found {len(unique_localities)} unique localities, {locality_success_rate:.1f}% success rate")
                            success_count += 1
                            
                            # Show sample localities
                            print(f"   Sample localities: {unique_localities[:5]}")
                        else:
                            self.log_test("Locality Names", False, 
                                        f"No valid locality names found, {unknown_localities} unknown localities")
                    
                    else:
                        self.log_test("CSV Analysis Success", False, 
                                    f"Analysis failed: {data.get('message', 'Unknown error')}", data)
                
                except json.JSONDecodeError:
                    self.log_test("CSV Analysis Success", False, 
                                "Invalid JSON response", response.text)
            
            else:
                error_msg = "Unknown error"
                if response:
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("detail", f"HTTP {response.status_code}")
                    except:
                        error_msg = f"HTTP {response.status_code}"
                
                self.log_test("CSV Analysis Success", False, f"Analysis failed: {error_msg}")
        
        except Exception as e:
            self.log_test("CSV Analysis Success", False, f"Error during analysis: {str(e)}")
        
        return success_count
    
    def check_backend_logs(self):
        """Check backend logs for any errors during processing"""
        print("\n=== Backend Logs Check ===")
        
        try:
            # Check supervisor backend logs
            import subprocess
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                log_content = result.stdout.strip()
                if log_content:
                    # Look for recent errors
                    lines = log_content.split('\n')
                    recent_errors = [line for line in lines if 'ERROR' in line or 'Exception' in line]
                    
                    if recent_errors:
                        self.log_test("Backend Logs", False, 
                                    f"Found {len(recent_errors)} recent errors in backend logs")
                        for error in recent_errors[-3:]:  # Show last 3 errors
                            print(f"   {error}")
                    else:
                        self.log_test("Backend Logs", True, 
                                    "No recent errors found in backend logs")
                else:
                    self.log_test("Backend Logs", True, 
                                "Backend error log is empty")
            else:
                self.log_test("Backend Logs", False, 
                            "Could not read backend error logs")
        
        except Exception as e:
            self.log_test("Backend Logs", False, f"Error checking logs: {str(e)}")
    
    def run_all_tests(self):
        """Run all hotspot planning tests"""
        print("🚀 Starting Hotspot Planning Tests for Book2.csv")
        print("=" * 60)
        
        # Step 1: Check CSV file
        if not self.check_csv_file():
            print("\n❌ CSV file check failed. Cannot proceed with tests.")
            return
        
        # Step 2: Login
        if not self.login():
            print("\n❌ Login failed. Cannot proceed with tests.")
            return
        
        # Step 3: Test hotspot analyze endpoint
        success_count = self.test_hotspot_analyze_endpoint()
        
        # Step 4: Check backend logs
        self.check_backend_logs()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['message']}")
        
        # Show successful tests
        successful_tests = [result for result in self.test_results if result["success"]]
        if successful_tests:
            print(f"\n✅ SUCCESSFUL TESTS ({len(successful_tests)}):")
            for test in successful_tests:
                print(f"   • {test['test']}: {test['message']}")

if __name__ == "__main__":
    tester = HotspotPlanningTester()
    tester.run_all_tests()