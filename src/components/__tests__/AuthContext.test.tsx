import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

// Get the mocked invoke function
const mockInvoke = vi.mocked(invoke);

// Test component that uses auth context
const TestComponent: React.FC = () => {
  const { 
    isAuthenticated, 
    user, 
    login, 
    logout, 
    register, 
    isLoading, 
    error,
    saveApiCredentials,
    hasApiCredentials 
  } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">
        {isLoading ? 'Loading' : isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      <div data-testid="user-info">
        {user ? user.username : 'No User'}
      </div>
      <div data-testid="error">
        {error || 'No Error'}
      </div>
      <button 
        data-testid="login-btn" 
        onClick={() => login({ username: 'testuser', password: 'testpass' })}
      >
        Login
      </button>
      <button 
        data-testid="register-btn" 
        onClick={() => register({ username: 'testuser', password: 'testpass' })}
      >
        Register
      </button>
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
      <button 
        data-testid="save-api-btn" 
        onClick={() => saveApiCredentials({ api_key: 'test', api_secret: 'secret' })}
      >
        Save API
      </button>
      <button 
        data-testid="check-api-btn" 
        onClick={async () => {
          const hasApi = await hasApiCredentials();
          console.log('Has API:', hasApi);
        }}
      >
        Check API
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
    
    // Mock window.__TAURI__ to simulate Tauri environment
    (window as any).__TAURI__ = {};
  });

  afterEach(() => {
    // Clean up
    delete (window as any).__TAURI__;
  });

  it('should initialize with unauthenticated state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('No User');
    });
  });

  it('should handle successful login', async () => {
    const mockSessionData = {
      token: 'test-token',
      user_id: 'user-123',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      created_at: new Date().toISOString(),
    };

    mockInvoke
      .mockResolvedValueOnce(mockSessionData) // login call
      .mockResolvedValueOnce(mockUser); // get_user_info call

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    // Click login button
    fireEvent.click(screen.getByTestId('login-btn'));

    // Wait for login to complete
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('testuser');
    }, { timeout: 3000 });

    // Verify Tauri invoke was called
    expect(mockInvoke).toHaveBeenCalledWith('login', { username: 'testuser', password: 'testpass' });
  });

  it('should handle login failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    // Click login button
    fireEvent.click(screen.getByTestId('login-btn'));

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    }, { timeout: 3000 });
  });

  it('should handle successful registration', async () => {
    const mockResult = {
      success: true,
      token: 'test-token',
      user: {
        id: 'user-123',
        username: 'testuser',
        created_at: new Date().toISOString(),
      },
    };

    mockInvoke.mockResolvedValueOnce(mockResult);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    // Click register button
    fireEvent.click(screen.getByTestId('register-btn'));

    // Wait for registration to complete
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('testuser');
    });
  });

  it('should handle logout', async () => {
    // Set up authenticated state
    localStorage.setItem('hedgex_session_token', 'test-token');
    localStorage.setItem('hedgex_session_expiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    localStorage.setItem('hedgex_user_data', JSON.stringify({
      id: 'user-123',
      username: 'testuser',
      created_at: new Date().toISOString(),
    }));

    mockInvoke.mockResolvedValueOnce('user-123'); // validate_session
    mockInvoke.mockResolvedValueOnce(undefined); // logout

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for auth to initialize
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    });

    // Click logout button
    fireEvent.click(screen.getByTestId('logout-btn'));

    // Wait for logout to complete
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('No User');
    });

    // Verify localStorage was cleared
    expect(localStorage.getItem('hedgex_session_token')).toBeNull();
  });

  it('should handle API credentials management', async () => {
    // Set up authenticated state
    localStorage.setItem('hedgex_session_token', 'test-token');
    localStorage.setItem('hedgex_session_expiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    localStorage.setItem('hedgex_user_data', JSON.stringify({
      id: 'user-123',
      username: 'testuser',
      created_at: new Date().toISOString(),
    }));

    mockInvoke
      .mockResolvedValueOnce('user-123') // validate_session
      .mockResolvedValueOnce(undefined); // store_api_credentials

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for auth to initialize
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    }, { timeout: 3000 });

    // Save API credentials
    fireEvent.click(screen.getByTestId('save-api-btn'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('store_api_credentials', expect.objectContaining({
        userId: 'user-123',
        credentials: expect.objectContaining({
          api_key: 'test',
          api_secret: 'secret',
        }),
      }));
    }, { timeout: 3000 });
  });

  it('should work in web mode without Tauri', async () => {
    // Remove Tauri mock
    delete (window as any).__TAURI__;

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    // Click login button (should work in web mode)
    fireEvent.click(screen.getByTestId('login-btn'));

    // Wait for login to complete (web mode simulation)
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('testuser');
    });
  });
});