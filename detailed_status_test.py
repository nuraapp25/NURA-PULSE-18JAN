#!/usr/bin/env python3
"""
Detailed Driver Onboarding Status Investigation
"""

import requests
import json

# Configuration
BASE_URL = "https://driver-sync-tool.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

def main():
    print("🔍 Detailed Driver Onboarding Status Investigation")
    print("=" * 60)
    
    # Step 1: Login
    print("\n--- Step 1: Login ---")
    login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            print(f"✅ Login successful")
        else:
            print(f"❌ Login failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: Fetch all leads with skip_pagination=true
    print("\n--- Step 2: Fetch all leads with skip_pagination=true ---")
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/leads?skip_pagination=true", 
                              headers=headers, timeout=30)
        
        if response.status_code == 200:
            leads = response.json()
            total_leads = len(leads)
            print(f"✅ Successfully retrieved {total_leads} leads from database")
            
            if total_leads > 0:
                # Check response structure
                print(f"\n📋 RESPONSE STRUCTURE:")
                sample_lead = leads[0]
                print(f"Sample lead keys: {list(sample_lead.keys())}")
                
                # Check for required fields
                required_fields = ["id", "name", "status", "stage"]
                missing_fields = [field for field in required_fields if field not in sample_lead]
                
                if not missing_fields:
                    print(f"✅ Lead structure contains all required fields: {required_fields}")
                else:
                    print(f"❌ Lead structure missing fields: {missing_fields}")
                
                # Print sample leads with their status values
                print(f"\n📋 SAMPLE OF {min(10, total_leads)} LEADS:")
                print("-" * 80)
                print(f"{'ID':<25} {'Name':<20} {'Status':<25} {'Stage':<8}")
                print("-" * 80)
                
                for i in range(min(10, total_leads)):
                    lead = leads[i]
                    lead_id = lead.get('id', 'N/A')[:24]
                    name = lead.get('name', 'N/A')[:19]
                    status = lead.get('status', 'N/A')[:24]
                    stage = lead.get('stage', 'N/A')[:7]
                    print(f"{lead_id:<25} {name:<20} {status:<25} {stage:<8}")
                
                # Count unique status values
                print(f"\n📊 STATUS ANALYSIS:")
                status_counts = {}
                stage_counts = {}
                
                for lead in leads:
                    status = lead.get('status', 'Unknown')
                    stage = lead.get('stage', 'Unknown')
                    
                    status_counts[status] = status_counts.get(status, 0) + 1
                    stage_counts[stage] = stage_counts.get(stage, 0) + 1
                
                print(f"\nUnique Status Values ({len(status_counts)} total):")
                for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"  {status:<35} : {count:>6} leads")
                
                print(f"\nStage Distribution ({len(stage_counts)} total):")
                for stage, count in sorted(stage_counts.items()):
                    print(f"  {stage:<15} : {count:>6} leads")
                
                # Check for expected status values
                expected_s1_statuses = ['New', 'Not Interested', 'Interested, No DL', 'Interested, No Badge', 
                                      'Highly Interested', 'Call back 1D', 'Call back 1W', 'Call back 2W', 'Call back 1M']
                expected_s2_statuses = ['Docs Upload Pending', 'Verification Pending', 'Duplicate License', 
                                      'DL - Amount', 'Verified', 'Verification Rejected']
                expected_s3_statuses = ['Schedule Pending', 'Training WIP', 'Training Completed', 
                                      'Training Rejected', 'Re-Training', 'Absent for training', 'Approved']
                expected_s4_statuses = ['CT Pending', 'CT WIP', 'Shift Details Pending', 'DONE!', 'Terminated']
                
                all_expected_statuses = expected_s1_statuses + expected_s2_statuses + expected_s3_statuses + expected_s4_statuses
                
                found_expected = []
                unexpected_statuses = []
                
                for status in status_counts.keys():
                    if status in all_expected_statuses:
                        found_expected.append(status)
                    else:
                        unexpected_statuses.append(status)
                
                print(f"\n✅ EXPECTED STATUSES FOUND ({len(found_expected)}):")
                for status in found_expected:
                    count = status_counts[status]
                    print(f"  {status}: {count} leads")
                
                if unexpected_statuses:
                    print(f"\n⚠️  UNEXPECTED STATUSES FOUND ({len(unexpected_statuses)}):")
                    for status in unexpected_statuses:
                        count = status_counts[status]
                        print(f"  {status}: {count} leads")
                
                # Check specific statuses mentioned in the issue
                training_wip_count = status_counts.get('Training WIP', 0)
                done_count = status_counts.get('DONE!', 0)
                
                print(f"\n🎯 SPECIFIC STATUS INVESTIGATION:")
                print(f"  'Training WIP': {training_wip_count} leads")
                print(f"  'DONE!': {done_count} leads")
                
                # Manual status summary calculation (since backend endpoint is removed)
                print(f"\n📊 MANUAL STATUS SUMMARY CALCULATION:")
                
                s1_total = sum(status_counts.get(status, 0) for status in expected_s1_statuses)
                s2_total = sum(status_counts.get(status, 0) for status in expected_s2_statuses)
                s3_total = sum(status_counts.get(status, 0) for status in expected_s3_statuses)
                s4_total = sum(status_counts.get(status, 0) for status in expected_s4_statuses)
                
                print(f"  S1 Stage Total: {s1_total}")
                print(f"  S2 Stage Total: {s2_total}")
                print(f"  S3 Stage Total: {s3_total} (includes Training WIP: {training_wip_count})")
                print(f"  S4 Stage Total: {s4_total} (includes DONE!: {done_count})")
                print(f"  Grand Total: {s1_total + s2_total + s3_total + s4_total}")
                
                # Check stage field values
                print(f"\n🔍 STAGE FIELD ANALYSIS:")
                stage_field_counts = {}
                for lead in leads:
                    stage_field = lead.get('stage', 'Missing')
                    stage_field_counts[stage_field] = stage_field_counts.get(stage_field, 0) + 1
                
                print(f"Stage field values found:")
                for stage, count in sorted(stage_field_counts.items()):
                    print(f"  {stage}: {count} leads")
                
            else:
                print("⚠️  No leads found in database - this explains why Status Summary shows zeros!")
        else:
            print(f"❌ Failed to fetch leads. Status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error fetching leads: {e}")
        import traceback
        traceback.print_exc()
    
    # Step 3: Check telecaller summary endpoint
    print("\n--- Step 3: Check telecaller summary endpoint ---")
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/telecaller-summary", 
                              headers=headers, timeout=10)
        
        if response.status_code == 200:
            summary = response.json()
            print(f"✅ Telecaller summary response:")
            print(json.dumps(summary, indent=2))
        else:
            print(f"❌ Telecaller summary failed. Status: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error checking telecaller summary: {e}")
    
    print(f"\n🎯 INVESTIGATION COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()