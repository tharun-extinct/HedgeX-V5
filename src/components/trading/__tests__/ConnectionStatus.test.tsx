import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConnectionStatus, { ConnectionState } from '../ConnectionStatus';

describe('ConnectionStatus', () => {
  it('renders connected status correctly', () => {
    render(
      <ConnectionStatus 
        status="connected" 
        lastConnected="2024-01-15T10:30:00Z"
        isMarketOpen={true}
      />
    );
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('WebSocket')).toBeInTheDocument();
    expect(screen.getByText('Market Open')).toBeInTheDocument();
    expect(screen.getByText('Real-time market data active')).toBeInTheDocument();
  });

  it('renders disconnected status correctly', () => {
    render(
      <ConnectionStatus 
        status="disconnected" 
        lastConnected="2024-01-15T10:30:00Z"
        isMarketOpen={false}
      />
    );
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Market Closed')).toBeInTheDocument();
    expect(screen.getByText(/Last:/)).toBeInTheDocument();
  });

  it('renders connecting status correctly', () => {
    render(<ConnectionStatus status="connecting" />);
    
    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();
  });

  it('renders reconnecting status correctly', () => {
    render(<ConnectionStatus status="reconnecting" />);
    
    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });

  it('renders failed status correctly', () => {
    render(<ConnectionStatus status="failed" />);
    
    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText(/Unable to establish WebSocket connection/)).toBeInTheDocument();
  });

  it('shows reconnect button when disconnected', () => {
    const onReconnect = vi.fn();
    render(
      <ConnectionStatus 
        status="disconnected" 
        onReconnect={onReconnect}
      />
    );
    
    const reconnectButton = screen.getByText('Reconnect');
    expect(reconnectButton).toBeInTheDocument();
  });

  it('shows disconnect button when connected', () => {
    const onDisconnect = vi.fn();
    render(
      <ConnectionStatus 
        status="connected" 
        onDisconnect={onDisconnect}
      />
    );
    
    const disconnectButton = screen.getByText('Disconnect');
    expect(disconnectButton).toBeInTheDocument();
  });

  it('calls onReconnect when reconnect button is clicked', async () => {
    const onReconnect = vi.fn().mockResolvedValue(undefined);
    render(
      <ConnectionStatus 
        status="disconnected" 
        onReconnect={onReconnect}
      />
    );
    
    const reconnectButton = screen.getByText('Reconnect');
    fireEvent.click(reconnectButton);
    
    await waitFor(() => {
      expect(onReconnect).toHaveBeenCalled();
    });
  });

  it('calls onDisconnect when disconnect button is clicked', async () => {
    const onDisconnect = vi.fn().mockResolvedValue(undefined);
    render(
      <ConnectionStatus 
        status="connected" 
        onDisconnect={onDisconnect}
      />
    );
    
    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);
    
    await waitFor(() => {
      expect(onDisconnect).toHaveBeenCalled();
    });
  });

  it('shows loading state during reconnection', async () => {
    const onReconnect = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(
      <ConnectionStatus 
        status="disconnected" 
        onReconnect={onReconnect}
      />
    );
    
    const reconnectButton = screen.getByText('Reconnect');
    fireEvent.click(reconnectButton);
    
    await waitFor(() => {
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  it('shows loading state during disconnection', async () => {
    const onDisconnect = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(
      <ConnectionStatus 
        status="connected" 
        onDisconnect={onDisconnect}
      />
    );
    
    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);
    
    await waitFor(() => {
      expect(disconnectButton).toBeDisabled();
    });
  });

  it('formats last connected time correctly', () => {
    const lastConnected = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
    
    render(
      <ConnectionStatus 
        status="disconnected" 
        lastConnected={lastConnected}
      />
    );
    
    expect(screen.getByText(/Last: 5m ago/)).toBeInTheDocument();
  });

  it('handles reconnection errors gracefully', async () => {
    const onReconnect = vi.fn().mockRejectedValue(new Error('Reconnection failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ConnectionStatus 
        status="disconnected" 
        onReconnect={onReconnect}
      />
    );
    
    const reconnectButton = screen.getByText('Reconnect');
    fireEvent.click(reconnectButton);
    
    await waitFor(() => {
      expect(onReconnect).toHaveBeenCalled();
    });
    
    expect(consoleSpy).toHaveBeenCalledWith('Reconnection failed:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('handles disconnection errors gracefully', async () => {
    const onDisconnect = vi.fn().mockRejectedValue(new Error('Disconnection failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ConnectionStatus 
        status="connected" 
        onDisconnect={onDisconnect}
      />
    );
    
    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);
    
    await waitFor(() => {
      expect(onDisconnect).toHaveBeenCalled();
    });
    
    expect(consoleSpy).toHaveBeenCalledWith('Disconnection failed:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ConnectionStatus 
        status="connected" 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows pulse animation for connected status', () => {
    render(<ConnectionStatus status="connected" />);
    
    const pulseElement = document.querySelector('.animate-ping');
    expect(pulseElement).toBeInTheDocument();
  });

  it('does not show pulse animation for disconnected status', () => {
    render(<ConnectionStatus status="disconnected" />);
    
    const pulseElement = document.querySelector('.animate-ping');
    expect(pulseElement).not.toBeInTheDocument();
  });
});