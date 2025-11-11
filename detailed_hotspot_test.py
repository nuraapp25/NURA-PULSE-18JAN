#!/usr/bin/env python3
"""
Detailed Hotspot Planning Test - Get full analysis results
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://telecaller-hub-4.preview.emergentagent.com/api"
MASTER_ADMIN_EMAIL = "admin"
MASTER_ADMIN_PASSWORD = "Nura@1234$"
CSV_FILE_PATH = "/tmp/Book2.csv"

def login():
    """Login and get token"""
    login_data = {
        "email": MASTER_ADMIN_EMAIL,
        "password": MASTER_ADMIN_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    if response.status_code == 200:
        return response.json().get("token")
    return None

def test_hotspot_analysis():
    """Test hotspot analysis and show detailed results"""
    token = login()
    if not token:
        print("❌ Login failed")
        return
    
    print("✅ Login successful")
    
    # Upload and analyze CSV
    headers = {"Authorization": f"Bearer {token}"}
    
    with open(CSV_FILE_PATH, 'rb') as f:
        files = {'file': ('Book2.csv', f.read(), 'text/csv')}
    
    print("\n🔄 Analyzing CSV file...")
    response = requests.post(f"{BASE_URL}/hotspot-planning/analyze", 
                           headers=headers, files=files, timeout=60)
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n✅ Analysis successful!")
        print(f"📊 Total rides analyzed: {data.get('total_rides_analyzed', 0)}")
        print(f"📝 Message: {data.get('message', 'N/A')}")
        
        # Analysis parameters
        params = data.get('analysis_params', {})
        print(f"\n🔧 Analysis Parameters:")
        for key, value in params.items():
            print(f"   {key}: {value}")
        
        # Time slot details
        time_slots = data.get('time_slots', {})
        print(f"\n⏰ Time Slot Analysis:")
        
        total_hotspots = 0
        for slot_name, slot_data in time_slots.items():
            rides_count = slot_data.get('rides_count', 0)
            hotspot_locations = slot_data.get('hotspot_locations', [])
            coverage = slot_data.get('coverage_percentage', 0)
            
            print(f"\n   📍 {slot_name}:")
            print(f"      Rides: {rides_count}")
            print(f"      Hotspots: {len(hotspot_locations)}")
            print(f"      Coverage: {coverage:.1f}%")
            
            total_hotspots += len(hotspot_locations)
            
            # Show first 3 hotspot locations
            if hotspot_locations:
                print(f"      Top hotspot locations:")
                for i, location in enumerate(hotspot_locations[:3]):
                    lat = location.get('lat', 0)
                    lng = location.get('long', 0)
                    rides_assigned = location.get('rides_assigned', 0)
                    locality = location.get('locality', 'Unknown')
                    coverage_pct = location.get('coverage_percentage', 0)
                    
                    print(f"        {i+1}. {locality} ({lat:.4f}, {lng:.4f})")
                    print(f"           Rides: {rides_assigned}, Coverage: {coverage_pct:.1f}%")
        
        print(f"\n📈 Summary:")
        print(f"   Total hotspot locations: {total_hotspots}")
        print(f"   Time slots with data: {len([s for s in time_slots.values() if s.get('rides_count', 0) > 0])}/6")
        
        # Check for issues
        issues = []
        if data.get('total_rides_analyzed', 0) == 0:
            issues.append("No rides were analyzed")
        
        if total_hotspots == 0:
            issues.append("No hotspot locations generated")
        
        if not params:
            issues.append("Analysis parameters missing")
        
        if issues:
            print(f"\n⚠️  Issues found:")
            for issue in issues:
                print(f"   • {issue}")
        else:
            print(f"\n✅ All checks passed - Hotspot analysis working correctly!")
    
    else:
        print(f"❌ Analysis failed: HTTP {response.status_code}")
        try:
            error_data = response.json()
            print(f"   Error: {error_data.get('detail', 'Unknown error')}")
        except:
            print(f"   Response: {response.text}")

if __name__ == "__main__":
    test_hotspot_analysis()