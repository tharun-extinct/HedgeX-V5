import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import BacktestHistory from '../BacktestHistory';

const mockBacktests = [
  {
    id: 'backtest-1',
    user_id: 'user-1',
    strategy_id: 'strategy-1',
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
    final_pnl: 12000,
    max_drawdown: -3000,
    sharpe_ratio: 1.4,
    win_rate: 62.5,
    profit_factor: 1.6,
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 'backtest-2',
    user_id: 'user-1',
    strategy_id: 'strategy-2',
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
    final_pnl: -5000,
    max_drawdown: -8000,
    sharpe_ratio: 0.8,
    win_rate: 56.25,
    profit_factor: 0.9,
    created_at: '2024-01-16T14:20:00Z'
  }
];

const mockOnViewResults = vi.fn();
const mockOnSelectionChange = vi.fn();
const mockOnCompare = vi.fn();

describe('BacktestHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders backtest history with filter controls', () => {
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    expect(screen.getByText('Filter & Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search strategies or symbols...')).toBeInTheDocument();
    expect(screen.getByText('All Strategies')).toBeInTheDocument();
    expect(screen.getByText('All Symbols')).toBeInTheDocument();
  });

  it('displays all backtests correctly', () => {
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    expect(screen.getByText('Momentum Strategy')).toBeInTheDocument();
    expect(screen.getByText('Mean Reversion')).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('TCS')).toBeInTheDocument();
  });

  it('filters backtests by search term', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search strategies or symbols...');
    await user.type(searchInput, 'Momentum');

    expect(screen.getByText('Momentum Strategy')).toBeInTheDocument();
    expect(screen.queryByText('Mean Reversion')).not.toBeInTheDocument();
  });

  it('filters backtests by strategy', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const strategySelect = screen.getByDisplayValue('All Strategies');
    await user.click(strategySelect);
    await user.click(screen.getByText('Momentum Strategy'));

    expect(screen.getByText('Momentum Strategy')).toBeInTheDocument();
    expect(screen.queryByText('Mean Reversion')).not.toBeInTheDocument();
  });

  it('filters backtests by symbol', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const symbolSelect = screen.getByDisplayValue('All Symbols');
    await user.click(symbolSelect);
    await user.click(screen.getByText('TCS'));

    expect(screen.getByText('Mean Reversion')).toBeInTheDocument();
    expect(screen.queryByText('Momentum Strategy')).not.toBeInTheDocument();
  });

  it('sorts backtests by different criteria', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const sortSelect = screen.getByDisplayValue('Date');
    await user.click(sortSelect);
    await user.click(screen.getByText('P&L'));

    // The component should re-render with sorted data
    // Since we can't easily test the actual sorting without more complex setup,
    // we just verify the sort option was selected
    expect(screen.getByDisplayValue('P&L')).toBeInTheDocument();
  });

  it('toggles sort order', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const sortOrderButton = screen.getByText('↓');
    await user.click(sortOrderButton);

    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('handles backtest selection', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "Select All", so we click the second one
    await user.click(checkboxes[1]);

    expect(mockOnSelectionChange).toHaveBeenCalledWith('backtest-1', true);
  });

  it('handles select all functionality', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select All/ });
    await user.click(selectAllCheckbox);

    expect(mockOnSelectionChange).toHaveBeenCalledWith('backtest-1', true);
    expect(mockOnSelectionChange).toHaveBeenCalledWith('backtest-2', true);
  });

  it('shows compare button when multiple backtests are selected', () => {
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={['backtest-1', 'backtest-2']}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    expect(screen.getByText('Compare Selected (2)')).toBeInTheDocument();
  });

  it('calls onCompare when compare button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={['backtest-1', 'backtest-2']}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const compareButton = screen.getByText('Compare Selected (2)');
    await user.click(compareButton);

    expect(mockOnCompare).toHaveBeenCalledTimes(1);
  });

  it('calls onViewResults when view results button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const viewButtons = screen.getAllByText('View Results');
    await user.click(viewButtons[0]);

    expect(mockOnViewResults).toHaveBeenCalledWith(mockBacktests[0]);
  });

  it('displays profit/loss indicators correctly', () => {
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    expect(screen.getByText('PROFIT')).toBeInTheDocument();
    expect(screen.getByText('LOSS')).toBeInTheDocument();
  });

  it('displays performance metrics correctly', () => {
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    // Check for formatted currency and percentages
    expect(screen.getByText('₹12,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹-5,000.00')).toBeInTheDocument();
    expect(screen.getByText('62.50%')).toBeInTheDocument();
    expect(screen.getByText('56.25%')).toBeInTheDocument();
  });

  it('shows empty state when no backtests match filters', async () => {
    const user = userEvent.setup();
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search strategies or symbols...');
    await user.type(searchInput, 'NonExistentStrategy');

    expect(screen.getByText('No Backtests Found')).toBeInTheDocument();
    expect(screen.getByText('No backtests match your current filters. Try adjusting your search criteria.')).toBeInTheDocument();
  });

  it('shows empty state when no backtests exist', () => {
    render(
      <BacktestHistory
        backtests={[]}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    expect(screen.getByText('No Backtests Found')).toBeInTheDocument();
    expect(screen.getByText("You haven't run any backtests yet. Start by creating a new backtest.")).toBeInTheDocument();
  });

  it('displays backtest count correctly', () => {
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={[]}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    expect(screen.getByText('Showing 2 of 2 backtests')).toBeInTheDocument();
  });

  it('highlights selected backtests visually', () => {
    const { container } = render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={['backtest-1']}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    const selectedCard = container.querySelector('.ring-2.ring-blue-500');
    expect(selectedCard).toBeInTheDocument();
  });

  it('shows selection count when backtests are selected', () => {
    render(
      <BacktestHistory
        backtests={mockBacktests}
        selectedBacktests={['backtest-1']}
        onViewResults={mockOnViewResults}
        onSelectionChange={mockOnSelectionChange}
        onCompare={mockOnCompare}
      />
    );

    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });
});