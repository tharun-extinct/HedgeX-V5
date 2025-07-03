import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

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

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setIsLoading(true);
        const strategiesData = await invoke<Strategy[]>('get_strategies');
        setStrategies(strategiesData);
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
      await invoke('update_strategy_status', {
        strategyId,
        status: newStatus
      });
      
      // Update local state
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

  // Use mock data if no strategies are returned from backend
  useEffect(() => {
    if (!isLoading && strategies.length === 0) {
      setStrategies(mockStrategies);
    }
  }, [isLoading, strategies]);

  const handleSelectStrategy = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mx-auto"></div>
          <p className="mt-4">Loading strategies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Trading Strategies</h1>
        <Button>Create New Strategy</Button>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {strategies.map((strategy) => (
          <Card 
            key={strategy.id} 
            className={`cursor-pointer transition-all ${selectedStrategy?.id === strategy.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => handleSelectStrategy(strategy)}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{strategy.name}</CardTitle>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  strategy.status === 'active' ? 'bg-green-100 text-green-800' : 
                  strategy.status === 'standby' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-gray-100 text-gray-800'
                }`}>
                  {strategy.status.charAt(0).toUpperCase() + strategy.status.slice(1)}
                </div>
              </div>
              <CardDescription className="line-clamp-2">
                {strategy.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Today's P&L:</span>
                  <span className={`font-medium ${strategy.performance.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {strategy.performance.dailyPnL >= 0 ? '+' : ''}₹{strategy.performance.dailyPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Win Rate:</span>
                  <span className="font-medium">{(strategy.performance.winRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Instruments:</span>
                  <span className="font-medium">{strategy.instruments.length}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-0">
              {strategy.status !== 'active' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStrategyStatusChange(strategy.id, 'active');
                  }}
                >
                  Activate
                </Button>
              )}
              {strategy.status !== 'standby' && strategy.status !== 'inactive' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStrategyStatusChange(strategy.id, 'standby');
                  }}
                >
                  Pause
                </Button>
              )}
              {strategy.status !== 'inactive' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-red-600 hover:text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStrategyStatusChange(strategy.id, 'inactive');
                  }}
                >
                  Stop
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {selectedStrategy && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Strategy Details: {selectedStrategy.name}</CardTitle>
              <Button variant="outline">Edit Strategy</Button>
            </div>
            <CardDescription>{selectedStrategy.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Daily P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${selectedStrategy.performance.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedStrategy.performance.dailyPnL >= 0 ? '+' : ''}₹{selectedStrategy.performance.dailyPnL.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Weekly P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${selectedStrategy.performance.weeklyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedStrategy.performance.weeklyPnL >= 0 ? '+' : ''}₹{selectedStrategy.performance.weeklyPnL.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Monthly P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${selectedStrategy.performance.monthlyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedStrategy.performance.monthlyPnL >= 0 ? '+' : ''}₹{selectedStrategy.performance.monthlyPnL.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Win Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {(selectedStrategy.performance.winRate * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Strategy Parameters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(selectedStrategy.parameters).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Instruments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedStrategy.instruments.map((instrument) => (
                      <div key={instrument} className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
                        {instrument}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Instrument</th>
                        <th className="text-left py-2">Direction</th>
                        <th className="text-right py-2">Entry Price</th>
                        <th className="text-right py-2">Exit Price</th>
                        <th className="text-right py-2">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">2025-07-02 10:15</td>
                        <td className="py-2">RELIANCE</td>
                        <td className="py-2">Long</td>
                        <td className="text-right py-2">₹2,540.50</td>
                        <td className="text-right py-2">₹2,556.75</td>
                        <td className="text-right py-2 text-green-600">+₹325.00</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">2025-07-02 11:30</td>
                        <td className="py-2">TCS</td>
                        <td className="py-2">Short</td>
                        <td className="text-right py-2">₹3,820.25</td>
                        <td className="text-right py-2">₹3,805.50</td>
                        <td className="text-right py-2 text-green-600">+₹295.00</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">2025-07-02 13:45</td>
                        <td className="py-2">INFY</td>
                        <td className="py-2">Long</td>
                        <td className="text-right py-2">₹1,624.00</td>
                        <td className="text-right py-2">₹1,615.25</td>
                        <td className="text-right py-2 text-red-600">-₹175.00</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">2025-07-03 09:30</td>
                        <td className="py-2">HDFC</td>
                        <td className="py-2">Long</td>
                        <td className="text-right py-2">₹2,245.75</td>
                        <td className="text-right py-2">₹2,275.50</td>
                        <td className="text-right py-2 text-green-600">+₹595.00</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">2025-07-03 11:15</td>
                        <td className="py-2">RELIANCE</td>
                        <td className="py-2">Short</td>
                        <td className="text-right py-2">₹2,570.25</td>
                        <td className="text-right py-2">₹2,560.50</td>
                        <td className="text-right py-2 text-green-600">+₹195.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StrategiesPage;
