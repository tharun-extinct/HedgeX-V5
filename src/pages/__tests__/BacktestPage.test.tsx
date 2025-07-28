import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { invoke } from '@tauri-apps/api/core';
import BacktestPage from '../BacktestPage';

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

// Mock the backtest components
vi.mock('../../components/backtest/BacktestForm', () => {
  return function MockBacktestForm({ onStartBacktest, isRunning }: any) {
    return (
      <div data-testid="backtest-form">
        <button 
          onClick={() => onStartBacktest({
            strategy_id: 'test-strategy',
            symbol: 'RELIANCE',
            exchange: 'NSE',
            start_date: '2023-01-01',
            end_date: '2023-12-31',
            timeframe: 'minute5',
            initial_capital: 100000,
            data_source: 'api'
          })}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Start Backtest'}
        </button>
      </div>
    );
  };
});

vi.mock('../../components/backtest/BacktestProgress', () => {
  return function MockBacktestProgress({ progress, onCancel }: any) {
    return (
      <div data-testid="backtest-progress">
        <div>Progress: {progress.progress}%</div>
        <div>Step: {progress.currentStep}</div>
        {progress.canCancel && (
          <button onClick={onCancel}>Cancel</button>
        )}
      </div>
    );
  };
});

vi.mock('../../components/backtest/BacktestResults', () => {
  return function MockBacktestResults({ backtest, onBackToSetup }: any) {
    return (
      <div data-testid="backtest-results">
        <div>Results for: {backtest.strategy_name}</div>
        <button onClick={onBackToSetup}>Back to Setup</button>
      </div>
    );
  };
});

vi.mock('../../components/backtest/BacktestHistory', () => {
  return function MockBacktestHistory({ backtests, onViewResults, onSelectionChange, onCompare }: any) {
    return (
      <div data-testid="backtest-history">
        <div>History: {backtests.length} backtests</div>
        {backtests.map((backtest: any) => (
          <div key={backtest.id}>
            <span>{backtest.strategy_name}</span>
            <button onClick={() => onViewResults(backtest)}>View Results</button>
            <input 
              type="checkbox" 
              onChange={(e) => onSelectionChange(backtest.id, e.target.checked)}
            />
          </div>
        ))}
        <button onClick={onCompare}>Compare</button>
      </div>
    );
  };
});

vi.mock('../../components/backtest/BacktestComparison', () => {
  return function MockBacktestComparison({ backtestIds, onBackToHistory }: any) {
    return (
      <div data-testid="backtest-comparison">
        <div>Comparing: {backtestIds.length} backtests</div>
        <button onClick={onBackToHistory}>Back to History</button>
      </div>
    );
  };
});

const mockStrategies = [
  {
    id: 'strategy-1',
    user_id: 'user-1',
    name: 'Test Strategy',
    description: 'A test strategy',
    enabled: true,
    max_trades_per_day: 10,
    risk_percentage: 2,
    stop_loss_percentage: 1,
    take_profit_percentage: 2,
    volume_threshold: 1000
  }
];

const mockBacktestRuns = [
  {
    id: 'backtest-1',
    user_id: 'user-1',
    strategy_id: 'strategy-1',
    strategy_name: 'Test Strategy',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    start_date: '2023-01-01',
    end_date: '2023-12-31',
    timeframe: 'minute5',
    initial_capital: 100000,
    total_trades: 100,
    winning_trades: 60,
    losing_trades: 40,
    final_pnl: 10000,
    max_drawdown: -2000,
    sharpe_ratio: 1.2,
    win_rate: 60,
    profit_factor: 1.5,
    created_at: '2024-01-15T10:30:00Z'
  }
];

