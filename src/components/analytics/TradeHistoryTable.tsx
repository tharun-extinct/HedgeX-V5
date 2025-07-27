import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Calendar, 
  Filter, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileText,
  RefreshCw
} from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  trade_type: 'Buy' | 'Sell';
  quantity: number;
  price: number;
  status: 'Pending' | 'Executed' | 'Cancelled' | 'Failed' | 'PartiallyFilled';
  executed_at: string;
  strategy_id: string;
  pnl?: number;
  pnl_percentage?: number;
}

interface TradeHistoryFilters {
  symbol?: string;
  trade_type?: 'Buy' | 'Sell';
  status?: string;
  strategy_id?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: 'executed_at' | 'symbol' | 'pnl';
  sort_order?: 'asc' | 'desc';
}

interface TradeHistoryTableProps {
  onExport?: (trades: Trade[]) => void;
}

const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({ onExport }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TradeHistoryFilters>({
    sort_by: 'executed_at',
    sort_order: 'desc'
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);

  useEffect(() => {
    fetchTrades();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trades, filters]);

  const fetchTrades = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call backend API to get trades
      const response = await invoke<{ success: boolean; data: Trade[]; error?: string }>('get_trade_history', {
        limit: 1000, // Get more trades for client-side filtering
        offset: 0
      });
      
      if (response.success && response.data) {
        setTrades(response.data);
      } else {
        setError(response.error || 'Failed to fetch trades');
      }
    } catch (err) {
      console.error('Failed to fetch trades:', err);
      setError('Failed to load trade history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...trades];

    // Apply filters
    if (filters.symbol) {
      filtered = filtered.filter(trade => 
        trade.symbol.toLowerCase().includes(filters.symbol!.toLowerCase())
      );
    }

    if (filters.trade_type) {
      filtered = filtered.filter(trade => trade.trade_type === filters.trade_type);
    }

    if (filters.status) {
      filtered = filtered.filter(trade => trade.status === filters.status);
    }

    if (filters.strategy_id) {
      filtered = filtered.filter(trade => trade.strategy_id === filters.strategy_id);
    }

    if (filters.date_from) {
      filtered = filtered.filter(trade => 
        new Date(trade.executed_at) >= new Date(filters.date_from!)
      );
    }

    if (filters.date_to) {
      filtered = filtered.filter(trade => 
        new Date(trade.executed_at) <= new Date(filters.date_to!)
      );
    }

    // Apply sorting
    if (filters.sort_by) {
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (filters.sort_by) {
          case 'executed_at':
            aValue = new Date(a.executed_at);
            bValue = new Date(b.executed_at);
            break;
          case 'symbol':
            aValue = a.symbol;
            bValue = b.symbol;
            break;
          case 'pnl':
            aValue = a.pnl || 0;
            bValue = b.pnl || 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return filters.sort_order === 'asc' ? -1 : 1;
        if (aValue > bValue) return filters.sort_order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredTrades(filtered);
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof TradeHistoryFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value || undefined
    }));
  };

  const handleSort = (column: 'executed_at' | 'symbol' | 'pnl') => {
    setFilters(prev => ({
      ...prev,
      sort_by: column,
      sort_order: prev.sort_by === column && prev.sort_order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExport = () => {
    if (onExport) {
      onExport(filteredTrades);
    } else {
      // Default export functionality
      exportToCSV(filteredTrades);
    }
  };

  const exportToCSV = (trades: Trade[]) => {
    const headers = ['Date/Time', 'Symbol', 'Type', 'Quantity', 'Price', 'P&L', 'P&L %', 'Status', 'Strategy ID'];
    const csvContent = [
      headers.join(','),
      ...trades.map(trade => [
        new Date(trade.executed_at).toISOString(),
        trade.symbol,
        trade.trade_type,
        trade.quantity,
        trade.price,
        trade.pnl || 0,
        trade.pnl_percentage || 0,
        trade.status,
        trade.strategy_id
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `trade_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setFilters({
      sort_by: 'executed_at',
      sort_order: 'desc'
    });
  };

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTrades = filteredTrades.slice(startIndex, endIndex);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Executed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'PartiallyFilled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <span className="ml-3 text-slate-600">Loading trade history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900">Trade History</CardTitle>
            <CardDescription className="text-slate-600">
              Detailed history of all executed trades with advanced filtering
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={fetchTrades} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={clearFilters} size="sm">
              Clear Filters
            </Button>
            <Button variant="outline" onClick={handleExport} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Symbol</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search symbol..."
                value={filters.symbol || ''}
                onChange={(e) => handleFilterChange('symbol', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <Select value={filters.trade_type || ''} onValueChange={(value) => handleFilterChange('trade_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="Buy">Buy</SelectItem>
                <SelectItem value="Sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <Select value={filters.status || ''} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Executed">Executed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
                <SelectItem value="PartiallyFilled">Partially Filled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
            <Input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
            <Input
              type="date"
              value={filters.date_to || ''}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={fetchTrades} className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredTrades.length)} of {filteredTrades.length} trades
          </div>
          <div className="text-sm text-slate-600">
            Total P&L: <span className={`font-bold ${filteredTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{filteredTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Trade Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th 
                  className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('executed_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date/Time</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('symbol')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Symbol</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Type</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Quantity</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Price</th>
                <th 
                  className="text-right py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('pnl')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>P&L</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">P&L %</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentTrades.length > 0 ? (
                currentTrades.map((trade, index) => (
                  <tr key={trade.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors`}>
                    <td className="py-3 px-4 text-slate-700">
                      {new Date(trade.executed_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{trade.symbol}</td>
                    <td className={`py-3 px-4 font-medium flex items-center space-x-1 ${trade.trade_type === 'Buy' ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.trade_type === 'Buy' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{trade.trade_type}</span>
                    </td>
                    <td className="text-right py-3 px-4 text-slate-700">{trade.quantity}</td>
                    <td className="text-right py-3 px-4 text-slate-700">₹{trade.price.toFixed(2)}</td>
                    <td className={`text-right py-3 px-4 font-bold ${trade.pnl && trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnl ? `${trade.pnl >= 0 ? '+' : ''}₹${trade.pnl.toFixed(2)}` : '-'}
                    </td>
                    <td className={`text-right py-3 px-4 font-bold ${trade.pnl_percentage && trade.pnl_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnl_percentage ? `${trade.pnl_percentage >= 0 ? '+' : ''}${trade.pnl_percentage.toFixed(2)}%` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(trade.status)}`}>
                        {trade.status}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No trades found matching the current filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradeHistoryTable;