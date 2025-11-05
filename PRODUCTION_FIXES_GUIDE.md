# Production Environment Fixes - Complete Guide

## Issues Fixed

### 1. ✅ Folder Creator Button Added
**What was done:**
- Added "+ Create Folder" button in the Payment Data Extractor folder selection page
- Button appears in the header next to "Your Folders" title
- Opens a dialog to select Month and Year
- Creates folder in "Mon-YYYY" format (e.g., "Nov-2025", "Dec-2025")
- Automatically creates the folder in both frontend and backend
- Updates the folder list immediately after creation

**Files Modified:**
- `/app/frontend/src/pages/PaymentReconciliation.jsx`

---

### 2. ⏳ Nov 2025 Folder Fix (Production Database)
**The Problem:**
- The Nov 2025 folder doesn't appear in production at `https://pulse.nuraemobility.co.in/`
- This is because production has a **separate database** from the preview environment
- The folder needs to be created in the production database

**Solution Options:**

#### Option A: Use the New "+ Create Folder" Button (Recommended)
1. Log into production: `https://pulse.nuraemobility.co.in/`
2. Go to **Payment Data Extractor**
3. Click **"+ Create Folder"** button
4. Select **November** and **2025**
5. Click **Create Folder**
6. The Nov 2025 folder will be created in production

#### Option B: Manual Database Fix (If you have direct database access)
Run this in your production MongoDB:

```javascript
db.payment_folders.insertOne({
  "id": "nov-2025-" + Date.now(),
  "name": "Nov 2025",
  "month": "11",
  "year": "2025",
  "monthLabel": "Nov",
  "fullName": "November",
  "permanent": true,
  "createdAt": new Date().toISOString()
});
```

Also ensure the filesystem folder exists:
```bash
mkdir -p /path/to/backend/uploaded_files/payment_screenshots/Nov\ 2025
```

---

### 3. ⏳ Change Ravindran's Role to "Telecaller+Ops"
**The Problem:**
- Ravindran needs access to both Telecaller's Desk and Operations features
- His current role doesn't provide both permissions

**Solution: Update User Role in Production Database**

#### Option A: Via Admin Panel (If available)
1. Log in as Master Admin
2. Go to User Management / Settings
3. Find user "Ravindran"
4. Change role to "Telecaller+Ops"
5. Save changes

#### Option B: Direct Database Update
Run this in your production MongoDB:

```javascript
// Find Ravindran's user
db.users.findOne({ 
  $or: [
    { name: /Ravindran/i },
    { email: /ravindran/i }
  ]
});

// Update his role
db.users.updateOne(
  { 
    $or: [
      { name: /Ravindran/i },
      { email: /ravindran/i }
    ]
  },
  { 
    $set: { 
      role: "Telecaller+Ops" 
    }
  }
);

// Verify the update
db.users.findOne({ 
  $or: [
    { name: /Ravindran/i },
    { email: /ravindran/i }
  ]
});
```

---

## Understanding Preview vs Production

### Preview Environment
- URL: Local or preview deployment
- Database: Separate development database
- Changes made here **do not affect production**

### Production Environment
- URL: `https://pulse.nuraemobility.co.in/`
- Database: Production MongoDB (separate from preview)
- Changes must be made directly in production or deployed

---

## Deployment Steps for Production

To deploy the new folder creator button to production:

### 1. Commit Changes
```bash
cd /app
git add frontend/src/pages/PaymentReconciliation.jsx
git commit -m "Add folder creator button to Payment Data Extractor"
```

### 2. Deploy to Production
Follow your standard deployment process:
- Push to GitHub
- Trigger production deployment
- Wait for build to complete
- Verify the "+ Create Folder" button appears

### 3. Test in Production
1. Visit `https://pulse.nuraemobility.co.in/`
2. Log in as admin
3. Go to Payment Data Extractor
4. Verify "+ Create Folder" button is visible
5. Click it and create "Nov 2025" folder
6. Verify folder appears in the list

---

## Feature Summary

### New Folder Creator
- **Location**: Payment Data Extractor > Folder Selection page
- **Button**: Green "+ Create Folder" button in header
- **Format**: Creates folders as "Mon-YYYY" (e.g., Nov-2025, Dec-2025)
- **Behavior**: 
  - Opens dialog with Month and Year dropdowns
  - Shows preview of folder name
  - Creates folder in database and filesystem
  - Refreshes folder list automatically
  - Opens the newly created folder

### Folder Structure
- **Database**: `payment_folders` collection
- **Filesystem**: `/backend/uploaded_files/payment_screenshots/[Folder Name]/`
- **Format**: "Nov 2025", "Dec 2025", etc.

---

## Testing Checklist

### Preview Environment (Already Working)
- ✅ "+ Create Folder" button visible
- ✅ Dialog opens with Month/Year selectors
- ✅ Folder creation works
- ✅ Folder appears in list after creation
- ✅ Can open newly created folder
- ✅ Dropdown scrolling works smoothly
- ✅ Platform field displays in table
- ✅ Google Sheets sync includes Platform column

### Production Environment (To Test After Deployment)
- ⏳ Deploy changes to production
- ⏳ "+ Create Folder" button visible
- ⏳ Create "Nov 2025" folder via button
- ⏳ Verify folder appears in list
- ⏳ Update Ravindran's role to "Telecaller+Ops"
- ⏳ Verify Ravindran can access both features
- ⏳ Test complete payment flow with Platform column
- ⏳ Test Google Sheets sync with new AppScript

---

## Quick Reference

### Create Nov 2025 in Production
**Easiest Way:**
1. Log in to production
2. Go to Payment Data Extractor
3. Click "+ Create Folder"
4. Select November 2025
5. Click Create

### Update Ravindran's Role
**Database Command:**
```javascript
db.users.updateOne(
  { name: /Ravindran/i },
  { $set: { role: "Telecaller+Ops" } }
);
```

### Google Sheets AppScript URL
```
https://script.google.com/macros/s/AKfycbxjWvW2duyhuiwr9vO8C6N1X_HgRycXkpd1zA5RJMrt-pPOPPgyZj8KzF5tUtNzh2ot3Q/exec
```

---

## Support

If you encounter issues:
1. Check browser console for errors (F12 → Console)
2. Check backend logs for API errors
3. Verify database connection
4. Ensure AppScript is deployed correctly
5. Clear browser cache and refresh

**Status**: Frontend changes complete. Production deployment pending.
