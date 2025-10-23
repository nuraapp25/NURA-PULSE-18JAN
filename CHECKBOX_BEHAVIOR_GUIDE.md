# Lead Source Checkbox - Behavior Guide

## 🎯 How the Checkbox Controls Form Validation

### **Scenario 1: Checkbox UNCHECKED (Default)**

```
┌─────────────────────────────────────────────┐
│  Lead Source *                              │
│  ┌───────────────────────────────────────┐  │
│  │ e.g., Facebook Ad, Referral...        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [ ] Read Source from file                 │
└─────────────────────────────────────────────┘

VALIDATION:
✅ Lead Source: REQUIRED (must be filled)
✅ Lead Date: REQUIRED
✅ File: REQUIRED

IMPORT BUTTON STATUS:
❌ Disabled if Lead Source is empty
✅ Enabled when all fields filled
```

---

### **Scenario 2: Checkbox CHECKED**

```
┌─────────────────────────────────────────────┐
│  Lead Source              [✓] Read Source  │
│  ┌───────────────────────────────────────┐  │
│  │ Will be read from file...       🔒    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ℹ️ Lead sources will be read from a       │
│     'Lead Source' column in your file      │
└─────────────────────────────────────────────┘

VALIDATION:
⚪ Lead Source: NOT REQUIRED (disabled field)
✅ Lead Date: REQUIRED
✅ File: REQUIRED (must have "Lead Source" column)

IMPORT BUTTON STATUS:
✅ Enabled even if Lead Source field is empty
✅ Only needs File + Lead Date
```

---

## 📊 Button State Matrix

| Lead Source Filled | Lead Date Filled | File Selected | Checkbox State | Button State |
|-------------------|------------------|---------------|----------------|--------------|
| ❌ No              | ✅ Yes           | ✅ Yes        | ❌ Unchecked    | ❌ **Disabled** |
| ✅ Yes             | ❌ No            | ✅ Yes        | ❌ Unchecked    | ❌ **Disabled** |
| ✅ Yes             | ✅ Yes           | ❌ No         | ❌ Unchecked    | ❌ **Disabled** |
| ✅ Yes             | ✅ Yes           | ✅ Yes        | ❌ Unchecked    | ✅ **Enabled** |
| ❌ No              | ✅ Yes           | ✅ Yes        | ✅ **Checked**  | ✅ **Enabled** ⭐ |
| ❌ No              | ❌ No            | ✅ Yes        | ✅ Checked      | ❌ **Disabled** |
| ❌ No              | ✅ Yes           | ❌ No         | ✅ Checked      | ❌ **Disabled** |

---

## 🔄 Real-time Field Behavior

### **When user checks the checkbox:**

```javascript
Before:
Lead Source: [Empty field]           ← User can type
Status: REQUIRED (*)
Button: DISABLED ❌

User Action: ✓ Checks "Read Source from file"

After:
Lead Source: [Will be read from file...] 🔒 ← Grayed out, disabled
Status: OPTIONAL (no *)
Button: ENABLED ✅ (if Date + File are present)
```

### **When user unchecks the checkbox:**

```javascript
Before:
Lead Source: [Will be read from file...] 🔒
Status: OPTIONAL
Button: ENABLED ✅

User Action: ☐ Unchecks "Read Source from file"

After:
Lead Source: [Empty field]           ← User can type again
Status: REQUIRED (*)
Button: DISABLED ❌ (until user fills the field)
```

---

## ✨ Key Features

### 1. **Dynamic Label**
```
Checkbox OFF: "Lead Source *"      ← Asterisk present
Checkbox ON:  "Lead Source"        ← No asterisk
```

### 2. **Field Appearance**
```
Checkbox OFF: 
┌───────────────────────────────────┐
│ e.g., Facebook Ad, Referral...   │  ← White/normal background
└───────────────────────────────────┘

Checkbox ON:
┌───────────────────────────────────┐
│ Will be read from file...    🔒   │  ← Gray background, cursor disabled
└───────────────────────────────────┘
ℹ️ Lead sources will be read from...
```

### 3. **Button Logic**
```javascript
// Button disabled condition:
disabled = !selectedFile || 
           (!readSourceFromFile && !leadSource) || 
           !leadDate || 
           importing

// Simplified:
IF checkbox is OFF:
  → Lead Source must be filled
  
IF checkbox is ON:
  → Lead Source is ignored
  → Only File + Date required
```

---

## 🎯 User Experience Flow

### **Flow 1: Manual Source Entry (Original)**
1. User opens import dialog
2. Types "Facebook Ad" in Lead Source
3. Selects date
4. Uploads file
5. Button becomes enabled ✅
6. Clicks "Import Leads"
7. All leads get "Facebook Ad" as source

### **Flow 2: Source from File (New)**
1. User opens import dialog
2. **Checks "Read Source from file"** ⭐
3. Lead Source field grays out automatically
4. Selects date
5. Uploads file (with "Lead Source" column)
6. Button is already enabled ✅
7. Clicks "Import Leads"
8. Each lead gets its own source from file

---

## 🚨 Error Cases

### **Case 1: Checkbox ON but no Lead Source column in file**
```
User Action: 
✓ Read Source from file
📁 Uploads file WITHOUT "Lead Source" column

Result:
❌ Error: "Lead Source column not found in file. 
          Please ensure your file has a 'Lead Source' column."
```

### **Case 2: Checkbox OFF but Lead Source empty**
```
User Action:
☐ Read Source from file is OFF
📝 Lead Source field is EMPTY
📅 Date selected
📁 File uploaded

Result:
❌ Button stays DISABLED
   (User must fill Lead Source field)
```

---

## 🎨 Visual States Summary

| Checkbox | Field State | Label | Placeholder | Info Message | Button |
|----------|-------------|-------|-------------|--------------|--------|
| ☐ OFF | ✏️ Editable | "Lead Source *" | "e.g., Facebook Ad..." | ❌ None | Requires field |
| ✓ ON | 🔒 Disabled | "Lead Source" | "Will be read from file..." | ℹ️ Blue message | Ignores field |

---

## 💡 Tips for Users

1. **Want same source for all?** 
   → Leave checkbox OFF and type manually

2. **Have different sources per lead?** 
   → Check the box and include "Lead Source" column in file

3. **Not sure?** 
   → Check the checkbox to see if your file has the column
   → System will validate and show error if missing

4. **Changed your mind?** 
   → Just uncheck the box before importing
   → You can switch between modes anytime

---

## ✅ Validation Summary

**Required Fields:**

| Field | Checkbox OFF | Checkbox ON |
|-------|-------------|-------------|
| Lead Source | ✅ Required | ⚪ Optional |
| Lead Date | ✅ Required | ✅ Required |
| File | ✅ Required | ✅ Required* |

*File must contain "Lead Source" column when checkbox is ON

---

**Last Updated:** Checkbox Behavior Guide - December 2024
