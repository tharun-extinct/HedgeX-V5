import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('WebSocket Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection on dashboard load', async () => {
      // Mock WebSocket connection APIs
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'connected',
              last_connected: new Date().toISOString(),
              subscriptions: ['RELIANCE', 'TCS']
            });
          case 'connect_websocket':
            return Promise.resolve(true);
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

      // Should load dashboard and establish WebSocket connection
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Should show connected status
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Should call WebSocket connection APIs
      expect(mockInvoke).toHaveBeenCalledWith('get_websocket_status');
    });

    it('should handle WebSocket connection failures', async () => {
      const user = userEvent.setup();
      
      // Mock WebSocket connection failure
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'failed',
              error: 'Connection timeout',
              last_connected: null
            });
          case 'reconnect_websocket':
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

      // Should show connection failed status
      await waitFor(() => {
        expect(screen.getByText(/connection timeout/i)).toBeInTheDocument();
      });

      // Should show reconnect button
      const reconnectButton = screen.getByRole('button', { name: /reconnect/i });
      expect(reconnectButton).toBeInTheDocument();

      // Click reconnect
      await user.click(reconnectButton);

      // Should call reconnect API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('reconnect_websocket');
      });
    });

    it('should handle WebSocket disconnection and reconnection', async () => {
      const user = userEvent.setup();
      
      let connectionStatus = 'connected';
      
      // Mock WebSocket status changes
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: connectionStatus,
              last_connected: connectionStatus === 'connected' ? new Date().toISOString() : null
            });
          case 'disconnect_websocket':
            connectionStatus = 'disconnected';
            return Promise.resolve(true);
          case 'reconnect_websocket':
            connectionStatus = 'connected';
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

      // Should show connected status
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Find disconnect button
      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      await user.click(disconnectButton);

      // Should call disconnect API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('disconnect_websocket');
      });

      // Should show disconnected status
      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
      });

      // Should show reconnect button
      const reconnectButton = screen.getByRole('button', { name: /reconnect/i });
      await user.click(reconnectButton);

      // Should call reconnect API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('reconnect_websocket');
      });
    });
  });

  describe('Real-time Market Data Updates', () => {
    it('should receive and display real-time market data updates', async () => {
      let marketDataCallCount = 0;
      
      // Mock real-time market data updates
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'connected',
              last_connected: new Date().toISOString()
            });
          case 'get_market_data':
            marketDataCallCount++;
            const basePrice = 2540.50;
            const priceVariation = (marketDataCallCount - 1) * 0.25; // Simulate price movement
            
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: (basePrice + priceVariation).toString(),
                volume: 1250000 + (marketDataCallCount * 1000),
                bid: (basePrice + priceVariation - 0.05).toString(),
                ask: (basePrice + priceVariation + 0.05).toString(),
                timestamp: new Date().toISOString(),
                change: priceVariation.toString(),
                change_percent: ((priceVariation / basePrice) * 100).toString()
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

      // Should show initial market data
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
        expect(screen.getByText(/2540.50/)).toBeInTheDocument();
      });

      // Wait for real-time updates (simulated by interval calls)
      await waitFor(() => {
        expect(screen.getByText(/2540.75/)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should show updated volume
      await waitFor(() => {
        expect(screen.getByText(/1,251,000/)).toBeInTheDocument();
      });
    });

    it('should handle market data subscription changes', async () => {
      const user = userEvent.setup();
      
      // Mock subscription management
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'connected',
              subscriptions: ['RELIANCE']
            });
          case 'subscribe_to_instruments':
            return Promise.resolve(true);
          case 'unsubscribe_from_instruments':
            return Promise.resolve(true);
          case 'get_market_data':
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: '2540.50',
                volume: 1250000,
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

      // Should show subscribed instruments
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
      });

      // Add to favorites (which should trigger subscription)
      const favoriteButton = screen.getByRole('button', { name: /add to favorites/i });
      if (favoriteButton) {
        await user.click(favoriteButton);
        
        // Should call subscription API
        await waitFor(() => {
          expect(mockInvoke).toHaveBeenCalledWith('subscribe_to_instruments', expect.any(Array));
        });
      }
    });

    it('should handle WebSocket message parsing errors', async () => {
      // Mock WebSocket with invalid data
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'connected',
              error: 'Invalid message format received'
            });
          case 'get_market_data':
            return Promise.reject(new Error('Failed to parse market data'));
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid message format/i)).toBeInTheDocument();
      });
    });
  });

  describe('Position Updates via WebSocket', () => {
    it('should update positions in real-time', async () => {
      let positionUpdateCount = 0;
      
      // Mock position updates
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'connected',
              last_connected: new Date().toISOString()
            });
          case 'get_positions':
            positionUpdateCount++;
            const basePnL = 155.00;
            const pnlChange = (positionUpdateCount - 1) * 10; // Simulate P&L changes
            
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                exchange: 'NSE',
                quantity: 10,
                average_price: 2525.00,
                current_price: 2540.50 + (positionUpdateCount * 0.25),
                pnl: basePnL + pnlChange,
                pnl_percentage: ((basePnL + pnlChange) / (2525.00 * 10)) * 100,
                trade_type: 'Buy',
                last_updated: new Date().toISOString()
              }
            ]);
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

      // Should show initial position
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
        expect(screen.getByText(/155.00/)).toBeInTheDocument();
      });

      // Wait for position updates
      await waitFor(() => {
        expect(screen.getByText(/165.00/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Order Updates via WebSocket', () => {
    it('should update order status in real-time', async () => {
      let orderUpdateCount = 0;
      
      // Mock order status updates
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'connected',
              last_connected: new Date().toISOString()
            });
          case 'get_orders':
            orderUpdateCount++;
            const status = orderUpdateCount === 1 ? 'Pending' : 'Executed';
            
            return Promise.resolve([
              {
                id: 'order_1',
                symbol: 'RELIANCE',
                exchange: 'NSE',
                order_type: 'Limit',
                trade_type: 'Buy',
                quantity: 5,
                price: 2530.00,
                filled_quantity: status === 'Executed' ? 5 : 0,
                pending_quantity: status === 'Executed' ? 0 : 5,
                status: status,
                updated_at: new Date().toISOString()
              }
            ]);
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

      // Should show initial order status
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
        expect(screen.getByText(/Pending/i)).toBeInTheDocument();
      });

      // Wait for order status update
      await waitFor(() => {
        expect(screen.getByText(/Executed/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('WebSocket Error Recovery', () => {
    it('should automatically reconnect on connection loss', async () => {
      let connectionAttempts = 0;
      
      // Mock connection recovery
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            connectionAttempts++;
            if (connectionAttempts === 1) {
              return Promise.resolve({
                status: 'connected',
                last_connected: new Date().toISOString()
              });
            } else if (connectionAttempts === 2) {
              return Promise.resolve({
                status: 'disconnected',
                error: 'Connection lost'
              });
            } else {
              return Promise.resolve({
                status: 'connected',
                last_connected: new Date().toISOString()
              });
            }
          case 'reconnect_websocket':
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

      // Should initially show connected
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Simulate connection loss detection
      await waitFor(() => {
        expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should automatically attempt reconnection
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('reconnect_websocket');
      });

      // Should show connected again after recovery
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle exponential backoff on repeated failures', async () => {
      let reconnectAttempts = 0;
      
      // Mock repeated connection failures
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'failed',
              error: 'Connection failed',
              retry_count: reconnectAttempts
            });
          case 'reconnect_websocket':
            reconnectAttempts++;
            if (reconnectAttempts < 3) {
              return Promise.reject(new Error('Connection failed'));
            }
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

      // Should show connection failed
      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      });

      // Should show retry count
      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Performance', () => {
    it('should handle high-frequency market data updates', async () => {
      let updateCount = 0;
      const maxUpdates = 100;
      
      // Mock high-frequency updates
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({
              status: 'connected',
              last_connected: new Date().toISOString(),
              message_rate: '50/sec'
            });
          case 'get_market_data':
            updateCount++;
            if (updateCount > maxUpdates) {
              return Promise.resolve([]);
            }
            
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: (2540.50 + (Math.random() - 0.5) * 2).toString(),
                volume: 1250000 + updateCount,
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

      // Should handle high-frequency updates without crashing
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
      });

      // Should show message rate indicator
      await waitFor(() => {
        expect(screen.getByText(/50\/sec/i)).toBeInTheDocument();
      });

      // UI should remain responsive
      expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
    });
  });
});