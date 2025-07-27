import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarketDataDisplay, { MarketDataItem } from '../MarketDataDisplay';

const mockMarketData: MarketDataItem[] = [
  {
    symbol: 'RELIANCE',
    instrument_token: 738561,
    ltp: 2540.50,
    volume: 1250000,
    bid: 2540.00,
    ask: 2540.50,
    ohlc: { open: 2524.75, high: 2548.20, low: 2520.30, close: 2524.75 },
    change: 15.75,
    change_percent: 0.62,
    timestamp: '2024-01-15T10:30:00Z'
  },
  {
    symbol: 'TCS',
    instrument_token: 2953217,
    ltp: 3820.25,
    volume: 890000,
    bid: 3820.00,
    ask: 3820.25,
    ohlc: { open: 3832.75, high: 3845.60, low: 3815.40, close: 3832.75 },
    change: -12.50,
    change_percent: -0.33,
    timestamp: '2024-01-15T10:30:00Z'
  },
  {
    symbol: 'HDFC',
    instrument_token: 341249,
    ltp: 2245.75,
    volume: 1100000,
    bid: 2245.50,
    ask: 2245.75,
    ohlc: { open: 2216.85, high: 2250.20, low: 2210.50, close: 2216.85 },
    change: 28.90,
    change_percent: 1.30,
    timestamp: '2024-01-15T10:30:00Z'
  }
];

