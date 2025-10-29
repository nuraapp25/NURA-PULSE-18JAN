import React, { useState, useEffect } from 'react';
import { API, useAuth } from '@/App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Settings, Loader2, CheckCircle, AlertCircle, Zap, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AppSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Hidden apps list
  const hiddenApps = [
    { 
      name: "Ride Pay Extract v2", 
      icon: Zap, 
      path: "/dashboard/ride-pay-extract-v2",
      description: "Advanced payment reconciliation with AI-powered data extraction"
    }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/app-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data.settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaymentExtractor = async (enabled) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/app-settings?payment_extractor_enabled=${enabled}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update settings');
      }

      const data = await response.json();
      setSettings(data.settings);
      toast.success(data.message);
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Settings className="h-8 w-8" />
          App Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage application features and configurations
        </p>
      </div>

      {user?.account_type !== 'master_admin' && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to modify these settings. Only Master Admins can change app settings.
          </AlertDescription>
        </Alert>
      )}

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Feature Toggles
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            Enable or disable application features for all users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Data Extractor Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
            <div className="space-y-1">
              <Label className="text-base font-semibold dark:text-white">
                Payment Data Extractor
              </Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Allow users to upload and process payment screenshots. When disabled, users will see a notification that the app is under maintenance.
              </p>
              <div className="flex items-center gap-2 mt-2">
                {settings?.payment_extractor_enabled ? (
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Currently Enabled
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    Currently Disabled
                  </span>
                )}
              </div>
            </div>
            <Switch
              checked={settings?.payment_extractor_enabled || false}
              onCheckedChange={handleTogglePaymentExtractor}
              disabled={updating || user?.account_type !== 'master_admin'}
              className="data-[state=checked]:bg-green-600"
            />
          </div>

          {updating && (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Updating settings...
              </AlertDescription>
            </Alert>
          )}

          {user?.account_type === 'master_admin' && (
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> When you disable an app, all users will be unable to access it. They will see a message directing them to contact you for the new app link.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AppSettings;
