import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DashboardPage from '../../../pages/DashboardPage';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock AuthContext with authenticated user
const mockAuthContext = {
  isAuthenticated: true,
  user: { id: 'test-user', username: 'testuser', created_at: '2024-01-01' },
  sessionToken: 'test-token',
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  validateSession: vi.fn(),
  refreshSession: vi.fn(),
  saveApiCredentials: vi.fn(),
  getApiCredentials: vi.fn(),
  hasApiCredentials: vi.fn(),
  error: null,
  clearError: vi.fn(),
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Real-time Updates', () => {
    it('should update market data in real-time', async () => {
      render(<DashboardPage />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
      });

      // Check initial market data is displayed
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('TCS')).toBeInTheDocument();

      // Fast-forward time to trigger real-time updates
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Market data should still be present (prices may have changed)
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('TCS')).toBeInTheDocument();
    });

    it('should update position P&L in real-time', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Open Positions')).toBeInTheDocument();
      });

      // Check that positions are displayed
      const positionElements = screen.getAllByText(/₹/);
      expect(positionElements.length).toBeGreaterThan(0);

      // Fast-forward time to trigger P&L updates
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // P&L should still be displayed (values may have changed)
      const updatedPositionElements = screen.getAllByText(/₹/);
      expect(updatedPositionElements.length).toBeGreaterThan(0);
    });

    it('should show live indicator when connected', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument();
      });

      // Check for pulse animation indicators
      const pulseElements = document.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });
  });

  describe('Trading Controls', () => {
    it('should handle start/stop trading actions', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
      });

      // Initially should show stop trading (since trading is active by default)
      expect(screen.getByText('Stop Trading')).toBeInTheDocument();

      // Click stop trading
      fireEvent.click(screen.getByText('Stop Trading'));

      await waitFor(() => {
        expect(screen.getByText('Start Trading')).toBeInTheDocument();
      });

      // Click start trading
      fireEvent.click(screen.getByText('Start Trading'));

      await waitFor(() => {
        expect(screen.getByText('Stop Trading')).toBeInTheDocument();
      });
    });

    it('should handle emergency stop with confirmation', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('EMERGENCY STOP')).toBeInTheDocument();
      });

      // Click emergency stop
      fireEvent.click(screen.getByText('EMERGENCY STOP'));

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText('Emergency Stop Confirmation')).toBeInTheDocument();
      });

      // Confirm emergency stop
      const confirmButtons = screen.getAllByText('EMERGENCY STOP');
      const confirmButton = confirmButtons.find(btn => 
        btn.closest('[role="dialog"]')
      );
      
      if (confirmButton) {
        fireEvent.click(confirmButton);
        
        await waitFor(() => {
          expect(screen.getByText('Start Trading')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Connection Status', () => {
    it('should display connection status and allow reconnection', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Should show WebSocket badge
      expect(screen.getByText('WebSocket')).toBeInTheDocument();

      // Should show market status
      expect(screen.getByText('Market Open')).toBeInTheDocument();

      // Test reconnection functionality
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });

      // Should show reconnect button
      const reconnectButton = screen.getByText('Reconnect');
      fireEvent.click(reconnectButton);

      // Should show connecting state
      await waitFor(() => {
        expect(screen.getByText('Connecting')).toBeInTheDocument();
      });
    });
  });

  describe('Market Data Display', () => {
    it('should display NIFTY 50 stocks with real-time data', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Market Watch')).toBeInTheDocument();
      });

      // Should display multiple NIFTY 50 stocks
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('TCS')).toBeInTheDocument();
      expect(screen.getByText('HDFCBANK')).toBeInTheDocument();
      expect(screen.getByText('INFY')).toBeInTheDocument();

      // Should show price information
      const priceElements = screen.getAllByText(/₹[0-9,]+\.[0-9]+/);
      expect(priceElements.length).toBeGreaterThan(0);

      // Should show change information
      const changeElements = screen.getAllByText(/[+-][0-9]+\.[0-9]+%/);
      expect(changeElements.length).toBeGreaterThan(0);
    });

    it('should handle quick trade actions', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Market Watch')).toBeInTheDocument();
      });

      // Should have buy and sell buttons
      const buyButtons = screen.getAllByText('Buy');
      const sellButtons = screen.getAllByText('Sell');
      
      expect(buyButtons.length).toBeGreaterThan(0);
      expect(sellButtons.length).toBeGreaterThan(0);

      // Test quick buy action
      fireEvent.click(buyButtons[0]);
      
      // Should not throw errors (actual trading would be handled by backend)
      expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
    });

    it('should support filtering and favorites', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Market Watch')).toBeInTheDocument();
      });

      // Should have filter buttons
      expect(screen.getByText(/All \([0-9]+\)/)).toBeInTheDocument();
      expect(screen.getByText(/Gainers \([0-9]+\)/)).toBeInTheDocument();
      expect(screen.getByText(/Losers \([0-9]+\)/)).toBeInTheDocument();
      expect(screen.getByText(/Favorites \([0-9]+\)/)).toBeInTheDocument();

      // Test filtering
      fireEvent.click(screen.getByText(/Gainers/));
      
      // Should still show stocks (gainers only)
      expect(screen.getByText('Market Watch')).toBeInTheDocument();

      // Test favorites toggle
      const starButtons = document.querySelectorAll('svg.lucide-star-off');
      if (starButtons.length > 0) {
        fireEvent.click(starButtons[0]);
        // Should not throw errors
        expect(screen.getByText('Market Watch')).toBeInTheDocument();
      }
    });
  });

  describe('Position Management', () => {
    it('should display positions with real-time P&L', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Open Positions')).toBeInTheDocument();
      });

      // Should show position cards
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('LONG')).toBeInTheDocument();

      // Should show P&L information
      expect(screen.getByText('P&L')).toBeInTheDocument();
      
      // Should show entry and current prices
      expect(screen.getByText('Entry Price')).toBeInTheDocument();
      expect(screen.getByText('Current Price')).toBeInTheDocument();
    });

    it('should handle position actions', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Open Positions')).toBeInTheDocument();
      });

      // Should have close position buttons
      const closeButtons = screen.getAllByText('Close Position');
      expect(closeButtons.length).toBeGreaterThan(0);

      // Test close position
      fireEvent.click(closeButtons[0]);
      
      // Should handle the action without errors
      expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
    });
  });

  describe('Order Book', () => {
    it('should display orders with status tracking', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Order Book')).toBeInTheDocument();
      });

      // Should show order summary
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Executed')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();

      // Should show individual orders
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('TCS')).toBeInTheDocument();
    });

    it('should handle order actions', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Order Book')).toBeInTheDocument();
      });

      // Should have action buttons for applicable orders
      const cancelButtons = screen.getAllByText('Cancel');
      if (cancelButtons.length > 0) {
        fireEvent.click(cancelButtons[0]);
        // Should handle the action without errors
        expect(screen.getByText('Order Book')).toBeInTheDocument();
      }
    });
  });

  describe('Dashboard Metrics', () => {
    it('should display key trading metrics', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Account Balance')).toBeInTheDocument();
      });

      // Should show all key metrics
      expect(screen.getByText('Today\'s P&L')).toBeInTheDocument();
      expect(screen.getByText('Open Positions')).toBeInTheDocument();
      expect(screen.getByText('Active Strategies')).toBeInTheDocument();

      // Should show metric values
      const currencyElements = screen.getAllByText(/₹[0-9,]+/);
      expect(currencyElements.length).toBeGreaterThan(0);
    });

    it('should show trading status correctly', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Trading Active')).toBeInTheDocument();
      });

      // Should show market status
      expect(screen.getByText('Market Open')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle and display errors gracefully', async () => {
      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
      });

      // Trigger an action that might cause an error
      const emergencyButton = screen.getByText('EMERGENCY STOP');
      fireEvent.click(emergencyButton);

      // Should handle errors without crashing
      expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Responsive Updates', () => {
    it('should maintain real-time updates during user interactions', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
      });

      // Interact with the dashboard while real-time updates are running
      const refreshButton = screen.getByRole('button', { name: '' });
      fireEvent.click(refreshButton);

      // Fast-forward time to trigger updates
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Dashboard should still be functional
      expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Market Watch')).toBeInTheDocument();
    });

    it('should update connection status dynamically', async () => {
      render(<DashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Simulate connection changes
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });

      // Real-time updates should adapt to connection status
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should still show disconnected state
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });
});