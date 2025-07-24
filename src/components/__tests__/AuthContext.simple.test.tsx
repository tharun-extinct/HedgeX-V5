import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Simple test component
const TestComponent: React.FC = () => {
  const { isAuthenticated, user, login, logout, error, isLoading } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Ready'}</div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user-info">{user ? user.username : 'No User'}</div>
      <div data-testid="error">{error || 'No Error'}</div>
      <button 
        data-testid="login-btn" 
        onClick={() => login({ username: 'testuser', password: 'testpass' })}
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
    </div>
  );
};

describe('AuthContext - Web Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    // Ensure we're in web mode (no Tauri)
    delete (window as any).__TAURI__;
  });

  it('should initialize with unauthenticated state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('No User');
      expect(screen.getByTestId('error')).toHaveTextContent('No Error');
    });
  });

  it('should handle login in web mode', async () => {
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

    // Wait for login to complete (web mode simulation)
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('testuser');
    }, { timeout: 3000 });
  });

  it('should handle logout', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // First login
    fireEvent.click(screen.getByTestId('login-btn'));
    
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    });

    // Then logout
    fireEvent.click(screen.getByTestId('logout-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('No User');
    });
  });

  it('should persist session across page reloads', async () => {
    // Simulate existing session
    const mockToken = 'test-token';
    const mockExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      created_at: new Date().toISOString(),
    };

    localStorage.setItem('hedgex_session_token', mockToken);
    localStorage.setItem('hedgex_session_expiry', mockExpiry);
    localStorage.setItem('hedgex_user_data', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should initialize as authenticated in web mode
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('testuser');
    });
  });

  it('should clear expired sessions', async () => {
    // Simulate expired session
    const mockToken = 'expired-token';
    const mockExpiry = new Date(Date.now() - 1000).toISOString(); // Expired
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      created_at: new Date().toISOString(),
    };

    localStorage.setItem('hedgex_session_token', mockToken);
    localStorage.setItem('hedgex_session_expiry', mockExpiry);
    localStorage.setItem('hedgex_user_data', JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should clear expired session and show as unauthenticated
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('No User');
    });

    // Verify localStorage was cleared
    expect(localStorage.getItem('hedgex_session_token')).toBeNull();
  });
});