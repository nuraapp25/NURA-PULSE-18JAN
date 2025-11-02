# Analytics Cache System - Setup Instructions

## Overview
This system pre-computes heavy analytics data daily and caches results for instant frontend display.

## Features
- **Battery Audit Cache**: Pre-computed battery charge drop analysis
- **Morning Charge Audit Cache**: Pre-computed low morning charge instances
- **Auto-fallback**: Falls back to live computation if cache is stale (>24 hours)
- **Manual Refresh**: Admins can trigger manual cache refresh

## Setup Instructions

### 1. Install Cron Job (Production Only)
```bash
# Open crontab editor
crontab -e

# Add this line to run daily at 2 AM
0 2 * * * /app/backend/run_cache_update.sh >> /var/log/analytics_cache.log 2>&1
```

### 2. Manual Cache Refresh
**Option A: Via API (Recommended)**
```bash
curl -X POST http://your-domain/api/montra-vehicle/refresh-analytics-cache \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Option B: Via Command Line**
```bash
cd /app/backend
python analytics_cache.py
```

### 3. Check Cache Status
The cache is automatically used when:
- Cache exists in `analytics_cache` collection
- Cache age is less than 24 hours
- Otherwise, falls back to live computation

## Cache Collection Structure
```javascript
{
  "_id": ObjectId("..."),
  "cache_type": "battery_audit" | "morning_charge_audit",
  "computed_at": "2024-12-15T02:00:00.000Z",
  "data": {
    "success": true,
    "audit_results": [...],
    "count": 150,
    "message": "..."
  }
}
```

## Performance Impact
- **Before**: 10-30 seconds load time (or timeout)
- **After**: <1 second (instant cache retrieval)
- **Cache Computation**: 1-2 minutes (runs in background daily)

## Data Retention
- Last **30 days** of data (configurable in analytics_cache.py)
- Previous setting was 90 days (caused timeouts)

## Troubleshooting

### Cache not updating?
```bash
# Check logs
tail -f /var/log/analytics_cache.log

# Verify cron job
crontab -l

# Check MongoDB collection
# In MongoDB shell or client:
db.analytics_cache.find({})
```

### Force immediate cache refresh
```bash
cd /app/backend
python analytics_cache.py
```

### Disable caching (fallback to live)
Add `?force_refresh=true` to API calls:
```
GET /api/montra-vehicle/battery-audit?force_refresh=true
GET /api/montra-vehicle/morning-charge-audit?force_refresh=true
```

## Monitoring
- Cache age shown in API response messages
- Backend logs show cache hits/misses
- Manual refresh available for admins in production

## Future Enhancements
- Add more analytics to cache
- Implement cache warming on data import
- Add cache status dashboard
