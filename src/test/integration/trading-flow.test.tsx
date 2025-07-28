import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import App from '../../App';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core');
const mockInvoke = vi.mocked(invoke);

// Helper to set up authenticated session
const setupAuthenticatedSession = () => {
  localStorage.setItem('hedgex_session_token', 'valid-token');
  localStorage.setItem('hedgex_session_expiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  localStorage.setItem('hedgex_user_data', JSON.stringify({
    id: 'test-user-id',
    username: 'testuser',
    created_at: '2025-01-01T00:00:00Z'
  }));
};

// Helper to render authenticated app
const renderAuthenticatedApp = () => {
  setupAuthenticatedSession();
  
  // Mock session validation
  mockInvoke.mockResolvedValueOnce('test-user-id');
  
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('Trading Flow Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard Data Loading', () => {
    it('should load dashboard data on authentication', async () => {
      // Mock dashboard data APIs
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_market_data':
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: '2540.50',
                volume: 1250000,
                bid: '2540.00',
                ask: '2540.50',
                timestamp: new Date().toISOString(),
                change: '15.75',
                change_percent: '0.62'
              }
            ]);
          case 'get_recent_trades':
            return Promise.resolve([]);
          default:
            return Promise.resolve(null);
        }
      });

      renderAuthenticatedApp();

      // Should load dashboard
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Should display market data
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
        expect(screen.getByText(/2540.50/)).toBeInTheDocument();
      });
    });

    it('should handle market data loading errors', async () => {
      // Mock session validation success but market data failure
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_market_data':
            return Promise.reject(new Error('Market data service unavailable'));
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
      });
    });
  });

  describe('Trading Controls', () => {
    it('should start and stop trading', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'start_trading':
            return Promise.resolve(true);
          case 'stop_trading':
            return Promise.resolve(true);
          case 'get_market_data':
            return Promise.resolve([]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Find start trading button
      const startButton = screen.getByRole('button', { name: /start trading/i });
      await user.click(startButton);

      // Should call start_trading API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('start_trading');
      });

      // Should show stop trading button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop trading/i })).toBeInTheDocument();
      });

      // Click stop trading
      const stopButton = screen.getByRole('button', { name: /stop trading/i });
      await user.click(stopButton);

      // Should call stop_trading API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('stop_trading');
      });
    });

    it('should handle emergency stop', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'emergency_stop':
            return Promise.resolve(true);
          case 'get_market_data':
            return Promise.resolve([]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Find emergency stop button
      const emergencyButton = screen.getByRole('button', { name: /emergency stop/i });
      await user.click(emergencyButton);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });

      // Confirm emergency stop
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should call emergency_stop API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('emergency_stop');
      });
    });
  });

  describe('Real-time Data Updates', () => {
    it('should update market data in real-time', async () => {
      let marketDataCallCount = 0;
      
      // Mock APIs with changing data
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_market_data':
            marketDataCallCount++;
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: (2540.50 + marketDataCallCount).toString(),
                volume: 1250000,
                bid: '2540.00',
                ask: '2540.50',
                timestamp: new Date().toISOString(),
                change: '15.75',
                change_percent: '0.62'
              }
            ]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Initial price
      await waitFor(() => {
        expect(screen.getByText(/2541.50/)).toBeInTheDocument();
      });

      // Wait for real-time update (simulated)
      await waitFor(() => {
        expect(screen.getByText(/2542.50/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Position Management', () => {
    it('should display and manage positions', async () => {
      const user = userEvent.setup();
      
      // Mock APIs with position data
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_positions':
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                exchange: 'NSE',
                quantity: 10,
                average_price: 2525.00,
                current_price: 2540.50,
                pnl: 155.00,
                pnl_percentage: 0.61,
                trade_type: 'Buy'
              }
            ]);
          case 'close_position':
            return Promise.resolve(true);
          case 'get_market_data':
            return Promise.resolve([]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Should display position
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
        expect(screen.getByText(/155.00/)).toBeInTheDocument(); // P&L
      });

      // Find close position button
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      // Should call close_position API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('close_position', { symbol: 'RELIANCE' });
      });
    });
  });

  describe('Order Management', () => {
    it('should display and manage orders', async () => {
      const user = userEvent.setup();
      
      // Mock APIs with order data
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_orders':
            return Promise.resolve([
              {
                id: 'order_1',
                symbol: 'RELIANCE',
                exchange: 'NSE',
                order_type: 'Limit',
                trade_type: 'Buy',
                quantity: 5,
                price: 2530.00,
                status: 'Pending'
              }
            ]);
          case 'cancel_order':
            return Promise.resolve(true);
          case 'get_market_data':
            return Promise.resolve([]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Should display order
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
        expect(screen.getByText(/Pending/i)).toBeInTheDocument();
      });

      // Find cancel order button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should call cancel_order API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('cancel_order', { orderId: 'order_1' });
      });
    });
  });

  describe('Quick Trading', () => {
    it('should place quick buy/sell orders', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'place_quick_order':
            return Promise.resolve({ success: true, order_id: 'quick_order_1' });
          case 'get_market_data':
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: '2540.50',
                volume: 1250000,
                bid: '2540.00',
                ask: '2540.50',
                timestamp: new Date().toISOString()
              }
            ]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Wait for market data to load
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
      });

      // Find quick buy button for RELIANCE
      const buyButton = screen.getByRole('button', { name: /buy/i });
      await user.click(buyButton);

      // Should call place_quick_order API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('place_quick_order', {
          symbol: 'RELIANCE',
          action: 'BUY',
          quantity: 1
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle trading API errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock APIs with errors
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'start_trading':
            return Promise.reject(new Error('Trading service unavailable'));
          case 'get_market_data':
            return Promise.resolve([]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Try to start trading
      const startButton = screen.getByRole('button', { name: /start trading/i });
      await user.click(startButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/trading service unavailable/i)).toBeInTheDocument();
      });
    });

    it('should handle WebSocket connection errors', async () => {
      // Mock APIs with WebSocket errors
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({ status: 'failed', error: 'Connection failed' });
          case 'get_market_data':
            return Promise.resolve([]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Should show connection error
      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      });
    });
  });
});