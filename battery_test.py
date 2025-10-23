#!/usr/bin/env python3
"""
Direct test for Battery Consumption Analytics endpoint
"""

import requests
import json

BASE_URL = "https://nura-pulse-dash.preview.emergentagent.com/api"

def test_battery_analytics():
    # Login first
    login_data = {"email": "admin", "password": "Nura@1234$"}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code != 200:
        print("❌ Login failed")
        return False
    
    token = response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("✅ Login successful")
    
    # Test cases
    test_cases = [
        {"vehicle_id": "P60G2512500002032", "date": "01 Sep", "expect_data": True},
        {"vehicle_id": "TEST_VEHICLE_001", "date": "15 Aug", "expect_data": False},
        {"vehicle_id": "P60G2512500002032", "date": "02 Sep", "expect_data": False}
    ]
    
    success_count = 0
    
    for i, case in enumerate(test_cases, 1):
        url = f"{BASE_URL}/montra-vehicle/analytics/battery-data?vehicle_id={case['vehicle_id']}&date={case['date']}"
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            
            if case["expect_data"]:
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and "data" in data:
                        print(f"✅ Test {i}: Found {len(data['data'])} rows for {case['vehicle_id']}")
                        success_count += 1
                    else:
                        print(f"❌ Test {i}: Invalid response structure")
                else:
                    print(f"❌ Test {i}: Expected 200, got {response.status_code}")
            else:
                if response.status_code == 404:
                    print(f"✅ Test {i}: Correctly returned 404 for {case['vehicle_id']} (no data)")
                    success_count += 1
                else:
                    print(f"❌ Test {i}: Expected 404, got {response.status_code}")
                    
        except Exception as e:
            print(f"❌ Test {i}: Exception - {e}")
    
    # Test parameter validation
    try:
        response = requests.get(f"{BASE_URL}/montra-vehicle/analytics/battery-data", headers=headers, timeout=10)
        if response.status_code == 422:
            print("✅ Parameter validation: Correctly rejected missing parameters")
            success_count += 1
        else:
            print(f"❌ Parameter validation: Expected 422, got {response.status_code}")
    except Exception as e:
        print(f"❌ Parameter validation: Exception - {e}")
    
    print(f"\nBattery Analytics Test Results: {success_count}/4 passed")
    return success_count >= 3

if __name__ == "__main__":
    test_battery_analytics()