import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StrategyControls from '../StrategyControls';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('StrategyControls', () => {
  const mockOnStrategyUpdate = vi.fn();
  const mockOnEdit = vi.fn();

  const mockStrategy = {
    id: '1',
    name: 'Test Strategy',
    description: 'Test strategy description',
    enabled: false,
    max_trades_per_day: 10,
    risk_percentage: 2.0,
    stop_loss_percentage: 1.0,
    take_profit_percentage: 2.0,
    volume_threshold: 100000,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders strategy information correctly', () => {
    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('Test Strategy')).toBeInTheDocument();
    expect(screen.getByText('Test strategy description')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // Max trades per day
    expect(screen.getByText('2%')).toBeInTheDocument(); // Risk percentage
    expect(screen.getByText('1%')).toBeInTheDocument(); // Stop loss
    expect(screen.getByText('2%')).toBeInTheDocument(); // Take profit
  });

  it('shows active status for enabled strategy', () => {
    const activeStrategy = { ...mockStrategy, enabled: true };
    
    render(
      <StrategyControls
        strategy={activeStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Strategy is active and trading')).toBeInTheDocument();
  });

  it('shows inactive status for disabled strategy', () => {
    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Strategy is paused')).toBeInTheDocument();
    expect(screen.getByText('This strategy is currently inactive and will not execute any trades.')).toBeInTheDocument();
  });

  it('enables strategy when toggle is switched on', async () => {
    const user = userEvent.setup();
    
    mockInvoke.mockResolvedValue({});

    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('enable_strategy', {
        strategyId: '1'
      });
    });

    expect(mockOnStrategyUpdate).toHaveBeenCalledWith({
      ...mockStrategy,
      enabled: true
    });
  });

  it('disables strategy when toggle is switched off', async () => {
    const user = userEvent.setup();
    
    const activeStrategy = { ...mockStrategy, enabled: true };
    mockInvoke.mockResolvedValue({});

    render(
      <StrategyControls
        strategy={activeStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('disable_strategy', {
        strategyId: '1'
      });
    });

    expect(mockOnStrategyUpdate).toHaveBeenCalledWith({
      ...activeStrategy,
      enabled: false
    });
  });

  it('shows activate button for inactive strategy', async () => {
    const user = userEvent.setup();
    
    mockInvoke.mockResolvedValue({});

    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    const activateButton = screen.getByRole('button', { name: /Activate Strategy/ });
    expect(activateButton).toBeInTheDocument();

    await user.click(activateButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('enable_strategy', {
        strategyId: '1'
      });
    });
  });

  it('shows pause button for active strategy', async () => {
    const user = userEvent.setup();
    
    const activeStrategy = { ...mockStrategy, enabled: true };
    mockInvoke.mockResolvedValue({});

    render(
      <StrategyControls
        strategy={activeStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    const pauseButton = screen.getByRole('button', { name: /Pause Strategy/ });
    expect(pauseButton).toBeInTheDocument();

    await user.click(pauseButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('disable_strategy', {
        strategyId: '1'
      });
    });
  });

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    const editButtons = screen.getAllByRole('button', { name: /Edit/ });
    await user.click(editButtons[0]); // Click first edit button

    expect(mockOnEdit).toHaveBeenCalled();
  });

  it('displays risk-reward analysis correctly', () => {
    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    // Risk-reward ratio: take_profit / stop_loss = 2.0 / 1.0 = 2.0
    expect(screen.getByText('1:2.00')).toBeInTheDocument();
    
    // Breakeven win rate: stop_loss / (stop_loss + take_profit) = 1.0 / (1.0 + 2.0) = 33.3%
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  it('displays volume threshold with proper formatting', () => {
    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('100,000 shares')).toBeInTheDocument();
    expect(screen.getByText('Minimum volume required for trade execution')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockInvoke.mockRejectedValue(new Error('API Error'));

    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error toggling strategy:', expect.any(Error));
    });

    // Strategy should not be updated on error
    expect(mockOnStrategyUpdate).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('disables controls while updating', async () => {
    const user = userEvent.setup();
    
    // Mock a slow API response
    mockInvoke.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <StrategyControls
        strategy={mockStrategy}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    const toggle = screen.getByRole('switch');
    const activateButton = screen.getByRole('button', { name: /Activate Strategy/ });

    await user.click(toggle);

    // Controls should be disabled while updating
    expect(toggle).toBeDisabled();
    expect(activateButton).toBeDisabled();
    expect(screen.getByText('Activating...')).toBeInTheDocument();
  });

  it('renders without description when not provided', () => {
    const strategyWithoutDescription = { ...mockStrategy, description: undefined };
    
    render(
      <StrategyControls
        strategy={strategyWithoutDescription}
        onStrategyUpdate={mockOnStrategyUpdate}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('Test Strategy')).toBeInTheDocument();
    expect(screen.queryByText('Test strategy description')).not.toBeInTheDocument();
  });
});