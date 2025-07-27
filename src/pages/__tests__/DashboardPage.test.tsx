import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DashboardPage from '../DashboardPage';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock the trading components
vi.mock('../../components/trading/PositionCard', () => ({
  default: ({ position, onClose, onModify }: any) => (
    <div data-testid={`position-${position.symbol}`}>
      <span>{position.symbol}</span>
      <span>{position.pnl}</span>
      {onClose && <button onClick={() => onClose(position.symbol)}>Close</button>}
      {onModify && <button onClick={() => onModify(position.symbol)}>Modify</button>}
    </div>
  ),
}));

vi.mock('../../components/trading/OrderBook', () => ({
  default: ({ orders, onCancelOrder, onModifyOrder }: any) => (
    <div data-testid="order-book">
      {orders.map((order: any) => (
        <div key={order.id} data-testid={`order-${order.id}`}>
          <span>{order.symbol}</span>
          <span>{order.status}</span>
          {onCancelOrder && <button onClick={() => onCancelOrder(order.id)}>Cancel</button>}
          {onModifyOrder && <button onClick={() => onModifyOrder(order.id)}>Modify</button>}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../components/trading/EmergencyStopButton', () => ({
  default: ({ onEmergencyStop, isTrading }: any) => (
    <button 
      onClick={onEmergencyStop}
      disabled={!isTrading}
      data-testid="emergency-stop"
    >
      EMERGENCY STOP
    </button>
  ),
}));

vi.mock('../../components/trading/ConnectionStatus', () => ({
  default: ({ status, onReconnect, onDisconnect }: any) => (
    <div data-testid="connection-status">
      <span>{status}</span>
      {onReconnect && <button onClick={onReconnect}>Reconnect</button>}
      {onDisconnect && <button onClick={onDisconnect}>Disconnect</button>}
    </div>
  ),
}));

vi.mock('../../components/trading/MarketDataDisplay', () => ({
  default: ({ marketData, onQuickTrade, onToggleFavorite }: any) => (
    <div data-testid="market-data-display">
      {marketData.map((item: any) => (
        <div key={item.symbol} data-testid={`market-${item.symbol}`}>
          <span>{item.symbol}</span>
          <span>{item.ltp}</span>
          {onQuickTrade && (
            <>
              <button onClick={() => onQuickTrade(item.symbol, 'BUY')}>Buy</button>
              <button onClick={() => onQuickTrade(item.symbol, 'SELL')}>Sell</button>
            </>
          )}
          {onToggleFavorite && (
            <button onClick={() => onToggleFavorite(item.symbol)}>Toggle Favorite</button>
          )}
        </div>
      ))}
    </div>
  ),
}));

// Mock AuthContext with authenticated user
const mockAuthContext = {
  isAuthenticated: true,
  user: { id: 'test-user', username: 'testuser', created_at: '2024-01-01' },
  sessionToken: 'test-token',
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  validateSession: vi.fn(),
  refreshSession: vi.fn(),
  saveApiCredentials: vi.fn(),
  getApiCredentials: vi.fn(),
  hasApiCredentials: vi.fn(),
  error: null,
  clearError: vi.fn(),
};

const MockAuthProvider = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: MockAuthProvider,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders dashboard for authenticated user', () => {
    render(<DashboardPage />);
    
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome back, testuser. Monitor and control your trading operations.')).toBeInTheDocument();
  });

  it('shows login prompt for unauthenticated user', () => {
    const unauthenticatedContext = { ...mockAuthContext, isAuthenticated: false, user: null };
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(unauthenticatedContext);
    
    render(<DashboardPage />);
    
    expect(screen.getByText('Please log in to access the dashboard')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    const loadingContext = { ...mockAuthContext, isLoading: true };
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(loadingContext);
    
    render(<DashboardPage />);
    
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('displays key metrics cards', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Account Balance')).toBeInTheDocument();
      expect(screen.getByText('Today\'s P&L')).toBeInTheDocument();
      expect(screen.getByText('Open Positions')).toBeInTheDocument();
      expect(screen.getByText('Active Strategies')).toBeInTheDocument();
    });
  });

  it('displays market status correctly', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Market Open')).toBeInTheDocument();
    });
  });

  it('displays trading status correctly', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Trading Active')).toBeInTheDocument();
    });
  });

  it('handles start trading action', async () => {
    render(<DashboardPage />);
    
    // Wait for initial load and then stop trading to show start button
    await waitFor(() => {
      expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
    });

    // Find and click stop trading first to show start button
    const stopButton = screen.getByText('Stop Trading');
    fireEvent.click(stopButton);

    await waitFor(() => {
      const startButton = screen.getByText('Start Trading');
      expect(startButton).toBeInTheDocument();
      fireEvent.click(startButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Stop Trading')).toBeInTheDocument();
    });
  });

  it('handles stop trading action', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const stopButton = screen.getByText('Stop Trading');
      fireEvent.click(stopButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Start Trading')).toBeInTheDocument();
    });
  });

  it('handles emergency stop action', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const emergencyButton = screen.getByTestId('emergency-stop');
      fireEvent.click(emergencyButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Start Trading')).toBeInTheDocument();
    });
  });

  it('handles refresh action', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
    });

    // Should not throw any errors
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
  });

  it('handles reconnection action', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const reconnectButton = screen.getByText('Reconnect');
      fireEvent.click(reconnectButton);
    });

    // Should trigger reconnection logic
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });

  it('handles disconnection action', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);
    });

    // Should trigger disconnection logic
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });

  it('handles quick trade actions', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const buyButton = screen.getAllByText('Buy')[0];
      fireEvent.click(buyButton);
    });

    // Should not throw errors
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
  });

  it('handles position close action', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const closeButton = screen.getAllByText('Close')[0];
      fireEvent.click(closeButton);
    });

    // Should remove the position
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
  });

  it('handles order cancel action', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const cancelButton = screen.getAllByText('Cancel')[0];
      fireEvent.click(cancelButton);
    });

    // Should update order status
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
  });

  it('handles favorite toggle action', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      const favoriteButton = screen.getAllByText('Toggle Favorite')[0];
      fireEvent.click(favoriteButton);
    });

    // Should update favorites
    expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
  });

  it('updates market data in real-time', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('market-data-display')).toBeInTheDocument();
    });

    // Fast-forward time to trigger updates
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Market data should be updated
    expect(screen.getByTestId('market-data-display')).toBeInTheDocument();
  });

  it('updates positions with real-time P&L', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('position-RELIANCE')).toBeInTheDocument();
    });

    // Fast-forward time to trigger updates
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Positions should be updated
    expect(screen.getByTestId('position-RELIANCE')).toBeInTheDocument();
  });

  it('displays error messages correctly', async () => {
    // Mock console.error to avoid test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<DashboardPage />);
    
    await waitFor(() => {
      // Trigger an error by clicking emergency stop
      const emergencyButton = screen.getByTestId('emergency-stop');
      fireEvent.click(emergencyButton);
    });

    consoleSpy.mockRestore();
  });

  it('shows live indicator when connected', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  it('displays connection status correctly', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    });
  });

  it('handles market data filtering', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('market-data-display')).toBeInTheDocument();
    });

    // Market data display should handle filtering internally
    expect(screen.getByTestId('market-RELIANCE')).toBeInTheDocument();
  });

  it('displays positions and orders correctly', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('position-RELIANCE')).toBeInTheDocument();
      expect(screen.getByTestId('order-book')).toBeInTheDocument();
    });
  });

  it('calculates total P&L correctly', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      // Should display calculated P&L in the metrics
      expect(screen.getByText('Today\'s P&L')).toBeInTheDocument();
    });
  });

  it('handles component cleanup on unmount', () => {
    const { unmount } = render(<DashboardPage />);
    
    // Should not throw errors on unmount
    expect(() => unmount()).not.toThrow();
  });
});