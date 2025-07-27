import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StrategyForm from '../StrategyForm';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('StrategyForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create form correctly', () => {
    render(
      <StrategyForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Create New Strategy')).toBeInTheDocument();
    expect(screen.getByLabelText(/Strategy Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Trades Per Day/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Risk Per Trade/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stop Loss/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Take Profit/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Volume Threshold/)).toBeInTheDocument();
  });

  it('renders edit form correctly with existing strategy', () => {
    const strategy = {
      id: '1',
      name: 'Test Strategy',
      description: 'Test description',
      max_trades_per_day: 20,
      risk_percentage: 3.0,
      stop_loss_percentage: 2.0,
      take_profit_percentage: 4.0,
      volume_threshold: 200000,
    };

    render(
      <StrategyForm
        strategy={strategy}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Edit Strategy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Strategy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('200000')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    
    render(
      <StrategyForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Create Strategy/ });
    await user.click(submitButton);

    expect(screen.getByText('Strategy name is required')).toBeInTheDocument();
  });

  it('validates field constraints', async () => {
    const user = userEvent.setup();
    
    render(
      <StrategyForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Test name length validation
    const nameInput = screen.getByLabelText(/Strategy Name/);
    await user.type(nameInput, 'AB'); // Too short
    
    const submitButton = screen.getByRole('button', { name: /Create Strategy/ });
    await user.click(submitButton);

    expect(screen.getByText('Strategy name must be at least 3 characters')).toBeInTheDocument();

    // Test take profit vs stop loss validation
    await user.clear(nameInput);
    await user.type(nameInput, 'Valid Strategy Name');
    
    const stopLossInput = screen.getByLabelText(/Stop Loss/);
    const takeProfitInput = screen.getByLabelText(/Take Profit/);
    
    await user.clear(stopLossInput);
    await user.type(stopLossInput, '5');
    await user.clear(takeProfitInput);
    await user.type(takeProfitInput, '3'); // Take profit less than stop loss
    
    await user.click(submitButton);

    expect(screen.getByText('Take profit must be greater than stop loss')).toBeInTheDocument();
  });

  it('creates new strategy successfully', async () => {
    const user = userEvent.setup();
    
    mockInvoke.mockResolvedValue({
      success: true,
      data: {
        id: '1',
        name: 'Test Strategy',
        description: 'Test description',
        max_trades_per_day: 10,
        risk_percentage: 2.0,
        stop_loss_percentage: 1.0,
        take_profit_percentage: 2.0,
        volume_threshold: 100000,
      }
    });

    render(
      <StrategyForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Fill form
    await user.type(screen.getByLabelText(/Strategy Name/), 'Test Strategy');
    await user.type(screen.getByLabelText(/Description/), 'Test description');
    
    const submitButton = screen.getByRole('button', { name: /Create Strategy/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_strategy', {
        name: 'Test Strategy',
        description: 'Test description',
        maxTradesPerDay: 10,
        riskPercentage: 2.0,
        stopLossPercentage: 1.0,
        takeProfitPercentage: 2.0,
        volumeThreshold: 100000,
      });
    });

    expect(mockOnSave).toHaveBeenCalled();
  });

  it('updates existing strategy successfully', async () => {
    const user = userEvent.setup();
    
    const strategy = {
      id: '1',
      name: 'Test Strategy',
      description: 'Test description',
      max_trades_per_day: 20,
      risk_percentage: 3.0,
      stop_loss_percentage: 2.0,
      take_profit_percentage: 4.0,
      volume_threshold: 200000,
    };

    mockInvoke.mockResolvedValue({
      success: true,
      data: { ...strategy, name: 'Updated Strategy' }
    });

    render(
      <StrategyForm
        strategy={strategy}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Update name
    const nameInput = screen.getByLabelText(/Strategy Name/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Strategy');
    
    const submitButton = screen.getByRole('button', { name: /Update Strategy/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_strategy', {
        strategyId: '1',
        name: 'Updated Strategy',
        description: 'Test description',
        maxTradesPerDay: 20,
        riskPercentage: 3.0,
        stopLossPercentage: 2.0,
        takeProfitPercentage: 4.0,
        volumeThreshold: 200000,
      });
    });

    expect(mockOnSave).toHaveBeenCalled();
  });

  it('handles API errors', async () => {
    const user = userEvent.setup();
    
    mockInvoke.mockResolvedValue({
      success: false,
      error: 'Strategy name already exists'
    });

    render(
      <StrategyForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    await user.type(screen.getByLabelText(/Strategy Name/), 'Test Strategy');
    
    const submitButton = screen.getByRole('button', { name: /Create Strategy/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Strategy name already exists')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <StrategyForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/ });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('clears field errors when user starts typing', async () => {
    const user = userEvent.setup();
    
    render(
      <StrategyForm
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Trigger validation error
    const submitButton = screen.getByRole('button', { name: /Create Strategy/ });
    await user.click(submitButton);

    expect(screen.getByText('Strategy name is required')).toBeInTheDocument();

    // Start typing to clear error
    const nameInput = screen.getByLabelText(/Strategy Name/);
    await user.type(nameInput, 'T');

    expect(screen.queryByText('Strategy name is required')).not.toBeInTheDocument();
  });
});