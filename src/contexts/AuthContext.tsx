import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, AuthenticationError, ApiError } from '../lib/api-client';

// Types for authentication
export interface User {
  id: string;
  username: string;
  created_at: string;
  last_login?: string;
}

export interface SessionToken {
  token: string;
  user_id: string;
  expires_at: string;
}

export interface ApiCredentials {
  api_key: string;
  api_secret: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  full_name?: string;
  email?: string;
}

// Auth context interface
interface AuthContextType {
  // Authentication state
  isAuthenticated: boolean;
  user: User | null;
  sessionToken: string | null;
  isLoading: boolean;
  
  // Authentication methods
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  
  // Session management
  validateSession: () => Promise<boolean>;
  refreshSession: () => Promise<void>;
  
  // API credentials management
  saveApiCredentials: (credentials: ApiCredentials) => Promise<void>;
  getApiCredentials: () => Promise<ApiCredentials | null>;
  hasApiCredentials: () => Promise<boolean>;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Session storage keys
const SESSION_TOKEN_KEY = 'hedgex_session_token';
const SESSION_EXPIRY_KEY = 'hedgex_session_expiry';
const USER_DATA_KEY = 'hedgex_user_data';

// Check if we're in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clear error message
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check if session is expired
  const isSessionExpired = useCallback(() => {
    const expiryStr = localStorage.getItem(SESSION_EXPIRY_KEY);
    if (!expiryStr) return true;
    
    const expiry = new Date(expiryStr);
    return expiry <= new Date();
  }, []);

