# Test Results - Nura Express Ops Name Selection

## Test Configuration
- **Date**: 2025-12-19
- **Feature**: Nura Express - Ops Name Selection Modal

## Test Scenarios

### 1. Ops Name Selection Modal
- When user clicks "Extract Data" button, a popup should appear
- Popup should have a dropdown with options: "Vicky", "Karthick"
- User must select an Ops Name before proceeding
- Selected Ops Name should be applied to all extracted records
- Ops Name should appear in Column B of the Excel file

### 2. Login Credentials
- **Email**: admin@nurapulse.com
- **Password**: admin

## Testing Protocol
1. Login to the application
2. Navigate to Nura Express page  
3. Upload test images
4. Click "Extract Data"
5. **VERIFY**: Modal popup appears asking for Ops Name selection
6. **VERIFY**: Dropdown has options "Vicky" and "Karthick"
7. Select an Ops Name and click "Proceed with Extraction"
8. **VERIFY**: Extracted data shows Ops Name field
9. Download Excel and verify Column B has the selected Ops Name
