import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { TrendingUp, TrendingDown, Target, Zap, BarChart3, PieChart, Calendar, Award } from 'lucide-react';

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

const AnalyticsPage: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [strategyPerformance, setStrategyPerformance] = useState<PerformanceByStrategy[]>([]);
  const [instrumentPerformance, setInstrumentPerformance] = useState<PerformanceByInstrument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        
        // Mock data for beautiful display
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

        setMetrics(mockMetrics);
        setStrategyPerformance(mockStrategyPerf);
        setInstrumentPerformance(mockInstrumentPerf);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch analytics data:', err);
        setError('Failed to load analytics. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeframe]);

  if (isLoading || !metrics) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading analytics data...</p>
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
              Performance Analytics
            </h1>
            <p className="text-slate-600 mt-2">Comprehensive trading performance insights</p>
          </div>
          <div className="flex items-center space-x-2">
            {(['day', 'week', 'month', 'year'] as const).map((period) => (
              <Button
                key={period}
                variant={timeframe === period ? 'default' : 'outline'}
                onClick={() => setTimeframe(period)}
                className={`capitalize ${timeframe === period ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : ''}`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {period}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{error}</span>
          </div>
        )}

        {/* Key Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className={`bg-gradient-to-br ${metrics.netProfit >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'} shadow-lg hover:shadow-xl transition-all duration-300`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-medium ${metrics.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Net Profit</CardTitle>
                {metrics.netProfit >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${metrics.netProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {metrics.netProfit >= 0 ? '+' : ''}₹{metrics.netProfit.toFixed(2)}
              </div>
              <div className={`text-sm mt-1 ${metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Total: ₹{metrics.totalProfit.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-blue-700">Win Rate</CardTitle>
                <Target className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{(metrics.winRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-blue-600 mt-1">
                {metrics.winningTrades} wins / {metrics.losingTrades} losses
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-purple-700">Profit Factor</CardTitle>
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">{metrics.profitFactor.toFixed(2)}</div>
              <div className="text-sm text-purple-600 mt-1">
                Gross profit / gross loss
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-orange-700">Sharpe Ratio</CardTitle>
                <Award className="w-5 h-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900">{metrics.sharpeRatio.toFixed(2)}</div>
              <div className="text-sm text-orange-600 mt-1">
                Risk-adjusted returns
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">Profit History</CardTitle>
                  <CardDescription className="text-slate-600">Cumulative profit over time</CardDescription>
                </div>
                <BarChart3 className="w-6 h-6 text-slate-600" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Interactive profit chart</p>
                  <p className="text-slate-400 text-sm">Chart visualization would be displayed here</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">Trade Distribution</CardTitle>
                  <CardDescription className="text-slate-600">Win/Loss breakdown</CardDescription>
                </div>
                <PieChart className="w-6 h-6 text-slate-600" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
                <div className="text-center">
                  <PieChart className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Trade distribution chart</p>
                  <p className="text-slate-400 text-sm">Pie chart visualization would be displayed here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="text-xl font-bold text-slate-900">Performance Metrics</CardTitle>
              <CardDescription className="text-slate-600">Detailed trading performance statistics</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Total Trades', value: metrics.totalTrades, color: 'text-slate-700' },
                  { label: 'Winning Trades', value: metrics.winningTrades, color: 'text-green-600' },
                  { label: 'Losing Trades', value: metrics.losingTrades, color: 'text-red-600' },
                  { label: 'Win Rate', value: `${(metrics.winRate * 100).toFixed(1)}%`, color: 'text-blue-600' },
                  { label: 'Average Win', value: `₹${metrics.averageWin.toFixed(2)}`, color: 'text-green-600' },
                  { label: 'Average Loss', value: `₹${metrics.averageLoss.toFixed(2)}`, color: 'text-red-600' },
                  { label: 'Largest Win', value: `₹${metrics.largestWin.toFixed(2)}`, color: 'text-green-600' },
                  { label: 'Largest Loss', value: `₹${metrics.largestLoss.toFixed(2)}`, color: 'text-red-600' },
                  { label: 'Max Drawdown', value: `₹${metrics.maxDrawdown.toFixed(2)}`, color: 'text-orange-600' },
                  { label: 'Max Drawdown %', value: `${(metrics.maxDrawdownPercent * 100).toFixed(2)}%`, color: 'text-orange-600' }
                ].map((metric, index) => (
                  <div key={index} className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
                    <div className="text-sm text-slate-600 mb-1">{metric.label}</div>
                    <div className={`font-bold text-lg ${metric.color}`}>{metric.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="text-xl font-bold text-slate-900">Strategy Performance</CardTitle>
              <CardDescription className="text-slate-600">Performance breakdown by trading strategy</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                {strategyPerformance.map((strategy, index) => (
                  <div key={strategy.strategyId} className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-gradient-to-r from-green-50 to-transparent' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-900">{strategy.strategyName}</h3>
                      <div className={`text-lg font-bold ${strategy.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.netProfit >= 0 ? '+' : ''}₹{strategy.netProfit.toFixed(2)}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Trades:</span>
                        <span className="font-medium ml-1">{strategy.trades}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Win Rate:</span>
                        <span className="font-medium ml-1">{(strategy.winRate * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500">P-Factor:</span>
                        <span className="font-medium ml-1">{strategy.profitFactor.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instrument Performance */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="text-xl font-bold text-slate-900">Performance by Instrument</CardTitle>
            <CardDescription className="text-slate-600">Trading performance breakdown by stock symbol</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Symbol</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Trades</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Win Rate</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">P-Factor</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Total Profit</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {instrumentPerformance.map((instrument, index) => (
                    <tr key={instrument.symbol} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''}`}>
                      <td className="py-3 px-4 font-bold text-slate-900">{instrument.symbol}</td>
                      <td className="text-right py-3 px-4 text-slate-700">{instrument.trades}</td>
                      <td className="text-right py-3 px-4 text-slate-700">{(instrument.winRate * 100).toFixed(1)}%</td>
                      <td className="text-right py-3 px-4 text-slate-700">{instrument.profitFactor.toFixed(2)}</td>
                      <td className="text-right py-3 px-4 text-slate-700">₹{instrument.totalProfit.toFixed(2)}</td>
                      <td className={`text-right py-3 px-4 font-bold ${instrument.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
    </div>
  );
};

export default AnalyticsPage;