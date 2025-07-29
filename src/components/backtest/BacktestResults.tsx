import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Target, Zap, BarChart3, PieChart as PieChartIcon, Download, ArrowLeft, Calendar } from 'lucide-react';
import { formatCurrency, formatPercentage, formatDateTime } from '../../lib/utils';

interface BacktestRun {
  id: string;
  user_id: string;
  strategy_id: string;
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

interface BacktestTrade {
  id: string;
  symbol: string;
  trade_type: 'buy' | 'sell';
  entry_time: string;
  entry_price: number;
  quantity: number;
  exit_time?: string;
  exit_price?: number;
  pnl?: number;
  exit_reason?: string;
}

interface EquityPoint {
  timestamp: string;
  equity: number;
}

interface BacktestDetail {
  backtest: BacktestRun;
  trades: BacktestTrade[];
  equity_curve: EquityPoint[];
}

interface BacktestResultsProps {
  backtest: BacktestRun;
  onBackToSetup: () => void;
}

const BacktestResults: React.FC<BacktestResultsProps> = ({
  backtest,
  onBackToSetup
}) => {
  const [backtestDetail, setBacktestDetail] = useState<BacktestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBacktestDetail = async () => {
      try {
        setIsLoading(true);
        const result = await invoke('get_backtest_detail', { backtestId: backtest.id });
        
        if (result && typeof result === 'object' && 'success' in result) {
          const response = result as { success: boolean; data?: BacktestDetail };
          if (response.success && response.data) {
            setBacktestDetail(response.data);
          }
        }
        setError(null);
      } catch (err) {
        console.error('Failed to load backtest detail:', err);
        setError('Failed to load detailed results. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadBacktestDetail();
  }, [backtest.id]);

  const handleExportResults = () => {
    const exportData = {
      backtest,
      trades: backtestDetail?.trades || [],
      equity_curve: backtestDetail?.equity_curve || [],
      exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `backtest_${backtest.id}_${backtest.symbol}.json`);
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
          <p className="mt-4 text-slate-600">Loading detailed results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
        <p>{error}</p>
      </div>
    );
  }

  const equityData = backtestDetail?.equity_curve.map(point => ({
    timestamp: new Date(point.timestamp).toLocaleDateString(),
    equity: point.equity,
    pnl: point.equity - backtest.initial_capital
  })) || [];

  const monthlyReturns = backtestDetail?.trades.reduce((acc, trade) => {
    if (trade.pnl && trade.exit_time) {
      const month = new Date(trade.exit_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      acc[month] = (acc[month] || 0) + trade.pnl;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const monthlyData = Object.entries(monthlyReturns).map(([month, pnl]) => ({
    month,
    pnl,
    isProfit: pnl > 0
  }));

  const tradeTypeData = [
    { name: 'Winning Trades', value: backtest.winning_trades, color: '#10b981' },
    { name: 'Losing Trades', value: backtest.losing_trades, color: '#ef4444' }
  ];

  const profitLossRatio = backtest.winning_trades > 0 && backtest.losing_trades > 0 
    ? (backtest.final_pnl / backtest.winning_trades) / Math.abs((backtest.final_pnl - (backtest.final_pnl / backtest.winning_trades * backtest.winning_trades)) / backtest.losing_trades)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Backtest Results</h2>
          <p className="text-slate-600">
            {backtest.strategy_name} • {backtest.symbol} • {formatDateTime(backtest.created_at)}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleExportResults}>
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
          <Button variant="outline" onClick={onBackToSetup}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Setup
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total P&L</p>
                <p className={`text-2xl font-bold ${backtest.final_pnl >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(backtest.final_pnl)}
                </p>
                <p className="text-xs text-green-600">
                  {formatPercentage((backtest.final_pnl / backtest.initial_capital) * 100)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Win Rate</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatPercentage(backtest.win_rate)}
                </p>
                <p className="text-xs text-blue-600">
                  {backtest.winning_trades}/{backtest.total_trades} trades
                </p>
              </div>
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Sharpe Ratio</p>
                <p className="text-2xl font-bold text-purple-700">
                  {backtest.sharpe_ratio.toFixed(2)}
                </p>
                <p className="text-xs text-purple-600">Risk-adjusted return</p>
              </div>
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Max Drawdown</p>
                <p className="text-2xl font-bold text-orange-700">
                  {formatCurrency(backtest.max_drawdown)}
                </p>
                <p className="text-xs text-orange-600">
                  {formatPercentage((backtest.max_drawdown / backtest.initial_capital) * 100)}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Tabs defaultValue="equity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="equity">Equity Curve</TabsTrigger>
          <TabsTrigger value="trades">Trade Analysis</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Returns</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="equity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Equity Curve</span>
              </CardTitle>
              <CardDescription>Portfolio value over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'equity' ? formatCurrency(value) : formatCurrency(value),
                        name === 'equity' ? 'Portfolio Value' : 'P&L'
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pnl" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trades" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChartIcon className="w-5 h-5" />
                  <span>Trade Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tradeTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {tradeTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trade Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm text-slate-600">Total Trades</p>
                    <p className="text-xl font-bold text-slate-900">{backtest.total_trades}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm text-slate-600">Profit Factor</p>
                    <p className="text-xl font-bold text-slate-900">{backtest.profit_factor.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Winning Trades:</span>
                    <span className="text-sm font-medium text-green-600">{backtest.winning_trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Losing Trades:</span>
                    <span className="text-sm font-medium text-red-600">{backtest.losing_trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Profit/Loss Ratio:</span>
                    <span className="text-sm font-medium text-slate-900">{profitLossRatio.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trade List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
              <CardDescription>Last 10 trades from the backtest</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Entry Time</th>
                      <th className="text-left p-2">Entry Price</th>
                      <th className="text-left p-2">Exit Time</th>
                      <th className="text-left p-2">Exit Price</th>
                      <th className="text-left p-2">Quantity</th>
                      <th className="text-left p-2">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtestDetail?.trades.slice(0, 10).map((trade) => (
                      <tr key={trade.id} className="border-b hover:bg-slate-50">
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            trade.trade_type === 'buy' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {trade.trade_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2">{formatDateTime(trade.entry_time)}</td>
                        <td className="p-2">{formatCurrency(trade.entry_price)}</td>
                        <td className="p-2">{trade.exit_time ? formatDateTime(trade.exit_time) : '-'}</td>
                        <td className="p-2">{trade.exit_price ? formatCurrency(trade.exit_price) : '-'}</td>
                        <td className="p-2">{trade.quantity}</td>
                        <td className="p-2">
                          {trade.pnl ? (
                            <span className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(trade.pnl)}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Monthly Returns</span>
              </CardTitle>
              <CardDescription>Profit and loss breakdown by month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'P&L']} />
                    <Bar 
                      dataKey="pnl" 
                      fill="#10b981"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Backtest Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Strategy:</span>
                  <span className="font-medium">{backtest.strategy_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Symbol:</span>
                  <span className="font-medium">{backtest.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Exchange:</span>
                  <span className="font-medium">{backtest.exchange}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Timeframe:</span>
                  <span className="font-medium">{backtest.timeframe}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Period:</span>
                  <span className="font-medium">
                    {new Date(backtest.start_date).toLocaleDateString()} - {new Date(backtest.end_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Initial Capital:</span>
                  <span className="font-medium">{formatCurrency(backtest.initial_capital)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Final P&L:</span>
                  <span className={`font-medium ${backtest.final_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(backtest.final_pnl)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Return %:</span>
                  <span className={`font-medium ${backtest.final_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage((backtest.final_pnl / backtest.initial_capital) * 100)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Win Rate:</span>
                  <span className="font-medium">{formatPercentage(backtest.win_rate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Profit Factor:</span>
                  <span className="font-medium">{backtest.profit_factor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Sharpe Ratio:</span>
                  <span className="font-medium">{backtest.sharpe_ratio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Max Drawdown:</span>
                  <span className="font-medium text-red-600">{formatCurrency(backtest.max_drawdown)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BacktestResults;