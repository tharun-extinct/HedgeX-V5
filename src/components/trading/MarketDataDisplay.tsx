import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Star,
  StarOff,
  BarChart3,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MarketDataItem {
  symbol: string;
  instrument_token: number;
  ltp: number;
  volume: number;
  bid: number;
  ask: number;
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  change?: number;
  change_percent?: number;
  timestamp: string;
}

interface MarketDataDisplayProps {
  marketData: MarketDataItem[];
  onRefresh?: () => void;
  onQuickTrade?: (symbol: string, action: 'BUY' | 'SELL') => void;
  onToggleFavorite?: (symbol: string) => void;
  favorites?: string[];
  isLoading?: boolean;
  className?: string;
}

type SortField = 'symbol' | 'ltp' | 'change' | 'change_percent' | 'volume';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'gainers' | 'losers' | 'favorites';

export const MarketDataDisplay: React.FC<MarketDataDisplayProps> = ({
  marketData,
  onRefresh,
  onQuickTrade,
  onToggleFavorite,
  favorites = [],
  isLoading = false,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter and sort market data
  const filteredAndSortedData = useMemo(() => {
    let filtered = marketData;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    switch (filter) {
      case 'gainers':
        filtered = filtered.filter(item => (item.change || 0) > 0);
        break;
      case 'losers':
        filtered = filtered.filter(item => (item.change || 0) < 0);
        break;
      case 'favorites':
        filtered = filtered.filter(item => favorites.includes(item.symbol));
        break;
    }

    // Sort data
    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'ltp':
          aValue = a.ltp;
          bValue = b.ltp;
          break;
        case 'change':
          aValue = a.change || 0;
          bValue = b.change || 0;
          break;
        case 'change_percent':
          aValue = a.change_percent || 0;
          bValue = b.change_percent || 0;
          break;
        case 'volume':
          aValue = a.volume;
          bValue = b.volume;
          break;
        default:
          aValue = a.symbol;
          bValue = b.symbol;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [marketData, searchTerm, sortField, sortDirection, filter, favorites]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 10000000) {
      return `${(volume / 10000000).toFixed(1)}Cr`;
    } else if (volume >= 100000) {
      return `${(volume / 100000).toFixed(1)}L`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  const formatPercentage = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getFilterCounts = () => {
    const gainers = marketData.filter(item => (item.change || 0) > 0).length;
    const losers = marketData.filter(item => (item.change || 0) < 0).length;
    const favCount = marketData.filter(item => favorites.includes(item.symbol)).length;
    
    return { gainers, losers, favorites: favCount };
  };

  const counts = getFilterCounts();

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg font-semibold">Market Watch</CardTitle>
            <Badge variant="outline" className="text-xs">
              {filteredAndSortedData.length} stocks
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search stocks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex space-x-1 overflow-x-auto">
            <Button
              variant={filter === 'all' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('all')}
              className="text-xs whitespace-nowrap"
            >
              All ({marketData.length})
            </Button>
            <Button
              variant={filter === 'gainers' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('gainers')}
              className="text-xs whitespace-nowrap text-green-600"
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              Gainers ({counts.gainers})
            </Button>
            <Button
              variant={filter === 'losers' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('losers')}
              className="text-xs whitespace-nowrap text-red-600"
            >
              <TrendingDown className="w-3 h-3 mr-1" />
              Losers ({counts.losers})
            </Button>
            <Button
              variant={filter === 'favorites' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('favorites')}
              className="text-xs whitespace-nowrap"
            >
              <Star className="w-3 h-3 mr-1" />
              Favorites ({counts.favorites})
            </Button>
          </div>
        </div>

        {/* Sort Headers */}
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
          <div 
            className="col-span-3 cursor-pointer hover:text-foreground flex items-center"
            onClick={() => handleSort('symbol')}
          >
            Symbol
            {sortField === 'symbol' && (
              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </div>
          <div 
            className="col-span-2 cursor-pointer hover:text-foreground text-right flex items-center justify-end"
            onClick={() => handleSort('ltp')}
          >
            LTP
            {sortField === 'ltp' && (
              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </div>
          <div 
            className="col-span-2 cursor-pointer hover:text-foreground text-right flex items-center justify-end"
            onClick={() => handleSort('change')}
          >
            Change
            {sortField === 'change' && (
              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </div>
          <div 
            className="col-span-2 cursor-pointer hover:text-foreground text-right flex items-center justify-end"
            onClick={() => handleSort('volume')}
          >
            Volume
            {sortField === 'volume' && (
              <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </div>
          <div className="col-span-3 text-center">Actions</div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          {filteredAndSortedData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No stocks found</p>
              {searchTerm && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="mt-2"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredAndSortedData.map((item) => {
                const change = item.change || 0;
                const changePercent = item.change_percent || 0;
                const isFavorite = favorites.includes(item.symbol);
                
                return (
                  <div
                    key={item.symbol}
                    className="grid grid-cols-12 gap-2 p-3 hover:bg-muted/30 transition-colors border-b border-border/50"
                  >
                    {/* Symbol */}
                    <div className="col-span-3 flex items-center space-x-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full animate-pulse",
                        change > 0 ? "bg-green-500" : change < 0 ? "bg-red-500" : "bg-gray-400"
                      )} />
                      <div>
                        <div className="font-medium text-sm">{item.symbol}</div>
                        <div className="text-xs text-muted-foreground">
                          Vol: {formatVolume(item.volume)}
                        </div>
                      </div>
                    </div>

                    {/* LTP */}
                    <div className="col-span-2 text-right">
                      <div className="font-medium text-sm">{formatCurrency(item.ltp)}</div>
                      {item.ohlc && (
                        <div className="text-xs text-muted-foreground">
                          H: {item.ohlc.high.toFixed(2)} L: {item.ohlc.low.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* Change */}
                    <div className="col-span-2 text-right">
                      <div className={cn("font-medium text-sm flex items-center justify-end", getChangeColor(change))}>
                        {change > 0 ? (
                          <ArrowUpRight className="w-3 h-3 mr-1" />
                        ) : change < 0 ? (
                          <ArrowDownRight className="w-3 h-3 mr-1" />
                        ) : null}
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}
                      </div>
                      <div className={cn("text-xs", getChangeColor(changePercent))}>
                        {formatPercentage(changePercent)}
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="col-span-2 text-right">
                      <div className="font-medium text-sm">{formatVolume(item.volume)}</div>
                      <div className="text-xs text-muted-foreground">
                        Bid: {item.bid.toFixed(2)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex items-center justify-center space-x-1">
                      {onToggleFavorite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleFavorite(item.symbol)}
                          className="h-6 w-6 p-0"
                        >
                          {isFavorite ? (
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                          ) : (
                            <StarOff className="w-3 h-3 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                      
                      {onQuickTrade && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onQuickTrade(item.symbol, 'BUY')}
                            className="h-6 text-xs px-2 border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700"
                          >
                            Buy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onQuickTrade(item.symbol, 'SELL')}
                            className="h-6 text-xs px-2 border-red-500/50 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            Sell
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default MarketDataDisplay;