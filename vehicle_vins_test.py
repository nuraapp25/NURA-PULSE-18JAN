#!/usr/bin/env python3
"""
Vehicle VINs Endpoint Testing Script
Tests the /api/montra-vehicle/vins endpoint as requested in review
"""

import requests
import json
import sys
import os
from datetime import datetime

# Configuration
BASE_URL = "https://driver-docs-2.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

class VehicleVINsTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        
    def log_result(self, test_name, success, message, data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        if data and not success:
            print(f"   Response: {data}")
    
    def authenticate(self):
        """Login and get authentication token"""
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
                    self.log_result("Authentication", True, 
                                  f"Login successful. User: {user_info.get('first_name', 'Unknown')}")
                    return True
                else:
                    self.log_result("Authentication", False, "No token in response", data)
                    return False
            else:
                self.log_result("Authentication", False, 
                              f"Login failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Authentication", False, f"Network error: {e}")
            return False
    
    def test_vehicle_vins_endpoint(self):
        """Test the Vehicle VINs endpoint comprehensively"""
        print("\n🚗 Testing Vehicle VINs Endpoint (/api/montra-vehicle/vins)")
        print("=" * 60)
        
        success_count = 0
        total_tests = 0
        
        # Test 1: Authentication requirement
        print("\n--- Test 1: Authentication Requirement ---")
        try:
            response = requests.get(f"{self.base_url}/montra-vehicle/vins", timeout=10)
            
            if response.status_code in [401, 403]:
                self.log_result("Authentication Required", True, 
                              f"Correctly requires authentication ({response.status_code})")
                success_count += 1
            else:
                self.log_result("Authentication Required", False, 
                              f"Expected 401/403, got {response.status_code}")
        except Exception as e:
            self.log_result("Authentication Required", False, f"Network error: {e}")
        
        total_tests += 1
        
        # Test 2: Valid request with authentication
        print("\n--- Test 2: Valid Request with Authentication ---")
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{self.base_url}/montra-vehicle/vins", headers=headers, timeout=10)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    # Check response structure
                    required_fields = ["success", "vehicles", "count"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        self.log_result("Response Structure", True, 
                                      "Response contains all required fields")
                        success_count += 1
                        
                        # Check success field
                        if data.get("success") == True:
                            self.log_result("Success Status", True, "Response success=True")
                            success_count += 1
                        else:
                            self.log_result("Success Status", False, 
                                          f"Expected success=True, got {data.get('success')}")
                        
                        # Check vehicles array
                        vehicles = data.get("vehicles", [])
                        if isinstance(vehicles, list):
                            self.log_result("Vehicles Array", True, 
                                          f"vehicles is array with {len(vehicles)} items")
                            success_count += 1
                            
                            # Check count accuracy
                            count = data.get("count", -1)
                            if count == len(vehicles):
                                self.log_result("Count Accuracy", True, 
                                              f"Count ({count}) matches array length")
                                success_count += 1
                            else:
                                self.log_result("Count Accuracy", False, 
                                              f"Count mismatch: {count} vs {len(vehicles)}")
                            
                            # Test vehicle structure
                            if len(vehicles) > 0:
                                print(f"\n📋 First 3 vehicles from response:")
                                for i, vehicle in enumerate(vehicles[:3]):
                                    print(f"  Vehicle {i+1}: {vehicle}")
                                
                                # Check required fields
                                sample_vehicle = vehicles[0]
                                required_fields = ["registration_number", "vin", "vehicle_name"]
                                missing_fields = [f for f in required_fields if f not in sample_vehicle]
                                
                                if not missing_fields:
                                    self.log_result("Vehicle Structure", True, 
                                                  "Vehicle objects have all required fields")
                                    success_count += 1
                                    
                                    # Check VIN vs registration
                                    reg_number = sample_vehicle.get("registration_number", "")
                                    vin = sample_vehicle.get("vin", "")
                                    
                                    print(f"\n📊 Sample Vehicle Data:")
                                    print(f"  Registration Number: {reg_number}")
                                    print(f"  VIN: {vin}")
                                    print(f"  Vehicle Name: {sample_vehicle.get('vehicle_name', '')}")
                                    
                                    if vin != reg_number and vin.strip() != "":
                                        self.log_result("VIN Field Populated", True, 
                                                      f"VIN contains actual VIN data: '{vin[:20]}...'")
                                        success_count += 1
                                    elif vin == reg_number:
                                        self.log_result("VIN Field Populated", False, 
                                                      "VIN same as registration (Column C may be empty)")
                                    else:
                                        self.log_result("VIN Field Populated", False, 
                                                      "VIN field is empty")
                                else:
                                    self.log_result("Vehicle Structure", False, 
                                                  f"Missing fields: {missing_fields}")
                            else:
                                self.log_result("Vehicle Structure", True, 
                                              "No vehicles (empty response)")
                                success_count += 1
                                
                                # Check empty response message
                                message = data.get("message", "")
                                if "No vehicles found" in message or "upload Vehicles List.xlsx" in message:
                                    self.log_result("Empty Response Message", True, 
                                                  f"Informative message: '{message}'")
                                    success_count += 1
                                else:
                                    self.log_result("Empty Response Message", False, 
                                                  "No informative message for empty response")
                        else:
                            self.log_result("Vehicles Array", False, 
                                          f"vehicles not an array: {type(vehicles)}")
                    else:
                        self.log_result("Response Structure", False, 
                                      f"Missing fields: {missing_fields}")
                        
                except json.JSONDecodeError:
                    self.log_result("Valid Request", False, "Invalid JSON response", response.text)
            else:
                self.log_result("Valid Request", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Valid Request", False, f"Network error: {e}")
        
        total_tests += 8  # Multiple sub-tests
        
        # Test 3: Check Excel file existence and structure
        print("\n--- Test 3: Excel File Verification ---")
        try:
            vehicles_file_path = "/app/backend/uploaded_files/1e0860b7-a35b-4813-aa25-15523b6f22e7_Vehicles List.xlsx"
            
            if os.path.exists(vehicles_file_path):
                self.log_result("Excel File Exists", True, 
                              f"Vehicles List.xlsx found")
                success_count += 1
                
                # Try to read the file
                try:
                    import pandas as pd
                    excel_file = pd.ExcelFile(vehicles_file_path)
                    sheet_names = excel_file.sheet_names
                    
                    self.log_result("Excel File Readable", True, 
                                  f"File readable with {len(sheet_names)} sheets")
                    success_count += 1
                    
                    # Check current month sheet
                    now = datetime.now()
                    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                    current_month = month_names[now.month - 1]
                    current_year = str(now.year)
                    expected_tab = f"{current_month} {current_year}"
                    
                    print(f"📅 Looking for current month tab: '{expected_tab}'")
                    print(f"📋 Available sheets: {sheet_names}")
                    
                    if expected_tab in sheet_names:
                        self.log_result("Current Month Tab", True, 
                                      f"Tab '{expected_tab}' exists")
                        success_count += 1
                        
                        # Read the tab data
                        try:
                            df = pd.read_excel(vehicles_file_path, sheet_name=expected_tab, header=None)
                            
                            if len(df.columns) >= 3:
                                col_b_data = df.iloc[1:, 1].dropna()  # Column B (registration)
                                col_c_data = df.iloc[1:, 2].dropna()  # Column C (VIN)
                                
                                self.log_result("Column B and C Data", True, 
                                              f"Column B: {len(col_b_data)} entries, Column C: {len(col_c_data)} entries")
                                success_count += 1
                                
                                # Show sample data from Excel
                                if len(col_b_data) > 0:
                                    print(f"\n📊 Sample Data from Excel File:")
                                    for i in range(min(3, len(df) - 1)):
                                        reg_num = str(df.iloc[i+1, 1]) if pd.notna(df.iloc[i+1, 1]) else ""
                                        vin_num = str(df.iloc[i+1, 2]) if pd.notna(df.iloc[i+1, 2]) else ""
                                        print(f"  Row {i+2}: Registration='{reg_num}', VIN='{vin_num}'")
                            else:
                                self.log_result("Column B and C Data", False, 
                                              f"Only {len(df.columns)} columns, need at least 3")
                        except Exception as e:
                            self.log_result("Column B and C Data", False, 
                                          f"Error reading Excel data: {str(e)}")
                    else:
                        self.log_result("Current Month Tab", False, 
                                      f"Tab '{expected_tab}' not found")
                        
                except Exception as e:
                    self.log_result("Excel File Readable", False, 
                                  f"Error reading Excel: {str(e)}")
            else:
                self.log_result("Excel File Exists", False, 
                              "Vehicles List.xlsx not found")
                
        except Exception as e:
            self.log_result("Excel File Check", False, f"Error: {str(e)}")
        
        total_tests += 4
        
        # Print summary
        print(f"\n📊 TEST SUMMARY")
        print("=" * 40)
        print(f"Passed: {success_count}/{total_tests}")
        print(f"Success Rate: {(success_count/total_tests)*100:.1f}%")
        
        if success_count >= total_tests * 0.7:
            print("✅ Vehicle VINs endpoint is working well!")
        elif success_count >= total_tests * 0.5:
            print("⚠️  Vehicle VINs endpoint has some issues")
        else:
            print("❌ Vehicle VINs endpoint has major issues")
        
        return success_count >= total_tests * 0.5

def main():
    """Main test execution"""
    print("🚗 Vehicle VINs Endpoint Testing")
    print("=" * 50)
    
    tester = VehicleVINsTester()
    
    # Authenticate first
    if not tester.authenticate():
        print("❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run the Vehicle VINs tests
    success = tester.test_vehicle_vins_endpoint()
    
    if success:
        print("\n🎉 Vehicle VINs endpoint testing completed successfully!")
        sys.exit(0)
    else:
        print("\n🚨 Vehicle VINs endpoint testing failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()