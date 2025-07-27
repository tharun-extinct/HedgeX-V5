import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OrderBook, { Order } from '../OrderBook';

const mockOrders: Order[] = [
  {
    id: 'order_1',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    order_type: 'Limit',
    trade_type: 'Buy',
    quantity: 5,
    price: 2530.00,
    filled_quantity: 0,
    pending_quantity: 5,
    status: 'Pending',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    strategy_id: 'strategy_1'
  },
  {
    id: 'order_2',
    symbol: 'TCS',
    exchange: 'NSE',
    order_type: 'Market',
    trade_type: 'Sell',
    quantity: 3,
    filled_quantity: 3,
    pending_quantity: 0,
    average_price: 3825.50,
    status: 'Executed',
    created_at: '2024-01-15T09:45:00Z',
    updated_at: '2024-01-15T09:46:00Z',
    strategy_id: 'strategy_2'
  },
  {
    id: 'order_3',
    symbol: 'HDFC',
    exchange: 'NSE',
    order_type: 'Limit',
    trade_type: 'Buy',
    quantity: 2,
    price: 2200.00,
    filled_quantity: 0,
    pending_quantity: 2,
    status: 'Cancelled',
    created_at: '2024-01-15T08:30:00Z',
    updated_at: '2024-01-15T08:35:00Z'
  }
];

describe('OrderBook', () => {
  it('renders order book with correct title and count', () => {
    render(<OrderBook orders={mockOrders} />);
    
    expect(screen.getByText('Order Book')).toBeInTheDocument();
    expect(screen.getByText('3 orders')).toBeInTheDocument();
  });

  it('displays order summary correctly', () => {
    render(<OrderBook orders={mockOrders} />);
    
    expect(screen.getByText('1')).toBeInTheDocument(); // Pending count
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Executed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders individual orders correctly', () => {
    render(<OrderBook orders={mockOrders} />);
    
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('HDFC')).toBeInTheDocument();
    
    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
    
    expect(screen.getByText('Limit')).toBeInTheDocument();
    expect(screen.getByText('Market')).toBeInTheDocument();
  });

  it('filters orders correctly', () => {
    render(<OrderBook orders={mockOrders} />);
    
    // Click on pending filter
    const pendingFilter = screen.getByText('pending');
    fireEvent.click(pendingFilter);
    
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.queryByText('TCS')).not.toBeInTheDocument();
    expect(screen.queryByText('HDFC')).not.toBeInTheDocument();
  });

  it('shows cancel button for pending orders', () => {
    render(<OrderBook orders={mockOrders} onCancelOrder={vi.fn()} />);
    
    const cancelButtons = screen.getAllByText('Cancel');
    expect(cancelButtons).toHaveLength(1); // Only pending orders should have cancel button
  });

  it('shows modify button for pending limit orders', () => {
    render(<OrderBook orders={mockOrders} onModifyOrder={vi.fn()} />);
    
    const modifyButtons = screen.getAllByText('Modify');
    expect(modifyButtons).toHaveLength(1); // Only pending limit orders should have modify button
  });

  it('calls onCancelOrder when cancel button is clicked', () => {
    const onCancelOrder = vi.fn();
    render(<OrderBook orders={mockOrders} onCancelOrder={onCancelOrder} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(onCancelOrder).toHaveBeenCalledWith('order_1');
  });

  it('calls onModifyOrder when modify button is clicked', () => {
    const onModifyOrder = vi.fn();
    render(<OrderBook orders={mockOrders} onModifyOrder={onModifyOrder} />);
    
    const modifyButton = screen.getByText('Modify');
    fireEvent.click(modifyButton);
    
    expect(onModifyOrder).toHaveBeenCalledWith('order_1');
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(<OrderBook orders={mockOrders} onRefresh={onRefresh} />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    
    expect(onRefresh).toHaveBeenCalled();
  });

  it('shows loading state correctly', () => {
    render(<OrderBook orders={mockOrders} isLoading={true} />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeDisabled();
  });

  it('displays empty state when no orders match filter', () => {
    render(<OrderBook orders={[]} />);
    
    expect(screen.getByText('No orders found')).toBeInTheDocument();
  });

  it('shows filled quantity for partially filled orders', () => {
    const partialOrder: Order = {
      ...mockOrders[0],
      status: 'PartiallyFilled',
      filled_quantity: 2,
      pending_quantity: 3
    };
    
    render(<OrderBook orders={[partialOrder]} />);
    
    expect(screen.getByText('(2 filled)')).toBeInTheDocument();
  });

  it('displays average price for executed orders', () => {
    render(<OrderBook orders={mockOrders} />);
    
    expect(screen.getByText('₹3,825.50')).toBeInTheDocument();
  });

  it('sorts orders by creation time (newest first)', () => {
    render(<OrderBook orders={mockOrders} />);
    
    const orderElements = screen.getAllByText(/RELIANCE|TCS|HDFC/);
    expect(orderElements[0]).toHaveTextContent('RELIANCE'); // Most recent
    expect(orderElements[1]).toHaveTextContent('TCS');
    expect(orderElements[2]).toHaveTextContent('HDFC'); // Oldest
  });

  it('applies custom className', () => {
    const { container } = render(
      <OrderBook orders={mockOrders} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});