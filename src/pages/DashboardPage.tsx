import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DashboardCard } from '../components/ui/dashboard-card';
import { Button } from '../components/ui/button';
import { 
  TrendingUp, TrendingDown, Activity, DollarSign, Target, ArrowUpRight, 
  ArrowDownRight, BarChart2, RefreshCw, AlertCircle
} from 'lucide-react';

interface MarketData {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
}

interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

const DashboardPage: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Mock data for beautiful display
  const mockMarketData: MarketData[] = [
    { symbol: 'NIFTY 50', lastPrice: 19847.50, change: 125.30, changePercent: 0.63, volume: 2450000, open: 19722.20, high: 19865.40, low: 19705.80 },
    { symbol: 'RELIANCE', lastPrice: 2540.50, change: 15.75, changePercent: 0.62, volume: 1250000, open: 2524.75, high: 2548.20, low: 2520.30 },
    { symbol: 'TCS', lastPrice: 3820.25, change: -12.50, changePercent: -0.33, volume: 890000, open: 3832.75, high: 3845.60, low: 3815.40 },
    { symbol: 'HDFC', lastPrice: 2245.75, change: 28.90, changePercent: 1.30, volume: 1100000, open: 2216.85, high: 2250.20, low: 2210.50 },
    { symbol: 'INFY', lastPrice: 1624.00, change: -8.25, changePercent: -0.51, volume: 750000, open: 1632.25, high: 1638.75, low: 1620.10 }
  ];

  const mockPositions: Position[] = [
    { symbol: 'RELIANCE', quantity: 10, entryPrice: 2525.00, currentPrice: 2540.50, pnl: 155.00, pnlPercent: 0.61 },
    { symbol: 'HDFC', quantity: 8, entryPrice: 2220.00, currentPrice: 2245.75, pnl: 206.00, pnlPercent: 1.16 },
    { symbol: 'TCS', quantity: -5, entryPrice: 3835.00, currentPrice: 3820.25, pnl: 73.75, pnlPercent: 0.38 }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setIsMarketOpen(true);
        setMarketData(mockMarketData);
        setPositions(mockPositions);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load market data. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const handleQuickTrade = async (symbol: string, action: 'BUY' | 'SELL') => {
    try {
      console.log(`Quick ${action} order for ${symbol}`);
    } catch (err) {
      console.error(`Failed to place ${action} order for ${symbol}:`, err);
      setError(`Failed to place ${action} order. Please try again.`);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setMarketData(mockMarketData);
      setPositions(mockPositions);
      setRefreshing(false);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background/50">
        <div className="text-center">
          <div className="flex flex-col items-center">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <p className="mt-6 text-foreground font-medium">Loading market data...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent = positions.length > 0 ? (totalPnL / positions.reduce((sum, pos) => sum + (pos.entryPrice * Math.abs(pos.quantity)), 0)) * 100 : 0;

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