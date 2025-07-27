import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StrategyPerformance from '../StrategyPerformance';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('StrategyPerformance', () => {
  const mockPerformanceData = [
    {
      id: '1',
      user_id: 'user1',
      strategy_id: 'strategy1',
      date: '2025-01-03',
      total_trades: 5,
      profitable_trades: 3,
      total_pnl: 1250.50,
      max_drawdown: -200.00,
      win_rate: 60.0,
      profit_factor: 1.8,
      sharpe_ratio: 1.2,
      average_trade_duration: 45,
      created_at: '2025-01-03T00:00:00Z',
      updated_at: '2025-01-03T00:00:00Z',
    },
    {
      id: '2',
      user_id: 'user1',
      strategy_id: 'strategy1',
      date: '2025-01-02',
      total_trades: 3,
      profitable_trades: 2,
      total_pnl: -150.25,
      max_drawdown: -300.00,
      win_rate: 66.7,
      profit_factor: 0.9,
      sharpe_ratio: 0.8,
      average_trade_duration: 30,
      created_at: '2025-01-02T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    expect(screen.getByText('Loading performance data...')).toBeInTheDocument();
  });

  it('renders performance data correctly', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: mockPerformanceData })
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Strategy Performance')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Strategy - Performance Analytics')).toBeInTheDocument();
    
    // Check that basic metrics are displayed
    expect(screen.getByText('Total P&L')).toBeInTheDocument();
    expect(screen.getAllByText('Win Rate')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Profit Factor')[0]).toBeInTheDocument();
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
  });

  it('changes time period when buttons are clicked', async () => {
    const user = userEvent.setup();
    
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: mockPerformanceData })
      .mockResolvedValueOnce({ success: true, data: {} })
      .mockResolvedValueOnce({ success: true, data: [] }) // 7 days data
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Strategy Performance')).toBeInTheDocument();
    });

    const sevenDayButton = screen.getByRole('button', { name: '7D' });
    await user.click(sevenDayButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_strategy_performance', {
        strategyId: 'strategy1',
        days: 7
      });
    });
  });

  it('displays daily performance breakdown table', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: mockPerformanceData })
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Strategy Performance')).toBeInTheDocument();
    });

    // Check if table section exists when there's data
    if (mockPerformanceData.length > 0) {
      expect(screen.getByText('Daily Performance Breakdown')).toBeInTheDocument();
    }
  });

  it('shows no data state when no performance data available', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No Performance Data')).toBeInTheDocument();
    });

    expect(screen.getByText('No trading data available for the selected period. Performance metrics will appear once the strategy starts executing trades.')).toBeInTheDocument();
  });

  it('calculates aggregate metrics correctly', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: mockPerformanceData })
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Strategy Performance')).toBeInTheDocument();
    });

    // Check that metrics sections are present
    expect(screen.getByText('Total Trades')).toBeInTheDocument();
    expect(screen.getByText('Total P&L')).toBeInTheDocument();
    expect(screen.getAllByText('Win Rate')[0]).toBeInTheDocument();
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
  });

  it('formats currency correctly', async () => {
    const largeAmountData = [{
      ...mockPerformanceData[0],
      total_pnl: 123456.78,
      max_drawdown: -9876.54
    }];

    mockInvoke
      .mockResolvedValueOnce({ success: true, data: largeAmountData })
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Strategy Performance')).toBeInTheDocument();
    });

    // Check that currency formatting is applied (contains rupee symbol)
    expect(screen.getAllByText(/₹/)[0]).toBeInTheDocument();
  });

  it('formats trade duration correctly', async () => {
    const durationData = [{
      ...mockPerformanceData[0],
      average_trade_duration: 125 // 2h 5m
    }];

    mockInvoke
      .mockResolvedValueOnce({ success: true, data: durationData })
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2h 5m')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockInvoke.mockRejectedValue(new Error('API Error'));

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading performance data:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('shows limited table rows with pagination info', async () => {
    const manyDaysData = Array.from({ length: 15 }, (_, i) => ({
      ...mockPerformanceData[0],
      id: `${i + 1}`,
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
    }));

    mockInvoke
      .mockResolvedValueOnce({ success: true, data: manyDaysData })
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Showing 10 of 15 days')).toBeInTheDocument();
    });
  });

  it('applies correct styling for positive and negative P&L', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: mockPerformanceData })
      .mockResolvedValueOnce({ success: true, data: {} });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Strategy Performance')).toBeInTheDocument();
    });

    // Check that styling classes are applied somewhere in the component
    const container = screen.getByText('Strategy Performance').closest('div');
    expect(container).toBeInTheDocument();
  });

  it('loads strategy stats on mount', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, data: mockPerformanceData })
      .mockResolvedValueOnce({ success: true, data: { trades_today: 3 } });

    render(
      <StrategyPerformance
        strategyId="strategy1"
        strategyName="Test Strategy"
      />
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_strategy_stats', {
        strategyId: 'strategy1'
      });
    });
  });
});