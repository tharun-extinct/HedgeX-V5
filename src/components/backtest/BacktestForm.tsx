import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Upload, Calendar, Database, FileText, Play, AlertCircle } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
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

interface BacktestFormProps {
  strategies: Strategy[];
  onStartBacktest: (params: BacktestParams) => void;
  isRunning: boolean;
}

const NIFTY_50_STOCKS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK',
  'BHARTIARTL', 'ITC', 'SBIN', 'BAJFINANCE', 'LICI', 'LT', 'HCLTECH', 'ASIANPAINT',
  'AXISBANK', 'MARUTI', 'SUNPHARMA', 'TITAN', 'ULTRACEMCO', 'WIPRO', 'NESTLEIND',
  'POWERGRID', 'NTPC', 'JSWSTEEL', 'M&M', 'TATAMOTORS', 'TECHM', 'COALINDIA',
  'INDUSINDBK', 'BAJAJFINSV', 'ONGC', 'TATASTEEL', 'HINDALCO', 'ADANIENT',
  'CIPLA', 'GRASIM', 'BRITANNIA', 'DRREDDY', 'EICHERMOT', 'APOLLOHOSP',
  'BPCL', 'DIVISLAB', 'HEROMOTOCO', 'TATACONSUM', 'SBILIFE', 'BAJAJ-AUTO',
  'HDFCLIFE', 'ADANIPORTS', 'UPL'
];

const TIMEFRAMES = [
  { value: 'minute1', label: '1 Minute' },
  { value: 'minute5', label: '5 Minutes' },
  { value: 'minute15', label: '15 Minutes' },
  { value: 'minute30', label: '30 Minutes' },
  { value: 'hour1', label: '1 Hour' },
  { value: 'day1', label: '1 Day' }
];

const BacktestForm: React.FC<BacktestFormProps> = ({
  strategies,
  onStartBacktest,
  isRunning
}) => {
  const [formData, setFormData] = useState<BacktestParams>({
    strategy_id: '',
    symbol: '',
    exchange: 'NSE',
    start_date: '',
    end_date: '',
    timeframe: 'minute5',
    initial_capital: 100000,
    data_source: 'api'
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof BacktestParams, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setFormData(prev => ({
        ...prev,
        data_source: 'csv',
        csv_file_path: file.name
      }));
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.strategy_id) {
      newErrors.strategy_id = 'Please select a strategy';
    }

    if (!formData.symbol) {
      newErrors.symbol = 'Please select a symbol';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Please select a start date';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'Please select an end date';
    }

    if (formData.start_date && formData.end_date && formData.start_date >= formData.end_date) {
      newErrors.end_date = 'End date must be after start date';
    }

    if (formData.initial_capital <= 0) {
      newErrors.initial_capital = 'Initial capital must be greater than 0';
    }

    if (formData.data_source === 'csv' && !csvFile) {
      newErrors.csv_file = 'Please upload a CSV file';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onStartBacktest(formData);
    }
  };

  const selectedStrategy = strategies.find(s => s.id === formData.strategy_id);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Play className="w-5 h-5 text-purple-600" />
          <span>Backtest Configuration</span>
        </CardTitle>
        <CardDescription>
          Configure your backtest parameters and data source
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Strategy Selection */}
          <div className="space-y-2">
            <Label htmlFor="strategy">Trading Strategy *</Label>
            <Select
              value={formData.strategy_id}
              onValueChange={(value) => handleInputChange('strategy_id', value)}
            >
              <SelectTrigger id="strategy" className={errors.strategy_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select a strategy" />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((strategy) => (
                  <SelectItem key={strategy.id} value={strategy.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{strategy.name}</span>
                      {!strategy.enabled && (
                        <span className="text-xs text-orange-600 ml-2">(Disabled)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.strategy_id && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.strategy_id}</span>
              </p>
            )}
            {selectedStrategy && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                <p className="text-sm text-blue-800">
                  <strong>Strategy:</strong> {selectedStrategy.name}
                </p>
                {selectedStrategy.description && (
                  <p className="text-sm text-blue-700 mt-1">
                    {selectedStrategy.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Symbol and Exchange */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol *</Label>
              <Select
                value={formData.symbol}
                onValueChange={(value) => handleInputChange('symbol', value)}
              >
                <SelectTrigger id="symbol" className={errors.symbol ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select NIFTY 50 stock" />
                </SelectTrigger>
                <SelectContent>
                  {NIFTY_50_STOCKS.map((stock) => (
                    <SelectItem key={stock} value={stock}>
                      {stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.symbol && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.symbol}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="exchange">Exchange</Label>
              <Select
                value={formData.exchange}
                onValueChange={(value) => handleInputChange('exchange', value)}
              >
                <SelectTrigger id="exchange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range and Timeframe */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                className={errors.start_date ? 'border-red-500' : ''}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.start_date && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.start_date}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date *</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
                className={errors.end_date ? 'border-red-500' : ''}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.end_date && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.end_date}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select
                value={formData.timeframe}
                onValueChange={(value) => handleInputChange('timeframe', value)}
              >
                <SelectTrigger id="timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value}>
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Initial Capital */}
          <div className="space-y-2">
            <Label htmlFor="initial_capital">Initial Capital (₹) *</Label>
            <Input
              id="initial_capital"
              type="number"
              value={formData.initial_capital}
              onChange={(e) => handleInputChange('initial_capital', parseFloat(e.target.value) || 0)}
              className={errors.initial_capital ? 'border-red-500' : ''}
              min="1000"
              step="1000"
            />
            {errors.initial_capital && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.initial_capital}</span>
              </p>
            )}
          </div>

          {/* Data Source Selection */}
          <div className="space-y-4">
            <Label>Historical Data Source *</Label>
            <Tabs
              value={formData.data_source}
              onValueChange={(value) => handleInputChange('data_source', value)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="api" className="flex items-center space-x-2">
                  <Database className="w-4 h-4" />
                  <span>Kite API</span>
                </TabsTrigger>
                <TabsTrigger value="csv" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>CSV Upload</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="api" className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Database className="w-5 h-5 text-green-600" />
                    <h4 className="font-medium text-green-800">Zerodha Kite API</h4>
                  </div>
                  <p className="text-sm text-green-700">
                    Historical data will be fetched automatically from Zerodha Kite API.
                    This requires valid API credentials and may incur API charges.
                  </p>
                  <div className="mt-3 text-xs text-green-600">
                    <strong>Note:</strong> API rate limits apply. Large date ranges may take longer to process.
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="csv" className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Upload className="w-5 h-5 text-blue-600" />
                    <h4 className="font-medium text-blue-800">CSV File Upload</h4>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">
                    Upload your own historical data in CSV format. File should contain columns:
                    timestamp, open, high, low, close, volume
                  </p>
                  
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                    />
                    {csvFile && (
                      <div className="text-sm text-green-600 flex items-center space-x-1">
                        <FileText className="w-4 h-4" />
                        <span>Selected: {csvFile.name}</span>
                      </div>
                    )}
                    {errors.csv_file && (
                      <p className="text-sm text-red-600 flex items-center space-x-1">
                        <AlertCircle className="w-4 h-4" />
                        <span>{errors.csv_file}</span>
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={isRunning}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Backtest
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BacktestForm;