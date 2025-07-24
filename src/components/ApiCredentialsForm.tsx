import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Eye, EyeOff, Save, AlertCircle, CheckCircle, Key, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ApiCredentialsFormProps {
  onSave?: () => void;
  className?: string;
}

const ApiCredentialsForm: React.FC<ApiCredentialsFormProps> = ({ onSave, className }) => {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const { saveApiCredentials, getApiCredentials, hasApiCredentials } = useAuth();

  // Load existing credentials on mount
  useEffect(() => {
    const loadCredentials = async () => {
      setIsLoading(true);
      try {
        const hasCredentials = await hasApiCredentials();
        setHasExistingCredentials(hasCredentials);
        
        if (hasCredentials) {
          const credentials = await getApiCredentials();
          if (credentials) {
            setApiKey(credentials.api_key);
            // Don't show the secret for security reasons, just indicate it exists
            setApiSecret('••••••••••••••••');
          }
        }
      } catch (err) {
        console.error('Failed to load API credentials:', err);
        setError('Failed to load existing credentials');
      } finally {
        setIsLoading(false);
      }
    };

    loadCredentials();
  }, [hasApiCredentials, getApiCredentials]);

  // Clear messages when user starts typing
  useEffect(() => {
    setError(null);
    setSuccess(null);
    setValidationErrors({});
  }, [apiKey, apiSecret]);

  // Validate form inputs
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!apiKey.trim()) {
      errors.apiKey = 'API Key is required';
    } else if (apiKey.length < 10) {
      errors.apiKey = 'API Key appears to be too short';
    }

    if (!apiSecret.trim() || apiSecret === '••••••••••••••••') {
      errors.apiSecret = 'API Secret is required';
    } else if (apiSecret.length < 10) {
      errors.apiSecret = 'API Secret appears to be too short';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await saveApiCredentials({
        api_key: apiKey,
        api_secret: apiSecret,
      });
      
      setSuccess('API credentials saved successfully!');
      setHasExistingCredentials(true);
      
      // Mask the secret after saving
      setApiSecret('••••••••••••••••');
      
      if (onSave) {
        onSave();
      }
    } catch (err: any) {
      console.error('Failed to save API credentials:', err);
      setError(err.message || 'Failed to save API credentials. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSecretFocus = () => {
    if (apiSecret === '••••••••••••••••') {
      setApiSecret('');
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Credentials
          </CardTitle>
          <CardDescription>
            Loading your Zerodha Kite API credentials...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Zerodha Kite API Credentials
        </CardTitle>
        <CardDescription>
          {hasExistingCredentials 
            ? 'Update your Zerodha Kite API credentials for trading operations.'
            : 'Enter your Zerodha Kite API credentials to enable trading operations.'
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Security notice */}
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Your credentials are encrypted and stored locally
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                API credentials are encrypted using industry-standard encryption and never leave your device.
              </p>
            </div>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-4 p-3 rounded-md bg-green-50 border border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200 text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* API Key */}
          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium leading-none">
              API Key
            </label>
            <input
              id="apiKey"
              type="text"
              className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.apiKey ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
              placeholder="Enter your Zerodha API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isSaving}
              required
            />
            {validationErrors.apiKey && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.apiKey}
              </p>
            )}
          </div>

          {/* API Secret */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="apiSecret" className="text-sm font-medium leading-none">
                API Secret
              </label>
              <button
                type="button"
                onClick={() => setShowApiSecret(!showApiSecret)}
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                disabled={isSaving}
              >
                {showApiSecret ? (
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Eye className="h-3.5 w-3.5 mr-1" />
                )}
                {showApiSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="apiSecret"
              type={showApiSecret ? 'text' : 'password'}
              className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.apiSecret ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
              placeholder="Enter your Zerodha API Secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              onFocus={handleSecretFocus}
              disabled={isSaving}
              required
            />
            {validationErrors.apiSecret && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.apiSecret}
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">How to get your API credentials:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Log in to your Zerodha Kite account</li>
              <li>Go to the API section in your account settings</li>
              <li>Create a new API app or use an existing one</li>
              <li>Copy the API Key and API Secret from your app</li>
            </ol>
          </div>

          {/* Save button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Save className="h-4 w-4 mr-2" />
                {hasExistingCredentials ? 'Update Credentials' : 'Save Credentials'}
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ApiCredentialsForm;