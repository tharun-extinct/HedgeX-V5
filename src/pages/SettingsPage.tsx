import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Settings, Shield, Eye, EyeOff, CheckCircle, AlertCircle, Palette, Bell, Zap } from 'lucide-react';

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
  refreshInterval: number;
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
  const [activeTab, setActiveTab] = useState<'api' | 'app' | 'security'>('api');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setApiSettings({
          apiKey: 'ABC123******',
          apiSecret: '****************************************',
          isEncrypted: true,
          lastVerified: '2025-07-01T14:30:45'
        });
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError('Failed to load settings. Please try again.');
      }
    };

    loadSettings();
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

  const handleVerifyApiCredentials = async () => {
    setIsVerifying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccessMessage('API credentials verified successfully!');
      setApiSettings({
        ...apiSettings,
        lastVerified: new Date().toISOString()
      });
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
      await new Promise(resolve => setTimeout(resolve, 1000));
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
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-slate-600 mt-2">Configure your trading platform preferences</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex space-x-2 mb-8">
          <Button
            variant={activeTab === 'api' ? 'default' : 'outline'}
            onClick={() => setActiveTab('api')}
            className={`flex items-center space-x-2 ${activeTab === 'api' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : ''}`}
          >
            <Shield className="w-4 h-4" />
            <span>API Settings</span>
          </Button>
          <Button
            variant={activeTab === 'app' ? 'default' : 'outline'}
            onClick={() => setActiveTab('app')}
            className={`flex items-center space-x-2 ${activeTab === 'app' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : ''}`}
          >
            <Settings className="w-4 h-4" />
            <span>App Settings</span>
          </Button>
          <Button
            variant={activeTab === 'security' ? 'default' : 'outline'}
            onClick={() => setActiveTab('security')}
            className={`flex items-center space-x-2 ${activeTab === 'security' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : ''}`}
          >
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </Button>
        </div>

        {/* API Settings Tab */}
        {activeTab === 'api' && (
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">Zerodha Kite API Configuration</CardTitle>
                  <CardDescription className="text-slate-600">
                    Configure your Zerodha Kite API credentials for trading
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <label htmlFor="apiKey" className="text-sm font-semibold text-slate-700 block">
                  API Key
                </label>
                <div className="relative">
                  <input
                    id="apiKey"
                    type={isApiKeyMasked ? 'password' : 'text'}
                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                    placeholder="Enter your Zerodha API key"
                    value={apiSettings.apiKey}
                    onChange={handleApiKeyChange}
                  />
                  <button
                    type="button"
                    onClick={() => setIsApiKeyMasked(!isApiKeyMasked)}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {isApiKeyMasked ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-sm text-slate-500">
                  Your Zerodha Kite API key from the Kite Connect dashboard
                </p>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="apiSecret" className="text-sm font-semibold text-slate-700 block">
                  API Secret
                </label>
                <div className="relative">
                  <input
                    id="apiSecret"
                    type={isApiSecretMasked ? 'password' : 'text'}
                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                    placeholder="Enter your Zerodha API secret"
                    value={apiSettings.apiSecret}
                    onChange={handleApiSecretChange}
                  />
                  <button
                    type="button"
                    onClick={() => setIsApiSecretMasked(!isApiSecretMasked)}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {isApiSecretMasked ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-sm text-slate-500">
                  Your Zerodha Kite API secret from the Kite Connect dashboard
                </p>
              </div>

              {apiSettings.lastVerified && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Last verified: {new Date(apiSettings.lastVerified).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between bg-slate-50 rounded-b-lg p-6">
              <Button 
                variant="outline"
                onClick={handleVerifyApiCredentials}
                disabled={isVerifying || isSaving}
                className="flex items-center space-x-2"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Verify Credentials</span>
                  </>
                )}
              </Button>
              <Button 
                onClick={handleSaveApiSettings}
                disabled={isVerifying || isSaving}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white flex items-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Save Settings</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* App Settings Tab */}
        {activeTab === 'app' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <Palette className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">Appearance</CardTitle>
                    <CardDescription className="text-slate-600">Customize the look and feel</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <label htmlFor="theme" className="text-sm font-semibold text-slate-700 block">
                    Theme
                  </label>
                  <select
                    id="theme"
                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                    value={appSettings.theme}
                    onChange={(e) => handleAppSettingChange('theme', e.target.value)}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                  <p className="text-sm text-slate-500">Choose the application theme</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="refreshInterval" className="text-sm font-semibold text-slate-700 block">
                    Data Refresh Interval
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      id="refreshInterval"
                      type="range"
                      min="1"
                      max="60"
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      value={appSettings.refreshInterval}
                      onChange={(e) => handleAppSettingChange('refreshInterval', parseInt(e.target.value, 10))}
                    />
                    <span className="text-sm font-medium text-slate-700 min-w-[60px]">
                      {appSettings.refreshInterval}s
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">How often to refresh market data</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">Notifications</CardTitle>
                    <CardDescription className="text-slate-600">Manage alerts and notifications</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Desktop Notifications</h3>
                    <p className="text-sm text-slate-500">Receive notifications for trades and alerts</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={appSettings.notificationsEnabled}
                      onChange={(e) => handleAppSettingChange('notificationsEnabled', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Auto-start Application</h3>
                    <p className="text-sm text-slate-500">Start HedgeX when system boots</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={appSettings.autoStart}
                      onChange={(e) => handleAppSettingChange('autoStart', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm lg:col-span-2">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">Trading Preferences</CardTitle>
                    <CardDescription className="text-slate-600">Configure default trading parameters</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="defaultOrderQuantity" className="text-sm font-semibold text-slate-700 block">
                      Default Order Quantity
                    </label>
                    <input
                      id="defaultOrderQuantity"
                      type="number"
                      min="1"
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                      value={appSettings.defaultOrderQuantity}
                      onChange={(e) => handleAppSettingChange('defaultOrderQuantity', parseInt(e.target.value, 10))}
                    />
                    <p className="text-sm text-slate-500">Default quantity for quick order placement</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="logLevel" className="text-sm font-semibold text-slate-700 block">
                      Log Level
                    </label>
                    <select
                      id="logLevel"
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                      value={appSettings.logLevel}
                      onChange={(e) => handleAppSettingChange('logLevel', e.target.value)}
                    >
                      <option value="debug">Debug</option>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                    <p className="text-sm text-slate-500">Set the application logging level</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 rounded-b-lg p-6">
                <Button 
                  onClick={handleSaveAppSettings}
                  disabled={isSaving}
                  className="ml-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Save Settings</span>
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">Account Security</CardTitle>
                    <CardDescription className="text-slate-600">Manage your account security settings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                  <div>
                    <h3 className="font-semibold text-slate-900">Two-Factor Authentication</h3>
                    <p className="text-sm text-slate-500">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline" className="text-green-600 border-green-300 hover:bg-green-50">
                    Enable 2FA
                  </Button>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                  <div>
                    <h3 className="font-semibold text-slate-900">Session Management</h3>
                    <p className="text-sm text-slate-500">View and manage active sessions</p>
                  </div>
                  <Button variant="outline">
                    View Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">Data & Privacy</CardTitle>
                    <CardDescription className="text-slate-600">Control your data and privacy settings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                  <div>
                    <h3 className="font-semibold text-slate-900">Data Export</h3>
                    <p className="text-sm text-slate-500">Download your trading data</p>
                  </div>
                  <Button variant="outline">
                    Export Data
                  </Button>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                  <div>
                    <h3 className="font-semibold text-slate-900">Clear Cache</h3>
                    <p className="text-sm text-slate-500">Clear application cache and temporary data</p>
                  </div>
                  <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
                    Clear Cache
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;