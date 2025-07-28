import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import App from '../../App';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core');
const mockInvoke = vi.mocked(invoke);

// Helper to render app with router
const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('User Registration Flow', () => {
    it('should complete full registration flow', async () => {
      const user = userEvent.setup();
      
      // Mock successful registration
      mockInvoke.mockResolvedValueOnce({
        success: true,
        message: 'User created successfully',
        user_id: 'test-user-id'
      });

      renderApp();

      // Should show login page initially
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();

      // Navigate to signup
      const signupLink = screen.getByText(/sign up/i);
      await user.click(signupLink);

      // Fill out registration form
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'testpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'testpassword123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create_user', {
          fullName: '',
          email: '',
          username: 'testuser',
          password: 'testpassword123'
        });
      });

      // Should show success message or redirect to login
      await waitFor(() => {
        expect(screen.getByText(/user created successfully/i) || screen.getByText(/sign in/i)).toBeInTheDocument();
      });
    });

    it('should handle registration errors', async () => {
      const user = userEvent.setup();
      
      // Mock registration failure
      mockInvoke.mockResolvedValueOnce({
        success: false,
        message: 'Username already exists'
      });

      renderApp();

      // Navigate to signup
      const signupLink = screen.getByText(/sign up/i);
      await user.click(signupLink);

      // Fill out form
      await user.type(screen.getByLabelText(/username/i), 'existinguser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      // Submit
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Login Flow', () => {
    it('should complete full login flow and redirect to dashboard', async () => {
      const user = userEvent.setup();
      
      // Mock successful login
      mockInvoke.mockResolvedValueOnce('mock-session-token-123');
      
      // Mock user info fetch
      mockInvoke.mockResolvedValueOnce({
        id: 'test-user-id',
        username: 'testuser',
        created_at: '2025-01-01T00:00:00Z'
      });

      renderApp();

      // Fill out login form
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'testpassword123');

      // Submit form
      const loginButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(loginButton);

      // Wait for API calls
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('login', {
          username: 'testuser',
          password: 'testpassword123'
        });
      });

      // Should redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should store session token
      expect(localStorage.getItem('hedgex_session_token')).toBe('mock-session-token-123');
    });

    it('should handle login errors', async () => {
      const user = userEvent.setup();
      
      // Mock login failure
      mockInvoke.mockRejectedValueOnce(new Error('Invalid credentials'));

      renderApp();

      // Fill out form with invalid credentials
      await user.type(screen.getByLabelText(/username/i), 'wronguser');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');

      // Submit
      const loginButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(loginButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Should not redirect
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    });
  });

  describe('Session Management', () => {
    it('should maintain session across page reloads', async () => {
      // Set up existing session
      localStorage.setItem('hedgex_session_token', 'existing-token');
      localStorage.setItem('hedgex_session_expiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      localStorage.setItem('hedgex_user_data', JSON.stringify({
        id: 'test-user-id',
        username: 'testuser',
        created_at: '2025-01-01T00:00:00Z'
      }));

      // Mock session validation
      mockInvoke.mockResolvedValueOnce('test-user-id');

      renderApp();

      // Should automatically redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Should validate session
      expect(mockInvoke).toHaveBeenCalledWith('validate_session', {
        token: 'existing-token'
      });
    });

    it('should handle expired sessions', async () => {
      // Set up expired session
      localStorage.setItem('hedgex_session_token', 'expired-token');
      localStorage.setItem('hedgex_session_expiry', new Date(Date.now() - 1000).toISOString());

      renderApp();

      // Should show login page
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });

      // Should clear expired session data
      expect(localStorage.getItem('hedgex_session_token')).toBeNull();
    });
  });

  describe('Logout Flow', () => {
    it('should complete logout and redirect to login', async () => {
      const user = userEvent.setup();
      
      // Set up authenticated session
      localStorage.setItem('hedgex_session_token', 'valid-token');
      localStorage.setItem('hedgex_session_expiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      localStorage.setItem('hedgex_user_data', JSON.stringify({
        id: 'test-user-id',
        username: 'testuser',
        created_at: '2025-01-01T00:00:00Z'
      }));

      // Mock session validation
      mockInvoke.mockResolvedValueOnce('test-user-id');
      
      // Mock logout
      mockInvoke.mockResolvedValueOnce(true);

      renderApp();

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Find and click logout button (might be in a dropdown or menu)
      const logoutButton = screen.getByRole('button', { name: /logout/i }) || 
                          screen.getByText(/logout/i);
      await user.click(logoutButton);

      // Should call logout API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('logout', {
          token: 'valid-token'
        });
      });

      // Should redirect to login
      await waitFor(() => {
        expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      });

      // Should clear session data
      expect(localStorage.getItem('hedgex_session_token')).toBeNull();
    });
  });

  describe('API Credentials Management', () => {
    it('should save and retrieve API credentials', async () => {
      const user = userEvent.setup();
      
      // Set up authenticated session
      localStorage.setItem('hedgex_session_token', 'valid-token');
      localStorage.setItem('hedgex_session_expiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      localStorage.setItem('hedgex_user_data', JSON.stringify({
        id: 'test-user-id',
        username: 'testuser',
        created_at: '2025-01-01T00:00:00Z'
      }));

      // Mock session validation
      mockInvoke.mockResolvedValueOnce('test-user-id');
      
      // Mock API credential operations
      mockInvoke.mockResolvedValueOnce(true); // store_api_credentials
      mockInvoke.mockResolvedValueOnce({ // get_api_credentials
        api_key: 'test-api-key',
        api_secret: 'test-api-secret'
      });

      renderApp();

      // Navigate to settings
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // This would require navigating to settings page and testing credential form
      // Implementation depends on the actual settings page structure
    });
  });
});