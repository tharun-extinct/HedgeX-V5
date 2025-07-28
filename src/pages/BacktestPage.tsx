import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Play, Pause, Square, BarChart3, Upload, Calendar, TrendingUp, History, GitCompare } from 'lucide-react';
import BacktestForm from '../components/backtest/BacktestForm';
import BacktestProgress from '../components/backtest/BacktestProgress';
import BacktestResults from '../components/backtest/BacktestResults';
import BacktestComparison from '../components/backtest/BacktestComparison';
import BacktestHistory from '../components/backtest/BacktestHistory';

interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  max_trades_per_day: number;
  risk_percentage: number;
  stop_loss_percentage: number;
  take_profit_percentage: number;
  volume_threshold: number;
}

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

interface BacktestParams {
  strategy_id: string;
  symbol: string;
  exchange: string;
  start_date: string;
  end_date: string;
  timeframe: string;
  initial_capital: number;
  data_source: 'api' | 'csv';
  csv_file_path?: string;
}

type ViewMode = 'setup' | 'running' | 'results' | 'history' | 'comparison';

const BacktestPage: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [backtestRuns, setBacktestRuns] = useState<BacktestRun[]>([]);
  const [currentBacktest, setCurrentBacktest] = useState<BacktestRun | null>(null);
  const [selectedBacktests, setSelectedBacktests] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [backtestProgress, setBacktestProgress] = useState<{
    isRunning: boolean;
    progress: number;
    currentStep: string;
    canCancel: boolean;
  }>({
    isRunning: false,
    progress: 0,
    currentStep: '',
    canCancel: false
  });

  // Load strategies and backtest history
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load strategies
      const strategiesResult = await invoke('get_strategies');
      if (strategiesResult && typeof strategiesResult === 'object' && 'success' in strategiesResult) {
        const response = strategiesResult as { success: boolean; data?: Strategy[] };
        if (response.success && response.data) {
          setStrategies(response.data);
        }
      }

      // Load backtest history
      const backtestsResult = await invoke('get_backtest_history');
      if (backtestsResult && typeof backtestsResult === 'object' && 'success' in backtestsResult) {
        const response = backtestsResult as { success: boolean; data?: BacktestRun[] };
        if (response.success && response.data) {
          setBacktestRuns(response.data);
        }
      }

      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartBacktest = async (params: BacktestParams) => {
    try {
      setBacktestProgress({
        isRunning: true,
        progress: 0,
        currentStep: 'Initializing backtest...',
        canCancel: true
      });
      setViewMode('running');

      const result = await invoke('start_backtest', { params });
      
      if (result && typeof result === 'object' && 'success' in result) {
        const response = result as { success: boolean; data?: BacktestRun };
        if (response.success && response.data) {
          setCurrentBacktest(response.data);
          setBacktestRuns(prev => [response.data!, ...prev]);
          setViewMode('results');
        }
      }
    } catch (err) {
      console.error('Failed to start backtest:', err);
      setError('Failed to start backtest. Please try again.');
      setViewMode('setup');
    } finally {
      setBacktestProgress({
        isRunning: false,
        progress: 100,
        currentStep: 'Completed',
        canCancel: false
      });
    }
  };

  const handleCancelBacktest = async () => {
    try {
      await invoke('cancel_backtest');
      setBacktestProgress({
        isRunning: false,
        progress: 0,
        currentStep: 'Cancelled',
        canCancel: false
      });
      setViewMode('setup');
    } catch (err) {
      console.error('Failed to cancel backtest:', err);
      setError('Failed to cancel backtest.');
    }
  };

  const handleViewResults = (backtest: BacktestRun) => {
    setCurrentBacktest(backtest);
    setViewMode('results');
  };

  const handleCompareBacktests = () => {
    if (selectedBacktests.length >= 2) {
      setViewMode('comparison');
    }
  };

  const handleBacktestSelection = (backtestId: string, selected: boolean) => {
    if (selected) {
      setSelectedBacktests(prev => [...prev, backtestId]);
    } else {
      setSelectedBacktests(prev => prev.filter(id => id !== backtestId));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading backtesting data...</p>
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
              Strategy Backtesting
            </h1>
            <p className="text-slate-600 mt-2">Test your trading strategies against historical data</p>
          </div>
          <div className="flex items-center space-x-3">
            {viewMode === 'history' && selectedBacktests.length >= 2 && (
              <Button
                onClick={handleCompareBacktests}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <GitCompare className="w-4 h-4 mr-2" />
                Compare Selected ({selectedBacktests.length})
              </Button>
            )}
            {viewMode !== 'setup' && (
              <Button
                variant="outline"
                onClick={() => setViewMode('setup')}
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                <Play className="w-4 h-4 mr-2" />
                New Backtest
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{error}</span>
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-slate-100">
              <TabsTrigger value="setup" className="flex items-center space-x-2">
                <Play className="w-4 h-4" />
                <span>Setup</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center space-x-2" disabled={!currentBacktest}>
                <BarChart3 className="w-4 h-4" />
                <span>Results</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <History className="w-4 h-4" />
                <span>History</span>
              </TabsTrigger>
              <TabsTrigger value="comparison" className="flex items-center space-x-2" disabled={selectedBacktests.length < 2}>
                <GitCompare className="w-4 h-4" />
                <span>Compare</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-6">
              <BacktestForm
                strategies={strategies}
                onStartBacktest={handleStartBacktest}
                isRunning={backtestProgress.isRunning}
              />
            </TabsContent>

            <TabsContent value="running" className="space-y-6">
              <BacktestProgress
                progress={backtestProgress}
                onCancel={handleCancelBacktest}
              />
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              {currentBacktest && (
                <BacktestResults
                  backtest={currentBacktest}
                  onBackToSetup={() => setViewMode('setup')}
                />
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <BacktestHistory
                backtests={backtestRuns}
                selectedBacktests={selectedBacktests}
                onViewResults={handleViewResults}
                onSelectionChange={handleBacktestSelection}
                onCompare={handleCompareBacktests}
              />
            </TabsContent>

            <TabsContent value="comparison" className="space-y-6">
              {selectedBacktests.length >= 2 && (
                <BacktestComparison
                  backtestIds={selectedBacktests}
                  onBackToHistory={() => setViewMode('history')}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default BacktestPage;