  // Clear session data
  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    setIsAuthenticated(false);
    setUser(null);
    setSessionToken(null);
  }, []);

  // Validate session with backend
  const validateSession = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    
    if (!token || isSessionExpired()) {
      clearSession();
      return false;
    }

    if (!isTauri) {
      // In web mode, just check local storage
      return true;
    }

    try {
      const userId = await apiClient.validateSession(token);
      
      // If validation succeeds, update session
      setSessionToken(token);
      setIsAuthenticated(true);
      
      // Try to get user data from localStorage or fetch it
      const userData = localStorage.getItem(USER_DATA_KEY);
      if (userData) {
        setUser(JSON.parse(userData));
      } else {
        // Fetch user data if not in localStorage
        try {
          const userInfo = await apiClient.getUserInfo(userId);
          setUser(userInfo);
          localStorage.setItem(USER_DATA_KEY, JSON.stringify(userInfo));
        } catch (err) {
          console.warn('Failed to fetch user info:', err);
        }
      }
      
      return true;
    } catch (err) {
      console.error('Session validation failed:', err);
      clearSession();
      return false;
    }
  }, [isSessionExpired, clearSession]);

  // Refresh session token
  const refreshSession = useCallback(async () => {
    if (!isTauri) return;
    
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return;

    try {
      // In a real implementation, you might have a refresh endpoint
      // For now, we'll just validate the current session
      await validateSession();
    } catch (err) {
      console.error('Session refresh failed:', err);
      clearSession();
    }
  }, [validateSession, clearSession]);

  // Login function
  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      if (isTauri) {
        const sessionToken = await apiClient.login(credentials);
        
        // Create session expiry (24 hours from now)
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        
        // Store session data
        localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
        localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime);
        
        // Validate session to get user ID
        const userId = await apiClient.validateSession(sessionToken);
        
        // Fetch user info
        const userInfo = await apiClient.getUserInfo(userId);
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(userInfo));
        
        // Update state
        setSessionToken(sessionToken);
        setUser(userInfo);
        setIsAuthenticated(true);
      } else {
        // Web mode fallback
        if (!credentials.username.trim() || !credentials.password.trim()) {
          throw new Error('Username and password are required');
        }
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockToken = `mock-session-${Date.now()}`;
        const mockExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const mockUser: User = {
          id: 'mock-user-id',
          username: credentials.username,
          created_at: new Date().toISOString(),
        };
        
        localStorage.setItem(SESSION_TOKEN_KEY, mockToken);
        localStorage.setItem(SESSION_EXPIRY_KEY, mockExpiry);
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(mockUser));
        
        setSessionToken(mockToken);
        setUser(mockUser);
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      
      let errorMessage = 'Login failed. Please check your credentials.';
      if (err instanceof AuthenticationError) {
        errorMessage = err.message;
      } else if (err instanceof ApiError) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      clearSession();
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  // Register function
  const register = useCallback(async (userData: RegisterRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      if (isTauri) {
        const result = await apiClient.createUser({
          fullName: userData.full_name || '',
          email: userData.email || '',
          username: userData.username,
          password: userData.password,
        });
        
        if (!result.success) {
          throw new Error((result as any).message || 'Registration failed');
        }
        
        // Registration successful - user needs to login separately
        // Don't auto-login for security reasons
      } else {
        // Web mode fallback
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockToken = `mock-session-${Date.now()}`;
        const mockExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const mockUser: User = {
          id: 'mock-user-id',
          username: userData.username,
          created_at: new Date().toISOString(),
        };
        
        localStorage.setItem(SESSION_TOKEN_KEY, mockToken);
        localStorage.setItem(SESSION_EXPIRY_KEY, mockExpiry);
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(mockUser));
        
        setSessionToken(mockToken);
        setUser(mockUser);
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Registration failed. Please try again.');
      clearSession();
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      
      if (isTauri && token) {
        try {
          await apiClient.logout(token);
        } catch (err) {
          console.error('Backend logout failed:', err);
          // Continue with local logout even if backend fails
        }
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearSession();
      setIsLoading(false);
    }
  }, [clearSession]);

  // Save API credentials
  const saveApiCredentials = useCallback(async (credentials: ApiCredentials) => {
    if (!isAuthenticated || !user) {
      throw new Error('User must be authenticated to save API credentials');
    }

    try {
      if (isTauri) {
        await apiClient.storeApiCredentials(user.id, {
          api_key: credentials.api_key,
          api_secret: credentials.api_secret,
        });
      } else {
        // Web mode - store in localStorage (not secure, for demo only)
        localStorage.setItem('hedgex_api_credentials', JSON.stringify(credentials));
      }
    } catch (err: any) {
      console.error('Failed to save API credentials:', err);
      
      let errorMessage = 'Failed to save API credentials';
      if (err instanceof ApiError) {
        errorMessage = err.message;
      }
      
      throw new Error(errorMessage);
    }
  }, [isAuthenticated, user]);

  // Get API credentials
  const getApiCredentials = useCallback(async (): Promise<ApiCredentials | null> => {
    if (!isAuthenticated || !user) {
      return null;
    }

    try {
      if (isTauri) {
        const credentials = await apiClient.getApiCredentials(user.id);
        return {
          api_key: credentials.api_key,
          api_secret: credentials.api_secret
        };
      } else {
        // Web mode - get from localStorage
        const stored = localStorage.getItem('hedgex_api_credentials');
        return stored ? JSON.parse(stored) : null;
      }
    } catch (err) {
      console.error('Failed to get API credentials:', err);
      return null;
    }
  }, [isAuthenticated, user]);

  // Check if user has API credentials
  const hasApiCredentials = useCallback(async (): Promise<boolean> => {
    try {
      const credentials = await getApiCredentials();
      return credentials !== null && !!credentials.api_key && !!credentials.api_secret;
    } catch (err) {
      return false;
    }
  }, [getApiCredentials]);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
      try {
        const isValid = await validateSession();
        if (!isValid) {
          clearSession();
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [validateSession, clearSession]);

  // Set up session refresh interval
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (isSessionExpired()) {
        clearSession();
      } else {
        // Refresh session 5 minutes before expiry
        const expiryStr = localStorage.getItem(SESSION_EXPIRY_KEY);
        if (expiryStr) {
          const expiry = new Date(expiryStr);
          const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
          
          if (expiry <= fiveMinutesFromNow) {
            refreshSession();
          }
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isAuthenticated, isSessionExpired, clearSession, refreshSession]);

  // Listen for storage changes (multi-tab support)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_TOKEN_KEY) {
        if (e.newValue) {
          // Session created in another tab
          validateSession();
        } else {
          // Session removed in another tab
          clearSession();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [validateSession, clearSession]);

  const contextValue: AuthContextType = {
    isAuthenticated,
    user,
    sessionToken,
    isLoading,
    login,
    register,
    logout,
    validateSession,
    refreshSession,
    saveApiCredentials,
    getApiCredentials,
    hasApiCredentials,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;