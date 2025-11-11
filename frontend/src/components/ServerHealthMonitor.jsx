import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { API } from '@/App';

const ServerHealthMonitor = () => {
  const [serverStatus, setServerStatus] = useState('checking'); // 'online', 'offline', 'checking'
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [awakeDuration, setAwakeDuration] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [serverWakeTime, setServerWakeTime] = useState(null);
  
  const HEALTH_CHECK_INTERVAL = 30000; // Check every 30 seconds
  const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds timeout for health check

  // Function to check server health
  const checkServerHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
      
      const response = await axios.get(`${API}/health`, {
        signal: controller.signal,
        timeout: HEALTH_CHECK_TIMEOUT
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const wasOffline = serverStatus === 'offline';
        setServerStatus('online');
        setLastCheckTime(new Date());
        setIsWakingUp(false);
        
        // Set server wake time when it comes online from offline state
        if (wasOffline || !serverWakeTime) {
          setServerWakeTime(new Date());
          setAwakeDuration(0);
        }
        
        // Hide notification after 3 seconds if server comes back online
        if (wasOffline) {
          setTimeout(() => setShowNotification(false), 3000);
        }
      }
    } catch (error) {
      console.warn('Server health check failed:', error.message);
      setServerStatus('offline');
      setLastCheckTime(new Date());
      setShowNotification(true);
      setServerWakeTime(null);
      setAwakeDuration(0);
    }
  }, [serverStatus, serverWakeTime]);

  // Function to wake up server (makes a request to trigger wake)
  const wakeUpServer = async () => {
    setIsWakingUp(true);
    try {
      // Make multiple requests to different endpoints to wake up the server
      const wakeRequests = [
        axios.get(`${API}/health`, { timeout: 10000 }),
        axios.get(`${API}/`, { timeout: 10000 }),
      ];
      
      await Promise.race(wakeRequests);
      await checkServerHealth();
    } catch (error) {
      console.log('Wake up in progress...');
      // Continue checking health
      setTimeout(checkServerHealth, 5000);
    }
  };

  // Initial health check and set up interval
  useEffect(() => {
    checkServerHealth();
    
    const interval = setInterval(() => {
      checkServerHealth();
    }, HEALTH_CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [checkServerHealth]);

  // Track awake duration
  useEffect(() => {
    if (serverStatus === 'online' && serverWakeTime) {
      const interval = setInterval(() => {
        setAwakeDuration((prev) => prev + 1);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [serverStatus, serverWakeTime]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate time until shutdown
  const timeUntilShutdown = Math.max(0, SHUTDOWN_WARNING_TIME - offlineDuration);
  const minutesUntilShutdown = Math.floor(timeUntilShutdown / 60);
  const isNearShutdown = timeUntilShutdown < 5 * 60; // Less than 5 minutes

  if (serverStatus === 'checking') {
    return null; // Don't show anything during initial check
  }

  if (serverStatus === 'online' && !showNotification) {
    // Minimal indicator when server is online - centered at top
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Server Online</span>
        </div>
      </div>
    );
  }

  if (serverStatus === 'offline') {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md">
        <Alert className={`${isNearShutdown ? 'bg-red-500' : 'bg-orange-500'} text-white border-0 shadow-2xl`}>
          <AlertCircle className="h-5 w-5 text-white" />
          <AlertDescription className="ml-2">
            <div className="space-y-2">
              <div className="font-bold text-lg">
                ⚠️ Preview Server Sleeping
              </div>
              
              <div className="text-sm">
                The preview server has gone to sleep due to inactivity.
              </div>
              
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="w-4 h-4" />
                <span>Offline for: {formatTime(offlineDuration)}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
};

export default ServerHealthMonitor;
