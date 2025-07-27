import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, BarChart3, Calendar, Target, DollarSign, Percent, Clock } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface PerformanceMetrics {
  id: string;
  user_id: string;
  strategy_id: string;
  date: string;
  total_trades: number;
  profitable_trades: number;
  total_pnl: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  sharpe_ratio: number;
  average_trade_duration: number;
  created_at: string;
  updated_at: string;
}

interface StrategyPerformanceProps {
  strategyId: string;
  strategyName: string;
}

const StrategyPerformance: React.FC<StrategyPerformanceProps> = ({ 
  strategyId, 
  strategyName 
}) => {
  const [performance, setPerformance] = useState<PerformanceMetrics[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadPerformanceData();
    loadStrategyStats();
  }, [strategyId, selectedPeriod]);

  const loadPerformanceData = async () => {
    try {
      setIsLoading(true);
      const result = await invoke('get_strategy_performance', {
        strategyId,
        days: selectedPeriod
      });

      if (result && typeof result === 'object' && 'success' in result) {
        const response = result as { success: boolean; data?: PerformanceMetrics[] };
        if (response.success && response.data) {
          setPerformance(response.data);
        }
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStrategyStats = async () => {
    try {
      const result = await invoke('get_strategy_stats', { strategyId });

      if (result && typeof result === 'object' && 'success' in result) {
        const response = result as { success: boolean; data?: any };
        if (response.success && response.data) {
          setStats(response.data);
        }
      }
    } catch (error) {
      console.error('Error loading strategy stats:', error);
    }
  };

  // Calculate aggregate metrics
  const aggregateMetrics = React.useMemo(() => {
    if (performance.length === 0) {
      return {
        totalTrades: 0,
        totalPnL: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        avgTradeDuration: 0,
        profitableTrades: 0
      };
    }

    const totalTrades = performance.reduce((sum, p) => sum + p.total_trades, 0);
    const totalPnL = performance.reduce((sum, p) => sum + p.total_pnl, 0);
    const profitableTrades = performance.reduce((sum, p) => sum + p.profitable_trades, 0);
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
    const maxDrawdown = Math.min(...performance.map(p => p.max_drawdown));
    
    // Calculate weighted averages
    const totalDays = performance.length;
    const avgProfitFactor = performance.reduce((sum, p) => sum + p.profit_factor, 0) / totalDays;
    const avgSharpeRatio = performance.reduce((sum, p) => sum + p.sharpe_ratio, 0) / totalDays;
    const avgTradeDuration = performance.reduce((sum, p) => sum + p.average_trade_duration, 0) / totalDays;

    return {
      totalTrades,
      totalPnL,
      winRate,
      profitFactor: avgProfitFactor,
      maxDrawdown,
      sharpeRatio: avgSharpeRatio,
      avgTradeDuration,
      profitableTrades
    };
  }, [performance]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-slate-600">Loading performance data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span>Strategy Performance</span>
              </CardTitle>
              <CardDescription>{strategyName} - Performance Analytics</CardDescription>
            </div>
            <div className="flex space-x-2">
              {[7, 30, 90].map((days) => (
                <Button
                  key={days}
                  size="sm"
                  variant={selectedPeriod === days ? "default" : "outline"}
                  onClick={() => setSelectedPeriod(days)}
                >
                  {days}D
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`${aggregateMetrics.totalPnL >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center space-x-2">
              <DollarSign className="w-4 h-4" />
              <span>Total P&L</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${aggregateMetrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(aggregateMetrics.totalPnL)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Last {selectedPeriod} days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>Win Rate</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {aggregateMetrics.winRate.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {aggregateMetrics.profitableTrades} / {aggregateMetrics.totalTrades} trades
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Profit Factor</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {aggregateMetrics.profitFactor.toFixed(2)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Gross profit / Gross loss
            </p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center space-x-2">
              <TrendingDown className="w-4 h-4" />
              <span>Max Drawdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(aggregateMetrics.maxDrawdown)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Maximum loss from peak
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Sharpe Ratio</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900">
              {aggregateMetrics.sharpeRatio.toFixed(3)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Risk-adjusted returns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Avg Trade Duration</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900">
              {formatDuration(aggregateMetrics.avgTradeDuration)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Average holding time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Total Trades</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-slate-900">
              {aggregateMetrics.totalTrades}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Executed trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Performance Table */}
      {performance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Performance Breakdown</CardTitle>
            <CardDescription>
              Detailed daily performance metrics for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 font-semibold text-slate-700">Date</th>
                    <th className="text-right py-3 font-semibold text-slate-700">Trades</th>
                    <th className="text-right py-3 font-semibold text-slate-700">Win Rate</th>
                    <th className="text-right py-3 font-semibold text-slate-700">P&L</th>
                    <th className="text-right py-3 font-semibold text-slate-700">Drawdown</th>
                    <th className="text-right py-3 font-semibold text-slate-700">Profit Factor</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.slice(0, 10).map((day) => (
                    <tr key={day.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 text-slate-700">
                        {new Date(day.date).toLocaleDateString()}
                      </td>
                      <td className="text-right py-3 text-slate-700">
                        {day.total_trades}
                      </td>
                      <td className="text-right py-3">
                        <Badge 
                          variant="secondary" 
                          className={day.win_rate >= 50 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                          {day.win_rate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className={`text-right py-3 font-medium ${day.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(day.total_pnl)}
                      </td>
                      <td className="text-right py-3 text-orange-600">
                        {formatCurrency(day.max_drawdown)}
                      </td>
                      <td className="text-right py-3 text-slate-700">
                        {day.profit_factor.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {performance.length > 10 && (
                <div className="text-center py-4 text-slate-500">
                  <p>Showing 10 of {performance.length} days</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {performance.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Performance Data</h3>
            <p className="text-slate-600">
              No trading data available for the selected period. Performance metrics will appear once the strategy starts executing trades.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StrategyPerformance;