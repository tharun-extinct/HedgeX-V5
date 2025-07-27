import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PerformanceDashboard from '../PerformanceDashboard';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

// Mock recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />
}));

// Mock data
const mockMetrics = {
  total_trades: 156,
  profitable_trades: 92,
  losing_trades: 64,
  win_rate: 0.59,
  profit_factor: 1.87,
  average_win: 825.45,
  average_loss: 412.75,
  largest_win: 4500.0,
  largest_loss: 2200.0,
  total_profit: 75942.5,
  net_profit: 48532.5,
  sharpe_ratio: 1.68,
  max_drawdown: 15320.0,
  max_drawdown_percent: 0.12,
  average_trade_duration: 45
};

const mockStrategyPerformance = [
  {
    strategy_id: '1',
    strategy_name: 'NIFTY Momentum',
    trades: 72,
    win_rate: 0.68,
    profit_factor: 2.45,
    total_profit: 42580.0,
    net_profit: 31250.0
  }
];

const mockInstrumentPerformance = [
  {
    symbol: 'RELIANCE',
    trades: 32,
    win_rate: 0.72,
    profit_factor: 2.85,
    total_profit: 18750.0,
    net_profit: 14250.0
  }
];

const mockEquityCurve = [
  {
    timestamp: '2025-01-01',
    equity: 100000,
    pnl: 0
  },
  {
    timestamp: '2025-01-02',
    equity: 101000,
    pnl: 1000
  }
];

describe('PerformanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: mockMetrics })
      .mockResolvedValueOnce({ success: true, data: mockStrategyPerformance })
      .mockResolvedValueOnce({ success: true, data: mockInstrumentPerformance })
      .mockResolvedValueOnce({ success: true, data: mockEquityCurve });
  });

  it('renders performance dashboard with metrics', async () => {
    render(<PerformanceDashboard />);

    // Check if loading state is shown initially
    expect(screen.getByText('Loading performance data...')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
    });

    // Check if key metrics are displayed
    expect(screen.getByText('Net Profit')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('Profit Factor')).toBeInTheDocument();
    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
  });

  it('displays correct metric values', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('₹48532.50')).toBeInTheDocument();
      expect(screen.getByText('59.0%')).toBeInTheDocument();
      expect(screen.getByText('1.87')).toBeInTheDocument();
      expect(screen.getByText('1.68')).toBeInTheDocument();
    });
  });

  it('handles timeframe changes', async () => {
    const mockTimeframeChange = vi.fn();
    render(<PerformanceDashboard onTimeframeChange={mockTimeframeChange} />);

    await waitFor(() => {
      expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
    });

    // Click on week timeframe button
    const weekButton = screen.getByText('week');
    fireEvent.click(weekButton);

    expect(mockTimeframeChange).toHaveBeenCalledWith('week');
  });

  it('renders charts correctly', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
    });

    // Check if chart components are rendered
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByText('Equity Curve')).toBeInTheDocument();
    expect(screen.getByText('Strategy Performance')).toBeInTheDocument();
  });

  it('displays strategy performance breakdown', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY Momentum')).toBeInTheDocument();
      expect(screen.getByText('₹31250.00')).toBeInTheDocument();
      expect(screen.getByText('68.0%')).toBeInTheDocument();
    });
  });

  it('displays instrument performance', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('₹14250.00')).toBeInTheDocument();
      expect(screen.getByText('72.0%')).toBeInTheDocument();
    });
  });

  it('handles export functionality', async () => {
    const mockExport = vi.fn();
    render(<PerformanceDashboard onExport={mockExport} />);

    await waitFor(() => {
      expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    expect(mockExport).toHaveBeenCalledWith(
      expect.objectContaining({
        metrics: mockMetrics,
        strategyPerformance: mockStrategyPerformance,
        instrumentPerformance: mockInstrumentPerformance,
        equityCurve: mockEquityCurve
      })
    );
  });

  it('handles API errors gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('API Error'));

    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load performance data. Please try again.')).toBeInTheDocument();
    });
  });

  it('displays positive and negative profits with correct colors', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      const netProfitCard = screen.getByText('₹48532.50').closest('.bg-gradient-to-br');
      expect(netProfitCard).toHaveClass('from-green-50', 'to-green-100');
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Performance Dashboard')).toBeInTheDocument();
    });

    // Click refresh button
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Verify API calls are made again
    expect(mockInvoke).toHaveBeenCalledTimes(8); // 4 initial + 4 refresh calls
  });

  it('handles empty data gracefully', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: null })
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: [] });

    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No performance data available')).toBeInTheDocument();
    });
  });
});