import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StockSelector from '../StockSelector';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('StockSelector', () => {
  const mockOnSelectionChange = vi.fn();

  const mockStocks = [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', is_active: true },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', is_active: false },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', is_active: true },
    { symbol: 'INFY', name: 'Infosys Ltd', is_active: false },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', is_active: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(mockStocks);
  });

  it('renders loading state initially', () => {
    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);
    
    expect(screen.getByText('Loading NIFTY 50 stocks...')).toBeInTheDocument();
  });

  it('renders stock list after loading', async () => {
    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    expect(screen.getByText('2 / 5 selected')).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('HDFCBANK')).toBeInTheDocument();
    expect(screen.getByText('INFY')).toBeInTheDocument();
    expect(screen.getByText('HINDUNILVR')).toBeInTheDocument();
  });

  it('shows initially selected stocks', async () => {
    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    // Check that initially active stocks are selected
    const relianceCheckbox = screen.getByRole('checkbox', { name: /RELIANCE/ });
    const hdfcCheckbox = screen.getByRole('checkbox', { name: /HDFCBANK/ });
    const tcsCheckbox = screen.getByRole('checkbox', { name: /TCS/ });

    expect(relianceCheckbox).toBeChecked();
    expect(hdfcCheckbox).toBeChecked();
    expect(tcsCheckbox).not.toBeChecked();

    // Check selection summary
    expect(screen.getByText('Selected Stocks (2)')).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('HDFCBANK')).toBeInTheDocument();
  });

  it('filters stocks by search term', async () => {
    const user = userEvent.setup();
    
    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search stocks by symbol or name...');
    await user.type(searchInput, 'HDFC');

    // Should show only HDFC stocks
    expect(screen.getByText('HDFCBANK')).toBeInTheDocument();
    expect(screen.queryByText('RELIANCE')).not.toBeInTheDocument();
    expect(screen.queryByText('TCS')).not.toBeInTheDocument();
  });

  it('filters stocks by active status', async () => {
    const user = userEvent.setup();
    
    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    const activeOnlyCheckbox = screen.getByRole('checkbox', { name: /Show active only/ });
    await user.click(activeOnlyCheckbox);

    // Should show only active stocks
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('HDFCBANK')).toBeInTheDocument();
    expect(screen.queryByText('TCS')).not.toBeInTheDocument();
    expect(screen.queryByText('INFY')).not.toBeInTheDocument();
  });

  it('adds stock selection', async () => {
    const user = userEvent.setup();
    
    mockInvoke
      .mockResolvedValueOnce(mockStocks) // Initial load
      .mockResolvedValueOnce({}); // Add stock selection

    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    const tcsCheckbox = screen.getByRole('checkbox', { name: /TCS/ });
    await user.click(tcsCheckbox);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add_stock_selection', {
        symbol: 'TCS',
        exchange: 'NSE'
      });
    });

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['RELIANCE', 'HDFCBANK', 'TCS']);
  });

  it('removes stock selection', async () => {
    const user = userEvent.setup();
    
    mockInvoke
      .mockResolvedValueOnce(mockStocks) // Initial load
      .mockResolvedValueOnce({}); // Remove stock selection

    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    const relianceCheckbox = screen.getByRole('checkbox', { name: /RELIANCE/ });
    await user.click(relianceCheckbox);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('remove_stock_selection', {
        symbol: 'RELIANCE'
      });
    });

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['HDFCBANK']);
  });

  it('performs bulk select all', async () => {
    const user = userEvent.setup();
    
    mockInvoke
      .mockResolvedValueOnce(mockStocks) // Initial load
      .mockResolvedValueOnce({}); // Bulk add

    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    const selectAllButton = screen.getByRole('button', { name: /Select All Filtered/ });
    await user.click(selectAllButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('bulk_add_stock_selections', {
        symbols: ['TCS', 'INFY', 'HINDUNILVR'], // Unselected stocks
        exchange: 'NSE'
      });
    });
  });

  it('performs bulk deselect all', async () => {
    const user = userEvent.setup();
    
    mockInvoke
      .mockResolvedValueOnce(mockStocks) // Initial load
      .mockResolvedValueOnce({}); // Bulk remove

    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    const deselectAllButton = screen.getByRole('button', { name: /Deselect All Filtered/ });
    await user.click(deselectAllButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('bulk_remove_stock_selections', {
        symbols: ['RELIANCE', 'HDFCBANK'] // Selected stocks
      });
    });
  });

  it('shows no results message when search has no matches', async () => {
    const user = userEvent.setup();
    
    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('NIFTY 50 Stock Selection')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search stocks by symbol or name...');
    await user.type(searchInput, 'NONEXISTENT');

    expect(screen.getByText('No stocks match your search criteria')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockInvoke.mockRejectedValue(new Error('API Error'));

    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading stocks:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('calls onSelectionChange with initial selections', async () => {
    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(mockOnSelectionChange).toHaveBeenCalledWith(['RELIANCE', 'HDFCBANK']);
    });
  });

  it('shows selection summary with limited display', async () => {
    const manySelectedStocks = Array.from({ length: 15 }, (_, i) => ({
      symbol: `STOCK${i + 1}`,
      name: `Stock ${i + 1} Ltd`,
      is_active: true
    }));

    mockInvoke.mockResolvedValue(manySelectedStocks);

    render(<StockSelector onSelectionChange={mockOnSelectionChange} />);

    await waitFor(() => {
      expect(screen.getByText('Selected Stocks (15)')).toBeInTheDocument();
    });

    // Should show first 10 stocks and "+5 more"
    expect(screen.getByText('+5 more')).toBeInTheDocument();
  });
});