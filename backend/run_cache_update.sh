#!/bin/bash
# Daily Analytics Cache Update Cron Job
# Runs every day at 2 AM to pre-compute analytics data

# Add to crontab:
# 0 2 * * * /app/backend/run_cache_update.sh >> /var/log/analytics_cache.log 2>&1

echo "======================================================"
echo "Analytics Cache Update Started: $(date)"
echo "======================================================"

cd /app/backend
python analytics_cache.py

echo "======================================================"
echo "Analytics Cache Update Completed: $(date)"
echo "======================================================"
