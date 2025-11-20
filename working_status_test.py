#!/usr/bin/env python3
"""
Working Driver Onboarding Status Investigation
"""

import requests
import json

# Configuration
BASE_URL = "https://driver-sync-tool.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

def main():
    print("🔍 Driver Onboarding Status Investigation - FINAL ANALYSIS")
    print("=" * 80)
    
    # Step 1: Login
    print("\n--- Step 1: Login with admin credentials ---")
    login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            user_info = data.get("user", {})
            print(f"✅ Login successful - User: {user_info.get('first_name', 'Unknown')}, Type: {user_info.get('account_type', 'Unknown')}")
        else:
            print(f"❌ Login failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: Fetch all leads
    print("\n--- Step 2: Fetch all leads using skip_pagination=true ---")
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/leads?skip_pagination=true", 
                              headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, dict) and 'leads' in data:
                leads = data['leads']
                total_leads = data.get('total', len(leads))
            else:
                leads = data if isinstance(data, list) else []
                total_leads = len(leads)
            
            print(f"✅ Successfully retrieved {total_leads} leads from database")
            
            if total_leads > 0:
                # Check structure
                sample_lead = leads[0]
                print(f"✅ Available fields: {list(sample_lead.keys())}")
                
                # Count statuses and stages
                status_counts = {}
                stage_counts = {}
                
                for lead in leads:
                    status = lead.get('status', 'Unknown')
                    stage = lead.get('stage', 'Unknown')
                    
                    status_counts[status] = status_counts.get(status, 0) + 1
                    stage_counts[stage] = stage_counts.get(stage, 0) + 1
                
                # Print sample leads
                print(f"\n📋 SAMPLE OF 10 LEADS:")
                print("-" * 100)
                print(f"{'ID':<25} {'Name':<25} {'Status':<25} {'Stage':<20}")
                print("-" * 100)
                
                for i in range(min(10, total_leads)):
                    lead = leads[i]
                    lead_id = lead.get('id', 'N/A')[:24]
                    name = lead.get('name', 'N/A')[:24]
                    status = lead.get('status', 'N/A')[:24]
                    stage = lead.get('stage', 'N/A')[:19]
                    print(f"{lead_id:<25} {name:<25} {status:<25} {stage:<20}")
                
                # Status analysis
                print(f"\n📊 UNIQUE STATUS VALUES FOUND ({len(status_counts)} total):")
                print("-" * 70)
                for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"{status:<40} : {count:>6} leads")
                
                # Stage analysis
                print(f"\n📊 STAGE DISTRIBUTION ({len(stage_counts)} total):")
                print("-" * 50)
                for stage, count in sorted(stage_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"{stage:<30} : {count:>6} leads")
                
                # Check specific statuses
                training_wip_count = status_counts.get('Training WIP', 0)
                done_count = status_counts.get('DONE!', 0)
                
                print(f"\n🎯 SPECIFIC STATUS INVESTIGATION:")
                print(f"  'Training WIP': {training_wip_count} leads")
                print(f"  'DONE!': {done_count} leads")
                
                # Expected vs actual stage format
                print(f"\n🔍 STAGE FORMAT ANALYSIS:")
                print(f"Expected stage values for dashboard: S1, S2, S3, S4")
                print(f"Actual stage values found:")
                for stage, count in sorted(stage_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"  '{stage}': {count} leads")
                
                # Root cause analysis
                expected_stages = ['S1', 'S2', 'S3', 'S4']
                stage_format_issue = any(stage not in expected_stages and stage != 'Unknown' for stage in stage_counts.keys())
                
                print(f"\n🔧 ROOT CAUSE ANALYSIS:")
                if stage_format_issue:
                    print(f"❌ STAGE FORMAT MISMATCH DETECTED!")
                    print(f"   Dashboard expects: S1, S2, S3, S4")
                    print(f"   Database contains: {list(stage_counts.keys())}")
                    print(f"   This explains why Status Summary Dashboard shows zeros!")
                else:
                    print(f"✅ Stage format matches expected values")
                
                if training_wip_count > 0 and done_count > 0:
                    print(f"✅ Both 'Training WIP' ({training_wip_count}) and 'DONE!' ({done_count}) statuses exist in data")
                    print(f"   The issue is likely the stage field format mismatch")
                
            else:
                print("⚠️  No leads found in database")
        else:
            print(f"❌ Failed to fetch leads. Status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error fetching leads: {e}")
    
    print(f"\n🎯 INVESTIGATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()