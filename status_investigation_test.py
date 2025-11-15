#!/usr/bin/env python3
"""
Driver Onboarding Status Investigation Test
Tests the specific issue reported: Status Summary Dashboard showing all zeros
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://driver-docs-2.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

def main():
    print("🔍 Driver Onboarding Status Investigation Test")
    print("=" * 60)
    
    # Step 1: Login with admin credentials
    print("\n--- Step 1: Login with admin credentials ---")
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                token = data["token"]
                user_info = data.get("user", {})
                print(f"✅ Login successful. User: {user_info.get('first_name', 'Unknown')}, Type: {user_info.get('account_type', 'Unknown')}")
            else:
                print(f"❌ No token in response: {data}")
                return False
        else:
            print(f"❌ Login failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False
    
    # Step 2: Fetch all leads using skip_pagination=true
    print("\n--- Step 2: Fetch all leads with skip_pagination=true ---")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/leads?skip_pagination=true", 
                              headers=headers, timeout=30)
        
        if response.status_code == 200:
            leads = response.json()
            total_leads = len(leads)
            print(f"✅ Successfully retrieved {total_leads} leads from database")
            
            if total_leads == 0:
                print("⚠️  No leads found in database - this explains why Status Summary shows zeros!")
                # Still check the status summary endpoint
                pass
            
            # Step 3: Check response structure
            print("\n--- Step 3: Check response structure ---")
            if total_leads > 0:
                sample_lead = leads[0]
                required_fields = ["id", "name", "status", "stage"]
                missing_fields = [field for field in required_fields if field not in sample_lead]
                
                if not missing_fields:
                    print(f"✅ Lead structure contains all required fields: {required_fields}")
                else:
                    print(f"❌ Lead structure missing fields: {missing_fields}")
            else:
                print("⚠️  No leads to check structure")
            
            # Step 4: Print sample leads with their status values
            print("\n--- Step 4: Sample leads with status values ---")
            if total_leads > 0:
                sample_size = min(10, total_leads)
                print(f"\n📋 SAMPLE OF {sample_size} LEADS:")
                print("-" * 80)
                print(f"{'ID':<25} {'Name':<20} {'Status':<25} {'Stage':<8}")
                print("-" * 80)
                
                for i in range(sample_size):
                    lead = leads[i]
                    lead_id = lead.get('id', 'N/A')[:24]
                    name = lead.get('name', 'N/A')[:19]
                    status = lead.get('status', 'N/A')[:24]
                    stage = lead.get('stage', 'N/A')[:7]
                    print(f"{lead_id:<25} {name:<20} {status:<25} {stage:<8}")
            else:
                print("⚠️  No leads to display")
            
            # Step 5: Count unique status values
            print("\n--- Step 5: Count unique status values ---")
            if total_leads > 0:
                status_counts = {}
                stage_counts = {}
                
                for lead in leads:
                    status = lead.get('status', 'Unknown')
                    stage = lead.get('stage', 'Unknown')
                    
                    status_counts[status] = status_counts.get(status, 0) + 1
                    stage_counts[stage] = stage_counts.get(stage, 0) + 1
                
                print(f"\n📊 UNIQUE STATUS VALUES FOUND ({len(status_counts)} total):")
                print("-" * 60)
                for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
                    print(f"{status:<35} : {count:>6} leads")
                
                print(f"\n📊 STAGE DISTRIBUTION ({len(stage_counts)} total):")
                print("-" * 40)
                for stage, count in sorted(stage_counts.items()):
                    print(f"{stage:<15} : {count:>6} leads")
            else:
                print("⚠️  No leads to count statuses")
                status_counts = {}
                stage_counts = {}
            
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
            
            if training_wip_count > 0 or done_count > 0:
                print(f"✅ Found Training WIP: {training_wip_count}, DONE!: {done_count}")
            else:
                print("❌ Neither 'Training WIP' nor 'DONE!' statuses found in leads")
            
        else:
            print(f"❌ Failed to fetch leads. Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error fetching leads: {e}")
        return False
    
    # Step 9: Check Status Summary Dashboard endpoint
    print("\n--- Step 9: Check Status Summary Dashboard endpoint ---")
    try:
        response = requests.get(f"{BASE_URL}/driver-onboarding/status-summary", 
                              headers=headers, timeout=10)
        
        if response.status_code == 200:
            summary_data = response.json()
            
            if summary_data.get("success"):
                summary = summary_data.get("summary", {})
                stage_totals = summary_data.get("stage_totals", {})
                total_leads = summary_data.get("total_leads", 0)
                
                print(f"\n📊 STATUS SUMMARY DASHBOARD RESULTS:")
                print(f"  Total Leads: {total_leads}")
                print(f"  Stage Totals: {stage_totals}")
                
                # Check each stage
                for stage in ['S1', 'S2', 'S3', 'S4']:
                    stage_summary = summary.get(stage, {})
                    stage_total = stage_totals.get(stage, 0)
                    print(f"\n  {stage} Stage (Total: {stage_total}):")
                    for status, count in stage_summary.items():
                        if count > 0:
                            print(f"    {status}: {count}")
                
                # Check if Training WIP and DONE! appear in summary
                s3_summary = summary.get("S3", {})
                s4_summary = summary.get("S4", {})
                
                training_wip_summary = s3_summary.get("Training WIP", 0)
                done_summary = s4_summary.get("DONE!", 0)
                
                print(f"\n🎯 DASHBOARD STATUS CHECK:")
                print(f"  Training WIP in S3: {training_wip_summary}")
                print(f"  DONE! in S4: {done_summary}")
                
                if training_wip_summary > 0 or done_summary > 0:
                    print(f"✅ Dashboard shows Training WIP: {training_wip_summary}, DONE!: {done_summary}")
                else:
                    print("❌ Dashboard shows zeros for Training WIP and DONE! - this explains the issue!")
                
            else:
                print(f"❌ Status summary response missing success field: {summary_data}")
        else:
            print(f"❌ Status summary failed. Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error checking status summary: {e}")
    
    print(f"\n🎯 INVESTIGATION COMPLETE")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)