import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Square, Activity, Clock, TrendingUp } from 'lucide-react';

interface BacktestProgressProps {
  progress: {
    isRunning: boolean;
    progress: number;
    currentStep: string;
    canCancel: boolean;
  };
  onCancel: () => void;
}

const BacktestProgress: React.FC<BacktestProgressProps> = ({
  progress,
  onCancel
}) => {
  const getProgressColor = () => {
    if (progress.progress < 30) return 'bg-blue-500';
    if (progress.progress < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressText = () => {
    if (progress.progress === 0) return 'Initializing...';
    if (progress.progress < 20) return 'Loading historical data...';
    if (progress.progress < 40) return 'Processing market data...';
    if (progress.progress < 60) return 'Executing strategy...';
    if (progress.progress < 80) return 'Calculating metrics...';
    if (progress.progress < 100) return 'Finalizing results...';
    return 'Completed!';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2">
            <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
            <span>Backtest in Progress</span>
          </CardTitle>
          <CardDescription>
            Please wait while we process your backtest. This may take a few minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700">
                {getProgressText()}
              </span>
              <span className="text-sm text-slate-500">
                {Math.round(progress.progress)}%
              </span>
            </div>
            
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${getProgressColor()}`}
                style={{ width: `${progress.progress}%` }}
              >
                <div className="h-full bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Current Step */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-700 font-medium">
                Current Step:
              </span>
              <span className="text-sm text-slate-600">
                {progress.currentStep}
              </span>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Process Steps:</h4>
            <div className="space-y-2">
              {[
                { step: 'Data Loading', threshold: 20, icon: Clock },
                { step: 'Strategy Execution', threshold: 60, icon: TrendingUp },
                { step: 'Results Calculation', threshold: 90, icon: Activity },
                { step: 'Report Generation', threshold: 100, icon: Activity }
              ].map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    progress.progress >= item.threshold
                      ? 'bg-green-100 text-green-600'
                      : progress.progress >= item.threshold - 20
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    {progress.progress >= item.threshold ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : progress.progress >= item.threshold - 20 ? (
                      <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                    ) : (
                      <item.icon className="w-3 h-3" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    progress.progress >= item.threshold
                      ? 'text-green-600 font-medium'
                      : progress.progress >= item.threshold - 20
                      ? 'text-blue-600 font-medium'
                      : 'text-slate-500'
                  }`}>
                    {item.step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Estimated Time */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800 font-medium">
                Estimated Time Remaining:
              </span>
              <span className="text-sm text-blue-700">
                {progress.progress < 20 ? '3-5 minutes' :
                 progress.progress < 50 ? '2-3 minutes' :
                 progress.progress < 80 ? '1-2 minutes' :
                 'Less than 1 minute'}
              </span>
            </div>
          </div>

          {/* Cancel Button */}
          {progress.canCancel && (
            <div className="flex justify-center pt-4 border-t">
              <Button
                variant="outline"
                onClick={onCancel}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Square className="w-4 h-4 mr-2" />
                Cancel Backtest
              </Button>
            </div>
          )}

          {/* Warning Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <svg className="w-4 h-4 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Please don't close the application</p>
                <p>Closing the app will cancel the backtest and you'll lose progress.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BacktestProgress;