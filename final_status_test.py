#!/usr/bin/env python3
"""
Final Driver Onboarding Status Investigation
"""

import requests
import json

# Configuration
BASE_URL = "https://driver-roster-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@nurapulse.com"
ADMIN_PASSWORD = "admin123"

def main():
    print("🔍 Final Driver Onboarding Status Investigation")
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
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                leads = response.json()
                total_leads = len(leads)
                print(f"✅ Successfully retrieved {total_leads} leads from database")
                
                if total_leads > 0:
                    print(f"\n📋 FIRST LEAD SAMPLE:")
                    print(json.dumps(leads[0], indent=2))
                    
                    # Check response structure
                    sample_lead = leads[0]
                    required_fields = ["id", "name", "status", "stage"]
                    available_fields = list(sample_lead.keys())
                    missing_fields = [field for field in required_fields if field not in sample_lead]
                    
                    print(f"\n📋 STRUCTURE ANALYSIS:")
                    print(f"Available fields: {available_fields}")
                    print(f"Required fields: {required_fields}")
                    
                    if not missing_fields:
                        print(f"✅ Lead structure contains all required fields")
                    else:
                        print(f"❌ Lead structure missing fields: {missing_fields}")
                    
                    # Count unique status values
                    print(f"\n📊 STATUS ANALYSIS:")
                    status_counts = {}
                    stage_counts = {}
                    
                    for lead in leads:
                        status = lead.get('status', 'Unknown')
                        stage = lead.get('stage', 'Unknown')
                        
                        status_counts[status] = status_counts.get(status, 0) + 1
                        stage_counts[stage] = stage_counts.get(stage, 0) + 1
                    
                    print(f"\nTotal leads: {total_leads}")
                    print(f"Unique Status Values ({len(status_counts)} total):")
                    for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
                        print(f"  {status:<35} : {count:>6} leads")
                    
                    print(f"\nStage Distribution ({len(stage_counts)} total):")
                    for stage, count in sorted(stage_counts.items()):
                        print(f"  {stage:<15} : {count:>6} leads")
                    
                    # Check specific statuses mentioned in the issue
                    training_wip_count = status_counts.get('Training WIP', 0)
                    done_count = status_counts.get('DONE!', 0)
                    
                    print(f"\n🎯 SPECIFIC STATUS INVESTIGATION:")
                    print(f"  'Training WIP': {training_wip_count} leads")
                    print(f"  'DONE!': {done_count} leads")
                    
                    if training_wip_count > 0 or done_count > 0:
                        print(f"✅ Found the statuses mentioned in the issue!")
                    else:
                        print(f"❌ The specific statuses 'Training WIP' and 'DONE!' are not found in the leads")
                        print(f"   This explains why the Status Summary Dashboard shows zeros for these statuses.")
                    
                else:
                    print("⚠️  No leads found in database - this explains why Status Summary shows zeros!")
                    
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON response: {e}")
                print(f"Raw response: {response.text[:500]}...")
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
            
            # Analyze the summary
            total_leads = summary.get('total_leads', 0)
            stage_breakdown = summary.get('stage_breakdown', {})
            
            print(f"\n📊 TELECALLER SUMMARY ANALYSIS:")
            print(f"  Total leads assigned to current user: {total_leads}")
            print(f"  Stage breakdown: {stage_breakdown}")
            
            if total_leads == 0:
                print(f"⚠️  No leads assigned to current user - this might explain dashboard zeros")
            
        else:
            print(f"❌ Telecaller summary failed. Status: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error checking telecaller summary: {e}")
    
    print(f"\n🎯 INVESTIGATION COMPLETE")
    print("=" * 60)
    
    print(f"\n📋 SUMMARY OF FINDINGS:")
    print(f"1. The status-summary endpoint has been removed from backend (comment says 'calculated on frontend')")
    print(f"2. We can fetch leads data using GET /api/driver-onboarding/leads?skip_pagination=true")
    print(f"3. The telecaller-summary endpoint shows data specific to the logged-in user")
    print(f"4. If Status Summary Dashboard shows zeros, it could be because:")
    print(f"   - No leads exist in the database")
    print(f"   - No leads are assigned to the current user")
    print(f"   - Frontend calculation logic has issues")
    print(f"   - Status/stage field mapping issues")

if __name__ == "__main__":
    main()