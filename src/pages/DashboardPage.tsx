import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { TrendingUp, TrendingDown, Activity, DollarSign, Target, Zap, Play, Pause, Square, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    const intervalId = setInterval(fetchData, 5000);
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading market data...</p>
        </div>
      </div>
    );
  }

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent = positions.length > 0 ? (totalPnL / positions.reduce((sum, pos) => sum + (pos.entryPrice * Math.abs(pos.quantity)), 0)) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Trading Dashboard
            </h1>
            <p className="text-slate-600 mt-2">Real-time market data and portfolio overview</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${isMarketOpen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="font-medium">{isMarketOpen ? 'Market Open' : 'Market Closed'}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{error}</span>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-blue-700">Account Balance</CardTitle>
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">₹1,25,000</div>
              <div className="text-sm text-blue-600 mt-1">Available for trading</div>
            </CardContent>
          </Card>
          
          <Card className={`bg-gradient-to-br ${totalPnL >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'} shadow-lg hover:shadow-xl transition-all duration-300`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-medium ${totalPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>Today's P&L</CardTitle>
                {totalPnL >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toFixed(2)}
              </div>
              <div className={`text-sm mt-1 ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-purple-700">Open Positions</CardTitle>
                <Target className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">{positions.length}</div>
              <div className="text-sm text-purple-600 mt-1">Active trades</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-orange-700">Active Strategies</CardTitle>
                <Activity className="w-5 h-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900">2</div>
              <div className="text-sm text-orange-600 mt-1">Running algorithms</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Market Watch */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">Market Watch</CardTitle>
                  <CardDescription className="text-slate-600">NIFTY 50 top performers</CardDescription>
                </div>
                <Activity className="w-6 h-6 text-slate-600" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                {marketData.map((stock, index) => (
                  <div key={stock.symbol} className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${stock.change >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div>
                            <h3 className="font-bold text-slate-900">{stock.symbol}</h3>
                            <p className="text-sm text-slate-500">Vol: {(stock.volume / 1000).toFixed(0)}K</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">₹{stock.lastPrice.toFixed(2)}</div>
                        <div className={`text-sm font-medium flex items-center ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stock.change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                        </div>
                      </div>
                      <div className="flex space-x-1 ml-4">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 px-3 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 transition-colors"
                          onClick={() => handleQuickTrade(stock.symbol, 'BUY')}
                          disabled={!isMarketOpen}
                        >
                          Buy
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
                          onClick={() => handleQuickTrade(stock.symbol, 'SELL')}
                          disabled={!isMarketOpen}
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

          {/* Open Positions */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">Open Positions</CardTitle>
                  <CardDescription className="text-slate-600">Currently active trades</CardDescription>
                </div>
                <Target className="w-6 h-6 text-slate-600" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                {positions.length > 0 ? (
                  positions.map((position) => (
                    <div key={position.symbol} className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${position.quantity > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <div>
                              <h3 className="font-bold text-slate-900">{position.symbol}</h3>
                              <p className="text-sm text-slate-500">
                                {position.quantity > 0 ? 'Long' : 'Short'} {Math.abs(position.quantity)} shares
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-600">
                            Entry: ₹{position.entryPrice.toFixed(2)}
                          </div>
                          <div className="text-sm text-slate-600">
                            Current: ₹{position.currentPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className={`font-bold ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {position.pnl >= 0 ? '+' : ''}₹{position.pnl.toFixed(2)}
                          </div>
                          <div className={`text-sm ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <Target className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No open positions</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Strategies */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">Active Strategies</CardTitle>
                <CardDescription className="text-slate-600">Automated trading algorithms</CardDescription>
              </div>
              <Zap className="w-6 h-6 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-green-900">NIFTY Momentum</CardTitle>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium text-green-700">ACTIVE</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Today's P&L:</span>
                    <span className="font-bold text-green-900">+₹1,250.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Positions:</span>
                    <span className="font-medium text-green-900">2</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Win Rate:</span>
                    <span className="font-medium text-green-900">68%</span>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 text-green-700 border-green-300 hover:bg-green-50">
                      <Pause className="w-3 h-3 mr-1" />
                      Pause
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-green-700 border-green-300 hover:bg-green-50">
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-yellow-900">Mean Reversion</CardTitle>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs font-medium text-yellow-700">STANDBY</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-700">Today's P&L:</span>
                    <span className="font-bold text-red-600">-₹320.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-700">Positions:</span>
                    <span className="font-medium text-yellow-900">1</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-700">Win Rate:</span>
                    <span className="font-medium text-yellow-900">56%</span>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 text-yellow-700 border-yellow-300 hover:bg-yellow-50">
                      <Play className="w-3 h-3 mr-1" />
                      Activate
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-yellow-700 border-yellow-300 hover:bg-yellow-50">
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-slate-900">Gap & Go</CardTitle>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                      <span className="text-xs font-medium text-slate-600">INACTIVE</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Today's P&L:</span>
                    <span className="font-medium text-slate-700">₹0.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Positions:</span>
                    <span className="font-medium text-slate-700">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Win Rate:</span>
                    <span className="font-medium text-slate-700">62%</span>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 text-slate-600 border-slate-300 hover:bg-slate-50">
                      <Play className="w-3 h-3 mr-1" />
                      Activate
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-slate-600 border-slate-300 hover:bg-slate-50">
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;