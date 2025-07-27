import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Play, Pause, Square, Settings, TrendingUp, TrendingDown, Zap, Target, BarChart3, Plus, Edit } from 'lucide-react';
import StrategyForm from '../components/strategy/StrategyForm';
import StockSelector from '../components/strategy/StockSelector';
import StrategyControls from '../components/strategy/StrategyControls';
import StrategyPerformance from '../components/strategy/StrategyPerformance';

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
  created_at: string;
  updated_at: string;
}

type ViewMode = 'list' | 'create' | 'edit' | 'performance' | 'stocks';

const StrategiesPage: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load strategies from backend
  const loadStrategies = async () => {
    try {
      setIsLoading(true);
      const result = await invoke('get_strategies');
      
      if (result && typeof result === 'object' && 'success' in result) {
        const response = result as { success: boolean; data?: Strategy[] };
        if (response.success && response.data) {
          setStrategies(response.data);
        }
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch strategies:', err);
      setError('Failed to load strategies. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, []);

  const handleStrategyUpdate = (updatedStrategy: Strategy) => {
    setStrategies(prev => prev.map(strategy => 
      strategy.id === updatedStrategy.id ? updatedStrategy : strategy
    ));
    
    if (selectedStrategy?.id === updatedStrategy.id) {
      setSelectedStrategy(updatedStrategy);
    }
  };

  const handleStrategySave = (strategy: Strategy) => {
    if (viewMode === 'create') {
      setStrategies(prev => [...prev, strategy]);
    } else {
      handleStrategyUpdate(strategy);
    }
    setViewMode('list');
    setSelectedStrategy(null);
  };

  const handleCreateNew = () => {
    setSelectedStrategy(null);
    setViewMode('create');
  };

  const handleEdit = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setViewMode('edit');
  };

  const handleViewPerformance = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setViewMode('performance');
  };

  const handleManageStocks = () => {
    setViewMode('stocks');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedStrategy(null);
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

  // Render different views based on current mode
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={handleBackToList}
              className="mb-4"
            >
              ← Back to Strategies
            </Button>
          </div>
          <StrategyForm
            strategy={selectedStrategy}
            onSave={handleStrategySave}
            onCancel={handleBackToList}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'performance' && selectedStrategy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={handleBackToList}
              className="mb-4"
            >
              ← Back to Strategies
            </Button>
          </div>
          <StrategyPerformance
            strategyId={selectedStrategy.id}
            strategyName={selectedStrategy.name}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'stocks') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={handleBackToList}
              className="mb-4"
            >
              ← Back to Strategies
            </Button>
          </div>
          <StockSelector />
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
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={handleManageStocks}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Target className="w-4 h-4 mr-2" />
              Manage Stocks
            </Button>
            <Button
              onClick={handleCreateNew}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Strategy
            </Button>
          </div>
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
                strategy.enabled 
                  ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' 
                  : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'
              }`}
              onClick={() => setSelectedStrategy(strategy)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold text-slate-900">{strategy.name}</CardTitle>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 ${
                    strategy.enabled 
                      ? 'bg-green-200 text-green-800' 
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      strategy.enabled 
                        ? 'bg-green-500 animate-pulse' 
                        : 'bg-slate-400'
                    }`}></div>
                    <span>{strategy.enabled ? 'ACTIVE' : 'INACTIVE'}</span>
                  </div>
                </div>
                <CardDescription className="text-slate-600 line-clamp-2">
                  {strategy.description || 'No description provided'}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Max Trades/Day</div>
                    <div className="text-lg font-bold text-slate-900">
                      {strategy.max_trades_per_day}
                    </div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Risk %</div>
                    <div className="text-lg font-bold text-orange-600">
                      {strategy.risk_percentage}%
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/60 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-2">Risk Management</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">SL: {strategy.stop_loss_percentage}%</span>
                    <span className="text-green-600">TP: {strategy.take_profit_percentage}%</span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex gap-2 pt-0">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(strategy);
                  }}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-purple-600 border-purple-300 hover:bg-purple-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewPerformance(strategy);
                  }}
                >
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Performance
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Strategy Details */}
        {selectedStrategy && (
          <StrategyControls
            strategy={selectedStrategy}
            onStrategyUpdate={handleStrategyUpdate}
            onEdit={() => handleEdit(selectedStrategy)}
          />
        )}

        {/* Empty State */}
        {strategies.length === 0 && !isLoading && (
          <Card className="text-center py-12">
            <CardContent>
              <Target className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Strategies Found</h3>
              <p className="text-slate-600 mb-6">
                Get started by creating your first trading strategy
              </p>
              <Button
                onClick={handleCreateNew}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Strategy
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StrategiesPage;