import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DashboardCard } from '../components/ui/dashboard-card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
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
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Mock NIFTY 50 data for development - expanded list
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
      symbol: 'HDFCBANK', 
      instrument_token: 341249,
      ltp: 1645.75, 
      change: 28.90, 
      change_percent: 1.79, 
      volume: 1100000, 
      bid: 1645.50,
      ask: 1645.75,
      ohlc: { open: 1616.85, high: 1650.20, low: 1610.50, close: 1616.85 },
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
    },
    { 
      symbol: 'ICICIBANK', 
      instrument_token: 1270529,
      ltp: 1142.30, 
      change: 12.45, 
      change_percent: 1.10, 
      volume: 980000, 
      bid: 1142.00,
      ask: 1142.30,
      ohlc: { open: 1129.85, high: 1145.60, low: 1125.40, close: 1129.85 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'HINDUNILVR', 
      instrument_token: 356865,
      ltp: 2385.20, 
      change: -15.80, 
      change_percent: -0.66, 
      volume: 420000, 
      bid: 2385.00,
      ask: 2385.20,
      ohlc: { open: 2401.00, high: 2405.75, low: 2380.10, close: 2401.00 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'ITC', 
      instrument_token: 424961,
      ltp: 456.75, 
      change: 3.25, 
      change_percent: 0.72, 
      volume: 1850000, 
      bid: 456.50,
      ask: 456.75,
      ohlc: { open: 453.50, high: 458.20, low: 452.80, close: 453.50 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'SBIN', 
      instrument_token: 779521,
      ltp: 825.40, 
      change: 18.90, 
      change_percent: 2.34, 
      volume: 2100000, 
      bid: 825.20,
      ask: 825.40,
      ohlc: { open: 806.50, high: 828.75, low: 804.20, close: 806.50 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'BHARTIARTL', 
      instrument_token: 2714625,
      ltp: 1598.25, 
      change: -22.15, 
      change_percent: -1.37, 
      volume: 1320000, 
      bid: 1598.00,
      ask: 1598.25,
      ohlc: { open: 1620.40, high: 1625.80, low: 1595.30, close: 1620.40 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'KOTAKBANK', 
      instrument_token: 492033,
      ltp: 1734.60, 
      change: 8.35, 
      change_percent: 0.48, 
      volume: 680000, 
      bid: 1734.40,
      ask: 1734.60,
      ohlc: { open: 1726.25, high: 1738.90, low: 1722.15, close: 1726.25 },
      timestamp: new Date().toISOString()
    },
    { 
      symbol: 'LT', 
      instrument_token: 2939649,
      ltp: 3485.75, 
      change: -45.20, 
      change_percent: -1.28, 
      volume: 540000, 
      bid: 3485.50,
      ask: 3485.75,
      ohlc: { open: 3530.95, high: 3535.40, low: 3480.60, close: 3530.95 },
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

  // Real-time data updates with WebSocket simulation
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchDashboardData();
    
    // Set up real-time updates every 1 second for more responsive updates
    const intervalId = setInterval(() => {
      if (tradingStatus.connection_status === 'connected') {
        // Simulate real-time price updates with more realistic movements
        setMarketData(prevData => 
          prevData.map(item => {
            const priceChange = (Math.random() - 0.5) * (item.ltp * 0.002); // 0.2% max change
            const newLtp = Math.max(0.01, item.ltp + priceChange);
            const newChange = newLtp - item.ohlc!.close;
            const newChangePercent = (newChange / item.ohlc!.close) * 100;
            const volumeIncrease = Math.floor(Math.random() * 5000);
            
            return {
              ...item,
              ltp: newLtp,
              change: newChange,
              change_percent: newChangePercent,
              volume: item.volume + volumeIncrease,
              bid: newLtp - 0.05,
              ask: newLtp + 0.05,
              timestamp: new Date().toISOString()
            };
          })
        );
      }
    }, 1000); // Update every 1 second for real-time feel

    return () => clearInterval(intervalId);
  }, [isAuthenticated, fetchDashboardData, tradingStatus.connection_status]);

  // Separate effect for position updates based on market data
  useEffect(() => {
    if (tradingStatus.connection_status === 'connected' && marketData.length > 0) {
      setPositions(prevPositions =>
        prevPositions.map(position => {
          const marketItem = marketData.find(item => item.symbol === position.symbol);
          if (marketItem) {
            const currentPrice = marketItem.ltp;
            const pnl = position.trade_type === 'Buy' 
              ? (currentPrice - position.average_price) * position.quantity
              : (position.average_price - currentPrice) * Math.abs(position.quantity);
            const pnlPercentage = (pnl / (position.average_price * Math.abs(position.quantity))) * 100;
            
            return {
              ...position,
              current_price: currentPrice,
              pnl,
              pnl_percentage: pnlPercentage,
              last_updated: new Date().toISOString()
            };
          }
          return position;
        })
      );
    }
  }, [marketData, tradingStatus.connection_status]);

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
      setWsConnected(false);
      
      // Simulate WebSocket reconnection
      // await invoke('reconnect_websocket');
      setTimeout(() => {
        setTradingStatus(prev => ({ 
          ...prev, 
          connection_status: 'connected',
          last_connected: new Date().toISOString()
        }));
        setWsConnected(true);
        
        // Simulate successful reconnection with fresh data
        fetchDashboardData();
      }, 2000);
    } catch (err) {
      console.error('Reconnection failed:', err);
      setTradingStatus(prev => ({ ...prev, connection_status: 'failed' }));
      setWsConnected(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      console.log('Disconnecting from market data');
      // await invoke('disconnect_websocket');
      setTradingStatus(prev => ({ ...prev, connection_status: 'disconnected' }));
      setWsConnected(false);
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
      {/* Header with Trading Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trading Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.username}. Monitor and control your trading operations.
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* Market Status */}
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-md font-medium text-sm ${
            isMarketOpen 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span>{isMarketOpen ? 'Market Open' : 'Market Closed'}</span>
          </div>

          {/* Trading Status */}
          <Badge variant={tradingStatus.is_trading ? "default" : "secondary"} className="text-xs">
            {tradingStatus.is_trading ? 'Trading Active' : 'Trading Stopped'}
          </Badge>

          {/* Trading Controls */}
          <div className="flex items-center space-x-2">
            {!tradingStatus.is_trading ? (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleStartTrading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-1" />
                Start Trading
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleStopTrading}
              >
                <Pause className="w-4 h-4 mr-1" />
                Stop Trading
              </Button>
            )}

            <EmergencyStopButton
              onEmergencyStop={handleEmergencyStop}
              isTrading={tradingStatus.is_trading}
              isLoading={isLoading}
            />
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Connection Status */}
      <ConnectionStatus
        status={tradingStatus.connection_status}
        lastConnected={tradingStatus.last_connected}
        onReconnect={handleReconnect}
        onDisconnect={handleDisconnect}
        isMarketOpen={isMarketOpen}
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Account Balance"
          value={`₹${accountInfo?.balance.toLocaleString('en-IN') || '0'}`}
          description={`Available: ₹${accountInfo?.available_margin.toLocaleString('en-IN') || '0'}`}
          icon={<DollarSign className="w-4 h-4" />}
        />
        
        <DashboardCard
          title="Today's P&L"
          value={`${totalPnL >= 0 ? '+' : ''}₹${totalPnL.toFixed(2)}`}
          change={totalPnLPercent}
          icon={totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          className={cn(
            "transition-all duration-300",
            totalPnL >= 0 ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"
          )}
        />
        
        <DashboardCard
          title="Open Positions"
          value={positions.length.toString()}
          description={`${tradingStatus.total_trades_today} trades today`}
          icon={<Target className="w-4 h-4" />}
          className={positions.length > 0 ? "border-blue-200 bg-blue-50/30" : ""}
        />
        
        <DashboardCard
          title="Active Strategies"
          value={tradingStatus.active_strategies.toString()}
          description={
            <div className="flex items-center space-x-1">
              <span>Running algorithms</span>
              {tradingStatus.is_trading && (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
          }
          icon={<Activity className="w-4 h-4" />}
          className={tradingStatus.is_trading ? "border-green-200 bg-green-50/30" : ""}
        />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Market Data Display */}
        <div className="xl:col-span-8">
          <MarketDataDisplay
            marketData={marketData}
            onRefresh={handleRefresh}
            onQuickTrade={handleQuickTrade}
            onToggleFavorite={handleToggleFavorite}
            favorites={favorites}
            isLoading={refreshing}
            className="h-[600px]"
          />
        </div>

        {/* Positions Panel */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-lg font-semibold">Open Positions</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {positions.length} positions
                  </Badge>
                </div>
                {tradingStatus.connection_status === 'connected' && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-600">Live</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[250px] overflow-y-auto">
              {positions.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground text-sm">No open positions</p>
                </div>
              ) : (
                positions.map((position) => (
                  <PositionCard
                    key={position.symbol}
                    position={position}
                    onClose={handleClosePosition}
                    onModify={handleModifyPosition}
                    className="mb-3"
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Order Book */}
          <OrderBook
            orders={orders}
            onRefresh={handleRefresh}
            onCancelOrder={handleCancelOrder}
            onModifyOrder={handleModifyOrder}
            isLoading={refreshing}
            className="h-[320px]"
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;