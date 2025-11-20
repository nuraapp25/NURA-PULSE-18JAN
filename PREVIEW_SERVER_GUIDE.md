# 📘 Emergent Preview Server - Complete Guide

## 🖥️ Server Health Monitor - Updated!

### What's New?
✅ Now shows **"Awake Time"** instead of "Offline Time"  
✅ Timer starts from the moment server wakes up  
✅ Centered display at top of screen  
✅ Helpful deployment tip included  

### Display States:

**1. Server Online (Green)**
```
🟢 Server Online • 🕐 Awake: 0:45
```
- Shows how long the server has been awake
- Timer updates every second
- Visible at top-center of all pages

**2. Server Sleeping (Orange)**
```
⚠️ Preview Server Sleeping
The preview server has gone to sleep due to inactivity.
Make any request to wake it up.

💡 Tip: For 24/7 availability, deploy your app (costs 50 credits/month)
```

---

## 🔄 Preview Server Behavior

### Sleep/Wake Cycle:
- **Automatic Sleep**: Preview servers go to sleep after periods of inactivity
- **Wake Up**: Any HTTP request to the server will wake it up
- **Wake Time**: Usually takes 5-30 seconds to fully wake up
- **Active Period**: Exact timing not documented, but typically stays active while you're actively using it

### Important Notes:
- ⚠️ Preview servers are **not meant for production use**
- ⚠️ Server may sleep during periods of inactivity
- ⚠️ No guaranteed uptime
- ✅ Perfect for development and testing
- ✅ Automatically updates when you make code changes

---

## 💡 Best Practices for Preview Server

### 1. **For Active Development**
- Keep a browser tab open and refresh periodically
- Make requests every few minutes to keep server awake
- Use the preview to test UI/UX changes in real-time
- Verify components render correctly

### 2. **Before Deploying**
- ✅ Always test in preview first
- ✅ Check all user interfaces and interactions
- ✅ Verify responsive design on different screen sizes
- ✅ Test all features end-to-end
- ✅ Check browser console for errors

### 3. **For Production/Real Users**
- 🚀 **Deploy your app** for 24/7 availability
- 💰 Cost: 50 credits/month
- ✅ No sleep/wake cycles
- ✅ Better performance
- ✅ Reliable for real users

### 4. **Handling "App Not Loading" Issues**

#### Common Causes:
1. **Server is sleeping** → Wait 10-30 seconds for wake up
2. **Code error** → Check browser console (F12)
3. **Backend crash** → Check backend logs
4. **Network timeout** → Refresh the page

#### Troubleshooting Steps:
```bash
# 1. Check if server is responding
curl https://driver-roster-1.preview.emergentagent.com/api/health

# 2. Check backend logs
tail -n 100 /var/log/supervisor/backend.err.log

# 3. Check frontend build
tail -n 50 /var/log/supervisor/frontend.err.log

# 4. Restart services if needed
sudo supervisorctl restart all
```

#### Getting Help:
- Copy the complete error message from browser console
- Paste in chat and ask: "solve this error"
- Agent will analyze and provide specific solutions

---

## 🎯 Quick Tips

### Development Workflow:
1. ✅ Write code in the agent chat
2. ✅ Test in preview server
3. ✅ Verify functionality works
4. ✅ Deploy when ready for production

### Testing Checklist:
- [ ] All pages load correctly
- [ ] Forms submit properly
- [ ] API calls work
- [ ] Authentication functions
- [ ] Mobile responsive design
- [ ] No console errors
- [ ] Data displays correctly

### Performance Tips:
- Keep preview tab active during development
- Refresh page if it's been idle for a while
- Wait 10-30 seconds after server wake-up
- Check ServerHealthMonitor for awake time

---

## 📞 Support & Resources

### Need Help?
- **Discord**: https://discord.gg/VzKfwCXC4A
- **Email**: support@emergent.sh
- **In Chat**: Ask the agent to "solve this error" with error details

### For Production:
- Deploy your app for 24/7 availability
- Cost: 50 credits/month
- No more sleep/wake cycles
- Better performance and reliability

---

## 🔧 Technical Details

### Server Health Monitor Implementation:
- **Check Interval**: Every 30 seconds
- **Health Endpoint**: `/api/health`
- **Timeout**: 5 seconds per check
- **Display**: Top-center of screen
- **Awake Timer**: Updates every second

### File Location:
```
/app/frontend/src/components/ServerHealthMonitor.jsx
```

### Changes Made:
1. Changed from "offline duration" to "awake duration"
2. Timer starts when server comes online
3. Resets when server goes offline
4. Shows helpful deployment tip
5. Centered display for better visibility

---

**Last Updated**: November 11, 2024  
**Status**: ✅ All fixes implemented and tested
