#!/usr/bin/env python3
"""
Battery Charge Audit Report Generator
Displays all instances where vehicle charge dropped below 20% between 7 AM and 7 PM
"""

import requests
import os
from dotenv import load_dotenv
from tabulate import tabulate

# Load environment variables
load_dotenv()

# Configuration
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://charge-tracker-3.preview.emergentagent.com/api')
LOGIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin')
LOGIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'Nura@1234$')

def get_auth_token():
    """Login and get authentication token"""
    try:
        response = requests.post(
            f'{BACKEND_URL}/auth/login',
            json={'email': LOGIN_EMAIL, 'password': LOGIN_PASSWORD}
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('token') or data.get('access_token')
        else:
            print(f"Login failed: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return None

def get_battery_audit(token):
    """Fetch battery audit data from API"""
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(
            f'{BACKEND_URL}/montra-vehicle/battery-audit',
            headers=headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"API request failed: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Error fetching audit data: {str(e)}")
        return None

def display_audit_report(audit_data):
    """Display audit data in a formatted table"""
    if not audit_data or not audit_data.get('success'):
        print("❌ Failed to retrieve audit data")
        return
    
    results = audit_data.get('audit_results', [])
    count = audit_data.get('count', 0)
    message = audit_data.get('message', '')
    
    print("\n" + "="*80)
    print("🔋 BATTERY CHARGE AUDIT REPORT")
    print("   Low Charge Instances (<20%) Between 7 AM - 7 PM")
    print("="*80 + "\n")
    
    if count == 0:
        print("ℹ️  " + message)
        print("\nNo instances found where battery dropped below 20% during operational hours.")
        print("\n💡 Tip: Import Montra vehicle feed data to generate audit reports.")
    else:
        print(f"📊 {message}\n")
        
        # Prepare table data
        table_data = []
        for item in results:
            table_data.append([
                item.get('date', 'N/A'),
                item.get('vehicle_name', 'N/A'),
                item.get('timestamp', 'N/A'),
                f"{item.get('battery_percentage', 'N/A')}%",
                item.get('km_driven_upto_point', 'N/A')
            ])
        
        # Display table
        headers = ['Date', 'Vehicle Name', 'Timestamp', 'Battery %', 'KM Driven (from start of day)']
        print(tabulate(table_data, headers=headers, tablefmt='grid'))
        print(f"\n✅ Total Instances: {count}")
    
    print("\n" + "="*80 + "\n")

def main():
    """Main execution function"""
    print("🔄 Generating Battery Charge Audit Report...")
    
    # Step 1: Authenticate
    token = get_auth_token()
    if not token:
        print("❌ Authentication failed. Cannot proceed.")
        return
    
    # Step 2: Fetch audit data
    audit_data = get_battery_audit(token)
    if not audit_data:
        print("❌ Failed to fetch audit data.")
        return
    
    # Step 3: Display report
    display_audit_report(audit_data)

if __name__ == "__main__":
    main()
