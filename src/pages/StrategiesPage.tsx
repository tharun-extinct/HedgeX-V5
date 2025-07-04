import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Play, Pause, Square, Settings, TrendingUp, TrendingDown, Zap, Target, BarChart3, Plus } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'standby' | 'inactive';
  instruments: string[];
  performance: {
    dailyPnL: number;
    weeklyPnL: number;
    monthlyPnL: number;
    totalPnL: number;
    winRate: number;
  };
  parameters: Record<string, any>;
}

const StrategiesPage: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mockStrategies: Strategy[] = [
    {
      id: '1',
      name: 'NIFTY Momentum',
      description: 'Captures short-term momentum in NIFTY 50 stocks based on technical indicators and volume analysis.',
      status: 'active',
      instruments: ['RELIANCE', 'TCS', 'INFY', 'HDFC'],
      performance: {
        dailyPnL: 1250,
        weeklyPnL: 4560,
        monthlyPnL: 15400,
        totalPnL: 45780,
        winRate: 0.68
      },
      parameters: {
        timeframe: '5m',
        lookbackPeriod: 14,
        momentumThreshold: 0.5,
        stopLoss: 0.5,
        takeProfit: 1.5
      }
    },
    {
      id: '2',
      name: 'Mean Reversion',
      description: 'Identifies and trades overbought and oversold conditions using statistical measures and Bollinger Bands.',
      status: 'standby',
      instruments: ['SBIN', 'ICICI', 'TATASTEEL', 'HINDALCO'],
      performance: {
        dailyPnL: -320,
        weeklyPnL: 1250,
        monthlyPnL: 5600,
        totalPnL: 18700,
        winRate: 0.56
      },
      parameters: {
        timeframe: '15m',
        standardDeviations: 2,
        lookbackPeriod: 20,
        entryThreshold: 0.8,
        stopLoss: 0.75
      }
    },
    {
      id: '3',
      name: 'Gap & Go',
      description: 'Trades opening gaps in high-volume stocks with momentum continuation.',
      status: 'inactive',
      instruments: ['BHARTIARTL', 'ADANIENT', 'HDFCBANK', 'MARUTI'],
      performance: {
        dailyPnL: 0,
        weeklyPnL: 2450,
        monthlyPnL: 7820,
        totalPnL: 23400,
        winRate: 0.62
      },
      parameters: {
        gapThreshold: 1.5,
        minVolume: 1000000,
        timeFrame: '1m',
        profitTarget: 2.0,
        stopLoss: 1.0
      }
    }
  ];

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setIsLoading(true);
        setStrategies(mockStrategies);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch strategies:', err);
        setError('Failed to load strategies. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  const handleStrategyStatusChange = async (strategyId: string, newStatus: 'active' | 'standby' | 'inactive') => {
    try {
      setStrategies(strategies.map(strategy => 
        strategy.id === strategyId 
          ? { ...strategy, status: newStatus }
          : strategy
      ));
      
      if (selectedStrategy?.id === strategyId) {
        setSelectedStrategy({
          ...selectedStrategy,
          status: newStatus
        });
      }
    } catch (err) {
      console.error(`Failed to update strategy status:`, err);
      setError('Failed to update strategy. Please try again.');
    }
  };

  const handleSelectStrategy = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading strategies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Trading Strategies
            </h1>
            <p className="text-slate-600 mt-2">Manage and monitor your automated trading algorithms</p>
          </div>
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
            <Plus className="w-4 h-4 mr-2" />
            Create New Strategy
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{error}</span>
          </div>
        )}

        {/* Strategy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {strategies.map((strategy) => (
            <Card 
              key={strategy.id} 
              className={`cursor-pointer transition-all duration-300 hover:shadow-xl transform hover:scale-[1.02] ${
                selectedStrategy?.id === strategy.id 
                  ? 'ring-2 ring-purple-500 shadow-xl' 
                  : 'shadow-lg hover:shadow-xl'
              } ${
                strategy.status === 'active' 
                  ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' 
                  : strategy.status === 'standby'
                  ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
                  : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'
              }`}
              onClick={() => handleSelectStrategy(strategy)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold text-slate-900">{strategy.name}</CardTitle>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 ${
                    strategy.status === 'active' 
                      ? 'bg-green-200 text-green-800' 
                      : strategy.status === 'standby' 
                      ? 'bg-yellow-200 text-yellow-800' 
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      strategy.status === 'active' 
                        ? 'bg-green-500 animate-pulse' 
                        : strategy.status === 'standby' 
                        ? 'bg-yellow-500' 
                        : 'bg-slate-400'
                    }`}></div>
                    <span>{strategy.status.toUpperCase()}</span>
                  </div>
                </div>
                <CardDescription className="text-slate-600 line-clamp-2">
                  {strategy.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Today's P&L</div>
                    <div className={`text-lg font-bold ${strategy.performance.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {strategy.performance.dailyPnL >= 0 ? '+' : ''}₹{strategy.performance.dailyPnL.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Win Rate</div>
                    <div className="text-lg font-bold text-slate-900">
                      {(strategy.performance.winRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/60 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-2">Instruments ({strategy.instruments.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {strategy.instruments.slice(0, 3).map((instrument) => (
                      <span key={instrument} className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-md font-medium">
                        {instrument}
                      </span>
                    ))}
                    {strategy.instruments.length > 3 && (
                      <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-md font-medium">
                        +{strategy.instruments.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex gap-2 pt-0">
                {strategy.status !== 'active' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStrategyStatusChange(strategy.id, 'active');
                    }}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Activate
                  </Button>
                )}
                {strategy.status === 'active' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStrategyStatusChange(strategy.id, 'standby');
                    }}
                  >
                    <Pause className="w-3 h-3 mr-1" />
                    Pause
                  </Button>
                )}
                {strategy.status !== 'inactive' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStrategyStatusChange(strategy.id, 'inactive');
                    }}
                  >
                    <Square className="w-3 h-3 mr-1" />
                    Stop
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Strategy Details */}
        {selectedStrategy && (
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900">{selectedStrategy.name}</CardTitle>
                  <CardDescription className="text-slate-600 mt-2">{selectedStrategy.description}</CardDescription>
                </div>
                <Button variant="outline" className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>Edit Strategy</span>
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-8">
              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className={`bg-gradient-to-br ${selectedStrategy.performance.dailyPnL >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-700">Daily P&L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${selectedStrategy.performance.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStrategy.performance.dailyPnL >= 0 ? '+' : ''}₹{selectedStrategy.performance.dailyPnL.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className={`bg-gradient-to-br ${selectedStrategy.performance.weeklyPnL >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-700">Weekly P&L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${selectedStrategy.performance.weeklyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStrategy.performance.weeklyPnL >= 0 ? '+' : ''}₹{selectedStrategy.performance.weeklyPnL.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className={`bg-gradient-to-br ${selectedStrategy.performance.monthlyPnL >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-700">Monthly P&L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${selectedStrategy.performance.monthlyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStrategy.performance.monthlyPnL >= 0 ? '+' : ''}₹{selectedStrategy.performance.monthlyPnL.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-700">Win Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {(selectedStrategy.performance.winRate * 100).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Strategy Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Settings className="w-5 h-5 text-purple-600" />
                      <CardTitle className="text-lg font-bold text-purple-900">Strategy Parameters</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(selectedStrategy.parameters).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center bg-white/60 rounded-lg p-3">
                          <span className="font-medium text-slate-700 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </span>
                          <span className="font-bold text-slate-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-lg font-bold text-blue-900">Instruments</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedStrategy.instruments.map((instrument) => (
                        <div key={instrument} className="bg-white/60 rounded-lg p-3 text-center">
                          <div className="font-bold text-slate-900">{instrument}</div>
                          <div className="text-xs text-slate-600 mt-1">Active</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Trades */}
              <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-slate-600" />
                    <CardTitle className="text-lg font-bold text-slate-900">Recent Trades</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 font-semibold text-slate-700">Date</th>
                          <th className="text-left py-3 font-semibold text-slate-700">Instrument</th>
                          <th className="text-left py-3 font-semibold text-slate-700">Direction</th>
                          <th className="text-right py-3 font-semibold text-slate-700">Entry Price</th>
                          <th className="text-right py-3 font-semibold text-slate-700">Exit Price</th>
                          <th className="text-right py-3 font-semibold text-slate-700">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { date: '2025-07-02 10:15', instrument: 'RELIANCE', direction: 'Long', entry: 2540.50, exit: 2556.75, pnl: 325.00 },
                          { date: '2025-07-02 11:30', instrument: 'TCS', direction: 'Short', entry: 3820.25, exit: 3805.50, pnl: 295.00 },
                          { date: '2025-07-02 13:45', instrument: 'INFY', direction: 'Long', entry: 1624.00, exit: 1615.25, pnl: -175.00 },
                          { date: '2025-07-03 09:30', instrument: 'HDFC', direction: 'Long', entry: 2245.75, exit: 2275.50, pnl: 595.00 },
                          { date: '2025-07-03 11:15', instrument: 'RELIANCE', direction: 'Short', entry: 2570.25, exit: 2560.50, pnl: 195.00 }
                        ].map((trade, index) => (
                          <tr key={index} className="border-b border-slate-100 hover:bg-white/60 transition-colors">
                            <td className="py-3 text-slate-700">{trade.date}</td>
                            <td className="py-3 font-medium text-slate-900">{trade.instrument}</td>
                            <td className={`py-3 font-medium ${trade.direction === 'Long' ? 'text-green-600' : 'text-red-600'}`}>
                              {trade.direction}
                            </td>
                            <td className="text-right py-3 text-slate-700">₹{trade.entry.toFixed(2)}</td>
                            <td className="text-right py-3 text-slate-700">₹{trade.exit.toFixed(2)}</td>
                            <td className={`text-right py-3 font-bold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {trade.pnl >= 0 ? '+' : ''}₹{trade.pnl.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StrategiesPage;