import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { GitCompare, ArrowLeft, Download, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';
import { formatCurrency, formatPercentage, formatDateTime } from '../../lib/utils';

interface BacktestRun {
  id: string;
  strategy_name: string;
  symbol: string;
  exchange: string;
  start_date: string;
  end_date: string;
  timeframe: string;
  initial_capital: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  final_pnl: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  profit_factor: number;
  created_at: string;
}

interface ComparisonData {
  backtests: BacktestRun[];
  metrics_comparison: Record<string, number[]>;
  equity_curves: Record<string, Array<{ timestamp: string; equity: number }>>;
}

interface BacktestComparisonProps {
  backtestIds: string[];
  onBackToHistory: () => void;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'];

const BacktestComparison: React.FC<BacktestComparisonProps> = ({
  backtestIds,
  onBackToHistory
}) => {
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComparisonData = async () => {
      try {
        setIsLoading(true);
        const result = await invoke('compare_backtests', { backtestIds });
        
        if (result && typeof result === 'object' && 'success' in result) {
          const response = result as { success: boolean; data?: ComparisonData };
          if (response.success && response.data) {
            setComparisonData(response.data);
          }
        }
        setError(null);
      } catch (err) {
        console.error('Failed to load comparison data:', err);
        setError('Failed to load comparison data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadComparisonData();
  }, [backtestIds]);

  const handleExportComparison = () => {
    if (!comparisonData) return;
    
    const exportData = {
      comparison: comparisonData,
      exported_at: new Date().toISOString(),
      backtest_ids: backtestIds
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `backtest_comparison_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading comparison data...</p>
        </div>
      </div>
    );
  }

  if (error || !comparisonData) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
        <p>{error || 'Failed to load comparison data'}</p>
      </div>
    );
  }

  // Prepare data for charts
  const metricsData = [
    {
      metric: 'Final P&L',
      ...comparisonData.backtests.reduce((acc, backtest, index) => ({
        ...acc,
        [backtest.strategy_name]: backtest.final_pnl
      }), {})
    },
    {
      metric: 'Win Rate',
      ...comparisonData.backtests.reduce((acc, backtest, index) => ({
        ...acc,
        [backtest.strategy_name]: backtest.win_rate
      }), {})
    },
    {
      metric: 'Sharpe Ratio',
      ...comparisonData.backtests.reduce((acc, backtest, index) => ({
        ...acc,
        [backtest.strategy_name]: backtest.sharpe_ratio
      }), {})
    },
    {
      metric: 'Profit Factor',
      ...comparisonData.backtests.reduce((acc, backtest, index) => ({
        ...acc,
        [backtest.strategy_name]: backtest.profit_factor
      }), {})
    }
  ];

  // Prepare radar chart data
  const radarData = comparisonData.backtests.map(backtest => ({
    strategy: backtest.strategy_name,
    'Win Rate': backtest.win_rate,
    'Sharpe Ratio': Math.max(0, Math.min(100, backtest.sharpe_ratio * 20)), // Normalize to 0-100
    'Profit Factor': Math.max(0, Math.min(100, backtest.profit_factor * 20)), // Normalize to 0-100
    'Return %': Math.max(0, Math.min(100, (backtest.final_pnl / backtest.initial_capital) * 100 + 50)), // Normalize to 0-100
  }));

  // Prepare equity curve comparison data
  const equityComparisonData = comparisonData.equity_curves[backtestIds[0]]?.map((point, index) => {
    const dataPoint: any = {
      timestamp: new Date(point.timestamp).toLocaleDateString()
    };
    
    backtestIds.forEach((id, backtestIndex) => {
      const backtest = comparisonData.backtests[backtestIndex];
      const equityCurve = comparisonData.equity_curves[id];
      if (equityCurve && equityCurve[index]) {
        dataPoint[backtest.strategy_name] = equityCurve[index].equity;
      }
    });
    
    return dataPoint;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Backtest Comparison</h2>
          <p className="text-slate-600">
            Comparing {comparisonData.backtests.length} backtests
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleExportComparison}>
            <Download className="w-4 h-4 mr-2" />
            Export Comparison
          </Button>
          <Button variant="outline" onClick={onBackToHistory}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to History
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Best Performer</p>
                <p className="text-lg font-bold text-blue-700">
                  {comparisonData.backtests.reduce((best, current) => 
                    current.final_pnl > best.final_pnl ? current : best
                  ).strategy_name}
                </p>
                <p className="text-xs text-blue-600">
                  {formatCurrency(Math.max(...comparisonData.backtests.map(b => b.final_pnl)))}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Highest Win Rate</p>
                <p className="text-lg font-bold text-green-700">
                  {comparisonData.backtests.reduce((best, current) => 
                    current.win_rate > best.win_rate ? current : best
                  ).strategy_name}
                </p>
                <p className="text-xs text-green-600">
                  {formatPercentage(Math.max(...comparisonData.backtests.map(b => b.win_rate)))}
                </p>
              </div>
              <Target className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Best Sharpe Ratio</p>
                <p className="text-lg font-bold text-purple-700">
                  {comparisonData.backtests.reduce((best, current) => 
                    current.sharpe_ratio > best.sharpe_ratio ? current : best
                  ).strategy_name}
                </p>
                <p className="text-xs text-purple-600">
                  {Math.max(...comparisonData.backtests.map(b => b.sharpe_ratio)).toFixed(2)}
                </p>
              </div>
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Lowest Drawdown</p>
                <p className="text-lg font-bold text-orange-700">
                  {comparisonData.backtests.reduce((best, current) => 
                    Math.abs(current.max_drawdown) < Math.abs(best.max_drawdown) ? current : best
                  ).strategy_name}
                </p>
                <p className="text-xs text-orange-600">
                  {formatCurrency(Math.min(...comparisonData.backtests.map(b => Math.abs(b.max_drawdown))))}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Comparison */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="equity">Equity Curves</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="radar">Performance Radar</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Comparison Table</CardTitle>
              <CardDescription>Side-by-side comparison of all key metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Strategy</th>
                      <th className="text-left p-3">Symbol</th>
                      <th className="text-left p-3">Period</th>
                      <th className="text-left p-3">Total P&L</th>
                      <th className="text-left p-3">Return %</th>
                      <th className="text-left p-3">Win Rate</th>
                      <th className="text-left p-3">Total Trades</th>
                      <th className="text-left p-3">Sharpe Ratio</th>
                      <th className="text-left p-3">Max Drawdown</th>
                      <th className="text-left p-3">Profit Factor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.backtests.map((backtest, index) => (
                      <tr key={backtest.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-medium">{backtest.strategy_name}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {backtest.symbol}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          {new Date(backtest.start_date).toLocaleDateString()} - {new Date(backtest.end_date).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span className={backtest.final_pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(backtest.final_pnl)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={backtest.final_pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercentage((backtest.final_pnl / backtest.initial_capital) * 100)}
                          </span>
                        </td>
                        <td className="p-3">{formatPercentage(backtest.win_rate)}</td>
                        <td className="p-3">{backtest.total_trades}</td>
                        <td className="p-3">{backtest.sharpe_ratio.toFixed(2)}</td>
                        <td className="p-3 text-red-600">{formatCurrency(backtest.max_drawdown)}</td>
                        <td className="p-3">{backtest.profit_factor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equity Curves Comparison</CardTitle>
              <CardDescription>Portfolio value over time for all strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                    {comparisonData.backtests.map((backtest, index) => (
                      <Line
                        key={backtest.id}
                        type="monotone"
                        dataKey={backtest.strategy_name}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>P&L Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[metricsData[0]]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), 'P&L']} />
                      {comparisonData.backtests.map((backtest, index) => (
                        <Bar
                          key={backtest.id}
                          dataKey={backtest.strategy_name}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Win Rate Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[metricsData[1]]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [formatPercentage(value), 'Win Rate']} />
                      {comparisonData.backtests.map((backtest, index) => (
                        <Bar
                          key={backtest.id}
                          dataKey={backtest.strategy_name}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="radar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Radar Chart</CardTitle>
              <CardDescription>Multi-dimensional performance comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="strategy" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="Win Rate"
                      dataKey="Win Rate"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.1}
                    />
                    <Radar
                      name="Sharpe Ratio"
                      dataKey="Sharpe Ratio"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      fillOpacity={0.1}
                    />
                    <Radar
                      name="Profit Factor"
                      dataKey="Profit Factor"
                      stroke="#ffc658"
                      fill="#ffc658"
                      fillOpacity={0.1}
                    />
                    <Radar
                      name="Return %"
                      dataKey="Return %"
                      stroke="#ff7300"
                      fill="#ff7300"
                      fillOpacity={0.1}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                <p><strong>Note:</strong> Values are normalized to 0-100 scale for comparison purposes.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BacktestComparison;