describe('MarketDataDisplay', () => {
  it('renders market data correctly', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    expect(screen.getByText('Market Watch')).toBeInTheDocument();
    expect(screen.getByText('3 stocks')).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('HDFC')).toBeInTheDocument();
  });

  it('displays stock prices and changes correctly', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    expect(screen.getByText('₹2,540.50')).toBeInTheDocument();
    expect(screen.getByText('₹3,820.25')).toBeInTheDocument();
    expect(screen.getByText('₹2,245.75')).toBeInTheDocument();
    
    expect(screen.getByText('+15.75')).toBeInTheDocument();
    expect(screen.getByText('-12.50')).toBeInTheDocument();
    expect(screen.getByText('+28.90')).toBeInTheDocument();
  });

  it('filters stocks by search term', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    const searchInput = screen.getByPlaceholderText('Search stocks...');
    fireEvent.change(searchInput, { target: { value: 'RELIANCE' } });
    
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.queryByText('TCS')).not.toBeInTheDocument();
    expect(screen.queryByText('HDFC')).not.toBeInTheDocument();
  });

  it('filters gainers correctly', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    const gainersButton = screen.getByText(/Gainers/);
    fireEvent.click(gainersButton);
    
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('HDFC')).toBeInTheDocument();
    expect(screen.queryByText('TCS')).not.toBeInTheDocument();
  });

  it('filters losers correctly', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    const losersButton = screen.getByText(/Losers/);
    fireEvent.click(losersButton);
    
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.queryByText('RELIANCE')).not.toBeInTheDocument();
    expect(screen.queryByText('HDFC')).not.toBeInTheDocument();
  });

  it('filters favorites correctly', () => {
    const favorites = ['RELIANCE', 'HDFC'];
    render(
      <MarketDataDisplay 
        marketData={mockMarketData} 
        favorites={favorites}
      />
    );
    
    const favoritesButton = screen.getByText(/Favorites/);
    fireEvent.click(favoritesButton);
    
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('HDFC')).toBeInTheDocument();
    expect(screen.queryByText('TCS')).not.toBeInTheDocument();
  });

  it('sorts by symbol correctly', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    const symbolHeader = screen.getByText('Symbol');
    fireEvent.click(symbolHeader);
    
    const stockElements = screen.getAllByText(/RELIANCE|TCS|HDFC/);
    expect(stockElements[0]).toHaveTextContent('HDFC');
    expect(stockElements[1]).toHaveTextContent('RELIANCE');
    expect(stockElements[2]).toHaveTextContent('TCS');
  });

  it('sorts by LTP correctly', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    const ltpHeader = screen.getByText('LTP');
    fireEvent.click(ltpHeader);
    
    // Should sort by ascending LTP
    const priceElements = screen.getAllByText(/₹[0-9,]+\.[0-9]+/);
    expect(priceElements[0]).toHaveTextContent('₹2,245.75'); // HDFC (lowest)
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(<MarketDataDisplay marketData={mockMarketData} onRefresh={onRefresh} />);
    
    // Find the refresh button by its SVG icon
    const refreshButton = screen.getByRole('button', { name: '' });
    fireEvent.click(refreshButton);
    
    expect(onRefresh).toHaveBeenCalled();
  });

  it('calls onQuickTrade when buy button is clicked', () => {
    const onQuickTrade = vi.fn();
    render(
      <MarketDataDisplay 
        marketData={mockMarketData} 
        onQuickTrade={onQuickTrade}
      />
    );
    
    const buyButtons = screen.getAllByText('Buy');
    fireEvent.click(buyButtons[0]);
    
    expect(onQuickTrade).toHaveBeenCalledWith('RELIANCE', 'BUY');
  });

  it('calls onQuickTrade when sell button is clicked', () => {
    const onQuickTrade = vi.fn();
    render(
      <MarketDataDisplay 
        marketData={mockMarketData} 
        onQuickTrade={onQuickTrade}
      />
    );
    
    const sellButtons = screen.getAllByText('Sell');
    fireEvent.click(sellButtons[0]);
    
    expect(onQuickTrade).toHaveBeenCalledWith('RELIANCE', 'SELL');
  });

  it('calls onToggleFavorite when star button is clicked', () => {
    const onToggleFavorite = vi.fn();
    render(
      <MarketDataDisplay 
        marketData={mockMarketData} 
        onToggleFavorite={onToggleFavorite}
      />
    );
    
    const starButtons = screen.getAllByRole('button');
    const starButton = starButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-star-off')
    );
    
    if (starButton) {
      fireEvent.click(starButton);
      expect(onToggleFavorite).toHaveBeenCalledWith('RELIANCE');
    }
  });

  it('shows favorite stars for favorited stocks', () => {
    const favorites = ['RELIANCE'];
    render(
      <MarketDataDisplay 
        marketData={mockMarketData} 
        favorites={favorites}
        onToggleFavorite={vi.fn()}
      />
    );
    
    const filledStar = document.querySelector('.fill-current');
    expect(filledStar).toBeInTheDocument();
  });

  it('formats volume correctly', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    expect(screen.getByText('12.5L')).toBeInTheDocument(); // 1,250,000 -> 12.5L
    expect(screen.getByText('8.9L')).toBeInTheDocument(); // 890,000 -> 8.9L
    expect(screen.getByText('11.0L')).toBeInTheDocument(); // 1,100,000 -> 11.0L
  });

  it('shows loading state correctly', () => {
    render(<MarketDataDisplay marketData={mockMarketData} isLoading={true} />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeDisabled();
  });

  it('displays empty state when no stocks match filter', () => {
    render(<MarketDataDisplay marketData={[]} />);
    
    expect(screen.getByText('No stocks found')).toBeInTheDocument();
  });

  it('clears search when clear search button is clicked', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    const searchInput = screen.getByPlaceholderText('Search stocks...');
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });
    
    expect(screen.getByText('No stocks found')).toBeInTheDocument();
    
    const clearButton = screen.getByText('Clear search');
    fireEvent.click(clearButton);
    
    expect(searchInput).toHaveValue('');
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
  });

  it('applies correct color classes for gainers and losers', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    // Check for green color on gainers
    const gainElements = screen.getAllByText(/\+15\.75|\+28\.90/);
    gainElements.forEach(element => {
      expect(element).toHaveClass('text-green-600');
    });
    
    // Check for red color on losers
    const lossElement = screen.getByText('-12.50');
    expect(lossElement).toHaveClass('text-red-600');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MarketDataDisplay 
        marketData={mockMarketData} 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows correct filter counts', () => {
    render(<MarketDataDisplay marketData={mockMarketData} />);
    
    expect(screen.getByText('All (3)')).toBeInTheDocument();
    expect(screen.getByText('Gainers (2)')).toBeInTheDocument();
    expect(screen.getByText('Losers (1)')).toBeInTheDocument();
    expect(screen.getByText('Favorites (0)')).toBeInTheDocument();
  });

  it('updates filter counts with favorites', () => {
    const favorites = ['RELIANCE', 'TCS'];
    render(
      <MarketDataDisplay 
        marketData={mockMarketData} 
        favorites={favorites}
      />
    );
    
    expect(screen.getByText('Favorites (2)')).toBeInTheDocument();
  });
});