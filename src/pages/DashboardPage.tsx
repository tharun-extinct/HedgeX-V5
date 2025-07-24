import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DashboardCard } from '../components/ui/dashboard-card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { 
  TrendingUp, TrendingDown, Activity, DollarSign, Target, ArrowUpRight, 
  ArrowDownRight, BarChart2, RefreshCw, AlertCircle, Play, Square, Pause
} from 'lucide-react';

// Import trading components
import PositionCard, { Position } from '../components/trading/PositionCard';
import OrderBook, { Order } from '../components/trading/OrderBook';
import EmergencyStopButton from '../components/trading/EmergencyStopButton';
import ConnectionStatus, { ConnectionState } from '../components/trading/ConnectionStatus';
import MarketDataDisplay, { MarketDataItem } from '../components/trading/MarketDataDisplay';

interface AccountInfo {
  balance: number;
  available_margin: number;
  used_margin: number;
  total_pnl: number;
  day_pnl: number;
}

interface TradingStatus {
  is_trading: boolean;
  active_strategies: number;
  total_trades_today: number;
  connection_status: ConnectionState;
  last_connected?: string;
}

const DashboardPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  
  // State management
  const [marketData, setMarketData] = useState<MarketDataItem[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [tradingStatus, setTradingStatus] = useState<TradingStatus>({
    is_trading: false,
    active_strategies: 0,
    total_trades_today: 0,
    connection_status: 'disconnected'
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Mock data for development
  const mockMarketData: MarketDataItem[] = [
    { 
      symbol: 'NIFTY 50', 
      instrument_token: 256265,
      ltp: 19847.50, 
      change: 125.30, 
      change_percent: 0.63, 
      volume: 2450000, 
      bid: 19847.00,
      ask: 19847.50,
      ohlc: { open: 19722.20, high: 19865.40, low: 19705.80, close: 19722.20 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'RELIANCE', 
      instrument_token: 738561,
      ltp: 2540.50, 
      change: 15.75, 
      change_percent: 0.62, 
      volume: 1250000, 
      bid: 2540.00,
      ask: 2540.50,
      ohlc: { open: 2524.75, high: 2548.20, low: 2520.30, close: 2524.75 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'TCS', 
      instrument_token: 2953217,
      ltp: 3820.25, 
      change: -12.50, 
      change_percent: -0.33, 
      volume: 890000, 
      bid: 3820.00,
      ask: 3820.25,
      ohlc: { open: 3832.75, high: 3845.60, low: 3815.40, close: 3832.75 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'HDFC', 
      instrument_token: 341249,
      ltp: 2245.75, 
      change: 28.90, 
      change_percent: 1.30, 
      volume: 1100000, 
      bid: 2245.50,
      ask: 2245.75,
      ohlc: { open: 2216.85, high: 2250.20, low: 2210.50, close: 2216.85 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'INFY', 
      instrument_token: 408065,
      ltp: 1624.00, 
      change: -8.25, 
      change_percent: -0.51, 
      volume: 750000, 
      bid: 1623.75,
      ask: 1624.00,
      ohlc: { open: 1632.25, high: 1638.75, low: 1620.10, close: 1632.25 },
      timestamp: new Date().toISOString()
    }
  ];

  const mockPositions: Position[] = [
    { 
      symbol: 'RELIANCE', 
      exchange: 'NSE',
      quantity: 10, 
      average_price: 2525.00, 
      current_price: 2540.50, 
      pnl: 155.00, 
      pnl_percentage: 0.61,
      trade_type: 'Buy',
      entry_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      last_updated: new Date().toISOString()
    },
    { 
      symbol: 'HDFC', 
      exchange: 'NSE',
      quantity: 8, 
      average_price: 2220.00, 
      current_price: 2245.75, 
      pnl: 206.00, 
      pnl_percentage: 1.16,
      trade_type: 'Buy',
      entry_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      last_updated: new Date().toISOString()
    },
    { 
      symbol: 'TCS', 
      exchange: 'NSE',
      quantity: -5, 
      average_price: 3835.00, 
      current_price: 3820.25, 
      pnl: 73.75, 
      pnl_percentage: 0.38,
      trade_type: 'Sell',
      entry_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      last_updated: new Date().toISOString()
    }
  ];

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
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
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
      created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      strategy_id: 'strategy_2'
    }
  ];

  const mockAccountInfo: AccountInfo = {
    balance: 125000,
    available_margin: 98500,
    used_margin: 26500,
    total_pnl: 434.75,
    day_pnl: 289.50
  };

  // Data fetching functions
  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      setIsLoading(true);
      setError(null);

      // In a real implementation, these would be actual API calls
      // For now, using mock data with some randomization for demo
      const updatedMarketData = mockMarketData.map(item => ({
        ...item,
        ltp: item.ltp + (Math.random() - 0.5) * 10,
        change: item.change + (Math.random() - 0.5) * 5,
        timestamp: new Date().toISOString()
      }));

      setMarketData(updatedMarketData);
      setPositions(mockPositions);
      setOrders(mockOrders);
      setAccountInfo(mockAccountInfo);
      setTradingStatus({
        is_trading: true,
        active_strategies: 2,
        total_trades_today: 15,
        connection_status: 'connected',
        last_connected: new Date().toISOString()
      });
      setIsMarketOpen(true);
      
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Real-time data updates
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchDashboardData();
    
    // Set up real-time updates every 5 seconds
    const intervalId = setInterval(() => {
      if (tradingStatus.connection_status === 'connected') {
        fetchDashboardData();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, fetchDashboardData, tradingStatus.connection_status]);

  // Trading action handlers
  const handleQuickTrade = async (symbol: string, action: 'BUY' | 'SELL') => {
    try {
      console.log(`Quick ${action} order for ${symbol}`);
      // In real implementation, this would call the trading API
      // await invoke('place_quick_order', { symbol, action, quantity: 1 });
    } catch (err) {
      console.error(`Failed to place ${action} order for ${symbol}:`, err);
      setError(`Failed to place ${action} order. Please try again.`);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      console.log('Emergency stop triggered');
      // await invoke('emergency_stop');
      setTradingStatus(prev => ({ ...prev, is_trading: false }));
    } catch (err) {
      console.error('Emergency stop failed:', err);
      setError('Emergency stop failed. Please try again.');
    }
  };

  const handleStartTrading = async () => {
    try {
      console.log('Starting trading');
      // await invoke('start_trading');
      setTradingStatus(prev => ({ ...prev, is_trading: true }));
    } catch (err) {
      console.error('Failed to start trading:', err);
      setError('Failed to start trading. Please try again.');
    }
  };

  const handleStopTrading = async () => {
    try {
      console.log('Stopping trading');
      // await invoke('stop_trading');
      setTradingStatus(prev => ({ ...prev, is_trading: false }));
    } catch (err) {
      console.error('Failed to stop trading:', err);
      setError('Failed to stop trading. Please try again.');
    }
  };

  const handleReconnect = async () => {
    try {
      console.log('Reconnecting to market data');
      setTradingStatus(prev => ({ ...prev, connection_status: 'connecting' }));
      // await invoke('reconnect_websocket');
      setTimeout(() => {
        setTradingStatus(prev => ({ 
          ...prev, 
          connection_status: 'connected',
          last_connected: new Date().toISOString()
        }));
      }, 2000);
    } catch (err) {
      console.error('Reconnection failed:', err);
      setTradingStatus(prev => ({ ...prev, connection_status: 'failed' }));
    }
  };

  const handleDisconnect = async () => {
    try {
      console.log('Disconnecting from market data');
      // await invoke('disconnect_websocket');
      setTradingStatus(prev => ({ ...prev, connection_status: 'disconnected' }));
    } catch (err) {
      console.error('Disconnection failed:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleToggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      console.log(`Cancelling order ${orderId}`);
      // await invoke('cancel_order', { orderId });
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: 'Cancelled' as const, updated_at: new Date().toISOString() }
          : order
      ));
    } catch (err) {
      console.error('Failed to cancel order:', err);
      setError('Failed to cancel order. Please try again.');
    }
  };

  const handleModifyOrder = async (orderId: string) => {
    console.log(`Modifying order ${orderId}`);
    // This would open a modify order dialog
  };

  const handleClosePosition = async (symbol: string) => {
    try {
      console.log(`Closing position for ${symbol}`);
      // await invoke('close_position', { symbol });
      setPositions(prev => prev.filter(pos => pos.symbol !== symbol));
    } catch (err) {
      console.error('Failed to close position:', err);
      setError('Failed to close position. Please try again.');
    }
  };

  const handleModifyPosition = async (symbol: string) => {
    console.log(`Modifying position for ${symbol}`);
    // This would open a modify position dialog
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center bg-background/50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium">Please log in to access the dashboard</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background/50">
        <div className="text-center">
          <div className="flex flex-col items-center">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <p className="mt-6 text-foreground font-medium">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent = positions.length > 0 ? (totalPnL / positions.reduce((sum, pos) => sum + (pos.average_price * Math.abs(pos.quantity)), 0)) * 100 : 0;

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Header with Market Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitor your trading performance in real-time</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium text-sm ${
            isMarketOpen 
              ? 'bg-success/10 text-success' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-success' : 'bg-destructive'} animate-pulse`}></div>
            <span>{isMarketOpen ? 'Market Open' : 'Market Closed'}</span>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Account Balance"
          value="₹1,25,000"
          description="Available for trading"
          icon={<DollarSign className="w-4 h-4" />}
        />
        
        <DashboardCard
          title="Today's P&L"
          value={`${totalPnL >= 0 ? '+' : ''}₹${totalPnL.toFixed(2)}`}
          change={totalPnLPercent}
          icon={totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          className={totalPnL >= 0 ? "border-success/20" : "border-destructive/20"}
        />
        
        <DashboardCard
          title="Open Positions"
          value={positions.length.toString()}
          description="Active trades"
          icon={<Target className="w-4 h-4" />}
        />
        
        <DashboardCard
          title="Active Strategies"
          value="2"
          description="Running algorithms"
          icon={<Activity className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Watch */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl font-medium">Market Watch</CardTitle>
              <CardDescription>NIFTY 50 top performers</CardDescription>
            </div>
            <BarChart2 className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md overflow-hidden">
              {marketData.map((stock) => (
                <div 
                  key={stock.symbol} 
                  className={`p-4 border-b border-border hover:bg-muted/50 transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${stock.change >= 0 ? 'bg-success' : 'bg-destructive'} animate-pulse`}></div>
                        <div>
                          <h3 className="font-semibold text-foreground">{stock.symbol}</h3>
                          <p className="text-xs text-muted-foreground">Vol: {(stock.volume / 1000).toFixed(0)}K</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-foreground">₹{stock.lastPrice.toFixed(2)}</div>
                      <div className={`text-xs font-medium flex items-center ${stock.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {stock.change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 text-xs rounded-md border-success/50 text-success hover:bg-success/10 hover:text-success"
                        onClick={() => handleQuickTrade(stock.symbol, 'BUY')}
                      >
                        Buy
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 text-xs rounded-md border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleQuickTrade(stock.symbol, 'SELL')}
                      >
                        Sell
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Positions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl font-medium">Your Positions</CardTitle>
              <CardDescription>Current open trades</CardDescription>
            </div>
            <Target className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md overflow-hidden">
              {positions.map((position) => (
                <div key={position.symbol} className="p-4 border-b border-border hover:bg-muted/50 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${position.pnl >= 0 ? 'bg-success' : 'bg-destructive'}`}></div>
                        <h3 className="font-semibold text-foreground">{position.symbol}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {position.quantity > 0 ? 'LONG' : 'SHORT'} {Math.abs(position.quantity)} @ ₹{position.entryPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${position.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {position.pnl >= 0 ? '+' : ''}₹{position.pnl.toFixed(2)}
                      </div>
                      <div className={`text-xs ${position.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {positions.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">No open positions</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    Open New Position
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;