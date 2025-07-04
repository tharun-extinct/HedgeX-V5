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
      <div className="flex h-screen items-center justify-center" style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      }}>
        <div className="text-center">
          <div 
            className="w-16 h-16 border-4 border-t-4 rounded-full animate-spin mx-auto"
            style={{
              borderColor: '#e2e8f0',
              borderTopColor: '#3b82f6'
            }}
          ></div>
          <p className="mt-6 text-slate-600 font-semibold text-lg">Loading market data...</p>
        </div>
      </div>
    );
  }

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent = positions.length > 0 ? (totalPnL / positions.reduce((sum, pos) => sum + (pos.entryPrice * Math.abs(pos.quantity)), 0)) * 100 : 0;

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    }}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 
              className="text-5xl font-bold text-transparent bg-clip-text mb-3"
              style={{
                backgroundImage: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
              }}
            >
              Trading Dashboard
            </h1>
            <p className="text-slate-600 text-xl">Real-time market data and portfolio overview</p>
          </div>
          <div className="flex items-center space-x-4">
            <div 
              className={`flex items-center space-x-3 px-6 py-3 rounded-2xl font-semibold ${
                isMarketOpen 
                  ? 'bg-green-100 text-green-800 border-2 border-green-200' 
                  : 'bg-red-100 text-red-800 border-2 border-red-200'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${isMarketOpen ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span>{isMarketOpen ? 'Market Open' : 'Market Closed'}</span>
            </div>
          </div>
        </div>

        {error && (
          <div 
            className="border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl mb-8 flex items-center space-x-3"
            style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            }}
          >
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <Card 
            className="shadow-2xl border-0 transform hover:scale-105 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            }}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-blue-700">Account Balance</CardTitle>
                <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-900 mb-2">₹1,25,000</div>
              <div className="text-sm text-blue-600 font-medium">Available for trading</div>
            </CardContent>
          </Card>
          
          <Card 
            className={`shadow-2xl border-0 transform hover:scale-105 transition-all duration-300 ${
              totalPnL >= 0 
                ? 'bg-gradient-to-br from-green-50 to-green-100' 
                : 'bg-gradient-to-br from-red-50 to-red-100'
            }`}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-bold ${totalPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>Today's P&L</CardTitle>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${totalPnL >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                  {totalPnL >= 0 ? <TrendingUp className="w-6 h-6 text-white" /> : <TrendingDown className="w-6 h-6 text-white" />}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold mb-2 ${totalPnL >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toFixed(2)}
              </div>
              <div className={`text-sm font-medium ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="shadow-2xl border-0 transform hover:scale-105 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
            }}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-purple-700">Open Positions</CardTitle>
                <div className="w-12 h-12 rounded-2xl bg-purple-500 flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-purple-900 mb-2">{positions.length}</div>
              <div className="text-sm text-purple-600 font-medium">Active trades</div>
            </CardContent>
          </Card>

          <Card 
            className="shadow-2xl border-0 transform hover:scale-105 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)',
            }}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-orange-700">Active Strategies</CardTitle>
                <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-orange-900 mb-2">2</div>
              <div className="text-sm text-orange-600 font-medium">Running algorithms</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          {/* Market Watch */}
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader 
              className="rounded-t-2xl"
              style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900">Market Watch</CardTitle>
                  <CardDescription className="text-slate-600 text-lg">NIFTY 50 top performers</CardDescription>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Activity className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                {marketData.map((stock, index) => (
                  <div key={stock.symbol} className={`p-6 border-b border-slate-100 hover:bg-slate-50 transition-all duration-300 ${index === 0 ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className={`w-4 h-4 rounded-full ${stock.change >= 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-lg">{stock.symbol}</h3>
                            <p className="text-sm text-slate-500">Vol: {(stock.volume / 1000).toFixed(0)}K</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-lg">₹{stock.lastPrice.toFixed(2)}</div>
                        <div className={`text-sm font-bold flex items-center ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stock.change >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-6">
                        <Button 
                          size="sm" 
                          className="h-10 px-4 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105"
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          }}
                          onClick={() => handleQuickTrade(stock.symbol, 'BUY')}
                          disabled={!isMarketOpen}
                        >
                          Buy
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-10 px-4 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105"
                          style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          }}
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
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader 
              className="rounded-t-2xl"
              style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900">Open Positions</CardTitle>
                  <CardDescription className="text-slate-600 text-lg">Currently active trades</CardDescription>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Target className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                {positions.length > 0 ? (
                  positions.map((position) => (
                    <div key={position.symbol} className="p-6 border-b border-slate-100 hover:bg-slate-50 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className={`w-4 h-4 rounded-full ${position.quantity > 0 ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-lg">{position.symbol}</h3>
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
                        <div className="text-right ml-6">
                          <div className={`font-bold text-lg ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {position.pnl >= 0 ? '+' : ''}₹{position.pnl.toFixed(2)}
                          </div>
                          <div className={`text-sm font-semibold ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-slate-500">
                    <Target className="w-16 h-16 mx-auto mb-6 text-slate-300" />
                    <p className="text-lg font-medium">No open positions</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Strategies */}
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader 
            className="rounded-t-2xl"
            style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900">Active Strategies</CardTitle>
                <CardDescription className="text-slate-600 text-lg">Automated trading algorithms</CardDescription>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card 
                className="border-0 hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-green-900">NIFTY Momentum</CardTitle>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-bold text-green-700 bg-green-200 px-2 py-1 rounded-full">ACTIVE</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 font-medium">Today's P&L:</span>
                    <span className="font-bold text-green-900">+₹1,250.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 font-medium">Positions:</span>
                    <span className="font-bold text-green-900">2</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 font-medium">Win Rate:</span>
                    <span className="font-bold text-green-900">68%</span>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <Button 
                      size="sm" 
                      className="flex-1 text-green-700 border-2 border-green-300 bg-green-50 hover:bg-green-100 font-semibold rounded-xl"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 text-green-700 border-2 border-green-300 bg-green-50 hover:bg-green-100 font-semibold rounded-xl"
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="border-0 hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-yellow-900">Mean Reversion</CardTitle>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs font-bold text-yellow-700 bg-yellow-200 px-2 py-1 rounded-full">STANDBY</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-700 font-medium">Today's P&L:</span>
                    <span className="font-bold text-red-600">-₹320.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-700 font-medium">Positions:</span>
                    <span className="font-bold text-yellow-900">1</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-700 font-medium">Win Rate:</span>
                    <span className="font-bold text-yellow-900">56%</span>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <Button 
                      size="sm" 
                      className="flex-1 text-yellow-700 border-2 border-yellow-300 bg-yellow-50 hover:bg-yellow-100 font-semibold rounded-xl"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Activate
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 text-yellow-700 border-2 border-yellow-300 bg-yellow-50 hover:bg-yellow-100 font-semibold rounded-xl"
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="border-0 hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900">Gap & Go</CardTitle>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                      <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded-full">INACTIVE</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">Today's P&L:</span>
                    <span className="font-bold text-slate-700">₹0.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">Positions:</span>
                    <span className="font-bold text-slate-700">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">Win Rate:</span>
                    <span className="font-bold text-slate-700">62%</span>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <Button 
                      size="sm" 
                      className="flex-1 text-slate-600 border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold rounded-xl"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Activate
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 text-slate-600 border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold rounded-xl"
                    >
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