#!/usr/bin/env python3
"""
Test different actions with Google Sheets Web App to see what's supported
"""

import requests
import json

def test_google_sheets_actions():
    """Test different actions with Google Sheets Web App"""
    web_app_url = "https://script.google.com/macros/s/AKfycbyP7biLOVqWdDFjqDnbD7Owv-nUSmi69ZzzZJFmpijrtj88_uOsIdpyZWaoa3LC0kTD/exec"
    
    test_lead = {
        "id": "test-id-123",
        "name": "Test Lead",
        "phone_number": "1234567890",
        "status": "New"
    }
    
    # Test different actions
    test_cases = [
        {
            "name": "sync_from_app (working)",
            "payload": {
                "action": "sync_from_app",
                "leads": [test_lead]
            }
        },
        {
            "name": "sync_all with leads tab",
            "payload": {
                "action": "sync_all",
                "tab": "leads",
                "records": [test_lead]
            }
        },
        {
            "name": "sync_single with leads tab",
            "payload": {
                "action": "sync_single",
                "tab": "leads",
                "record": test_lead
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\n=== Testing: {test_case['name']} ===")
        
        try:
            response = requests.post(
                web_app_url,
                json=test_case['payload'],
                headers={'Content-Type': 'application/json'},
                timeout=15
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    print(f"Response: {json.dumps(result, indent=2)}")
                except:
                    print(f"Text: {response.text}")
            else:
                print(f"Error: {response.text}")
                
        except requests.exceptions.Timeout:
            print("Request timed out")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_google_sheets_actions()