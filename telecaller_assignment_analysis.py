#!/usr/bin/env python3
"""
Telecaller Assignment Analysis - Diagnose the assignment issue
This script will analyze how telecaller assignments are stored and test both user ID and email filtering
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://driver-docs-2.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin"
ADMIN_PASSWORD = "Nura@1234$"

class TelecallerAssignmentAnalyzer:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        
    def make_request(self, method, endpoint, data=None, params=None, use_auth=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if use_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                headers["Content-Type"] = "application/json"
                response = requests.post(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            return response
        except Exception as e:
            print(f"Request error for {method} {url}: {e}")
            return None
    
    def login(self):
        """Login as admin"""
        login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        response = self.make_request("POST", "/auth/login", login_data, use_auth=False)
        
        if response and response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            print("✅ Admin login successful")
            return True
        else:
            print("❌ Admin login failed")
            return False
    
    def analyze_telecaller_assignments(self):
        """Analyze how telecaller assignments are stored in the database"""
        print("\n🔍 ANALYZING TELECALLER ASSIGNMENTS")
        print("=" * 60)
        
        # Get all users
        response = self.make_request("GET", "/users")
        if not response or response.status_code != 200:
            print("❌ Failed to get users")
            return
        
        users = response.json()
        print(f"📊 Found {len(users)} users in system")
        
        # Create mapping of email to user info
        email_to_user = {}
        user_id_to_user = {}
        for user in users:
            email = user.get('email')
            user_id = user.get('id')
            name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            
            if email:
                email_to_user[email] = {'id': user_id, 'name': name, 'account_type': user.get('account_type')}
            if user_id:
                user_id_to_user[user_id] = {'email': email, 'name': name, 'account_type': user.get('account_type')}
        
        # Get all leads
        response = self.make_request("GET", "/driver-onboarding/leads")
        if not response or response.status_code != 200:
            print("❌ Failed to get leads")
            return
        
        leads = response.json()
        print(f"📊 Found {len(leads)} leads in system")
        
        # Analyze assignment patterns
        assignment_by_email = {}
        assignment_by_user_id = {}
        leads_with_telecaller_name = 0
        sample_leads = []
        
        for lead in leads:
            assigned_telecaller = lead.get('assigned_telecaller')
            assigned_telecaller_name = lead.get('assigned_telecaller_name')
            
            if assigned_telecaller:
                # Check if it's an email or user ID
                if '@' in assigned_telecaller:
                    # It's an email
                    assignment_by_email[assigned_telecaller] = assignment_by_email.get(assigned_telecaller, 0) + 1
                else:
                    # It's likely a user ID or name
                    assignment_by_user_id[assigned_telecaller] = assignment_by_user_id.get(assigned_telecaller, 0) + 1
            
            if assigned_telecaller_name:
                leads_with_telecaller_name += 1
            
            # Collect sample leads for detailed analysis
            if len(sample_leads) < 10 and assigned_telecaller:
                sample_leads.append({
                    'id': lead.get('id'),
                    'name': lead.get('name'),
                    'assigned_telecaller': assigned_telecaller,
                    'assigned_telecaller_name': assigned_telecaller_name
                })
        
        print(f"\n📈 ASSIGNMENT ANALYSIS:")
        print(f"   Leads with assigned_telecaller_name field: {leads_with_telecaller_name}/{len(leads)}")
        
        print(f"\n📧 ASSIGNMENTS BY EMAIL ({len(assignment_by_email)} unique emails):")
        for email, count in sorted(assignment_by_email.items(), key=lambda x: x[1], reverse=True):
            user_info = email_to_user.get(email, {})
            name = user_info.get('name', 'Unknown')
            print(f"   {email} ({name}): {count} leads")
        
        print(f"\n🆔 ASSIGNMENTS BY USER ID/NAME ({len(assignment_by_user_id)} unique IDs):")
        for identifier, count in sorted(assignment_by_user_id.items(), key=lambda x: x[1], reverse=True):
            user_info = user_id_to_user.get(identifier, {})
            if user_info:
                print(f"   {identifier} ({user_info.get('name', 'Unknown')}): {count} leads")
            else:
                print(f"   {identifier} (Name/Unknown ID): {count} leads")
        
        print(f"\n📋 SAMPLE LEAD ASSIGNMENTS:")
        for i, lead in enumerate(sample_leads[:5], 1):
            print(f"   {i}. Lead: {lead['name']}")
            print(f"      assigned_telecaller: '{lead['assigned_telecaller']}'")
            print(f"      assigned_telecaller_name: '{lead['assigned_telecaller_name']}'")
        
        # Focus on Genelia
        genelia_email = "praylovemusic@gmail.com"
        genelia_user_id = "e25f3297-1252-48b1-8b20-36db996c52e0"
        
        genelia_by_email = assignment_by_email.get(genelia_email, 0)
        genelia_by_user_id = assignment_by_user_id.get(genelia_user_id, 0)
        
        print(f"\n🎯 GENELIA'S ASSIGNMENTS:")
        print(f"   By Email ({genelia_email}): {genelia_by_email} leads")
        print(f"   By User ID ({genelia_user_id}): {genelia_by_user_id} leads")
        
        return genelia_email, genelia_user_id, genelia_by_email, genelia_by_user_id
    
    def test_telecaller_filters(self, genelia_email, genelia_user_id):
        """Test telecaller filters with both email and user ID"""
        print(f"\n🧪 TESTING TELECALLER FILTERS")
        print("=" * 60)
        
        # Test 1: Filter by email
        print(f"\n📧 Testing filter with email: {genelia_email}")
        params = {"telecaller": genelia_email}
        response = self.make_request("GET", "/driver-onboarding/leads", params=params)
        
        if response and response.status_code == 200:
            leads_by_email = response.json()
            print(f"   ✅ Filter by email returned {len(leads_by_email)} leads")
            
            # Verify all leads have correct assignment
            correct_assignments = 0
            for lead in leads_by_email:
                if lead.get('assigned_telecaller') == genelia_email:
                    correct_assignments += 1
            
            print(f"   📊 {correct_assignments}/{len(leads_by_email)} leads have correct email assignment")
            
            # Check telecaller_name field
            leads_with_name = sum(1 for lead in leads_by_email if lead.get('assigned_telecaller_name'))
            print(f"   📝 {leads_with_name}/{len(leads_by_email)} leads have assigned_telecaller_name populated")
            
            if len(leads_by_email) > 0:
                sample_name = leads_by_email[0].get('assigned_telecaller_name')
                print(f"   👤 Sample telecaller name: '{sample_name}'")
        else:
            print(f"   ❌ Filter by email failed: {response.status_code if response else 'Network error'}")
        
        # Test 2: Filter by user ID
        print(f"\n🆔 Testing filter with user ID: {genelia_user_id}")
        params = {"telecaller": genelia_user_id}
        response = self.make_request("GET", "/driver-onboarding/leads", params=params)
        
        if response and response.status_code == 200:
            leads_by_user_id = response.json()
            print(f"   ✅ Filter by user ID returned {len(leads_by_user_id)} leads")
            
            # Verify all leads have correct assignment
            correct_assignments = 0
            for lead in leads_by_user_id:
                if lead.get('assigned_telecaller') == genelia_user_id:
                    correct_assignments += 1
            
            print(f"   📊 {correct_assignments}/{len(leads_by_user_id)} leads have correct user ID assignment")
        else:
            print(f"   ❌ Filter by user ID failed: {response.status_code if response else 'Network error'}")
        
        # Test 3: Check if backend supports both formats
        print(f"\n🔄 TESTING BACKEND FILTER LOGIC")
        
        # Get a few leads assigned to Genelia by email to see their structure
        params = {"telecaller": genelia_email}
        response = self.make_request("GET", "/driver-onboarding/leads", params=params)
        
        if response and response.status_code == 200:
            email_leads = response.json()
            if len(email_leads) > 0:
                sample_lead = email_leads[0]
                print(f"   📋 Sample lead structure:")
                print(f"      ID: {sample_lead.get('id')}")
                print(f"      Name: {sample_lead.get('name')}")
                print(f"      assigned_telecaller: '{sample_lead.get('assigned_telecaller')}'")
                print(f"      assigned_telecaller_name: '{sample_lead.get('assigned_telecaller_name')}'")
    
    def run_analysis(self):
        """Run complete telecaller assignment analysis"""
        print("🔍 TELECALLER ASSIGNMENT ANALYSIS")
        print("=" * 60)
        print("Analyzing how telecaller assignments are stored and filtered")
        print("=" * 60)
        
        if not self.login():
            return False
        
        genelia_email, genelia_user_id, email_count, user_id_count = self.analyze_telecaller_assignments()
        
        self.test_telecaller_filters(genelia_email, genelia_user_id)
        
        print(f"\n📋 SUMMARY & DIAGNOSIS")
        print("=" * 60)
        print(f"🎯 GENELIA'S LEAD ASSIGNMENTS:")
        print(f"   By Email: {email_count} leads")
        print(f"   By User ID: {user_id_count} leads")
        
        if email_count > 0 and user_id_count == 0:
            print(f"\n❌ ISSUE IDENTIFIED:")
            print(f"   Genelia's leads are assigned using EMAIL ({genelia_email})")
            print(f"   But the telecaller filter expects USER ID ({genelia_user_id})")
            print(f"   This is why Genelia can't see her assigned leads in Telecaller's Desk")
            
            print(f"\n💡 SOLUTION REQUIRED:")
            print(f"   1. Update lead assignments to use user IDs instead of emails, OR")
            print(f"   2. Update telecaller filter to support both email and user ID lookup, OR")
            print(f"   3. Add a mapping layer to convert between email and user ID")
            
            return False
        elif email_count == 0 and user_id_count > 0:
            print(f"\n✅ ASSIGNMENTS CORRECT:")
            print(f"   Genelia's leads are properly assigned using user ID")
            print(f"   Telecaller filter should work correctly")
            return True
        elif email_count > 0 and user_id_count > 0:
            print(f"\n⚠️  MIXED ASSIGNMENTS:")
            print(f"   Some leads use email, some use user ID")
            print(f"   This inconsistency needs to be resolved")
            return False
        else:
            print(f"\n❌ NO ASSIGNMENTS FOUND:")
            print(f"   Genelia has no leads assigned by either method")
            return False

def main():
    analyzer = TelecallerAssignmentAnalyzer()
    analyzer.run_analysis()

if __name__ == "__main__":
    main()