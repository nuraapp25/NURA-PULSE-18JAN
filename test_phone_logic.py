#!/usr/bin/env python3
"""
Test script to validate phone number processing logic
"""

def process_phone(raw_phone):
    """
    Simulate the phone processing logic from server.py
    """
    # Handle phone number - convert to int first to avoid .0 issue, then to string
    phone_val = ""
    if raw_phone:
        try:
            # Try converting to int first to remove any .0, then to string
            phone_val = str(int(float(raw_phone)))
        except (ValueError, TypeError):
            # If conversion fails, use string directly
            phone_val = str(raw_phone)
    
    # Clean phone number - handle various formats
    # Remove 'p:' prefix (Google Forms format), spaces, dashes
    phone_val = phone_val.strip()
    phone_val = phone_val.replace('p:', '').replace('p:+', '+')  # Remove p: prefix
    phone_val = phone_val.replace(' ', '').replace('-', '')
    
    # Smart removal of +91 or 91 prefix - only if number is longer than 10 digits
    # This preserves numbers that start with 91 but are actually 10 digits (e.g., 9178822331)
    phone_digits = ''.join(filter(str.isdigit, phone_val))
    if len(phone_digits) > 10:
        # If number has more than 10 digits, take the last 10 digits
        # This handles +919897721333 or 919897721333 → 9897721333
        phone_val = phone_digits[-10:]
    else:
        # If already 10 digits or less, keep as is
        phone_val = phone_digits
    
    return phone_val


# Test cases
test_cases = [
    # (input, expected_output, description)
    ("9897721333", "9897721333", "Already 10 digits - no change"),
    ("+919897721333", "9897721333", "+91 prefix removed"),
    ("919897721333", "9897721333", "91 prefix removed"),
    ("9178822331", "9178822331", "10 digits starting with 91 - NOT removed"),
    (9897721333.0, "9897721333", "Float with .0 - converted correctly"),
    ("9178822331.0", "9178822331", "String float with .0 starting with 91"),
    ("+91 9897 721 333", "9897721333", "+91 with spaces"),
    ("91-9897-721-333", "9897721333", "91 with dashes"),
    ("p:+919897721333", "9897721333", "Google Forms format p:+91"),
    ("9123456789", "9123456789", "10 digits starting with 912 - NOT removed"),
]

print("Testing Phone Number Processing Logic")
print("=" * 60)
print()

all_passed = True
for raw_input, expected, description in test_cases:
    result = process_phone(raw_input)
    status = "✅ PASS" if result == expected else "❌ FAIL"
    
    if result != expected:
        all_passed = False
    
    print(f"{status} | {description}")
    print(f"   Input:    {raw_input}")
    print(f"   Expected: {expected}")
    print(f"   Got:      {result}")
    print()

print("=" * 60)
if all_passed:
    print("✅ ALL TESTS PASSED!")
else:
    print("❌ SOME TESTS FAILED!")

print()
