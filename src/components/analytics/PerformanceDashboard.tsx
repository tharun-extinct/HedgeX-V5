import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  Award,
  BarChart3,
  PieChart,
  Calendar,
  DollarSign,
  Activity,
  Clock,
  Percent,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Cell,
  BarChart as RechartsBarChart,
  Bar
} from 'recharts';

interface PerformanceMetrics {
  total_trades: number;
  profitable_trades: number;
  losing_trades: number;
  win_rate: number;
  profit_factor: number;
  average_win: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  total_profit: number;
  net_profit: number;
  sharpe_ratio: number;
  max_drawdown: number;
  max_drawdown_percent: number;
  average_trade_duration: number; // in minutes
}

interface StrategyPerformance {
  strategy_id: string;
  strategy_name: string;
  trades: number;
  win_rate: number;
  profit_factor: number;
  total_profit: number;
  net_profit: number;
}

interface InstrumentPerformance {
  symbol: string;
  trades: number;
  win_rate: number;
  profit_factor: number;
  total_profit: number;
  net_profit: number;
}

interface EquityPoint {
  timestamp: string;
  equity: number;
  pnl: number;
}

interface PerformanceDashboardProps {
  timeframe?: 'day' | 'week' | 'month' | 'year';
  onTimeframeChange?: (timeframe: 'day' | 'week' | 'month' | 'year') => void;
  onExport?: (data: any) => void;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ 
  timeframe = 'month',
  onTimeframeChange,
  onExport
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [strategyPerformance, setStrategyPerformance] = useState<StrategyPerformance[]>([]);
  const [instrumentPerformance, setInstrumentPerformance] = useState<InstrumentPerformance[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPerformanceData();
  }, [timeframe]);

  const fetchPerformanceData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch overall performance metrics
      const metricsResponse = await invoke<{ success: boolean; data: PerformanceMetrics; error?: string }>('get_analytics_performance_metrics', {
        timeframe
      });
      
      if (metricsResponse.success && metricsResponse.data) {
        setMetrics(metricsResponse.data);
      } else {
        throw new Error(metricsResponse.error || 'Failed to fetch performance metrics');
      }

      // Fetch strategy performance
      const strategyResponse = await invoke<{ success: boolean; data: StrategyPerformance[]; error?: string }>('get_analytics_strategy_performance', {
        timeframe
      });
      
      if (strategyResponse.success && strategyResponse.data) {
        setStrategyPerformance(strategyResponse.data);
      }

      // Fetch instrument performance
      const instrumentResponse = await invoke<{ success: boolean; data: InstrumentPerformance[]; error?: string }>('get_instrument_performance', {
        timeframe
      });
      
      if (instrumentResponse.success && instrumentResponse.data) {
        setInstrumentPerformance(instrumentResponse.data);
      }

      // Fetch equity curve data
      const equityResponse = await invoke<{ success: boolean; data: EquityPoint[]; error?: string }>('get_equity_curve', {
        timeframe
      });
      
      if (equityResponse.success && equityResponse.data) {
        setEquityCurve(equityResponse.data);
      } else {
        // Generate mock equity curve data for demonstration
        const mockEquityCurve: EquityPoint[] = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        let equity = 100000;
        
        for (let i = 0; i < 30; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dailyPnl = (Math.random() - 0.5) * 2000;
          equity += dailyPnl;
          
          mockEquityCurve.push({
            timestamp: date.toISOString().split('T')[0],
            equity: equity,
            pnl: dailyPnl
          });
        }
        setEquityCurve(mockEquityCurve);
      }
    } catch (err) {
      console.error('Failed to fetch performance data:', err);
      setError('Failed to load performance data. Please try again.');
      
      // Set mock data for demonstration
      const mockMetrics: PerformanceMetrics = {
        total_trades: 156,
        profitable_trades: 92,
        losing_trades: 64,
        win_rate: 0.59,
        profit_factor: 1.87,
        average_win: 825.45,
        average_loss: 412.75,
        largest_win: 4500.0,
        largest_loss: 2200.0,
        total_profit: 75942.5,
        net_profit: 48532.5,
        sharpe_ratio: 1.68,
        max_drawdown: 15320.0,
        max_drawdown_percent: 0.12,
        average_trade_duration: 45
      };
      setMetrics(mockMetrics);
      
      const mockStrategyPerf: StrategyPerformance[] = [
        {
          strategy_id: '1',
          strategy_name: 'NIFTY Momentum',
          trades: 72,
          win_rate: 0.68,
          profit_factor: 2.45,
          total_profit: 42580.0,
          net_profit: 31250.0
        },
        {
          strategy_id: '2',
          strategy_name: 'Mean Reversion',
          trades: 58,
          win_rate: 0.52,
          profit_factor: 1.42,
          total_profit: 21800.0,
          net_profit: 9350.0
        }
      ];
      setStrategyPerformance(mockStrategyPerf);
      
      const mockInstrumentPerf: InstrumentPerformance[] = [
        {
          symbol: 'RELIANCE',
          trades: 32,
          win_rate: 0.72,
          profit_factor: 2.85,
          total_profit: 18750.0,
          net_profit: 14250.0
        },
        {
          symbol: 'TCS',
          trades: 28,
          win_rate: 0.61,
          profit_factor: 1.92,
          total_profit: 15620.0,
          net_profit: 9870.0
        }
      ];
      setInstrumentPerformance(mockInstrumentPerf);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = {
      metrics,
      strategyPerformance,
      instrumentPerformance,
      equityCurve,
      timeframe,
      exportedAt: new Date().toISOString()
    };
    
    if (onExport) {
      onExport(exportData);
    } else {
      // Default export functionality
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `performance_report_${timeframe}_${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <span className="ml-3 text-slate-600">Loading performance data...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center p-8 text-slate-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p>No performance data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Performance Dashboard</h2>
          <p className="text-slate-600">Comprehensive trading performance analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          {(['day', 'week', 'month', 'year'] as const).map((period) => (
            <Button
              key={period}
              variant={timeframe === period ? 'default' : 'outline'}
              onClick={() => onTimeframeChange?.(period)}
              size="sm"
              className={`capitalize ${timeframe === period ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : ''}`}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {period}
            </Button>
          ))}
          <Button variant="outline" onClick={fetchPerformanceData} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center space-x-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span>{error}</span>
        </div>
      )}

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className={`bg-gradient-to-br ${metrics.net_profit >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'} shadow-lg hover:shadow-xl transition-all duration-300`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-sm font-medium ${metrics.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Net Profit</CardTitle>
              {metrics.net_profit >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${metrics.net_profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              {metrics.net_profit >= 0 ? '+' : ''}₹{metrics.net_profit.toFixed(2)}
            </div>
            <div className={`text-sm mt-1 ${metrics.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Total: ₹{metrics.total_profit.toFixed(2)}
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
            <div className="text-3xl font-bold text-blue-900">{(metrics.win_rate * 100).toFixed(1)}%</div>
            <div className="text-sm text-blue-600 mt-1">
              {metrics.profitable_trades} wins / {metrics.losing_trades} losses
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
            <div className="text-3xl font-bold text-purple-900">{metrics.profit_factor.toFixed(2)}</div>
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
            <div className="text-3xl font-bold text-orange-900">{metrics.sharpe_ratio.toFixed(2)}</div>
            <div className="text-sm text-orange-600 mt-1">
              Risk-adjusted returns
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Equity Curve Chart */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">Equity Curve</CardTitle>
                <CardDescription className="text-slate-600">Portfolio value over time</CardDescription>
              </div>
              <BarChart3 className="w-6 h-6 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `₹${value.toLocaleString()}`, 
                      name === 'equity' ? 'Portfolio Value' : 'Daily P&L'
                    ]}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="equity" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Strategy Performance Chart */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">Strategy Performance</CardTitle>
                <CardDescription className="text-slate-600">Net profit by strategy</CardDescription>
              </div>
              <PieChart className="w-6 h-6 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={strategyPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="strategy_name" />
                  <YAxis tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                  <Tooltip 
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Net Profit']}
                  />
                  <Bar dataKey="net_profit" fill="#8884d8" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Strategy Performance Table */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="text-xl font-bold text-slate-900">Strategy Breakdown</CardTitle>
            <CardDescription className="text-slate-600">Performance by trading strategy</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              {strategyPerformance.map((strategy, index) => (
                <div key={strategy.strategy_id} className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-gradient-to-r from-green-50 to-transparent' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900">{strategy.strategy_name}</h3>
                    <div className={`text-lg font-bold ${strategy.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {strategy.net_profit >= 0 ? '+' : ''}₹{strategy.net_profit.toFixed(2)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Trades:</span>
                      <span className="font-medium ml-1">{strategy.trades}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Win Rate:</span>
                      <span className="font-medium ml-1">{(strategy.win_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500">P-Factor:</span>
                      <span className="font-medium ml-1">{strategy.profit_factor.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Instrument Performance Table */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="text-xl font-bold text-slate-900">Top Instruments</CardTitle>
            <CardDescription className="text-slate-600">Performance by stock symbol</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              {instrumentPerformance.slice(0, 5).map((instrument, index) => (
                <div key={instrument.symbol} className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900">{instrument.symbol}</h3>
                    <div className={`text-lg font-bold ${instrument.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {instrument.net_profit >= 0 ? '+' : ''}₹{instrument.net_profit.toFixed(2)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Trades:</span>
                      <span className="font-medium ml-1">{instrument.trades}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Win Rate:</span>
                      <span className="font-medium ml-1">{(instrument.win_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500">P-Factor:</span>
                      <span className="font-medium ml-1">{instrument.profit_factor.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};