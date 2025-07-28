import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Eye, GitCompare, Search, Filter, Calendar, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
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

interface BacktestHistoryProps {
  backtests: BacktestRun[];
  selectedBacktests: string[];
  onViewResults: (backtest: BacktestRun) => void;
  onSelectionChange: (backtestId: string, selected: boolean) => void;
  onCompare: () => void;
}

const BacktestHistory: React.FC<BacktestHistoryProps> = ({
  backtests,
  selectedBacktests,
  onViewResults,
  onSelectionChange,
  onCompare
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'final_pnl' | 'win_rate' | 'sharpe_ratio'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');
  const [filterSymbol, setFilterSymbol] = useState<string>('all');

  // Get unique strategies and symbols for filtering
  const uniqueStrategies = Array.from(new Set(backtests.map(b => b.strategy_name)));
  const uniqueSymbols = Array.from(new Set(backtests.map(b => b.symbol)));

  // Filter and sort backtests
  const filteredBacktests = backtests
    .filter(backtest => {
      const matchesSearch = 
        backtest.strategy_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        backtest.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStrategy = filterStrategy === 'all' || backtest.strategy_name === filterStrategy;
      const matchesSymbol = filterSymbol === 'all' || backtest.symbol === filterSymbol;
      
      return matchesSearch && matchesStrategy && matchesSymbol;
    })
    .sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];
      
      if (sortBy === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      filteredBacktests.forEach(backtest => {
        if (!selectedBacktests.includes(backtest.id)) {
          onSelectionChange(backtest.id, true);
        }
      });
    } else {
      filteredBacktests.forEach(backtest => {
        if (selectedBacktests.includes(backtest.id)) {
          onSelectionChange(backtest.id, false);
        }
      });
    }
  };

  const allFilteredSelected = filteredBacktests.length > 0 && 
    filteredBacktests.every(backtest => selectedBacktests.includes(backtest.id));

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filter & Search</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search strategies or symbols..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Strategy</label>
              <Select value={filterStrategy} onValueChange={setFilterStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strategies</SelectItem>
                  {uniqueStrategies.map(strategy => (
                    <SelectItem key={strategy} value={strategy}>
                      {strategy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Symbol</label>
              <Select value={filterSymbol} onValueChange={setFilterSymbol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Symbols</SelectItem>
                  {uniqueSymbols.map(symbol => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Sort By</label>
              <div className="flex space-x-2">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Date</SelectItem>
                    <SelectItem value="final_pnl">P&L</SelectItem>
                    <SelectItem value="win_rate">Win Rate</SelectItem>
                    <SelectItem value="sharpe_ratio">Sharpe Ratio</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Controls */}
      {filteredBacktests.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-slate-600">
                Select All ({filteredBacktests.length})
              </span>
            </div>
            {selectedBacktests.length > 0 && (
              <span className="text-sm text-blue-600 font-medium">
                {selectedBacktests.length} selected
              </span>
            )}
          </div>
          
          {selectedBacktests.length >= 2 && (
            <Button
              onClick={onCompare}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Compare Selected ({selectedBacktests.length})
            </Button>
          )}
        </div>
      )}

      {/* Backtest List */}
      <div className="space-y-4">
        {filteredBacktests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Backtests Found</h3>
              <p className="text-slate-600">
                {backtests.length === 0 
                  ? "You haven't run any backtests yet. Start by creating a new backtest."
                  : "No backtests match your current filters. Try adjusting your search criteria."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredBacktests.map((backtest) => (
            <Card 
              key={backtest.id} 
              className={`transition-all duration-200 hover:shadow-lg ${
                selectedBacktests.includes(backtest.id) 
                  ? 'ring-2 ring-blue-500 shadow-lg' 
                  : 'shadow-md'
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <Checkbox
                      checked={selectedBacktests.includes(backtest.id)}
                      onCheckedChange={(checked) => onSelectionChange(backtest.id, !!checked)}
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {backtest.strategy_name}
                        </h3>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {backtest.symbol}
                        </span>
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                          {backtest.timeframe}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-slate-600 mb-3">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(backtest.start_date).toLocaleDateString()} - {new Date(backtest.end_date).toLocaleDateString()}
                          </span>
                        </div>
                        <span>•</span>
                        <span>Created {formatDateTime(backtest.created_at)}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Total P&L</p>
                          <p className={`text-lg font-bold ${
                            backtest.final_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(backtest.final_pnl)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatPercentage((backtest.final_pnl / backtest.initial_capital) * 100)}
                          </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Win Rate</p>
                          <p className="text-lg font-bold text-blue-600">
                            {formatPercentage(backtest.win_rate)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {backtest.winning_trades}/{backtest.total_trades}
                          </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Sharpe Ratio</p>
                          <p className="text-lg font-bold text-purple-600">
                            {backtest.sharpe_ratio.toFixed(2)}
                          </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Max Drawdown</p>
                          <p className="text-lg font-bold text-orange-600">
                            {formatCurrency(backtest.max_drawdown)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatPercentage((backtest.max_drawdown / backtest.initial_capital) * 100)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewResults(backtest)}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Results
                    </Button>
                    
                    <div className={`px-3 py-1 rounded-full text-xs font-bold text-center ${
                      backtest.final_pnl >= 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {backtest.final_pnl >= 0 ? (
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>PROFIT</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <TrendingDown className="w-3 h-3" />
                          <span>LOSS</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination could be added here for large datasets */}
      {filteredBacktests.length > 0 && (
        <div className="text-center text-sm text-slate-500">
          Showing {filteredBacktests.length} of {backtests.length} backtests
        </div>
      )}
    </div>
  );
};

export default BacktestHistory;