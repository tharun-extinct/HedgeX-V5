import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import App from '../../App';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core');
const mockInvoke = vi.mocked(invoke);

// Helper to render app
const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('Complete Trading Workflow E2E', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full user journey from registration to trading', async () => {
    const user = userEvent.setup();
    
    // Set up API mocks for the complete workflow
    let callCount = 0;
    mockInvoke.mockImplementation((command, args) => {
      callCount++;
      
      switch (command) {
        // Registration flow
        case 'create_user':
          return Promise.resolve({
            success: true,
            message: 'User created successfully',
            user_id: 'new-user-id'
          });
        
        // Login flow
        case 'login':
          return Promise.resolve('session-token-123');
        
        case 'get_user_info':
          return Promise.resolve({
            id: 'new-user-id',
            username: args?.userId === 'new-user-id' ? 'newuser' : 'testuser',
            created_at: '2025-01-01T00:00:00Z'
          });
        
        case 'validate_session':
          return Promise.resolve('new-user-id');
        
        // API credentials
        case 'store_api_credentials':
          return Promise.resolve(true);
        
        case 'get_api_credentials':
          return Promise.resolve({
            api_key: 'test-api-key',
            api_secret: 'test-api-secret'
          });
        
        // Strategy management
        case 'get_strategies':
          if (callCount <= 5) {
            return Promise.resolve({ success: true, data: [] });
          }
          return Promise.resolve({
            success: true,
            data: [{
              id: 'strategy_1',
              user_id: 'new-user-id',
              name: 'My First Strategy',
              description: 'A basic trading strategy',
              enabled: true,
              max_trades_per_day: 10,
              risk_percentage: 2.0,
              stop_loss_percentage: 1.5,
              take_profit_percentage: 3.0,
              volume_threshold: 100000,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z'
            }]
          });
        
        case 'create_strategy':
          return Promise.resolve({
            success: true,
            data: {
              id: 'strategy_1',
              user_id: 'new-user-id',
              ...args,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z'
            }
          });
        
        // Stock selection
        case 'get_nifty_50_stocks':
          return Promise.resolve({
            success: true,
            data: [
              ['RELIANCE', 'Reliance Industries Ltd'],
              ['TCS', 'Tata Consultancy Services Ltd'],
              ['HDFCBANK', 'HDFC Bank Ltd']
            ]
          });
        
        case 'get_stock_selections':
          return Promise.resolve({
            success: true,
            data: []
          });
        
        case 'add_stock_selection':
          return Promise.resolve({
            success: true,
            data: {
              id: 'selection_1',
              user_id: 'new-user-id',
              symbol: args?.symbol || 'RELIANCE',
              exchange: 'NSE',
              is_active: true
            }
          });
        
        // Trading operations
        case 'start_trading':
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
              timestamp: new Date().toISOString(),
              change: '15.75',
              change_percent: '0.62'
            }
          ]);
        
        case 'get_recent_trades':
          return Promise.resolve([]);
        
        case 'place_quick_order':
          return Promise.resolve({
            success: true,
            order_id: 'order_123'
          });
        
        default:
          return Promise.resolve([]);
      }
    });

    renderApp();

    // Step 1: User Registration
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    
    const signupLink = screen.getByText(/sign up/i);
    await user.click(signupLink);
    
    await waitFor(() => {
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    });
    
    // Fill registration form
    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
    
    const createAccountButton = screen.getByRole('button', { name: /create account/i });
    await user.click(createAccountButton);
    
    // Wait for registration success
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_user', expect.objectContaining({
        username: 'newuser',
        password: 'newpassword123'
      }));
    });

    // Step 2: User Login (after registration redirect)
    await waitFor(() => {
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    });
    
    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/password/i), 'newpassword123');
    
    const signInButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(signInButton);
    
    // Wait for login and dashboard load
    await waitFor(() => {
      expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Step 3: Set up API credentials (navigate to settings)
    const settingsLink = screen.getByRole('link', { name: /settings/i });
    await user.click(settingsLink);
    
    await waitFor(() => {
      expect(screen.getByText(/settings/i)).toBeInTheDocument();
    });
    
    // Fill API credentials form
    await user.type(screen.getByLabelText(/api key/i), 'test-api-key');
    await user.type(screen.getByLabelText(/api secret/i), 'test-api-secret');
    
    const saveCredentialsButton = screen.getByRole('button', { name: /save credentials/i });
    await user.click(saveCredentialsButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('store_api_credentials', expect.objectContaining({
        userId: 'new-user-id',
        credentials: expect.objectContaining({
          api_key: 'test-api-key',
          api_secret: 'test-api-secret'
        })
      }));
    });

    // Step 4: Create a trading strategy
    const strategiesLink = screen.getByRole('link', { name: /strategies/i });
    await user.click(strategiesLink);
    
    await waitFor(() => {
      expect(screen.getByText(/trading strategies/i)).toBeInTheDocument();
    });
    
    const createStrategyButton = screen.getByRole('button', { name: /create new strategy/i });
    await user.click(createStrategyButton);
    
    // Fill strategy form
    await user.type(screen.getByLabelText(/strategy name/i), 'My First Strategy');
    await user.type(screen.getByLabelText(/description/i), 'A basic trading strategy');
    await user.clear(screen.getByLabelText(/max trades per day/i));
    await user.type(screen.getByLabelText(/max trades per day/i), '10');
    await user.clear(screen.getByLabelText(/risk percentage/i));
    await user.type(screen.getByLabelText(/risk percentage/i), '2.0');
    
    const createButton = screen.getByRole('button', { name: /create strategy/i });
    await user.click(createButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_strategy', expect.objectContaining({
        name: 'My First Strategy',
        description: 'A basic trading strategy',
        max_trades_per_day: 10,
        risk_percentage: 2.0
      }));
    });

    // Step 5: Select stocks for trading
    await waitFor(() => {
      expect(screen.getByText(/trading strategies/i)).toBeInTheDocument();
    });
    
    const manageStocksButton = screen.getByRole('button', { name: /manage stocks/i });
    await user.click(manageStocksButton);
    
    await waitFor(() => {
      expect(screen.getByText(/stock selection/i)).toBeInTheDocument();
    });
    
    // Select RELIANCE stock
    const relianceCheckbox = screen.getByRole('checkbox', { name: /RELIANCE/i });
    await user.click(relianceCheckbox);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add_stock_selection', 'RELIANCE', 'NSE');
    });

    // Step 6: Return to dashboard and start trading
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    await user.click(dashboardLink);
    
    await waitFor(() => {
      expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
    });
    
    // Start trading
    const startTradingButton = screen.getByRole('button', { name: /start trading/i });
    await user.click(startTradingButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('start_trading');
    });
    
    // Should show trading active status
    await waitFor(() => {
      expect(screen.getByText(/trading active/i)).toBeInTheDocument();
    });

    // Step 7: Monitor market data and place a trade
    await waitFor(() => {
      expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
      expect(screen.getByText(/2540.50/)).toBeInTheDocument();
    });
    
    // Place a quick buy order
    const buyButton = screen.getByRole('button', { name: /buy/i });
    await user.click(buyButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('place_quick_order', expect.objectContaining({
        symbol: 'RELIANCE',
        action: 'BUY'
      }));
    });

    // Step 8: Verify the complete workflow
    // Check that all major API calls were made
    expect(mockInvoke).toHaveBeenCalledWith('create_user', expect.any(Object));
    expect(mockInvoke).toHaveBeenCalledWith('login', expect.any(Object));
    expect(mockInvoke).toHaveBeenCalledWith('store_api_credentials', expect.any(Object));
    expect(mockInvoke).toHaveBeenCalledWith('create_strategy', expect.any(Object));
    expect(mockInvoke).toHaveBeenCalledWith('add_stock_selection', expect.any(String), expect.any(String));
    expect(mockInvoke).toHaveBeenCalledWith('start_trading');
    expect(mockInvoke).toHaveBeenCalledWith('place_quick_order', expect.any(Object));
    
    // Verify session persistence
    expect(localStorage.getItem('hedgex_session_token')).toBe('session-token-123');
    
    // Verify UI state
    expect(screen.getByText(/trading active/i)).toBeInTheDocument();
    expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
  }, 30000); // Increase timeout for complex workflow

  it('should handle errors gracefully throughout the workflow', async () => {
    const user = userEvent.setup();
    
    // Mock API with intermittent failures
    let callCount = 0;
    mockInvoke.mockImplementation((command, args) => {
      callCount++;
      
      switch (command) {
        case 'create_user':
          if (callCount === 1) {
            return Promise.resolve({
              success: false,
              message: 'Username already exists'
            });
          }
          return Promise.resolve({
            success: true,
            message: 'User created successfully',
            user_id: 'new-user-id'
          });
        
        case 'login':
          if (callCount === 2) {
            return Promise.reject(new Error('Invalid credentials'));
          }
          return Promise.resolve('session-token-123');
        
        case 'validate_session':
          return Promise.resolve('new-user-id');
        
        case 'get_user_info':
          return Promise.resolve({
            id: 'new-user-id',
            username: 'testuser',
            created_at: '2025-01-01T00:00:00Z'
          });
        
        case 'start_trading':
          return Promise.reject(new Error('Trading service unavailable'));
        
        case 'get_market_data':
          return Promise.resolve([]);
        
        default:
          return Promise.resolve([]);
      }
    });

    renderApp();

    // Step 1: Registration failure
    const signupLink = screen.getByText(/sign up/i);
    await user.click(signupLink);
    
    await user.type(screen.getByLabelText(/username/i), 'existinguser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    
    const createAccountButton = screen.getByRole('button', { name: /create account/i });
    await user.click(createAccountButton);
    
    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
    });

    // Step 2: Retry registration with different username
    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.click(createAccountButton);
    
    // Should succeed this time
    await waitFor(() => {
      expect(screen.getByText(/user created successfully/i) || screen.getByText(/sign in/i)).toBeInTheDocument();
    });

    // Step 3: Login failure
    if (screen.getByText(/sign in to your account/i)) {
      await user.type(screen.getByLabelText(/username/i), 'newuser');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      
      const signInButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(signInButton);
      
      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Step 4: Retry login with correct password
      await user.clear(screen.getByLabelText(/password/i));
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(signInButton);
      
      // Should succeed
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });
    }

    // Step 5: Trading service failure
    const startTradingButton = screen.getByRole('button', { name: /start trading/i });
    await user.click(startTradingButton);
    
    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/trading service unavailable/i)).toBeInTheDocument();
    });
    
    // Should still show start trading button (not changed to stop)
    expect(screen.getByRole('button', { name: /start trading/i })).toBeInTheDocument();
  }, 20000);

  it('should maintain state across page navigation', async () => {
    const user = userEvent.setup();
    
    // Set up authenticated session
    localStorage.setItem('hedgex_session_token', 'existing-token');
    localStorage.setItem('hedgex_session_expiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    localStorage.setItem('hedgex_user_data', JSON.stringify({
      id: 'test-user-id',
      username: 'testuser',
      created_at: '2025-01-01T00:00:00Z'
    }));
    
    // Mock APIs
    mockInvoke.mockImplementation((command) => {
      switch (command) {
        case 'validate_session':
          return Promise.resolve('test-user-id');
        case 'get_strategies':
          return Promise.resolve({ success: true, data: [] });
        case 'get_market_data':
          return Promise.resolve([]);
        case 'get_recent_trades':
          return Promise.resolve([]);
        default:
          return Promise.resolve([]);
      }
    });

    renderApp();

    // Should automatically load dashboard
    await waitFor(() => {
      expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
    });

    // Navigate to strategies
    const strategiesLink = screen.getByRole('link', { name: /strategies/i });
    await user.click(strategiesLink);
    
    await waitFor(() => {
      expect(screen.getByText(/trading strategies/i)).toBeInTheDocument();
    });

    // Navigate back to dashboard
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    await user.click(dashboardLink);
    
    await waitFor(() => {
      expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
    });

    // Session should still be valid
    expect(localStorage.getItem('hedgex_session_token')).toBe('existing-token');
  });
});