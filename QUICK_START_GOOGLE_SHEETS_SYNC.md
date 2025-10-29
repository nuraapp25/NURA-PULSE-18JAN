# 🚀 Quick Start: Driver Onboarding Two-Way Sync

## ⚡ 5-Minute Setup

### 1️⃣ Add the Script to Your Google Sheet

1. Open: https://docs.google.com/spreadsheets/d/1FfZYvc9EpSE03myhp3yk8lfOzCJoibVmaJ74Xm-qhv0/edit
2. Click **Extensions** → **Apps Script**
3. Delete existing code
4. Copy and paste the entire script from `/app/google-sheets-driver-onboarding-sync.gs`
5. **Save** the project (name it "Nura Pulse Sync")

### 2️⃣ Run Initial Setup

1. In Apps Script editor, select `onOpen` function from dropdown
2. Click **Run** (▶️)
3. **Authorize** the script when prompted
4. Go back to your Google Sheet - you'll see a new **"🔄 Nura Sync"** menu

### 3️⃣ Setup Auto-Sync

1. Click **🔄 Nura Sync** → **⚙️ Setup Auto-Sync**
2. Click **Yes** to confirm
3. Done! Your sheet now syncs automatically every 5 minutes + real-time on edits

### 4️⃣ Test Connection

1. Click **🔄 Nura Sync** → **🔍 Test Connection**
2. Should show: "✅ Connection Test Successful!"

---

## 📊 Sheet Structure

Your "Driver Leads" sheet needs these columns (in order):

```
A  - ID
B  - Name
C  - Phone Number  ⭐ (REQUIRED - unique identifier)
D  - Vehicle
E  - Driving License
F  - Experience
G  - Interested EV
H  - Monthly Salary
I  - Current Location
J  - Lead Stage
K  - Status
L  - Driver Readiness
M  - Docs Collection
N  - Customer Readiness
O  - Assigned Telecaller
P  - Telecaller Notes
Q  - Notes
R  - Import Date
S  - Created At
```

---

## 🔄 How Sync Works

### Automatic Sync (No Action Needed)

| Direction | Trigger | Frequency |
|-----------|---------|-----------|
| Sheet → App | Edit any cell | Instant |
| Sheet → App | Scheduled | Every 5 minutes |
| App → Sheet | Any change in app | Instant |

### Manual Sync (From Menu)

- **📤 Push All to App**: Send all sheet data to app (manual override)
- **📥 Pull All from App**: Get all app data to sheet (refresh)

---

## ✅ Testing Checklist

- [ ] "🔄 Nura Sync" menu appears in Google Sheets
- [ ] Test Connection shows "✅ Connection Test Successful"
- [ ] Edit a cell in the sheet → Check app (should update)
- [ ] Add a lead in the app → Check sheet (should appear in 5 min)
- [ ] Sync Status shows both triggers active

---

## 🎯 Important Notes

1. **Phone Number is Required**: Acts as unique identifier
2. **Real-time Sync**: Edits in sheet sync instantly to app
3. **Batch Sync**: App changes sync to sheet every 5 minutes
4. **No Duplicates**: Same phone number = update existing record
5. **Empty Rows**: Rows without phone number are skipped

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Menu not appearing | Run `onOpen` function manually in Apps Script |
| Connection failed | Check APP_WEBHOOK_URL in script configuration |
| Changes not syncing | Run "⚙️ Setup Auto-Sync" again |
| Auth error | Update Bearer token in `syncAllFromApp` function |

---

## 📞 Get Help

Check sync status: **🔄 Nura Sync** → **📊 Sync Status**

View execution logs: **Extensions** → **Apps Script** → **Executions**

---

## 🎉 You're All Set!

Your Driver Onboarding data now syncs automatically between Google Sheets and Nura Pulse!

**Sheet URL**: https://docs.google.com/spreadsheets/d/1FfZYvc9EpSE03myhp3yk8lfOzCJoibVmaJ74Xm-qhv0/edit

**Backend Webhook**: `https://telecaller-hub-2.preview.emergentagent.com/api/driver-onboarding/webhook/sync-from-sheets`

---

**Last Updated**: October 18, 2025
