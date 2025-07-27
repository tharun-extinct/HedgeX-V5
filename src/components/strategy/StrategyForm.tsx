import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { AlertCircle, Save, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface StrategyFormData {
  name: string;
  description: string;
  maxTradesPerDay: number;
  riskPercentage: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  volumeThreshold: number;
}

interface StrategyFormProps {
  strategy?: any;
  onSave: (strategy: any) => void;
  onCancel: () => void;
}

interface ValidationErrors {
  [key: string]: string;
}

const StrategyForm: React.FC<StrategyFormProps> = ({ strategy, onSave, onCancel }) => {
  const [formData, setFormData] = useState<StrategyFormData>({
    name: '',
    description: '',
    maxTradesPerDay: 10,
    riskPercentage: 2.0,
    stopLossPercentage: 1.0,
    takeProfitPercentage: 2.0,
    volumeThreshold: 100000,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (strategy) {
      setFormData({
        name: strategy.name || '',
        description: strategy.description || '',
        maxTradesPerDay: strategy.max_trades_per_day || 10,
        riskPercentage: strategy.risk_percentage || 2.0,
        stopLossPercentage: strategy.stop_loss_percentage || 1.0,
        takeProfitPercentage: strategy.take_profit_percentage || 2.0,
        volumeThreshold: strategy.volume_threshold || 100000,
      });
    }
  }, [strategy]);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Strategy name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Strategy name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Strategy name must be less than 50 characters';
    }

    // Max trades per day validation
    if (formData.maxTradesPerDay <= 0 || formData.maxTradesPerDay > 1000) {
      newErrors.maxTradesPerDay = 'Max trades per day must be between 1 and 1000';
    }

    // Risk percentage validation
    if (formData.riskPercentage <= 0 || formData.riskPercentage > 100) {
      newErrors.riskPercentage = 'Risk percentage must be between 0.1 and 100';
    }

    // Stop loss percentage validation
    if (formData.stopLossPercentage <= 0 || formData.stopLossPercentage > 50) {
      newErrors.stopLossPercentage = 'Stop loss percentage must be between 0.1 and 50';
    }

    // Take profit percentage validation
    if (formData.takeProfitPercentage <= 0 || formData.takeProfitPercentage > 100) {
      newErrors.takeProfitPercentage = 'Take profit percentage must be between 0.1 and 100';
    }

    // Take profit must be greater than stop loss
    if (formData.takeProfitPercentage <= formData.stopLossPercentage) {
      newErrors.takeProfitPercentage = 'Take profit must be greater than stop loss';
    }

    // Volume threshold validation
    if (formData.volumeThreshold <= 0) {
      newErrors.volumeThreshold = 'Volume threshold must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof StrategyFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      let result;
      
      if (strategy) {
        // Update existing strategy
        result = await invoke('update_strategy', {
          strategyId: strategy.id,
          name: formData.name,
          description: formData.description || null,
          maxTradesPerDay: formData.maxTradesPerDay,
          riskPercentage: formData.riskPercentage,
          stopLossPercentage: formData.stopLossPercentage,
          takeProfitPercentage: formData.takeProfitPercentage,
          volumeThreshold: formData.volumeThreshold,
        });
      } else {
        // Create new strategy
        result = await invoke('create_strategy', {
          name: formData.name,
          description: formData.description || null,
          maxTradesPerDay: formData.maxTradesPerDay,
          riskPercentage: formData.riskPercentage,
          stopLossPercentage: formData.stopLossPercentage,
          takeProfitPercentage: formData.takeProfitPercentage,
          volumeThreshold: formData.volumeThreshold,
        });
      }

      if (result && typeof result === 'object' && 'success' in result) {
        const response = result as { success: boolean; data?: any; error?: string };
        if (response.success && response.data) {
          onSave(response.data);
        } else {
          setErrors({ general: response.error || 'Failed to save strategy' });
        }
      }
    } catch (error) {
      console.error('Error saving strategy:', error);
      setErrors({ general: 'Failed to save strategy. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>{strategy ? 'Edit Strategy' : 'Create New Strategy'}</span>
        </CardTitle>
        <CardDescription>
          Configure your trading strategy parameters and risk management settings
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="name">Strategy Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter strategy name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.name}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe your strategy (optional)"
                rows={3}
              />
            </div>
          </div>

          {/* Trading Parameters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Trading Parameters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxTradesPerDay">Max Trades Per Day *</Label>
                <Input
                  id="maxTradesPerDay"
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.maxTradesPerDay}
                  onChange={(e) => handleInputChange('maxTradesPerDay', parseInt(e.target.value) || 0)}
                  className={errors.maxTradesPerDay ? 'border-red-500' : ''}
                />
                {errors.maxTradesPerDay && (
                  <p className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errors.maxTradesPerDay}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="volumeThreshold">Volume Threshold *</Label>
                <Input
                  id="volumeThreshold"
                  type="number"
                  min="1"
                  value={formData.volumeThreshold}
                  onChange={(e) => handleInputChange('volumeThreshold', parseInt(e.target.value) || 0)}
                  className={errors.volumeThreshold ? 'border-red-500' : ''}
                />
                {errors.volumeThreshold && (
                  <p className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errors.volumeThreshold}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Risk Management */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Risk Management</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="riskPercentage">Risk Per Trade (%) *</Label>
                <Input
                  id="riskPercentage"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={formData.riskPercentage}
                  onChange={(e) => handleInputChange('riskPercentage', parseFloat(e.target.value) || 0)}
                  className={errors.riskPercentage ? 'border-red-500' : ''}
                />
                {errors.riskPercentage && (
                  <p className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errors.riskPercentage}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="stopLossPercentage">Stop Loss (%) *</Label>
                <Input
                  id="stopLossPercentage"
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={formData.stopLossPercentage}
                  onChange={(e) => handleInputChange('stopLossPercentage', parseFloat(e.target.value) || 0)}
                  className={errors.stopLossPercentage ? 'border-red-500' : ''}
                />
                {errors.stopLossPercentage && (
                  <p className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errors.stopLossPercentage}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="takeProfitPercentage">Take Profit (%) *</Label>
                <Input
                  id="takeProfitPercentage"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={formData.takeProfitPercentage}
                  onChange={(e) => handleInputChange('takeProfitPercentage', parseFloat(e.target.value) || 0)}
                  className={errors.takeProfitPercentage ? 'border-red-500' : ''}
                />
                {errors.takeProfitPercentage && (
                  <p className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errors.takeProfitPercentage}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? 'Saving...' : (strategy ? 'Update Strategy' : 'Create Strategy')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default StrategyForm;