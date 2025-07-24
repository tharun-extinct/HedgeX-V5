import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Filter
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Order {
  id: string;
  symbol: string;
  exchange: string;
  order_type: 'Market' | 'Limit' | 'StopLoss' | 'StopLossMarket';
  trade_type: 'Buy' | 'Sell';
  quantity: number;
  price?: number;
  filled_quantity: number;
  pending_quantity: number;
  average_price?: number;
  status: 'Pending' | 'Executed' | 'Cancelled' | 'Failed' | 'PartiallyFilled';
  created_at: string;
  updated_at: string;
  strategy_id?: string;
  kite_order_id?: string;
}

interface OrderBookProps {
  orders: Order[];
  onRefresh?: () => void;
  onCancelOrder?: (orderId: string) => void;
  onModifyOrder?: (orderId: string) => void;
  isLoading?: boolean;
  className?: string;
}

type OrderFilter = 'all' | 'pending' | 'executed' | 'cancelled' | 'failed';

export const OrderBook: React.FC<OrderBookProps> = ({
  orders,
  onRefresh,
  onCancelOrder,
  onModifyOrder,
  isLoading = false,
  className
}) => {
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(orders);

  useEffect(() => {
    let filtered = orders;
    
    if (filter !== 'all') {
      filtered = orders.filter(order => 
        order.status.toLowerCase() === filter.toLowerCase()
      );
    }
    
    // Sort by created_at descending (newest first)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    setFilteredOrders(filtered);
  }, [orders, filter]);

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'Pending':
        return <Clock className="w-3 h-3 text-yellow-600" />;
      case 'Executed':
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'Cancelled':
        return <XCircle className="w-3 h-3 text-gray-600" />;
      case 'Failed':
        return <XCircle className="w-3 h-3 text-red-600" />;
      case 'PartiallyFilled':
        return <AlertCircle className="w-3 h-3 text-orange-600" />;
      default:
        return <Clock className="w-3 h-3 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = (status: Order['status']) => {
    switch (status) {
      case 'Executed':
        return 'default';
      case 'Pending':
      case 'PartiallyFilled':
        return 'secondary';
      case 'Cancelled':
        return 'outline';
      case 'Failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const canCancelOrder = (order: Order) => {
    return order.status === 'Pending' || order.status === 'PartiallyFilled';
  };

  const canModifyOrder = (order: Order) => {
    return order.status === 'Pending' && order.order_type !== 'Market';
  };

  const getOrderSummary = () => {
    const pending = orders.filter(o => o.status === 'Pending').length;
    const executed = orders.filter(o => o.status === 'Executed').length;
    const cancelled = orders.filter(o => o.status === 'Cancelled').length;
    const failed = orders.filter(o => o.status === 'Failed').length;
    
    return { pending, executed, cancelled, failed };
  };

  const summary = getOrderSummary();

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg font-semibold">Order Book</CardTitle>
            <Badge variant="outline" className="text-xs">
              {filteredOrders.length} orders
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
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
        </div>

        {/* Order Summary */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center p-2 rounded bg-yellow-50 dark:bg-yellow-900/20">
            <div className="font-semibold text-yellow-700 dark:text-yellow-400">{summary.pending}</div>
            <div className="text-yellow-600 dark:text-yellow-500">Pending</div>
          </div>
          <div className="text-center p-2 rounded bg-green-50 dark:bg-green-900/20">
            <div className="font-semibold text-green-700 dark:text-green-400">{summary.executed}</div>
            <div className="text-green-600 dark:text-green-500">Executed</div>
          </div>
          <div className="text-center p-2 rounded bg-gray-50 dark:bg-gray-900/20">
            <div className="font-semibold text-gray-700 dark:text-gray-400">{summary.cancelled}</div>
            <div className="text-gray-600 dark:text-gray-500">Cancelled</div>
          </div>
          <div className="text-center p-2 rounded bg-red-50 dark:bg-red-900/20">
            <div className="font-semibold text-red-700 dark:text-red-400">{summary.failed}</div>
            <div className="text-red-600 dark:text-red-500">Failed</div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex space-x-1 overflow-x-auto">
          {(['all', 'pending', 'executed', 'cancelled', 'failed'] as OrderFilter[]).map((filterOption) => (
            <Button
              key={filterOption}
              variant={filter === filterOption ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterOption)}
              className="text-xs capitalize whitespace-nowrap"
            >
              {filterOption}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No orders found</p>
              {filter !== 'all' && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setFilter('all')}
                  className="mt-2"
                >
                  Show all orders
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-3 border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Order Header */}
                      <div className="flex items-center space-x-2 mb-1">
                        {getStatusIcon(order.status)}
                        <span className="font-medium text-sm">{order.symbol}</span>
                        <Badge
                          variant={order.trade_type === 'Buy' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {order.trade_type === 'Buy' ? (
                            <TrendingUp className="w-2 h-2 mr-1" />
                          ) : (
                            <TrendingDown className="w-2 h-2 mr-1" />
                          )}
                          {order.trade_type}
                        </Badge>
                        <Badge
                          variant={getStatusBadgeVariant(order.status)}
                          className="text-xs"
                        >
                          {order.status}
                        </Badge>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
                        <div>
                          <span className="font-medium">Qty:</span> {order.quantity}
                          {order.filled_quantity > 0 && (
                            <span className="text-green-600">
                              {' '}({order.filled_quantity} filled)
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {order.order_type}
                        </div>
                        {order.price && (
                          <div>
                            <span className="font-medium">Price:</span> {formatCurrency(order.price)}
                          </div>
                        )}
                        {order.average_price && (
                          <div>
                            <span className="font-medium">Avg:</span> {formatCurrency(order.average_price)}
                          </div>
                        )}
                      </div>

                      {/* Timestamps */}
                      <div className="text-xs text-muted-foreground">
                        Created: {formatTime(order.created_at)}
                        {order.updated_at !== order.created_at && (
                          <span className="ml-2">
                            Updated: {formatTime(order.updated_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-1 ml-2">
                      {canModifyOrder(order) && onModifyOrder && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onModifyOrder(order.id)}
                          className="text-xs h-6 px-2"
                        >
                          Modify
                        </Button>
                      )}
                      {canCancelOrder(order) && onCancelOrder && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCancelOrder(order.id)}
                          className="text-xs h-6 px-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default OrderBook;