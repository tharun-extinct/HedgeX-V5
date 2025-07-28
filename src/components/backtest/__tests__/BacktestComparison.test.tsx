import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { invoke } from '@tauri-apps/api/core';
import BacktestComparison from '../BacktestComparison';

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

// Mock recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  RadarChart: ({ children }: any) => <div data-testid="radar-chart">{children}</div>,
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
  Radar: () => <div data-testid="radar" />
}));

const mockComparisonData = {
  backtests: [
    {
      id: 'backtest-1',
      strategy_name: 'Momentum Strategy',
      symbol: 'RELIANCE',
      exchange: 'NSE',
      start_date: '2023-01-01',
      end_date: '2023-06-30',
      timeframe: 'minute5',
      initial_capital: 100000,
      total_trades: 120,
      winning_trades: 75,
      losing_trades: 45,
      final_pnl: 15000,
      max_drawdown: -3000,
      sharpe_ratio: 1.5,
      win_rate: 62.5,
      profit_factor: 1.8,
      created_at: '2024-01-15T10:30:00Z'
    },
    {
      id: 'backtest-2',
      strategy_name: 'Mean Reversion',
      symbol: 'TCS',
      exchange: 'NSE',
      start_date: '2023-07-01',
      end_date: '2023-12-31',
      timeframe: 'minute15',
      initial_capital: 150000,
      total_trades: 80,
      winning_trades: 45,
      losing_trades: 35,
      final_pnl: 8000,
      max_drawdown: -5000,
      sharpe_ratio: 1.2,
      win_rate: 56.25,
      profit_factor: 1.4,
      created_at: '2024-01-16T14:20:00Z'
    }
  ],
  metrics_comparison: {
    final_pnl: [15000, 8000],
    win_rate: [62.5, 56.25],
    sharpe_ratio: [1.5, 1.2],
    profit_factor: [1.8, 1.4]
  },
  equity_curves: {
    'backtest-1': [
      { timestamp: '2023-01-01T00:00:00Z', equity: 100000 },
      { timestamp: '2023-03-01T00:00:00Z', equity: 107500 },
      { timestamp: '2023-06-30T00:00:00Z', equity: 115000 }
    ],
    'backtest-2': [
      { timestamp: '2023-07-01T00:00:00Z', equity: 150000 },
      { timestamp: '2023-09-01T00:00:00Z', equity: 154000 },
      { timestamp: '2023-12-31T00:00:00Z', equity: 158000 }
    ]
  }
};

const mockOnBackToHistory = jest.fn();

