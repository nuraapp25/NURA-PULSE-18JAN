#!/usr/bin/env python3
"""
Test script for Payment Reconciliation Folders functionality
"""
import requests
import json

# Configuration
BASE_URL = "http://localhost:8000/api"
TEST_USER = {
    "username": "admin",
    "password": "admin123"
}

def login():
    """Login and get token"""
    response = requests.post(f"{BASE_URL}/login", json=TEST_USER)
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.text}")
        return None

def test_folders():
    """Test folder operations"""
    token = login()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Get existing folders
    print("1. Testing GET /payment-reconciliation/folders")
    response = requests.get(f"{BASE_URL}/payment-reconciliation/folders", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        folders = response.json()["folders"]
        print(f"Found {len(folders)} existing folders")
    else:
        print(f"Error: {response.text}")
    
    # Test 2: Create new folder
    print("\n2. Testing POST /payment-reconciliation/folders")
    new_folder = {
        "name": "Dec 2025",
        "month": "12",
        "year": "2025",
        "monthLabel": "Dec",
        "fullName": "December",
        "createdAt": "2025-01-27T10:00:00Z"
    }
    
    response = requests.post(f"{BASE_URL}/payment-reconciliation/folders", 
                           json=new_folder, headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("Folder created successfully!")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"Error: {response.text}")
    
    # Test 3: Get folders again to verify creation
    print("\n3. Verifying folder creation")
    response = requests.get(f"{BASE_URL}/payment-reconciliation/folders", headers=headers)
    if response.status_code == 200:
        folders = response.json()["folders"]
        print(f"Now found {len(folders)} folders")
        for folder in folders:
            print(f"  - {folder['name']} (created by: {folder.get('created_by', 'unknown')})")
    
if __name__ == "__main__":
    test_folders()