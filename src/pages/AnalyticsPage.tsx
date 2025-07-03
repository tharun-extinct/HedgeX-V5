import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  totalProfit: number;
  netProfit: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
}

interface PerformanceByStrategy {
  strategyId: string;
  strategyName: string;
  trades: number;
  winRate: number;
  profitFactor: number;
  totalProfit: number;
  netProfit: number;
}

interface PerformanceByInstrument {
  symbol: string;
  trades: number;
  winRate: number;
  profitFactor: number;
  totalProfit: number;
  netProfit: number;
}

interface ProfitHistory {
  date: string;
  profit: number;
  cumulativeProfit: number;
}

const AnalyticsPage: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [strategyPerformance, setStrategyPerformance] = useState<PerformanceByStrategy[]>([]);
  const [instrumentPerformance, setInstrumentPerformance] = useState<PerformanceByInstrument[]>([]);
  const [profitHistory, setProfitHistory] = useState<ProfitHistory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        
        // In a real implementation, these would be actual Tauri commands
        const performanceMetrics = await invoke<PerformanceMetrics>('get_performance_metrics', {
          timeframe
        });
        setMetrics(performanceMetrics);

        const strategyPerf = await invoke<PerformanceByStrategy[]>('get_strategy_performance', {
          timeframe
        });
        setStrategyPerformance(strategyPerf);

        const instrumentPerf = await invoke<PerformanceByInstrument[]>('get_instrument_performance', {
          timeframe
        });
        setInstrumentPerformance(instrumentPerf);

        const profitData = await invoke<ProfitHistory[]>('get_profit_history', {
          timeframe
        });
        setProfitHistory(profitData);
        
        setError(null);
      } catch (err) {
        console.error('Failed to fetch analytics data:', err);
        setError('Failed to load analytics. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();

    // Mock data for development
    const mockMetrics: PerformanceMetrics = {
      totalTrades: 156,
      winningTrades: 92,
      losingTrades: 64,
      winRate: 0.59,
      profitFactor: 1.87,
      averageWin: 825.45,
      averageLoss: 412.75,
      largestWin: 4500.0,
      largestLoss: 2200.0,
      totalProfit: 75942.5,
      netProfit: 48532.5,
      sharpeRatio: 1.68,
      maxDrawdown: 15320.0,
      maxDrawdownPercent: 0.12
    };

    const mockStrategyPerf: PerformanceByStrategy[] = [
      {
        strategyId: '1',
        strategyName: 'NIFTY Momentum',
        trades: 72,
        winRate: 0.68,
        profitFactor: 2.45,
        totalProfit: 42580.0,
        netProfit: 31250.0
      },
      {
        strategyId: '2',
        strategyName: 'Mean Reversion',
        trades: 58,
        winRate: 0.52,
        profitFactor: 1.42,
        totalProfit: 21800.0,
        netProfit: 9350.0
      },
      {
        strategyId: '3',
        strategyName: 'Gap & Go',
        trades: 26,
        winRate: 0.54,
        profitFactor: 1.65,
        totalProfit: 11562.5,
        netProfit: 7932.5
      }
    ];

    const mockInstrumentPerf: PerformanceByInstrument[] = [
      {
        symbol: 'RELIANCE',
        trades: 32,
        winRate: 0.72,
        profitFactor: 2.85,
        totalProfit: 18750.0,
        netProfit: 14250.0
      },
      {
        symbol: 'TCS',
        trades: 28,
        winRate: 0.61,
        profitFactor: 1.92,
        totalProfit: 15620.0,
        netProfit: 9870.0
      },
      {
        symbol: 'HDFC',
        trades: 24,
        winRate: 0.54,
        profitFactor: 1.65,
        totalProfit: 12450.0,
        netProfit: 7800.0
      },
      {
        symbol: 'INFY',
        trades: 22,
        winRate: 0.59,
        profitFactor: 1.75,
        totalProfit: 11200.0,
        netProfit: 6650.0
      },
      {
        symbol: 'BHARTIARTL',
        trades: 18,
        winRate: 0.56,
        profitFactor: 1.68,
        totalProfit: 9350.0,
        netProfit: 5420.0
      }
    ];

    // Generate some mock profit history data
    const mockProfitHistory: ProfitHistory[] = [];
    let cumulativeProfit = 0;
    const now = new Date();
    
    const daysToGenerate = timeframe === 'day' ? 24 : // hours in a day
                         timeframe === 'week' ? 7 : // days in a week
                         timeframe === 'month' ? 30 : // days in a month
                         365; // days in a year
                         
    for (let i = 0; i < daysToGenerate; i++) {
      const date = new Date(now);
      
      if (timeframe === 'day') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      
      const profit = Math.random() * 2000 - 500; // Random profit between -500 and 1500
      cumulativeProfit += profit;
      
      mockProfitHistory.unshift({
        date: date.toISOString(),
        profit,
        cumulativeProfit
      });
    }

    // Use mock data
    setMetrics(mockMetrics);
    setStrategyPerformance(mockStrategyPerf);
    setInstrumentPerformance(mockInstrumentPerf);
    setProfitHistory(mockProfitHistory);
  }, [timeframe]);

  if (isLoading || !metrics) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mx-auto"></div>
          <p className="mt-4">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Performance Analytics</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={timeframe === 'day' ? 'default' : 'outline'}
            onClick={() => setTimeframe('day')}
          >
            Day
          </Button>
          <Button
            variant={timeframe === 'week' ? 'default' : 'outline'}
            onClick={() => setTimeframe('week')}
          >
            Week
          </Button>
          <Button
            variant={timeframe === 'month' ? 'default' : 'outline'}
            onClick={() => setTimeframe('month')}
          >
            Month
          </Button>
          <Button
            variant={timeframe === 'year' ? 'default' : 'outline'}
            onClick={() => setTimeframe('year')}
          >
            Year
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.netProfit >= 0 ? '+' : ''}₹{metrics.netProfit.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Total: ₹{metrics.totalProfit.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(metrics.winRate * 100).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground mt-1">
              {metrics.winningTrades} wins / {metrics.losingTrades} losses
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Profit Factor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.profitFactor.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Gross profit / gross loss
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Profit History</CardTitle>
            <CardDescription>Cumulative profit over time</CardDescription>
          </CardHeader>
          <CardContent className="h-80 relative">
            {/* In a real implementation, you would use a chart library here */}
            <div className="bg-muted h-full rounded-md flex items-center justify-center">
              <p className="text-muted-foreground">Profit chart would be displayed here</p>
            </div>
            <div className="absolute bottom-0 left-0 w-full px-4 py-2 bg-background/80">
              <div className="flex justify-between text-sm">
                <div>
                  <span className="font-medium">Start:</span> {new Date(profitHistory[0]?.date).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">End:</span> {new Date(profitHistory[profitHistory.length - 1]?.date).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily P&L</CardTitle>
            <CardDescription>Profit and loss by day</CardDescription>
          </CardHeader>
          <CardContent className="h-80 relative">
            {/* In a real implementation, you would use a chart library here */}
            <div className="bg-muted h-full rounded-md flex items-center justify-center">
              <p className="text-muted-foreground">Daily P&L chart would be displayed here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Detailed trading performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Trades:</span>
                  <span className="font-medium">{metrics.totalTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Winning Trades:</span>
                  <span className="font-medium text-green-600">{metrics.winningTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Losing Trades:</span>
                  <span className="font-medium text-red-600">{metrics.losingTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Win Rate:</span>
                  <span className="font-medium">{(metrics.winRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit Factor:</span>
                  <span className="font-medium">{metrics.profitFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Win:</span>
                  <span className="font-medium text-green-600">₹{metrics.averageWin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Loss:</span>
                  <span className="font-medium text-red-600">₹{metrics.averageLoss.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Largest Win:</span>
                  <span className="font-medium text-green-600">₹{metrics.largestWin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Largest Loss:</span>
                  <span className="font-medium text-red-600">₹{metrics.largestLoss.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sharpe Ratio:</span>
                  <span className="font-medium">{metrics.sharpeRatio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Drawdown:</span>
                  <span className="font-medium">₹{metrics.maxDrawdown.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Drawdown %:</span>
                  <span className="font-medium">{(metrics.maxDrawdownPercent * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance by Strategy</CardTitle>
            <CardDescription>Profit and statistics by trading strategy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Strategy</th>
                    <th className="text-right py-2">Trades</th>
                    <th className="text-right py-2">Win Rate</th>
                    <th className="text-right py-2">P-Factor</th>
                    <th className="text-right py-2">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyPerformance.map((strategy) => (
                    <tr key={strategy.strategyId} className="border-b">
                      <td className="py-2 font-medium">{strategy.strategyName}</td>
                      <td className="text-right py-2">{strategy.trades}</td>
                      <td className="text-right py-2">{(strategy.winRate * 100).toFixed(1)}%</td>
                      <td className="text-right py-2">{strategy.profitFactor.toFixed(2)}</td>
                      <td className={`text-right py-2 ${strategy.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.netProfit >= 0 ? '+' : ''}₹{strategy.netProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance by Instrument</CardTitle>
          <CardDescription>Profit and statistics by trading instrument</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-right py-2">Trades</th>
                  <th className="text-right py-2">Win Rate</th>
                  <th className="text-right py-2">P-Factor</th>
                  <th className="text-right py-2">Total Profit</th>
                  <th className="text-right py-2">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {instrumentPerformance.map((instrument) => (
                  <tr key={instrument.symbol} className="border-b">
                    <td className="py-2 font-medium">{instrument.symbol}</td>
                    <td className="text-right py-2">{instrument.trades}</td>
                    <td className="text-right py-2">{(instrument.winRate * 100).toFixed(1)}%</td>
                    <td className="text-right py-2">{instrument.profitFactor.toFixed(2)}</td>
                    <td className="text-right py-2">₹{instrument.totalProfit.toFixed(2)}</td>
                    <td className={`text-right py-2 ${instrument.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {instrument.netProfit >= 0 ? '+' : ''}₹{instrument.netProfit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
