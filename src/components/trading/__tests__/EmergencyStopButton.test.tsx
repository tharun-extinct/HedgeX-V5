import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EmergencyStopButton from '../EmergencyStopButton';

describe('EmergencyStopButton', () => {
  it('renders emergency stop button when trading is active', () => {
    const onEmergencyStop = vi.fn();
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={true} 
      />
    );
    
    expect(screen.getByText('EMERGENCY STOP')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');
  });

  it('renders disabled button when trading is stopped', () => {
    const onEmergencyStop = vi.fn();
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={false} 
      />
    );
    
    expect(screen.getByText('Trading Stopped')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows confirmation dialog when clicked', async () => {
    const onEmergencyStop = vi.fn();
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={true} 
      />
    );
    
    const button = screen.getByText('EMERGENCY STOP');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Emergency Stop Confirmation')).toBeInTheDocument();
    });
    
    expect(screen.getByText('This will immediately halt all trading operations:')).toBeInTheDocument();
    expect(screen.getByText('Cancel all pending orders')).toBeInTheDocument();
    expect(screen.getByText('Stop all active strategies')).toBeInTheDocument();
    expect(screen.getByText('Disable automatic trading')).toBeInTheDocument();
    expect(screen.getByText('Close WebSocket connections')).toBeInTheDocument();
  });

  it('calls onEmergencyStop when confirmed', async () => {
    const onEmergencyStop = vi.fn().mockResolvedValue(undefined);
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={true} 
      />
    );
    
    // Click emergency stop button
    const button = screen.getByText('EMERGENCY STOP');
    fireEvent.click(button);
    
    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Emergency Stop Confirmation')).toBeInTheDocument();
    });
    
    // Click confirm button in dialog
    const confirmButton = screen.getAllByText('EMERGENCY STOP')[1]; // Second one is in the dialog
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(onEmergencyStop).toHaveBeenCalled();
    });
  });

  it('closes dialog when cancelled', async () => {
    const onEmergencyStop = vi.fn();
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={true} 
      />
    );
    
    // Click emergency stop button
    const button = screen.getByText('EMERGENCY STOP');
    fireEvent.click(button);
    
    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Emergency Stop Confirmation')).toBeInTheDocument();
    });
    
    // Click cancel button
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Emergency Stop Confirmation')).not.toBeInTheDocument();
    });
    
    expect(onEmergencyStop).not.toHaveBeenCalled();
  });

  it('shows loading state during execution', async () => {
    const onEmergencyStop = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={true} 
      />
    );
    
    // Click emergency stop button
    const button = screen.getByText('EMERGENCY STOP');
    fireEvent.click(button);
    
    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Emergency Stop Confirmation')).toBeInTheDocument();
    });
    
    // Click confirm button
    const confirmButton = screen.getAllByText('EMERGENCY STOP')[1];
    fireEvent.click(confirmButton);
    
    // Check loading state
    await waitFor(() => {
      expect(screen.getByText('Stopping...')).toBeInTheDocument();
    });
    
    // Wait for completion
    await waitFor(() => {
      expect(onEmergencyStop).toHaveBeenCalled();
    });
  });

  it('disables button when isLoading is true', () => {
    const onEmergencyStop = vi.fn();
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={true}
        isLoading={true}
      />
    );
    
    const button = screen.getByText('EMERGENCY STOP');
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    const onEmergencyStop = vi.fn();
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={true}
        className="custom-class"
      />
    );
    
    const button = screen.getByText('EMERGENCY STOP');
    expect(button).toHaveClass('custom-class');
  });

  it('handles emergency stop errors gracefully', async () => {
    const onEmergencyStop = vi.fn().mockRejectedValue(new Error('Stop failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <EmergencyStopButton 
        onEmergencyStop={onEmergencyStop} 
        isTrading={true} 
      />
    );
    
    // Click emergency stop button
    const button = screen.getByText('EMERGENCY STOP');
    fireEvent.click(button);
    
    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Emergency Stop Confirmation')).toBeInTheDocument();
    });
    
    // Click confirm button
    const confirmButton = screen.getAllByText('EMERGENCY STOP')[1];
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(onEmergencyStop).toHaveBeenCalled();
    });
    
    expect(consoleSpy).toHaveBeenCalledWith('Emergency stop failed:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });
});