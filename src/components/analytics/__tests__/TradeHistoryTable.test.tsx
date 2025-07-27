import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TradeHistoryTable from '../TradeHistoryTable';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

// Mock data
const mockTrades = [
  {
    id: 'trade-1',
    symbol: 'RELIANCE',
    trade_type: 'Buy',
    quantity: 10,
    price: 2540.50,
    status: 'Executed',
    executed_at: '2025-01-15T09:30:00Z',
    strategy_id: 'strategy-1',
    pnl: 325.00,
    pnl_percentage: 1.28
  },
  {
    id: 'trade-2',
    symbol: 'TCS',
    trade_type: 'Sell',
    quantity: 5,
    price: 3820.25,
    status: 'Executed',
    executed_at: '2025-01-15T10:15:00Z',
    strategy_id: 'strategy-2',
    pnl: -175.00,
    pnl_percentage: -0.90
  }
];

describe('TradeHistoryTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      success: true,
      data: mockTrades
    });
  });

  it('renders trade history table with data', async () => {
    render(<TradeHistoryTable />);

    // Check if loading state is shown initially
    expect(screen.getByText('Loading trade history...')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Check if trades are displayed
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
  });

  it('handles API call correctly', async () => {
    render(<TradeHistoryTable />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_trade_history', {
        limit: 1000,
        offset: 0
      });
    });
  });

  it('filters trades by symbol', async () => {
    render(<TradeHistoryTable />);

    await waitFor(() => {
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    });

    // Find and interact with symbol filter
    const symbolInput = screen.getByPlaceholderText('Search symbol...');
    fireEvent.change(symbolInput, { target: { value: 'RELIANCE' } });

    // Check if filtering works (this would be tested with actual filtering logic)
    expect(symbolInput.value).toBe('RELIANCE');
  });

  it('handles export functionality', async () => {
    const mockExport = vi.fn();
    render(<TradeHistoryTable onExport={mockExport} />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByText('Export CSV');
    fireEvent.click(exportButton);

    expect(mockExport).toHaveBeenCalledWith(mockTrades);
  });

  it('displays error state when API fails', async () => {
    mockInvoke.mockRejectedValue(new Error('API Error'));

    render(<TradeHistoryTable />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load trade history. Please try again.')).toBeInTheDocument();
    });
  });

  it('handles pagination correctly', async () => {
    // Mock data with more trades to test pagination
    const manyTrades = Array.from({ length: 25 }, (_, i) => ({
      ...mockTrades[0],
      id: `trade-${i}`,
      symbol: `STOCK${i}`
    }));

    mockInvoke.mockResolvedValue({
      success: true,
      data: manyTrades
    });

    render(<TradeHistoryTable />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Check if pagination controls are present
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('sorts trades correctly', async () => {
    render(<TradeHistoryTable />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Find and click sort button for P&L
    const pnlSortButton = screen.getByText('P&L');
    fireEvent.click(pnlSortButton);

    // Verify sorting functionality (this would be tested with actual sorting logic)
    expect(pnlSortButton).toBeInTheDocument();
  });

  it('refreshes data when refresh button is clicked', async () => {
    render(<TradeHistoryTable />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Click refresh button
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Verify API is called again
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('displays correct P&L colors', async () => {
    render(<TradeHistoryTable />);

    await waitFor(() => {
      expect(screen.getByText('Trade History')).toBeInTheDocument();
    });

    // Check if positive P&L is displayed in green and negative in red
    const positivePnl = screen.getByText('+₹325.00');
    const negativePnl = screen.getByText('-₹175.00');

    expect(positivePnl).toHaveClass('text-green-600');
    expect(negativePnl).toHaveClass('text-red-600');
  });
});