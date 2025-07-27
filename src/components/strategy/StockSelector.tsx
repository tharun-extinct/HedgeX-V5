import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Search, Plus, Minus, CheckSquare, Square, Filter } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface Stock {
  symbol: string;
  name: string;
  is_active: boolean;
}

interface StockSelectorProps {
  onSelectionChange?: (selectedStocks: string[]) => void;
}

const StockSelector: React.FC<StockSelectorProps> = ({ onSelectionChange }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load NIFTY 50 stocks and current selections
  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    try {
      setIsLoading(true);
      
      // Get NIFTY 50 stocks with current selection status
      const result = await invoke('get_stock_list');
      
      if (Array.isArray(result)) {
        const stockData = result as Stock[];
        setStocks(stockData);
        
        // Set initially selected stocks
        const activeStocks = stockData
          .filter(stock => stock.is_active)
          .map(stock => stock.symbol);
        setSelectedStocks(new Set(activeStocks));
        
        if (onSelectionChange) {
          onSelectionChange(activeStocks);
        }
      }
    } catch (error) {
      console.error('Error loading stocks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter stocks based on search term and active filter
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      const matchesSearch = stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           stock.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = !showActiveOnly || stock.is_active;
      return matchesSearch && matchesFilter;
    });
  }, [stocks, searchTerm, showActiveOnly]);

  // Handle individual stock selection
  const handleStockToggle = async (symbol: string, isSelected: boolean) => {
    setIsUpdating(true);
    
    try {
      if (isSelected) {
        await invoke('add_stock_selection', { symbol, exchange: 'NSE' });
      } else {
        await invoke('remove_stock_selection', { symbol });
      }
      
      // Update local state
      const newSelectedStocks = new Set(selectedStocks);
      if (isSelected) {
        newSelectedStocks.add(symbol);
      } else {
        newSelectedStocks.delete(symbol);
      }
      setSelectedStocks(newSelectedStocks);
      
      // Update stocks list to reflect active status
      setStocks(prev => prev.map(stock => 
        stock.symbol === symbol 
          ? { ...stock, is_active: isSelected }
          : stock
      ));
      
      if (onSelectionChange) {
        onSelectionChange(Array.from(newSelectedStocks));
      }
    } catch (error) {
      console.error('Error updating stock selection:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle bulk operations
  const handleBulkAdd = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    setIsUpdating(true);
    
    try {
      await invoke('bulk_add_stock_selections', { 
        symbols, 
        exchange: 'NSE' 
      });
      
      // Update local state
      const newSelectedStocks = new Set([...selectedStocks, ...symbols]);
      setSelectedStocks(newSelectedStocks);
      
      // Update stocks list
      setStocks(prev => prev.map(stock => 
        symbols.includes(stock.symbol)
          ? { ...stock, is_active: true }
          : stock
      ));
      
      if (onSelectionChange) {
        onSelectionChange(Array.from(newSelectedStocks));
      }
    } catch (error) {
      console.error('Error bulk adding stocks:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkRemove = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    setIsUpdating(true);
    
    try {
      await invoke('bulk_remove_stock_selections', { symbols });
      
      // Update local state
      const newSelectedStocks = new Set(selectedStocks);
      symbols.forEach(symbol => newSelectedStocks.delete(symbol));
      setSelectedStocks(newSelectedStocks);
      
      // Update stocks list
      setStocks(prev => prev.map(stock => 
        symbols.includes(stock.symbol)
          ? { ...stock, is_active: false }
          : stock
      ));
      
      if (onSelectionChange) {
        onSelectionChange(Array.from(newSelectedStocks));
      }
    } catch (error) {
      console.error('Error bulk removing stocks:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Select all filtered stocks
  const handleSelectAll = () => {
    const filteredSymbols = filteredStocks.map(stock => stock.symbol);
    const unselectedSymbols = filteredSymbols.filter(symbol => !selectedStocks.has(symbol));
    
    if (unselectedSymbols.length > 0) {
      handleBulkAdd(unselectedSymbols);
    }
  };

  // Deselect all filtered stocks
  const handleDeselectAll = () => {
    const filteredSymbols = filteredStocks.map(stock => stock.symbol);
    const selectedSymbols = filteredSymbols.filter(symbol => selectedStocks.has(symbol));
    
    if (selectedSymbols.length > 0) {
      handleBulkRemove(selectedSymbols);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-slate-600">Loading NIFTY 50 stocks...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>NIFTY 50 Stock Selection</span>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {selectedStocks.size} / {stocks.length} selected
          </Badge>
        </CardTitle>
        <CardDescription>
          Select stocks from NIFTY 50 for your trading strategy
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search stocks by symbol or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showActiveOnly"
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
            />
            <label htmlFor="showActiveOnly" className="text-sm font-medium cursor-pointer">
              Show active only
            </label>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSelectAll}
            disabled={isUpdating}
            className="text-green-600 border-green-300 hover:bg-green-50"
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            Select All Filtered
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDeselectAll}
            disabled={isUpdating}
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            <Square className="w-4 h-4 mr-1" />
            Deselect All Filtered
          </Button>
        </div>

        {/* Stock List */}
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
            {filteredStocks.map((stock) => (
              <div
                key={stock.symbol}
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                  selectedStocks.has(stock.symbol)
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Checkbox
                  id={stock.symbol}
                  checked={selectedStocks.has(stock.symbol)}
                  onCheckedChange={(checked) => 
                    handleStockToggle(stock.symbol, checked as boolean)
                  }
                  disabled={isUpdating}
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={stock.symbol}
                    className="block font-medium text-slate-900 cursor-pointer"
                  >
                    {stock.symbol}
                  </label>
                  <p className="text-xs text-slate-600 truncate">
                    {stock.name}
                  </p>
                </div>
                {selectedStocks.has(stock.symbol) && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    Active
                  </Badge>
                )}
              </div>
            ))}
          </div>
          
          {filteredStocks.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No stocks match your search criteria</p>
            </div>
          )}
        </div>

        {/* Selection Summary */}
        {selectedStocks.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Selected Stocks ({selectedStocks.size})</h4>
            <div className="flex flex-wrap gap-1">
              {Array.from(selectedStocks).slice(0, 10).map((symbol) => (
                <Badge key={symbol} variant="secondary" className="bg-blue-100 text-blue-800">
                  {symbol}
                </Badge>
              ))}
              {selectedStocks.size > 10 && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                  +{selectedStocks.size - 10} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockSelector;