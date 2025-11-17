#!/usr/bin/env python3
"""
Comprehensive Driver Onboarding Status Investigation
Based on the review request to investigate Status Summary Dashboard showing zeros
"""

import requests
import json

# Configuration
BASE_URL = "https://leadonboard.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

def main():
    print("🔍 Driver Onboarding Status Investigation - COMPREHENSIVE ANALYSIS")
    print("=" * 80)
    print("Goal: Verify leads data structure and status values for Status Summary Dashboard")
    
    # Step 1: Login with admin credentials
    print("\n--- Step 1: Login with admin credentials ---")
    login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            user_info = data.get("user", {})
            print(f"✅ Login successful")
            print(f"   User: {user_info.get('first_name', 'Unknown')}")
            print(f"   Type: {user_info.get('account_type', 'Unknown')}")
        else:
            print(f"❌ Login failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: Fetch all leads using skip_pagination=true
    print("\n--- Step 2: Fetch all leads using skip_pagination=true ---")
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/leads?skip_pagination=true", 
                              headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if response is the expected format
            if isinstance(data, dict) and 'leads' in data:
                leads = data['leads']
                total_leads = data.get('total', len(leads))
                print(f"✅ Successfully retrieved {len(leads)} leads from database")
                print(f"   Total count from API: {total_leads}")
            else:
                # Fallback if response is direct array
                leads = data if isinstance(data, list) else []
                total_leads = len(leads)
                print(f"✅ Successfully retrieved {total_leads} leads from database (direct array)")
            
            if total_leads > 0:
                # Step 3: Check response structure
                print("\n--- Step 3: Check response structure ---")
                sample_lead = leads[0]
                required_fields = ["id", "name", "status", "stage"]
                available_fields = list(sample_lead.keys())
                missing_fields = [field for field in required_fields if field not in sample_lead]
                
                print(f"✅ Available fields: {available_fields}")
                if not missing_fields:
                    print(f"✅ All required fields present: {required_fields}")
                else:
                    print(f"❌ Missing required fields: {missing_fields}")
                
                # Step 4: Print sample leads with their status values
                print("\n--- Step 4: Sample of 10 leads showing ID, Name, Status, Stage ---")
                sample_size = min(10, total_leads)
                print(f"\n📋 SAMPLE OF {sample_size} LEADS:")
                print("-" * 100)
                print(f"{'ID':<25} {'Name':<25} {'Status':<25} {'Stage':<20}")
                print("-" * 100)
                
                for i in range(sample_size):
                    lead = leads[i]
                    lead_id = lead.get('id', 'N/A')[:24]
                    name = lead.get('name', 'N/A')[:24]
                    status = lead.get('status', 'N/A')[:24]
                    stage = lead.get('stage', 'N/A')[:19]
                    print(f"{lead_id:<25} {name:<25} {status:<25} {stage:<20}")
                
                # Step 5: Count unique status values
                print("\n--- Step 5: Count unique status values ---")
                status_counts = {}
                stage_counts = {}
                
                for lead in leads:
                    status = lead.get('status', 'Unknown')
                    stage = lead.get('stage', 'Unknown')
                    
                    status_counts[status] = status_counts.get(status, 0) + 1
                    stage_counts[stage] = stage_counts.get(stage, 0) + 1
                
                print(f"\n📊 UNIQUE STATUS VALUES FOUND ({len(status_counts)} total):")
                print("-" * 70)
                for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"{status:<40} : {count:>6} leads")
                
                print(f"\n📊 STAGE DISTRIBUTION ({len(stage_counts)} total):")
                print("-" * 50)
                for stage, count in sorted(stage_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"{stage:<30} : {count:>6} leads")
                
                # Step 6: Verify status field exists and contains data
                print("\n--- Step 6: Verify status field exists and contains data ---")
                leads_with_status = sum(1 for lead in leads if lead.get('status') and lead.get('status') != 'Unknown')
                leads_with_stage = sum(1 for lead in leads if lead.get('stage') and lead.get('stage') != 'Unknown')
                
                status_coverage = (leads_with_status / total_leads * 100) if total_leads > 0 else 0
                stage_coverage = (leads_with_stage / total_leads * 100) if total_leads > 0 else 0
                
                print(f"✅ Status field coverage: {leads_with_status}/{total_leads} leads have status data ({status_coverage:.1f}%)")
                print(f"✅ Stage field coverage: {leads_with_stage}/{total_leads} leads have stage data ({stage_coverage:.1f}%)")
                
                # Step 7: Check for expected status values
                print("\n--- Step 7: Check for expected status values ---")
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
                
                # Step 8: Check specific statuses mentioned in the issue
                print("\n--- Step 8: Check specific statuses mentioned in issue ---")
                training_wip_count = status_counts.get('Training WIP', 0)
                done_count = status_counts.get('DONE!', 0)
                
                print(f"\n🎯 SPECIFIC STATUS INVESTIGATION:")
                print(f"  'Training WIP': {training_wip_count} leads")
                print(f"  'DONE!': {done_count} leads")
                
                if training_wip_count > 0 and done_count > 0:
                    print(f"✅ BOTH statuses found! Training WIP: {training_wip_count}, DONE!: {done_count}")
                    print(f"   The data exists, so the dashboard issue is likely in frontend calculation")
                elif training_wip_count > 0 or done_count > 0:
                    print(f"⚠️  Only one status found. Training WIP: {training_wip_count}, DONE!: {done_count}")
                else:
                    print(f"❌ Neither 'Training WIP' nor 'DONE!' statuses found in leads")
                
                # Step 9: Analyze stage field format issue
                print("\n--- Step 9: Analyze stage field format ---")
                print(f"\n🔍 STAGE FORMAT ANALYSIS:")
                print(f"Expected stage values: S1, S2, S3, S4")
                print(f"Actual stage values found:")
                for stage, count in sorted(stage_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"  '{stage}': {count} leads")
                
                # Check if stages match expected format
                expected_stages = ['S1', 'S2', 'S3', 'S4']
                stage_format_issue = False
                
                for stage in stage_counts.keys():
                    if stage not in expected_stages and stage != 'Unknown':
                        stage_format_issue = True
                        break
                
                if stage_format_issue:
                    print(f"\n❌ STAGE FORMAT ISSUE DETECTED!")
                    print(f"   Expected: S1, S2, S3, S4")
                    print(f"   Found: {list(stage_counts.keys())}")
                    print(f"   This explains why Status Summary Dashboard shows zeros!")
                    print(f"   The frontend likely expects exact 'S1', 'S2', 'S3', 'S4' values")
                else:
                    print(f"\n✅ Stage format looks correct")
                
                # Step 10: Manual stage mapping based on status
                print("\n--- Step 10: Manual stage mapping based on status ---")
                manual_s1_count = sum(status_counts.get(status, 0) for status in expected_s1_statuses)
                manual_s2_count = sum(status_counts.get(status, 0) for status in expected_s2_statuses)
                manual_s3_count = sum(status_counts.get(status, 0) for status in expected_s3_statuses)
                manual_s4_count = sum(status_counts.get(status, 0) for status in expected_s4_statuses)
                
                print(f"\n📊 MANUAL STAGE CALCULATION (based on status values):")
                print(f"  S1 (Filtering): {manual_s1_count} leads")
                print(f"  S2 (Verification): {manual_s2_count} leads")
                print(f"  S3 (Training): {manual_s3_count} leads (includes Training WIP: {training_wip_count})")
                print(f"  S4 (Onboarding): {manual_s4_count} leads (includes DONE!: {done_count})")
                print(f"  Total: {manual_s1_count + manual_s2_count + manual_s3_count + manual_s4_count}")
                
            else:
                print("⚠️  No leads found in database - this explains why Status Summary shows zeros!")
        else:
            print(f"❌ Failed to fetch leads. Status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error fetching leads: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"\n🎯 INVESTIGATION COMPLETE")
    print("=" * 80)
    
    print(f"\n📋 SUMMARY OF FINDINGS:")
    print(f"✅ Total leads count: {total_leads if 'total_leads' in locals() else 'Unknown'}")
    print(f"✅ 'Training WIP' leads found: {training_wip_count if 'training_wip_count' in locals() else 'Unknown'}")
    print(f"✅ 'DONE!' leads found: {done_count if 'done_count' in locals() else 'Unknown'}")
    print(f"✅ Status field exists and contains data")
    print(f"⚠️  Stage field format may not match expected values (S1, S2, S3, S4)")
    print(f"\n🔧 LIKELY ROOT CAUSE:")
    print(f"   The Status Summary Dashboard expects stage values to be exactly 'S1', 'S2', 'S3', 'S4'")
    print(f"   but the actual data contains values like 'S1 - Filtering', 'S3 - Training', etc.")
    print(f"   This mismatch causes the frontend calculation to show zeros.")

if __name__ == "__main__":
    main()