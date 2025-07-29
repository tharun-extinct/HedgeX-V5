import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Play, Pause, Square, Settings, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

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

interface StrategyControlsProps {
  strategy: Strategy;
  onStrategyUpdate: (strategy: Strategy) => void;
  onEdit: () => void;
}

const StrategyControls: React.FC<StrategyControlsProps> = ({ 
  strategy, 
  onStrategyUpdate, 
  onEdit 
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleStrategy = async (enabled: boolean) => {
    setIsUpdating(true);
    
    try {
      if (enabled) {
        await invoke('enable_strategy', { strategyId: strategy.id });
      } else {
        await invoke('disable_strategy', { strategyId: strategy.id });
      }
      
      // Update the strategy object
      const updatedStrategy = { ...strategy, enabled };
      onStrategyUpdate(updatedStrategy);
    } catch (error) {
      console.error('Error toggling strategy:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (enabled: boolean) => {
    return enabled 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getStatusIcon = (enabled: boolean) => {
    return enabled ? (
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
    ) : (
      <div className="w-2 h-2 bg-slate-400 rounded-full" />
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CardTitle className="text-xl">{strategy.name}</CardTitle>
            <Badge className={`flex items-center space-x-1 ${getStatusColor(strategy.enabled)}`}>
              {getStatusIcon(strategy.enabled)}
              <span>{strategy.enabled ? 'ACTIVE' : 'INACTIVE'}</span>
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Edit</span>
          </Button>
        </div>
        {strategy.description && (
          <CardDescription>{strategy.description}</CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Strategy Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${strategy.enabled ? 'bg-green-100' : 'bg-slate-100'}`}>
              {strategy.enabled ? (
                <Play className="w-4 h-4 text-green-600" />
              ) : (
                <Pause className="w-4 h-4 text-slate-600" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-slate-900">Strategy Status</h4>
              <p className="text-sm text-slate-600">
                {strategy.enabled ? 'Strategy is active and trading' : 'Strategy is paused'}
              </p>
            </div>
          </div>
          <Switch
            checked={strategy.enabled}
            onCheckedChange={handleToggleStrategy}
            disabled={isUpdating}
          />
        </div>

        {/* Strategy Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h4 className="font-medium text-slate-900">Max Trades/Day</h4>
            </div>
            <p className="text-2xl font-bold text-slate-900">{strategy.max_trades_per_day}</p>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <h4 className="font-medium text-slate-900">Risk Per Trade</h4>
            </div>
            <p className="text-2xl font-bold text-slate-900">{strategy.risk_percentage}%</p>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <h4 className="font-medium text-slate-900">Stop Loss</h4>
            </div>
            <p className="text-2xl font-bold text-red-600">{strategy.stop_loss_percentage}%</p>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <h4 className="font-medium text-slate-900">Take Profit</h4>
            </div>
            <p className="text-2xl font-bold text-green-600">{strategy.take_profit_percentage}%</p>
          </div>
        </div>

        {/* Volume Threshold */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Volume Threshold</h4>
          <p className="text-lg font-semibold text-blue-800">
            {strategy.volume_threshold.toLocaleString()} shares
          </p>
          <p className="text-sm text-blue-600 mt-1">
            Minimum volume required for trade execution
          </p>
        </div>

        {/* Risk-Reward Ratio */}
        <div className="bg-gradient-to-r from-green-50 to-red-50 border rounded-lg p-4">
          <h4 className="font-medium text-slate-900 mb-2">Risk-Reward Analysis</h4>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-sm text-slate-600">Risk-Reward Ratio</p>
              <p className="text-xl font-bold text-slate-900">
                1:{(strategy.take_profit_percentage / strategy.stop_loss_percentage).toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-600">Breakeven Win Rate</p>
              <p className="text-xl font-bold text-slate-900">
                {((strategy.stop_loss_percentage / (strategy.stop_loss_percentage + strategy.take_profit_percentage)) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {!strategy.enabled ? (
            <Button
              onClick={() => handleToggleStrategy(true)}
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              {isUpdating ? 'Activating...' : 'Activate Strategy'}
            </Button>
          ) : (
            <Button
              onClick={() => handleToggleStrategy(false)}
              disabled={isUpdating}
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <Pause className="w-4 h-4 mr-2" />
              {isUpdating ? 'Pausing...' : 'Pause Strategy'}
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={onEdit}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            <Settings className="w-4 h-4 mr-2" />
            Edit Parameters
          </Button>
        </div>

        {/* Warning for inactive strategy */}
        {!strategy.enabled && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              This strategy is currently inactive and will not execute any trades.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StrategyControls;