describe('BacktestComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue({
      success: true,
      data: mockComparisonData
    });
  });

  it('renders loading state initially', () => {
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    expect(screen.getByText('Loading comparison data...')).toBeInTheDocument();
  });

  it('loads and displays comparison data', async () => {
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('compare_backtests', { 
        backtestIds: ['backtest-1', 'backtest-2'] 
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Backtest Comparison')).toBeInTheDocument();
      expect(screen.getByText('Comparing 2 backtests')).toBeInTheDocument();
    });
  });

  it('displays summary cards with best performers', async () => {
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Best Performer')).toBeInTheDocument();
      expect(screen.getByText('Highest Win Rate')).toBeInTheDocument();
      expect(screen.getByText('Best Sharpe Ratio')).toBeInTheDocument();
      expect(screen.getByText('Lowest Drawdown')).toBeInTheDocument();
    });

    // Check that the best performer is correctly identified
    await waitFor(() => {
      expect(screen.getByText('Momentum Strategy')).toBeInTheDocument();
    });
  });

  it('displays comparison tabs', async () => {
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Equity Curves')).toBeInTheDocument();
      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByText('Performance Radar')).toBeInTheDocument();
    });
  });

  it('displays strategy comparison table in overview tab', async () => {
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Strategy Comparison Table')).toBeInTheDocument();
      expect(screen.getByText('Momentum Strategy')).toBeInTheDocument();
      expect(screen.getByText('Mean Reversion')).toBeInTheDocument();
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('TCS')).toBeInTheDocument();
    });
  });

  it('displays equity curves in equity tab', async () => {
    const user = userEvent.setup();
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Backtest Comparison')).toBeInTheDocument();
    });

    // Click on Equity Curves tab
    const equityTab = screen.getByText('Equity Curves');
    await user.click(equityTab);

    await waitFor(() => {
      expect(screen.getByText('Equity Curves Comparison')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  it('displays metrics charts in metrics tab', async () => {
    const user = userEvent.setup();
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Backtest Comparison')).toBeInTheDocument();
    });

    // Click on Metrics tab
    const metricsTab = screen.getByText('Metrics');
    await user.click(metricsTab);

    await waitFor(() => {
      expect(screen.getByText('P&L Comparison')).toBeInTheDocument();
      expect(screen.getByText('Win Rate Comparison')).toBeInTheDocument();
      expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);
    });
  });

  it('displays radar chart in performance radar tab', async () => {
    const user = userEvent.setup();
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Backtest Comparison')).toBeInTheDocument();
    });

    // Click on Performance Radar tab
    const radarTab = screen.getByText('Performance Radar');
    await user.click(radarTab);

    await waitFor(() => {
      expect(screen.getByText('Performance Radar Chart')).toBeInTheDocument();
      expect(screen.getByText('Multi-dimensional performance comparison')).toBeInTheDocument();
      expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    });
  });

  it('calls onBackToHistory when back button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Back to History')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to History');
    await user.click(backButton);

    expect(mockOnBackToHistory).toHaveBeenCalledTimes(1);
  });

  it('handles export comparison functionality', async () => {
    const user = userEvent.setup();
    
    // Mock URL.createObjectURL and related functions
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
    
    // Mock document.createElement and related DOM methods
    const mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: { visibility: '' }
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Export Comparison')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export Comparison');
    await user.click(exportButton);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'mock-url');
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('backtest_comparison_'));
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('displays error message when data loading fails', async () => {
    (invoke as any).mockRejectedValue(new Error('Failed to load'));

    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load comparison data. Please try again.')).toBeInTheDocument();
    });
  });

  it('displays formatted currency and percentage values correctly', async () => {
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('₹15,000.00')).toBeInTheDocument();
      expect(screen.getByText('62.50%')).toBeInTheDocument();
      expect(screen.getByText('1.50')).toBeInTheDocument();
    });
  });

  it('identifies best and worst performers correctly', async () => {
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      // Best performer should be Momentum Strategy (higher P&L)
      const bestPerformerCards = screen.getAllByText('Momentum Strategy');
      expect(bestPerformerCards.length).toBeGreaterThan(0);
      
      // Highest win rate should also be Momentum Strategy (62.5% > 56.25%)
      expect(screen.getByText('62.50%')).toBeInTheDocument();
    });
  });

  it('displays radar chart normalization note', async () => {
    const user = userEvent.setup();
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Backtest Comparison')).toBeInTheDocument();
    });

    // Click on Performance Radar tab
    const radarTab = screen.getByText('Performance Radar');
    await user.click(radarTab);

    await waitFor(() => {
      expect(screen.getByText('Values are normalized to 0-100 scale for comparison purposes.')).toBeInTheDocument();
    });
  });

  it('handles empty comparison data gracefully', async () => {
    (invoke as any).mockResolvedValue({
      success: true,
      data: null
    });

    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load comparison data')).toBeInTheDocument();
    });
  });

  it('displays correct timeframe and exchange information', async () => {
    render(
      <BacktestComparison
        backtestIds={['backtest-1', 'backtest-2']}
        onBackToHistory={mockOnBackToHistory}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('minute5')).toBeInTheDocument();
      expect(screen.getByText('minute15')).toBeInTheDocument();
      expect(screen.getAllByText('NSE')).toHaveLength(2);
    });
  });
});