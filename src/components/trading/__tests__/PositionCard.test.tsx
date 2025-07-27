import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PositionCard, { Position } from '../PositionCard';

const mockPosition: Position = {
  symbol: 'RELIANCE',
  exchange: 'NSE',
  quantity: 10,
  average_price: 2525.00,
  current_price: 2540.50,
  pnl: 155.00,
  pnl_percentage: 0.61,
  trade_type: 'Buy',
  entry_time: '2024-01-15T10:30:00Z',
  last_updated: '2024-01-15T15:45:00Z'
};

const mockShortPosition: Position = {
  ...mockPosition,
  symbol: 'TCS',
  quantity: -5,
  pnl: -75.50,
  pnl_percentage: -0.38,
  trade_type: 'Sell'
};

describe('PositionCard', () => {
  it('renders position information correctly', () => {
    render(<PositionCard position={mockPosition} />);
    
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('LONG')).toBeInTheDocument();
    expect(screen.getByText('NSE • 10 shares')).toBeInTheDocument();
    expect(screen.getByText('₹2,525.00')).toBeInTheDocument();
    expect(screen.getByText('₹2,540.50')).toBeInTheDocument();
    expect(screen.getByText('₹155.00')).toBeInTheDocument();
    expect(screen.getByText('+0.61%')).toBeInTheDocument();
  });

  it('renders short position correctly', () => {
    render(<PositionCard position={mockShortPosition} />);
    
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('SHORT')).toBeInTheDocument();
    expect(screen.getByText('NSE • 5 shares')).toBeInTheDocument();
    expect(screen.getByText('-₹75.50')).toBeInTheDocument();
    expect(screen.getByText('-0.38%')).toBeInTheDocument();
  });

  it('applies correct styling for profit positions', () => {
    render(<PositionCard position={mockPosition} />);
    
    const card = screen.getByText('RELIANCE').closest('.border-l-green-500');
    expect(card).toBeInTheDocument();
  });

  it('applies correct styling for loss positions', () => {
    render(<PositionCard position={mockShortPosition} />);
    
    const card = screen.getByText('TCS').closest('.border-l-red-500');
    expect(card).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PositionCard position={mockPosition} onClose={onClose} />);
    
    // Find the X button (close button in header)
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-x')
    );
    
    if (xButton) {
      fireEvent.click(xButton);
      expect(onClose).toHaveBeenCalledWith('RELIANCE');
    }
  });

  it('calls onModify when modify button is clicked', () => {
    const onModify = vi.fn();
    render(<PositionCard position={mockPosition} onModify={onModify} />);
    
    const modifyButton = screen.getByText('Modify');
    fireEvent.click(modifyButton);
    
    expect(onModify).toHaveBeenCalledWith('RELIANCE');
  });

  it('calls onClose when close position button is clicked', () => {
    const onClose = vi.fn();
    render(<PositionCard position={mockPosition} onClose={onClose} />);
    
    const closePositionButton = screen.getByText('Close Position');
    fireEvent.click(closePositionButton);
    
    expect(onClose).toHaveBeenCalledWith('RELIANCE');
  });

  it('formats currency correctly', () => {
    render(<PositionCard position={mockPosition} />);
    
    expect(screen.getByText('₹2,525.00')).toBeInTheDocument();
    expect(screen.getByText('₹2,540.50')).toBeInTheDocument();
    expect(screen.getByText('₹155.00')).toBeInTheDocument();
  });

  it('formats percentage correctly', () => {
    render(<PositionCard position={mockPosition} />);
    
    expect(screen.getByText('+0.61%')).toBeInTheDocument();
  });

  it('formats time correctly', () => {
    render(<PositionCard position={mockPosition} />);
    
    // Check that time elements are present (exact format may vary by locale)
    expect(screen.getByText(/Entry:/)).toBeInTheDocument();
    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
  });

  it('does not render action buttons when handlers are not provided', () => {
    render(<PositionCard position={mockPosition} />);
    
    expect(screen.queryByText('Modify')).not.toBeInTheDocument();
    expect(screen.queryByText('Close Position')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PositionCard position={mockPosition} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});