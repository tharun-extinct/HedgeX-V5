import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { invoke } from '@tauri-apps/api/core';
import BacktestResults from '../BacktestResults';

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
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />
}));

const mockBacktest = {
  id: 'test-backtest-1',
  user_id: 'user-1',
  strategy_id: 'strategy-1',
  strategy_name: 'Test Strategy',
  symbol: 'RELIANCE',
  exchange: 'NSE',
  start_date: '2023-01-01',
  end_date: '2023-12-31',
  timeframe: 'minute5',
  initial_capital: 100000,
  total_trades: 150,
  winning_trades: 90,
  losing_trades: 60,
  final_pnl: 15000,
  max_drawdown: -5000,
  sharpe_ratio: 1.5,
  win_rate: 60,
  profit_factor: 1.8,
  created_at: '2024-01-15T10:30:00Z'
};

const mockBacktestDetail = {
  backtest: mockBacktest,
  trades: [
    {
      id: 'trade-1',
      symbol: 'RELIANCE',
      trade_type: 'buy' as const,
      entry_time: '2023-01-15T09:30:00Z',
      entry_price: 2500,
      quantity: 10,
      exit_time: '2023-01-15T10:30:00Z',
      exit_price: 2550,
      pnl: 500,
      exit_reason: 'Take profit'
    },
    {
      id: 'trade-2',
      symbol: 'RELIANCE',
      trade_type: 'sell' as const,
      entry_time: '2023-01-16T09:30:00Z',
      entry_price: 2480,
      quantity: 10,
      exit_time: '2023-01-16T11:30:00Z',
      exit_price: 2450,
      pnl: 300,
      exit_reason: 'Stop loss'
    }
  ],
  equity_curve: [
    { timestamp: '2023-01-01T00:00:00Z', equity: 100000 },
    { timestamp: '2023-06-01T00:00:00Z', equity: 107500 },
    { timestamp: '2023-12-31T00:00:00Z', equity: 115000 }
  ]
};

const mockOnBackToSetup = jest.fn();

describe('BacktestResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue({
      success: true,
      data: mockBacktestDetail
    });
  });

  it('renders loading state initially', () => {
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    expect(screen.getByText('Loading detailed results...')).toBeInTheDocument();
  });

  it('loads and displays backtest detail data', async () => {
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_backtest_detail', { backtestId: 'test-backtest-1' });
    });

    await waitFor(() => {
      expect(screen.getByText('Backtest Results')).toBeInTheDocument();
      expect(screen.getByText('Test Strategy • RELIANCE')).toBeInTheDocument();
    });
  });

  it('displays key metrics cards', async () => {
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Total P&L')).toBeInTheDocument();
      expect(screen.getByText('Win Rate')).toBeInTheDocument();
      expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
      expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
    });

    // Check metric values
    expect(screen.getByText('₹15,000.00')).toBeInTheDocument();
    expect(screen.getByText('60.00%')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
  });

  it('displays tabs for different analysis views', async () => {
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Equity Curve')).toBeInTheDocument();
      expect(screen.getByText('Trade Analysis')).toBeInTheDocument();
      expect(screen.getByText('Monthly Returns')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });
  });

  it('displays trade list in trade analysis tab', async () => {
    const user = userEvent.setup();
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Backtest Results')).toBeInTheDocument();
    });

    // Click on Trade Analysis tab
    const tradeAnalysisTab = screen.getByText('Trade Analysis');
    await user.click(tradeAnalysisTab);

    await waitFor(() => {
      expect(screen.getByText('Recent Trades')).toBeInTheDocument();
      expect(screen.getByText('BUY')).toBeInTheDocument();
      expect(screen.getByText('SELL')).toBeInTheDocument();
    });
  });

  it('displays configuration details in summary tab', async () => {
    const user = userEvent.setup();
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Backtest Results')).toBeInTheDocument();
    });

    // Click on Summary tab
    const summaryTab = screen.getByText('Summary');
    await user.click(summaryTab);

    await waitFor(() => {
      expect(screen.getByText('Backtest Configuration')).toBeInTheDocument();
      expect(screen.getByText('Performance Summary')).toBeInTheDocument();
      expect(screen.getByText('Test Strategy')).toBeInTheDocument();
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('minute5')).toBeInTheDocument();
    });
  });

  it('calls onBackToSetup when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Back to Setup')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to Setup');
    await user.click(backButton);

    expect(mockOnBackToSetup).toHaveBeenCalledTimes(1);
  });

  it('handles export results functionality', async () => {
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

    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Export Results')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export Results');
    await user.click(exportButton);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'mock-url');
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('backtest_test-backtest-1_RELIANCE.json'));
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('displays error message when data loading fails', async () => {
    (invoke as any).mockRejectedValue(new Error('Failed to load'));

    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load detailed results. Please try again.')).toBeInTheDocument();
    });
  });

  it('displays charts in equity curve tab', async () => {
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Equity Curve')).toBeInTheDocument();
    });

    // Charts should be rendered (mocked)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('calculates and displays profit/loss colors correctly', async () => {
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      // Positive P&L should be displayed in green
      const pnlElement = screen.getByText('₹15,000.00');
      expect(pnlElement.closest('p')).toHaveClass('text-green-700');
    });
  });

  it('displays trade statistics correctly', async () => {
    const user = userEvent.setup();
    render(<BacktestResults backtest={mockBacktest} onBackToSetup={mockOnBackToSetup} />);

    await waitFor(() => {
      expect(screen.getByText('Backtest Results')).toBeInTheDocument();
    });

    // Click on Trade Analysis tab
    const tradeAnalysisTab = screen.getByText('Trade Analysis');
    await user.click(tradeAnalysisTab);

    await waitFor(() => {
      expect(screen.getByText('Trade Statistics')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total trades
      expect(screen.getByText('1.80')).toBeInTheDocument(); // Profit factor
    });
  });
});