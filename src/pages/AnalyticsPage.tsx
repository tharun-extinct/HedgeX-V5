import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { TrendingUp, TrendingDown, Target, Zap, BarChart3, PieChart, Calendar, Award, FileText, Activity, Download } from 'lucide-react';
import PerformanceDashboard from '../components/analytics/PerformanceDashboard';
import TradeHistoryTable from '../components/analytics/TradeHistoryTable';
import LogViewer from '../components/analytics/LogViewer';

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
  const [activeTab, setActiveTab] = useState<'performance' | 'trades' | 'logs'>('performance');

  const handleExportAll = () => {
    // This would export all analytics data
    const exportData = {
      timeframe,
      exportedAt: new Date().toISOString(),
      note: 'Complete analytics export'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `complete_analytics_${timeframe}_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Analytics & Reports
            </h1>
            <p className="text-slate-600 mt-2">Comprehensive trading analytics, trade history, and system logs</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExportAll} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'performance' | 'trades' | 'logs')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100">
            <TabsTrigger value="performance" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="trades" className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Trade History</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>System Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-6">
            <PerformanceDashboard 
              timeframe={timeframe} 
              onTimeframeChange={setTimeframe}
            />
          </TabsContent>

          <TabsContent value="trades" className="space-y-6">
            <TradeHistoryTable />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <LogViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalyticsPage;