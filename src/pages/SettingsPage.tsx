import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface ApiSettings {
  apiKey: string;
  apiSecret: string;
  isEncrypted: boolean;
  lastVerified: string | null;
}

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  autoStart: boolean;
  notificationsEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warning' | 'error';
  defaultOrderQuantity: number;
  refreshInterval: number; // in seconds
}

const SettingsPage: React.FC = () => {
  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    apiKey: '',
    apiSecret: '',
    isEncrypted: false,
    lastVerified: null
  });

  const [appSettings, setAppSettings] = useState<AppSettings>({
    theme: 'system',
    autoStart: false,
    notificationsEnabled: true,
    logLevel: 'info',
    defaultOrderQuantity: 1,
    refreshInterval: 5
  });

  const [isApiKeyMasked, setIsApiKeyMasked] = useState(true);
  const [isApiSecretMasked, setIsApiSecretMasked] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'app'>('api');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // In a real implementation, these would be actual Tauri commands
        const apiConfig = await invoke<ApiSettings>('get_api_settings');
        setApiSettings(apiConfig);

        const appConfig = await invoke<AppSettings>('get_app_settings');
        setAppSettings(appConfig);
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError('Failed to load settings. Please try again.');
      }
    };

    loadSettings();
    
    // For demo purposes, set some mock data
    setApiSettings({
      apiKey: 'ABC123******',
      apiSecret: '****************************************',
      isEncrypted: true,
      lastVerified: '2025-07-01T14:30:45'
    });
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiSettings({
      ...apiSettings,
      apiKey: e.target.value
    });
  };

  const handleApiSecretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiSettings({
      ...apiSettings,
      apiSecret: e.target.value
    });
  };

  const toggleApiKeyVisibility = () => {
    setIsApiKeyMasked(!isApiKeyMasked);
  };

  const toggleApiSecretVisibility = () => {
    setIsApiSecretMasked(!isApiSecretMasked);
  };

  const handleVerifyApiCredentials = async () => {
    setIsVerifying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // In a real implementation, this would be an actual Tauri command
      const isValid = await invoke<boolean>('verify_api_credentials', {
        apiKey: apiSettings.apiKey,
        apiSecret: apiSettings.apiSecret
      });

      if (isValid) {
        setSuccessMessage('API credentials verified successfully!');
        setApiSettings({
          ...apiSettings,
          lastVerified: new Date().toISOString()
        });
      } else {
        setError('Invalid API credentials. Please check and try again.');
      }
    } catch (err) {
      console.error('Failed to verify API credentials:', err);
      setError('Failed to verify API credentials. Please check your connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveApiSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // In a real implementation, this would be an actual Tauri command
      await invoke('save_api_settings', {
        apiKey: apiSettings.apiKey,
        apiSecret: apiSettings.apiSecret,
        encrypt: true
      });

      setSuccessMessage('API settings saved successfully!');
      setApiSettings({
        ...apiSettings,
        isEncrypted: true
      });
    } catch (err) {
      console.error('Failed to save API settings:', err);
      setError('Failed to save API settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAppSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // In a real implementation, this would be an actual Tauri command
      await invoke('save_app_settings', { settings: appSettings });
      setSuccessMessage('Application settings saved successfully!');
    } catch (err) {
      console.error('Failed to save application settings:', err);
      setError('Failed to save application settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAppSettingChange = (setting: keyof AppSettings, value: any) => {
    setAppSettings({
      ...appSettings,
      [setting]: value
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md mb-6">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md mb-6">
          {successMessage}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'api' ? 'default' : 'outline'}
          onClick={() => setActiveTab('api')}
          className="min-w-[100px]"
        >
          API Settings
        </Button>
        <Button
          variant={activeTab === 'app' ? 'default' : 'outline'}
          onClick={() => setActiveTab('app')}
          className="min-w-[100px]"
        >
          App Settings
        </Button>
      </div>

      {activeTab === 'api' ? (
        <Card>
          <CardHeader>
            <CardTitle>Zerodha Kite API Configuration</CardTitle>
            <CardDescription>
              Configure your Zerodha Kite API credentials for trading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label 
                htmlFor="apiKey" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                API Key
              </label>
              <div className="relative">
                <input
                  id="apiKey"
                  type={isApiKeyMasked ? 'password' : 'text'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           ring-offset-background file:border-0 file:bg-transparent
                           file:text-sm file:font-medium placeholder:text-muted-foreground
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                           focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={apiSettings.apiKey}
                  onChange={handleApiKeyChange}
                />
                <button
                  type="button"
                  onClick={toggleApiKeyVisibility}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                >
                  {isApiKeyMasked ? 'Show' : 'Hide'}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Your Zerodha Kite API key from the Kite Connect dashboard
              </p>
            </div>
            
            <div className="space-y-2">
              <label 
                htmlFor="apiSecret" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                API Secret
              </label>
              <div className="relative">
                <input
                  id="apiSecret"
                  type={isApiSecretMasked ? 'password' : 'text'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           ring-offset-background file:border-0 file:bg-transparent
                           file:text-sm file:font-medium placeholder:text-muted-foreground
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                           focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={apiSettings.apiSecret}
                  onChange={handleApiSecretChange}
                />
                <button
                  type="button"
                  onClick={toggleApiSecretVisibility}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                >
                  {isApiSecretMasked ? 'Show' : 'Hide'}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Your Zerodha Kite API secret from the Kite Connect dashboard
              </p>
            </div>

            {apiSettings.lastVerified && (
              <div className="text-sm text-muted-foreground mt-4">
                Last verified: {new Date(apiSettings.lastVerified).toLocaleString()}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline"
              onClick={handleVerifyApiCredentials}
              disabled={isVerifying || isSaving}
            >
              {isVerifying ? 'Verifying...' : 'Verify Credentials'}
            </Button>
            <Button 
              onClick={handleSaveApiSettings}
              disabled={isVerifying || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Application Settings</CardTitle>
            <CardDescription>
              Configure general application preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label 
                htmlFor="theme" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Theme
              </label>
              <select
                id="theme"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         ring-offset-background file:border-0 file:bg-transparent
                         file:text-sm file:font-medium placeholder:text-muted-foreground
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                         focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={appSettings.theme}
                onChange={(e) => handleAppSettingChange('theme', e.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
              <p className="text-sm text-muted-foreground">
                Choose the application theme
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoStart"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={appSettings.autoStart}
                onChange={(e) => handleAppSettingChange('autoStart', e.target.checked)}
              />
              <label 
                htmlFor="autoStart" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Auto-start application on system login
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="notifications"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={appSettings.notificationsEnabled}
                onChange={(e) => handleAppSettingChange('notificationsEnabled', e.target.checked)}
              />
              <label 
                htmlFor="notifications" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enable desktop notifications
              </label>
            </div>

            <div className="space-y-2">
              <label 
                htmlFor="logLevel" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Log Level
              </label>
              <select
                id="logLevel"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         ring-offset-background file:border-0 file:bg-transparent
                         file:text-sm file:font-medium placeholder:text-muted-foreground
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                         focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={appSettings.logLevel}
                onChange={(e) => handleAppSettingChange('logLevel', e.target.value)}
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
              <p className="text-sm text-muted-foreground">
                Set the application logging level
              </p>
            </div>

            <div className="space-y-2">
              <label 
                htmlFor="defaultOrderQuantity" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Default Order Quantity
              </label>
              <input
                id="defaultOrderQuantity"
                type="number"
                min="1"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         ring-offset-background file:border-0 file:bg-transparent
                         file:text-sm file:font-medium placeholder:text-muted-foreground
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                         focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={appSettings.defaultOrderQuantity}
                onChange={(e) => handleAppSettingChange('defaultOrderQuantity', parseInt(e.target.value, 10))}
              />
              <p className="text-sm text-muted-foreground">
                Default quantity for quick order placement
              </p>
            </div>

            <div className="space-y-2">
              <label 
                htmlFor="refreshInterval" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Data Refresh Interval (seconds)
              </label>
              <input
                id="refreshInterval"
                type="number"
                min="1"
                max="60"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         ring-offset-background file:border-0 file:bg-transparent
                         file:text-sm file:font-medium placeholder:text-muted-foreground
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                         focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={appSettings.refreshInterval}
                onChange={(e) => handleAppSettingChange('refreshInterval', parseInt(e.target.value, 10))}
              />
              <p className="text-sm text-muted-foreground">
                How often to refresh market data (1-60 seconds)
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleSaveAppSettings}
              disabled={isSaving}
              className="ml-auto"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default SettingsPage;