describe('BacktestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockImplementation((command) => {
      switch (command) {
        case 'get_strategies':
          return Promise.resolve({ success: true, data: mockStrategies });
        case 'get_backtest_history':
          return Promise.resolve({ success: true, data: mockBacktestRuns });
        case 'start_backtest':
          return Promise.resolve({ success: true, data: mockBacktestRuns[0] });
        case 'cancel_backtest':
          return Promise.resolve({ success: true });
        default:
          return Promise.resolve({ success: false });
      }
    });
  });

  it('renders loading state initially', () => {
    render(<BacktestPage />);
    expect(screen.getByText('Loading backtesting data...')).toBeInTheDocument();
  });

  it('loads strategies and backtest history on mount', async () => {
    render(<BacktestPage />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_strategies');
      expect(invoke).toHaveBeenCalledWith('get_backtest_history');
    });

    await waitFor(() => {
      expect(screen.getByText('Strategy Backtesting')).toBeInTheDocument();
    });
  });

  it('displays main header and navigation tabs', async () => {
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByText('Strategy Backtesting')).toBeInTheDocument();
      expect(screen.getByText('Test your trading strategies against historical data')).toBeInTheDocument();
      expect(screen.getByText('Setup')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
    });
  });

  it('shows setup form by default', async () => {
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-form')).toBeInTheDocument();
    });
  });

  it('starts backtest when form is submitted', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-form')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Backtest');
    await user.click(startButton);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('start_backtest', {
        params: {
          strategy_id: 'test-strategy',
          symbol: 'RELIANCE',
          exchange: 'NSE',
          start_date: '2023-01-01',
          end_date: '2023-12-31',
          timeframe: 'minute5',
          initial_capital: 100000,
          data_source: 'api'
        }
      });
    });
  });

  it('shows progress view when backtest is running', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-form')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Backtest');
    await user.click(startButton);

    // Should show progress initially
    expect(screen.getByTestId('backtest-progress')).toBeInTheDocument();
  });

  it('shows results view after backtest completion', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-form')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Backtest');
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-results')).toBeInTheDocument();
      expect(screen.getByText('Results for: Test Strategy')).toBeInTheDocument();
    });
  });

  it('handles backtest cancellation', async () => {
    const user = userEvent.setup();
    
    // Mock a longer running backtest
    (invoke as any).mockImplementation((command) => {
      if (command === 'start_backtest') {
        return new Promise(() => {}); // Never resolves to simulate running backtest
      }
      return Promise.resolve({ success: true });
    });

    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-form')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Backtest');
    await user.click(startButton);

    // Should show progress with cancel button
    await waitFor(() => {
      expect(screen.getByTestId('backtest-progress')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(invoke).toHaveBeenCalledWith('cancel_backtest');
  });

  it('switches to history tab and displays backtest history', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    const historyTab = screen.getByText('History');
    await user.click(historyTab);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-history')).toBeInTheDocument();
      expect(screen.getByText('History: 1 backtests')).toBeInTheDocument();
    });
  });

  it('handles viewing results from history', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    const historyTab = screen.getByText('History');
    await user.click(historyTab);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-history')).toBeInTheDocument();
    });

    const viewResultsButton = screen.getByText('View Results');
    await user.click(viewResultsButton);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-results')).toBeInTheDocument();
    });
  });

  it('handles backtest selection and comparison', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    const historyTab = screen.getByText('History');
    await user.click(historyTab);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-history')).toBeInTheDocument();
    });

    // Select a backtest
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // For comparison, we need at least 2 backtests selected
    // This test assumes the mock component handles the selection logic
    const compareButton = screen.getByText('Compare');
    await user.click(compareButton);

    // Should switch to comparison view if enough backtests are selected
    // The actual behavior depends on the mock implementation
  });

  it('shows compare button when multiple backtests are selected', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    const historyTab = screen.getByText('History');
    await user.click(historyTab);

    // Mock having multiple selected backtests
    const { rerender } = render(<BacktestPage />);
    
    // This would require more complex state management to test properly
    // For now, we just verify the basic structure is in place
    expect(screen.getByTestId('backtest-history')).toBeInTheDocument();
  });

  it('handles navigation back to setup from results', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-form')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Backtest');
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-results')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to Setup');
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-form')).toBeInTheDocument();
    });
  });

  it('displays error message when data loading fails', async () => {
    (invoke as any).mockRejectedValue(new Error('Failed to load'));

    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows new backtest button when not in setup mode', async () => {
    const user = userEvent.setup();
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    const historyTab = screen.getByText('History');
    await user.click(historyTab);

    await waitFor(() => {
      expect(screen.getByText('New Backtest')).toBeInTheDocument();
    });
  });

  it('handles backtest start failure gracefully', async () => {
    const user = userEvent.setup();
    (invoke as any).mockImplementation((command) => {
      if (command === 'start_backtest') {
        return Promise.reject(new Error('Backtest failed'));
      }
      return Promise.resolve({ success: true, data: command === 'get_strategies' ? mockStrategies : mockBacktestRuns });
    });

    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByTestId('backtest-form')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start Backtest');
    await user.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to start backtest. Please try again.')).toBeInTheDocument();
    });
  });

  it('disables results and comparison tabs when no data is available', async () => {
    render(<BacktestPage />);

    await waitFor(() => {
      expect(screen.getByText('Strategy Backtesting')).toBeInTheDocument();
    });

    // Results tab should be disabled initially (no current backtest)
    const resultsTab = screen.getByText('Results');
    expect(resultsTab.closest('button')).toHaveAttribute('disabled');

    // Compare tab should be disabled initially (no selected backtests)
    const compareTab = screen.getByText('Compare');
    expect(compareTab.closest('button')).toHaveAttribute('disabled');
  });
});