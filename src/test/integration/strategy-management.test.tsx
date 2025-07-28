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

// Mock strategy data
const mockStrategy = {
  id: 'strategy_1',
  user_id: 'test-user-id',
  name: 'Test Strategy',
  description: 'A test trading strategy',
  enabled: true,
  max_trades_per_day: 10,
  risk_percentage: 2.0,
  stop_loss_percentage: 1.5,
  take_profit_percentage: 3.0,
  volume_threshold: 100000,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

describe('Strategy Management Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Strategy List View', () => {
    it('should load and display strategies', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: [mockStrategy]
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      // Should load strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading strategies/i)).toBeInTheDocument();
      });

      // Should display strategy
      await waitFor(() => {
        expect(screen.getByText(/Test Strategy/i)).toBeInTheDocument();
        expect(screen.getByText(/A test trading strategy/i)).toBeInTheDocument();
        expect(screen.getByText(/ACTIVE/i)).toBeInTheDocument();
      });

      // Should call get_strategies API
      expect(mockInvoke).toHaveBeenCalledWith('get_strategies');
    });

    it('should handle empty strategy list', async () => {
      const user = userEvent.setup();
      
      // Mock empty strategies
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: []
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText(/no strategies found/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first strategy/i)).toBeInTheDocument();
      });
    });
  });

  describe('Strategy Creation', () => {
    it('should create a new strategy', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: []
            });
          case 'create_strategy':
            return Promise.resolve({
              success: true,
              data: { ...mockStrategy, ...args }
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      await waitFor(() => {
        expect(screen.getByText(/trading strategies/i)).toBeInTheDocument();
      });

      // Click create new strategy
      const createButton = screen.getByRole('button', { name: /create new strategy/i });
      await user.click(createButton);

      // Should show strategy form
      await waitFor(() => {
        expect(screen.getByText(/create strategy/i)).toBeInTheDocument();
      });

      // Fill out form
      await user.type(screen.getByLabelText(/strategy name/i), 'New Test Strategy');
      await user.type(screen.getByLabelText(/description/i), 'A new test strategy');
      await user.clear(screen.getByLabelText(/max trades per day/i));
      await user.type(screen.getByLabelText(/max trades per day/i), '15');
      await user.clear(screen.getByLabelText(/risk percentage/i));
      await user.type(screen.getByLabelText(/risk percentage/i), '2.5');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /create strategy/i });
      await user.click(saveButton);

      // Should call create_strategy API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create_strategy', expect.objectContaining({
          name: 'New Test Strategy',
          description: 'A new test strategy',
          max_trades_per_day: 15,
          risk_percentage: 2.5
        }));
      });

      // Should redirect back to list
      await waitFor(() => {
        expect(screen.getByText(/trading strategies/i)).toBeInTheDocument();
      });
    });

    it('should validate strategy form inputs', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: []
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page and create form
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      const createButton = screen.getByRole('button', { name: /create new strategy/i });
      await user.click(createButton);

      // Try to submit empty form
      const saveButton = screen.getByRole('button', { name: /create strategy/i });
      await user.click(saveButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/strategy name is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Strategy Editing', () => {
    it('should edit an existing strategy', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: [mockStrategy]
            });
          case 'update_strategy':
            return Promise.resolve({
              success: true,
              data: { ...mockStrategy, ...args }
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      await waitFor(() => {
        expect(screen.getByText(/Test Strategy/i)).toBeInTheDocument();
      });

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Should show edit form with existing values
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Test Strategy/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue(/A test trading strategy/i)).toBeInTheDocument();
      });

      // Modify strategy name
      const nameInput = screen.getByLabelText(/strategy name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Test Strategy');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /update strategy/i });
      await user.click(saveButton);

      // Should call update_strategy API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('update_strategy', 
          'strategy_1',
          expect.objectContaining({
            name: 'Updated Test Strategy'
          })
        );
      });
    });
  });

  describe('Strategy Controls', () => {
    it('should enable and disable strategies', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: [{ ...mockStrategy, enabled: false }]
            });
          case 'enable_strategy':
            return Promise.resolve({
              success: true,
              message: 'Strategy enabled successfully'
            });
          case 'disable_strategy':
            return Promise.resolve({
              success: true,
              message: 'Strategy disabled successfully'
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      await waitFor(() => {
        expect(screen.getByText(/Test Strategy/i)).toBeInTheDocument();
        expect(screen.getByText(/INACTIVE/i)).toBeInTheDocument();
      });

      // Click on strategy to select it
      const strategyCard = screen.getByText(/Test Strategy/i).closest('[role="button"]') || 
                          screen.getByText(/Test Strategy/i).closest('div');
      if (strategyCard) {
        await user.click(strategyCard);
      }

      // Find enable button
      const enableButton = screen.getByRole('button', { name: /enable/i });
      await user.click(enableButton);

      // Should call enable_strategy API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('enable_strategy', 'strategy_1');
      });
    });

    it('should delete strategies', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: [mockStrategy]
            });
          case 'delete_strategy':
            return Promise.resolve({
              success: true,
              message: 'Strategy deleted successfully'
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      await waitFor(() => {
        expect(screen.getByText(/Test Strategy/i)).toBeInTheDocument();
      });

      // Click on strategy to select it
      const strategyCard = screen.getByText(/Test Strategy/i).closest('[role="button"]') || 
                          screen.getByText(/Test Strategy/i).closest('div');
      if (strategyCard) {
        await user.click(strategyCard);
      }

      // Find delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should call delete_strategy API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('delete_strategy', 'strategy_1');
      });
    });
  });

  describe('Stock Selection Management', () => {
    it('should manage stock selections', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: []
            });
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
              data: [
                {
                  id: 'selection_1',
                  user_id: 'test-user-id',
                  symbol: 'RELIANCE',
                  exchange: 'NSE',
                  is_active: true
                }
              ]
            });
          case 'add_stock_selection':
            return Promise.resolve({
              success: true,
              data: {
                id: 'selection_2',
                user_id: 'test-user-id',
                symbol: args.symbol,
                exchange: args.exchange || 'NSE',
                is_active: true
              }
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      // Click manage stocks
      const manageStocksButton = screen.getByRole('button', { name: /manage stocks/i });
      await user.click(manageStocksButton);

      // Should show stock selector
      await waitFor(() => {
        expect(screen.getByText(/stock selection/i)).toBeInTheDocument();
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
        expect(screen.getByText(/TCS/i)).toBeInTheDocument();
      });

      // Select TCS
      const tcsCheckbox = screen.getByRole('checkbox', { name: /TCS/i });
      await user.click(tcsCheckbox);

      // Should call add_stock_selection API
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('add_stock_selection', 'TCS', 'NSE');
      });
    });
  });

  describe('Strategy Performance', () => {
    it('should display strategy performance metrics', async () => {
      const user = userEvent.setup();
      
      // Mock APIs
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.resolve({
              success: true,
              data: [mockStrategy]
            });
          case 'get_strategy_performance':
            return Promise.resolve({
              success: true,
              data: {
                total_trades: 25,
                winning_trades: 18,
                losing_trades: 7,
                win_rate: 0.72,
                total_profit: 1250.50,
                average_profit_per_trade: 50.02,
                max_drawdown: 125.30,
                sharpe_ratio: 1.85
              }
            });
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      await waitFor(() => {
        expect(screen.getByText(/Test Strategy/i)).toBeInTheDocument();
      });

      // Click performance button
      const performanceButton = screen.getByRole('button', { name: /performance/i });
      await user.click(performanceButton);

      // Should show performance page
      await waitFor(() => {
        expect(screen.getByText(/strategy performance/i)).toBeInTheDocument();
        expect(screen.getByText(/25/)).toBeInTheDocument(); // Total trades
        expect(screen.getByText(/72%/)).toBeInTheDocument(); // Win rate
        expect(screen.getByText(/1250.50/)).toBeInTheDocument(); // Total profit
      });

      // Should call get_strategy_performance API
      expect(mockInvoke).toHaveBeenCalledWith('get_strategy_performance', 'strategy_1', undefined);
    });
  });

  describe('Error Handling', () => {
    it('should handle strategy API errors', async () => {
      const user = userEvent.setup();
      
      // Mock APIs with errors
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_strategies':
            return Promise.reject(new Error('Strategy service unavailable'));
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      // Navigate to strategies page
      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      const strategiesLink = screen.getByRole('link', { name: /strategies/i });
      await user.click(strategiesLink);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to load strategies/i)).toBeInTheDocument();
      });
    });
  });
});